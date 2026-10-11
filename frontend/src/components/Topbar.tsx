import { useState } from 'react';
import { Search, Bell, User, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  executionMode?: string;
  backendStatus?: string;
  unreadNotifications?: number;
  onRefresh?: () => void;
}

export function Topbar({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  executionMode = 'simulated',
  backendStatus = 'healthy',
  unreadNotifications = 2,
  onRefresh
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshClick = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <header className="h-20 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md px-6 lg:px-8 flex items-center justify-between gap-6 sticky top-0 z-30">
      {/* Title & Subtitle */}
      <div className="flex flex-col min-w-[240px]">
        <h1 className="font-headline text-2xl text-[#020062] font-bold tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-500 font-body mt-0.5 line-clamp-1">
            {subtitle}
          </p>
        )}
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-lg relative hidden sm:block">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search accounts by name, domain, industry, or CSM owner..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:bg-white text-[#020062] placeholder-slate-400 font-body transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-[#020062] cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Right Controls: Mode, Notifications, User */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Execution Mode Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-[#E2E8F0] bg-[#F8FAFC] font-body">
          <span className="text-slate-500 text-xs font-medium">Mode:</span>
          <span className="font-bold text-[#2563EB] text-xs uppercase tracking-wider font-mono">
            {executionMode}
          </span>
        </div>

        {/* Backend Health Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-[#E2E8F0] bg-[#F8FAFC] font-body">
          {backendStatus === 'healthy' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-800 font-semibold text-xs font-mono">API Online</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-rose-800 font-semibold text-xs font-mono">Offline</span>
            </>
          )}
        </div>

        {/* Refresh Data Button */}
        {onRefresh && (
          <button
            onClick={handleRefreshClick}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Fetch latest data from MongoDB"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline font-mono">Sync DB</span>
          </button>
        )}

        {/* Notifications Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-lg hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] text-slate-600 hover:text-[#020062] transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563EB]" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-[#E2E8F0] shadow-xl py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="font-bold text-[#020062] text-sm">Signal Notifications</span>
                <span className="text-[11px] font-mono text-slate-500">2 unread</span>
              </div>
              <div className="divide-y divide-[#E2E8F0]">
                <div className="p-3.5 hover:bg-[#F8FAFC] cursor-pointer">
                  <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                    <span>Critical Usage Drop</span>
                  </div>
                  <p className="text-slate-600 mt-1 font-body text-xs">Acme Technologies active seats dropped -38%</p>
                  <span className="text-[11px] text-slate-400 mt-1 block font-mono">20 mins ago</span>
                </div>
                <div className="p-3.5 hover:bg-[#F8FAFC] cursor-pointer">
                  <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                    <span>Renewal Horizon</span>
                  </div>
                  <p className="text-slate-600 mt-1 font-body text-xs">HyperScale Labs renewal approaching in 15 days</p>
                  <span className="text-[11px] text-slate-400 mt-1 block font-mono">1 hour ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current User Profile */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#E2E8F0]">
          <div className="w-9 h-9 rounded-lg bg-[#F0F5FF] text-[#0025AE] flex items-center justify-center font-bold text-sm border border-[#2563EB]/20">
            <User className="w-4.5 h-4.5" />
          </div>
          <div className="hidden xl:block text-left">
            <span className="block text-sm font-semibold text-[#020062] leading-tight font-body">
              Sarah Jenkins
            </span>
            <span className="block text-xs text-slate-500 leading-tight font-body mt-0.5">
              Enterprise CSM
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
