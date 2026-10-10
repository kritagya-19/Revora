import { LayoutDashboard, Users, CheckSquare, Settings, ShieldCheck, Activity } from 'lucide-react';

export type NavItem = 'dashboard' | 'customers' | 'approvals' | 'settings';

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
      label: 'Dashboard',
      sublabel: 'Revenue Radar',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'customers' as NavItem,
      label: 'Customers',
      sublabel: 'Accounts & Signals',
      icon: Users,
      badge: accountCount > 0 ? accountCount : null
    },
    {
      id: 'approvals' as NavItem,
      label: 'Approvals',
      sublabel: 'Action Gate',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'settings' as NavItem,
      label: 'Settings',
      sublabel: 'Connectors & Rules',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside className="w-64 border-r border-[#E2E8F0] bg-white flex flex-col justify-between shrink-0 select-none min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#2563EB] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-headline text-xl text-[#020062] tracking-tight block leading-tight font-bold">
                Revora
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-600 block">
                SignalBridge AI
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-slate-600 font-body">
            Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium font-body transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#0025AE]/8 text-[#0025AE] font-semibold border-l-3 border-[#0025AE]'
                    : 'text-slate-600 hover:text-[#020062] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#0025AE]' : 'text-slate-600'}`} />
                  <div>
                    <span className="block leading-none text-[13px]">{item.label}</span>
                    <span className="text-[10px] text-slate-600 block mt-0.5">{item.sublabel}</span>
                  </div>
                </div>

                {item.badge !== null && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
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
      <div className="p-4 border-t border-[#E2E8F0] bg-slate-50/50 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-slate-600 font-medium font-body text-[11px]">Database Layer</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
              backendHealthy
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-red-700 bg-red-50 border-red-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendHealthy ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            {backendHealthy ? 'MongoDB Sync' : 'Offline'}
          </span>
        </div>

        <div className="pt-2 border-t border-[#E2E8F0]/60 flex items-center justify-between text-[11px] text-slate-600 font-body">
          <span>Engine v1.0.0</span>
          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">Deterministic</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
