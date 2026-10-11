import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.core.config import settings
from app.models.schemas import (
    SurveyFormTemplate,
    SurveyQuestion,
    FeedbackSurveyDispatch,
    SurveyStatus,
    SurveyDeliveryChannel,
    FeedbackResponseSubmission,
    CustomerFeedbackRecord,
    FeedbackAnalysisSummary,
    FeedbackTriggerCheck,
    CreateFeedbackSurveyRequest
)
from app.services.account_repository import account_repo

logger = logging.getLogger("revora.feedback")

class FeedbackRepository:
    """
    Backend repository for the Feedback Form & Survey Loop feature:
    - Stores survey templates, survey dispatches, submissions, and analysis summaries.
    - Connects to MongoDB when available with in-memory fallback.
    - Connects to existing account repository and data.
    """
    def __init__(self):
        self._templates: Dict[str, SurveyFormTemplate] = {}
        self._surveys: Dict[str, FeedbackSurveyDispatch] = {}
        self._responses: Dict[str, CustomerFeedbackRecord] = {}
        self.db = None
        self._init_mongodb()
        self._init_default_templates()
        self._init_seed_data()

    def _init_mongodb(self):
        if settings.MONGODB_URI:
            try:
                from pymongo import MongoClient
                client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500, socketTimeoutMS=1500)
                client.admin.command('ping')
                self.db = client[settings.MONGODB_DB_NAME]
                logger.info("FeedbackRepository connected to MongoDB successfully")
            except Exception as e:
                logger.warning(f"FeedbackRepository MongoDB fallback to memory: {e}")
                self.db = None

    def _init_default_templates(self):
        tpl1 = SurveyFormTemplate(
            id="survey-tpl-churn-early-warning",
            name="Early Warning & Engagement Check",
            description="Designed for accounts exhibiting risk signals, usage decline, or approaching renewal.",
            target_risk_level="high",
            questions=[
                SurveyQuestion(
                    id="q-sat",
                    question_type="rating_1_10",
                    prompt="On a scale of 1 to 10, how satisfied are you with Revora platform value so far?",
                    category="satisfaction",
                    required=True
                ),
                SurveyQuestion(
                    id="q-usage-trend",
                    question_type="multichoice",
                    prompt="How has your team's day-to-day product usage changed recently?",
                    category="product_usage",
                    options=[
                        "Usage has increased significantly",
                        "Usage is steady / as expected",
                        "Usage has dropped slightly due to internal workload",
                        "Usage dropped significantly due to workflow blockers",
                        "We paused active rollout temporarily"
                    ],
                    required=True
                ),
                SurveyQuestion(
                    id="q-blocker",
                    question_type="multichoice",
                    prompt="Are you experiencing any primary blockers or friction?",
                    category="blockers",
                    options=[
                        "No blockers, going smoothly",
                        "Authentication / SSO or permissions issues",
                        "Data latency or API integration bugs",
                        "Lack of team training / onboarding guidance",
                        "Contract or pricing concerns with executive sponsor"
                    ],
                    required=True
                ),
                SurveyQuestion(
                    id="q-unresolved",
                    question_type="text",
                    prompt="Please describe any open issues or friction your team is facing:",
                    category="blockers",
                    required=False
                ),
                SurveyQuestion(
                    id="q-feature-request",
                    question_type="text",
                    prompt="What is the #1 feature improvement or support you need from our team right now?",
                    category="feature_requests",
                    required=False
                )
            ]
        )

        tpl2 = SurveyFormTemplate(
            id="survey-tpl-qbr-pulse",
            name="Quarterly Executive Pulse",
            description="General relationship and value confirmation for steady-state accounts.",
            target_risk_level="all",
            questions=[
                SurveyQuestion(
                    id="q-pulse-sat",
                    question_type="rating_1_10",
                    prompt="How likely are you to recommend Revora to another team?",
                    category="satisfaction",
                    required=True
                ),
                SurveyQuestion(
                    id="q-pulse-comments",
                    question_type="text",
                    prompt="What has had the most positive impact on your workflow?",
                    category="feature_requests",
                    required=False
                )
            ]
        )

        self._templates[tpl1.id] = tpl1
        self._templates[tpl2.id] = tpl2

    def _init_seed_data(self):
        now = datetime.utcnow()
        four_days_ago = (now - timedelta(days=4)).isoformat()
        three_days_ago = (now - timedelta(days=3)).isoformat()
        two_days_ago = (now - timedelta(days=2)).isoformat()
        yesterday = (now - timedelta(days=1)).isoformat()

        # ==========================================
        # 1. Acme Technologies (acc-101) — Detractor (SSO Authentication Blocker)
        # ==========================================
        survey_code_1 = "rev-fb-acme-101"
        survey_1 = FeedbackSurveyDispatch(
            id="srv-101",
            survey_code=survey_code_1,
            account_id="acc-101",
            account_name="Acme Technologies",
            contact_id="cnt-101",
            recipient_email="david.kim@acmetech.io",
            recipient_name="David Kim",
            delivery_channel=SurveyDeliveryChannel.EMAIL,
            template_id="survey-tpl-churn-early-warning",
            status=SurveyStatus.COMPLETED,
            created_at=three_days_ago,
            sent_at=three_days_ago,
            completed_at=two_days_ago,
            trigger_risk_score=78,
            trigger_risk_level="critical",
            trigger_factors=["Severe drop in weekly active licenses: -42.0%", "Critical renewal window: 43 days remaining"],
            form_url=f"/feedback/{survey_code_1}",
            custom_intro="Hi David, we noticed your team's API activity shifted recently and want to ensure you have full support ahead of next month."
        )
        self._surveys[survey_1.id] = survey_1

        resp_sub_1 = FeedbackResponseSubmission(
            survey_code=survey_code_1,
            account_id="acc-101",
            respondent_email="david.kim@acmetech.io",
            respondent_name="David Kim",
            satisfaction_score=4,
            usage_trend_self_report="Usage dropped significantly due to workflow blockers",
            primary_blocker="Authentication / SSO or permissions issues",
            unresolved_issues="Our data team is completely blocked by Okta certificate handshake validation errors. We cannot deploy to 50 engineers until IT security signs off.",
            feature_improvement_request="Automated SAML XML metadata verification and live technical onboarding assistance.",
            additional_comments="We like the core platform, but contract renewal in 43 days depends strictly on resolving this authentication bottleneck.",
            submitted_at=two_days_ago
        )

        analysis_1 = FeedbackAnalysisSummary(
            id="fba-101",
            response_id="fbr-101",
            account_id="acc-101",
            account_name="Acme Technologies",
            classified_churn_reason="adoption_blocker",
            urgency_level="critical",
            sentiment_label="frustrated",
            sentiment_interpretation="Customer leadership conveys distinct dissatisfaction and urgency linked directly to enterprise SSO configuration barriers blocking user expansion.",
            key_blockers=["Okta SAML certificate handshake validation error", "IT security approval hold on 50 licenses"],
            improvement_requests=["Direct engineering session to assist SAML configuration", "Clearer SSO validation tools"],
            recommended_retention_action="Schedule immediate unblocker workshop with Solutions Engineer Marcus Vance to resolve SAML certificate handshake.",
            action_type="training_session",
            evidence_connection=["sig-101", "sig-102"],
            generated_signal_id="sig-fb-101",
            analyzed_at=two_days_ago,
            rule_notice="Sentiment is treated as an interpretation, not a verified fact about internal mental state."
        )

        record_1 = CustomerFeedbackRecord(
            id="fbr-101",
            survey_code=survey_code_1,
            account_id="acc-101",
            account_name="Acme Technologies",
            recipient_email="david.kim@acmetech.io",
            recipient_name="David Kim",
            submission=resp_sub_1,
            analysis=analysis_1,
            created_at=three_days_ago,
            submitted_at=two_days_ago,
            timeline_event_id="evt-fb-101"
        )
        self._responses[record_1.id] = record_1

        # ==========================================
        # 2. HyperScale Labs (acc-104) — Detractor (Kafka Webhook Latency & Uptime)
        # ==========================================
        survey_code_104 = "rev-fb-hyperscale-104"
        survey_104 = FeedbackSurveyDispatch(
            id="srv-104",
            survey_code=survey_code_104,
            account_id="acc-104",
            account_name="HyperScale Labs",
            contact_id="cnt-104",
            recipient_email="elena.rostova@hyperscalelabs.co",
            recipient_name="Elena Rostova (VP of Infrastructure)",
            delivery_channel=SurveyDeliveryChannel.EMAIL,
            template_id="survey-tpl-churn-early-warning",
            status=SurveyStatus.COMPLETED,
            created_at=four_days_ago,
            sent_at=four_days_ago,
            completed_at=two_days_ago,
            trigger_risk_score=80,
            trigger_risk_level="critical",
            trigger_factors=["Telemetry connection latency exceeded 800ms", "Unanswered CSM outreach over 21 days"],
            form_url=f"/feedback/{survey_code_104}",
            custom_intro="Hi Elena, checking in regarding webhook stability and infrastructure reliability for HyperScale Labs."
        )
        self._surveys[survey_104.id] = survey_104

        resp_sub_104 = FeedbackResponseSubmission(
            survey_code=survey_code_104,
            account_id="acc-104",
            respondent_email="elena.rostova@hyperscalelabs.co",
            respondent_name="Elena Rostova",
            satisfaction_score=3,
            usage_trend_self_report="Usage dropped significantly due to workflow blockers",
            primary_blocker="Data latency or API integration bugs",
            unresolved_issues="Kafka webhook ingestion experienced repeated 504 timeouts during peak traffic on Tuesday. We dropped approximately 15% of event payloads during our batch processing window.",
            feature_improvement_request="Dedicated enterprise streaming buffer, custom Kafka cluster endpoints, and guaranteed 99.99% uptime SLA.",
            additional_comments="Our CTO has paused deployment to additional customer accounts until webhook reliability reaches five nines.",
            submitted_at=two_days_ago
        )

        analysis_104 = FeedbackAnalysisSummary(
            id="fba-104",
            response_id="fbr-104",
            account_id="acc-104",
            account_name="HyperScale Labs",
            classified_churn_reason="technical_bugs",
            urgency_level="critical",
            sentiment_label="frustrated",
            sentiment_interpretation="Engineering executive expresses serious concern regarding infrastructure reliability and telemetry drops during high-volume periods.",
            key_blockers=["Kafka 504 timeout under peak load", "Telemetry event loss during batch ingestion"],
            improvement_requests=["Dedicated webhook buffer endpoint", "99.99% enterprise uptime SLA"],
            recommended_retention_action="Escalate API latency ticket #842 to Senior Systems Architect; deliver root-cause post-mortem within 24 hours.",
            action_type="bug_escalation",
            evidence_connection=["sig-104-1", "sig-104-2"],
            generated_signal_id="sig-fb-104",
            analyzed_at=two_days_ago,
            rule_notice="Sentiment is treated as an interpretation, not a verified fact about internal mental state."
        )

        record_104 = CustomerFeedbackRecord(
            id="fbr-104",
            survey_code=survey_code_104,
            account_id="acc-104",
            account_name="HyperScale Labs",
            recipient_email="elena.rostova@hyperscalelabs.co",
            recipient_name="Elena Rostova",
            submission=resp_sub_104,
            analysis=analysis_104,
            created_at=four_days_ago,
            submitted_at=two_days_ago,
            timeline_event_id="evt-fb-104"
        )
        self._responses[record_104.id] = record_104

        # ==========================================
        # 3. Apex Fintech Group (acc-106) — Passive (CFO SaaS Budget Reduction)
        # ==========================================
        survey_code_106 = "rev-fb-apex-106"
        survey_106 = FeedbackSurveyDispatch(
            id="srv-106",
            survey_code=survey_code_106,
            account_id="acc-106",
            account_name="Apex Fintech Group",
            contact_id="cnt-106",
            recipient_email="marcus.sterling@apexfintech.com",
            recipient_name="Marcus Sterling (Chief Risk Officer)",
            delivery_channel=SurveyDeliveryChannel.EMAIL,
            template_id="survey-tpl-churn-early-warning",
            status=SurveyStatus.COMPLETED,
            created_at=three_days_ago,
            sent_at=three_days_ago,
            completed_at=yesterday,
            trigger_risk_score=80,
            trigger_risk_level="critical",
            trigger_factors=["Upcoming contract renewal in 38 days", "Executive sponsor departed organization"],
            form_url=f"/feedback/{survey_code_106}",
            custom_intro="Hi Marcus, wanted to check in on overall value realization ahead of your annual contract renewal cycle."
        )
        self._surveys[survey_106.id] = survey_106

        resp_sub_106 = FeedbackResponseSubmission(
            survey_code=survey_code_106,
            account_id="acc-106",
            respondent_email="marcus.sterling@apexfintech.com",
            respondent_name="Marcus Sterling",
            satisfaction_score=5,
            usage_trend_self_report="Usage dropped slightly due to internal workload",
            primary_blocker="Contract or pricing concerns with executive sponsor",
            unresolved_issues="Our CFO has instituted a department-wide 20% SaaS spend reduction. The current proposal is 30% higher than last year without sufficient volume justification for procurement.",
            feature_improvement_request="Automated financial compliance audit exports and volume-based tiered seat pricing.",
            additional_comments="We value the platform insights, but procurement requires clear ROI justification before approving the renewal.",
            submitted_at=yesterday
        )

        analysis_106 = FeedbackAnalysisSummary(
            id="fba-106",
            response_id="fbr-106",
            account_id="acc-106",
            account_name="Apex Fintech Group",
            classified_churn_reason="pricing",
            urgency_level="high",
            sentiment_label="at_risk",
            sentiment_interpretation="Leadership indicates pricing sensitivity driven by executive budget constraints rather than functional platform deficiencies.",
            key_blockers=["CFO 20% SaaS spend reduction mandate", "Lack of documented executive ROI brief for procurement"],
            improvement_requests=["Volume-tiered pricing model", "Automated compliance audit reports"],
            recommended_retention_action="Coordinate executive business review (QBR) with VP of Sales to present quantifiable ROI metrics and tiered multi-year contract options.",
            action_type="executive_sponsor_call",
            evidence_connection=["sig-106-1"],
            generated_signal_id="sig-fb-106",
            analyzed_at=yesterday,
            rule_notice="Sentiment is treated as an interpretation, not a verified fact about internal mental state."
        )

        record_106 = CustomerFeedbackRecord(
            id="fbr-106",
            survey_code=survey_code_106,
            account_id="acc-106",
            account_name="Apex Fintech Group",
            recipient_email="marcus.sterling@apexfintech.com",
            recipient_name="Marcus Sterling",
            submission=resp_sub_106,
            analysis=analysis_106,
            created_at=three_days_ago,
            submitted_at=yesterday,
            timeline_event_id="evt-fb-106"
        )
        self._responses[record_106.id] = record_106

        # ==========================================
        # 4. CloudNova Technologies (acc-102) — Passive (Agent Onboarding & Training)
        # ==========================================
        survey_code_102 = "rev-fb-cloudnova-102"
        survey_102 = FeedbackSurveyDispatch(
            id="srv-102",
            survey_code=survey_code_102,
            account_id="acc-102",
            account_name="CloudNova Technologies",
            contact_id="cnt-102",
            recipient_email="sarah.chen@cloudnova.io",
            recipient_name="Sarah Chen (Head of Customer Operations)",
            delivery_channel=SurveyDeliveryChannel.EMAIL,
            template_id="survey-tpl-churn-early-warning",
            status=SurveyStatus.COMPLETED,
            created_at=four_days_ago,
            sent_at=four_days_ago,
            completed_at=yesterday,
            trigger_risk_score=67,
            trigger_risk_level="high",
            trigger_factors=["38% drop in active daily users", "Low feature adoption in reporting module"],
            form_url=f"/feedback/{survey_code_102}",
            custom_intro="Hi Sarah, we'd love to gather feedback on your team's experience with the recent dashboard release."
        )
        self._surveys[survey_102.id] = survey_102

        resp_sub_102 = FeedbackResponseSubmission(
            survey_code=survey_code_102,
            account_id="acc-102",
            respondent_email="sarah.chen@cloudnova.io",
            respondent_name="Sarah Chen",
            satisfaction_score=6,
            usage_trend_self_report="We paused active rollout temporarily",
            primary_blocker="Lack of team training / onboarding guidance",
            unresolved_issues="Our 15 newly joined support agents find the dashboard setup unintuitive without guided workflows. They are spending too much time figuring out alert filters.",
            feature_improvement_request="Self-paced interactive video tutorials, role-based onboarding walkthroughs, and customized shortcut cheatsheets.",
            additional_comments="The tool has immense potential once the agents get comfortable. A team training session would fix this immediately.",
            submitted_at=yesterday
        )

        analysis_102 = FeedbackAnalysisSummary(
            id="fba-102",
            response_id="fbr-102",
            account_id="acc-102",
            account_name="CloudNova Technologies",
            classified_churn_reason="poor_onboarding",
            urgency_level="medium",
            sentiment_label="neutral",
            sentiment_interpretation="Customer operations manager highlights team enablement and user training gaps as the primary friction point impeding full platform adoption.",
            key_blockers=["Unassisted onboarding for 15 new support agents", "Unfamiliarity with alert filter configuration"],
            improvement_requests=["Interactive team enablement workshop", "Step-by-step role guides"],
            recommended_retention_action="Host live 45-minute interactive onboarding workshop for the customer support team and deliver workflow quick-reference cards.",
            action_type="training_session",
            evidence_connection=["sig-102-1"],
            generated_signal_id="sig-fb-102",
            analyzed_at=yesterday,
            rule_notice="Sentiment is treated as an interpretation, not a verified fact about internal mental state."
        )

        record_102 = CustomerFeedbackRecord(
            id="fbr-102",
            survey_code=survey_code_102,
            account_id="acc-102",
            account_name="CloudNova Technologies",
            recipient_email="sarah.chen@cloudnova.io",
            recipient_name="Sarah Chen",
            submission=resp_sub_102,
            analysis=analysis_102,
            created_at=four_days_ago,
            submitted_at=yesterday,
            timeline_event_id="evt-fb-102"
        )
        self._responses[record_102.id] = record_102

        # ==========================================
        # 5. OmniHealth Solutions (acc-105) — Promoter (Healthy, High Value, Expansion)
        # ==========================================
        survey_code_105 = "rev-fb-omnihealth-105"
        survey_105 = FeedbackSurveyDispatch(
            id="srv-105",
            survey_code=survey_code_105,
            account_id="acc-105",
            account_name="OmniHealth Solutions",
            contact_id="cnt-105",
            recipient_email="dr.james.wilson@omnihealth.org",
            recipient_name="Dr. James Wilson (Chief Medical Officer)",
            delivery_channel=SurveyDeliveryChannel.EMAIL,
            template_id="survey-tpl-qbr-pulse",
            status=SurveyStatus.COMPLETED,
            created_at=three_days_ago,
            sent_at=three_days_ago,
            completed_at=yesterday,
            trigger_risk_score=0,
            trigger_risk_level="low",
            trigger_factors=["Routine quarterly relationship pulse"],
            form_url=f"/feedback/{survey_code_105}",
            custom_intro="Hi Dr. Wilson, checking in for our regular quarterly feedback pulse on platform value and clinical operations."
        )
        self._surveys[survey_105.id] = survey_105

        resp_sub_105 = FeedbackResponseSubmission(
            survey_code=survey_code_105,
            account_id="acc-105",
            respondent_email="dr.james.wilson@omnihealth.org",
            respondent_name="Dr. James Wilson",
            satisfaction_score=9,
            usage_trend_self_report="Usage has increased significantly",
            primary_blocker="No blockers, going smoothly",
            unresolved_issues="None. System has been exceptionally stable and reliable. Patient record triage throughput increased by 35% across our hospital network.",
            feature_improvement_request="Automated quarterly clinical governance PDF export for hospital board presentations.",
            additional_comments="We are extremely satisfied and plan to recommend extending Revora to our 3 regional partner facilities next quarter.",
            submitted_at=yesterday
        )

        analysis_105 = FeedbackAnalysisSummary(
            id="fba-105",
            response_id="fbr-105",
            account_id="acc-105",
            account_name="OmniHealth Solutions",
            classified_churn_reason="feature_gap",
            urgency_level="low",
            sentiment_label="satisfied",
            sentiment_interpretation="Executive sponsor reports outstanding satisfaction, strong operational ROI, and intent to expand coverage across affiliated clinics.",
            key_blockers=[],
            improvement_requests=["Automated clinical governance PDF report export"],
            recommended_retention_action="Deliver roadmap preview for automated clinical PDF reports and initiate expansion discussions for pediatric regional division.",
            action_type="csm_intervention",
            evidence_connection=[],
            generated_signal_id="sig-fb-105",
            analyzed_at=yesterday,
            rule_notice="Sentiment is treated as an interpretation, not a verified fact about internal mental state."
        )

        record_105 = CustomerFeedbackRecord(
            id="fbr-105",
            survey_code=survey_code_105,
            account_id="acc-105",
            account_name="OmniHealth Solutions",
            recipient_email="dr.james.wilson@omnihealth.org",
            recipient_name="Dr. James Wilson",
            submission=resp_sub_105,
            analysis=analysis_105,
            created_at=three_days_ago,
            submitted_at=yesterday,
            timeline_event_id="evt-fb-105"
        )
        self._responses[record_105.id] = record_105

        # ==========================================
        # 6. Vortex Analytics (acc-103) — Active/Pending Survey (Ready to fill out live!)
        # ==========================================
        survey_code_103 = "rev-fb-vortex-103"
        survey_103 = FeedbackSurveyDispatch(
            id="srv-103",
            survey_code=survey_code_103,
            account_id="acc-103",
            account_name="Vortex Analytics",
            contact_id="cnt-103",
            recipient_email="lisa.ray@vortexanalytics.com",
            recipient_name="Lisa Ray (Head of Product Analytics)",
            delivery_channel=SurveyDeliveryChannel.EMAIL,
            template_id="survey-tpl-churn-early-warning",
            status=SurveyStatus.SENT,
            created_at=yesterday,
            sent_at=yesterday,
            trigger_risk_score=15,
            trigger_risk_level="low",
            trigger_factors=["Approaching mid-contract check-in window"],
            form_url=f"/feedback/{survey_code_103}",
            custom_intro="Hi Lisa, we'd appreciate 2 minutes of your thoughts on your team's analytics workflow with Revora."
        )
        self._surveys[survey_103.id] = survey_103

        if self.db is not None:
            try:
                for s in self._surveys.values():
                    self.db.surveys.update_one({"id": s.id}, {"$setOnInsert": s.model_dump()}, upsert=True)
                for r in self._responses.values():
                    self.db.feedback_records.update_one({"id": r.id}, {"$setOnInsert": r.model_dump()}, upsert=True)
            except Exception as e:
                logger.warning(f"Error seeding MongoDB feedback data: {e}")

    # --- Survey Template operations ---
    def get_templates(self) -> List[SurveyFormTemplate]:
        return list(self._templates.values())

    def get_template_by_id(self, template_id: str) -> Optional[SurveyFormTemplate]:
        return self._templates.get(template_id)

    # --- Survey Dispatch operations ---
    def list_surveys(self, account_id: Optional[str] = None, status: Optional[str] = None) -> List[FeedbackSurveyDispatch]:
        if self.db is not None:
            try:
                query = {}
                if account_id:
                    query["account_id"] = account_id
                if status:
                    query["status"] = status
                docs = list(self.db.surveys.find(query, {"_id": 0}))
                if docs:
                    return [FeedbackSurveyDispatch(**d) for d in docs]
            except Exception as e:
                logger.warning(f"MongoDB list_surveys failed, reading memory: {e}")

        surveys = list(self._surveys.values())
        if account_id:
            surveys = [s for s in surveys if s.account_id == account_id]
        if status:
            surveys = [s for s in surveys if s.status.value == status or s.status == status]
        return sorted(surveys, key=lambda s: s.created_at, reverse=True)

    def get_survey_by_id(self, survey_id: str) -> Optional[FeedbackSurveyDispatch]:
        if self.db is not None:
            try:
                doc = self.db.surveys.find_one({"id": survey_id}, {"_id": 0})
                if doc:
                    return FeedbackSurveyDispatch(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_survey_by_id failed: {e}")
        return self._surveys.get(survey_id)

    def get_survey_by_code(self, survey_code: str) -> Optional[FeedbackSurveyDispatch]:
        if self.db is not None:
            try:
                doc = self.db.surveys.find_one({"survey_code": survey_code}, {"_id": 0})
                if doc:
                    return FeedbackSurveyDispatch(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_survey_by_code failed: {e}")

        for s in self._surveys.values():
            if s.survey_code == survey_code:
                return s
        return None

    def create_survey(self, req: CreateFeedbackSurveyRequest) -> FeedbackSurveyDispatch:
        acc = account_repo.get_account_by_id(req.account_id)
        if not acc:
            raise ValueError(f"Account {req.account_id} not found")

        # Resolve recipient
        recipient_email = req.recipient_email
        recipient_name = req.recipient_name
        contact_id = req.contact_id

        if not recipient_email:
            contacts = account_repo.get_account_contacts(req.account_id)
            if contacts:
                primary = next((c for c in contacts if c.is_primary), contacts[0])
                recipient_email = primary.email
                recipient_name = primary.name
                contact_id = primary.id
            else:
                recipient_email = f"contact@{acc.domain or 'customer.com'}"
                recipient_name = acc.csm_owner or "Customer Champion"

        survey_id = f"srv-{uuid.uuid4().hex[:8]}"
        survey_code = f"rev-fb-{uuid.uuid4().hex[:6]}"
        now = datetime.utcnow().isoformat()

        dispatch = FeedbackSurveyDispatch(
            id=survey_id,
            survey_code=survey_code,
            account_id=acc.id,
            account_name=acc.name,
            contact_id=contact_id,
            recipient_email=recipient_email,
            recipient_name=recipient_name or "Valued Customer",
            delivery_channel=req.delivery_channel,
            template_id=req.template_id or "survey-tpl-churn-early-warning",
            status=SurveyStatus.SENT,
            created_at=now,
            sent_at=now,
            trigger_risk_score=acc.risk_score,
            trigger_risk_level=acc.risk_level.value if hasattr(acc.risk_level, 'value') else str(acc.risk_level),
            trigger_factors=getattr(acc, 'contributing_factors', []) if hasattr(acc, 'contributing_factors') else [],
            form_url=f"/feedback/{survey_code}",
            custom_intro=req.custom_intro or f"Hi {recipient_name}, we'd value 2 minutes of your feedback regarding your experience with Revora."
        )

        self._surveys[dispatch.id] = dispatch
        if self.db is not None:
            try:
                self.db.surveys.insert_one(dispatch.model_dump())
            except Exception as e:
                logger.error(f"Error persisting survey to MongoDB: {e}")

        return dispatch

    # --- Feedback Submissions & Analysis ---
    def list_feedback_records(self, account_id: Optional[str] = None) -> List[CustomerFeedbackRecord]:
        if self.db is not None:
            try:
                query = {}
                if account_id:
                    query["account_id"] = account_id
                docs = list(self.db.feedback_records.find(query, {"_id": 0}))
                if docs:
                    return [CustomerFeedbackRecord(**d) for d in docs]
            except Exception as e:
                logger.warning(f"MongoDB list_feedback_records failed, reading memory: {e}")

        records = list(self._responses.values())
        if account_id:
            records = [r for r in records if r.account_id == account_id]
        return sorted(records, key=lambda r: r.submitted_at, reverse=True)

    def get_feedback_record_by_id(self, record_id: str) -> Optional[CustomerFeedbackRecord]:
        if self.db is not None:
            try:
                doc = self.db.feedback_records.find_one({"id": record_id}, {"_id": 0})
                if doc:
                    return CustomerFeedbackRecord(**doc)
            except Exception as e:
                logger.warning(f"MongoDB get_feedback_record_by_id failed: {e}")
        return self._responses.get(record_id)

    def save_feedback_record(self, record: CustomerFeedbackRecord):
        self._responses[record.id] = record
        if self.db is not None:
            try:
                self.db.feedback_records.replace_one(
                    {"id": record.id},
                    record.model_dump(),
                    upsert=True
                )
            except Exception as e:
                logger.error(f"MongoDB saving feedback record failed: {e}")

    def update_survey_status(self, survey_code: str, status: SurveyStatus, completed_at: Optional[str] = None):
        survey = self.get_survey_by_code(survey_code)
        if survey:
            survey.status = status
            if completed_at:
                survey.completed_at = completed_at
            self._surveys[survey.id] = survey
            if self.db is not None:
                try:
                    self.db.surveys.update_one(
                        {"survey_code": survey_code},
                        {"$set": {"status": status.value, "completed_at": completed_at}}
                    )
                except Exception as e:
                    logger.error(f"MongoDB update survey status failed: {e}")

    def get_responses_by_account(self, account_id: str) -> List[CustomerFeedbackRecord]:
        return self.list_feedback_records(account_id=account_id)

feedback_repo = FeedbackRepository()
