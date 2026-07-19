#!/usr/bin/env python3
"""Fix overlapping extractions from split_characters.py."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"


def drop_lines(path: Path, start: int, end: int) -> None:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    path.write_text("".join(lines[: start - 1] + lines[end:]), encoding="utf-8")


def main() -> None:
    provider = ROOT / "character" / "generation" / "provider.rs"
    lines = provider.read_text(encoding="utf-8").splitlines(keepends=True)

    # Keep 1-153, canvas block 789-839, HTTP block 925-end (1-based from earlier read)
    canvas = lines[788:839]
    http = lines[924:]
    head = lines[:153]
    provider.write_text("".join(head + ["\n"] + canvas + ["\n"] + http), encoding="utf-8")

    # prompt.rs: drop view-slot mirror section (approx lines 520-646 in file = character_view_specs through resolve_api)
    prompt = ROOT / "character" / "prompt.rs"
    plines = prompt.read_text(encoding="utf-8").splitlines(keepends=True)
    # Find build_initial_character_views through resolve_api_generation_size block
    start = end = None
    for i, line in enumerate(plines):
        if line.startswith("fn build_initial_character_views"):
            start = i
        if start is not None and line.startswith("fn default_character_negative_prompt"):
            end = i
            break
    if start is not None and end is not None:
        prompt.write_text("".join(plines[:start] + plines[end:]), encoding="utf-8")

    # views.rs: drop duplicate tail from character_view_specs onward
    views = ROOT / "character" / "generation" / "views.rs"
    vlines = views.read_text(encoding="utf-8").splitlines(keepends=True)
    for i, line in enumerate(vlines):
        if line.startswith("fn character_view_specs"):
            views.write_text("".join(vlines[:i]), encoding="utf-8")
            break

    print("Fixed provider, prompt, views overlaps.")


if __name__ == "__main__":
    main()
