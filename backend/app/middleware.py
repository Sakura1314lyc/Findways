import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging import request_id_var

logger = logging.getLogger("app.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        latency_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "http_request method=%s path=%s status=%s latency_ms=%s",
            request.method,
            request.url.path,
            response.status_code,
            latency_ms,
        )
        response.headers["X-Request-ID"] = request_id
        return response
