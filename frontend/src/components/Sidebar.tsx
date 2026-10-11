import { LayoutDashboard, Users, CheckSquare, Settings, ShieldCheck, Activity, Sparkles, Send } from 'lucide-react';

export type NavItem = 'dashboard' | 'customers' | 'autopsy' | 'copilot' | 'approvals' | 'settings';

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  accountCount?: number;
  pendingApprovalsCount?: number;
  backendHealthy?: boolean;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  accountCount = 0,
  pendingApprovalsCount = 0,
  backendHealthy = true
}: SidebarProps) {
  const navItems = [
    {
      id: 'dashboard' as NavItem,
      label: 'Revenue Radar',
      sublabel: 'Step 3: Churn Detection & Ranking',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'customers' as NavItem,
      label: 'Customer Details',
      sublabel: 'Step 1 & 2: Unified Evidence Timeline',
      icon: Users,
      badge: accountCount > 0 ? accountCount : null
    },
    {
      id: 'autopsy' as NavItem,
      label: 'Risk Autopsy',
      sublabel: 'Step 3 & 4: Deep-Dive Diagnosis',
      icon: Sparkles,
      badge: 'AI',
      badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold'
    },
    {
      id: 'copilot' as NavItem,
      label: 'Action Copilot',
      sublabel: 'Step 4: AI Intervention Drafts',
      icon: Send,
      badge: 'Copilot',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold'
    },
    {
      id: 'approvals' as NavItem,
      label: 'Approval Center',
      sublabel: 'Step 5 & 6: Human Review Gate',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
    },
    {
      id: 'settings' as NavItem,
      label: 'Connectors & Rules',
      sublabel: 'Step 1: Signal Ingestion Sources',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside className="w-72 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0 select-none min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="h-20 px-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-900/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-headline text-xl text-white tracking-tight block leading-tight font-bold">
                Revora
              </span>
              <span className="text-[11px] tracking-wider uppercase font-semibold text-slate-400 block font-mono">
                SignalBridge AI
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase text-slate-400 font-mono">
            Revenue Intelligence Pipeline
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium font-body transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/30 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <div>
                    <span className="block leading-none text-sm font-semibold">{item.label}</span>
                    <span className="text-xs text-slate-500 block mt-1 line-clamp-1">{item.sublabel}</span>
                  </div>
                </div>

                {item.badge !== null && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                      item.badgeColor || (isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="p-5 border-t border-slate-800 bg-slate-900/60 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300 font-medium font-body text-xs">Customer Signal Sync</span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md border font-mono ${
              backendHealthy
                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80'
                : 'text-rose-400 bg-rose-950/60 border-rose-800/80'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            {backendHealthy ? 'Live Synced' : 'Offline'}
          </span>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-body">
          <span>Revora Engine v1.0</span>
          <span className="font-mono text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
            Deterministic + AI
          </span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
