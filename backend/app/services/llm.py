import json
from collections.abc import AsyncIterator

import httpx
from fastapi import HTTPException, status
from openai import AsyncOpenAI

from app.models import LLMProvider, Message, Project


def _resolve_base_url(project: Project) -> str | None:
    if project.llm_base_url:
        return project.llm_base_url.rstrip("/")
    if project.llm_provider == LLMProvider.openrouter:
        return "https://openrouter.ai/api/v1"
    if project.llm_provider == LLMProvider.openai:
        return None  # default OpenAI
    return project.llm_base_url


def _get_client(project: Project) -> AsyncOpenAI:
    if not project.llm_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LLM API key is not configured. Please set it in project settings.",
        )
    return AsyncOpenAI(
        api_key=project.llm_api_key,
        base_url=_resolve_base_url(project),
    )


def _build_instructions(project: Project) -> str | None:
    parts: list[str] = []
    if project.system_prompt:
        parts.append(project.system_prompt.strip())
    for prompt in project.prompts:
        parts.append(f"[{prompt.name}]\n{prompt.content.strip()}")
    return "\n\n".join(parts) if parts else None


def _history_to_input(messages: list[Message]) -> list[dict]:
    return [{"role": m.role, "content": m.content} for m in messages if m.role in ("user", "assistant")]


async def chat_completion(project: Project, history: list[Message], user_message: str) -> str:
    """Send a chat request using OpenAI Responses API (or compatible endpoint)."""
    client = _get_client(project)
    instructions = _build_instructions(project)
    prior = _history_to_input(history)

    input_messages = prior + [{"role": "user", "content": user_message}]

    try:
        if project.llm_provider == LLMProvider.openrouter:
            return await _openrouter_completion(project, input_messages, instructions)
        return await _openai_responses(client, project.llm_model, input_messages, instructions)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM service error: {str(e)}",
        ) from e


async def _openai_responses(
    client: AsyncOpenAI,
    model: str,
    input_messages: list[dict],
    instructions: str | None,
) -> str:
    kwargs: dict = {"model": model, "input": input_messages}
    if instructions:
        kwargs["instructions"] = instructions

    response = await client.responses.create(**kwargs)

    # Extract text from response output
    if hasattr(response, "output_text") and response.output_text:
        return response.output_text

    texts: list[str] = []
    for item in getattr(response, "output", []) or []:
        if getattr(item, "type", None) == "message":
            for content in getattr(item, "content", []) or []:
                if getattr(content, "type", None) == "output_text":
                    texts.append(content.text)
    if texts:
        return "\n".join(texts)

    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Empty response from LLM")


async def _openrouter_completion(
    project: Project,
    messages: list[dict],
    instructions: str | None,
) -> str:
    """OpenRouter chat completions fallback."""
    full_messages: list[dict] = []
    if instructions:
        full_messages.append({"role": "system", "content": instructions})
    full_messages.extend(messages)

    base = _resolve_base_url(project) or "https://openrouter.ai/api/v1"
    headers = {
        "Authorization": f"Bearer {project.llm_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://chatbot-platform.local",
        "X-Title": "Chatbot Platform",
    }
    payload = {"model": project.llm_model, "messages": full_messages}

    async with httpx.AsyncClient(timeout=120.0) as http:
        resp = await http.post(f"{base}/chat/completions", headers=headers, json=payload)
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"OpenRouter error: {resp.text}",
            )
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def chat_completion_stream(
    project: Project, history: list[Message], user_message: str
) -> AsyncIterator[str]:
    """Stream chat tokens for lower perceived latency."""
    client = _get_client(project)
    instructions = _build_instructions(project)
    prior = _history_to_input(history)
    input_messages = prior + [{"role": "user", "content": user_message}]

    try:
        if project.llm_provider == LLMProvider.openrouter:
            async for chunk in _openrouter_stream(project, input_messages, instructions):
                yield chunk
            return

        kwargs: dict = {"model": project.llm_model, "input": input_messages, "stream": True}
        if instructions:
            kwargs["instructions"] = instructions

        stream = await client.responses.create(**kwargs)
        async for event in stream:
            event_type = getattr(event, "type", None)
            if event_type == "response.output_text.delta":
                delta = getattr(event, "delta", "")
                if delta:
                    yield delta
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM streaming error: {str(e)}",
        ) from e


async def _openrouter_stream(
    project: Project,
    messages: list[dict],
    instructions: str | None,
) -> AsyncIterator[str]:
    full_messages: list[dict] = []
    if instructions:
        full_messages.append({"role": "system", "content": instructions})
    full_messages.extend(messages)

    base = _resolve_base_url(project) or "https://openrouter.ai/api/v1"
    headers = {
        "Authorization": f"Bearer {project.llm_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://chatbot-platform.local",
        "X-Title": "Chatbot Platform",
    }
    payload = {"model": project.llm_model, "messages": full_messages, "stream": True}

    async with httpx.AsyncClient(timeout=120.0) as http:
        async with http.stream("POST", f"{base}/chat/completions", headers=headers, json=payload) as resp:
            if resp.status_code >= 400:
                body = await resp.aread()
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"OpenRouter stream error: {body.decode()}",
                )
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                    delta = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if delta:
                        yield delta
                except json.JSONDecodeError:
                    continue


async def upload_file_to_openai(project: Project, file_content: bytes, filename: str) -> str:
    if project.llm_provider != LLMProvider.openai:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File upload via OpenAI Files API requires OpenAI provider.",
        )
    client = _get_client(project)
    from io import BytesIO

    bio = BytesIO(file_content)
    bio.name = filename
    result = await client.files.create(file=bio, purpose="assistants")
    return result.id
