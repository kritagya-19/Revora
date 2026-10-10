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
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import {
  Users,
  AlertTriangle,
  Calendar,
  DollarSign
} from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [viewMode, setViewMode] = useState<'radar' | 'customer_detail' | 'autopsy' | 'copilot'>('radar');
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
    if (currentTab === 'copilot' || viewMode === 'copilot') {
      return {
        title: selectedAccountDetail ? `${selectedAccountDetail.name} — Action Copilot` : 'Next-Best-Action Copilot',
        subtitle: 'Page 5: Editable Action Proposals (Email Draft, Follow-up Task, Structured CRM Update)'
      };
    }
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
      pendingApprovalsCount={pendingApprovalsCount}
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
              onNavigateToCopilot={() => {
                setViewMode('copilot');
                setCurrentTab('copilot');
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
              onNavigateToCopilot={() => {
                setViewMode('copilot');
                setCurrentTab('copilot');
              }}
            />
          )}

          {/* TAB 4 / Page 5: Next-Best-Action Copilot (Editable Proposals) */}
          {(currentTab === 'copilot' || viewMode === 'copilot') && selectedAccountDetail && (
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
            <SettingsAndIntegrationsView
              executionMode={executionMode}
              backendHealthy={backendHealthy}
            />
          )}
        </>
      )}
    </AppLayout>
  );
}

export default App;
