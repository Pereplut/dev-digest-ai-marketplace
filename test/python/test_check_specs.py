#!/usr/bin/env python3
"""Tests for plugins/sdd-engineering/scripts/check_specs.py.

Every rule gets a PAIRED NEGATIVE: the failing case and the same fixture with only the
offending part fixed. A guard suite that only ever asserts the happy path passes at full
green while the hole is open.

Run from the marketplace root: python3 -m unittest discover -s test/python -v
"""

from __future__ import annotations

import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.dont_write_bytecode = True
MARKETPLACE = Path(__file__).resolve().parents[2]
SCRIPTS = MARKETPLACE / "plugins" / "sdd-engineering" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import check_specs  # noqa: E402

TEMPLATE_README = """# specs

File name: `NNNN-short-name.md`. Template:

```markdown
---
title: Example
status: draft
---

## Problem & why
## Goals / Non-goals
## Acceptance criteria (EARS)
## Test plan
## Phases
```

## Index
| Spec | Status |
|---|---|
| [0001-example](0001-example.md) | draft |
"""

GOOD_SPEC = """---
title: Example
status: draft
---

## Problem & why
Something is wrong.

## Goals / Non-goals
Goals.

## Acceptance criteria (EARS)

| ID | Criterion | Pattern |
|---|---|---|
| **AC-1** | The API shall do a thing. | ubiquitous |
| **AC-2** | WHEN x, the API shall do another thing. | event-driven |

## Test plan

| Covers | Test |
|---|---|
| AC-1 | `test_one` |
| AC-2 | `test_two` |

## Phases

| Phase | Date | Note |
|---|---|---|
| Initiation | | |
"""


class Fixture:
    """A throwaway repo with <spec_root>/README.md and one spec."""

    def __init__(self, spec_text: str = GOOD_SPEC, readme: str | None = TEMPLATE_README,
                 name: str = "0001-example.md", spec_root: str = "specs"):
        self.dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.dir.name)
        self.spec_root = spec_root
        d = self.repo / spec_root
        d.mkdir(parents=True)
        if readme is not None:
            (d / "README.md").write_text(readme, encoding="utf-8")
        (d / name).write_text(spec_text, encoding="utf-8")

    def run(self, template: str | None = None) -> list[str]:
        _, required = check_specs.resolve_template(self.repo, self.spec_root, template)
        indexes = check_specs.index_files(self.repo, self.spec_root)
        problems: list[str] = []
        for path in check_specs.spec_files(self.repo, self.spec_root):
            text = path.read_text(encoding="utf-8")
            if check_specs.NEW_FORMAT_MARKER not in text:
                continue
            problems += check_specs.check_spec(
                path, text, required, indexes.get(path.parent.resolve()), self.repo
            )
        return problems

    def main(self, *args: str) -> tuple[int, str]:
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = check_specs.main(["--root", str(self.repo), *args])
        return code, buf.getvalue()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.dir.cleanup()


