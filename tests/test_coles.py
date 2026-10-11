import json
from unittest.mock import MagicMock, patch

from scrapers.coles import _extract_products, _parse_next_data, _fetch_via_requests


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


def test_fetch_via_requests_returns_none_on_non_200():
    mock_response = MagicMock(status_code=403, text="blocked")
    with patch("scrapers.coles.requests.get", return_value=mock_response):
        assert _fetch_via_requests() is None


def test_fetch_via_requests_returns_none_when_next_data_missing():
    mock_response = MagicMock(status_code=200, text="<html><body>Incapsula challenge, no next data</body></html>")
    with patch("scrapers.coles.requests.get", return_value=mock_response):
        assert _fetch_via_requests() is None


def test_fetch_via_requests_returns_none_on_request_exception():
    with patch("scrapers.coles.requests.get", side_effect=Exception("connection error")):
        assert _fetch_via_requests() is None


def test_fetch_via_requests_returns_parsed_props_when_next_data_present():
    next_data_json = json.dumps({"props": {"pageProps": {"searchResults": {"results": [
        {"id": 2787147, "brand": "Monster", "name": "Energy Ultra Can", "size": "500mL", "pricing": {"now": 4.7}},
    ]}}}})
    html = f'<html><body><script id="__NEXT_DATA__" type="application/json">{next_data_json}</script></body></html>'
    mock_response = MagicMock(status_code=200, text=html)
    with patch("scrapers.coles.requests.get", return_value=mock_response):
        props = _fetch_via_requests()
    result = _extract_products(props)
    assert len(result) == 1
    assert result[0]["name"] == "Monster Energy Ultra Can | 500mL"
