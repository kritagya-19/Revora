from app.services.proposal_repository import proposal_repo

def test_audit_logs_recording_and_filtering():
    # Record test audit event
    proposal_repo._record_audit(
        account_id="acc-101",
        proposal_id="prop-test-1",
        event_type="test_audit_event",
        actor="system_test",
        details={"status": "ok"}
    )

    logs = proposal_repo.get_all_audit_logs(limit=50)
    assert len(logs) > 0
    assert any(log["event_type"] == "test_audit_event" for log in logs)

    # Filter by account
    acc_logs = proposal_repo.get_audit_logs_for_account("acc-101")
    assert len(acc_logs) > 0
    assert all(log["account_id"] == "acc-101" for log in acc_logs)
