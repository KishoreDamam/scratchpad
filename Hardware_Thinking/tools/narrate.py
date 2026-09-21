#!/usr/bin/env python3
"""Strip an episode script down to the words a narrator actually says.

Removes the front matter block, production notes (lines starting with '>'),
beat markers (headings), horizontal rules, and inline emphasis markers.
What is left is clean prose, ready to paste into any text-to-speech engine.

    ./narrate.py ../episodes/ep02-the-clock.md
    ./narrate.py --stats ../episodes/*.md
"""

import argparse
import pathlib
import re
import sys

WORDS_PER_MINUTE = 145  # unhurried narration


def narrate(text: str) -> str:
    lines = text.splitlines()

    # Drop a leading '---' fenced front matter block.
    if lines and lines[0].strip() == "---":
        try:
            end = lines.index("---", 1)
            lines = lines[end + 1:]
        except ValueError:
            pass

    kept = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(">"):      # production note
            continue
        if stripped.startswith("#"):      # beat marker
            continue
        if stripped == "---":             # rule
            continue
        kept.append(line)

    body = "\n".join(kept)
    body = re.sub(r"\*\*(.+?)\*\*", r"\1", body, flags=re.S)   # bold
    body = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\1", body, flags=re.S)
    body = body.replace("`", "")
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", type=pathlib.Path)
    ap.add_argument("--stats", action="store_true",
                    help="print word count and estimated runtime instead of text")
    ap.add_argument("-o", "--out-dir", type=pathlib.Path,
                    help="write <name>.txt into this directory instead of stdout")
    args = ap.parse_args()

    total_words = 0
    for path in args.files:
        spoken = narrate(path.read_text(encoding="utf-8"))
        words = len(spoken.split())
        total_words += words

        if args.stats:
            minutes = words / WORDS_PER_MINUTE
            print(f"{path.name:44s} {words:6d} words  ~{minutes:4.1f} min")
        elif args.out_dir:
            args.out_dir.mkdir(parents=True, exist_ok=True)
            dest = args.out_dir / (path.stem + ".txt")
            dest.write_text(spoken, encoding="utf-8")
            print(f"wrote {dest}", file=sys.stderr)
        else:
            print(spoken)

    if args.stats and len(args.files) > 1:
        print(f"{'TOTAL':44s} {total_words:6d} words  "
              f"~{total_words / WORDS_PER_MINUTE / 60:4.1f} hours")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
