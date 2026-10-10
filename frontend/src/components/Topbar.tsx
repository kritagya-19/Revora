import { useState } from 'react';
import { Search, Bell, User, CheckCircle2, AlertCircle } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  executionMode?: string;
  backendStatus?: string;
  unreadNotifications?: number;
}

export function Topbar({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  executionMode = 'simulated',
  backendStatus = 'healthy',
  unreadNotifications = 2
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Title & Subtitle */}
      <div className="flex flex-col min-w-[200px]">
        <h1 className="font-headline text-lg text-[#020062] font-bold tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-500 font-body mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search accounts by name, domain, industry, or CSM owner..."
          className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-[#E2E8F0] rounded-md focus:outline-none focus:border-[#2563EB] focus:bg-white text-[#020062] placeholder-slate-400 font-body transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Right Controls: Mode, Notifications, User */}
      <div className="flex items-center gap-3">
        {/* Execution Mode Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-[#E2E8F0] bg-slate-50/80 font-body">
          <span className="text-slate-500 text-[11px]">Mode:</span>
          <span className="font-semibold text-[#0025AE] text-[11px] uppercase tracking-wider">
            {executionMode}
          </span>
        </div>

        {/* Backend Health Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-[#E2E8F0] bg-white font-body">
          {backendStatus === 'healthy' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium text-[11px]">API Online</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span className="text-red-700 font-medium text-[11px]">Offline</span>
            </>
          )}
        </div>

        {/* Notifications Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-md hover:bg-slate-100 text-slate-600 hover:text-[#020062] transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#2563EB] ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 rounded-lg bg-white border border-[#E2E8F0] shadow-lg py-2 z-50 text-xs">
              <div className="px-3 py-1.5 border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="font-semibold text-[#020062]">Signal Notifications</span>
                <span className="text-[10px] text-slate-400">2 unread</span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="p-3 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-center gap-1.5 text-red-600 font-medium text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    <span>Critical Usage Drop</span>
                  </div>
                  <p className="text-slate-600 mt-1">Acme Dynamics seats dropped -45%</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">20 mins ago</span>
                </div>
                <div className="p-3 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-center gap-1.5 text-amber-600 font-medium text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                    <span>Renewal Horizon</span>
                  </div>
                  <p className="text-slate-600 mt-1">HyperScale Labs renewal within 15 days</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">1 hour ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current User Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
          <div className="w-8 h-8 rounded-full bg-[#0025AE]/10 text-[#0025AE] flex items-center justify-center font-semibold text-xs border border-[#0025AE]/20">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block text-left">
            <span className="block text-xs font-semibold text-[#020062] leading-tight font-body">
              Sarah Jenkins
            </span>
            <span className="block text-[10px] text-slate-400 leading-tight font-body">
              Enterprise CSM
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
