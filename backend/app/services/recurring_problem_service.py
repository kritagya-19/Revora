import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.models.schemas import (
    RecurringProblem,
    RecurringProblemsReport,
    EvidenceLink,
    AffectedAccountSummary,
    RelationshipType,
    RootCauseStatus,
)
from app.services.account_repository import account_repo
from app.services.feedback_repository import feedback_repo

logger = logging.getLogger("revora.recurring_problem_service")


# Canonical problem cluster definitions with classification rules & correlation distinctions
CLUSTERS_CONFIG = [
    {
        "cluster_key": "integration_webhook_failure",
        "title": "Webhook & Event Ingestion Latency / Timeout Under Load",
        "category": "API & Webhook Reliability",
        "keywords": [
            "webhook", "kafka", "latency", "timeout", "504", "api", "payload",
            "ingestion", "integration failure", "event payload", "batch"
        ],
        "default_severity": "critical",
        "adoption_difficulties": [
            "Developers unable to complete automated data pipelines due to 504 timeouts",
            "Batch ingest failures stall production rollouts to downstream teams",
            "Loss of event payloads damages customer team trust during peak periods"
        ],
        "correlation_explanation": (
            "Declining product usage closely co-occurs with webhook timeouts and open tickets. "
            "However, this is an observed correlation rather than confirmed causal proof: external factors "
            "such as customer cloud migrations or reduced developer staffing may also contribute to lower activity."
        ),
        "relationship_type": RelationshipType.OBSERVED_CORRELATION,
        "root_cause_status": RootCauseStatus.PARTIALLY_VALIDATED,
        "investigation_needed": (
            "Run automated webhook latency benchmark telemetry and conduct a joint technical unblocker "
            "call with customer DevOps leads to verify if timeout reduction directly restores payload traffic."
        ),
        "confounding_factors": [
            "Concurrent customer cloud architecture migration",
            "Customer developer team reallocation to internal projects",
            "Variable third-party API rate limits"
        ]
    },
    {
        "cluster_key": "auth_sso_okta_friction",
        "title": "Enterprise SSO & SAML Handshake Configuration Friction",
        "category": "Authentication & Access Configuration",
        "keywords": [
            "sso", "saml", "okta", "handshake", "certificate", "authentication",
            "permission", "login", "identity", "security hold", "licenses"
        ],
        "default_severity": "high",
        "adoption_difficulties": [
            "IT security team delays approving user expansion without automated cert validation",
            "Seat utilization stalls because end users cannot complete SAML one-click login",
            "Administrative burden on customer champions trying to troubleshoot certificate errors"
        ],
        "correlation_explanation": (
            "This represents an observed correlation rather than confirmed causal proof: low seat saturation co-occurs "
            "with reported SAML certificate handshake friction. While correlated, the lack of seat growth could also stem "
            "from broader corporate budget freezes or internal slow rollout cycles independent of the SSO configuration hurdle."
        ),
        "relationship_type": RelationshipType.OBSERVED_CORRELATION,
        "root_cause_status": RootCauseStatus.PARTIALLY_VALIDATED,
        "investigation_needed": (
            "Provision a test environment with pre-verified SAML certificate validation tooling "
            "and measure if seat activation rate accelerates within 14 days of resolving handshake errors."
        ),
        "confounding_factors": [
            "Corporate IT seasonal security audit freezes",
            "Departmental budget approvals pending quarterly reviews",
            "Decentralized user onboarding across multiple business units"
        ]
    },
    {
        "cluster_key": "onboarding_training_stalls",
        "title": "Post-Onboarding Adoption Drop & Feature Discovery Friction",
        "category": "Onboarding & User Enablement",
        "keywords": [
            "onboarding", "training", "guidance", "workflow", "adoption", "paused",
            "confusion", "documentation", "how to", "discovery", "user ramp"
        ],
        "default_severity": "high",
        "adoption_difficulties": [
            "New team members abandon initial setup when encountering advanced workflow screens",
            "Lack of role-specific templates leaves departmental users uncertain how to start",
            "CSM engagement gaps leave non-technical users without actionable best practices"
        ],
        "correlation_explanation": (
            "This represents an observed correlation rather than confirmed causal proof: steep usage contractions observed "
            "30-60 days post-contract correlate with complaints regarding training gaps. However, this correlation does not prove "
            "training is the sole cause; end-user workload surges and executive sponsor turnover often trigger concurrent drop-offs in tool exploration."
        ),
        "relationship_type": RelationshipType.OBSERVED_CORRELATION,
        "root_cause_status": RootCauseStatus.UNCONFIRMED_HYPOTHESIS,
        "investigation_needed": (
            "Implement an interactive guided workflow onboarding walkthrough for a cohort of newly added users "
            "and track whether 30-day active retention increases compared to the control cohort."
        ),
        "confounding_factors": [
            "Customer department re-prioritizing competing software rollouts",
            "High employee turnover within customer operational teams",
            "Lack of internal executive mandate requiring daily software usage"
        ]
    },
    {
        "cluster_key": "performance_query_latency",
        "title": "Slow Query Performance & Large Dataset Dashboard Latency",
        "category": "Data Processing & Performance",
        "keywords": [
            "slow", "performance", "speed", "load time", "query", "dashboard",
            "lag", "latency", "rendering", "database", "refresh"
        ],
        "default_severity": "medium",
        "adoption_difficulties": [
            "Executive users abandon real-time dashboards when query execution exceeds 10 seconds",
            "Scheduled morning report generation fails on large account telemetry tables",
            "CSMs report reduced customer executive engagement during quarterly business reviews"
        ],
        "correlation_explanation": (
            "This represents an observed correlation rather than confirmed causal proof: executive session duration drops "
            "correlate with slow query alerts on large datasets. While logically linked, executive engagement may also decline "
            "due to shifting strategic priorities or alternate data visualization tools used by corporate leadership."
        ),
        "relationship_type": RelationshipType.OBSERVED_CORRELATION,
        "root_cause_status": RootCauseStatus.UNCONFIRMED_HYPOTHESIS,
        "investigation_needed": (
            "Deploy query caching optimizations on top 3 executive dashboard views and observe whether "
            "weekly session frequency and duration rebound among affected leadership profiles."
        ),
        "confounding_factors": [
            "Seasonal quarterly reporting lulls",
            "Parallel usage of enterprise BI tools (Tableau/PowerBI)",
            "Browser performance bottlenecks on older customer workstations"
        ]
    },
    {
        "cluster_key": "contract_pricing_fit",
        "title": "Pricing Model & Tier Misalignment Near Renewal Window",
        "category": "Contract & Value Realization",
        "keywords": [
            "pricing", "contract", "tier", "renewal", "expensive", "cost", "seats",
            "sponsor", "roi", "value", "downgrade"
        ],
        "default_severity": "medium",
        "adoption_difficulties": [
            "Procurement questioning contract renewal when seat utilization is under 65%",
            "Difficulty articulating ROI to finance stakeholders before scheduled renewal",
            "Hesitation to expand licenses into additional departments without volume discounting"
        ],
        "correlation_explanation": (
            "This represents an observed correlation rather than confirmed causal proof: accounts approaching renewal with low "
            "utilization frequently express pricing hesitation. Observing price complaints does not establish that price was "
            "the root barrier; under-utilization earlier in the lifecycle often creates perceived value deficit at renewal time."
        ),
        "relationship_type": RelationshipType.OBSERVED_CORRELATION,
        "root_cause_status": RootCauseStatus.UNCONFIRMED_HYPOTHESIS,
        "investigation_needed": (
            "Conduct structured executive ROI alignment reviews 60 days before contract renewal to test whether "
            "demonstrating verified cost savings overcomes initial budget resistance."
        ),
        "confounding_factors": [
            "Macroeconomic IT budget tightening",
            "Vendor consolidation mandates across the enterprise",
            "Contract ownership transition to new procurement personnel"
        ]
    }
]


