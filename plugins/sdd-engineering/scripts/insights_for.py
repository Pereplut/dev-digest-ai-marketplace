#!/usr/bin/env python3
"""Route INSIGHTS.md entries to the paths a task actually touches.

WHY. "Read every INSIGHTS.md that might apply" gets more expensive every session,
because the files are append-only, and most entries are irrelevant to any given task.
Reading all of them can cost more than the code the agent came to change.

WHICH FILES. Every `INSIGHTS.md` (and `INSIGHTS-<tag>.md` split) under `--root`, discovered by walking the tree (dependency,
build and VCS directories are skipped). There is no package list to maintain. A file at
the root applies to every change; a file in `some/dir/INSIGHTS.md` is in scope only when a
changed path lies under `some/dir/`.

HOW RELEVANCE IS DERIVED, not declared. Every entry's `**Evidence:**` line is mandatory and
carries `path:line` citations, so the routing data already exists and cannot rot. An entry
matches when it cites a changed path, or a path in the same directory subtree.

NOTHING IS HIDDEN. The report has two parts: the entries that match, with
`file:start-end` so you can read just those, and then the TITLE of every entry it
excluded, so you always see what exists and can pull any body on a hunch.

CEILING, not a gap list. It matches on paths an entry cites. It therefore UNDER-ROUTES a
lesson that is universal but happens to cite one file. That is why excluded titles are
printed rather than dropped, why an entry citing no path at all is always included, and
why `**Applies:** always` exists as a declared override. It does not judge relevance by
meaning and it does not rank.

THE SAVING SCALES WITH FOCUS. One component routes most entries away; a whole-branch diff
across every module legitimately needs almost every entry. Pass the paths of the step you
are on. The report says so itself when it filters less than a fifth away.

    python3 insights_for.py api/src/orders/service.ts web/src/Cart.tsx
    python3 insights_for.py --base origin/main
    python3 insights_for.py --root path/to/repo api/src/orders/service.ts
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ENTRY = re.compile(r"^### (.+)$", re.M)
EXTENSIONS = (
    "ts|tsx|js|jsx|mjs|cjs|py|sh|bash|json|jsonc|yaml|yml|toml|ini|cfg|md|mdx|sql|"
    "go|rs|java|kt|kts|scala|rb|php|cs|swift|c|h|cc|cpp|hpp|m|ex|exs|erl|clj|lua|"
    "css|scss|sass|less|html|vue|svelte|graphql|gql|proto|tf|lock|xml|gradle|env|txt"
)
CITED = re.compile(rf"`([A-Za-z0-9_./\-]+\.(?:{EXTENSIONS}))(?![A-Za-z0-9])")

# Directories never searched for INSIGHTS.md: dependencies, build output, VCS, vendored code.
SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", "vendor", ".venv", "venv",
    "__pycache__", ".next", ".turbo", "coverage", "target",
}


def strip_fences(text: str) -> str:
    """Blank out fenced code blocks, keeping line numbers intact.

    An INSIGHTS.md header usually shows the entry format inside a fence, complete with a
    `### YYYY-MM-DD — [tag] Short title` line. Parsing that as a real entry would put a
    phantom row in the index.
    """
    out, fenced = [], False
    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            fenced = not fenced
            out.append("")
            continue
        out.append("" if fenced else line)
    return "\n".join(out)


class Entry:
    def __init__(self, source: str, title: str, start: int, end: int, body: str):
        self.source = source  # repo-relative path of the INSIGHTS.md it came from
        self.title = title
        self.start = start  # 1-based line of the `### ` heading
        self.end = end
        self.bytes = len(body)
        evidence = body.split("**Evidence:**")[-1] if "**Evidence:**" in body else ""
        self.cited = set(CITED.findall(evidence))
        # The one declared escape from path routing, for a lesson that is universal but
        # cites one file. Derived routing cannot infer this.
        self.always = bool(re.search(r"\*\*Applies:\*\*\s*always", body))

    @property
    def scope(self) -> str:
        """The directory this entry's file governs; "" for the repo root."""
        return dirname(self.source)


