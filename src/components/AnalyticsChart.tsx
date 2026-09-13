import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { LineChart as LineChartIcon, ChevronDown } from 'lucide-react';
import {
  ROUTE_OPTIONS,
  type Airline,
  type RouteKey,
} from '@/lib/mockData';

type AirlineFilter = Airline | 'All';

const AIRLINE_OPTIONS: AirlineFilter[] = ['All', 'IndiGo', 'Air India', 'Vistara'];

const AIRLINE_COLORS: Record<string, string> = {
  IndiGo: '#2563EB',
  'Air India': '#123B66',
  Vistara: '#0891B2',
  SpiceJet: '#64748B',
  index: '#16805C',
};

export default function AnalyticsChart() {
  const [airline, setAirline] = useState<AirlineFilter>('All');
  const [route, setRoute] = useState<RouteKey>('DEL-BOM');
  const [historyData, setHistoryData] = useState<any[]>([]);

useEffect(() => {
  fetch('http://localhost:8000/api/v1/history?days_back=30')
    .then((response) => response.json())
    .then((data) => setHistoryData(data.data || []))
    .catch((error) => console.error('History API Error:', error));
}, []);

  const chartData = useMemo(() => {
  const [origin, destination] = route.split('-');

  const filtered = historyData.filter(
    (item) =>
      item.origin === origin &&
      item.destination === destination &&
      (airline === 'All' || item.airline === airline)
  );

  const grouped: Record<string, Record<string, number>> = {};

  filtered.forEach((item) => {
    if (!grouped[item.date]) {
      grouped[item.date] = {};
    }

    grouped[item.date][item.airline] = Number(item.average_price);
  });

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => ({
      date,
      ...prices,
    }));
}, [historyData, airline, route]);

  const lines = airline === 'All'
    ? (['IndiGo', 'Air India', 'Vistara', 'SpiceJet'] as Airline[])
    : [airline];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <LineChartIcon className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">30-Day Airfare Trend</h2>
            <p className="text-sm text-slate-500">
              Price movement across airlines & routes
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Airline filter */}
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Airline
            </label>
            <div className="relative">
              <select
                value={airline}
                onChange={(e) => setAirline(e.target.value as AirlineFilter)}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                {AIRLINE_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a === 'All' ? 'All Airlines' : a}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Route filter */}
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Route
            </label>
            <div className="relative">
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value as RouteKey)}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                {ROUTE_OPTIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <defs>
              {lines.map((l) => (
                <linearGradient key={l} id={`grad-${l}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AIRLINE_COLORS[l]} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={AIRLINE_COLORS[l]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
              width={75}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '13px',
              }}
              labelStyle={{ fontWeight: 600, color: '#0f172a' }}
              formatter={(value: any, name: any) => [
                `₹${Number(value ?? 0).toLocaleString('en-IN')}`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
            />
            {lines.map((l) => (
              <Area
                key={l}
                type="monotone"
                dataKey={l}
                stroke={AIRLINE_COLORS[l]}
                strokeWidth={2.5}
                fill={`url(#grad-${l})`}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
