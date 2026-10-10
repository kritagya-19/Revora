from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import ProposedTask, CreateTaskRequest, UpdateTaskRequest
from app.services.task_repository import task_repo

router = APIRouter()

@router.get("", response_model=List[ProposedTask])
def list_tasks(
    account_id: Optional[str] = Query(None, description="Filter tasks by canonical account ID"),
    status: Optional[str] = Query(None, description="Filter tasks by status (e.g. pending, completed)")
):
    """
    GET /api/tasks
    Retrieves all tasks across accounts or filtered by account_id and status.
    """
    return task_repo.get_all_tasks(account_id=account_id, status=status)

@router.get("/account/{account_id}", response_model=List[ProposedTask])
def list_tasks_for_account(account_id: str):
    """
    GET /api/tasks/account/{account_id}
    Retrieves all follow-up tasks linked to a specific account.
    """
    return task_repo.get_all_tasks(account_id=account_id)

@router.get("/{task_id}", response_model=ProposedTask)
def get_task_by_id(task_id: str):
    """
    GET /api/tasks/{task_id}
    Retrieves a single task by ID.
    """
    task = task_repo.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return task

@router.post("", response_model=ProposedTask, status_code=201)
def create_new_task(req: CreateTaskRequest):
    """
    POST /api/tasks
    Creates a new follow-up task and records audit event in MongoDB.
    """
    try:
        return task_repo.create_task(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{task_id}", response_model=ProposedTask)
def update_task_detail(task_id: str, req: UpdateTaskRequest):
    """
    PATCH /api/tasks/{task_id}
    Updates status, due date, assignee, or priority for a task.
    """
    try:
        return task_repo.update_task(task_id, req)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
