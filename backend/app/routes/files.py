from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Project, ProjectFile, User
from app.schemas import FileResponse
from app.services.llm import upload_file_to_openai

router = APIRouter(prefix="/projects/{project_id}/files", tags=["files"])


def _get_owned_project(project_id: int, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[FileResponse])
def list_files(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_project(project_id, current_user, db)
    return (
        db.query(ProjectFile)
        .filter(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.created_at.desc())
        .all()
    )


@router.post("", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 20MB)")

    openai_file_id = None
    try:
        openai_file_id = await upload_file_to_openai(project, content, file.filename or "upload")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Upload failed: {e}") from e

    record = ProjectFile(
        project_id=project_id,
        filename=file.filename or "upload",
        openai_file_id=openai_file_id,
        size_bytes=len(content),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    project_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_project(project_id, current_user, db)
    record = db.query(ProjectFile).filter(ProjectFile.id == file_id, ProjectFile.project_id == project_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    db.delete(record)
    db.commit()
