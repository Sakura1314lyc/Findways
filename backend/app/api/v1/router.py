from fastapi import APIRouter

from app.api.v1 import archives, auth, chat, health, knowledge, teacher, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(archives.router, prefix="/archives", tags=["archives"])
api_router.include_router(teacher.router, prefix="/teacher", tags=["teacher"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
