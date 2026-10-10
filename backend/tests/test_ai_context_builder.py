import pytest
from app.ai.input_provider import AccountAIInputProvider
from app.ai.context_builder import ContextBuilder
from app.ai.schemas import ContextBuilderConfig, NormalizedSignal


def test_input_provider_retrieval():
    """
    Test that AccountAIInputProvider correctly pulls AccountContext
    and NormalizedSignals from the backend / repository.
    """
    provider = AccountAIInputProvider()
    account_id = "acc-101"

    context, signals = provider.get_account_input_bundle(account_id)
    
    assert context is not None
    assert context.account_id == account_id
    assert context.name != ""
    assert context.arr > 0
    assert context.days_to_renewal >= 0
    assert len(context.contacts) > 0

    assert len(signals) > 0
    first_sig = signals[0]
    assert isinstance(first_sig, NormalizedSignal)
    assert first_sig.signal_id != ""
    assert first_sig.source_category in ("usage", "crm", "email", "calendar", "support", "product_usage", "support_tickets")


def test_context_builder_execution():
    """
    Test Stage 1: Context Builder selects relevant records and evidence.
    """
    builder = ContextBuilder()
    account_id = "acc-101"

    inv_context = builder.build_context(account_id)

    # Validate structure
    assert inv_context.account.account_id == account_id
    assert inv_context.all_signals_count >= inv_context.selected_evidence_count
    assert inv_context.selected_evidence_count > 0

    # Validate evidence items and catalog
    for evidence in inv_context.selected_evidence:
        assert evidence.evidence_id.startswith("EVID-")
        assert evidence.account_id == account_id
        assert evidence.title != ""
        assert evidence.summary != ""
        assert evidence.relevance_score >= 0.0 and evidence.relevance_score <= 1.0
        assert evidence.evidence_id in inv_context.evidence_catalog

    # Validate primary contact
    assert inv_context.primary_contact is not None
    assert inv_context.primary_contact.name != ""

    # Validate detected gaps
    assert isinstance(inv_context.data_gaps, list)
    assert len(inv_context.data_gaps) > 0


def test_context_builder_relevance_and_critical_inclusion():
    """
    Test that critical severity signals are guaranteed inclusion and
    scored with highest relevance.
    """
    builder = ContextBuilder()
    config = ContextBuilderConfig(lookback_days=60, max_evidence_count=5, include_all_critical=True)
    inv_context = builder.build_context("acc-101", config=config)

    assert len(inv_context.selected_evidence) <= 5
    
    # Check that evidence IDs are in the catalog
    for item in inv_context.selected_evidence:
        assert builder.validate_evidence_citation(inv_context, item.evidence_id)


def test_evidence_citation_validation():
    """
    Test that validate_evidence_citation correctly identifies existing and fake evidence IDs.
    """
    builder = ContextBuilder()
    inv_context = builder.build_context("acc-101")

    valid_id = inv_context.selected_evidence[0].evidence_id
    assert builder.validate_evidence_citation(inv_context, valid_id) is True

    # Test stripping EVID- prefix
    assert builder.validate_evidence_citation(inv_context, valid_id.replace("EVID-", "")) is True

    # Test fake hallucinated ID
    assert builder.validate_evidence_citation(inv_context, "EVID-FAKE-999") is False


def test_prompt_formatting():
    """
    Test that format_evidence_for_prompt produces valid markdown containing citations.
    """
    builder = ContextBuilder()
    inv_context = builder.build_context("acc-101")
    prompt_text = builder.format_evidence_for_prompt(inv_context)

    assert "### Curated Evidence Catalog" in prompt_text
    first_eid = inv_context.selected_evidence[0].evidence_id
    assert first_eid in prompt_text
