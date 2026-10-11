import uuid
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.models.schemas import (
    OutcomeAnalysisRequest,
    OutcomeAnalysisResult,
    SentimentEvidence,
    AdoptionBlocker,
    RenewalObjection,
    CustomerCommitmentItem,
    UnresolvedIssue,
    Signal
)
from app.core.config import settings
from app.core.llm_client import llm_client
from app.services.account_repository import account_repo

logger = logging.getLogger("revora.outcome_analyzer")

class OutcomeAnalyzerService:
    """
    Feature 3: AI Outcome Analyzer Service.
    Uses an LLM to turn free-text meeting notes, emails, and user feedback
    into structured, searchable account information.
    Specifically adheres to rule:
    'Sentiment should be treated as an interpretation, not a verified fact about the customer's internal state.'
    """
    def __init__(self):
        self._history: Dict[str, OutcomeAnalysisResult] = {}
        self.db = None
        self._init_mongodb()
        self._seed_sample_analyses()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500, socketTimeoutMS=1500)
                client.admin.command('ping')
                self.db = client[settings.MONGODB_DB_NAME]
            except Exception as e:
                logger.warning(f"OutcomeAnalyzerService MongoDB fallback to memory: {e}")
                self.db = None

    def _seed_sample_analyses(self):
        # Sample 1: Acme Technologies Meeting Note Analysis
        res1 = OutcomeAnalysisResult(
            id="ana-101",
            account_id="acc-101",
            account_name="Acme Technologies",
            source_type="meeting_note",
            title="Q3 Technical Architecture & Renewal Sync",
            raw_text="Sync with VP Eng David and DevOps lead. David noted that API latency improved after our v2 patch, but their data engineering team hasn't adopted the SAML SSO seats yet because Okta certificate metadata failed validation. David warned that renewal is in 43 days and finance won't authorize the 20% tier expansion unless SSO is verified across all 50 engineers. Also, David seemed hesitant about seat minimums.",
            meeting_date="2026-10-09",
            participants="David Kim (VP Eng), Sarah Jenkins (Revora CSM), Marcus Vance (SE)",
            analyzed_at="2026-10-09T16:30:00Z",
            sentiment_analysis=SentimentEvidence(
                interpretation="Cautiously receptive regarding infrastructure performance improvements, but displaying notable hesitation and pressure regarding contract cost and renewal deadlines.",
                sentiment_label="cautiously_optimistic",
                supporting_quote_or_evidence="David warned that renewal is in 43 days and finance won't authorize tier expansion unless SSO is verified. Seemed hesitant about seat minimums.",
                confidence=0.88,
                is_interpretation_notice="Treated as an interpretation, not a verified fact about internal mental state."
            ),
            adoption_blockers=[
                AdoptionBlocker(
                    blocker_title="Okta SAML SSO Metadata Validation Failure",
                    severity="high",
                    feature_or_area="Enterprise Authentication / SAML SSO",
                    evidence="Data engineering team hasn't adopted seats yet because Okta certificate metadata failed validation.",
                    workaround_exists=True
                )
            ],
            renewal_objections=[
                RenewalObjection(
                    objection_type="sso_security",
                    description="Finance blocked 20% contract tier expansion contingent on SSO verification across all 50 engineers.",
                    direct_evidence="Finance won't authorize tier expansion unless SSO is verified across all 50 engineers.",
                    impact_level="critical"
                ),
                RenewalObjection(
                    objection_type="pricing",
                    description="Customer leadership expresses hesitation over strict annual seat minimums.",
                    direct_evidence="David seemed hesitant about seat minimums.",
                    impact_level="moderate"
                )
            ],
            commitments_and_next_steps=[
                CustomerCommitmentItem(
                    commitment_text="Customer VP will bring IT Security lead to Thursday technical working session.",
                    responsible_party="customer",
                    agreed_timeline="2026-10-15",
                    status="open"
                ),
                CustomerCommitmentItem(
                    commitment_text="Revora Solutions Engineer Marcus will configure custom SAML XML and test Okta handshake.",
                    responsible_party="vendor_csm",
                    agreed_timeline="2026-10-12",
                    status="open"
                )
            ],
            unresolved_issues=[
                UnresolvedIssue(
                    issue_title="Unverified SAML SSO integration blocking 35 developer seats",
                    description="Until Okta metadata configuration is validated, 35 technical seats remain idle.",
                    recommended_follow_up="Conduct 20-minute live screen share with Acme DevOps lead to resolve SAML certificate handshake.",
                    target_owner="Marcus Vance (SE)",
                    urgency="immediate"
                )
            ],
            structured_investigation_brief="Acme Technologies core technical evaluation is positive following v2 patch, but renewal in 43 days is jeopardized by an authentication blocker (Okta SAML failure). Resolving the technical SSO configuration directly unblocks finance approval for the 20% expansion.",
            generated_signal_id="sig-outcome-101",
            rule_notice="Sentiment is treated as an interpretation, not a verified fact about the customer's internal state."
        )
        self._history[res1.id] = res1

        # Sample 2: HyperScale Labs Email Thread Analysis
        res2 = OutcomeAnalysisResult(
            id="ana-102",
            account_id="acc-104",
            account_name="HyperScale Labs",
            source_type="email_thread",
            title="Email thread re: Director departure & Q4 roadmap pause",
            raw_text="From: Interim VP Tech Operations. We are pausing all external vendor evaluations this month due to leadership transition following Rachel's exit. We noticed our weekly pipeline jobs decreased. We will not be increasing licenses and will look at Datadog alternatives unless cost is trimmed by 30%.",
            meeting_date="2026-10-10",
            participants="Interim VP Tech Ops, Sarah Jenkins (Revora CSM)",
            analyzed_at="2026-10-10T11:15:00Z",
            sentiment_analysis=SentimentEvidence(
                interpretation="Strongly detached and cost-sensitive posture amidst leadership churn, displaying high churn risk and competitive threat exploration.",
                sentiment_label="critical_risk",
                supporting_quote_or_evidence="Pausing all external vendor evaluations... will look at Datadog alternatives unless cost is trimmed by 30%.",
                confidence=0.92,
                is_interpretation_notice="Treated as an interpretation, not a verified fact about internal mental state."
            ),
            adoption_blockers=[
                AdoptionBlocker(
                    blocker_title="Executive Sponsor Departure & Reorganization Freeze",
                    severity="critical",
                    feature_or_area="Account Champion & Usage Pipeline",
                    evidence="Leadership transition following Rachel's exit; weekly pipeline jobs decreased.",
                    workaround_exists=False
                )
            ],
            renewal_objections=[
                RenewalObjection(
                    objection_type="competitor",
                    description="Customer actively threatening evaluation of Datadog alternatives.",
                    direct_evidence="Will look at Datadog alternatives unless cost is trimmed by 30%.",
                    impact_level="critical"
                ),
                RenewalObjection(
                    objection_type="pricing",
                    description="Demanding 30% contract reduction to continue service.",
                    direct_evidence="Unless cost is trimmed by 30%.",
                    impact_level="critical"
                )
            ],
            commitments_and_next_steps=[
                CustomerCommitmentItem(
                    commitment_text="Customer will keep existing sandbox instance active through end of month for transition review.",
                    responsible_party="customer",
                    agreed_timeline="2026-10-31",
                    status="open"
                )
            ],
            unresolved_issues=[
                UnresolvedIssue(
                    issue_title="Key contact departed; impending competitive churn threat",
                    description="Account has dropped 70% in weekly usage and has no designated platform champion.",
                    recommended_follow_up="Escalate to VP Customer Success and propose a revised multi-year retention tier package.",
                    target_owner="CSM Lead",
                    urgency="immediate"
                )
            ],
            structured_investigation_brief="Critical retention hazard triggered by champion turnover and aggressive competitor consideration. Urgent executive sponsor alignment required.",
            generated_signal_id="sig-outcome-102",
            rule_notice="Sentiment is treated as an interpretation, not a verified fact about the customer's internal state."
        )
        self._history[res2.id] = res2

    def analyze_outcome(self, req: OutcomeAnalysisRequest) -> OutcomeAnalysisResult:
        acc = account_repo.get_account_by_id(req.account_id)
        account_name = acc.name if acc else "Customer Account"

        system_prompt = (
            "You are Revora's AI Outcome Analyzer for B2B Revenue Intelligence.\n"
            "Your job is to parse unstructured meeting notes, emails, and feedback transcripts into deterministic, structured data.\n"
            "CRITICAL DIRECTIVE: Sentiment must be explicitly framed as an INTERPRETATION supported by direct evidence/quotes, "
            "never asserted as an absolute verified fact about the customer's internal mental state.\n"
            "Extract:\n"
            "1. sentiment_analysis: interpretation, sentiment_label (positive, cautiously_optimistic, neutral, frustrated, critical_risk), supporting_quote_or_evidence, confidence.\n"
            "2. adoption_blockers: list of {blocker_title, severity, feature_or_area, evidence, workaround_exists}.\n"
            "3. renewal_objections: list of {objection_type, description, direct_evidence, impact_level}.\n"
            "4. commitments_and_next_steps: list of {commitment_text, responsible_party, agreed_timeline, status}.\n"
            "5. unresolved_issues: list of {issue_title, description, recommended_follow_up, target_owner, urgency}.\n"
            "6. structured_investigation_brief: 2-3 sentence executive briefing suitable for the next investigation cycle.\n"
            "Return valid JSON matching this structure."
        )

        user_prompt = (
            f"Account: {account_name} (ID: {req.account_id})\n"
            f"Source Type: {req.source_type}\n"
            f"Title: {req.title or 'Customer Interaction Notes'}\n"
            f"Meeting Date: {req.meeting_date or 'Recent'}\n"
            f"Participants: {req.participants or 'CSM & Stakeholders'}\n"
            f"Raw Text Content:\n{req.raw_text}\n"
        )

        parsed_data = None

        # 1. Try OpenRouter LLM
        if llm_client.is_available():
            try:
                parsed_data = llm_client.generate_json(user_prompt, system_prompt=system_prompt)
            except Exception as e:
                logger.warning(f"OpenRouter outcome analysis failed: {e}")

        # 2. Try Gemini API
        if not parsed_data and settings.GEMINI_API_KEY:
            try:
                from google import genai
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                resp = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=f"{system_prompt}\n\n{user_prompt}",
                    config={"response_mime_type": "application/json"}
                )
                if resp.text:
                    parsed_data = json.loads(resp.text)
            except Exception as e:
                logger.warning(f"Gemini outcome analysis failed: {e}")

        # 3. Deterministic NLP extraction fallback
        if not parsed_data:
            parsed_data = self._deterministic_extract(req.raw_text, account_name)

        analysis_id = f"ana-{uuid.uuid4().hex[:8]}"
        now_iso = datetime.utcnow().isoformat()

        # Build validated typed object
        result = OutcomeAnalysisResult(
            id=analysis_id,
            account_id=req.account_id,
            account_name=account_name,
            source_type=req.source_type,
            title=req.title or f"Analysis of {req.source_type.replace('_', ' ').title()}",
            raw_text=req.raw_text,
            meeting_date=req.meeting_date,
            participants=req.participants,
            analyzed_at=now_iso,
            sentiment_analysis=SentimentEvidence(
                interpretation=parsed_data.get("sentiment_analysis", {}).get(
                    "interpretation",
                    "Customer interaction indicates measured engagement with specific operational considerations."
                ),
                sentiment_label=parsed_data.get("sentiment_analysis", {}).get(
                    "sentiment_label", "neutral"
                ),
                supporting_quote_or_evidence=parsed_data.get("sentiment_analysis", {}).get(
                    "supporting_quote_or_evidence", req.raw_text[:120]
                ),
                confidence=float(parsed_data.get("sentiment_analysis", {}).get("confidence", 0.85)),
                is_interpretation_notice="Treated as an interpretation, not a verified fact about internal mental state."
            ),
            adoption_blockers=[
                AdoptionBlocker(**b) for b in parsed_data.get("adoption_blockers", [])
            ],
            renewal_objections=[
                RenewalObjection(**o) for o in parsed_data.get("renewal_objections", [])
            ],
            commitments_and_next_steps=[
                CustomerCommitmentItem(**c) for c in parsed_data.get("commitments_and_next_steps", [])
            ],
            unresolved_issues=[
                UnresolvedIssue(**u) for u in parsed_data.get("unresolved_issues", [])
            ],
            structured_investigation_brief=parsed_data.get(
                "structured_investigation_brief",
                f"Synthesized notes for {account_name}. Key takeaways ingested into Revora evidence store."
            ),
            rule_notice="Sentiment is treated as an interpretation, not a verified fact about the customer's internal state."
        )

        # Ingest as verifiable Signal if requested
        if req.auto_ingest_as_evidence:
            sig_id = f"sig-ana-{uuid.uuid4().hex[:6]}"
            new_sig = Signal(
                id=sig_id,
                account_id=req.account_id,
                source_category="email" if "email" in req.source_type else "calendar",
                signal_type="interaction_analyzed",
                title=f"AI Outcome Analyzed: {result.title}",
                summary=result.structured_investigation_brief,
                severity="high" if len(result.renewal_objections) > 0 else "medium",
                timestamp=now_iso,
                metadata={
                    "analysis_id": analysis_id,
                    "sentiment_label": result.sentiment_analysis.sentiment_label,
                    "blockers_count": len(result.adoption_blockers),
                    "commitments_count": len(result.commitments_and_next_steps)
                }
            )
            try:
                account_repo.create_signal(new_sig)
                result.generated_signal_id = sig_id
            except Exception as e:
                logger.warning(f"Failed to auto-ingest signal: {e}")

        self._history[result.id] = result
        if self.db is not None:
            try:
                self.db.outcome_analyses.insert_one(result.model_dump())
            except Exception as e:
                logger.warning(f"MongoDB save outcome analysis error: {e}")

        return result

    def get_analysis_by_id(self, analysis_id: str) -> Optional[OutcomeAnalysisResult]:
        if self.db is not None:
            try:
                doc = self.db.outcome_analyses.find_one({"id": analysis_id}, {"_id": 0})
                if doc:
                    return OutcomeAnalysisResult(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_analysis_by_id error: {e}")
        return self._history.get(analysis_id)

    def get_analyses_for_account(self, account_id: str) -> List[OutcomeAnalysisResult]:
        if self.db is not None:
            try:
                docs = list(self.db.outcome_analyses.find({"account_id": account_id}, {"_id": 0}))
                if docs:
                    return [OutcomeAnalysisResult(**d) for d in docs]
            except Exception as e:
                logger.warning(f"MongoDB get_analyses_for_account error: {e}")
        return [a for a in self._history.values() if a.account_id == account_id]

    def _deterministic_extract(self, text: str, account_name: str) -> Dict[str, Any]:
        lower = text.lower()

        # Sentiment heuristic
        if any(w in lower for w in ["churn", "cancel", "pause", "alternative", "competitor", "datadog", "drop"]):
            label = "critical_risk"
            interpretation = "Interaction reveals significant risk indicators and customer reassessment of vendor value."
        elif any(w in lower for w in ["expensive", "hesitant", "delay", "blocked", "issue", "bug"]):
            label = "frustrated"
            interpretation = "Customer exhibits friction around implementation roadblocks or pricing parameters."
        elif any(w in lower for w in ["great", "love", "improved", "adopted", "excited", "positive"]):
            label = "positive"
            interpretation = "Customer demonstrates favorable sentiment regarding recent product performance and adoption."
        else:
            label = "cautiously_optimistic"
            interpretation = "Constructive dialogue focusing on product operationalization and upcoming workflow alignment."

        blockers = []
        if any(w in lower for w in ["sso", "okta", "saml", "login", "auth"]):
            blockers.append({
                "blocker_title": "Enterprise SSO / Authentication Integration Roadblock",
                "severity": "high",
                "feature_or_area": "Identity & Access Management",
                "evidence": "Mention of SSO/Okta configuration difficulties preventing user onboarding.",
                "workaround_exists": True
            })
        if any(w in lower for w in ["api", "latency", "pipeline", "slow", "down"]):
            blockers.append({
                "blocker_title": "API Performance or Data Processing Pipeline Contraction",
                "severity": "medium",
                "feature_or_area": "Data Pipeline / API Services",
                "evidence": "Telemetry or discussion indicates processing volume constraints.",
                "workaround_exists": False
            })

        objections = []
        if any(w in lower for w in ["renewal", "finance", "budget", "cost", "30%", "20%", "discount", "minimums"]):
            objections.append({
                "objection_type": "pricing",
                "description": "Budget constraints or contract pricing threshold voiced ahead of renewal window.",
                "direct_evidence": text[:140],
                "impact_level": "critical"
            })
        if any(w in lower for w in ["datadog", "competitor", "alternative", "substitute"]):
            objections.append({
                "objection_type": "competitor",
                "description": "Stakeholders exploring competitive vendor replacement options.",
                "direct_evidence": "Customer referenced evaluating market alternatives.",
                "impact_level": "critical"
            })

        commitments = [
            {
                "commitment_text": "Follow up with technical resolution guide and schedule joint architectural review.",
                "responsible_party": "vendor_csm",
                "agreed_timeline": "Within 4 business days",
                "status": "open"
            }
        ]

        unresolved = [
            {
                "issue_title": f"Follow-up on {account_name} feedback takeaways",
                "description": "Synthesized insights from recent notes require scheduled action dispatch.",
                "recommended_follow_up": "Dispatch personalized outreach acknowledging points discussed.",
                "target_owner": "Assigned CSM",
                "urgency": "within_week"
            }
        ]

        return {
            "sentiment_analysis": {
                "interpretation": interpretation,
                "sentiment_label": label,
                "supporting_quote_or_evidence": text[:150],
                "confidence": 0.86
            },
            "adoption_blockers": blockers,
            "renewal_objections": objections,
            "commitments_and_next_steps": commitments,
            "unresolved_issues": unresolved,
            "structured_investigation_brief": f"AI synthesis of recent feedback for {account_name}. Identified key adoption and renewal parameters."
        }

outcome_analyzer_service = OutcomeAnalyzerService()
