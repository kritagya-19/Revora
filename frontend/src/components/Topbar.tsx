import { useState, useRef, useEffect } from 'react';
import { Search, Bell, RefreshCw, ChevronDown } from 'lucide-react';

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
  unreadNotifications = 2,
  onRefresh
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: Cmd+K / Ctrl+K focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefreshClick = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white/90 backdrop-blur-md px-6 lg:px-8 flex items-center justify-between gap-6 sticky top-0 z-30">
      {/* Title & Concise Context */}
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h1 className="text-lg sm:text-xl text-slate-900 font-bold tracking-normal leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 font-body leading-none mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Global Command Search Bar */}
      <div className="flex-1 max-w-md relative hidden md:block">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search accounts, telemetry, or risks..."
          className="w-full pl-9 pr-14 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:bg-white text-[#020062] placeholder-slate-400 font-body transition-all"
        />
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              title="Clear search"
            >
              ✕
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Right Controls: Streamlined & Focused */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Environment Tag (Clean & Compact) */}
        {executionMode && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="capitalize">{executionMode}</span>
          </span>
        )}

        {/* Sync Data Button */}
        {onRefresh && (
          <button
            onClick={handleRefreshClick}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-[#020062] hover:bg-[#F8FAFC] border border-[#E2E8F0] transition-colors cursor-pointer disabled:opacity-50"
            title="Sync telemetry data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline text-xs">Sync</span>
          </button>
        )}

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="p-2 rounded-lg hover:bg-[#F8FAFC] text-slate-600 hover:text-[#020062] transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563EB] ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowNotifications(false)} 
              />
              <div className="absolute right-0 mt-2 w-76 rounded-xl bg-white border border-[#E2E8F0] shadow-xl py-2 z-50 text-xs animate-in fade-in slide-in-from-top-1">
                <div className="px-4 py-2 border-b border-[#E2E8F0] flex items-center justify-between">
                  <span className="font-bold text-[#020062]">Recent Signals</span>
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                    2 new
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="p-3 hover:bg-[#F8FAFC] cursor-pointer">
                    <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                      <span>Telemetry Drop Detected</span>
                    </div>
                    <p className="text-slate-600 mt-0.5 text-[11px]">Acme Technologies active seats decreased -38%</p>
                    <span className="text-[10px] text-slate-600 mt-1 block font-mono">15m ago</span>
                  </div>
                  <div className="p-3 hover:bg-[#F8FAFC] cursor-pointer">
                    <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                      <span>Renewal Window</span>
                    </div>
                    <p className="text-slate-600 mt-0.5 text-[11px]">HyperScale Labs renewal within 15 days</p>
                    <span className="text-[10px] text-slate-600 mt-1 block font-mono">1h ago</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile */}
        <div className="relative pl-1 border-l border-[#E2E8F0]">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1D4ED8] to-[#60A5FA] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              SJ
            </div>
            <div className="hidden xl:block text-left">
              <span className="block text-xs font-semibold text-[#020062] leading-none">
                Sarah Jenkins
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-600 hidden xl:block" />
          </button>

          {showUserMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowUserMenu(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-[#E2E8F0] shadow-xl py-1.5 z-50 text-xs">
                <div className="px-3 py-2 border-b border-[#E2E8F0]">
                  <p className="font-semibold text-slate-900 leading-tight">Sarah Jenkins</p>
                  <p className="text-[11px] text-slate-600 font-mono mt-0.5">sarah@revora.ai</p>
                </div>
                <div className="py-1">
                  <div className="px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                    <span>Role</span>
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">CSM Lead</span>
                  </div>
                  <div className="px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                    <span>API Gateway</span>
                    <span className="text-[10px] font-mono text-emerald-600 font-medium">Connected</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
