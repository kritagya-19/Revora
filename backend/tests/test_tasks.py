from app.models.schemas import CreateTaskRequest, UpdateTaskRequest
from app.services.task_repository import task_repo

def test_task_lifecycle():
    # 1. Create a task
    req = CreateTaskRequest(
        account_id="acc-101",
        title="Schedule QBR Review",
        description="Review health metrics with CTO",
        assigned_to="Sarah Jenkins",
        due_date="2026-11-15",
        priority="high",
        evidence_ids=["sig-101"]
    )
    task = task_repo.create_task(req)
    assert task.id.startswith("task-")
    assert task.account_id == "acc-101"
    assert task.title == "Schedule QBR Review"
    assert task.status == "pending"

    # 2. Get task by ID
    fetched = task_repo.get_task_by_id(task.id)
    assert fetched is not None
    assert fetched.title == task.title

    # 3. Update task
    update_req = UpdateTaskRequest(status="completed", priority="medium")
    updated = task_repo.update_task(task.id, update_req)
    assert updated.status == "completed"
    assert updated.priority == "medium"

    # 4. Filter tasks by account
    acc_tasks = task_repo.get_all_tasks(account_id="acc-101")
    assert any(t.id == task.id for t in acc_tasks)
