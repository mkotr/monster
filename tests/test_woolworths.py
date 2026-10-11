from scrapers.woolworths import _extract_products


def test_extract_products_finds_matching_white_monster():
    data = {"Products": [{"Products": [
        {"Name": "Monster Energy Ultra Can", "DisplayName": "Monster Energy Ultra Can 500mL", "Price": 4.7, "Stockcode": 489787},
        {"Name": "Monster Energy Drink Ultra Violet Can", "DisplayName": "Monster Energy Drink Ultra Violet Can 500mL", "Price": 4.7, "Stockcode": 919631},
    ]}]}
    result = _extract_products(data)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Energy Ultra Can"
    assert result[0]["price"] == 4.7
    assert result[0]["url"].endswith("/489787")


def test_extract_products_returns_empty_list_when_no_match():
    data = {"Products": [{"Products": [
        {"Name": "Monster Energy Drink Ultra Violet Can", "Price": 4.7, "Stockcode": 919631},
    ]}]}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_numeric_price():
    data = {"Products": [{"Products": [
        {"Name": "Monster Energy Ultra Can", "Price": "N/A", "Stockcode": 489787},
    ]}]}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_finite_price():
    data = {"Products": [{"Products": [
        {"Name": "Monster Energy Ultra Can", "Price": "NaN", "Stockcode": 489787},
        {"Name": "Monster Energy Ultra Cans", "Price": "Infinity", "Stockcode": 511504},
    ]}]}
    assert _extract_products(data) == []


def test_extract_products_returns_all_matching_pack_sizes():
    data = {"Products": [{"Products": [
        {"Name": "Monster Energy Ultra Can", "Price": 4.7, "Stockcode": 489787},
        {"Name": "Monster Energy Ultra Cans", "DisplayName": "Monster Energy Ultra Cans 500mL x 4 pack", "Price": 17.5, "Stockcode": 511504},
    ]}]}
    result = _extract_products(data)
    assert len(result) == 2
