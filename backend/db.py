import pymysql
import pymysql.cursors
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

# --- CONFIGURATION & SIMULATION TOGGLE ---
USE_SIMULATION_MODE = False  # Set to True if MySQL is offline or for testing

MYSQL_CONFIG = {
    "host": "127.0.0.1",
    "user": "root",
    "password": "Mamta@7576",
    "database": "aeroindex_db",
    "connect_timeout": 2,  # Fail fast after 2s if MySQL doesn't respond
    "cursorclass": pymysql.cursors.DictCursor
}

def get_db_connection():
    """Establishes connection to MySQL database using PyMySQL."""
    return pymysql.connect(**MYSQL_CONFIG)


def get_latest_records(limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetches the most recent flight records from MySQL.
    Falls back to mock_data.json if USE_SIMULATION_MODE = True or DB connection fails.
    """
    if USE_SIMULATION_MODE:
        return _get_mock_fallback()

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            query = """
                SELECT airline, flight_number, origin, destination, departure_time, price, scraped_at
                FROM flight_prices
                ORDER BY id DESC
                LIMIT %s
            """
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            
            for row in rows:
                row["price"] = float(row["price"])
                row["departure_time"] = str(row["departure_time"])
                row["scraped_at"] = str(row["scraped_at"])
                
        conn.close()
        return rows
    except Exception as e:
        print(f"[Warning] MySQL fetch failed or timed out ({e}). Falling back to Simulation Mode.")
        return _get_mock_fallback()


def get_historical_prices(days_back: int = 7) -> Dict[str, List[float]]:
    """
    Fetches past prices grouped by route-window key (e.g., 'DEL-BOM:7d').
    """
    if USE_SIMULATION_MODE:
        return {}

    history = {}
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            query = """
                SELECT UPPER(origin) AS origin, UPPER(destination) AS destination, 
                       departure_time, scraped_at, price
                FROM flight_prices
                WHERE scraped_at >= NOW() - INTERVAL %s DAY
            """
            cursor.execute(query, (days_back,))
            rows = cursor.fetchall()
            
            from processing import route_window_key
            for r in rows:
                r["price"] = float(r["price"])
                r["departure_time"] = str(r["departure_time"])
                r["scraped_at"] = str(r["scraped_at"])
                
                key = route_window_key(r)
                if key not in history:
                    history[key] = []
                history[key].append(r["price"])

        conn.close()
        return history
    except Exception as e:
        print(f"[Warning] Failed to fetch historical prices: {e}")
        return {}


def save_flight_records(records: List[Dict[str, Any]]):
    """Inserts clean flight records into MySQL."""
    if not records or USE_SIMULATION_MODE:
        print("[DB] No records provided or running in simulation mode. Skipping save.")
        return
        
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            insert_query = """
                INSERT INTO flight_prices (airline, flight_number, origin, destination, departure_time, price, scraped_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            data_tuples = []
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            for r in records:
                dep_time = str(r.get("departure_time", "")).replace("T", " ")[:19]
                scraped_at = str(r.get("scraped_at", now_str)).replace("T", " ")[:19]
                
                if not scraped_at:
                    scraped_at = now_str

                data_tuples.append((
                    r.get("airline", "Unknown"),
                    r.get("flight_number", "N/A"),
                    r.get("origin", "DEL"),
                    r.get("destination", "BOM"),
                    dep_time,
                    float(r.get("price", 0.0)),
                    scraped_at
                ))

            cursor.executemany(insert_query, data_tuples)
            conn.commit()
            print(f"[DB SUCCESS] Successfully inserted {len(data_tuples)} records into MySQL.")
            
        conn.close()
    except Exception as e:
        print(f"[DB ERROR] Failed to save flight records to MySQL: {e}")


def _get_mock_fallback() -> List[Dict[str, Any]]:
    """Loads mock_data.json as zero-latency fallback."""
    if os.path.exists("mock_data.json"):
        with open("mock_data.json", "r") as f:
            return json.load(f)
    return []

def get_report_records(days_back: int = 30) -> List[Dict[str, Any]]:
    """
    Fetch all flight-price observations from MySQL for a statistical report.

    Unlike get_latest_records(), this does NOT limit the result to 100 rows.
    It retrieves all valid observations from the requested historical period.
    """

    if USE_SIMULATION_MODE:
        print("[REPORT] Simulation mode is enabled. No historical DB records.")
        return []

    try:
        conn = get_db_connection()

        with conn.cursor() as cursor:
            query = """
                SELECT
                    airline,
                    flight_number,
                    origin,
                    destination,
                    departure_time,
                    price,
                    scraped_at
                FROM flight_prices
                WHERE scraped_at >= NOW() - INTERVAL %s DAY
                ORDER BY scraped_at ASC
            """

            cursor.execute(query, (days_back,))
            rows = cursor.fetchall()

        conn.close()

        records = []

        for row in rows:
            try:
                row["price"] = float(row["price"])

                row["origin"] = str(row["origin"]).upper()
                row["destination"] = str(row["destination"]).upper()

                row["departure_time"] = str(row["departure_time"])
                row["scraped_at"] = str(row["scraped_at"])

                records.append(row)

            except (ValueError, TypeError):
                continue

        print(
            f"[REPORT] Retrieved {len(records)} records "
            f"from the last {days_back} days."
        )

        return records

    except Exception as e:
        print(f"[REPORT ERROR] Failed to fetch report records: {e}")
        return []
    
def get_historical_chart_data(days_back: int = 30) -> List[Dict[str, Any]]:
    """
    Fetch historical airfare data for frontend time-series charts.
    Groups fares by date, airline, and route.
    """

    if USE_SIMULATION_MODE:
        return []

    try:
        conn = get_db_connection()

        with conn.cursor() as cursor:
            query = """
                SELECT
                    DATE(scraped_at) AS date,
                    airline,
                    UPPER(origin) AS origin,
                    UPPER(destination) AS destination,
                    AVG(price) AS average_price,
                    COUNT(*) AS records
                FROM flight_prices
                WHERE scraped_at >= NOW() - INTERVAL %s DAY
                GROUP BY
                    DATE(scraped_at),
                    airline,
                    origin,
                    destination
                ORDER BY
                    date ASC,
                    airline ASC
            """

            cursor.execute(query, (days_back,))
            rows = cursor.fetchall()

        conn.close()

        for row in rows:
            row["date"] = str(row["date"])
            row["average_price"] = round(float(row["average_price"]), 2)
            row["records"] = int(row["records"])

        return rows

    except Exception as e:
        print(f"[HISTORY ERROR] Failed to fetch chart data: {e}")
        return []
