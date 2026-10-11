import { useState, useEffect } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Star, 
  MessageSquare, 
  ShieldAlert, 
  Sparkles, 
  Clock, 
  Building2, 
  User, 
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import { fetchPublicSurveyForm, submitCustomerFeedback } from '../services/api';
import type { PublicSurveyFormData, FeedbackResponseSubmission, CustomerFeedbackRecord } from '../types/api';

interface FeedbackFormProps {
  surveyCode?: string;
  onSubmitted?: (record: CustomerFeedbackRecord) => void;
  onClose?: () => void;
  isStandalone?: boolean;
}

export function FeedbackForm({
  surveyCode = 'rev-fb-acme-101',
  onSubmitted,
  onClose,
  isStandalone = false
}: FeedbackFormProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PublicSurveyFormData | null>(null);

  // Form State
  const [satisfactionScore, setSatisfactionScore] = useState<number | null>(7);
  const [usageTrend, setUsageTrend] = useState<string>('Usage is steady / as expected');
  const [primaryBlocker, setPrimaryBlocker] = useState<string>('No blockers, going smoothly');
  const [unresolvedIssues, setUnresolvedIssues] = useState<string>('');
  const [featureRequest, setFeatureRequest] = useState<string>('');
  const [additionalComments, setAdditionalComments] = useState<string>('');
  const [respondentName, setRespondentName] = useState<string>('');
  const [respondentEmail, setRespondentEmail] = useState<string>('');

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<CustomerFeedbackRecord | null>(null);

  useEffect(() => {
    async function loadForm() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPublicSurveyForm(surveyCode);
        setFormData(data);
        setRespondentName(data.recipient_name || '');
        setRespondentEmail(data.recipient_email || '');
      } catch (err: any) {
        setError(err.message || 'Unable to load survey form. It may be expired or invalid.');
      } finally {
        setLoading(false);
      }
    }
    loadForm();
  }, [surveyCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!satisfactionScore) {
      alert('Please select a satisfaction rating between 1 and 10.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const submission: FeedbackResponseSubmission = {
        survey_code: surveyCode,
        account_id: formData?.account_id,
        respondent_name: respondentName,
        respondent_email: respondentEmail,
        satisfaction_score: satisfactionScore,
        usage_trend_self_report: usageTrend,
        primary_blocker: primaryBlocker,
        unresolved_issues: unresolvedIssues,
        feature_improvement_request: featureRequest,
        additional_comments: additionalComments,
        answers: [
          { question_id: 'q-sat', category: 'satisfaction', prompt: 'Satisfaction score', answer_value: satisfactionScore },
          { question_id: 'q-trend', category: 'usage', prompt: 'Usage trend', answer_value: usageTrend },
          { question_id: 'q-blocker', category: 'blockers', prompt: 'Primary blocker', answer_value: primaryBlocker },
          { question_id: 'q-issues', category: 'blockers', prompt: 'Unresolved issues', answer_value: unresolvedIssues },
          { question_id: 'q-feat', category: 'feature_requests', prompt: 'Feature request', answer_value: featureRequest }
        ]
      };

      const result = await submitCustomerFeedback(submission);
      setSubmitSuccess(result);
      if (onSubmitted) {
        onSubmitted(result);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0025AE] flex items-center justify-center mx-auto mb-4 animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-[#020062]">Loading Feedback Survey...</h3>
        <p className="text-sm text-slate-500 mt-1">Retrieving personalized account context and questions.</p>
      </div>
    );
  }

  if (error && !formData) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 sm:p-10 shadow-sm text-center max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Unable to Open Feedback Form</h3>
        <p className="text-sm text-rose-700 mt-2 bg-rose-50 p-3 rounded-lg border border-rose-100">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-xl cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="bg-white border border-emerald-200 rounded-2xl p-8 sm:p-10 shadow-lg text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5 border border-emerald-200">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#020062]">Thank You For Your Feedback!</h2>
        <p className="text-slate-600 mt-2 text-sm max-w-lg mx-auto">
          Your response has been securely recorded and ingested into {submitSuccess.account_name}'s live account timeline.
        </p>

        {/* AI Analysis Preview Banner */}
        {submitSuccess.analysis && (
          <div className="mt-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0025AE] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> AI Feedback Analysis Summary
              </span>
              <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase ${
                submitSuccess.analysis.urgency_level === 'critical' ? 'bg-rose-100 text-rose-800' :
                submitSuccess.analysis.urgency_level === 'high' ? 'bg-amber-100 text-amber-800' :
                'bg-emerald-100 text-emerald-800'
              }`}>
                Urgency: {submitSuccess.analysis.urgency_level}
              </span>
            </div>

            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Classified Churn Driver:</span>{' '}
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                {submitSuccess.analysis.classified_churn_reason.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-800 block mb-1">Recommended Retention Action:</span>
              {submitSuccess.analysis.recommended_retention_action}
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Notice: {submitSuccess.analysis.rule_notice}
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-slate-700 font-semibold text-sm rounded-xl cursor-pointer"
            >
              Close
            </button>
          )}
          <button
            onClick={() => {
              setSubmitSuccess(null);
              setSatisfactionScore(7);
              setUnresolvedIssues('');
              setFeatureRequest('');
              setAdditionalComments('');
            }}
            className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm rounded-xl cursor-pointer shadow-xs"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-[#E2E8F0] rounded-2xl shadow-md overflow-hidden ${isStandalone ? 'max-w-3xl mx-auto my-6' : 'w-full'}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#020062] via-[#0025AE] to-[#2563EB] p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-200 text-xs font-mono uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>{formData?.account_name || 'Customer Account'}</span>
            <span className="text-blue-300">•</span>
            <span>Survey Code: {surveyCode}</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold mt-2 font-headline tracking-tight">
          {formData?.template?.name || 'Customer Experience & Feedback Form'}
        </h2>
        <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-xl">
          {formData?.custom_intro || formData?.template?.description || 'Your insights help our product and customer success teams remove blockers and improve platform value.'}
        </p>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Respondent Info Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" /> Your Name
            </label>
            <input
              type="text"
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              placeholder="e.g., David Kim"
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={respondentEmail}
              onChange={(e) => setRespondentEmail(e.target.value)}
              placeholder="e.g., david.kim@acmetech.io"
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        {/* 1. Overall Satisfaction Rating 1-10 */}
        <div className="space-y-2.5">
          <label className="block text-sm font-bold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              1. Overall platform satisfaction and value so far? <span className="text-rose-500">*</span>
            </span>
            <span className="text-xs font-mono font-bold text-[#0025AE]">
              {satisfactionScore ? `${satisfactionScore} / 10` : 'Select score'}
            </span>
          </label>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
              const isSelected = satisfactionScore === score;
              const isLow = score <= 4;
              const isMid = score >= 5 && score <= 7;
              return (
                <button
                  type="button"
                  key={score}
                  onClick={() => setSatisfactionScore(score)}
                  className={`h-11 rounded-xl font-bold text-sm transition-all cursor-pointer border flex flex-col items-center justify-center ${
                    isSelected
                      ? isLow
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300'
                        : isMid
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                        : 'bg-[#2563EB] text-white border-[#2563EB] shadow-md ring-2 ring-blue-300'
                      : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 border-[#E2E8F0]'
                  }`}
                >
                  <span>{score}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] font-medium text-slate-400 px-1">
            <span>1 = Very Dissatisfied (Churn Risk)</span>
            <span>10 = Extremely Satisfied</span>
          </div>
        </div>

        {/* 2. Usage Trend Self-Report */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-indigo-500" />
            2. How has your team's day-to-day product activity changed recently?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              "Usage has increased significantly",
              "Usage is steady / as expected",
              "Usage has dropped slightly due to internal workload",
              "Usage dropped significantly due to workflow blockers",
              "We paused active rollout temporarily"
            ].map((option) => (
              <label
                key={option}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  usageTrend === option
                    ? 'bg-blue-50/80 border-[#2563EB] text-[#020062] font-semibold ring-1 ring-[#2563EB]/30'
                    : 'bg-white hover:bg-slate-50 border-[#E2E8F0] text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="usageTrend"
                  checked={usageTrend === option}
                  onChange={() => setUsageTrend(option)}
                  className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 3. Primary Blocker */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            3. Are you experiencing any primary blockers or friction?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              "No blockers, going smoothly",
              "Authentication / SSO or permissions issues",
              "Data latency or API integration bugs",
              "Lack of team training / onboarding guidance",
              "Contract or pricing concerns with executive sponsor"
            ].map((option) => (
              <label
                key={option}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  primaryBlocker === option
                    ? 'bg-blue-50/80 border-[#2563EB] text-[#020062] font-semibold ring-1 ring-[#2563EB]/30'
                    : 'bg-white hover:bg-slate-50 border-[#E2E8F0] text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="primaryBlocker"
                  checked={primaryBlocker === option}
                  onChange={() => setPrimaryBlocker(option)}
                  className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 4. Unresolved Issues / Details */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-slate-600" />
            4. Specific unresolved issues or workflow details:
          </label>
          <textarea
            rows={3}
            value={unresolvedIssues}
            onChange={(e) => setUnresolvedIssues(e.target.value)}
            placeholder="e.g., Okta SAML certificate handshake failed validation; 50 engineers cannot log in until resolved..."
            className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        {/* 5. Improvement Request */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-600" />
            5. What is the #1 feature improvement or support you need right now?
          </label>
          <input
            type="text"
            value={featureRequest}
            onChange={(e) => setFeatureRequest(e.target.value)}
            placeholder="e.g., Live solutions engineer working session to configure SAML XML"
            className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        {/* 6. Optional Additional Comments */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-600">
            Additional comments / notes for our CSM team (optional):
          </label>
          <textarea
            rows={2}
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            placeholder="Any other feedback or renewal timeline notes..."
            className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Takes ~2 minutes to complete
          </span>
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-[#F1F5F9] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-xl cursor-pointer flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing & Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
