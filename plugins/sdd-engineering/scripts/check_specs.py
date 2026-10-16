#!/usr/bin/env python3
"""Structural checks for specs written in the current template.

WHAT THIS IS FOR. Some acceptance criteria look like "prompt behaviour" but are really
claims about the artifact on disk, and a script can read the artifact:

    sections    the section set from the template is present
    unique-ids  every `AC-N` identifier is unique within its spec
    test-plan   every `AC-N` is referenced in that spec's `## Test plan`
    index       the spec has a row in its directory's `README.md` index

The test-plan rule needs one convention to be checkable at all: each identifier must
appear LITERALLY in the test plan's first column. A range such as `AC-1..AC-5` reads fine
to a human and is invisible to anything that enumerates `AC*` by identifier, so ranges
are rejected by name, which makes the fix legible rather than a mystery mismatch.

WHICH SPECS ARE CHECKED. Only those carrying `## Acceptance criteria (EARS)`, except that a
`status: draft` spec or a spec named on the command line without that heading is a failure, and
every skipped file is named. That heading
is the discriminator for the current template, so older specs written before it are
exempt by construction rather than by a hardcoded list that would rot.

WHERE THE SECTION LIST COMES FROM. Parsed out of the fenced ```markdown block in the
template file, never copied into this script. The template is, in order of preference:
`--template` if given; `<spec-root>/README.md` if it carries a fenced template block; the
template bundled with this plugin at `skills/spec-authoring/references/spec-template.md`.
Add a section to the template and it is enforced on the next run.

CEILING, not a gap list. This checks the SHAPE of a spec: headings present, identifiers
unique, identifiers cross-referenced, index row present. It cannot tell whether a
criterion is well-formed EARS, whether the test named against it exists or passes, or
whether the spec describes anything true. Those stay prompt behaviour and review.
Anything not listed above is unchecked.

    python3 check_specs.py                         # every spec under ./specs and */specs
    python3 check_specs.py --root path/to/repo --spec-root docs/specs
    python3 check_specs.py specs/0003-export.md    # only these specs
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Sections the template lists but a spec may legitimately not carry.
#   [NEEDS CLARIFICATION] — deleted once its questions are answered.
#   Decisions            — added only after the user answers open questions.
OPTIONAL_SECTIONS = {"[NEEDS CLARIFICATION]", "Decisions"}

NEW_FORMAT_MARKER = "## Acceptance criteria (EARS)"

AC_RANGE = re.compile(r"AC-\d+\s*\.\.\s*AC-\d+")
AC_ID = re.compile(r"AC-(\d+)")
BOLD_AC = re.compile(r"\*\*(AC-\d+)\*\*")
TEMPLATE_FENCE = re.compile(r"^```markdown[ \t]*$(.*?)^```[ \t]*$", re.M | re.S)

BUNDLED_TEMPLATE = (
    Path(__file__).resolve().parent.parent
    / "skills" / "spec-authoring" / "references" / "spec-template.md"
)


def relative(path: Path, repo: Path | None) -> str:
    """Repo-relative path for messages, so output is pasteable as `file:line`."""
    if repo is None:
        return path.as_posix()
    try:
        return path.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def sections_from(text: str) -> list[str] | None:
    """The `## ` headings inside the first fenced ```markdown block, or None."""
    fence = TEMPLATE_FENCE.search(text)
    if not fence:
        return None
    return re.findall(r"^## (.+?)\s*$", fence.group(1), re.M)


def resolve_template(repo: Path, spec_root: str, template: str | None) -> tuple[Path, list[str]]:
    """Pick the template file and return it with its required section list.

    An explicit `--template` never falls back: a typo there must fail loudly, not
    silently check against a different template.
    """
    if template is not None:
        path = Path(template)
        if not path.is_absolute():
            path = repo / path
        if not path.is_file():
            raise SystemExit(f"--template {template!r} does not exist or is not a file.")
        sections = sections_from(path.read_text(encoding="utf-8"))
        if sections is None:
            raise SystemExit(
                f"{relative(path, repo)} has no ```markdown template block; this script "
                "reads the required section list from it, so there is nothing to check against."
            )
        return path, sections

    readme = repo / spec_root / "README.md"
    if readme.is_file():
        sections = sections_from(readme.read_text(encoding="utf-8"))
        if sections is not None:
            return readme, sections

    if not BUNDLED_TEMPLATE.is_file():
        raise SystemExit(
            f"No template found: {relative(readme, repo)} has no ```markdown template block "
            f"and the bundled template is missing at {BUNDLED_TEMPLATE}."
        )
    sections = sections_from(BUNDLED_TEMPLATE.read_text(encoding="utf-8"))
    if sections is None:
        raise SystemExit(f"The bundled template at {BUNDLED_TEMPLATE} has no ```markdown block.")
    return BUNDLED_TEMPLATE, sections


