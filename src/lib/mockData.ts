export type Airline = 'IndiGo' | 'Air India' | 'Vistara' | 'SpiceJet';

export type RouteKey = 'DEL-BOM' | 'BLR-DEL' | 'BOM-MAA' | 'DEL-HYD';

export interface FlightRecord {
  id: string;
  airline: Airline;
  flight_no: string;
  origin: string;
  dest: string;
  departure: string;
  price: number;
  scraped_at: string;

  destination?: string;
  flight_number?: string;
  departure_time?: string;
  is_anomaly?: boolean;
  pct_deviation?: number;
  moving_avg_7d?: number;
}

export interface MetricsResponse {
  status?: string;
  is_simulation?: boolean;
  total_records: number;
  valid_records_count?: number;
  airfare_index: number;
  index_breakdown?: Record<string, number>;
  data: FlightRecord[];
}

export interface TrendPoint {
  date: string;
  'IndiGo': number;
  'Air India': number;
  'Vistara': number;
  'SpiceJet': number;
  index: number;
}

const AIRLINES: Airline[] = ['IndiGo', 'Air India', 'Vistara', 'SpiceJet'];

const FLIGHT_PREFIX: Record<Airline, string> = {
  IndiGo: '6E',
  'Air India': 'AI',
  Vistara: 'UK',
  SpiceJet: 'SG',
};

const ROUTES: { key: RouteKey; origin: string; dest: string; label: string }[] = [
  { key: 'DEL-BOM', origin: 'DEL', dest: 'BOM', label: 'Delhi → Mumbai' },
  { key: 'BLR-DEL', origin: 'BLR', dest: 'DEL', label: 'Bengaluru → Delhi' },
];

const TIMES = ['06:00', '07:30', '09:15', '11:00', '14:20', '17:45', '20:10', '22:30'];

// Deterministic pseudo-random so the data is stable across reloads
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = seeded(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const BASE_FARES: Record<RouteKey, number> = {
  'DEL-BOM': 4200,
  'BLR-DEL': 5100,
  'BOM-MAA': 3800,
  'DEL-HYD': 3600,
};

export function generateTrendData(airline: Airline | 'All', route: RouteKey = 'DEL-BOM'): TrendPoint[] {
  const days: TrendPoint[] = [];
  const today = new Date();
  const base = BASE_FARES[route];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayProgress = 29 - i; // 0..29

    AIRLINES.forEach((a) => {
      const volatility = (rng() - 0.5) * 400;
      const trend = dayProgress * 25; // gradual upward trend
      const airlineMultiplier = a === 'IndiGo' ? 0.92 : a === 'Air India' ? 1.08 : 1.15;
      (days as any)[29 - i] = (days as any)[29 - i] || {
        date: fmtDate(d),
        'IndiGo': 0,
        'Air India': 0,
        'Vistara': 0,
        index: 100,
      };
      ((days as any)[29 - i] as any)[a] = Math.round(base * airlineMultiplier + trend + volatility);
    });

    const pt = days[29 - i];
    const avgOf3 = (pt['IndiGo'] + pt['Air India'] + pt['Vistara']) / 3;
    pt.index = Math.round((avgOf3 / base) * 1000) / 10;
  }

  if (airline !== 'All') {
    return days.map((d) => ({ ...d, index: d[airline] }));
  }

  return days;
}

export function generateFlightRecords(count: number = 50): FlightRecord[] {
  const records: FlightRecord[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const airline = pick(AIRLINES);
    const route = pick(ROUTES);
    const base = BASE_FARES[route.key];
    const variance = (rng() - 0.4) * 1200;
    const price = roundTo(base + variance, 10);

    const scrapedAt = new Date(now);
    scrapedAt.setMinutes(now.getMinutes() - i * 3);

    records.push({
      id: `${airline}-${route.key}-${i}`,
      airline,
      flight_no: `${FLIGHT_PREFIX[airline]}${Math.floor(rng() * 900) + 100}`,
      origin: route.origin,
      dest: route.dest,
      departure: pick(TIMES),
      price,
      scraped_at: scrapedAt.toISOString(),
    });
  }

  return records;
}

export function getLatestMetrics(): MetricsResponse {
  const data = generateFlightRecords(50);
  const trend = generateTrendData('All', 'DEL-BOM');
  const latest = trend[trend.length - 1];
  const avg = data.reduce((sum, r) => sum + r.price, 0) / data.length;

  return {
  status: 'success',
  is_simulation: true,
  total_records: 12847,
  valid_records_count: data.length,
  airfare_index: latest.index,
  data,
 };
}

export function simulateScrape(): Promise<FlightRecord[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(generateFlightRecords(8));
    }, 2200);
  });
}

export interface AirlineShare {
  airline: Airline;
  count: number;
  avgPrice: number;
}

export function generateAirlineShare(records: FlightRecord[]): AirlineShare[] {
  const groups: Record<string, FlightRecord[]> = {};
  for (const r of records) {
    if (!groups[r.airline]) groups[r.airline] = [];
    groups[r.airline].push(r);
  }
  return AIRLINES.map((a) => {
    const recs = groups[a] || [];
    const avg = recs.length > 0 ? recs.reduce((s, r) => s + r.price, 0) / recs.length : 0;
    return { airline: a, count: recs.length, avgPrice: Math.round(avg) };
  });
}

export interface RouteComparison {
  route: string;
  label: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

export function generateRouteComparison(records: FlightRecord[]): RouteComparison[] {
  return ROUTES.map((r) => {
    const recs = records.filter((rec) => rec.origin === r.origin && rec.dest === r.dest);
    if (recs.length === 0) {
      return { route: r.key, label: r.label, avgPrice: BASE_FARES[r.key], minPrice: BASE_FARES[r.key], maxPrice: BASE_FARES[r.key] };
    }
    const prices = recs.map((rec) => rec.price);
    return {
      route: r.key,
      label: r.label,
      avgPrice: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    };
  });
}

export function generateIndexHistory(): { date: string; index: number; ma7: number }[] {
  const trend = generateTrendData('All', 'DEL-BOM');
  return trend.map((d, i) => {
    const window = trend.slice(Math.max(0, i - 6), i + 1);
    const ma = window.reduce((s, w) => s + w.index, 0) / window.length;
    return { date: d.date, index: d.index, ma7: Math.round(ma * 10) / 10 };
  });
}

export const ROUTE_OPTIONS = ROUTES;
