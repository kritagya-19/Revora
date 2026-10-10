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
  backendHealthy = true
}: AppLayoutProps) {
  return (
    <div className="min-h-screen flex bg-white text-[#020062] font-body selection:bg-[#2563EB]/15 selection:text-[#0025AE]">
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
        />

        {/* Dynamic Page Container */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
