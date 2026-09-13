import os
import re
import json
import time
import shutil
import tempfile
import logging
from datetime import datetime, timedelta
from concurrent.futures import ProcessPoolExecutor, as_completed
from playwright.sync_api import sync_playwright

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("FlightScraper")


def clean_error_message(e: Exception) -> str:
    """Extracts a short, readable 1-line error message without verbose traces."""
    raw = str(e)
    if "Timeout" in raw:
        if any(w in raw for w in ["flight-details", "flight-item", "result-item", "srp__search"]):
            return "Timed out waiting for flight results page"
        if any(w in raw for w in ["search-widget", "origin", "destination", "datepicker", "calendar"]):
            return "Timed out waiting for booking widget or dates"
        return "Search timed out"
    if "No flights found" in raw:
        return "No flights found for this route"

    first_line = raw.split("\n")[0].strip()
    first_line = re.sub(r"^Page\.\w+:\s*", "", first_line)
    first_line = re.sub(r"https?://\S+", "", first_line).strip()
    return first_line if first_line else "Unknown error occurred"


# ==========================================
# 1. AIR INDIA SCRAPER (Original Logic)
# ==========================================
def _handle_ai_cookie_banner(page):
    try:
        accept_btn = page.locator("#onetrust-accept-btn-handler")
        if accept_btn.is_visible(timeout=5000):
            accept_btn.click()
            page.wait_for_timeout(1000)
    except Exception:
        pass


def _select_ai_station(page, field_type: str, airport_code: str):
    field_container = page.locator(f".ai-origin-destination__field--{field_type} .ai-origin-destination__field-container")
    field_container.wait_for(state="visible", timeout=20000)
    field_container.click()
    page.wait_for_timeout(1000)

    page.keyboard.type(airport_code, delay=120)
    page.wait_for_timeout(1500)

    option = page.locator(f"mat-option:has-text('{airport_code}')").first
    option.wait_for(state="visible", timeout=10000)
    option.click()
    page.wait_for_timeout(1000)


def _select_ai_departure_date(page, days_ahead: int = 7):
    page.wait_for_selector("mat-calendar, .ai-date-picker__container", timeout=15000)
    target_date = datetime.now() + timedelta(days=days_ahead)
    day_str = str(target_date.day)

    cells = page.locator(".mat-calendar-body-cell:not(.mat-calendar-body-disabled)")
    clicked = False
    for i in range(cells.count()):
        cell = cells.nth(i)
        cell_text = cell.locator(".mat-calendar-body-cell-content").inner_text().strip()
        if cell_text == day_str:
            cell.click()
            clicked = True
            break

    if not clicked and cells.count() > 0:
        cells.first.click()
    page.wait_for_timeout(1000)


def scrape_air_india(origin: str, destination: str, days_ahead: int = 7, headless: bool = False):
    origin = origin.upper().strip()
    destination = destination.upper().strip()
    flights = []
    temp_dir = tempfile.mkdtemp(prefix="airindia_fresh_")

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=temp_dir,
                channel="chrome",
                headless=headless,
                ignore_default_args=["--enable-automation"],
                args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
                viewport={"width": 1920, "height": 1080} if headless else None,
                no_viewport=True if not headless else False,
            )
            page = context.pages[0] if context.pages else context.new_page()

            page.goto("https://www.airindia.com/", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)
            _handle_ai_cookie_banner(page)

            one_way_radio = page.locator("label:has-text('One Way'), input[value='one-way']").first
            if one_way_radio.is_visible():
                one_way_radio.click()
                page.wait_for_timeout(500)

            _select_ai_station(page, "origin", origin)
            _select_ai_station(page, "destination", destination)

            try:
                _select_ai_departure_date(page, days_ahead)
            except Exception:
                pass

            search_btn = page.locator("button:has-text('Show Flights'), button:has-text('Search Flights'), button:has-text('Search')").first
            search_btn.wait_for(state="visible", timeout=10000)
            search_btn.click()

            page.wait_for_selector("ai-pb-flight-item", timeout=45000)
            items = page.locator("ai-pb-flight-item").all()
            if not items:
                raise RuntimeError(f"No flights found for {origin} -> {destination}")

            now = datetime.now()
            target_date = now + timedelta(days=days_ahead)
            scraped_at = now.strftime("%Y-%m-%dT%H:%M:%S")
            timestamp_date = now.strftime("%Y-%m-%d")

            for item in items:
                flight_id_elem = item.locator(".ai-pb-flight-id").first
                flight_num = "AI"
                if flight_id_elem.count() > 0:
                    raw_id = " ".join(flight_id_elem.inner_text().split())
                    flight_num = raw_id.replace(" ", "-")

                dep_elem = item.locator(".ai-pb-departure-time").first
                dep_time = dep_elem.inner_text().strip() if dep_elem.count() > 0 else "00:00"

                price_elem = item.locator(".ai-pb-economy-card .ai-pb-actual-price").first
                if price_elem.count() == 0:
                    price_elem = item.locator(".ai-pb-price").first

                if price_elem.count() > 0:
                    digits = re.sub(r"[^\d.]", "", price_elem.inner_text())
                    if not digits:
                        continue
                    price_val = float(digits)
                else:
                    continue

                flights.append({
                    "airline": "Air India",
                    "flight_number": flight_num,
                    "origin": origin,
                    "destination": destination,
                    "departure_time": f"{target_date.strftime('%Y-%m-%d')}T{dep_time}:00",
                    "price": price_val,
                    "timestamp": timestamp_date,
                    "scraped_at": scraped_at
                })
            context.close()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return flights


