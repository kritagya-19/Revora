import type { ReactNode } from 'react';
import { Sidebar, type NavItem } from './Sidebar';
import { Topbar } from './Topbar';

interface AppLayoutProps {
  children: ReactNode;
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  title: string;
  subtitle?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  accountCount?: number;
  pendingApprovalsCount?: number;
  executionMode?: string;
  backendHealthy?: boolean;
  onRefresh?: () => void;
}

export function AppLayout({
  children,
  currentTab,
  onSelectTab,
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  accountCount = 0,
  pendingApprovalsCount = 0,
  executionMode = 'simulated',
  backendHealthy = true,
  onRefresh
}: AppLayoutProps) {
  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-body selection:bg-blue-600 selection:text-white antialiased">
      {/* Reusable Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        accountCount={accountCount}
        pendingApprovalsCount={pendingApprovalsCount}
        backendHealthy={backendHealthy}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Reusable Topbar */}
        <Topbar
          title={title}
          subtitle={subtitle}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          executionMode={executionMode}
          backendStatus={backendHealthy ? 'healthy' : 'offline'}
          onRefresh={onRefresh}
        />

        {/* Dynamic Page Container */}
        <main className="flex-1 p-6 lg:p-8 xl:p-10 max-w-[1540px] w-full mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
