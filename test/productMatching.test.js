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
