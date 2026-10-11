import { useState, useEffect } from 'react';
import type { IntegrationConnector, FreePipelineStatus, OutboxRecord } from '../types/api';
import {
  fetchIntegrations,
  triggerIntegrationSync,
  fetchFreePipelineStatus,
  configureFreeWebhook,
  testFreeWebhook,
  fetchOutboxEvents,
  clearOutboxEvents
} from '../services/api';
import {
  Building,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Database,
  Mail,
  Calendar,
  BarChart3,
  Server,
  Zap,
  Send,
  Webhook,
  Trash2,
  Inbox,
  Radio
} from 'lucide-react';

interface SettingsAndIntegrationsViewProps {
  executionMode?: string;
  backendHealthy?: boolean;
}

export function SettingsAndIntegrationsView({
  executionMode = 'live',
  backendHealthy = true
}: SettingsAndIntegrationsViewProps) {
  const [integrations, setIntegrations] = useState<IntegrationConnector[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<FreePipelineStatus | null>(null);
  const [outbox, setOutbox] = useState<OutboxRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState<string>('');
  const [savingWebhook, setSavingWebhook] = useState<boolean>(false);
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [selectedOutboxItem, setSelectedOutboxItem] = useState<OutboxRecord | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [connectors, pStatus, outboxItems] = await Promise.all([
        fetchIntegrations().catch(() => []),
        fetchFreePipelineStatus().catch(() => null),
        fetchOutboxEvents(20).catch(() => [])
      ]);
      setIntegrations(connectors);
      setPipelineStatus(pStatus);
      setOutbox(outboxItems);
      if (pStatus?.webhook.url && !webhookInput) {
        setWebhookInput(pStatus.webhook.url);
      }
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

  const handleSaveWebhook = async () => {
    try {
      setSavingWebhook(true);
      setFeedback(null);
      const res = await configureFreeWebhook(webhookInput);
      setFeedback({
        type: 'success',
        message: `Webhook configured! Detected provider: ${res.provider.toUpperCase()}. Real-time cards will broadcast here.`
      });
      const pStatus = await fetchFreePipelineStatus().catch(() => null);
      if (pStatus) setPipelineStatus(pStatus);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to configure webhook: ${err.message}`
      });
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    try {
      setTestingWebhook(true);
      setFeedback(null);
      const res = await testFreeWebhook('Acme Technologies', 'acc-101');
      if (res.status === 'delivered') {
        setFeedback({
          type: 'success',
          message: `Live test card successfully delivered to ${res.provider.toUpperCase()} webhook! Check your channel.`
        });
      } else {
        setFeedback({
          type: 'info',
          message: `Test event captured in Live Outbox. (Configure a live Discord/Slack/Webhook.site URL to see instant external pings).`
        });
      }
      const outboxItems = await fetchOutboxEvents(20).catch(() => []);
      setOutbox(outboxItems);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Webhook test failed: ${err.message}`
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleClearOutbox = async () => {
    try {
      await clearOutboxEvents();
      setOutbox([]);
      setFeedback({
        type: 'info',
        message: 'Live Outbox cleared.'
      });
    } catch (err: any) {
      console.error('Failed to clear outbox:', err);
    }
  };

  const handleSyncNow = async (connector: IntegrationConnector) => {
    try {
      setSyncingId(connector.id);
      setFeedback(null);
      const res = await triggerIntegrationSync(connector.id);
      setFeedback({
        type: 'success',
        message: res.message || `Resynchronization completed for ${connector.name}.`
      });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Hackathon Ready</span>
              <span className="text-emerald-700">• 100% Free Integration Pipelines</span>
            </div>
            <h1 className="font-headline text-2xl font-bold text-[#020062]">
              Settings & Free Integration Pipelines
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Revora connects directly to free pipelines: Real-time Discord/Slack Webhooks, zero-cost SMTP / Outbox, and local signal stores. Approved human-in-the-loop proposals and feedback surveys dispatch live events at zero marginal cost.
            </p>
          </div>

          <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-6 shrink-0">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                Execution Mode
              </span>
              <span className="text-xs font-bold text-emerald-700 uppercase font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {executionMode} ({backendHealthy ? 'Online' : 'Local'})
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                Active Webhook
              </span>
              <span className="text-xs font-bold text-[#020062] font-mono">
                {pipelineStatus?.webhook.configured ? pipelineStatus.webhook.provider.toUpperCase() : 'Outbox Only'}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                Dispatches
              </span>
              <span className="text-xs font-bold text-slate-800">
                {outbox.length} Events
              </span>
            </div>
          </div>
        </div>

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
              ) : feedback.type === 'info' ? (
                <Activity className="w-4 h-4 text-blue-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: Free Hackathon Pipelines Console */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card A: Real-Time Webhook Pipeline */}
        <div className="border border-[#E2E8F0] rounded-2xl bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#020062]">
                    Free Real-Time Webhook Pipeline
                  </h2>
                  <p className="text-xs text-slate-500">
                    Discord, Slack Incoming Webhooks, or Webhook.site
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                $0 / Unlimited
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter any free webhook URL below. When actions are approved in the Approval Center or surveys are dispatched, Revora broadcasts rich interactive cards instantly.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Target Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <button
                  onClick={handleSaveWebhook}
                  disabled={savingWebhook}
                  className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {savingWebhook ? 'Saving...' : 'Save Pipeline'}
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="pt-2">
              <span className="text-[11px] text-slate-500 block mb-1.5 font-medium">Quick Free Test Presets:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setWebhookInput('https://webhook.site/26359eb3-02cb-4235-8664-90ff66408226')}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer font-mono"
                >
                  Webhook.site Inspector
                </button>
                <button
                  onClick={() => setWebhookInput('https://discord.com/api/webhooks/demo')}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 cursor-pointer font-mono"
                >
                  Discord Webhook Template
                </button>
                <button
                  onClick={() => setWebhookInput('https://hooks.slack.com/services/demo')}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer font-mono"
                >
                  Slack Incoming Webhook
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Radio className={`w-3.5 h-3.5 ${pipelineStatus?.webhook.configured ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
              <span>Status: <strong>{pipelineStatus?.webhook.configured ? 'Connected & Active' : 'Ready to Connect'}</strong></span>
            </div>
            <button
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testingWebhook ? 'Testing...' : 'Send Live Test Ping'}</span>
            </button>
          </div>
        </div>

        {/* Card B: Live Outbox & Dispatch History */}
        <div className="border border-[#E2E8F0] rounded-2xl bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#020062]">
                    Live Outbox & Delivery Inspector
                  </h2>
                  <p className="text-xs text-slate-500">
                    Zero-cost inspection for email drafts, tasks & cards
                  </p>
                </div>
              </div>
              {outbox.length > 0 && (
                <button
                  onClick={handleClearOutbox}
                  className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Every dispatched customer outreach email, survey token, or CRM update is captured here with delivery receipts. Click any event to inspect full HTML headers and payloads.
            </p>

            {outbox.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50 space-y-2">
                <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-600">Outbox is currently clear</p>
                <p className="text-[11px] text-slate-400">
                  Approved actions from the Approval Center or dispatched surveys will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {outbox.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedOutboxItem(item)}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 cursor-pointer transition-all flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="font-semibold text-slate-800 truncate">
                        {item.title || item.subject || item.event_type}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span className="font-mono">{item.to_email || item.account_name || 'System Broadcast'}</span>
                        <span>•</span>
                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase shrink-0 bg-emerald-100 text-emerald-800">
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Total Captured: <strong>{outbox.length} records</strong></span>
            <span className="font-mono text-[11px] text-emerald-600 font-semibold">● Free Sandbox Active</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Existing Signal Ingestion Connectors */}
      <div className="border border-[#E2E8F0] rounded-2xl bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#020062]">
              Monitored Signal Connectors ({integrations.length})
            </h2>
            <p className="text-xs text-slate-500">
              Telemetry sources feeding Revora's Risk Engine and Autopsy diagnosis
            </p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((conn) => (
            <div
              key={conn.id}
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    {getCategoryIcon(conn.category)}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 leading-tight">
                      {conn.name}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {conn.provider}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {conn.data_freshness_status}
                </span>
              </div>

              <div className="text-[11px] text-slate-500 space-y-1 font-mono pt-1 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Synced Records:</span>
                  <strong className="text-slate-800">{conn.records_synced.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Freshness:</span>
                  <span className="text-slate-700">{conn.freshness_minutes}m ago</span>
                </div>
              </div>

              <button
                onClick={() => handleSyncNow(conn)}
                disabled={syncingId === conn.id}
                className="w-full py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-700 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${syncingId === conn.id ? 'animate-spin text-blue-600' : ''}`} />
                <span>{syncingId === conn.id ? 'Syncing...' : 'Sync Telemetry Now'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Outbox Detail Modal */}
      {selectedOutboxItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">
                  Delivery Inspection
                </span>
                <h3 className="text-base font-bold text-[#020062]">
                  {selectedOutboxItem.title || selectedOutboxItem.subject || 'Outbox Event'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOutboxItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs font-mono border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-700">{selectedOutboxItem.status}</span>
              </div>
              {selectedOutboxItem.to_email && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient:</span>
                  <span className="text-slate-800">{selectedOutboxItem.to_email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp:</span>
                <span className="text-slate-800">{new Date(selectedOutboxItem.timestamp).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Content Payload</label>
              <div className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                {selectedOutboxItem.body_text || selectedOutboxItem.description || JSON.stringify(selectedOutboxItem, null, 2)}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedOutboxItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsAndIntegrationsView;