def section_body(text: str, name: str) -> str | None:
    """The body under `## <name>`, up to the next `## ` heading.

    Anchored at line start on purpose: splitting on the substring matches an inline
    mention of the heading inside a table cell and skips the real section. A heading is
    a line, not a substring.
    """
    match = re.search(rf"^## {re.escape(name)}\s*$(.*?)(?=^## |\Z)", text, re.M | re.S)
    return None if match is None else match.group(1)


def has_section(text: str, name: str) -> bool:
    return re.search(rf"^## {re.escape(name)}\s*$", text, re.M) is not None


def covers_cells(plan: str) -> list[str] | None:
    """The first column of the `## Test plan` table — the cells that claim coverage.

    Scanning the whole section would be both too generous and too strict: an `AC-7`
    mentioned anywhere in prose would count as covered, and a spec that documents the
    range rule would be flagged for quoting the notation it forbids.

    Returns None when the section has no table, so the caller can fall back to the whole
    section rather than silently treat a prose test plan as covering nothing.
    """
    cells: list[str] = []
    for line in plan.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        parts = [c.strip() for c in line.strip("|").split("|")]
        if not parts:
            continue
        first = parts[0]
        if first and set(first) <= {"-", ":"}:  # the |---|---| separator row
            continue
        if first.lower() in {"covers", "id", "criterion", "criteria"}:  # header row
            continue
        cells.append(first)
    return cells or None


def spec_dirs(repo: Path, spec_root: str) -> list[Path]:
    dirs = [repo / spec_root] + sorted(repo.glob(f"*/{spec_root}"))
    return [d for d in dirs if d.is_dir()]


def index_files(repo: Path, spec_root: str = "specs") -> dict[Path, str]:
    """Each spec directory's README.md text, keyed by resolved directory."""
    out: dict[Path, str] = {}
    for d in spec_dirs(repo, spec_root):
        readme = d / "README.md"
        if readme.is_file():
            out[d.resolve()] = readme.read_text(encoding="utf-8")
    return out


def spec_files(repo: Path, spec_root: str = "specs") -> list[Path]:
    found: list[Path] = []
    for d in spec_dirs(repo, spec_root):
        found += sorted(d.glob("[0-9]*.md"))
    return [p for p in found if p.name != "README.md"]


