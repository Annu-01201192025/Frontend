import { useState } from 'react';
import { Loader2, Zap, Plane, Activity, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { FlightRecord } from '@/lib/mockData';

interface ToastState {
  visible: boolean;
  type: 'success' | 'error';
  message: string;
}

export default function ExecutiveHeader({
  onScrapeComplete,
}: {
  onScrapeComplete: (records: FlightRecord[]) => void;
}) {
  const [scraping, setScraping] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [scrapeStage, setScrapeStage]=useState('');
  const[indexResult, setIndexResult] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    type: 'success',
    message: '',
  });

  const handleScrape = async () => {
    setScraping(true);
    setScrapeStage('Scraping airline data...');
    setToast({ visible: false, type: 'success', message: '' });
    try {
      const response = await fetch(
        'http://localhost:8000/api/v1/scrape/trigger?origin=DEL&destination=BOM',
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Scrape request failed');
      }

      const result = await response.json();

      setScrapeStage('Scrape initiated');

      let scrapeFinished = false;
      
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(
          'http://localhost:8000/api/v1/scrape/status'
        );
        
        const status = await statusResponse.json();
        
        if (status.status === 'success') {
          scrapeFinished = true;
          break;
        }
        if (status.status === 'failed') {
          throw new Error(status.message || 'Live scrape failed');
        }
      }
      if (!scrapeFinished) {
        throw new Error('Live scrape timed out');
      }
      const metricsResponse = await fetch(
        'http://localhost:8000/api/v1/metrics/latest'
      );
      if (!metricsResponse.ok) {
        throw new Error('Failed to refresh metrics');
      }
      const metrics = await metricsResponse.json();
      
      if (!metricsResponse.ok) {
        throw new Error('Failed to refresh metrics');
      }

      setScrapeStage('Data received');
      setIndexResult(metrics.airfare_index);

      const records: FlightRecord[] = metrics.data ?? [];

      onScrapeComplete(records);

      setScrapeStage('Index updated');

      setToast({
        visible: true,
        type: 'success',
        message: result.message || 'Live scrape initiated successfully.',
      });
      setScrapeStage('Data received');
      await new Promise((resolve) => setTimeout(resolve, 700));
      setScrapeStage('Processing');
      await new Promise((resolve) => setTimeout(resolve, 700));
      setScrapeStage('Index updated');
      onScrapeComplete(records);
      setToast({
        visible: true,
        type: 'success',
        message: `Scrape complete — ${records.length} new flight records ingested for DEL-BOM`,
      });
    } catch {
      setToast({
        visible: true,
        type: 'error',
        message: 'Scrape failed. Please retry.',
      });
    }
    setScraping(false);
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setToast({ visible: false, type: 'success', message: '' });
    
    try {
      const response = await fetch(
        'http://localhost:8000/api/v1/report/generate?days_back=30',
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Report generation failed');
      }

      const result = await response.json();

      if (result.status !== 'success') {
        throw new Error(result.message || 'Report generation failed');
      }

      setReportPath(result.report_path);

      setToast({
        visible: true,
        type: 'success',
        message: 'Report generated successfully.',
      });
    } catch {
      setToast({
        visible: true,
        type: 'error',
        message: 'Report generation failed. Please retry.',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <>
      {/* Toast notification */}
      {toast.visible && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-5 duration-300">
          <div
            className={`flex items-center gap-3 rounded-xl border px-5 py-4 shadow-2xl backdrop-blur-md ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
                : 'border-red-200 bg-red-50/95 text-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-7 shadow-xl">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-sky-400 blur-3xl" />
          <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-cyan-400 blur-3xl" />
        </div>

        <div className="relative flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 shadow-lg shadow-sky-500/30">
              <Plane className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
                AeroIndex
              </h1>
              <p className="mt-0.5 text-sm font-medium text-slate-300">
                Real-Time Airfare Inflation Tracker
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              Live Data Pipeline
            </span>

            <button
              onClick={handleScrape}
              disabled={scraping}
              className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition-all hover:shadow-xl hover:shadow-sky-500/40 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {scraping ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Scraping airline data...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 transition-transform group-hover:scale-110" />
                  Trigger Live Scrape (DEL-BOM)
                </>
              )}
            </button>

            <button
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className="inline-flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {generatingReport ? (
                <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating report...
                </>
                ) : (
                <>
                <FileText className="h-5 w-5" />
                Generate Statistical Report
                </>
              )}
              </button>

            {reportPath && (
              <a
              href={`http://localhost:8000/${reportPath.replace(/\\/g, '/')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/20"
              >
                <FileText className="h-5 w-5" />
                Open Report
                </a>
              )}  

            {scraping && (
              <div className="text-xs font-medium text-sky-200">
                {scrapeStage}
              </div>
            )}
          </div>
        </div>

        {/* Sub-bar */}
        <div className="relative mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-slate-400">
          <Activity className="h-4 w-4 text-sky-400" />
          <span>System Status:</span>
          <span className="font-semibold text-slate-300">All pipelines operational</span>
          <span className="ml-auto font-mono text-slate-500">
            Backend API Connected
          </span>
        </div>
      </header>
    </>
  );
}
