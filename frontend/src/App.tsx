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
import { NextBestActionCopilotView } from './components/NextBestActionCopilotView';
import { ApprovalCenterView } from './components/ApprovalCenterView';
import { SettingsAndIntegrationsView } from './components/SettingsAndIntegrationsView';
import { PortfolioCharts } from './components/PortfolioCharts';
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import {
  Users,
  AlertTriangle,
  Calendar,
  DollarSign,
  LayoutDashboard,
  Sparkles,
  Send,
  CheckCircle2
} from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [viewMode, setViewMode] = useState<'radar' | 'customer_detail' | 'autopsy' | 'copilot'>('radar');
  const [copilotTab, setCopilotTab] = useState<'email' | 'task' | 'crm' | 'intelligence'>('email');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('all');
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

  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  // Load accounts, metrics and backend health on mount
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const health = await checkBackendHealth();
      setBackendHealthy(health.status === 'healthy');
      setExecutionMode(health.execution_mode);

      const [accountsData, summaryData, pendingData] = await Promise.all([
        fetchAccounts(),
        fetchDashboardSummary().catch(() => null),
        fetch(`${(import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000'}/api/approvals?status=proposed`)
          .then((res) => (res.ok ? res.json() : []))
          .catch(() => [])
      ]);

      setAccounts(accountsData);
      setDashboardSummary(summaryData);
      if (Array.isArray(pendingData)) {
        setPendingApprovalsCount(pendingData.length);
      }

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
    } else if (tab === 'copilot') {
      setViewMode('copilot');
    } else if (tab === 'approvals') {
      setViewMode('radar');
    } else if (tab === 'settings') {
      setViewMode('radar');
    }
  };

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setViewMode('customer_detail');
    setCurrentTab('customers');
  };

  const handleInvestigateAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setViewMode('autopsy');
    setCurrentTab('autopsy');
  };

  // Global search & risk filter across accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (selectedRiskFilter !== 'all' && a.risk_level !== selectedRiskFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        (a.domain && a.domain.toLowerCase().includes(q)) ||
        (a.industry && a.industry.toLowerCase().includes(q)) ||
        a.csm_owner.toLowerCase().includes(q) ||
        a.primary_reason_code.toLowerCase().includes(q)
      );
    });
  }, [accounts, searchQuery, selectedRiskFilter]);

  // Dynamic Metrics derived directly from backend/data
  const metrics = useMemo(() => {
    const totalMonitored = dashboardSummary?.total_accounts_monitored ?? accounts.length;
    const highRiskAccounts = accounts.filter(
      (a) => a.risk_level === 'critical' || a.risk_level === 'high'
    );
    const highRiskCount = dashboardSummary?.high_risk_accounts_count ?? highRiskAccounts.length;

    const highRiskArr =
      dashboardSummary?.high_risk_arr ??
      highRiskAccounts.reduce((sum, a) => sum + (a.arr || 0), 0);

    const renewalSoonCount = accounts.filter(
      (a) => (a.urgency_days_to_renewal || 999) <= 60
    ).length;

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
    if (currentTab === 'copilot' || viewMode === 'copilot') {
      return {
        title: selectedAccountDetail ? `${selectedAccountDetail.name} — Action Copilot` : 'Next-Best-Action Copilot',
        subtitle: 'Step 4: AI Prepares Action Proposals — Outreach email, follow-up task, and structured CRM update'
      };
    }
    if (currentTab === 'autopsy' || viewMode === 'autopsy') {
      return {
        title: selectedAccountDetail ? `${selectedAccountDetail.name} — Risk Autopsy` : 'Revenue Risk Autopsy',
        subtitle: 'Step 3 & 4: Deep-Dive AI Risk Diagnosis — Reconstructs situation, explains conclusions, identifies unknowns & recommends action'
      };
    }
    if (currentTab === 'customers' || viewMode === 'customer_detail') {
      return {
        title: selectedAccountDetail ? selectedAccountDetail.name : 'Customer Details',
        subtitle: 'Step 1 & 2: Unified Customer Profile — Multi-source chronological evidence feed (CRM, email, calendar, usage)'
      };
    }
    switch (currentTab) {
      case 'dashboard':
        return {
          title: 'Revenue Radar',
          subtitle: 'Step 3: Multi-Signal Churn Detection & Prioritization — Cross-source risk and urgency ranking'
        };
      case 'approvals':
        return {
          title: 'Approval Center',
          subtitle: 'Step 5: Human Review & Safe Execution Gate — Authorizes proposed interventions with cryptographic verification'
        };
      case 'settings':
        return {
          title: 'Settings & Integrations',
          subtitle: 'Step 6: Connector Management — Configure and sync CRM, Email, Calendar, and Support data sources'
        };
      default:
        return { title: 'Revora | SignalBridge AI', subtitle: 'Evidence-First Revenue Intelligence' };
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
      pendingApprovalsCount={pendingApprovalsCount}
      executionMode={executionMode}
      backendHealthy={backendHealthy}
      onRefresh={loadData}
    >
      {/* Loading State */}
      {loading && (
        <LoadingState
          message="Collecting Customer Signals & Ingesting Telemetry..."
          subtext="Harmonizing cross-source records into unified accounts and detecting revenue risks"
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
          {/* ========================================================================= */}
          {/* INTERACTIVE 5-STEP PIPELINE STEPPER: Instant Guidance Across All Views    */}
          {/* ========================================================================= */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0025AE]">
                  Revenue Intelligence Journey
                </span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  Click any stage to understand the workflow and explore each capability
                </span>
              </div>
              <span className="text-xs font-mono font-medium text-slate-600 bg-[#F8FAFC] px-3 py-1 rounded-lg border border-[#E2E8F0]">
                Deterministic Detection + Gated Execution
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { step: 1, label: 'Customer Details', tab: 'customers' as NavItem, icon: Users, isCurrent: currentTab === 'customers' || viewMode === 'customer_detail' },
                { step: 2, label: 'Revenue Radar', tab: 'dashboard' as NavItem, icon: LayoutDashboard, isCurrent: currentTab === 'dashboard' && viewMode === 'radar' },
                { step: 3, label: 'Risk Autopsy', tab: 'autopsy' as NavItem, icon: Sparkles, isCurrent: currentTab === 'autopsy' || viewMode === 'autopsy' },
                { step: 4, label: 'Action Copilot', tab: 'copilot' as NavItem, icon: Send, isCurrent: currentTab === 'copilot' || viewMode === 'copilot' },
                { step: 5, label: 'Approval Center', tab: 'approvals' as NavItem, icon: CheckCircle2, isCurrent: currentTab === 'approvals' }
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.step}
                    onClick={() => handleSelectTab(s.tab)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      s.isCurrent
                        ? 'bg-[#F0F5FF] border-[#2563EB] text-[#020062] ring-1 ring-[#2563EB]/40 shadow-xs'
                        : 'bg-white hover:bg-[#F8FAFC] border-[#E2E8F0] text-slate-600 hover:text-[#020062]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      s.isCurrent ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-slate-500'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-bold block text-slate-400 leading-tight">
                        STEP {s.step}
                      </span>
                      <span className="text-xs font-semibold block truncate leading-tight mt-0.5">
                        {s.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: Revenue Radar View */}
          {currentTab === 'dashboard' && viewMode === 'radar' && (
            <div className="space-y-8">
              {/* Guidance Hero Banner & Rich Portfolio Visual Charts */}
              <PortfolioCharts
                accounts={accounts}
                selectedRiskFilter={selectedRiskFilter}
                onSelectRiskFilter={setSelectedRiskFilter}
                currency={currency}
                onNavigateToAutopsy={handleInvestigateAccount}
              />

              {/* Top 4 Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard
                  label="Accounts monitored"
                  value={metrics.totalMonitored}
                  subtext="Active B2B SaaS Customer Portfolio"
                  icon={<Users className="w-5 h-5 text-blue-400" />}
                />

                <MetricCard
                  label="High-risk accounts"
                  value={metrics.highRiskCount}
                  subtext="Compounding churn alerts triggered"
                  icon={<AlertTriangle className="w-5 h-5 text-rose-400" />}
                  highlight={metrics.highRiskCount > 0}
                  badge="Critical"
                />

                <MetricCard
                  label="Renewals due soon"
                  value={metrics.renewalSoonCount}
                  subtext="Active renewal window (≤ 60 days)"
                  icon={<Calendar className="w-5 h-5 text-amber-400" />}
                />

                <MetricCard
                  label="ARR in high-risk accounts"
                  value={formatCurrency(metrics.highRiskArr)}
                  subtext="Contract ARR exposed to churn likelihood"
                  icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
                />
              </div>

              {/* Sortable & Filterable Account Table */}
              {filteredAccounts.length === 0 ? (
                <EmptyState
                  title="No matching accounts"
                  description={`No customer accounts matched your search "${searchQuery}".`}
                  actionText="Clear Search Filter"
                  onAction={() => {
                    setSearchQuery('');
                    setSelectedRiskFilter('all');
                  }}
                />
              ) : (
                <AccountTable
                  accounts={filteredAccounts}
                  selectedAccountId={selectedAccountId}
                  onSelectAccount={handleSelectAccount}
                  currency={currency}
                  onCurrencyChange={setCurrency}
                  onInvestigateAccount={handleInvestigateAccount}
                />
              )}
            </div>
          )}

          {/* TAB 2 or Detail View: Customer Details and Unified Evidence Timeline */}
          {(currentTab === 'customers' || (currentTab === 'dashboard' && viewMode === 'customer_detail')) && selectedAccountDetail && (
            <CustomerDetailView
              account={selectedAccountDetail}
              allAccounts={accounts}
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
              }}
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
              onNavigateToCopilot={() => {
                setViewMode('copilot');
                setCurrentTab('copilot');
              }}
            />
          )}

          {/* TAB 3 / Page 4: Revenue Risk Autopsy (Central AI Wow Feature) */}
          {(currentTab === 'autopsy' || (currentTab === 'dashboard' && viewMode === 'autopsy')) && selectedAccountDetail && (
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
              onNavigateToCopilot={(subtab) => {
                if (subtab) setCopilotTab(subtab);
                setViewMode('copilot');
                setCurrentTab('copilot');
              }}
            />
          )}

          {/* TAB 4 / Page 5: Next-Best-Action Copilot (Editable Proposals) */}
          {(currentTab === 'copilot' || (currentTab === 'dashboard' && viewMode === 'copilot')) && selectedAccountDetail && (
            <NextBestActionCopilotView
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
              onNavigateToApprovals={() => {
                setCurrentTab('approvals');
              }}
              currency={currency}
              initialTab={copilotTab}
            />
          )}

          {/* TAB 5 / Page 6: Trust & Approval Center */}
          {currentTab === 'approvals' && (
            <ApprovalCenterView
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
                setViewMode('customer_detail');
                setCurrentTab('customers');
              }}
              onNavigateToCopilot={() => {
                setViewMode('copilot');
                setCurrentTab('copilot');
              }}
            />
          )}

          {/* TAB 6 / Page 7: Settings & Integrations */}
          {currentTab === 'settings' && (
            <SettingsAndIntegrationsView />
          )}
        </>
      )}
    </AppLayout>
  );
}

export default App;
