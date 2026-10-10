from datetime import UTC, datetime

import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models.user import RefreshToken, User
from app.repositories.users import RefreshTokenRepository, UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPair


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.refresh_tokens = RefreshTokenRepository(session)

    async def register(self, payload: RegisterRequest) -> User:
        if await self.users.get_by_email(payload.email):
            raise ConflictError("该邮箱已被注册")
        if await self.users.get_by_username(payload.username):
            raise ConflictError("该用户名已被占用")
        user = User(
            email=payload.email,
            username=payload.username,
            hashed_password=hash_password(payload.password),
        )
        user = await self.users.create(user)
        await self.session.commit()
        return user

    async def login(self, payload: LoginRequest) -> TokenPair:
        user = await self.users.get_by_account(payload.account)
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise AuthenticationError("账号或密码错误")
        if not user.is_active:
            raise AuthenticationError("账号已被停用")
        return await self._issue_tokens(user)

    async def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError as exc:
            raise AuthenticationError("刷新令牌无效") from exc
        if payload.get("type") != "refresh":
            raise AuthenticationError("令牌类型错误")
        record = await self.refresh_tokens.get_by_jti(payload.get("jti", ""))
        if record is None or record.revoked:
            raise AuthenticationError("刷新令牌已失效")
        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at < datetime.now(UTC):
            raise AuthenticationError("刷新令牌已过期")
        user = await self.users.get(int(payload["sub"]))
        if user is None or not user.is_active:
            raise AuthenticationError("账号不可用")
        record.revoked = True
        await self.session.flush()
        tokens = await self._issue_tokens(user)
        await self.session.commit()
        return tokens

    async def logout(self, refresh_token: str) -> None:
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError:
            return
        record = await self.refresh_tokens.get_by_jti(payload.get("jti", ""))
        if record is not None and not record.revoked:
            record.revoked = True
            await self.session.commit()

    async def resolve_user_from_access_token(self, token: str) -> User:
        try:
            payload = decode_token(token)
        except jwt.PyJWTError as exc:
            raise AuthenticationError("访问令牌无效或已过期") from exc
        if payload.get("type") != "access":
            raise AuthenticationError("令牌类型错误")
        user = await self.users.get(int(payload["sub"]))
        if user is None or not user.is_active:
            raise AuthenticationError("账号不可用")
        return user

    async def _issue_tokens(self, user: User) -> TokenPair:
        access = create_access_token(user.id)
        refresh, jti, expires_at = create_refresh_token(user.id)
        await self.refresh_tokens.create(
            RefreshToken(user_id=user.id, jti=jti, expires_at=expires_at, revoked=False)
        )
        await self.session.commit()
        return TokenPair(access_token=access, refresh_token=refresh)
