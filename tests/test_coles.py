import json

from scrapers.coles import _extract_products, _parse_next_data


def test_extract_products_finds_matching_white_monster():
    data = {"pageProps": {"searchResults": {"results": [
        {"id": 2787147, "brand": "Monster", "name": "Energy Ultra Can", "size": "500mL", "pricing": {"now": 4.7}},
        {"id": 8593020, "brand": "Monster", "name": "Energy Ultra Violet Can", "size": "500mL", "pricing": {"now": 4.7}},
    ]}}}
    result = _extract_products(data)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Energy Ultra Can | 500mL"
    assert result[0]["price"] == 4.7
    assert result[0]["url"] == "https://www.coles.com.au/product/monster-energy-ultra-can-500ml-2787147"


def test_extract_products_returns_empty_list_when_no_match():
    data = {"pageProps": {"searchResults": {"results": [
        {"id": 8593020, "brand": "Monster", "name": "Energy Ultra Violet Can", "size": "500mL", "pricing": {"now": 4.7}},
    ]}}}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_numeric_price():
    data = {"pageProps": {"searchResults": {"results": [
        {"id": 2787147, "brand": "Monster", "name": "Energy Ultra Can", "size": "500mL", "pricing": {"now": None}},
    ]}}}
    assert _extract_products(data) == []


def test_extract_products_skips_items_with_non_finite_price():
    data = {"pageProps": {"searchResults": {"results": [
        {"id": 2787147, "brand": "Monster", "name": "Energy Ultra Can", "size": "500mL", "pricing": {"now": "NaN"}},
        {"id": 2785108, "brand": "Monster", "name": "Energy Drink Ultra 4x500ml", "size": "2L", "pricing": {"now": "Infinity"}},
    ]}}}
    assert _extract_products(data) == []


def test_extract_products_returns_all_matching_pack_sizes():
    data = {"pageProps": {"searchResults": {"results": [
        {"id": 2787147, "brand": "Monster", "name": "Energy Ultra Can", "size": "500mL", "pricing": {"now": 4.7}},
        {"id": 2785108, "brand": "Monster", "name": "Energy Drink Ultra 4x500ml", "size": "2L", "pricing": {"now": 17.5}},
    ]}}}
    result = _extract_products(data)
    assert len(result) == 2


def test_parse_next_data_extracts_props_for_extract_products():
    next_data_text = json.dumps({"props": {"pageProps": {"searchResults": {"results": [
        {"id": 2787147, "brand": "Monster", "name": "Energy Ultra Can", "size": "500mL", "pricing": {"now": 4.7}},
    ]}}}})
    props = _parse_next_data(next_data_text)
    result = _extract_products(props)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Energy Ultra Can | 500mL"


def test_parse_next_data_returns_empty_dict_for_invalid_json():
    assert _parse_next_data("not json") == {}


def test_parse_next_data_returns_empty_dict_for_missing_text():
    assert _parse_next_data(None) == {}
    assert _parse_next_data("") == {}
