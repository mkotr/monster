from unittest.mock import patch
from app import app


def test_get_prices_combines_both_stores_successfully():
    with patch(
        "app.woolworths.search_white_monster",
        return_value=[{"name": "Monster Ultra White 500mL", "price": 3.5, "url": "https://example.com/a"}],
    ), patch(
        "app.coles.search_white_monster",
        return_value=[{"name": "Monster Energy Ultra White 500mL", "price": 3.2, "url": "https://example.com/b"}],
    ):
        client = app.test_client()
        response = client.get("/api/prices")
        data = response.get_json()

    assert response.status_code == 200
    assert data["woolworths"]["status"] == "ok"
    assert data["woolworths"]["products"][0]["price"] == 3.5
    assert data["coles"]["status"] == "ok"
    assert data["coles"]["products"][0]["price"] == 3.2


def test_get_prices_reports_per_store_error_without_failing_whole_request():
    with patch(
        "app.woolworths.search_white_monster",
        return_value=[{"name": "Monster Ultra White 500mL", "price": 3.5, "url": "https://example.com/a"}],
    ), patch(
        "app.coles.search_white_monster",
        side_effect=RuntimeError("blocked"),
    ):
        client = app.test_client()
        response = client.get("/api/prices")
        data = response.get_json()

    assert response.status_code == 200
    assert data["woolworths"]["status"] == "ok"
    assert data["coles"]["status"] == "error"
    assert data["coles"]["message"] == "blocked"


def test_get_prices_passes_through_multiple_products_without_truncating():
    two_products = [
        {"name": "Monster Ultra White 500mL", "price": 3.5, "url": "https://example.com/a"},
        {"name": "Monster Ultra White 4pk 500mL", "price": 12.0, "url": "https://example.com/b"},
    ]
    with patch("app.woolworths.search_white_monster", return_value=two_products), patch(
        "app.coles.search_white_monster", return_value=[]
    ):
        client = app.test_client()
        response = client.get("/api/prices")
        data = response.get_json()

    assert len(data["woolworths"]["products"]) == 2
    assert data["coles"]["status"] == "ok"
    assert data["coles"]["products"] == []
