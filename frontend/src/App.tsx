import { useEffect, useState, useMemo } from 'react';
import type { AccountRiskSummary, AccountDetail } from './types/api';
import {
  checkBackendHealth,
  fetchAccounts,
  fetchAccountById
} from './services/api';
import { AppLayout } from './components/AppLayout';
import type { NavItem } from './components/Sidebar';
import { MetricCard } from './components/MetricCard';
import { AccountTable } from './components/AccountTable';
import { RiskBadge } from './components/RiskBadge';
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import {
  Users,
  AlertTriangle,
  Calendar,
  DollarSign,
  Building,
  Mail,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [accounts, setAccounts] = useState<AccountRiskSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<AccountDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true);
  const [executionMode, setExecutionMode] = useState<string>('simulated');

  // Load accounts and health on mount
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const health = await checkBackendHealth();
      setBackendHealthy(health.status === 'healthy');
      setExecutionMode(health.execution_mode);

      const data = await fetchAccounts();
      setAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err: any) {
      console.error('API Error:', err);
      setError(err.message || 'Could not connect to FastAPI backend');
      setBackendHealthy(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch detailed account context (contacts & signals) when selected
  useEffect(() => {
    if (!selectedAccountId) return;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        const detail = await fetchAccountById(selectedAccountId!);
        setSelectedAccountDetail(detail);
      } catch (err) {
        console.error('Error fetching account detail:', err);
      } finally {
        setDetailLoading(false);
      }
    }
    loadDetail();
  }, [selectedAccountId]);

  // Search filter
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.domain && a.domain.toLowerCase().includes(q)) ||
        (a.industry && a.industry.toLowerCase().includes(q)) ||
        a.csm_owner.toLowerCase().includes(q)
    );
  }, [accounts, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalMonitored = accounts.length;
    const highRiskAccounts = accounts.filter(
      (a) => a.risk_level === 'critical' || a.risk_level === 'high'
    );
    const highRiskCount = highRiskAccounts.length;
    const highRiskArr = highRiskAccounts.reduce((sum, a) => sum + a.arr, 0);
    const renewalSoonCount = accounts.filter((a) => a.urgency_days_to_renewal <= 60).length;

    return {
      totalMonitored,
      highRiskCount,
      highRiskArr,
      renewalSoonCount
    };
  }, [accounts]);

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'Revenue Radar', subtitle: 'Deterministic Risk & Multi-Signal Detection' };
      case 'customers':
        return { title: 'Customer Accounts', subtitle: 'Verified Portfolio & Signals Store' };
      case 'approvals':
        return { title: 'Approval Center', subtitle: 'Human-Gated Next-Best-Action Workflow' };
      case 'settings':
        return { title: 'Integrations & Rules', subtitle: 'MongoDB Data Connections and Weights' };
      default:
        return { title: 'SignalBridge AI', subtitle: 'Revenue Intelligence' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <AppLayout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      title={title}
      subtitle={subtitle}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      accountCount={accounts.length}
      pendingApprovalsCount={2}
      executionMode={executionMode}
      backendHealthy={backendHealthy}
    >
      {/* Loading State */}
      {loading && (
        <LoadingState
          message="Connecting to Database & Ingesting Signals..."
          subtext="Validating MongoDB database connection and evaluating deterministic risk scores"
        />
      )}

      {/* Error State */}
      {!loading && error && (
        <ErrorState
          title="Database & API Unavailable"
          message={`Failed to retrieve customer accounts: ${error}. Ensure FastAPI is running on port 8000.`}
          onRetry={loadData}
        />
      )}

      {/* Main Content (when not loading and no top-level error) */}
      {!loading && !error && (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Monitored Accounts"
              value={metrics.totalMonitored}
              subtext="Seeded across 3+ source categories"
              icon={<Users className="w-5 h-5" />}
            />

            <MetricCard
              label="High / Critical Risk"
              value={metrics.highRiskCount}
              subtext="Accounts requiring urgent attention"
              icon={<AlertTriangle className="w-5 h-5" />}
              highlight={metrics.highRiskCount > 0}
            />

            <MetricCard
              label="Renewals Due ≤ 60d"
              value={metrics.renewalSoonCount}
              subtext="Active renewal negotiation window"
              icon={<Calendar className="w-5 h-5" />}
            />

            <MetricCard
              label="At-Risk ARR Exposure"
              value={`$${metrics.highRiskArr.toLocaleString()}`}
              subtext="Contract ARR across high risk accounts"
              icon={<DollarSign className="w-5 h-5" />}
            />
          </div>

          {/* Tab 1: Dashboard / Revenue Radar & Tab 2: Customers */}
          {(currentTab === 'dashboard' || currentTab === 'customers') && (
            <div className="space-y-6">
              {/* Account Table */}
              {filteredAccounts.length === 0 ? (
                <EmptyState
                  title="No matching accounts"
                  description={`No customer accounts matched your search "${searchQuery}".`}
                  actionText="Clear Search Filter"
                  onAction={() => setSearchQuery('')}
                />
              ) : (
                <AccountTable
                  accounts={filteredAccounts}
                  selectedAccountId={selectedAccountId}
                  onSelectAccount={setSelectedAccountId}
                />
              )}

              {/* Selected Account Deep Dive Panel */}
              {selectedAccountDetail && (
                <div className="border border-[#E2E8F0] rounded-lg p-6 bg-white space-y-6">
                  {/* Account Detail Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-[#E2E8F0] gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-headline text-2xl text-[#020062] font-bold">
                          {selectedAccountDetail.name}
                        </h2>
                        <RiskBadge
                          level={selectedAccountDetail.risk_level}
                          score={selectedAccountDetail.risk_score}
                        />
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {selectedAccountDetail.tier}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 font-body">
                        <span>Domain: <strong>{selectedAccountDetail.domain}</strong></span>
                        <span>•</span>
                        <span>Industry: <strong>{selectedAccountDetail.industry}</strong></span>
                        <span>•</span>
                        <span>CSM Owner: <strong>{selectedAccountDetail.csm_owner}</strong></span>
                        <span>•</span>
                        <span>Renewal Date: <strong>{selectedAccountDetail.renewal_date}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xl font-headline text-[#020062] font-bold block">
                          ${selectedAccountDetail.arr.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                          Contract Value (ARR)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2-Column Detail: Key Stakeholders & Multi-Source Signals */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Contacts Table / Cards */}
                    <div className="border border-[#E2E8F0] rounded-lg p-5 bg-slate-50/40 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#2563EB]" />
                          <h3 className="font-semibold text-sm text-[#020062]">
                            Account Stakeholders & Contacts
                          </h3>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {selectedAccountDetail.contacts.length} recorded
                        </span>
                      </div>

                      {detailLoading ? (
                        <div className="py-6 text-center text-xs text-slate-400">Loading contacts...</div>
                      ) : selectedAccountDetail.contacts.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No contacts found for this account.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {selectedAccountDetail.contacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="p-3 bg-white border border-[#E2E8F0] rounded-md flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs text-[#020062]">
                                    {contact.name}
                                  </span>
                                  {contact.is_primary && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-medium">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500 block mt-0.5">
                                  {contact.role || 'Executive'}
                                </span>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                                  <Mail className="w-3 h-3" />
                                  <span>{contact.email}</span>
                                </div>
                              </div>

                              <div className="text-right">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                                    contact.sentiment === 'negative'
                                      ? 'bg-red-50 text-red-700'
                                      : contact.sentiment === 'positive'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {contact.sentiment} sentiment
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Multi-Source Signals */}
                    <div className="border border-[#E2E8F0] rounded-lg p-5 bg-slate-50/40 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-[#2563EB]" />
                          <h3 className="font-semibold text-sm text-[#020062]">
                            Cross-Source Signals
                          </h3>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {selectedAccountDetail.signals.length} signals
                        </span>
                      </div>

                      {detailLoading ? (
                        <div className="py-6 text-center text-xs text-slate-400">Loading signals...</div>
                      ) : selectedAccountDetail.signals.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No signals recorded.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {selectedAccountDetail.signals.map((sig) => (
                            <div
                              key={sig.id}
                              className="p-3 bg-white border border-[#E2E8F0] rounded-md space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {sig.source_category}
                                  </span>
                                  <span className="font-semibold text-xs text-[#020062]">
                                    {sig.title}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                                    sig.severity === 'high'
                                      ? 'bg-red-50 text-red-700'
                                      : sig.severity === 'medium'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {sig.severity}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {sig.summary}
                              </p>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {new Date(sig.timestamp).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Approvals Info */}
          {currentTab === 'approvals' && (
            <div className="border border-[#E2E8F0] rounded-lg p-6 bg-white space-y-4">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-[#2563EB]" />
                <h2 className="font-headline text-xl text-[#020062]">
                  Approval Center Ready
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                The approval lifecycle requires human verification before any consequential customer communication or CRM update is dispatched. In upcoming pages, you can review drafts, edit proposal bodies, and trigger cryptographic hash-bound approvals.
              </p>
              <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-md text-xs text-slate-700 flex items-center justify-between">
                <span>Active approval gate: <strong>Version-Bound Content Hashing</strong></span>
                <span className="text-[#0025AE] font-semibold flex items-center gap-1 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
                  Return to Revenue Radar <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )}

          {/* Tab 4: Settings Info */}
          {currentTab === 'settings' && (
            <div className="border border-[#E2E8F0] rounded-lg p-6 bg-white space-y-4">
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-[#2563EB]" />
                <h2 className="font-headline text-xl text-[#020062]">
                  Data Foundation & Environment
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                SignalBridge AI is configured to read directly from MongoDB or the normalized seed repository. Collections seeded: <code>accounts</code>, <code>contacts</code>, and <code>signals</code>.
              </p>
              <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-md text-xs text-slate-700 space-y-2">
                <div>Backend Service: <strong>FastAPI on :8000</strong></div>
                <div>Configured Execution Mode: <strong>{executionMode}</strong></div>
                <div>Status: <strong className="text-emerald-700">Healthy & Synchronized</strong></div>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}

export default App;
