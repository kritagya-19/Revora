import { useState, useEffect } from 'react';
import type { IntegrationConnector, SyncRunRecord } from '../types/api';
import {
  fetchIntegrations,
  triggerIntegrationSync,
  fetchRecentSyncRuns
} from '../services/api';
import {
  Building,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Database,
  Mail,
  Calendar,
  BarChart3,
  Server,
  Zap
} from 'lucide-react';

interface SettingsAndIntegrationsViewProps {
  executionMode?: string;
  backendHealthy?: boolean;
}

export function SettingsAndIntegrationsView({
  executionMode = 'simulated',
  backendHealthy = true
}: SettingsAndIntegrationsViewProps) {
  const [integrations, setIntegrations] = useState<IntegrationConnector[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRunRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [connectors, runs] = await Promise.all([
        fetchIntegrations(),
        fetchRecentSyncRuns(15).catch(() => [])
      ]);
      setIntegrations(connectors);
      setSyncRuns(runs);
    } catch (err: any) {
      console.error('Failed to load settings & integrations:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error communicating with backend integrations service'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncNow = async (connector: IntegrationConnector) => {
    try {
      setSyncingId(connector.id);
      setFeedback(null);

      const res = await triggerIntegrationSync(connector.id);
      setFeedback({
        type: 'success',
        message: res.message || `Resynchronization completed for ${connector.name}.`
      });

      // Reload fresh status
      await loadData();
    } catch (err: any) {
      console.error('Sync failed:', err);
      setFeedback({
        type: 'error',
        message: `Sync failed for ${connector.name}: ${err.message}`
      });
    } finally {
      setSyncingId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'crm':
        return <Building className="w-5 h-5 text-[#2563EB]" />;
      case 'email':
        return <Mail className="w-5 h-5 text-indigo-600" />;
      case 'calendar':
        return <Calendar className="w-5 h-5 text-amber-600" />;
      case 'usage':
        return <BarChart3 className="w-5 h-5 text-emerald-600" />;
      case 'database':
        return <Database className="w-5 h-5 text-teal-600" />;
      default:
        return <Server className="w-5 h-5 text-slate-600" />;
    }
  };

  const formatLastSync = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString() + ')';
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 pb-12 font-body">
      {/* Hero Header */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 text-[#0025AE] border border-blue-100 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Page 7: Settings & Data Foundation</span>
              <span className="text-slate-600">• Multi-Source Signal Ingestion</span>
            </div>
            <h1 className="font-headline text-2xl font-bold text-[#020062]">
              Connectors & Data Freshness
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              SignalBridge AI ingests evidence across CRM, Email, Calendar, Product Analytics, and Database layers.
              The AI agent has zero responsibility for raw credentials—it strictly queries authorized backend data models.
              Simulated vs. live connectors are distinctly labeled below.
            </p>
          </div>

          {/* Quick Environment Snapshot */}
          <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-6 shrink-0">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                Execution Mode
              </span>
              <span className="text-xs font-bold text-[#020062] uppercase font-mono">
                {executionMode}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                MongoDB Layer
              </span>
              <span className={`text-xs font-bold ${backendHealthy ? 'text-emerald-700' : 'text-amber-700'}`}>
                {backendHealthy ? 'Connected & Healthy' : 'Standalone Memory Fallback'}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                Active Sources
              </span>
              <span className="text-xs font-bold text-slate-800">
                {integrations.length} Providers
              </span>
            </div>
          </div>
        </div>

        {/* Global Alert / Feedback */}
        {feedback && (
          <div
            className={`mt-4 p-3.5 rounded-lg text-xs flex items-center justify-between gap-4 transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : feedback.type === 'info'
                ? 'bg-blue-50 text-blue-900 border border-blue-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span className="font-semibold">{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-500 hover:text-slate-700 cursor-pointer font-bold"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Grid of Data Source Connectors */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-[#020062] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            Active Signal Ingestion Connectors ({integrations.length})
          </h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#2563EB]' : ''}`} />
            <span>Refresh All Connectors</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((conn) => {
            const isSyncing = syncingId === conn.id;
            const isFresh = conn.data_freshness_status === 'fresh';
            const isStale = conn.data_freshness_status === 'stale_warning';
            const isLive = conn.mode === 'live';

            return (
              <div
                key={conn.id}
                className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
              >
                {/* Top: Icon & Connector Name */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        {getCategoryIcon(conn.category)}
                      </div>
                      <div>
                        <h3 className="font-headline text-sm font-bold text-[#020062] leading-snug">
                          {conn.name}
                        </h3>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {conn.provider}
                        </span>
                      </div>
                    </div>

                    {/* Mode Tag: Live vs Simulated */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                        isLive
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-indigo-50 text-[#0025AE] border border-indigo-200'
                      }`}
                    >
                      {conn.mode}
                    </span>
                  </div>

                  {/* Status & Freshness Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        conn.status === 'connected'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : conn.status === 'degraded'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          conn.status === 'connected'
                            ? 'bg-emerald-500'
                            : conn.status === 'degraded'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      />
                      {conn.status.toUpperCase()}
                    </span>

                    {/* Freshness Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
                        isFresh
                          ? 'bg-slate-100 text-slate-700'
                          : isStale
                          ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                          : 'bg-red-100 text-red-900 font-bold border border-red-300'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {conn.freshness_minutes === 0
                        ? 'Just now'
                        : `${conn.freshness_minutes}m ago`}
                    </span>
                  </div>

                  {/* Freshness Warning (if present) */}
                  {conn.freshness_warning && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-2 text-[11px] text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="leading-tight">{conn.freshness_warning}</span>
                    </div>
                  )}

                  {/* Telemetry Stats */}
                  <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Total Records Synced:</span>
                      <strong className="text-slate-800 font-mono">
                        {conn.records_synced.toLocaleString()}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 text-[11px]">
                      <span>Last Ingest:</span>
                      <span className="font-mono text-slate-500">
                        {formatLastSync(conn.last_sync_time)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action: Resync Button */}
                <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {conn.id}
                  </span>

                  <button
                    onClick={() => handleSyncNow(conn)}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-xs font-semibold text-[#020062] shadow-2xs hover:border-[#2563EB]/40 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-[#2563EB]' : 'text-slate-500'}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Resync Now'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sync Runs History Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div>
            <h3 className="font-headline text-base font-bold text-[#020062] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2563EB]" />
              Recent Synchronization Batches & Ingestion Logs
            </h3>
            <p className="text-xs text-slate-500">
              Audit log of scheduled and user-triggered telemetry pulls recorded in <code>sync_runs</code>.
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
            sync_runs table
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2.5 px-3">Run ID</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Ingested / Updated</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {syncRuns.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                    {run.id}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#020062]">
                    {run.provider}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                    +{run.records_ingested} records ({run.records_updated} updated)
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                    {run.duration_ms}ms
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-100 text-slate-700">
                      {run.mode}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {run.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                    {formatLastSync(run.started_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SettingsAndIntegrationsView;
