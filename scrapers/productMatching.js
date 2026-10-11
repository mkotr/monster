// Neither store names the plain/original Monster Ultra flavour "white" -
// it's just "Monster Energy Ultra" with no flavour word, in a white can.
// Every other Ultra variant has a flavour word appended, so we match by
// excluding those instead of requiring a literal "white" substring.
const FLAVOUR_EXCLUDE_WORDS = [
  "violet",
  "peachy keen",
  "fiesta mango",
  "vice",
  "strawberry",
  "ruby red",
  "fantasy",
  "blue hawaiian",
];

export function isWhiteMonster(name) {
  const lowered = name.toLowerCase();
  if (!lowered.includes("monster") || !lowered.includes("ultra")) {
    return false;
  }
  return !FLAVOUR_EXCLUDE_WORDS.some((word) => lowered.includes(word));
}
