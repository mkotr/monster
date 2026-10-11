# Neither store names the plain/original Monster Ultra flavour "white" -
# it's just "Monster Energy Ultra" with no flavour word, in a white can.
# Every other Ultra variant has a flavour word appended, so we match by
# excluding those instead of requiring a literal "white" substring.
_FLAVOUR_EXCLUDE_WORDS = [
    "violet",
    "peachy keen",
    "fiesta mango",
    "vice",
    "strawberry",
    "ruby red",
    "fantasy",
    "blue hawaiian",
]


def is_white_monster(name):
    lowered = name.lower()
    if "monster" not in lowered or "ultra" not in lowered:
        return False
    return not any(word in lowered for word in _FLAVOUR_EXCLUDE_WORDS)
