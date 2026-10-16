#!/usr/bin/env python3
"""Tests for plugins/sdd-engineering/scripts/insights_for.py.

Every rule gets a PAIRED NEGATIVE: a filter that includes everything and a filter that
includes nothing both "work" on a one-sided suite, and this one decides what an agent
reads, so a silent over- or under-match is expensive either way.

Run from the marketplace root: python3 -m unittest discover -s test/python -v
"""

from __future__ import annotations

import io
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

sys.dont_write_bytecode = True
MARKETPLACE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(MARKETPLACE / "plugins" / "sdd-engineering" / "scripts"))

import insights_for  # noqa: E402

HEADER = """# Insights

Entry format:

```markdown
### YYYY-MM-DD — [tag] Short title
**Context:** what you were doing.
**Evidence:** `path/to/file.ts:42`
```

---

"""


def entry(title, evidence, applies=False):
    extra = "**Applies:** always\n" if applies else ""
    return (
        f"### {title}\n"
        f"**Context:** ctx.\n"
        f"**Insight:** fact.\n"
        f"{extra}"
        f"**Apply:** do the thing.\n"
        f"**Evidence:** {evidence}\n\n"
    )


class Repo:
    """A throwaway repo with INSIGHTS.md files at the given relative directories."""

    def __init__(self, root_entries="", **modules):
        self.dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.dir.name)
        (self.repo / "INSIGHTS.md").write_text(HEADER + root_entries, encoding="utf-8")
        for module, body in modules.items():
            d = self.repo / module.replace("__", "/")
            d.mkdir(parents=True, exist_ok=True)
            (d / "INSIGHTS.md").write_text(HEADER + body, encoding="utf-8")

    def titles(self, changed):
        es = insights_for.collect(self.repo)
        return [e.title for e in es if insights_for.relevant(e, changed)]

    def all_titles(self):
        return [e.title for e in insights_for.collect(self.repo)]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.dir.cleanup()


class DiscoveryTest(unittest.TestCase):
    def test_every_insights_file_is_found_without_a_package_list(self):
        with Repo(root_entries=entry("root", "`README.md:1`"),
                  api=entry("api", "`api/a.ts:1`"),
                  libs__billing=entry("billing", "`libs/billing/b.py:1`")) as r:
            sources = [p.relative_to(r.repo).as_posix() for p in insights_for.discover(r.repo)]
            self.assertEqual(sources, ["INSIGHTS.md", "api/INSIGHTS.md", "libs/billing/INSIGHTS.md"])

    def test_a_split_by_tag_is_found_and_scoped_like_its_parent(self):
        with Repo(api=entry("srv", "`api/orders/a.ts:1`")) as r:
            (r.repo / "api" / "INSIGHTS-llm.md").write_text(
                HEADER + entry("model quirk", "`api/llm/p.ts:1`"), encoding="utf-8")
            (r.repo / "api" / "NOTES.md").write_text(entry("not insights", "`api/a.ts:1`"),
                                                     encoding="utf-8")
            self.assertEqual(sorted(r.all_titles()), ["model quirk", "srv"])
            self.assertEqual(r.titles(["web/x.tsx"]), [])
            self.assertEqual(r.titles(["api/llm/q.ts"]), ["model quirk"])

    def test_dependency_and_build_dirs_are_skipped(self):
        with Repo(root_entries=entry("root", "`README.md:1`"),
                  node_modules__pkg=entry("dep", "`x.js:1`"),
                  dist=entry("built", "`x.js:1`"),
                  vendor__lib=entry("vendored", "`x.js:1`"),
                  web=entry("web", "`web/a.tsx:1`")) as r:
            self.assertEqual(sorted(r.all_titles()), ["root", "web"])

    def test_a_repo_with_no_insights_reports_nothing_to_read(self):
        with tempfile.TemporaryDirectory() as d:
            out = insights_for.report(insights_for.collect(Path(d)), ["api/a.ts"])
            self.assertIn("No INSIGHTS.md entries found", out)


class RoutingTest(unittest.TestCase):
    def test_the_format_example_in_the_header_is_not_an_entry(self):
        with Repo(root_entries=entry("real one", "`AGENTS.md:1`")) as r:
            self.assertEqual(r.all_titles(), ["real one"])

    def test_an_entry_citing_a_touched_directory_matches(self):
        body = entry("orders thing", "`api/src/orders/service.ts:10`")
        with Repo(api=body) as r:
            self.assertEqual(r.titles(["api/src/orders/routes.ts"]), ["orders thing"])

    def test_an_entry_citing_an_untouched_area_does_not_match(self):
        body = entry("orders thing", "`api/src/orders/service.ts:10`")
        with Repo(api=body) as r:
            self.assertEqual(r.titles(["api/src/db/schema/orders.ts"]), [])

    def test_a_module_file_is_skipped_when_its_module_is_untouched(self):
        with Repo(api=entry("srv", "`api/src/a.ts:1`"),
                  web=entry("cli", "`web/src/b.tsx:1`")) as r:
            self.assertEqual(r.titles(["web/src/b.tsx"]), ["cli"])
            self.assertEqual(r.titles(["api/src/a.ts"]), ["srv"])

    def test_the_module_gate_holds_even_when_the_entry_cites_the_other_module(self):
        """An api entry that cites a web path must not leak into a web-only change."""
        body = entry("api note about a web file", "`web/src/b.tsx:1`")
        with Repo(api=body) as r:
            self.assertEqual(r.titles(["web/src/b.tsx"]), [])
            self.assertEqual(r.titles(["api/src/a.ts", "web/src/b.tsx"]),
                             ["api note about a web file"])

    def test_a_nested_module_gates_on_its_own_directory(self):
        body = entry("billing", "`libs/billing/src/a.py:1`")
        with Repo(libs__billing=body) as r:
            self.assertEqual(r.titles(["libs/other/x.py"]), [])
            self.assertEqual(r.titles(["libs/billing/src/a.py"]), ["billing"])

    def test_a_module_prefix_is_not_a_match(self):
        """`api/` must not claim `api-gateway/`."""
        with Repo(api=entry("api", "`api/a.ts:1`")) as r:
            self.assertEqual(r.titles(["api-gateway/a.ts"]), [])

    def test_applies_always_matches_regardless_of_path(self):
        body = entry("universal lesson", "`AGENTS.md:3`", applies=True)
        with Repo(root_entries=body) as r:
            self.assertEqual(r.titles(["web/src/x.tsx"]), ["universal lesson"])
            self.assertEqual(r.titles(["api/src/y.ts"]), ["universal lesson"])

    def test_without_the_marker_the_same_entry_would_be_missed(self):
        body = entry("universal lesson", "`AGENTS.md:3`", applies=False)
        with Repo(root_entries=body) as r:
            self.assertEqual(r.titles(["web/src/x.tsx"]), [])

    def test_an_entry_citing_no_path_is_always_included(self):
        body = entry("no citable path", "a measurement, no file")
        with Repo(root_entries=body) as r:
            self.assertEqual(r.titles(["web/src/x.tsx"]), ["no citable path"])

    def test_citations_in_other_languages_are_recognised(self):
        body = entry("go thing", "`svc/internal/store.go:12`")
        with Repo(root_entries=body) as r:
            self.assertEqual(r.titles(["svc/internal/handler.go"]), ["go thing"])
            self.assertEqual(r.titles(["web/src/x.tsx"]), [])