class SpecCheckTest(unittest.TestCase):
    def assertProblem(self, problems: list[str], needle: str):
        self.assertTrue(
            any(needle in p for p in problems),
            f"expected a problem containing {needle!r}, got {problems}",
        )

    # --- the baseline. If this ever fails, every negative below is meaningless. ---

    def test_a_well_formed_spec_passes(self):
        with Fixture() as f:
            self.assertEqual(f.run(), [])

    # --- sections, paired ---

    def test_a_missing_section_fails(self):
        with Fixture(GOOD_SPEC.replace("## Goals / Non-goals\nGoals.\n", "")) as f:
            self.assertProblem(f.run(), "missing section `## Goals / Non-goals` (sections)")

    def test_the_required_list_comes_from_the_readme_template(self):
        """Adding a section to the template makes it required, with no code change."""
        readme = TEMPLATE_README.replace(
            "## Acceptance criteria (EARS)", "## Untrusted inputs\n## Acceptance criteria (EARS)"
        )
        with Fixture(readme=readme) as f:
            self.assertProblem(f.run(), "missing section `## Untrusted inputs` (sections)")
        fixed = GOOD_SPEC.replace(
            "## Acceptance criteria (EARS)",
            "## Untrusted inputs\nNone.\n\n## Acceptance criteria (EARS)",
        )
        with Fixture(fixed, readme=readme) as f:
            self.assertEqual(f.run(), [])

    def test_an_optional_section_is_not_required(self):
        readme = TEMPLATE_README.replace("## Test plan", "## [NEEDS CLARIFICATION]\n## Test plan")
        with Fixture(readme=readme) as f:
            self.assertEqual(f.run(), [])

    # --- unique-ids, paired ---

    def test_a_reused_identifier_fails(self):
        with Fixture(GOOD_SPEC.replace("| **AC-2** |", "| **AC-1** |")) as f:
            self.assertProblem(f.run(), "`AC-1` is declared 2 times")

    def test_list_form_criteria_are_read_too(self):
        listed = GOOD_SPEC.replace(
            "| ID | Criterion | Pattern |\n|---|---|---|\n"
            "| **AC-1** | The API shall do a thing. | ubiquitous |\n"
            "| **AC-2** | WHEN x, the API shall do another thing. | event-driven |",
            "- **AC-1** The API shall do a thing.\n- **AC-1** WHEN x, the API shall do more.",
        )
        with Fixture(listed) as f:
            self.assertProblem(f.run(), "`AC-1` is declared 2 times")

    # --- test-plan coverage and the range rule, paired ---

    def test_a_criterion_absent_from_the_test_plan_fails(self):
        with Fixture(GOOD_SPEC.replace("| AC-2 | `test_two` |\n", "")) as f:
            self.assertProblem(f.run(), "`AC-2` is never referenced in `## Test plan`")

    def test_range_notation_is_rejected_even_though_it_covers_every_criterion(self):
        ranged = GOOD_SPEC.replace(
            "| AC-1 | `test_one` |\n| AC-2 | `test_two` |", "| AC-1..AC-2 | a live run |"
        )
        with Fixture(ranged) as f:
            self.assertProblem(f.run(), "claims coverage with the range `AC-1..AC-2`")

    def test_the_range_rule_reads_the_covers_column_not_the_prose(self):
        """A spec may document the notation it forbids without tripping the rule."""
        documented = GOOD_SPEC.replace(
            "| AC-2 | `test_two` |",
            "| AC-2 | `test_two`, which rejects range notation such as `AC-1..AC-9` |",
        )
        with Fixture(documented) as f:
            self.assertEqual(f.run(), [], "the notation was flagged in prose rather than in Covers")

    def test_an_identifier_only_in_prose_does_not_count_as_covered(self):
        prose_only = GOOD_SPEC.replace(
            "| AC-2 | `test_two` |", "| AC-1 | also exercises AC-2 incidentally |"
        )
        with Fixture(prose_only) as f:
            self.assertProblem(f.run(), "`AC-2` is never referenced in `## Test plan`")

    def test_enumerating_the_same_criteria_passes(self):
        enumerated = GOOD_SPEC.replace(
            "| AC-1 | `test_one` |\n| AC-2 | `test_two` |", "| AC-1, AC-2 | a live run |"
        )
        with Fixture(enumerated) as f:
            self.assertEqual(f.run(), [])

    def test_a_missing_test_plan_fails(self):
        without = GOOD_SPEC.split("## Test plan")[0] + "## Phases\n\n| Phase |\n|---|\n"
        with Fixture(without) as f:
            self.assertProblem(f.run(), "missing section `## Test plan` (sections)")

    def test_an_inline_mention_of_a_heading_is_not_a_heading(self):
        """`## Test plan` named inside a table cell must not be parsed as the section."""
        with_mention = GOOD_SPEC.replace(
            "## Goals / Non-goals\nGoals.",
            "## Goals / Non-goals\n\n| Question | Decision |\n|---|---|\n"
            "| Keep the wrapper? | Yes, frontmatter, `## Test plan` and `## Phases` stay |",
        )
        with Fixture(with_mention) as f:
            self.assertEqual(f.run(), [], "an inline mention was parsed as the heading again")

    # --- index, paired ---

    def test_a_spec_with_no_index_row_fails(self):
        with Fixture(readme=TEMPLATE_README.replace(
            "| [0001-example](0001-example.md) | draft |\n", ""
        )) as f:
            self.assertProblem(f.run(), "no row for it in specs/README.md")

    # --- the exemption for specs predating the template ---

    def test_a_spec_predating_the_template_is_skipped(self):
        old = "---\ntitle: Old\nstatus: done\n---\n\n## Problem\n## Scope\n## Design\n"
        with Fixture(old) as f:
            self.assertEqual(f.run(), [], "a pre-template spec must not be checked")


