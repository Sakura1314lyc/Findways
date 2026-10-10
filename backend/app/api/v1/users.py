from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.core.config import get_settings
from app.core.exceptions import PermissionDeniedError
from app.schemas.auth import TeacherClaimRequest, UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/me/teacher", response_model=UserOut)
async def claim_teacher(payload: TeacherClaimRequest, user: CurrentUser, session: SessionDep) -> UserOut:
    settings = get_settings()
    if not settings.teacher_code:
        raise PermissionDeniedError("教师端未开放，请联系课程负责人在服务端配置验证码")
    if payload.code != settings.teacher_code:
        raise PermissionDeniedError("教师验证码不正确")
    user.is_superuser = True
    await session.commit()
    await session.refresh(user)
    return UserOut.model_validate(user)
