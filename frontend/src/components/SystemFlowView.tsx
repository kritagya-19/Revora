import { 
  Database, 
  GitFork, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  History, 
  ArrowDown, 
  ArrowRight, 
  ShieldCheck, 
  Send, 
  TrendingDown,
  HelpCircle
} from 'lucide-react';
import type { NavItem } from './Sidebar';

interface SystemFlowViewProps {
  onNavigateToTab: (tab: NavItem) => void;
  onOpenAutopsyForDemo?: () => void;
}

export function SystemFlowView({ onNavigateToTab, onOpenAutopsyForDemo }: SystemFlowViewProps) {
  const steps = [
    {
      stepNumber: 1,
      title: 'Collect customer signals',
      subtitle: 'CRM records · Emails · Calendar · Product usage · Conversations',
      description: 'Ingests raw multi-source interaction streams without bias or alteration. Every event is preserved as immutable raw telemetry.',
      icon: Database,
      badge: 'Step 1: Signal Ingestion',
      targetTab: 'settings' as NavItem,
      ctaLabel: 'View Ingestion Connectors',
      highlights: ['CRM Records', 'Email Threads', 'Calendar Meetings', 'Product Telemetry', 'Support Tickets']
    },
    {
      stepNumber: 2,
      title: 'Build a unified customer profile',
      subtitle: 'Match records to the correct account and organize events by time.',
      description: 'Harmonizes scattered identities into an authoritative entity profile with a transparent chronological evidence timeline.',
      icon: GitFork,
      badge: 'Step 2: Unified Context',
      targetTab: 'customers' as NavItem,
      ctaLabel: 'Inspect Customer Timeline',
      highlights: ['Account Matching', 'Normalized Timestamps', 'Time-Series Ordering', 'Zero Hallucinated Events']
    },
    {
      stepNumber: 3,
      title: 'Detect and investigate risk',
      subtitle: 'Find patterns, calculate risk, link evidence and identify missing information.',
      description: 'Applies deterministic rules and transparent urgency ranking, linking every risk conclusion directly to verified source evidence.',
      icon: Search,
      badge: 'Step 3: Detection & Radar',
      targetTab: 'dashboard' as NavItem,
      ctaLabel: 'Explore Revenue Radar',
      highlights: ['Cross-Signal Correlation', 'Deterministic Scoring', 'Urgency Prioritization', 'Uncertainty Flagging']
    },
    {
      stepNumber: 4,
      title: 'Recommend the next action',
      subtitle: 'Explain the situation and prepare an email, follow-up task and proposed CRM update.',
      description: 'Generates grounded executive rationale alongside editable, high-impact intervention drafts tailored to the specific account threat.',
      icon: Sparkles,
      badge: 'Step 4: Action Copilot',
      targetTab: 'copilot' as NavItem,
      ctaLabel: 'Open Action Copilot',
      highlights: ['Executive Email Draft', 'Follow-up Task Assignment', 'Structured CRM Update', 'Evidence Linkage']
    },
    {
      stepNumber: 5,
      title: 'Human reviews and approves',
      subtitle: 'The account manager checks the evidence and approves, edits or rejects the proposal.',
      description: 'Enforces human-in-the-loop governance. Consequential actions remain gated until reviewed and explicitly approved by the account owner.',
      icon: CheckCircle2,
      badge: 'Step 5: Governance Gate',
      targetTab: 'approvals' as NavItem,
      ctaLabel: 'Open Approval Center',
      highlights: ['Human Review Gate', 'Editable Proposals', 'Cryptographic Content Hash', 'Zero Rogue AI Actions']
    },
    {
      stepNumber: 6,
      title: 'Execute and record',
      subtitle: 'Approved actions are performed, their status is saved, and an audit history is created.',
      description: 'Dispatches validated actions to external endpoints, records immutable audit trails, and verifies execution receipts.',
      icon: History,
      badge: 'Step 6: Execution & Audit',
      targetTab: 'approvals' as NavItem,
      ctaLabel: 'View Audit History',
      highlights: ['Automated Dispatch', 'Tamper-Proof Audit Log', 'Execution State Storage', 'Closed-Loop Verification']
    }
  ];

  const rootProblems = [
    {
      problem: 'Customer information is scattered',
      solution: 'Unified customer profile and evidence timeline.',
      result: 'Time spent finding relevant customer information.',
      icon: Database,
      stepRef: 'Steps 1 & 2'
    },
    {
      problem: 'Important risks are noticed late',
      solution: 'Revenue Radar prioritizes accounts using risk and urgency.',
      result: 'Whether high-priority test accounts are identified correctly.',
      icon: TrendingDown,
      stepRef: 'Step 3'
    },
    {
      problem: 'A risk score does not explain itself',
      solution: 'Revenue Risk Autopsy links conclusions to source evidence and exposes uncertainty.',
      result: 'Accuracy and traceability of the explanation.',
      icon: HelpCircle,
      stepRef: 'Steps 3 & 4'
    },
    {
      problem: 'Follow-up is slow and inconsistent',
      solution: 'Next-Best-Action Copilot prepares emails, tasks and CRM updates.',
      result: 'Time required to prepare and complete follow-up.',
      icon: Send,
      stepRef: 'Step 4'
    },
    {
      problem: 'AI actions can be wrong or unaccountable',
      solution: 'Explicit approval, backend enforcement and an audit trail.',
      result: 'Zero unapproved consequential actions executed in testing.',
      icon: ShieldCheck,
      stepRef: 'Steps 5 & 6'
    }
  ];

  return (
    <div className="space-y-12 pb-20 max-w-5xl mx-auto w-full">
      {/* Hero Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full font-bold border border-blue-400/30">
              Revora Architecture & System Flow
            </span>
            <span className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Evidence-First Revenue Intelligence
            </span>
          </div>

          <h1 className="font-headline text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
            How Revora Works: The 6-Step Revenue Pipeline
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed font-body">
            Revora turns scattered customer signals into accountable, human-approved revenue retention actions. 
            Every conclusion is grounded in verifiable evidence, every uncertainty is explicitly stated, 
            and no consequential action executes without account manager approval.
          </p>

          <div className="pt-3 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigateToTab('dashboard')}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <span>Explore Revenue Radar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigateToTab('autopsy')}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>See Acme Technologies Risk Autopsy</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: The 6-Step Pipeline (Image 1) */}
      <section className="space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
              The 6-Step End-to-End System Flow
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-body mt-0.5">
              Sequential progression from raw scattered customer signals to executed audit history
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 px-3.5 py-1.5 rounded-lg border border-blue-800">
            6 Sequential Stages
          </span>
        </div>

        {/* Vertical Flow Diagram matching Image 1 */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === steps.length - 1;
            const isGreenFinal = step.stepNumber === 6;

            return (
              <div key={step.stepNumber} className="relative">
                {/* Step Card */}
                <div 
                  className={`rounded-2xl p-6 sm:p-7 transition-all duration-200 border shadow-lg ${
                    isGreenFinal 
                      ? 'bg-emerald-950/40 border-emerald-800/80 text-white shadow-emerald-950/20' 
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isGreenFinal ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-blue-400 border border-slate-700'
                        }`}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className={`text-xs font-mono uppercase font-bold tracking-wider block ${
                            isGreenFinal ? 'text-emerald-400' : 'text-blue-400'
                          }`}>
                            Step {step.stepNumber}
                          </span>
                          <h3 className="font-headline text-lg sm:text-xl font-bold tracking-tight text-white">
                            Step {step.stepNumber} — {step.title}
                          </h3>
                        </div>
                      </div>

                      <p className={`text-sm sm:text-base font-semibold leading-relaxed font-body ${
                        isGreenFinal ? 'text-emerald-200' : 'text-slate-200'
                      }`}>
                        {step.subtitle}
                      </p>

                      <p className={`text-xs sm:text-sm leading-relaxed font-body ${
                        isGreenFinal ? 'text-emerald-300/80' : 'text-slate-400'
                      }`}>
                        {step.description}
                      </p>
                    </div>

                    {/* Step CTA */}
                    <div className="shrink-0 flex flex-col items-start sm:items-end gap-2 pt-2 sm:pt-0">
                      <button
                        onClick={() => onNavigateToTab(step.targetTab)}
                        className={`inline-flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm ${
                          isGreenFinal
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-700'
                        }`}
                      >
                        <span>{step.ctaLabel}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Highlights pills */}
                  <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap gap-2">
                    {step.highlights.map((h, hIdx) => (
                      <span
                        key={hIdx}
                        className={`text-xs font-mono px-2.5 py-1 rounded-md ${
                          isGreenFinal 
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Downward Arrow between steps */}
                {!isLast && (
                  <div className="flex justify-center py-3">
                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center shadow-md">
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: How Each Part Solves the Root Problem (Image 3) */}
      <section className="space-y-6 pt-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-bold block">
              Value & Problem Alignment
            </span>
            <h2 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
              5. How each part solves the root problem
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-body mt-0.5">
              Mapping foundational customer challenges directly to Revora system capabilities and measurable metrics
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-emerald-950 text-emerald-300 px-3.5 py-1.5 rounded-lg border border-emerald-800">
            5 Core Capabilities
          </span>
        </div>

        {/* 5 Problem/Solution/Result Cards exactly matching Image 3 */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {rootProblems.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-6 text-white transition-all space-y-2 shadow-lg group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <strong className="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors block">
                    Problem: {item.problem}
                  </strong>

                  <p className="text-sm text-slate-300 font-body leading-relaxed">
                    <span className="text-slate-400 font-semibold">Solution:</span> {item.solution}
                  </p>

                  <p className="text-xs sm:text-sm text-slate-400 font-body">
                    <span className="text-slate-500 font-medium">Result to measure:</span> {item.result}
                  </p>
                </div>

                <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-blue-300 shrink-0">
                  {item.stepRef}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: Closed-Loop Learning Cycle (Features 4 & 5) */}
      <section className="space-y-6 pt-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold block">
              Autonomous Closed-Loop Feedback
            </span>
            <h2 className="font-headline text-xl sm:text-2xl font-bold text-white tracking-tight">
              Features 4 & 5 — The Continuous Learning Cycle
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-body mt-0.5">
              How captured outcomes continuously train the History-Aware Recommendation Engine without manual retraining
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 px-3.5 py-1.5 rounded-lg border border-blue-800">
            Closed-Loop AI
          </span>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {/* Card 4 */}
          <div className="bg-[#0b1329] border border-emerald-900/60 rounded-2xl p-5 text-white flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <h3 className="font-headline text-base font-bold text-emerald-300">
                4. Capture the outcome
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-body">
                Record completion, notes, customer response, and supporting evidence.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0">
              Feature 1–3
            </span>
          </div>

          <div className="flex justify-center py-0.5">
            <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 5 */}
          <div className="bg-[#0b1329] border border-blue-900/60 rounded-2xl p-5 text-white flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <h3 className="font-headline text-base font-bold text-blue-300">
                5. Learn from account history
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-body">
                Find which actions worked in similar situations, and which did not.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800 shrink-0">
              Feature 4: Outcome Intelligence
            </span>
          </div>

          <div className="flex justify-center py-0.5">
            <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 6 */}
          <div className="bg-[#0b1329] border border-indigo-900/60 rounded-2xl p-5 text-white flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <h3 className="font-headline text-base font-bold text-indigo-300">
                6. Improve the next recommendation
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-body">
                Use the new outcome as context for future investigations and anti-repetition rules.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0">
              Feature 5: History-Aware Engine
            </span>
          </div>

          <div className="flex justify-center py-0.5">
            <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 7 */}
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 text-white flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <h3 className="font-headline text-base font-bold text-white">
                7. Return updated information to React
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-body">
                Show the new status, history, results, and recommended next step in Action Copilot.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
              React UI Shell
            </span>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs font-mono text-slate-400">
              The cycle repeats whenever new signals or outcomes become available.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Quick-Jump Banner */}
      <div className="bg-linear-to-r from-slate-900 to-blue-950 border border-slate-800 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1.5">
          <h3 className="font-headline text-lg sm:text-xl font-bold text-white">
            Ready to inspect the live evidence-grounded workflow?
          </h3>
          <p className="text-sm text-slate-300 font-body">
            Experience how Acme Technologies is evaluated through Revenue Radar, Risk Autopsy, and Action Copilot.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onOpenAutopsyForDemo ? onOpenAutopsyForDemo() : onNavigateToTab('autopsy')}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Launch Risk Autopsy</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SystemFlowView;