class ArgumentsTest(unittest.TestCase):
    """--root, --spec-root, --template, positional specs, and the bundled fallback."""

    def test_defaults_check_specs_under_the_root(self):
        with Fixture() as f:
            code, out = f.main()
            self.assertEqual(code, 0, out)
            self.assertIn("ok: specs/0001-example.md", out)
            self.assertIn("template: specs/README.md", out)

    def test_a_failing_spec_exits_non_zero(self):
        with Fixture(GOOD_SPEC.replace("| AC-2 | `test_two` |\n", "")) as f:
            code, out = f.main()
            self.assertEqual(code, 1)
            self.assertIn("FAIL:", out)

    def test_a_custom_spec_root(self):
        with Fixture(spec_root="docs/specs") as f:
            code, out = f.main("--spec-root", "docs/specs")
            self.assertEqual(code, 0, out)
            self.assertIn("ok: docs/specs/0001-example.md", out)

    def test_package_spec_dirs_are_scanned(self):
        with Fixture() as f:
            pkg = f.repo / "api" / "specs"
            pkg.mkdir(parents=True)
            (pkg / "README.md").write_text(
                TEMPLATE_README.replace("draft |\n", "draft |\n| [0002-pkg](0002-pkg.md) | draft |\n"),
                encoding="utf-8",
            )
            (pkg / "0002-pkg.md").write_text(GOOD_SPEC.replace("| AC-2 | `test_two` |\n", ""),
                                             encoding="utf-8")
            code, out = f.main()
            self.assertEqual(code, 1)
            self.assertIn("api/specs/0002-pkg.md: `AC-2` is never referenced", out)

    def test_positional_specs_limit_the_check(self):
        with Fixture() as f:
            (f.repo / "specs" / "0002-broken.md").write_text(
                GOOD_SPEC.replace("| AC-2 | `test_two` |\n", ""), encoding="utf-8"
            )
            code, out = f.main()
            self.assertEqual(code, 1, "the broken spec should fail a full scan")
            code, out = f.main("specs/0001-example.md")
            self.assertEqual(code, 0, out)
            self.assertNotIn("0002-broken", out)

    def test_a_missing_positional_spec_fails(self):
        with Fixture() as f:
            code, out = f.main("specs/0099-nope.md")
            self.assertEqual(code, 1)
            self.assertIn("no such spec file", out)

    def test_an_explicit_template_is_used(self):
        with Fixture() as f:
            tpl = f.repo / "tpl.md"
            tpl.write_text("```markdown\n## Problem & why\n## Rollout\n```\n", encoding="utf-8")
            code, out = f.main("--template", "tpl.md")
            self.assertEqual(code, 1)
            self.assertIn("missing section `## Rollout`", out)

    def test_a_missing_explicit_template_does_not_fall_back(self):
        with Fixture() as f:
            with self.assertRaises(SystemExit) as caught:
                f.main("--template", "nope.md")
            self.assertIn("does not exist", str(caught.exception))

    def test_no_readme_falls_back_to_the_bundled_template(self):
        with Fixture(readme=None) as f:
            path, sections = check_specs.resolve_template(f.repo, "specs", None)
            self.assertEqual(path, check_specs.BUNDLED_TEMPLATE)
            self.assertIn("Untrusted inputs", sections)

    def test_a_readme_without_a_template_block_falls_back_too(self):
        with Fixture(readme="# Specs\n\n| ID | Title |\n|---|---|\n") as f:
            path, _ = check_specs.resolve_template(f.repo, "specs", None)
            self.assertEqual(path, check_specs.BUNDLED_TEMPLATE)

    def test_a_readme_with_a_template_block_wins_over_the_bundle(self):
        with Fixture() as f:
            path, _ = check_specs.resolve_template(f.repo, "specs", None)
            self.assertEqual(path.name, "README.md")


class BundledTemplateTest(unittest.TestCase):
    """The template shipped in spec-authoring must parse, or the fallback is vacuous."""

    def test_the_bundled_template_parses(self):
        sections = check_specs.sections_from(
            check_specs.BUNDLED_TEMPLATE.read_text(encoding="utf-8")
        )
        self.assertIsNotNone(sections)
        for name in ("Acceptance criteria (EARS)", "Test plan", "Untrusted inputs", "Phases"):
            self.assertIn(name, sections)


if __name__ == "__main__":
    unittest.main(verbosity=2)
