import json

from scrapers.coles import _extract_products, _parse_next_data


def test_extract_products_finds_matching_white_monster():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Energy Ultra White 500mL", "pricing": {"now": 3.5}, "_links": {"self": {"href": "/product/monster-ultra-white-500ml"}}},
        {"name": "Monster Energy Original 500mL", "pricing": {"now": 3.2}, "_links": {"self": {"href": "/product/monster-original-500ml"}}},
    ]}}}
    result = _extract_products(data)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Energy Ultra White 500mL"
    assert result[0]["price"] == 3.5
    assert result[0]["url"] == "https://www.coles.com.au/product/monster-ultra-white-500ml"


def test_extract_products_returns_empty_list_when_no_match():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Energy Original 500mL", "pricing": {"now": 3.2}, "_links": {"self": {"href": "/product/monster-original-500ml"}}},
    ]}}}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_numeric_price():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Ultra White 500mL", "pricing": {"now": None}, "_links": {"self": {"href": "/product/x"}}},
    ]}}}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_finite_price():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Ultra White 500mL", "pricing": {"now": "NaN"}, "_links": {"self": {"href": "/product/x"}}},
        {"name": "Monster Ultra White 4pk 500mL", "pricing": {"now": "Infinity"}, "_links": {"self": {"href": "/product/y"}}},
    ]}}}
    assert _extract_products(data) == []


def test_extract_products_returns_all_matching_pack_sizes():
    data = {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Ultra White 500mL", "pricing": {"now": 3.5}, "_links": {"self": {"href": "/product/a"}}},
        {"name": "Monster Ultra White 4pk 500mL", "pricing": {"now": 12.0}, "_links": {"self": {"href": "/product/b"}}},
    ]}}}
    result = _extract_products(data)
    assert len(result) == 2


def test_parse_next_data_extracts_props_for_extract_products():
    next_data_text = json.dumps({"props": {"pageProps": {"searchResults": {"results": [
        {"name": "Monster Ultra White 500mL", "pricing": {"now": 3.5}, "_links": {"self": {"href": "/product/a"}}},
    ]}}}})
    props = _parse_next_data(next_data_text)
    result = _extract_products(props)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Ultra White 500mL"


def test_parse_next_data_returns_empty_dict_for_invalid_json():
    assert _parse_next_data("not json") == {}


def test_parse_next_data_returns_empty_dict_for_missing_text():
    assert _parse_next_data(None) == {}
    assert _parse_next_data("") == {}
