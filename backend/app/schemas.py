from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import LLMProvider


# Auth
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Projects
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    system_prompt: str | None = None
    llm_provider: LLMProvider = LLMProvider.openai
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model: str = "gpt-4o-mini"


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    system_prompt: str | None = None
    llm_provider: LLMProvider | None = None
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model: str | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    system_prompt: str | None
    llm_provider: LLMProvider
    llm_base_url: str | None
    llm_model: str
    has_api_key: bool = False
    created_at: datetime
    updated_at: datetime


class ProjectDetailResponse(ProjectResponse):
    llm_api_key: str | None = None


# Prompts
class PromptCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)


class PromptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    content: str
    created_at: datetime


# Messages
class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    role: str
    content: str
    created_at: datetime


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)


class ChatResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse


# Files
class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    filename: str
    openai_file_id: str | None
    size_bytes: int | None
    created_at: datetime