def discover(repo: Path) -> list[Path]:
    """Every INSIGHTS.md (and INSIGHTS-<tag>.md split) under `repo`, root files first."""
    found: list[Path] = []
    for current, dirs, files in os.walk(repo):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(files):
            if is_insights_file(name):
                found.append(Path(current) / name)
    root = repo / "INSIGHTS.md"
    return sorted(found, key=lambda p: (dirname(p.relative_to(repo).as_posix()) != "",
                                        p != root, p.relative_to(repo).as_posix()))


def is_insights_file(name: str) -> bool:
    """`INSIGHTS.md`, or a split of one by tag such as `INSIGHTS-llm.md`."""
    return name == "INSIGHTS.md" or (name.startswith("INSIGHTS-") and name.endswith(".md"))


def collect(repo: Path) -> list[Entry]:
    out: list[Entry] = []
    for path in discover(repo):
        text = strip_fences(path.read_text(encoding="utf-8"))
        rel = path.relative_to(repo).as_posix()
        marks = list(ENTRY.finditer(text))
        for i, m in enumerate(marks):
            stop = marks[i + 1].start() if i + 1 < len(marks) else len(text)
            line = text.count("\n", 0, m.start()) + 1
            end = text.count("\n", 0, stop) + 1
            out.append(Entry(rel, m.group(1), line, end, text[m.start():stop]))
    return out


def dirname(p: str) -> str:
    return p.rsplit("/", 1)[0] if "/" in p else ""


def under(path: str, scope: str) -> bool:
    return scope == "" or path == scope or path.startswith(scope + "/")


def in_scope(scope: str, changed: list[str]) -> bool:
    return any(under(c, scope) for c in changed)


def relevant(entry: Entry, changed: list[str]) -> bool:
    """Does this entry bear on any changed path?"""
    if entry.always:
        return True  # declared universal, overrides path routing
    if not in_scope(entry.scope, changed):
        return False  # a module's own insights, module untouched
    if not entry.cited:
        return True  # cites no path: fail safe toward including it
    for cited in entry.cited:
        cd = dirname(cited)
        for c in changed:
            chd = dirname(c)
            if cited == c:
                return True
            if cd and (chd == cd or chd.startswith(cd + "/") or cd.startswith(chd + "/")):
                return True
    return False


def normalize(repo: Path, paths: list[str]) -> list[str]:
    """Repo-relative POSIX paths; `./x` and absolute paths under the root are accepted."""
    out: list[str] = []
    root = repo.resolve()
    for p in paths:
        q = Path(p)
        if q.is_absolute():
            try:
                q = q.resolve().relative_to(root)
            except ValueError:
                pass
        s = q.as_posix()
        while s.startswith("./"):
            s = s[2:]
        out.append(s.rstrip("/"))
    return [s for s in out if s and s != "."]


def changed_from_git(repo: Path, base: str) -> list[str]:
    """Paths changed against `base`, plus untracked files.

    `base` comes from argv, and git parses options anywhere before the end-of-options
    marker, so a `base` beginning with `-` would be read as a FLAG, not a revision, and
    `git diff` has flags that write and truncate a path (`--output=`). Without the guard
    below, `--base --output=<file>` would turn this read-only tool into one that clobbers
    that file.

    `--end-of-options` (git >= 2.24) is the right separator, not a bare `--`: `--` would
    make git read `base` as a pathspec rather than a revision.
    """
    if base.startswith("-"):
        raise SystemExit(
            f"--base must be a git revision, not an option: {base!r}. "
            "git reads a leading '-' as a flag, and some git flags write files."
        )
    resolved = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--verify", "--quiet",
         "--end-of-options", f"{base}^{{commit}}"],
        capture_output=True, text=True, check=False,
    )
    if resolved.returncode != 0:
        raise SystemExit(
            f"--base {base!r} does not resolve to a commit in {repo}. "
            "Left unchecked this returns an empty path list and a report that looks fine."
        )
    out = subprocess.run(
        ["git", "-C", str(repo), "diff", "--name-only", "--end-of-options", base],
        capture_output=True, text=True, check=False,
    )
    tracked = [l.strip() for l in out.stdout.splitlines() if l.strip()]
    untracked = subprocess.run(
        ["git", "-C", str(repo), "ls-files", "--others", "--exclude-standard"],
        capture_output=True, text=True, check=False,
    )
    return tracked + [l.strip() for l in untracked.stdout.splitlines() if l.strip()]


