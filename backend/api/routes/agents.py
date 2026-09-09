import uuid
from typing import Any
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix='/api/v1/agents', tags=['Agent Observability & Traces'])


class AgentRunTraceResponse(BaseModel):
    id: str
    session_id: str
    query: str
    intent: str | None
    plan: dict[str, Any] | None
    tool_calls: list[dict[str, Any]] | None
    sources: list[str]
    evidence_count: int
    created_at: str | None


@router.get('/runs/{run_id}', response_model=AgentRunTraceResponse, description="Inspect safe agent run execution traces and tool calls.")
async def get_agent_run_trace(run_id: str, request: Request):
    repo = getattr(request.app.state, 'repository', None)
    if not repo:
        raise HTTPException(status_code=503, detail="Database repository unavailable")

    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format for run_id")

    row = await repo.get_agent_run(run_uuid)
    if not row:
        raise HTTPException(status_code=404, detail="Agent run trace not found")

    evidence_list = row.get('evidence') or []
    sources = sorted(list({e.get('source') for e in evidence_list if isinstance(e, dict) and e.get('source')}))

    # Sanitize tool calls to ensure no sensitive internal fields or credentials leaked
    safe_tool_calls = []
    for call in row.get('tool_calls') or []:
        if isinstance(call, dict):
            safe_tool_calls.append({
                'task_id': call.get('task_id'),
                'agent': call.get('agent'),
                'action': call.get('action'),
                'status': call.get('status'),
                'duration_ms': call.get('duration_ms'),
            })

    return AgentRunTraceResponse(
        id=str(row['id']),
        session_id=row['session_id'],
        query=row['query'],
        intent=row.get('intent'),
        plan=row.get('plan'),
        tool_calls=safe_tool_calls,
        sources=sources,
        evidence_count=len(evidence_list),
        created_at=row['created_at'].isoformat() if row.get('created_at') else None,
    )
