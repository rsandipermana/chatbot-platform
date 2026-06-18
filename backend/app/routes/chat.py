import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Message, Project, User
from app.schemas import ChatRequest, ChatResponse, MessageResponse
from app.services.llm import chat_completion, chat_completion_stream

router = APIRouter(prefix="/projects/{project_id}", tags=["chat"])


def _get_owned_project(project_id: int, user: User, db: Session) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/messages", response_model=list[MessageResponse])
def list_messages(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_project(project_id, current_user, db)
    return (
        db.query(Message)
        .filter(Message.project_id == project_id)
        .order_by(Message.created_at.asc())
        .all()
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    project_id: int,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    history = (
        db.query(Message)
        .filter(Message.project_id == project_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    user_msg = Message(project_id=project_id, role="user", content=payload.message)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    reply = await chat_completion(project, history, payload.message)

    assistant_msg = Message(project_id=project_id, role="assistant", content=reply)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return ChatResponse(
        user_message=MessageResponse.model_validate(user_msg),
        assistant_message=MessageResponse.model_validate(assistant_msg),
    )


@router.post("/chat/stream")
async def chat_stream(
    project_id: int,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    history = (
        db.query(Message)
        .filter(Message.project_id == project_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    user_msg = Message(project_id=project_id, role="user", content=payload.message)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    async def event_generator():
        full = []
        try:
            async for token in chat_completion_stream(project, history, payload.message):
                full.append(token)
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except HTTPException as e:
            yield f"data: {json.dumps({'type': 'error', 'content': e.detail})}\n\n"
            return

        assistant_text = "".join(full)
        assistant_msg = Message(project_id=project_id, role="assistant", content=assistant_text)
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)
        yield f"data: {json.dumps({'type': 'done', 'message': MessageResponse.model_validate(assistant_msg).model_dump(mode='json')})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
