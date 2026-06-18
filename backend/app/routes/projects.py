from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Project, User
from app.schemas import ProjectCreate, ProjectDetailResponse, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_response(project: Project, include_key: bool = False) -> ProjectResponse | ProjectDetailResponse:
    data = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "system_prompt": project.system_prompt,
        "llm_provider": project.llm_provider,
        "llm_base_url": project.llm_base_url,
        "llm_model": project.llm_model,
        "has_api_key": bool(project.llm_api_key),
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }
    if include_key:
        return ProjectDetailResponse(**data, llm_api_key=project.llm_api_key)
    return ProjectResponse(**data)


def _get_owned_project(project_id: int, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectResponse])
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.updated_at.desc()).all()
    return [_to_response(p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(user_id=current_user.id, **payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return _to_response(project)


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    return _to_response(project, include_key=True)


@router.patch("/{project_id}", response_model=ProjectDetailResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return _to_response(project, include_key=True)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    db.delete(project)
    db.commit()
