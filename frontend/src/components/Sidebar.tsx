import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  ShieldCheck, 
  Sparkles, 
  Send,
  Zap,
  Settings,
  ClipboardCheck,
  History,
  MessageSquare,
  Layers
} from 'lucide-react';

export type NavItem = 'dashboard' | 'customers' | 'autopsy' | 'copilot' | 'approvals' | 'tracker' | 'timeline' | 'analyzer' | 'feedback' | 'retention-flow' | 'settings';

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  accountCount?: number;
  pendingApprovalsCount?: number;
  backendHealthy?: boolean;
}

interface NavSection {
  title: string;
  items: {
    id: NavItem;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: string | number | null;
    badgeStyle?: string;
    tooltip?: string;
  }[];
}

export function Sidebar({
  currentTab,
  onSelectTab,
  accountCount = 0,
  pendingApprovalsCount = 0,
  backendHealthy = true
}: SidebarProps) {
  const sections: NavSection[] = [
    {
      title: 'OVERVIEW & ACCOUNTS',
      items: [
        {
          id: 'dashboard',
          label: 'Revenue Radar',
          icon: LayoutDashboard,
          tooltip: 'See overall portfolio health and high-risk accounts'
        },
        {
          id: 'customers',
          label: 'Customer Accounts',
          icon: Users,
          badge: accountCount > 0 ? accountCount : null,
          badgeStyle: 'bg-slate-100 text-slate-600 border border-slate-200/60',
          tooltip: 'Customer details, renewal dates, and recent activity'
        },
        {
          id: 'timeline',
          label: 'Activity Timeline',
          icon: History,
          badge: 'History',
          badgeStyle: 'bg-purple-50 text-purple-700 border border-purple-200/80 font-medium',
          tooltip: 'Full history of customer activity, alerts, and team actions'
        }
      ]
    },
    {
      title: 'AI ASSISTANT',
      items: [
        {
          id: 'autopsy',
          label: 'Risk Analysis',
          icon: Sparkles,
          badge: 'AI',
          badgeStyle: 'bg-blue-50 text-[#2563EB] border border-blue-200/80 font-bold',
          tooltip: 'Find out why an account is at risk and see missing info'
        },
        {
          id: 'copilot',
          label: 'Action Copilot',
          icon: Send,
          badge: 'Drafts',
          badgeStyle: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold',
          tooltip: 'Ready-to-use email drafts, team tasks, and CRM updates'
        },
        {
          id: 'analyzer',
          label: 'Notes & Call Analyzer',
          icon: Sparkles,
          badge: 'Summary',
          badgeStyle: 'bg-cyan-50 text-cyan-700 border border-cyan-200/80 font-medium',
          tooltip: 'Turn meeting notes or call transcripts into clear action items'
        },
        {
          id: 'feedback',
          label: 'Customer Feedback',
          icon: MessageSquare,
          badge: 'Surveys',
          badgeStyle: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-bold',
          tooltip: 'Send quick surveys and catch customer frustration early'
        },
        {
          id: 'retention-flow',
          label: 'Retention & Reminders',
          icon: Layers,
          badge: 'Flow',
          badgeStyle: 'bg-purple-50 text-purple-700 border border-purple-200/80 font-bold',
          tooltip: 'Interactive 37-node continuous retention & feedback flow engine'
        }
      ]
    },
    {
      title: 'REVIEW & ACTIONS',
      items: [
        {
          id: 'approvals',
          label: 'Approval Center',
          icon: CheckSquare,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
          badgeStyle: pendingApprovalsCount > 0 
            ? 'bg-amber-50 text-amber-800 border border-amber-300 font-bold animate-pulse'
            : 'bg-slate-100 text-slate-500',
          tooltip: 'Review and approve AI suggestions before anything is sent'
        },
        {
          id: 'tracker',
          label: 'Action Tracker',
          icon: ClipboardCheck,
          badge: 'Results',
          badgeStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium',
          tooltip: 'Track sent actions and see if customer health improved'
        },
        {
          id: 'settings',
          label: 'Settings & Tools',
          icon: Settings,
          badge: 'Connect',
          badgeStyle: 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold',
          tooltip: 'Connect your tools, test alerts, and view sent messages'
        }
      ]
    }
  ];

  return (
    <aside className="w-64 border-r border-[#E2E8F0] bg-white flex flex-col justify-between shrink-0 select-none min-h-screen">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline text-xl text-[#020062] font-bold tracking-tight">
                Revora
              </span>
              <span className="text-[10px] font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                AI OS
              </span>
            </div>
          </div>
        </div>

        {/* Structured Navigation Groups */}
        <nav className="p-3 space-y-5">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-mono font-bold tracking-wider text-slate-600 uppercase">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      title={item.tooltip}
                      className={`group relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all text-left cursor-pointer ${
                        isActive
                          ? 'bg-[#F0F5FF] text-[#0025AE] font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-[#020062] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#2563EB] rounded-r-full" />
                      )}

                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-[#2563EB]'
                              : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge !== null && item.badge !== undefined && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium leading-none ${
                            item.badgeStyle || (isActive ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-600')
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Streamlined Footer */}
      <div className="p-3.5 border-t border-[#E2E8F0] bg-[#FAFCFF] space-y-2.5">
        <div className="flex items-center justify-between px-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-600 font-medium text-xs">
              {backendHealthy ? 'Signals Live' : 'Telemetry Offline'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-600">v1.2</span>
        </div>

        <div className="flex items-center justify-between px-1.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>Autonomous Safe Gate</span>
          </div>
          <span className="font-mono text-[10px] text-slate-600">⌘K search</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
