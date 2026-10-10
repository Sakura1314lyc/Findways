async def test_knowledge_points(auth_client):
    response = await auth_client.get("/api/v1/knowledge/points")
    assert response.status_code == 200
    points = response.json()
    assert len(points) >= 10
    assert any(point["name"] == "实事求是" for point in points)


async def test_knowledge_search(auth_client):
    response = await auth_client.get("/api/v1/knowledge/search", params={"q": "矛盾 主要矛盾", "top_k": 5})
    assert response.status_code == 200
    data = response.json()
    assert data["hits"], "应检索到相关内容"
    assert any("矛盾" in hit["text"] for hit in data["hits"])


async def test_knowledge_search_without_match(auth_client):
    response = await auth_client.get("/api/v1/knowledge/search", params={"q": "qqqqzzzz"})
    assert response.status_code == 200
    assert response.json()["hits"] == []