def check_spec(
    path: Path, text: str, required: list[str], index: str | None, repo: Path | None = None
) -> list[str]:
    """Return a list of failure strings for one spec. Empty means it passed."""
    problems: list[str] = []
    rel = relative(path, repo)

    # sections
    for name in required:
        if name in OPTIONAL_SECTIONS:
            continue
        if not has_section(text, name):
            problems.append(f"{rel}: missing section `## {name}` (sections)")

    criteria = BOLD_AC.findall(section_body(text, "Acceptance criteria (EARS)") or "")

    # unique-ids
    for ident in sorted(set(criteria), key=lambda s: int(s[3:])):
        if criteria.count(ident) > 1:
            problems.append(
                f"{rel}: `{ident}` is declared {criteria.count(ident)} times; "
                "identifiers are never reused, even after a criterion is deleted (unique-ids)"
            )

    # test-plan
    plan = section_body(text, "Test plan")
    if plan is None:
        if has_section(text, "Acceptance criteria (EARS)") and "Test plan" not in required:
            problems.append(f"{rel}: has criteria but no `## Test plan` (test-plan)")
    else:
        cells = covers_cells(plan)
        scanned = "\n".join(cells) if cells is not None else plan
        for found in AC_RANGE.findall(scanned):
            problems.append(
                f"{rel}: `## Test plan` claims coverage with the range `{found}`. "
                "Enumerate the identifiers instead; nothing expands a range, so a checker "
                "that enumerates criteria by identifier cannot see the ones it hides (test-plan)"
            )
        referenced = set(AC_ID.findall(scanned))
        for ident in sorted(set(criteria), key=lambda s: int(s[3:])):
            if ident[3:] not in referenced:
                problems.append(
                    f"{rel}: `{ident}` is never referenced in `## Test plan`; a "
                    "criterion no test names is untestable or unowned (test-plan)"
                )

    # index
    if index is None:
        problems.append(f"{rel}: its spec directory has no README.md to index it (index)")
    elif path.name not in index:
        problems.append(
            f"{rel}: no row for it in {relative(path.parent, repo)}/README.md; "
            "a spec nobody links is a spec nobody finds (index)"
        )

    return problems


def parse_args(argv: list[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        description="Structural checks for specs: sections, unique AC ids, "
        "test-plan coverage, index rows."
    )
    ap.add_argument("specs", nargs="*", help="check only these spec files (default: all)")
    ap.add_argument("--root", default=".", help="repository root (default: current directory)")
    ap.add_argument("--spec-root", default="specs",
                    help="spec directory relative to the root (default: specs)")
    ap.add_argument("--template",
                    help="file holding the fenced ```markdown template "
                    "(default: <spec-root>/README.md, else the bundled template)")
    return ap.parse_args(argv)


def is_draft(text: str) -> bool:
    """True when the frontmatter says `status: draft`."""
    if not text.startswith("---"):
        return False
    end = text.find("\n---", 3)
    head = text[3:end] if end > 0 else ""
    return re.search(r"^status:\s*['\"]?draft\b", head, re.M) is not None


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    repo = Path(args.root)
    if not repo.is_dir():
        print(f"--root {args.root!r} is not a directory.", file=sys.stderr)
        return 2
    template, required = resolve_template(repo, args.spec_root, args.template)
    indexes = index_files(repo, args.spec_root)
    print(f"template: {relative(template, repo)}")

    if args.specs:
        targets = []
        for s in args.specs:
            p = Path(s)
            if not p.is_absolute():
                p = repo / p
            if not p.is_file():
                print(f"FAIL: {s}: no such spec file")
                return 1
            targets.append(p)
    else:
        targets = spec_files(repo, args.spec_root)

    problems: list[str] = []
    checked = skipped = 0
    for path in targets:
        text = path.read_text(encoding="utf-8")
        if NEW_FORMAT_MARKER not in text:
            # A draft is being written now, so it must use the current template; so must a spec
            # named on the command line. Without this, a spec whose criteria heading is misspelt
            # passes by never being checked.
            if args.specs or is_draft(text):
                why = "named on the command line" if args.specs else "status: draft"
                line = (f"{relative(path, repo)}: has no `{NEW_FORMAT_MARKER}` heading ({why}), so none "
                        "of its sections would be checked. Use the template's headings exactly.")
                problems.append(line)
                print(f"FAIL: {line}")
                continue
            skipped += 1
            print(f"skipped (no `{NEW_FORMAT_MARKER}`, not a draft): {relative(path, repo)}")
            continue
        checked += 1
        found = check_spec(path, text, required, indexes.get(path.parent.resolve()), repo)
        problems += found
        if found:
            for line in found:
                print(f"FAIL: {line}")
        else:
            print(f"ok: {relative(path, repo)}")

    print(
        f"\n{checked} spec(s) in the current template checked, "
        f"{skipped} without `{NEW_FORMAT_MARKER}` skipped."
    )
    if problems:
        print(f"{len(problems)} problem(s). See this script's docstring for what is and is not checked.")
        return 1
    print("Sections, criterion identifiers, test-plan coverage and index rows are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
