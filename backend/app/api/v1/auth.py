from fastapi import APIRouter, status

from app.api.deps import CurrentUser, SessionDep
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserOut
from app.schemas.common import MessageOut
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: SessionDep) -> TokenPair:
    service = AuthService(session)
    await service.register(payload)
    return await service.login(LoginRequest(account=payload.username, password=payload.password))


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, session: SessionDep) -> TokenPair:
    return await AuthService(session).login(payload)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, session: SessionDep) -> TokenPair:
    return await AuthService(session).refresh(payload.refresh_token)


@router.post("/logout", response_model=MessageOut)
async def logout(payload: RefreshRequest, session: SessionDep) -> MessageOut:
    await AuthService(session).logout(payload.refresh_token)
    return MessageOut(message="已退出登录")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
