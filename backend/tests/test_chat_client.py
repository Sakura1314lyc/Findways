import json

import httpx
import pytest
from openai import AsyncOpenAI

from app.llm.client import OpenAICompatibleClient


@pytest.mark.asyncio
async def test_chat_client_sends_conversation_as_messages():
    received = []

    def handler(request):
        received.append((request.url.path, json.loads(request.content)))
        return httpx.Response(
            200,
            json={
                "id": "test",
                "object": "chat.completion",
                "created": 0,
                "model": "test",
                "choices": [
                    {"index": 0, "message": {"role": "assistant", "content": "真实响应"}, "finish_reason": "stop"}
                ],
            },
        )

    client = object.__new__(OpenAICompatibleClient)
    client.model = "test"
    client.max_retries = 0
    client._client = AsyncOpenAI(
        api_key="test-only",
        base_url="https://model.example/v1",
        max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    messages = [
        {"role": "system", "content": "你是聊天助手"},
        {"role": "user", "content": "今天有点累"},
        {"role": "assistant", "content": "愿意聊聊吗？"},
        {"role": "user", "content": "怎样安排休息"},
    ]
    try:
        assert await client.chat_messages(messages) == "真实响应"
        path, body = received[0]
        assert path == "/v1/chat/completions"
        assert body["messages"] == messages
        assert body["max_tokens"] == 1800
        assert "response_format" not in body
    finally:
        await client._client.close()
