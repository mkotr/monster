import { test } from "node:test";
import assert from "node:assert/strict";

import { isWhiteMonster } from "../scrapers/productMatching.js";

test("isWhiteMonster matches plain ultra can", () => {
  assert.equal(isWhiteMonster("Monster Energy Ultra Can 500mL"), true);
});

test("isWhiteMonster matches four pack naming", () => {
  assert.equal(isWhiteMonster("Monster Energy Ultra Cans 500mL x 4 pack"), true);
});

test("isWhiteMonster matches coles naming variants", () => {
  assert.equal(isWhiteMonster("Monster Energy Ultra Can | 500mL"), true);
  assert.equal(isWhiteMonster("Monster Energy Drink Ultra 4x500ml | 2L"), true);
  assert.equal(isWhiteMonster("Monster Energy Cans Ultra 6x250ml | 1.5L"), true);
});

test("isWhiteMonster rejects flavoured variants", () => {
  const flavouredNames = [
    "Monster Energy Drink Ultra Violet Can 500mL",
    "Monster Ultra Fantasy Ruby Red Energy Drink 500mL",
    "Monster Energy Drink Ultra Peachy Keen Cans 500mL x 4 pack",
    "Monster Energy Drink Ultra Fiesta Mango Flavour 500mL",
    "Monster Ultra Vice Energy Drink 500mL",
    "Monster Energy Ultra Strawberry Dreams Drink 500mL",
    "Monster Energy Drink Blue Hawaiian Can 500mL",
    "Monster Energy Drink Ultra Ruby Red | 500mL",
  ];
  for (const name of flavouredNames) {
    assert.equal(isWhiteMonster(name), false, name);
  }
});

test("isWhiteMonster rejects unrelated products", () => {
  assert.equal(isWhiteMonster("Ultra Pro Card Deck Box (White)"), false);
  assert.equal(isWhiteMonster("Monster Single Socket Surge Protector White"), false);
  assert.equal(isWhiteMonster("Monster USB-C to USB-C Braided Cable - White 1.2m"), false);
});

test("isWhiteMonster rejects marketplace noise that happens to contain monster + ultra", () => {
  assert.equal(isWhiteMonster("Ultra Monster Series 81 Tyrant"), false);
  assert.equal(isWhiteMonster("BANDAI Ultraman Decker Ultra Kaiju Series 55 Micras"), false);
  assert.equal(isWhiteMonster("Ultra Monster 500 series 14"), false);
});

test("isWhiteMonster rejects the Rosa flavour, including in bundle listings", () => {
  assert.equal(isWhiteMonster("Monster Ultra Rosa 24 x 500ml"), false);
  assert.equal(
    isWhiteMonster("Monster Energy Ultra Bundle: Monster Zero Ultra 24pk & Monster Ultra Rosa 24pk"),
    false,
  );
});

test("isWhiteMonster matches real Amazon listing variants", () => {
  assert.equal(isWhiteMonster("Monster Energy Drink Zero Ultra 24 x 500ml"), true);
  assert.equal(isWhiteMonster("Monster Zero Ultra Energy Drink 24 x 500 ml"), true);
  assert.equal(
    isWhiteMonster("Monster Ultra White Energy Drink Pack 4 x 500ml | Zero Sugar Energy Soda with Caffeine"),
    true,
  );
});
