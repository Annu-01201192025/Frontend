import { Table2 } from 'lucide-react';
import type { FlightRecord } from '@/lib/mockData';

interface Props {
  records: FlightRecord[];
  newlyAdded?: Set<string>;
}

function formatScrapedAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const date = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
  return `${date}, ${time}`;
}

const AIRLINE_BADGE: Record<string, string> = {
  IndiGo: 'bg-sky-100 text-sky-700',
  'Air India': 'bg-orange-100 text-orange-700',
  Vistara: 'bg-violet-100 text-violet-700',
};

export default function DataFeed({ records, newlyAdded }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Table2 className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Raw Data Feed</h2>
            <p className="text-sm text-slate-500">
              Latest ingested flight price records
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
          {records.length} records
        </span>
      </div>

      {/* Scrollable table */}
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200">
              {['Airline', 'Flight No.', 'Origin', 'Dest.', 'Departure', 'Price (₹)', 'Anomaly' , 'Scraped At'].map(
                (col) => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-400">
                  No records available.
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const isNew = newlyAdded?.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={`transition-colors hover:bg-sky-50/40 ${
                      isNew ? 'animate-in fade-in slide-in-from-right-5 duration-500 bg-emerald-50/60' : ''
                    }`}
                  >
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
                          AIRLINE_BADGE[r.airline] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {r.airline}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-sm font-medium text-slate-700">
                      {r.flight_number || r.flight_no}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-slate-700">
                      {r.origin}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-slate-700">
                      {r.destination || r.dest}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">
                      {r.departure_time || r.departure}
                    </td>
          
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-900">
                          ₹{r.price.toLocaleString('en-IN')}
                          </span>
                          
                          {r.is_anomaly && (
                            <span className="inline-flex w-fit rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              ⚠ Fare Spike
                              </span>
                          )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {r.is_anomaly ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit rounded-md bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                            ⚠ Fare Spike
                          </span>
                          <span className="text-xs font-medium text-red-600">
                            +{(r.pct_deviation! * 100).toFixed(1)}% vs avg
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">
                          Normal
                        </span>
                      )} 
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {formatScrapedAt(r.scraped_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
