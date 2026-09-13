import { TrendingUp, IndianRupee, Navigation, Database } from 'lucide-react';
import type { MetricsResponse } from '@/lib/mockData';

interface Props {
  metrics: MetricsResponse;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

export default function KpiCards({ metrics }: Props) {
  const cards = [
    {
      label: 'Current Airfare Index',
      value: metrics.airfare_index.toFixed(1),
      sub: `Base 100.0 • ${metrics.airfare_index >= 100 ? '+' : ''}${(metrics.airfare_index - 100).toFixed(1)}% vs. base period`,
      icon: TrendingUp,
      gradient: 'from-blue-700 to-blue-800',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
    {
      label: 'Average Spot Fare',
      value: `₹${formatNumber(
        metrics.data.length
        ? Math.round(metrics.data.reduce((sum, flight) => sum + flight.price, 0) / metrics.data.length)
        : 0
      )}`,
      sub: 'Across all tracked routes',
      icon: IndianRupee,
      gradient: 'from-blue-700 to-blue-800',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
    {
      label: 'Active Tracking Route',
      value: metrics.data.length
      ? `${metrics.data[0].origin} → ${metrics.data[0].destination}`
      : 'No active route',
      sub: 'Morning peak window',
      icon: Navigation,
      gradient: 'from-blue-700 to-blue-800',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
    {
      label: 'Total Records Analyzed',
      value: formatNumber(metrics.total_records),
      sub: 'Flight price snapshots',
      icon: Database,
      gradient: 'from-blue-700 to-blue-800',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`group relative overflow-hidden rounded-2xl border ${card.border} bg-white p-6 shadow-sm transition-all hover:shadow-lg`}
          >
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full ${card.bg} opacity-60 transition-transform group-hover:scale-125`} />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                  {card.value}
                </p>
                <p className={`mt-1.5 text-xs font-medium ${card.text}`}>{card.sub}</p>
              </div>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-md`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
