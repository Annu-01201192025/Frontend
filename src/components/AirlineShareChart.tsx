import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { generateAirlineShare, type FlightRecord } from '@/lib/mockData';

const COLORS = ['#1E40AF', '#123B66', '#0891B2', '#64748B'];

interface Props {
  records: FlightRecord[];
}

export default function AirlineShareChart({ records }: Props) {
  const data = useMemo(() => generateAirlineShare(records), [records]);

  const total = data.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <PieIcon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Airline Market Share</h2>
          <p className="text-sm text-slate-500">Record distribution by carrier</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="airline"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: '13px',
            }}
            formatter={(value: any, name: any) => [
              `${Number(value ?? 0)} records (${((Number(value ?? 0) / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
