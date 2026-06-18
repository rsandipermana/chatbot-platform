import json
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, status
from openai import AsyncOpenAI

from app.models import LLMProvider, Message, Project


@dataclass
class LLMProjectConfig:
    """Detached project config safe to use outside a DB session."""

    llm_provider: LLMProvider
    llm_api_key: str | None
    llm_base_url: str | None
    llm_model: str
    system_prompt: str | None
    prompts: list[tuple[str, str]]


def project_to_config(project: Project) -> LLMProjectConfig:
    return LLMProjectConfig(
        llm_provider=project.llm_provider,
        llm_api_key=project.llm_api_key,
        llm_base_url=project.llm_base_url,
        llm_model=project.llm_model,
        system_prompt=project.system_prompt,
        prompts=[(p.name, p.content) for p in project.prompts],
    )


def _resolve_base_url(config: LLMProjectConfig) -> str | None:
    if config.llm_base_url:
        return config.llm_base_url.rstrip("/")
    if config.llm_provider == LLMProvider.openrouter:
        return "https://openrouter.ai/api/v1"
    if config.llm_provider == LLMProvider.openai:
        return None  # default OpenAI
    return config.llm_base_url


def _get_client(config: LLMProjectConfig) -> AsyncOpenAI:
    if not config.llm_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LLM API key is not configured. Please set it in project settings.",
        )
    return AsyncOpenAI(
        api_key=config.llm_api_key,
        base_url=_resolve_base_url(config),
    )


def _build_instructions(config: LLMProjectConfig) -> str | None:
    parts: list[str] = []
    if config.system_prompt:
        parts.append(config.system_prompt.strip())
    for name, content in config.prompts:
        parts.append(f"[{name}]\n{content.strip()}")
    return "\n\n".join(parts) if parts else None


def _history_to_input(messages: list[Message] | list[dict]) -> list[dict]:
    result = []
    for m in messages:
        if isinstance(m, dict):
            if m.get("role") in ("user", "assistant"):
                result.append({"role": m["role"], "content": m["content"]})
        elif m.role in ("user", "assistant"):
            result.append({"role": m.role, "content": m.content})
    return result


def _uses_chat_completions(config: LLMProjectConfig) -> bool:
    """OpenAI-compatible chat/completions (Z.AI, OpenRouter, Ollama, etc.)."""
    return config.llm_provider in (LLMProvider.openrouter, LLMProvider.custom)


async def chat_completion(project: Project, history: list[Message], user_message: str) -> str:
    """Send a chat request using OpenAI Responses API or chat/completions."""
    return await chat_completion_with_config(project_to_config(project), history, user_message)


async def chat_completion_with_config(
    config: LLMProjectConfig, history: list[Message], user_message: str
) -> str:
    client = _get_client(config)
    instructions = _build_instructions(config)
    prior = _history_to_input(history)
    input_messages = prior + [{"role": "user", "content": user_message}]

    try:
        if _uses_chat_completions(config):
            return await _chat_completions(config, input_messages, instructions)
        return await _openai_responses(client, config.llm_model, input_messages, instructions)
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


def _chat_completions_headers(config: LLMProjectConfig) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {config.llm_api_key}",
        "Content-Type": "application/json",
        "Accept-Language": "en-US,en",
    }
    if config.llm_provider == LLMProvider.openrouter:
        headers["HTTP-Referer"] = "https://chatbot-platform.local"
        headers["X-Title"] = "Chatbot Platform"
    return headers


def _chat_completions_url(config: LLMProjectConfig) -> str:
    base = _resolve_base_url(config) or "https://openrouter.ai/api/v1"
    return f"{base.rstrip('/')}/chat/completions"


async def _chat_completions(
    config: LLMProjectConfig,
    messages: list[dict],
    instructions: str | None,
) -> str:
    """OpenAI-compatible chat/completions (OpenRouter, Z.AI, Ollama, etc.)."""
    full_messages: list[dict] = []
    if instructions:
        full_messages.append({"role": "system", "content": instructions})
    full_messages.extend(messages)

    payload = {"model": config.llm_model, "messages": full_messages}

    async with httpx.AsyncClient(timeout=120.0) as http:
        resp = await http.post(
            _chat_completions_url(config),
            headers=_chat_completions_headers(config),
            json=payload,
        )
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LLM API error ({resp.status_code}): {resp.text}",
            )
        data = resp.json()
        message = data["choices"][0]["message"]
        content = message.get("content") or message.get("reasoning_content") or ""
        if not content:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Empty response from LLM")
        return content


async def chat_completion_stream(
    project: Project, history: list[Message], user_message: str
) -> AsyncIterator[str]:
    async for token in chat_completion_stream_with_config(
        project_to_config(project), history, user_message
    ):
        yield token


async def chat_completion_stream_with_config(
    config: LLMProjectConfig, history: list[Message] | list[dict], user_message: str
) -> AsyncIterator[str]:
    """Stream chat tokens for lower perceived latency."""
    client = _get_client(config)
    instructions = _build_instructions(config)
    prior = _history_to_input(history)
    input_messages = prior + [{"role": "user", "content": user_message}]

    try:
        if _uses_chat_completions(config):
            async for chunk in _chat_completions_stream(config, input_messages, instructions):
                yield chunk
            return

        kwargs: dict = {"model": config.llm_model, "input": input_messages, "stream": True}
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


async def _chat_completions_stream(
    config: LLMProjectConfig,
    messages: list[dict],
    instructions: str | None,
) -> AsyncIterator[str]:
    full_messages: list[dict] = []
    if instructions:
        full_messages.append({"role": "system", "content": instructions})
    full_messages.extend(messages)

    payload = {"model": config.llm_model, "messages": full_messages, "stream": True}

    async with httpx.AsyncClient(timeout=120.0) as http:
        async with http.stream(
            "POST",
            _chat_completions_url(config),
            headers=_chat_completions_headers(config),
            json=payload,
        ) as resp:
            if resp.status_code >= 400:
                body = await resp.aread()
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"LLM stream error ({resp.status_code}): {body.decode()}",
                )
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                    delta_obj = data.get("choices", [{}])[0].get("delta", {})
                    delta = delta_obj.get("content") or delta_obj.get("reasoning_content") or ""
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
    client = _get_client(project_to_config(project))
    from io import BytesIO

    bio = BytesIO(file_content)
    bio.name = filename
    result = await client.files.create(file=bio, purpose="assistants")
    return result.id
