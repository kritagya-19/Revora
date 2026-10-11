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
import { CustomerAccountsListView } from './components/CustomerAccountsListView';
import { CustomerDetailView } from './components/CustomerDetailView';
import { RevenueRiskAutopsyView } from './components/RevenueRiskAutopsyView';
import { NextBestActionCopilotView } from './components/NextBestActionCopilotView';
import { ApprovalCenterView } from './components/ApprovalCenterView';
import { ActionOutcomeTrackerView } from './components/ActionOutcomeTrackerView';
import { CustomerOutcomeTimelineView } from './components/CustomerOutcomeTimelineView';
import { AIOutcomeAnalyzerView } from './components/AIOutcomeAnalyzerView';
import { FeedbackManagementView } from './components/FeedbackManagementView';
import { SettingsAndIntegrationsView } from './components/SettingsAndIntegrationsView';
import { PortfolioCharts } from './components/PortfolioCharts';
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
  const [viewMode, setViewMode] = useState<'radar' | 'customer_list' | 'customer_detail' | 'autopsy' | 'copilot'>('radar');
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
        fetch(`${(import.meta.env.VITE_API_BASE_URL as string) || ''}/api/approvals?status=proposed`)
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
      setViewMode('customer_list');
    } else if (tab === 'autopsy') {
      setViewMode('autopsy');
    } else if (tab === 'copilot') {
      setViewMode('copilot');
    } else if (tab === 'approvals') {
      setViewMode('radar');
    } else if (tab === 'tracker') {
      setViewMode('radar');
    } else if (tab === 'timeline') {
      setViewMode('radar');
    } else if (tab === 'analyzer') {
      setViewMode('radar');
    } else if (tab === 'feedback') {
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
        title: selectedAccountDetail ? `${selectedAccountDetail.name} — Action Copilot` : 'Action Copilot',
        subtitle: 'Ready-to-use email drafts, team tasks, and account updates'
      };
    }
    if (currentTab === 'autopsy' || viewMode === 'autopsy') {
      return {
        title: selectedAccountDetail ? `${selectedAccountDetail.name} — Risk Analysis` : 'Customer Risk Analysis',
        subtitle: 'See why this customer is at risk and uncover missing information'
      };
    }
    if (currentTab === 'customers') {
      if (viewMode === 'customer_detail' && selectedAccountDetail) {
        return {
          title: selectedAccountDetail.name,
          subtitle: `${selectedAccountDetail.tier || 'Enterprise'} Plan • Account Owner: ${selectedAccountDetail.csm_owner}`
        };
      }
      return {
        title: 'Customer Accounts',
        subtitle: 'All customer accounts, renewal dates, and recent activity'
      };
    }
    switch (currentTab) {
      case 'dashboard':
        return {
          title: 'Revenue Radar',
          subtitle: 'Spot high-risk accounts early and check overall account health'
        };
      case 'approvals':
        return {
          title: 'Approval Center',
          subtitle: 'Review and approve AI suggestions before anything is sent'
        };
      case 'settings':
        return {
          title: 'Settings & Tools',
          subtitle: 'Connect your business tools, test alerts, and view outbox'
        };
      case 'tracker':
        return {
          title: 'Action Tracker',
          subtitle: 'Track sent actions and see if customer risk actually decreased'
        };
      case 'timeline':
        return {
          title: 'Activity Timeline',
          subtitle: 'Full history of customer activity, AI reports, and team actions'
        };
      case 'analyzer':
        return {
          title: 'Notes & Call Analyzer',
          subtitle: 'Paste meeting notes or transcripts to find risks and next steps'
        };
      case 'feedback':
        return {
          title: 'Customer Feedback',
          subtitle: 'Send quick surveys and catch customer frustration early'
        };
      default:
        return { title: 'Revora AI', subtitle: 'Customer Success Assistant' };
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
          message="Loading Customer Data..."
          subtext="Checking account activity, renewal deadlines, and health rules"
        />
      )}

      {/* Error State */}
      {!loading && error && (
        <ErrorState
          title="Could Not Connect to Backend"
          message={`Failed to retrieve customer accounts: ${error}. Please make sure the FastAPI server is running.`}
          onRetry={loadData}
        />
      )}

      {/* Main Revenue Radar / App Content */}
      {!loading && !error && (
        <>
          {/* TAB 1: Revenue Radar View */}
          {currentTab === 'dashboard' && viewMode === 'radar' && (
            <div className="space-y-6">
              {/* 1. TOP KPI SUMMARY STATS: High-Level Portfolio Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <MetricCard
                  label="Total Accounts"
                  value={metrics.totalMonitored}
                  subtext="Customer accounts monitored"
                  icon={<Users className="w-4 h-4 text-[#2563EB]" />}
                />

                <MetricCard
                  label="High-Risk Accounts"
                  value={metrics.highRiskCount}
                  subtext="Need urgent attention"
                  icon={<AlertTriangle className="w-4 h-4 text-rose-500" />}
                  highlight={metrics.highRiskCount > 0}
                  badge={metrics.highRiskCount > 0 ? "Critical" : undefined}
                />

                <MetricCard
                  label="Upcoming Renewals"
                  value={metrics.renewalSoonCount}
                  subtext="Expiring within 60 days"
                  icon={<Calendar className="w-4 h-4 text-amber-500" />}
                />

                <MetricCard
                  label="Revenue at Risk"
                  value={formatCurrency(metrics.highRiskArr)}
                  subtext="Annual revenue at risk"
                  icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
                />
              </div>

              {/* 2. PRIORITY ALERT & VISUAL ANALYTICS: Risk Tiers & Renewal Horizon */}
              <PortfolioCharts
                accounts={accounts}
                selectedRiskFilter={selectedRiskFilter}
                onSelectRiskFilter={setSelectedRiskFilter}
                currency={currency}
                onNavigateToAutopsy={handleInvestigateAccount}
              />

              {/* 3. RANKED CUSTOMER ACCOUNTS TABLE: Structured Problem & Immediate Action */}
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
                  onOpenFeedback={(accId) => {
                    setSelectedAccountId(accId);
                    setCurrentTab('feedback');
                  }}
                />
              )}
            </div>
          )}

          {/* TAB 2: Customer Accounts Directory (Clean, structured list view with KPI metrics) */}
          {currentTab === 'customers' && viewMode === 'customer_list' && (
            <CustomerAccountsListView
              accounts={accounts}
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
                setViewMode('customer_detail');
              }}
              currency={currency}
              onCurrencyChange={setCurrency}
              onInvestigateAccount={handleInvestigateAccount}
            />
          )}

          {/* Customer Detail Dossier View (Opened when selecting a customer) */}
          {((currentTab === 'customers' && viewMode === 'customer_detail') ||
            (currentTab === 'dashboard' && viewMode === 'customer_detail')) && (
            selectedAccountDetail ? (
              <CustomerDetailView
                account={selectedAccountDetail}
                allAccounts={accounts}
                onSelectAccount={handleSelectAccount}
                onBackToAccounts={() => {
                  if (currentTab === 'dashboard') {
                    setViewMode('radar');
                  } else {
                    setViewMode('customer_list');
                  }
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
                onNavigateToFeedback={() => {
                  setCurrentTab('feedback');
                }}
              />
            ) : (
              <LoadingState
                message="Loading Customer Account Dossier..."
                subtext="Synthesizing contract status, engagement metrics, and risk findings"
              />
            )
          )}

          {/* TAB 3 / Page 4: Revenue Risk Autopsy (Central AI Wow Feature) */}
          {(currentTab === 'autopsy' || (currentTab === 'dashboard' && viewMode === 'autopsy')) && (
            selectedAccountDetail ? (
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
            ) : (
              <LoadingState
                message="Loading Risk Autopsy..."
                subtext="Synthesizing multi-signal evidence, causal thesis, and deterministic scores"
              />
            )
          )}

          {/* TAB 4 / Page 5: Next-Best-Action Copilot (Editable Proposals) */}
          {(currentTab === 'copilot' || (currentTab === 'dashboard' && viewMode === 'copilot')) && (
            selectedAccountDetail ? (
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
            ) : (
              <LoadingState
                message="Loading Action Copilot..."
                subtext="Generating tailored outreach emails, tasks, and CRM proposals"
              />
            )
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

          {/* TAB 6 / Feature 1: Action & Outcome Tracker */}
          {currentTab === 'tracker' && (
            <ActionOutcomeTrackerView
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
                setViewMode('customer_detail');
                setCurrentTab('customers');
              }}
              onNavigateToCopilot={(accId) => {
                if (accId) setSelectedAccountId(accId);
                setViewMode('copilot');
                setCurrentTab('copilot');
              }}
              onNavigateToAutopsy={(accId) => {
                if (accId) setSelectedAccountId(accId);
                setViewMode('autopsy');
                setCurrentTab('autopsy');
              }}
            />
          )}

          {/* TAB 7 / Feature 2: Customer Outcome Timeline */}
          {currentTab === 'timeline' && (
            <CustomerOutcomeTimelineView
              initialAccountId={selectedAccountId || undefined}
              accounts={accounts}
              currency={currency}
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
              }}
              onNavigateToCopilot={(accId) => {
                setSelectedAccountId(accId);
                setViewMode('copilot');
                setCurrentTab('copilot');
              }}
              onNavigateToAutopsy={(accId) => {
                setSelectedAccountId(accId);
                setViewMode('autopsy');
                setCurrentTab('autopsy');
              }}
              onNavigateToTracker={() => {
                setCurrentTab('tracker');
              }}
            />
          )}

          {/* TAB 8 / Feature 3: AI Outcome Analyzer */}
          {currentTab === 'analyzer' && (
            <AIOutcomeAnalyzerView
              initialAccountId={selectedAccountId || undefined}
              accounts={accounts}
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
              }}
              onNavigateToAutopsy={(accId) => {
                setSelectedAccountId(accId);
                setViewMode('autopsy');
                setCurrentTab('autopsy');
              }}
              onNavigateToTimeline={(accId) => {
                setSelectedAccountId(accId);
                setCurrentTab('timeline');
              }}
            />
          )}

          {/* TAB 9 / Feature: Feedback Form Loop */}
          {currentTab === 'feedback' && (
            <FeedbackManagementView
              accounts={accounts}
              initialAccountId={selectedAccountId || undefined}
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
              }}
              onNavigateToAutopsy={(accId) => {
                setSelectedAccountId(accId);
                setViewMode('autopsy');
                setCurrentTab('autopsy');
              }}
              onNavigateToTimeline={(accId) => {
                setSelectedAccountId(accId);
                setCurrentTab('timeline');
              }}
              onNavigateToApprovals={() => {
                setCurrentTab('approvals');
              }}
              onNavigateToCopilot={(accId) => {
                setSelectedAccountId(accId);
                setViewMode('copilot');
                setCurrentTab('copilot');
              }}
            />
          )}

          {/* TAB 10 / Settings & Free Hackathon Pipelines */}
          {currentTab === 'settings' && (
            <SettingsAndIntegrationsView
              executionMode="live"
              backendHealthy={backendHealthy}
            />
          )}
        </>
      )}
    </AppLayout>
  );
}

export default App;
