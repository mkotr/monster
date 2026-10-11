from scrapers._product_matching import is_white_monster


def test_is_white_monster_matches_plain_ultra_can():
    assert is_white_monster("Monster Energy Ultra Can 500mL") is True


def test_is_white_monster_matches_four_pack_naming():
    assert is_white_monster("Monster Energy Ultra Cans 500mL x 4 pack") is True


def test_is_white_monster_matches_coles_naming_variants():
    assert is_white_monster("Monster Energy Ultra Can | 500mL") is True
    assert is_white_monster("Monster Energy Drink Ultra 4x500ml | 2L") is True
    assert is_white_monster("Monster Energy Cans Ultra 6x250ml | 1.5L") is True


def test_is_white_monster_rejects_flavoured_variants():
    flavoured_names = [
        "Monster Energy Drink Ultra Violet Can 500mL",
        "Monster Ultra Fantasy Ruby Red Energy Drink 500mL",
        "Monster Energy Drink Ultra Peachy Keen Cans 500mL x 4 pack",
        "Monster Energy Drink Ultra Fiesta Mango Flavour 500mL",
        "Monster Ultra Vice Energy Drink 500mL",
        "Monster Energy Ultra Strawberry Dreams Drink 500mL",
        "Monster Energy Drink Blue Hawaiian Can 500mL",
        "Monster Energy Drink Ultra Ruby Red | 500mL",
    ]
    for name in flavoured_names:
        assert is_white_monster(name) is False, name


def test_is_white_monster_rejects_unrelated_products():
    assert is_white_monster("Ultra Pro Card Deck Box (White)") is False
    assert is_white_monster("Monster Single Socket Surge Protector White") is False
    assert is_white_monster("Monster USB-C to USB-C Braided Cable - White 1.2m") is False