class ReportTest(unittest.TestCase):
    def test_the_report_lists_every_excluded_title(self):
        with Repo(root_entries=entry("kept", "`web/src/a.tsx:1`") +
                  entry("routed away", "`api/src/b.ts:1`")) as r:
            out = insights_for.report(insights_for.collect(r.repo), ["web/src/a.tsx"])
            self.assertIn("kept", out)
            self.assertIn("routed away", out, "an excluded entry vanished from the index")
            self.assertIn("## Index of the other 1 entries", out)

    def test_the_report_flags_an_in_scope_file_that_matched_nothing(self):
        with Repo(root_entries=entry("elsewhere", "`api/src/b.ts:1`")) as r:
            out = insights_for.report(insights_for.collect(r.repo), ["web/src/a.tsx"])
            self.assertIn("nothing matched although this file is in scope", out)

    def test_an_untouched_module_is_not_flagged_as_a_concern(self):
        with Repo(root_entries=entry("root", "`web/src/a.tsx:1`"),
                  api=entry("srv", "`api/src/b.ts:1`")) as r:
            out = insights_for.report(insights_for.collect(r.repo), ["web/src/a.tsx"])
            self.assertIn("(module not touched)", out)


class MainTest(unittest.TestCase):
    def run_main(self, *args):
        buf = io.StringIO()
        with redirect_stdout(buf), redirect_stderr(io.StringIO()):
            code = insights_for.main(list(args))
        return code, buf.getvalue()

    def test_root_and_paths(self):
        with Repo(api=entry("srv", "`api/src/a.ts:1`")) as r:
            code, out = self.run_main("--root", str(r.repo), "./api/src/a.ts")
            self.assertEqual(code, 0)
            self.assertIn("`api/INSIGHTS.md:", out)

    def test_absolute_paths_under_the_root_are_normalized(self):
        with Repo(api=entry("srv", "`api/src/a.ts:1`")) as r:
            self.assertEqual(insights_for.normalize(r.repo, [str(r.repo / "api" / "src" / "a.ts")]),
                             ["api/src/a.ts"])

    def test_no_paths_is_a_usage_error(self):
        with Repo() as r:
            code, _ = self.run_main("--root", str(r.repo))
            self.assertEqual(code, 2)


class ChangedFromGitTest(unittest.TestCase):
    """The argv handling of `--base`, against a throwaway git repo."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.repo = Path(cls.tmp.name)
        git = ["git", "-C", str(cls.repo), "-c", "user.email=t@example.com", "-c", "user.name=t"]
        subprocess.run(git + ["init", "-q"], check=True)
        (cls.repo / "a.txt").write_text("a\n", encoding="utf-8")
        subprocess.run(git + ["add", "a.txt"], check=True)
        subprocess.run(git + ["commit", "-q", "-m", "init"], check=True)
        (cls.repo / "a.txt").write_text("b\n", encoding="utf-8")
        (cls.repo / "new.txt").write_text("n\n", encoding="utf-8")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_an_option_shaped_base_is_refused(self):
        """`--base --output=<path>` must never reach git: that flag writes and truncates."""
        target = self.repo / "pwned"
        for hostile in (f"--output={target}", "-o", "--no-index"):
            with self.subTest(base=hostile):
                with self.assertRaises(SystemExit) as caught:
                    insights_for.changed_from_git(self.repo, hostile)
                self.assertIn("not an option", str(caught.exception))
        self.assertFalse(target.exists())

    def test_a_ref_that_does_not_resolve_is_refused(self):
        with self.assertRaises(SystemExit) as caught:
            insights_for.changed_from_git(self.repo, "no-such-ref-xyz")
        self.assertIn("does not resolve", str(caught.exception))

    def test_a_real_ref_is_accepted_and_includes_untracked_files(self):
        paths = insights_for.changed_from_git(self.repo, "HEAD")
        self.assertIn("a.txt", paths)
        self.assertIn("new.txt", paths)


if __name__ == "__main__":
    unittest.main(verbosity=2)
