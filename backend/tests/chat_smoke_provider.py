import time

from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()


@app.post("/v1/chat/completions")
async def complete(payload: dict):
    questions = [row["content"] for row in payload["messages"] if row["role"] == "user"]
    question = questions[-1]
    if question == "验证失败重试":
        return JSONResponse(status_code=503, content={"error": {"message": "test unavailable"}})
    previous = f"你上一轮提到：{questions[-2]}\n\n" if len(questions) > 1 else ""
    content = (
        f"这是测试模型的第 {len(questions)} 轮回复，用于验证聊天链路。\n\n"
        f"{previous}关于“{question}”，可以先把问题拆小，再逐步讨论。\n\n"
        "1. 先确定今天最想完成的一件事。\n2. 留一个短暂的休息时间。\n\n"
        "| 小步骤 | 建议 |\n| --- | --- |\n| 理解概念 | 用自己的话解释 |\n"
        "| 安排复习 | 分成短时段 |\n\n```text\n"
        + "a_long_example_to_check_mobile_overflow_" * 8
        + "\n```\n\n如果你愿意，我们可以继续细聊。"
    )
    return {
        "id": "chatcmpl-smoke",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": "smoke-test-only",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
