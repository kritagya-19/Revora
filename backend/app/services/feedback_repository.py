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
        three_days_ago = (now - timedelta(days=3)).isoformat()
        two_days_ago = (now - timedelta(days=2)).isoformat()

        # Seed Survey 1 for Acme Technologies (acc-101)
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

        # Seed Response for Acme Technologies
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

feedback_repo = FeedbackRepository()
