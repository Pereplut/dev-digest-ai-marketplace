#!/usr/bin/env python3
"""Tests for plugins/sdd-engineering/skills/workflow-retro/scripts/analyze_journals.py.

The skill's first rule is "never report a number you did not read from a tool result",
so the script is tested for what it refuses to invent as much as for what it sums.

Run from the marketplace root: python3 -m unittest discover -s test/python -v
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

sys.dont_write_bytecode = True
MARKETPLACE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(MARKETPLACE / "plugins" / "sdd-engineering" / "skills"
                       / "workflow-retro" / "scripts"))

import analyze_journals  # noqa: E402

ROWS = [
    {"order": 1, "agent": "researcher", "label": "a", "tokens": 1000, "tools": 10,
     "ms": 3000, "parallel_with": [2, 3], "outcome": "returned"},
    {"order": 2, "agent": "researcher", "label": "b", "tokens": 2000, "tools": 20,
     "ms": 5000, "parallel_with": [1, 3], "outcome": "returned"},
    {"order": 3, "agent": "researcher", "label": "c", "tokens": 500, "tools": 5,
     "ms": 1000, "parallel_with": [1, 2], "outcome": "late"},
    {"order": 4, "agent": "spec-creator", "label": "write", "tokens": 4000, "tools": 12,
     "ms": 9000, "parallel_with": [], "outcome": "returned"},
]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")


def run(*args: str) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = analyze_journals.main(list(args))
    return code, out.getvalue(), err.getvalue()


class RunJournalTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_default_input_is_the_retro_directory(self):
        write_jsonl(self.root / ".sdd" / "retro" / "s1.runs.jsonl", ROWS)
        code, out, _ = run("--root", str(self.root), "--json")
        self.assertEqual(code, 0)
        data = json.loads(out)
        self.assertEqual(len(data["run_journals"]), 1)
        s = data["run_journals"][0]
        self.assertEqual(s["session"], "s1")
        self.assertEqual(s["agents"], 4)
        self.assertEqual(s["totals"], {"tokens": 7500, "tools": 47, "ms": 18000})
        self.assertEqual(s["outcomes"], {"returned": 3, "late": 1})

    def test_parallel_groups_and_the_derived_wall(self):
        s = analyze_journals.summarize_runs(Path("s.runs.jsonl"), ROWS)
        self.assertEqual([g["orders"] for g in s["parallel_groups"]], [[1, 2, 3], [4]])
        # slowest of the first group (5000) + the lone agent (9000)
        self.assertEqual(s["derived"]["serial_wall_ms"], 14000)
        self.assertEqual(s["derived"]["parallelism"], round(18000 / 14000, 2))
        self.assertIn("derived", s["derived"]["note"])

    def test_a_missing_figure_is_not_measured_not_zero(self):
        rows = [dict(ROWS[0]), dict(ROWS[3])]
        del rows[1]["ms"]
        s = analyze_journals.summarize_runs(Path("s.runs.jsonl"), rows)
        self.assertEqual(s["not_measured"], {"ms": [4]})
        self.assertIsNone(s["derived"]["serial_wall_ms"], "a wall was invented from a gap")
        self.assertIsNone(s["derived"]["parallelism"])
        self.assertEqual(s["totals"]["ms"], 3000)

    def test_the_complete_rows_do_produce_a_wall(self):
        """The paired positive for the case above."""
        s = analyze_journals.summarize_runs(Path("s.runs.jsonl"), [ROWS[0], ROWS[3]])
        self.assertEqual(s["not_measured"], {})
        self.assertIsNotNone(s["derived"]["serial_wall_ms"])

    def test_duplicate_orders_are_reported(self):
        rows = [ROWS[0], dict(ROWS[1], order=1)]
        s = analyze_journals.summarize_runs(Path("s.runs.jsonl"), rows)
        self.assertEqual(s["duplicate_orders"], [1])

    def test_human_output_names_not_measured(self):
        rows = [dict(ROWS[0])]
        del rows[0]["tokens"]
        write_jsonl(self.root / ".sdd" / "retro" / "s2.runs.jsonl", rows)
        code, out, _ = run("--root", str(self.root))
        self.assertEqual(code, 0)
        self.assertIn("not measured: tokens for [1]", out)

    def test_nothing_to_read_exits_non_zero(self):
        code, _, err = run("--root", str(self.root))
        self.assertEqual(code, 1)
        self.assertIn("no readable journal rows", err)


class TranscriptTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name) / "subagents"

    def tearDown(self):
        self.tmp.cleanup()

    def transcript(self, name, start, end, usage, depth=1, tools=1):
        rows = [
            {"timestamp": start, "message": {"model": "model-x", "usage": usage,
                                             "content": [{"type": "tool_use"}] * tools}},
            {"timestamp": end, "message": {"role": "user", "content": "ok"}},
        ]
        write_jsonl(self.dir / f"agent-{name}.jsonl", rows)
        (self.dir / f"agent-{name}.meta.json").write_text(
            json.dumps({"agentType": "researcher", "spawnDepth": depth}), encoding="utf-8")

    def test_tokens_cache_and_nested_agents_are_summed(self):
        usage = {"input_tokens": 100, "output_tokens": 50,
                 "cache_read_input_tokens": 300, "cache_creation_input_tokens": 100}
        self.transcript("a", "2026-01-01T00:00:00Z", "2026-01-01T00:00:10Z", usage)
        self.transcript("b", "2026-01-01T00:00:00Z", "2026-01-01T00:00:10Z", usage, depth=2)
        code, out, _ = run(str(self.dir), "--json")
        self.assertEqual(code, 0)
        m = json.loads(out)["transcripts"]["summary"]
        self.assertEqual(m["agents"], 2)
        self.assertEqual(m["nested_agents"], 1)
        self.assertEqual(m["input"], 200)
        self.assertEqual(m["cache_read"], 600)
        self.assertEqual(m["cache_hit"], 0.6)
        self.assertEqual(m["tool_calls"], 2)
        self.assertEqual(m["wall_s"], 10.0)
        self.assertEqual(m["parallelism"], 2.0)
        self.assertIsNone(m["cost_usd"], "a cost appeared without --prices")

    def test_cost_only_with_a_price_map(self):
        usage = {"input_tokens": 1_000_000, "output_tokens": 0}
        self.transcript("a", "2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z", usage)
        prices = Path(self.tmp.name) / "prices.json"
        prices.write_text(json.dumps({"model-x": {"in": 2.0}}), encoding="utf-8")
        code, out, _ = run(str(self.dir), "--json", "--prices", str(prices))
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["transcripts"]["summary"]["cost_usd"], 2.0)

    def test_run_journals_and_transcripts_are_kept_apart(self):
        usage = {"input_tokens": 1, "output_tokens": 1}
        self.transcript("a", "2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z", usage)
        write_jsonl(self.dir / "s.runs.jsonl", ROWS)
        code, out, _ = run(str(self.dir), "--json")
        data = json.loads(out)
        self.assertEqual(len(data["run_journals"]), 1)
        self.assertEqual(data["transcripts"]["summary"]["agents"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
