import { useState, useCallback, useEffect } from 'react';
import ExecutiveHeader from '@/components/ExecutiveHeader';
import KpiCards from '@/components/KpiCards';
import AnalyticsChart from '@/components/AnalyticsChart';
import AirlineShareChart from '@/components/AirlineShareChart';
import RouteComparisonChart from '@/components/RouteComparisonChart';
import IndexHistoryChart from '@/components/IndexHistoryChart';
import DataFeed from '@/components/DataFeed';
import { generateFlightRecords, getLatestMetrics, type FlightRecord, type MetricsResponse } from '@/lib/mockData';

function App() {
    const [metrics, setMetrics] = useState<MetricsResponse>(() => getLatestMetrics());
    useEffect(() => {
      fetch('http://localhost:8000/api/v1/metrics/latest')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        return response.json();
      })
      .then((data: MetricsResponse) => {
        const normalizedData = {
          ...data,
          data: data.data.map((flight, index) => ({
            ...flight,
            id:
            flight.id ||
            `${flight.airline}-${flight.flight_number}-${flight.departure_time}-${index}`,
            flight_no: flight.flight_number || flight.flight_no,
            dest: flight.destination || flight.dest,
            departure: flight.departure_time || flight.departure,
          })),
        };
        
        setMetrics(normalizedData);
        console.log('✅ Backend metrics loaded:', normalizedData);
      })
      .catch((error) => {
        console.error('❌ API Error:', error);
      });
    }, []);
      

  const [newlyAdded, setNewlyAdded] = useState<Set<string>>(new Set());

  const handleScrapeComplete = useCallback((records: FlightRecord[]) => {
    setMetrics((prev) => ({
      ...prev,
      data: records,
      total_records: records.length,
    }));
    const newIds = new Set(records.map((r) => r.id));
    setNewlyAdded(newIds);
    setTimeout(() => setNewlyAdded(new Set()), 6000);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <ExecutiveHeader onScrapeComplete={handleScrapeComplete} />
        
        <p className="text-sm leading-6 text-slate-600">
          AeroIndex monitors real-time domestic airfare prices, processes flight fare
          data, and calculates an Airfare Price Index to track price movements and
          detect unusual fare spikes across major routes in India.
          </p>

        <KpiCards metrics={metrics} />

        <AnalyticsChart />

        {/* Secondary charts row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <AirlineShareChart records={metrics.data} />
          <RouteComparisonChart records={metrics.data} />
          <IndexHistoryChart />
        </div>

        <DataFeed records={generateFlightRecords(50)} />

        <footer className="pt-4 pb-8 text-center">
          <p className="text-xs text-slate-400">
            AeroIndex — Government Airfare Intelligence Platform · Powered by AeroIndex Backend API
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
