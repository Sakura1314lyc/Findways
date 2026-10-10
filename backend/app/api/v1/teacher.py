from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.core.exceptions import PermissionDeniedError
from app.services.archive_loader import load_cases
from app.services.teacher_service import TeacherService

router = APIRouter()


@router.get("/overview")
async def overview(user: CurrentUser, session: SessionDep) -> dict:
    if not user.is_superuser:
        raise PermissionDeniedError("需要教师权限")
    return await TeacherService(session).overview(load_cases())
