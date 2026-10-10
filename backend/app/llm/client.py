import asyncio
import json
import logging
import time
from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings
from app.core.exceptions import LLMServiceError

logger = logging.getLogger(__name__)


def extract_json(text: str | None) -> dict | list | None:
    if not text:
        return None
    cleaned = text.strip()
    fence_start = cleaned.find("```")
    if fence_start != -1:
        fence_end = cleaned.find("```", fence_start + 3)
        if fence_end != -1:
            cleaned = cleaned[fence_start + 3 : fence_end].strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
    start = None
    depth = 0
    in_str = False
    esc = False
    for i, ch in enumerate(cleaned):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            if depth == 0:
                start = i
            depth += 1
        elif ch in "}]":
            depth -= 1
            if depth == 0 and start is not None:
                candidate = cleaned[start : i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    start = None
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


class LLMPort(Protocol):
    provider: str
    is_mock: bool

    async def chat_messages(self, messages: list[dict[str, str]], max_tokens: int = 1800) -> str: ...

    async def chat(
        self,
        system: str,
        user: str,
        temperature: float | None = None,
        max_tokens: int = 1200,
        json_mode: bool = False,
    ) -> str: ...

    async def chat_json(
        self,
        system: str,
        user: str,
        fallback: dict | None = None,
        temperature: float = 0.3,
        max_tokens: int = 900,
    ) -> dict | None: ...


class MockLLMClient:
    provider = "mock"
    is_mock = True

    async def chat_messages(self, messages: list[dict[str, str]], max_tokens: int = 1800) -> str:
        raise LLMServiceError("聊天模型尚未连接，请联系管理员配置模型服务。")

    async def chat(
        self, system: str, user: str, temperature=None, max_tokens: int = 1200, json_mode: bool = False
    ) -> str:
        raise LLMServiceError("离线模拟模式不支持自由文本生成，请配置 LLM_API_KEY")

    async def chat_json(self, system: str, user: str, fallback=None, temperature: float = 0.3, max_tokens: int = 900):
        return fallback


class OpenAICompatibleClient:
    provider = "openai_compatible"

    def __init__(self) -> None:
        settings = get_settings()
        from openai import AsyncOpenAI

        self.is_mock = False
        self.model = settings.llm_model
        self.max_retries = settings.llm_max_retries
        self.provider = settings.resolved_llm_provider
        self._client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            timeout=settings.llm_timeout_seconds,
            max_retries=0,
        )

    async def _create(self, messages: list[dict], temperature: float, max_tokens: int, json_mode: bool):
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            started = time.perf_counter()
            try:
                response = await self._client.chat.completions.create(**kwargs)
                latency_ms = int((time.perf_counter() - started) * 1000)
                usage = getattr(response, "usage", None)
                logger.info(
                    "llm_call model=%s latency_ms=%s prompt_tokens=%s completion_tokens=%s",
                    self.model,
                    latency_ms,
                    getattr(usage, "prompt_tokens", None) if usage else None,
                    getattr(usage, "completion_tokens", None) if usage else None,
                )
                return response.choices[0].message.content or ""
            except Exception as exc:
                last_error = exc
                if attempt < self.max_retries:
                    await asyncio.sleep(0.8 * (attempt + 1))
        raise LLMServiceError(f"大模型调用失败：{last_error}")

    async def chat(
        self, system: str, user: str, temperature=None, max_tokens: int = 1200, json_mode: bool = False
    ) -> str:
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        temp = 0.7 if temperature is None else temperature
        return (await self._create(messages, temp, max_tokens, json_mode)).strip()

    async def chat_messages(self, messages: list[dict[str, str]], max_tokens: int = 1800) -> str:
        return (await self._create(messages, 0.5, max_tokens, False)).strip()

    async def chat_json(self, system: str, user: str, fallback=None, temperature: float = 0.3, max_tokens: int = 900):
        try:
            content = await self._create(
                [{"role": "system", "content": system}, {"role": "user", "content": user}],
                temperature,
                max_tokens,
                True,
            )
            data = extract_json(content)
            return data if data is not None else fallback
        except LLMServiceError:
            return fallback


@lru_cache
def get_llm_client() -> MockLLMClient | OpenAICompatibleClient:
    provider = get_settings().resolved_llm_provider
    if provider == "mock":
        return MockLLMClient()
    return OpenAICompatibleClient()