# ==========================================
# 2. AIR INDIA EXPRESS SCRAPER (Original Logic)
# ==========================================
def _select_aix_station(page, field_id: str, input_id: str, airport_code: str):
    container = page.locator(f"#new-origin-destination-container-desktop #{field_id}").first
    container.wait_for(state="visible", timeout=20000)
    container.click()
    page.wait_for_timeout(500)

    inp = page.locator(f"input#{input_id}").first
    inp.wait_for(state="visible", timeout=10000)
    inp.fill(airport_code)
    page.wait_for_timeout(1000)

    item = page.locator(f".arrival-dropdown-holder button:has-text('{airport_code}')").first
    if not item.is_visible():
        raise RuntimeError(f"Airport code {airport_code} not found in dropdown.")
    item.click()
    page.wait_for_timeout(1000)


def _select_aix_date(page, days_ahead: int = 7):
    if not page.locator(".dialog-date-picker.open").is_visible():
        date_btn = page.locator("#new-date-selection-container-desktop #start-date-input-button").first
        date_btn.click()
        page.wait_for_timeout(1000)

    target_date = datetime.now() + timedelta(days=days_ahead)
    day_str = str(target_date.day)

    day_cell = page.locator(f".calendar-content .new-day.day:not(.disabled):has(.new-calender-day:text-is('{day_str}'))").first
    if not day_cell.is_visible():
        raise RuntimeError(f"Date +{days_ahead} ({day_str}) not available in calendar.")
    day_cell.click()
    page.wait_for_timeout(500)

    confirm_btn = page.locator("#calendar-confirm").first
    if confirm_btn.is_visible():
        confirm_btn.click()
        page.wait_for_timeout(500)