def report(entries: list[Entry], changed: list[str]) -> str:
    hit = [e for e in entries if relevant(e, changed)]
    miss = [e for e in entries if e not in hit]
    read_cost = sum(e.bytes for e in hit)
    all_cost = sum(e.bytes for e in entries)
    lines: list[str] = []

    lines.append(f"# INSIGHTS for {len(changed)} changed path(s)")
    lines.append("")
    if not entries:
        lines.append("No INSIGHTS.md entries found in this repository; nothing to read.")
        return "\n".join(lines)
    lines.append(
        f"{len(hit)} of {len(entries)} entries bear on these paths. Read those bodies; the rest "
        "are listed by title below so you can pull any of them if a title looks relevant."
    )
    lines.append(
        "Routing is by the paths each entry's `**Evidence:**` line cites, so a universal lesson "
        "that happens to cite one file can be under-routed; the titles are the backstop."
    )
    lines.append("")
    lines.append("## Read these")
    lines.append("")
    current = None
    for e in hit:
        if e.source != current:
            current = e.source
            lines.append(f"**{e.source}**")
        lines.append(f"- `{e.source}:{e.start}-{e.end}` — {e.title}")
    if not hit:
        lines.append("_none matched; read the titles below._")
    lines.append("")
    lines.append(f"## Index of the other {len(miss)} entries (titles only)")
    lines.append("")
    current = None
    for e in miss:
        if e.source != current:
            current = e.source
            lines.append(f"**{e.source}**")
        lines.append(f"- {e.title}  (`:{e.start}`)")
    lines.append("")
    lines.append("## Per file")
    lines.append("")
    for src in dict.fromkeys(e.source for e in entries):
        h = sum(1 for e in hit if e.source == src)
        n = sum(1 for e in entries if e.source == src)
        if not in_scope(dirname(src), changed):
            note = "  (module not touched)"
        elif h == 0:
            note = "  <- nothing matched although this file is in scope; skim its titles"
        else:
            note = ""
        lines.append(f"- `{src}`: {h}/{n} matched{note}")
    lines.append("")
    saved = all_cost - read_cost
    lines.append(
        f"Bodies to read: {read_cost} bytes (~{read_cost // 4} tokens). "
        f"All bodies would be {all_cost} (~{all_cost // 4}); this routes away "
        f"{saved} bytes (~{saved // 4} tokens)."
    )
    if len(hit) / len(entries) > 0.8:
        lines.append("")
        lines.append(
            f"**This filtered almost nothing** ({len(hit)}/{len(entries)}). That is what a wide "
            f"path set does: {len(changed)} paths across several modules legitimately touch most "
            "entries. Pass the paths of the step you are on rather than a whole branch diff."
        )
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="Print the INSIGHTS.md entries that bear on the given paths, "
        "plus the titles of the rest."
    )
    ap.add_argument("paths", nargs="*", help="changed paths, relative to the root")
    ap.add_argument("--root", default=".", help="repository root (default: current directory)")
    ap.add_argument("--base", metavar="REF",
                    help="use the paths changed against this git revision, plus untracked files")
    args = ap.parse_args(argv)

    repo = Path(args.root)
    if not repo.is_dir():
        print(f"--root {args.root!r} is not a directory.", file=sys.stderr)
        return 2
    changed = normalize(repo, args.paths)
    if args.base is not None:
        changed += changed_from_git(repo, args.base)
    if not changed:
        ap.print_usage(sys.stderr)
        print("give at least one changed path, or --base <ref>.", file=sys.stderr)
        return 2
    print(report(collect(repo), changed))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
