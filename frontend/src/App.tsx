import { useEffect, useState, useMemo } from 'react';
import type { AccountRiskSummary, AccountDetail, DashboardSummary } from './types/api';
import {
  checkBackendHealth,
  fetchAccounts,
  fetchAccountById,
  fetchDashboardSummary
} from './services/api';
import { AppLayout } from './components/AppLayout';
import type { NavItem } from './components/Sidebar';
import { MetricCard } from './components/MetricCard';
import { AccountTable } from './components/AccountTable';
import { CustomerDetailView } from './components/CustomerDetailView';
import { RevenueRiskAutopsyView } from './components/RevenueRiskAutopsyView';
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import {
  Users,
  AlertTriangle,
  Calendar,
  DollarSign,
  Building,
  Layers,
  ArrowRight
} from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [viewMode, setViewMode] = useState<'radar' | 'customer_detail' | 'autopsy'>('radar');
  const [accounts, setAccounts] = useState<AccountRiskSummary[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<AccountDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true);
  const [executionMode, setExecutionMode] = useState<string>('simulated');

  // Load accounts, metrics and backend health on mount
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const health = await checkBackendHealth();
      setBackendHealthy(health.status === 'healthy');
      setExecutionMode(health.execution_mode);

      const [accountsData, summaryData] = await Promise.all([
        fetchAccounts(),
        fetchDashboardSummary().catch(() => null)
      ]);

      setAccounts(accountsData);
      setDashboardSummary(summaryData);

      if (accountsData.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accountsData[0].id);
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

  // Fetch detailed account context (contacts, signals, customer metrics) when selected
  useEffect(() => {
    if (!selectedAccountId) return;
    let isMounted = true;
    async function loadDetail() {
      try {
        const detail = await fetchAccountById(selectedAccountId!);
        if (isMounted) setSelectedAccountDetail(detail);
      } catch (err) {
        console.error('Error fetching account detail:', err);
      }
    }
    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedAccountId]);

  // Handle Tab changes
  const handleSelectTab = (tab: NavItem) => {
    setCurrentTab(tab);
    if (tab === 'dashboard') {
      setViewMode('radar');
    } else if (tab === 'customers') {
      setViewMode('customer_detail');
    } else if (tab === 'autopsy') {
      setViewMode('autopsy');
    }
  };

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setViewMode('customer_detail');
  };

  // Global search filter across accounts
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.domain && a.domain.toLowerCase().includes(q)) ||
        (a.industry && a.industry.toLowerCase().includes(q)) ||
        a.csm_owner.toLowerCase().includes(q) ||
        a.primary_reason_code.toLowerCase().includes(q)
    );
  }, [accounts, searchQuery]);

  // Dynamic Metrics derived directly from backend/data
  const metrics = useMemo(() => {
    const totalMonitored = dashboardSummary?.total_accounts_monitored ?? accounts.length;
    const highRiskAccounts = accounts.filter(
      (a) => a.risk_level === 'critical' || a.risk_level === 'high'
    );
    const highRiskCount = dashboardSummary?.high_risk_accounts_count ?? highRiskAccounts.length;
    const highRiskArr = dashboardSummary?.high_risk_arr ?? highRiskAccounts.reduce((sum, a) => sum + a.arr, 0);
    const renewalSoonCount =
      dashboardSummary?.renewals_due_soon_count ??
      accounts.filter((a) => a.urgency_days_to_renewal <= 60).length;

    return {
      totalMonitored,
      highRiskCount,
      highRiskArr,
      renewalSoonCount
    };
  }, [accounts, dashboardSummary]);

  // Currency Formatter
  const formatCurrency = (amount: number) => {
    if (currency === 'INR') {
      const inrAmount = amount * 83;
      if (inrAmount >= 10000000) {
        return `₹${(inrAmount / 10000000).toFixed(2)} Cr`;
      } else if (inrAmount >= 100000) {
        return `₹${(inrAmount / 100000).toFixed(1)} L`;
      }
      return `₹${inrAmount.toLocaleString('en-IN')}`;
    }
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}k`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const getPageTitle = () => {
    if (currentTab === 'autopsy' || viewMode === 'autopsy') {
      return {
        title: selectedAccountDetail ? `${selectedAccountDetail.name} — Risk Autopsy` : 'Revenue Risk Autopsy',
        subtitle: 'Evidence-Grounded AI Causal Analysis & Multi-Signal Synthesis'
      };
    }
    if (currentTab === 'customers' || viewMode === 'customer_detail') {
      return {
        title: selectedAccountDetail ? selectedAccountDetail.name : 'Customer Details',
        subtitle: 'Customer Intelligence & Unified Multi-Source Evidence Timeline'
      };
    }
    switch (currentTab) {
      case 'dashboard':
        return {
          title: 'Revenue Radar',
          subtitle: 'Deterministic Multi-Signal Churn Detection & Revenue Exposure'
        };
      case 'approvals':
        return {
          title: 'Approval Center',
          subtitle: 'Human-Gated Next-Best-Action Workflow'
        };
      case 'settings':
        return {
          title: 'Integrations & Rules',
          subtitle: 'MongoDB Data Connections and Weights'
        };
      default:
        return { title: 'SignalBridge AI', subtitle: 'Revenue Intelligence' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <AppLayout
      currentTab={currentTab}
      onSelectTab={handleSelectTab}
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

      {/* Main Revenue Radar / App Content */}
      {!loading && !error && (
        <>
          {/* TAB 1: Revenue Radar View */}
          {currentTab === 'dashboard' && viewMode === 'radar' && (
            <div className="space-y-6">
              {/* Top 4 Summary Cards (Exact Page 2 Specifications) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Accounts monitored"
                  value={metrics.totalMonitored}
                  subtext="Active B2B SaaS Customer Portfolio"
                  icon={<Users className="w-5 h-5" />}
                />

                <MetricCard
                  label="High-risk accounts"
                  value={metrics.highRiskCount}
                  subtext="Based on deterministic risk engine rules"
                  icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
                  highlight={metrics.highRiskCount > 0}
                />

                <MetricCard
                  label="Renewals due soon"
                  value={metrics.renewalSoonCount}
                  subtext="Active renewal window (≤ 60 days)"
                  icon={<Calendar className="w-5 h-5" />}
                />

                <MetricCard
                  label="ARR in high-risk accounts"
                  value={formatCurrency(metrics.highRiskArr)}
                  subtext="Contract ARR exposed to churn likelihood"
                  icon={<DollarSign className="w-5 h-5" />}
                />
              </div>

              {/* Sortable & Filterable Account Table */}
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
                  onSelectAccount={handleSelectAccount}
                  currency={currency}
                  onCurrencyChange={setCurrency}
                />
              )}
            </div>
          )}

          {/* TAB 2 or Detail View: Page 3 Customer Details and Unified Evidence Timeline */}
          {(currentTab === 'customers' || viewMode === 'customer_detail') && selectedAccountDetail && (
            <CustomerDetailView
              account={selectedAccountDetail}
              onBackToRadar={() => {
                setViewMode('radar');
                setCurrentTab('dashboard');
              }}
              currency={currency}
              onNavigateToApprovals={() => setCurrentTab('approvals')}
              onInvestigateWithAI={() => {
                setViewMode('autopsy');
                setCurrentTab('autopsy');
              }}
            />
          )}

          {/* TAB 3 / Page 4: Revenue Risk Autopsy (Central AI Wow Feature) */}
          {(currentTab === 'autopsy' || viewMode === 'autopsy') && selectedAccountDetail && (
            <RevenueRiskAutopsyView
              account={selectedAccountDetail}
              allAccounts={accounts}
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
              }}
              onBackToCustomer={() => {
                setViewMode('customer_detail');
                setCurrentTab('customers');
              }}
              onBackToRadar={() => {
                setViewMode('radar');
                setCurrentTab('dashboard');
              }}
              currency={currency}
              onNavigateToApprovals={() => setCurrentTab('approvals')}
            />
          )}

          {/* TAB 3: Approval Center */}
          {currentTab === 'approvals' && (
            <div className="border border-[#E2E8F0] rounded-xl p-6 bg-white space-y-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <h2 className="font-headline text-xl text-[#020062] font-bold">
                  Approval Center — Human-Gated Action Gate
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                The approval lifecycle requires human verification before any consequential customer communication or CRM update is dispatched. In upcoming pages, you can review drafts, edit proposal bodies, and trigger cryptographic hash-bound approvals.
              </p>
              <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-lg text-xs text-slate-700 flex items-center justify-between">
                <span>Active safety gate: <strong>Version-Bound Content Hashing</strong></span>
                <button
                  onClick={() => {
                    setViewMode('radar');
                    setCurrentTab('dashboard');
                  }}
                  className="text-[#0025AE] font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                >
                  Return to Revenue Radar <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Settings & Data Connections */}
          {currentTab === 'settings' && (
            <div className="border border-[#E2E8F0] rounded-xl p-6 bg-white space-y-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <h2 className="font-headline text-xl text-[#020062] font-bold">
                  Data Foundation & Environment
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                SignalBridge AI is configured to read directly from MongoDB or the normalized seed repository. Collections seeded: <code>accounts</code>, <code>contacts</code>, and <code>signals</code>.
              </p>
              <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-lg text-xs text-slate-700 space-y-2">
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