def scrape_air_india_express(origin: str, destination: str, days_ahead: int = 7, headless: bool = False):
    origin = origin.upper().strip()
    destination = destination.upper().strip()
    flights = []
    temp_dir = tempfile.mkdtemp(prefix="aix_session_")

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=temp_dir,
                headless=headless,
                args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
                viewport={"width": 1920, "height": 1080} if headless else None,
                no_viewport=True if not headless else False,
            )
            page = context.pages[0] if context.pages else context.new_page()

            page.goto("https://www.airindiaexpress.com/home", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_selector(".new-flight-search-widget-container", timeout=30000)
            page.wait_for_timeout(1500)

            one_way_btn = page.locator("#One Way").first
            if one_way_btn.is_visible():
                one_way_btn.click()
                page.wait_for_timeout(500)

            _select_aix_station(page, "new-flight-search-origin-field-text", "basic-url-origin", origin)
            _select_aix_station(page, "new-flight-search-destination-field-text", "basic-url-destination", destination)
            _select_aix_date(page, days_ahead)

            search_btn = page.locator(".new-flight-search-widget-container .new-search-flight-button-container").first
            search_btn.click()

            page.wait_for_selector(".flight-details-wrapper", timeout=45000)
            cards = page.locator(".flight-details-wrapper").all()
            if not cards:
                raise RuntimeError(f"No flights found for {origin} -> {destination}")

            now = datetime.now()
            target_date = now + timedelta(days=days_ahead)
            scraped_at = now.strftime("%Y-%m-%dT%H:%M:%S")
            timestamp_date = now.strftime("%Y-%m-%d")

            for card in cards:
                num_elem = card.locator(".flight-det-number").first
                if num_elem.count() == 0:
                    continue
                flight_no = num_elem.inner_text().strip().replace(" ", "-")

                dep_time_elem = card.locator(".inner-flight-time").first
                dep_time = dep_time_elem.inner_text().strip() if dep_time_elem.count() > 0 else "00:00"

                price_elem = card.locator(".current-fare").first
                if price_elem.count() == 0:
                    continue
                digits = re.sub(r"[^\d.]", "", price_elem.inner_text())
                if not digits:
                    continue
                price_val = float(digits)

                flights.append({
                    "airline": "Air India Express",
                    "flight_number": flight_no,
                    "origin": origin,
                    "destination": destination,
                    "departure_time": f"{target_date.strftime('%Y-%m-%d')}T{dep_time}:00",
                    "price": price_val,
                    "timestamp": timestamp_date,
                    "scraped_at": scraped_at
                })
            context.close()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return flights


# ==========================================
# 3. VISTARA (ADANI ONE) SCRAPER (Original Logic)
# ==========================================
def _select_vistara_airport(page, input_id: str, airport_code: str):
    field = page.locator(f"input#{input_id}")
    field.wait_for(state="visible", timeout=20000)
    field.click()
    page.wait_for_timeout(1000)

    suggestion = page.locator(f"ul.airports_suggestions_list li.airport:has-text('{airport_code}')").first
    if suggestion.is_visible(timeout=5000):
        suggestion.click()
    else:
        field.fill(airport_code)
        page.wait_for_timeout(1000)
        page.locator(f"ul.airports_suggestions_list li.airport:has-text('{airport_code}')").first.click()

    page.wait_for_timeout(1000)


def _select_vistara_date(page, days_ahead: int = 7):
    date_input = page.locator("input#onward")
    if not page.locator(".react-datepicker").is_visible():
        date_input.click()
        page.wait_for_timeout(1000)

    page.wait_for_selector(".react-datepicker", timeout=10000)
    target_date = datetime.now() + timedelta(days=days_ahead)
    day_str = str(target_date.day)

    day_cells = page.locator(
        ".react-datepicker__day:not(.react-datepicker__day--disabled):not(.react-datepicker__day--outside-month)"
    )

    clicked = False
    for i in range(day_cells.count()):
        cell = day_cells.nth(i)
        date_num = cell.locator(".datepicker-date span").inner_text().strip()
        if date_num == day_str:
            cell.click()
            clicked = True
            break

    if not clicked:
        raise RuntimeError(f"Could not find available date for +{days_ahead} days in calendar.")
    page.wait_for_timeout(1000)


def scrape_vistara(origin: str, destination: str, days_ahead: int = 7, headless: bool = False):
    origin = origin.upper().strip()
    destination = destination.upper().strip()
    flights = []
    temp_dir = tempfile.mkdtemp(prefix="adanione_session_")

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=temp_dir,
                channel="chrome",
                headless=headless,
                ignore_default_args=["--enable-automation"],
                args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
                viewport={"width": 1920, "height": 1080} if headless else None,
                no_viewport=True if not headless else False,
            )
            page = context.pages[0] if context.pages else context.new_page()

            page.goto("https://www.adanione.com/domestic-airlines/vistara", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_selector(".flight-search-wrapper", timeout=30000)
            page.wait_for_timeout(2000)

            _select_vistara_airport(page, "from", origin)
            _select_vistara_airport(page, "to", destination)
            _select_vistara_date(page, days_ahead)

            search_btn = page.locator("button.adl-button:has-text('Search')").first
            search_btn.wait_for(state="visible", timeout=10000)
            search_btn.click()

            page.wait_for_selector(".result-item-desktop", timeout=45000)
            cards = page.locator(".result-item-desktop").all()
            if not cards:
                raise RuntimeError(f"No flights found for {origin} -> {destination}")

            now = datetime.now()
            target_date = now + timedelta(days=days_ahead)
            scraped_at = now.strftime("%Y-%m-%dT%H:%M:%S")
            timestamp_date = now.strftime("%Y-%m-%d")

            for card in cards:
                airline_elem = card.locator("li.airline p.fm-rm span").first
                airline_name = airline_elem.inner_text().strip() if airline_elem.count() > 0 else "Vistara"

                card_id = card.get_attribute("id") or ""
                flight_match = re.search(r"\^([A-Z0-9]{2})\^(\d{3,4})", card_id)
                if flight_match:
                    flight_num = f"{flight_match.group(1)}-{flight_match.group(2)}"
                else:
                    retail_match = re.search(r"fkretail([A-Z0-9]{2})(\d{3,4})", card_id)
                    flight_num = f"{retail_match.group(1)}-{retail_match.group(2)}" if retail_match else "UK"

                dep_elem = card.locator("li.depart > p.flx > span").first
                dep_time = dep_elem.inner_text().strip() if dep_elem.count() > 0 else "00:00"

                price_elem = card.locator("li.price p.fm-rb span").first
                if price_elem.count() > 0:
                    digits = re.sub(r"[^\d.]", "", price_elem.inner_text())
                    if not digits:
                        continue
                    price_val = float(digits)
                else:
                    continue

                flights.append({
                    "airline": airline_name,
                    "flight_number": flight_num,
                    "origin": origin,
                    "destination": destination,
                    "departure_time": f"{target_date.strftime('%Y-%m-%d')}T{dep_time}:00",
                    "price": price_val,
                    "timestamp": timestamp_date,
                    "scraped_at": scraped_at
                })
            context.close()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return flights


# ==========================================
# 4. INDIGO SCRAPER (Original Logic & Fixed BOM Dropdown)
# ==========================================
def _select_indigo_station(page, container_selector: str, airport_code: str):
    field = page.locator(container_selector)
    field.wait_for(state="visible", timeout=15000)

    if airport_code in field.inner_text():
        return

    field.locator(".booking-widget-field").first.click()
    page.wait_for_timeout(1000)

    # EXACT ORIGINAL LOGIC: Checks if city card is immediately visible in popular cities list (like BOM)
    city_card = page.locator(
        f".city-selection__list-item-wrapper:has-text('{airport_code}')"
    ).first

    if city_card.is_visible():
        city_card.click()
    else:
        page.keyboard.type(airport_code, delay=120)
        page.wait_for_timeout(1000)
        page.locator(
            f".city-selection__list-item-wrapper:has-text('{airport_code}')"
        ).first.click()

    page.wait_for_timeout(1000)


def _select_indigo_departure_date(page, days_ahead: int = 7):
    dep_field = page.locator(".search-widget-form-body__departure")
    if dep_field.is_visible():
        dep_field.click()
        page.wait_for_timeout(1000)

    target_date = datetime.now() + timedelta(days=days_ahead)
    day_str = str(target_date.day)

    cells = page.locator(
        ".react-calendar__month-view__days__day:not([disabled]), .calendar-day:not(.disabled), [role='gridcell']:not([aria-disabled='true'])"
    )

    clicked = False
    for i in range(cells.count()):
        cell = cells.nth(i)
        if cell.inner_text().strip() == day_str and cell.is_visible():
            cell.click()
            clicked = True
            break

    if not clicked and cells.count() > 3:
        cells.nth(min(days_ahead, cells.count() - 1)).click()

    page.wait_for_timeout(1000)


def scrape_indigo(origin: str, destination: str, days_ahead: int = 7, headless: bool = False):
    origin = origin.upper().strip()
    destination = destination.upper().strip()
    flights = []
    temp_dir = tempfile.mkdtemp(prefix="indigo_session_")

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=temp_dir,
                channel="chrome",
                headless=headless,
                ignore_default_args=["--enable-automation"],
                args=["--disable-blink-features=AutomationControlled", "--start-maximized"],
                viewport={"width": 1920, "height": 1080} if headless else None,
                no_viewport=True if not headless else False,
            )
            page = context.pages[0] if context.pages else context.new_page()

            page.goto("https://www.goindigo.in/", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_selector(".search-widget-form-body", timeout=30000)
            page.wait_for_timeout(2000)

            _select_indigo_station(page, ".search-widget-form-body__from", origin)
            _select_indigo_station(page, ".search-widget-form-body__to", destination)

            try:
                _select_indigo_departure_date(page, days_ahead)
            except Exception:
                pass

            search_btn = page.locator(
                "button.skyplus-button--filled-primary:has-text('Search'), button:has-text('Search Flight'), .search-btn button"
            ).first
            search_btn.wait_for(state="visible", timeout=10000)
            search_btn.click()

            watch_selector = ".srp__search-result-list__item, .common-logic-container-popup__content"
            page.wait_for_selector(watch_selector, timeout=45000)

            if page.locator(".common-logic-container-popup__content").count() > 0 and page.locator(".common-logic-container-popup__content").is_visible():
                heading = page.locator(".common-logic-info__heading").first.inner_text().strip()
                msg = page.locator(".common-logic-info__content").first.inner_text().strip()
                context.close()
                raise RuntimeError(f"IndiGo Site Message: {heading} - {msg}")

            cards = page.locator(".srp__search-result-list__item").all()
            if not cards:
                raise RuntimeError(f"No flights found for {origin} -> {destination}")

            now = datetime.now()
            target_date = now + timedelta(days=days_ahead)
            scraped_at = now.strftime("%Y-%m-%dT%H:%M:%S")
            timestamp_date = now.strftime("%Y-%m-%d")

            for card in cards:
                if card.locator(".sold-out-chip").count() > 0:
                    continue

                num_elem = card.locator(".flight-number").first
                flight_no = "6E"
                if num_elem.count() > 0:
                    raw_num = " ".join(num_elem.inner_text().split())
                    flight_no = raw_num.replace(" ", "-")

                time_elem = card.locator(".details-wrapper__flight-departure .time").first
                dep_time = time_elem.inner_text().strip() if time_elem.count() > 0 else "00:00"

                price_elem = card.locator(".economy-class-item .selected-fare__fare-price").first
                if price_elem.count() == 0:
                    price_elem = card.locator(".selected-fare__fare-price").first

                if price_elem.count() > 0:
                    digits = re.sub(r"[^\d.]", "", price_elem.inner_text())
                    if not digits:
                        continue
                    price_val = float(digits)
                else:
                    continue

                flights.append({
                    "airline": "IndiGo",
                    "flight_number": flight_no,
                    "origin": origin,
                    "destination": destination,
                    "departure_time": f"{target_date.strftime('%Y-%m-%d')}T{dep_time}:00",
                    "price": price_val,
                    "timestamp": timestamp_date,
                    "scraped_at": scraped_at
                })
            context.close()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return flights


# ==========================================
# MASTER RUNNER
# ==========================================
SCRAPERS = {
    "Air India": scrape_air_india,
    "Air India Express": scrape_air_india_express,
    "Vistara": scrape_vistara,
    "IndiGo": scrape_indigo,
}


def _run_single_task(name, scraper_func, origin, destination, days_ahead, headless):
    logger.info(f"Starting [{name}]...")
    try:
        results = scraper_func(origin, destination, days_ahead, headless)
        logger.info(f"[{name}] Done -> Found {len(results)} flights.")
        return name, results, None
    except Exception as e:
        err = clean_error_message(e)
        logger.error(f"[{name}] Failed -> {err}")
        return name, [], err


def scrape_all_flights(
    origin: str = "DEL",
    destination: str = "BOM",
    days_ahead: int = 7,
    headless: bool = False,
    parallel: bool = False
):
    all_flights = []
    errors = {}

    if parallel:
        logger.info("Running scrapers in PARALLEL mode...")
        with ProcessPoolExecutor(max_workers=len(SCRAPERS)) as executor:
            futures = [
                executor.submit(_run_single_task, name, func, origin, destination, days_ahead, headless)
                for name, func in SCRAPERS.items()
            ]
            for future in as_completed(futures):
                name, results, error = future.result()
                if error:
                    errors[name] = error
                else:
                    all_flights.extend(results)
    else:
        logger.info("Running scrapers in SEQUENTIAL mode...")
        for name, func in SCRAPERS.items():
            _, results, error = _run_single_task(name, func, origin, destination, days_ahead, headless)
            if error:
                errors[name] = error
            else:
                all_flights.extend(results)
            time.sleep(1)

    all_flights.sort(key=lambda x: x["price"])

    return {
        "status": "success" if all_flights else "no_data",
        "route": f"{origin.upper()} -> {destination.upper()}",
        "total_flights": len(all_flights),
        "errors": errors,
        "flights": all_flights
    }


if __name__ == "__main__":
    # Keeping headless=False ensures browsers render without triggering bot captchas
    data = scrape_all_flights(
        origin="DEL",
        destination="BOM",
        days_ahead=7,
        headless=False,
        parallel=False
    )

    print("\n--- FINAL CLEAN JSON ---")
    print(json.dumps(data, indent=2))