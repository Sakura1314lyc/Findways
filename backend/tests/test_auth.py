from tests.conftest import unique_account


async def test_register_login_and_me(client):
    account = unique_account()
    response = await client.post("/api/v1/auth/register", json=account)
    assert response.status_code == 201
    tokens = response.json()
    assert tokens["access_token"] and tokens["refresh_token"]

    response = await client.post(
        "/api/v1/auth/login", json={"account": account["username"], "password": account["password"]}
    )
    assert response.status_code == 200

    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert response.status_code == 200
    assert response.json()["username"] == account["username"]


async def test_duplicate_email_conflict(client):
    account = unique_account()
    first = await client.post("/api/v1/auth/register", json=account)
    assert first.status_code == 201
    duplicate = dict(account)
    duplicate["username"] = account["username"] + "x"
    response = await client.post("/api/v1/auth/register", json=duplicate)
    assert response.status_code == 409


async def test_login_wrong_password(client):
    account = unique_account()
    await client.post("/api/v1/auth/register", json=account)
    response = await client.post(
        "/api/v1/auth/login", json={"account": account["email"], "password": "wrong-password"}
    )
    assert response.status_code == 401


async def test_refresh_rotates_and_revokes_old_token(client):
    account = unique_account()
    response = await client.post("/api/v1/auth/register", json=account)
    refresh_token = response.json()["refresh_token"]

    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200
    assert refreshed.json()["refresh_token"] != refresh_token

    reused = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert reused.status_code == 401


async def test_access_token_rejected_as_refresh(client):
    account = unique_account()
    response = await client.post("/api/v1/auth/register", json=account)
    access_token = response.json()["access_token"]
    reused = await client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert reused.status_code == 401


async def test_me_requires_token(client):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_logout_revokes_refresh_token(client):
    account = unique_account()
    response = await client.post("/api/v1/auth/register", json=account)
    refresh_token = response.json()["refresh_token"]
    logout = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout.status_code == 200
    reused = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert reused.status_code == 401
