import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface IndexPoint {
  date: string;
  index: number;
}

export default function IndexHistoryChart() {
  const [historyData, setHistoryData] = useState<IndexPoint[]>([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/index/history?days_back=30')
      .then((response) => response.json())
      .then((data) => setHistoryData(data.data || []))
      .catch((error) => console.error('Index History API Error:', error));
  }, []);

  const data = useMemo(() => {
    return historyData.map((item, index, array) => {
      const start = Math.max(0, index - 6);
      const window = array.slice(start, index + 1);

      const ma7 =
        window.reduce((sum, point) => sum + point.index, 0) / window.length;

      return {
        date: item.date,
        index: item.index,
        ma7: Number(ma7.toFixed(2)),
      };
    });
  }, [historyData]);

  const latest = data[data.length - 1];
  const first = data[0];

  const change = latest && first ? latest.index - first.index : 0;

  const changePct =
    latest && first
      ? ((change / first.index) * 100).toFixed(2)
      : '0.00';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <TrendingUp className="h-5 w-5 text-slate-700" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">
              AeroIndex Score History
            </h2>
            <p className="text-sm text-slate-500">
              30-day index with 7-day moving average
            </p>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-bold ${
              change >= 0
                ? 'bg-orange-50 text-orange-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)} (
            {changePct}%)
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval={2}
            angle={-45}
            textAnchor="end"
            height={70}
          />

          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 2', 'dataMax + 2']}
            width={45}
          />

          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: '13px',
            }}
            labelStyle={{
              fontWeight: 600,
              color: '#0f172a',
            }}
          />

          <Legend
            iconType="circle"
            wrapperStyle={{
              fontSize: '13px',
              paddingTop: '10px',
            }}
          />

          <Line
            type="monotone"
            dataKey="index"
            name="Daily Index"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />

          <Line
            type="monotone"
            dataKey="ma7"
            name="7-Day MA"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}