class RecurringProblemService:
    """
    Member 3 — Task D Service:
    - Groups related feedback, support issues, and usage patterns across customers.
    - Identifies repeated complaints and adoption difficulties across the account portfolio.
    - Links every finding to the exact accounts and records (feedback, tickets, telemetry) that support it.
    - Distinguishes observed correlation from confirmed root cause, providing explicit explanations,
      hypotheses, and investigation steps.
    """

    def get_recurring_problems_report(self) -> RecurringProblemsReport:
        """
        Synthesizes recurring customer problems across all accounts, signals, and feedback records.
        """
        accounts = account_repo.get_all_accounts_with_risk()
        account_map = {a.id: a for a in accounts}
        feedback_records = feedback_repo.list_feedback_records()

        # Collect all signals across accounts
        all_signals = []
        for acc in accounts:
            sigs = account_repo.get_account_signals(acc.id)
            all_signals.extend(sigs)

        problems: List[RecurringProblem] = []
        now_iso = datetime.now(timezone.utc).isoformat()

        for idx, cfg in enumerate(CLUSTERS_CONFIG):
            cluster_key = cfg["cluster_key"]
            keywords = [k.lower() for k in cfg["keywords"]]

            # 1. Gather matching feedback records
            matched_feedback = []
            for fb in feedback_records:
                text_to_check = (
                    f"{fb.submission.primary_blocker} "
                    f"{fb.submission.unresolved_issues or ''} "
                    f"{fb.submission.feature_improvement_request or ''} "
                    f"{fb.analysis.classified_churn_reason if fb.analysis else ''} "
                    f"{' '.join(fb.analysis.key_blockers) if fb.analysis else ''}"
                ).lower()
                if any(kw in text_to_check for kw in keywords):
                    matched_feedback.append(fb)

            # 2. Gather matching support & telemetry signals
            matched_tickets = []
            matched_usage_drops = []
            for sig in all_signals:
                sig_text = f"{sig.title} {sig.summary} {sig.signal_type} {sig.source_category}".lower()
                if any(kw in sig_text for kw in keywords):
                    if sig.signal_type == "support_ticket" or "ticket" in sig.source_type.lower():
                        matched_tickets.append(sig)
                    elif sig.signal_type == "usage_drop" or sig.source_category == "usage":
                        matched_usage_drops.append(sig)

            # Check if this cluster has meaningful occurrences
            total_occurrences = len(matched_feedback) + len(matched_tickets) + len(matched_usage_drops)
            if total_occurrences == 0:
                continue

            # 3. Aggregate unique affected accounts
            affected_account_ids = set()
            for fb in matched_feedback:
                affected_account_ids.add(fb.account_id)
            for sig in matched_tickets:
                affected_account_ids.add(sig.account_id)
            for sig in matched_usage_drops:
                affected_account_ids.add(sig.account_id)

            affected_summaries: List[AffectedAccountSummary] = []
            total_arr = 0.0

            for acc_id in affected_account_ids:
                acc = account_map.get(acc_id)
                acc_name = acc.name if acc else acc_id
                acc_arr = float(acc.arr) if acc else 0.0
                total_arr += acc_arr

                # Count evidence for this specific account
                acc_fb_count = sum(1 for fb in matched_feedback if fb.account_id == acc_id)
                acc_sig_count = sum(1 for s in matched_tickets + matched_usage_drops if s.account_id == acc_id)
                
                # Primary complaint extraction
                primary_comp = "Reported technical friction and workflow hesitation"
                for fb in matched_feedback:
                    if fb.account_id == acc_id:
                        primary_comp = fb.submission.unresolved_issues or fb.submission.primary_blocker
                        break
                if primary_comp.startswith("Reported"):
                    for s in matched_tickets:
                        if s.account_id == acc_id:
                            primary_comp = f"{s.title}: {s.summary}"
                            break

                affected_summaries.append(
                    AffectedAccountSummary(
                        account_id=acc_id,
                        account_name=acc_name,
                        arr=acc_arr,
                        csm_owner=acc.csm_owner if acc else "Unassigned",
                        health_score=acc.health_score if (acc and acc.health_score is not None) else 50,
                        risk_level=acc.risk_level.value if (acc and hasattr(acc.risk_level, 'value')) else "high",
                        evidence_count=acc_fb_count + acc_sig_count,
                        primary_complaint=primary_comp[:120] + "..." if len(primary_comp) > 120 else primary_comp
                    )
                )

            # Sort affected accounts by ARR descending
            affected_summaries.sort(key=lambda a: a.arr, reverse=True)

            # 4. Build Evidence Links
            evidence_links: List[EvidenceLink] = []
            for fb in matched_feedback:
                acc = account_map.get(fb.account_id)
                evidence_links.append(
                    EvidenceLink(
                        evidence_type="feedback",
                        record_id=fb.id,
                        account_id=fb.account_id,
                        account_name=acc.name if acc else fb.account_name,
                        title=f"Survey: {fb.submission.primary_blocker}",
                        description_or_quote=fb.submission.unresolved_issues or fb.submission.primary_blocker,
                        severity="high" if fb.submission.satisfaction_score <= 4 else "medium",
                        timestamp=fb.submitted_at,
                        metric_value=f"Score: {fb.submission.satisfaction_score}/10"
                    )
                )

            for sig in matched_tickets:
                acc = account_map.get(sig.account_id)
                meta = sig.metadata or {}
                evidence_links.append(
                    EvidenceLink(
                        evidence_type="support_ticket",
                        record_id=sig.id,
                        account_id=sig.account_id,
                        account_name=acc.name if acc else sig.account_id,
                        title=sig.title,
                        description_or_quote=sig.summary,
                        severity=sig.severity,
                        timestamp=sig.timestamp,
                        metric_value=f"Priority: {meta.get('priority', sig.severity)}"
                    )
                )

            for sig in matched_usage_drops:
                acc = account_map.get(sig.account_id)
                meta = sig.metadata or {}
                drop_val = meta.get("drop_pct")
                metric_str = f"-{drop_val}% drop" if drop_val else "Contraction"
                evidence_links.append(
                    EvidenceLink(
                        evidence_type="usage_signal",
                        record_id=sig.id,
                        account_id=sig.account_id,
                        account_name=acc.name if acc else sig.account_id,
                        title=sig.title,
                        description_or_quote=sig.summary,
                        severity=sig.severity,
                        timestamp=sig.timestamp,
                        metric_value=metric_str
                    )
                )

            # Sort evidence chronologically descending
            evidence_links.sort(key=lambda e: e.timestamp, reverse=True)

            # 5. Extract repeated complaints verbatim
            repeated_complaints = []
            for fb in matched_feedback:
                if fb.submission.unresolved_issues and fb.submission.unresolved_issues not in repeated_complaints:
                    repeated_complaints.append(fb.submission.unresolved_issues)
                if fb.submission.feature_improvement_request and fb.submission.feature_improvement_request not in repeated_complaints:
                    repeated_complaints.append(fb.submission.feature_improvement_request)

            # Fallback complaints if needed
            if not repeated_complaints:
                for sig in matched_tickets[:3]:
                    repeated_complaints.append(f"{sig.title}: {sig.summary}")

            first_obs = min((e.timestamp for e in evidence_links), default=now_iso)
            last_obs = max((e.timestamp for e in evidence_links), default=now_iso)

            # Determine dynamic severity based on ARR impact and critical tickets
            sev = cfg["default_severity"]
            if any(e.severity == "critical" for e in evidence_links) or total_arr > 200000:
                sev = "critical"
            elif total_arr < 80000 and sev == "high":
                sev = "medium"

            problems.append(
                RecurringProblem(
                    id=f"prob-rec-0{idx+1}",
                    cluster_key=cluster_key,
                    title=cfg["title"],
                    category=cfg["category"],
                    summary=(
                        f"Detected across {len(affected_summaries)} customer account(s) impacting "
                        f"${total_arr:,.0f} in ARR. Co-occurs with {len(matched_feedback)} survey response(s), "
                        f"{len(matched_tickets)} support ticket(s), and {len(matched_usage_drops)} usage signal(s)."
                    ),
                    severity=sev,
                    frequency_score=total_occurrences,
                    total_affected_accounts=len(affected_summaries),
                    total_arr_affected=total_arr,
                    feedback_count=len(matched_feedback),
                    support_ticket_count=len(matched_tickets),
                    usage_drop_signal_count=len(matched_usage_drops),
                    first_observed_at=first_obs,
                    last_observed_at=last_obs,
                    repeated_complaints=repeated_complaints[:5],
                    adoption_difficulties=cfg["adoption_difficulties"],
                    affected_accounts=affected_summaries,
                    evidence_links=evidence_links,
                    relationship_type=cfg["relationship_type"],
                    correlation_explanation=cfg["correlation_explanation"],
                    root_cause_status=cfg["root_cause_status"],
                    investigation_needed=cfg["investigation_needed"],
                    confounding_factors=cfg["confounding_factors"]
                )
            )

        # Sort problems by severity (critical first) then total ARR affected descending
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        problems.sort(key=lambda p: (severity_order.get(p.severity, 4), -p.total_arr_affected))

        # Build full report
        total_accounts_impacted = len({acc.account_id for p in problems for acc in p.affected_accounts})
        total_arr_at_risk = sum(p.total_arr_affected for p in problems)
        critical_count = sum(1 for p in problems if p.severity == "critical")

        return RecurringProblemsReport(
            total_problems_identified=len(problems),
            critical_problems_count=critical_count,
            total_accounts_impacted=total_accounts_impacted,
            total_arr_at_risk=total_arr_at_risk,
            problems=problems,
            generated_at=now_iso
        )

    def get_problem_by_id(self, problem_id: str) -> Optional[RecurringProblem]:
        report = self.get_recurring_problems_report()
        for p in report.problems:
            if p.id == problem_id or p.cluster_key == problem_id:
                return p
        return None

    def get_problems_by_account(self, account_id: str) -> List[RecurringProblem]:
        report = self.get_recurring_problems_report()
        return [p for p in report.problems if any(a.account_id == account_id for a in p.affected_accounts)]


recurring_problem_service = RecurringProblemService()
