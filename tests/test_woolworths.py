from scrapers.woolworths import _extract_products


def test_extract_products_finds_matching_white_monster():
    data = {"Bundles": [{"Products": [
        {"Name": "Monster Energy Ultra White 500mL", "Price": 3.5, "Stockcode": 123},
        {"Name": "Monster Energy Original 500mL", "Price": 3.2, "Stockcode": 456},
    ]}]}
    result = _extract_products(data)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Energy Ultra White 500mL"
    assert result[0]["price"] == 3.5
    assert result[0]["url"].endswith("/123")


def test_extract_products_returns_empty_list_when_no_match():
    data = {"Bundles": [{"Products": [
        {"Name": "Monster Energy Original 500mL", "Price": 3.2, "Stockcode": 456},
    ]}]}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_numeric_price():
    data = {"Bundles": [{"Products": [
        {"Name": "Monster Ultra White 500mL", "Price": "N/A", "Stockcode": 123},
    ]}]}
    assert _extract_products(data) == []


def test_extract_products_returns_all_matching_pack_sizes():
    data = {"Bundles": [{"Products": [
        {"Name": "Monster Ultra White 500mL", "Price": 3.5, "Stockcode": 1},
        {"Name": "Monster Ultra White 4pk 500mL", "Price": 12.0, "Stockcode": 2},
    ]}]}
    result = _extract_products(data)
    assert len(result) == 2
