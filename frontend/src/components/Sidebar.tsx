import { LayoutDashboard, Users, CheckSquare, ShieldCheck, Activity, Sparkles, Send } from 'lucide-react';

export type NavItem = 'dashboard' | 'customers' | 'autopsy' | 'copilot' | 'approvals';

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
      sublabel: 'Churn Detection & Ranking',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'customers' as NavItem,
      label: 'Customer Details',
      sublabel: 'Directory & 360 Telemetry',
      icon: Users,
      badge: accountCount > 0 ? accountCount : null
    },
    {
      id: 'autopsy' as NavItem,
      label: 'Risk Autopsy',
      sublabel: 'Deep-Dive AI Diagnosis',
      icon: Sparkles,
      badge: 'AI',
      badgeColor: 'bg-blue-50 text-[#0025AE] border border-blue-200 font-bold'
    },
    {
      id: 'copilot' as NavItem,
      label: 'Action Copilot',
      sublabel: 'AI Intervention Drafts',
      icon: Send,
      badge: 'Copilot',
      badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
    },
    {
      id: 'approvals' as NavItem,
      label: 'Approval Center',
      sublabel: 'Human Review & Safe Gate',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200 font-bold'
    }
  ];

  return (
    <aside className="w-72 border-r border-[#E2E8F0] bg-white flex flex-col justify-between shrink-0 select-none min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="h-20 px-6 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-headline text-2xl text-[#020062] tracking-tight block leading-tight font-bold">
                Revora
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-[#0025AE] block font-mono">
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
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium font-body transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#F0F5FF] text-[#0025AE] font-semibold border border-[#2563EB]/30 shadow-2xs'
                    : 'text-slate-600 hover:text-[#020062] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                  <div>
                    <span className="block leading-none text-sm font-semibold">{item.label}</span>
                    <span className="text-xs text-slate-500 block mt-1 line-clamp-1">{item.sublabel}</span>
                  </div>
                </div>

                {item.badge !== null && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                      item.badgeColor || (isActive ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-600')
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
      <div className="p-5 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <span className="text-slate-700 font-medium font-body text-xs">Customer Signal Sync</span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border font-mono ${
              backendHealthy
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-rose-800 bg-rose-50 border-rose-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'
              }`}
            />
            {backendHealthy ? 'Live Synced' : 'Offline'}
          </span>
        </div>

        <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-500 font-body">
          <span>Revora Engine v1.0</span>
          <span className="font-mono text-xs bg-white text-[#020062] px-2 py-0.5 rounded border border-[#E2E8F0]">
            Deterministic + AI
          </span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
