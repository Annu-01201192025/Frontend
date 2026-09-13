import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { generateRouteComparison, type FlightRecord } from '@/lib/mockData';

interface Props {
  records: FlightRecord[];
}

export default function RouteComparisonChart({ records }: Props) {
  const data = useMemo(() => generateRouteComparison(records), [records]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <BarChart3 className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Route Fare Comparison</h2>
          <p className="text-sm text-slate-500">Min / Avg / Max fares by route</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="route"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            width={50}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: '13px',
            }}
            cursor={{ fill: '#f1f5f9' }}
            formatter={(value: any, name: any) => [
              `₹${Number(value ?? 0).toLocaleString('en-IN')}`,
              name,
            ]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
          <Bar dataKey="minPrice" name="Min" fill="#38BDF8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="avgPrice" name="Avg" fill="#1E40AF" radius={[4, 4, 0, 0]} />
          <Bar dataKey="maxPrice" name="Max" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
