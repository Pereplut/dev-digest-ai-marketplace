#!/usr/bin/env python3
"""Aggregate the measurements behind a workflow retrospective.

Reads two kinds of JSONL input and reports each separately, never mixing them:

1. RUN JOURNALS (default) — `.sdd/retro/<session-id>.runs.jsonl`, one row per subagent,
   appended by the orchestrating session as each task notification arrived:

       {"order":1,"agent":"researcher","label":"auth-flow","tokens":90843,"tools":37,
        "ms":162486,"parallel_with":[2,3],"outcome":"returned"}

   Per session it reports every row, totals over the rows that carry a figure, which
   rows lack one ("not measured"), outcome counts, and the parallel groups implied by
   `parallel_with`. The serial-wall estimate (sum over groups of the slowest member) is
   DERIVED, not measured: it assumes groups ran back to back and is labelled as such.

2. AGENT TRANSCRIPTS (deep mode) — Claude Code's own per-agent journals, e.g.
   `~/.claude/projects/<project-slug>/<session-id>/subagents/agent-*.jsonl`, with an
   optional sibling `<journal>.meta.json` carrying `agentType`, `description` and
   `spawnDepth` (> 1 means a nested subagent; it is included in every total). Reports
   input / output / cache-read / cache-write tokens, cache hit ratio, tool calls,
   wall-clock span, and the parallelism factor (sum of agent spans / wall-clock).

Read-only, stdlib only. A file's kind is detected from its rows, not its name.

Usage:
  python3 analyze_journals.py [PATH ...] [--root DIR] [--json] [--prices prices.json]

Each PATH is a file, a directory (its `*.jsonl` files), or a glob; `~` is expanded.
With no PATH, reads `<root>/.sdd/retro/` (root defaults to the current directory).

Cost is never hard-coded (prices change and would go stale). Pass --prices with a JSON
map of {model_substring: {"in": $/Mtok, "out": $/Mtok, "cache_read": $/Mtok,
"cache_write": $/Mtok}} built from current, verified rates. Without it, cost is "n/a".
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DIR = Path(".sdd") / "retro"
ROW_NUMBERS = ("tokens", "tools", "ms")


# ---------------------------------------------------------------- input discovery

def expand(paths: list[str], root: Path) -> list[Path]:
    """Files named by the arguments; a missing argument is reported, not invented."""
    if not paths:
        paths = [str(root / DEFAULT_DIR)]
    files: list[Path] = []
    for raw in paths:
        p = os.path.expanduser(raw)
        if os.path.isdir(p):
            files += sorted(Path(p).glob("*.jsonl"))
            continue
        hits = glob.glob(p)
        files += [Path(h) for h in hits] if hits else [Path(p)]
    seen, out = set(), []
    for f in files:
        key = str(f.resolve()) if f.exists() else str(f)
        if key not in seen:
            seen.add(key)
            out.append(f)
    return sorted(out)


def read_rows(path: Path) -> list[dict] | None:
    """Parsed JSON objects, one per non-empty line; None if the file is unreadable."""
    rows: list[dict] = []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                if isinstance(obj, dict):
                    rows.append(obj)
    except OSError:
        return None
    return rows


def is_run_journal(rows: list[dict]) -> bool:
    """A run journal row names an agent and carries no transcript message."""
    return bool(rows) and all("agent" in r and "message" not in r for r in rows)


# ---------------------------------------------------------------- run journals

def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def parallel_groups(rows: list[dict]) -> list[list[int]]:
    """Connected components over `order` linked by `parallel_with`."""
    orders = [r.get("order") for r in rows if isinstance(r.get("order"), int)]
    parent = {o: o for o in orders}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for r in rows:
        o = r.get("order")
        if o not in parent:
            continue
        for other in r.get("parallel_with") or []:
            if other in parent:
                parent[find(other)] = find(o)
    groups: dict[int, list[int]] = {}
    for o in orders:
        groups.setdefault(find(o), []).append(o)
    return sorted((sorted(g) for g in groups.values()), key=lambda g: g[0])


def summarize_runs(path: Path, rows: list[dict]) -> dict:
    session = path.name[: -len(".runs.jsonl")] if path.name.endswith(".runs.jsonl") else path.stem
    rows = sorted(rows, key=lambda r: (r.get("order") is None, r.get("order") or 0))
    totals = {k: 0 for k in ROW_NUMBERS}
    missing: dict[str, list] = {k: [] for k in ROW_NUMBERS}
    outcomes: dict[str, int] = {}
    out_rows = []
    for r in rows:
        ident = r.get("order", r.get("agent"))
        for k in ROW_NUMBERS:
            v = number(r.get(k))
            if v is None:
                missing[k].append(ident)
            else:
                totals[k] += v
        outcome = r.get("outcome") or "unknown"
        outcomes[outcome] = outcomes.get(outcome, 0) + 1
        out_rows.append({
            "order": r.get("order"),
            "agent": r.get("agent"),
            "label": r.get("label"),
            "tokens": number(r.get("tokens")),
            "tools": number(r.get("tools")),
            "ms": number(r.get("ms")),
            "parallel_with": r.get("parallel_with") or [],
            "outcome": outcome,
        })

    by_order = {r["order"]: r for r in out_rows if isinstance(r["order"], int)}
    groups = parallel_groups(rows)
    duplicates = sorted({o for o in by_order if sum(1 for r in out_rows if r["order"] == o) > 1})
    serial_wall = 0
    wall_complete = bool(groups)
    group_out = []
    for g in groups:
        spans = [by_order[o]["ms"] for o in g]
        known = [s for s in spans if s is not None]
        if len(known) != len(spans):
            wall_complete = False
        slowest = max(known) if known else None
        if slowest is not None:
            serial_wall += slowest
        group_out.append({"orders": g, "slowest_ms": slowest})
    if any(not isinstance(r["order"], int) for r in out_rows):
        wall_complete = False

    derived_wall = serial_wall if wall_complete else None
    parallelism = (
        round(totals["ms"] / derived_wall, 2)
        if derived_wall and not missing["ms"] else None
    )
    return {
        "kind": "run-journal",
        "session": session,
        "file": str(path),
        "agents": len(out_rows),
        "rows": out_rows,
        "totals": totals,
        "not_measured": {k: v for k, v in missing.items() if v},
        "outcomes": outcomes,
        "parallel_groups": group_out,
        "duplicate_orders": duplicates,
        "derived": {
            "serial_wall_ms": derived_wall,
            "parallelism": parallelism,
            "note": "derived from rows: assumes each parallel group ran back to back",
        },
    }


# ---------------------------------------------------------------- agent transcripts

def parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None


def agent_label(path: Path) -> str:
    base = path.name
    if base.startswith("agent-") and base.endswith(".jsonl"):
        return base[len("agent-"):-len(".jsonl")]
    return base[:-len(".jsonl")] if base.endswith(".jsonl") else base


def load_meta(path: Path) -> dict:
    meta_path = path.with_name(path.name[:-len(".jsonl")] + ".meta.json") \
        if path.name.endswith(".jsonl") else path.with_name(path.name + ".meta.json")
    try:
        with open(meta_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def accumulate(path: Path, rows: list[dict]) -> dict:
    meta = load_meta(path)
    agg = {
        "agent": agent_label(path), "type": meta.get("agentType"),
        "desc": meta.get("description"), "depth": meta.get("spawnDepth", 1) or 1,
        "input": 0, "output": 0, "cache_read": 0, "cache_write": 0,
        "tool_calls": 0, "turns": 0, "models": set(), "ts_first": None, "ts_last": None,
    }
    for o in rows:
        ts = parse_ts(o.get("timestamp"))
        if ts:
            if agg["ts_first"] is None or ts < agg["ts_first"]:
                agg["ts_first"] = ts
            if agg["ts_last"] is None or ts > agg["ts_last"]:
                agg["ts_last"] = ts
        msg = o.get("message")
        if not isinstance(msg, dict):
            continue
        if msg.get("model"):
            agg["models"].add(msg["model"])
        usage = msg.get("usage") or {}
        if usage:
            agg["turns"] += 1
            agg["input"] += usage.get("input_tokens", 0) or 0
            agg["output"] += usage.get("output_tokens", 0) or 0
            agg["cache_read"] += usage.get("cache_read_input_tokens", 0) or 0
            agg["cache_write"] += usage.get("cache_creation_input_tokens", 0) or 0
        content = msg.get("content")
        if isinstance(content, list):
            agg["tool_calls"] += sum(
                1 for b in content if isinstance(b, dict) and b.get("type") == "tool_use"
            )
    return agg


def cost_of(agg: dict, prices: dict | None):
    if not prices or not agg["models"]:
        return None
    model = sorted(agg["models"])[0]
    p = next((v for k, v in prices.items() if k in model), None)
    if not p:
        return None
    m = 1_000_000
    return (agg["input"] / m * p.get("in", 0) + agg["output"] / m * p.get("out", 0)
            + agg["cache_read"] / m * p.get("cache_read", 0)
            + agg["cache_write"] / m * p.get("cache_write", 0))


def summarize_transcripts(aggs: list[dict], prices: dict | None) -> dict:
    far = datetime.max.replace(tzinfo=timezone.utc)
    aggs = sorted(aggs, key=lambda a: a["ts_first"] or far)
    total = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0, "tool_calls": 0}
    cost_total, has_cost, sum_span = 0.0, False, 0.0
    first = last = None
    out = []
    for a in aggs:
        span = (a["ts_last"] - a["ts_first"]).total_seconds() \
            if a["ts_first"] and a["ts_last"] else None
        if span:
            sum_span += span
        if a["ts_first"] and (first is None or a["ts_first"] < first):
            first = a["ts_first"]
        if a["ts_last"] and (last is None or a["ts_last"] > last):
            last = a["ts_last"]
        for k in total:
            total[k] += a[k]
        c = cost_of(a, prices)
        if c is not None:
            cost_total += c
            has_cost = True
        side = a["input"] + a["cache_read"] + a["cache_write"]
        out.append({
            "agent": a["agent"], "type": a["type"], "desc": a["desc"], "depth": a["depth"],
            "model": sorted(a["models"])[0] if a["models"] else None,
            "input": a["input"], "output": a["output"],
            "cache_read": a["cache_read"], "cache_write": a["cache_write"],
            "cache_hit": round(a["cache_read"] / side, 3) if side else 0.0,
            "tool_calls": a["tool_calls"], "turns": a["turns"],
            "span_s": round(span, 1) if span else None,
            "started": a["ts_first"].isoformat() if a["ts_first"] else None,
            "cost_usd": round(c, 4) if c is not None else None,
        })
    wall = (last - first).total_seconds() if first and last else None
    side = total["input"] + total["cache_read"] + total["cache_write"]
    return {
        "kind": "transcripts",
        "agents": out,
        "summary": {
            "agents": len(out),
            "nested_agents": sum(1 for r in out if r["depth"] > 1),
            "max_depth": max((r["depth"] for r in out), default=1),
            **total,
            "cache_hit": round(total["cache_read"] / side, 3) if side else 0.0,
            "wall_s": round(wall, 1) if wall else None,
            "sum_agent_span_s": round(sum_span, 1),
            "parallelism": round(sum_span / wall, 2) if wall else None,
            "cost_usd": round(cost_total, 4) if has_cost else None,
        },
    }


# ---------------------------------------------------------------- output

def fmt(v, suffix=""):
    if v is None:
        return "not measured"
    return f"{v:,}{suffix}" if isinstance(v, int) else f"{v}{suffix}"


def print_runs(s: dict) -> None:
    print(f"## Run journal: {s['session']}  ({s['agents']} rows)")
    print(f"{'order':>5}  {'agent':<24} {'label':<22} {'tokens':>12} {'tools':>6} "
          f"{'ms':>12}  {'parallel':<10} outcome")
    for r in s["rows"]:
        print(f"{fmt(r['order']):>5}  {str(r['agent'])[:24]:<24} {str(r['label'] or '')[:22]:<22} "
              f"{fmt(r['tokens']):>12} {fmt(r['tools']):>6} {fmt(r['ms']):>12}  "
              f"{','.join(map(str, r['parallel_with'])) or '-':<10} {r['outcome']}")
    t = s["totals"]
    print(f"TOTAL (rows with a figure): tokens={t['tokens']:,} tools={t['tools']:,} "
          f"agent_ms={t['ms']:,}")
    for k, ids in s["not_measured"].items():
        print(f"not measured: {k} for {ids}")
    print("outcomes: " + ", ".join(f"{k}={v}" for k, v in sorted(s["outcomes"].items())))
    groups = " -> ".join("(" + " | ".join(map(str, g["orders"])) + ")" for g in s["parallel_groups"])
    print(f"parallel groups: {groups or 'none'}")
    if s["duplicate_orders"]:
        print(f"duplicate order values: {s['duplicate_orders']}")
    d = s["derived"]
    print(f"derived serial wall: {fmt(d['serial_wall_ms'], ' ms')}  "
          f"parallelism: {fmt(d['parallelism'], 'x')}  ({d['note']})")
    print()


def print_transcripts(s: dict) -> None:
    print("## Agent transcripts (nested agents indented, included in totals)")
    print(f"{'agent':<30} {'type':<16} {'in':>10} {'out':>9} {'c-read':>11} {'hit':>5} "
          f"{'tools':>5} {'span':>8} {'cost':>9}")
    for r in s["agents"]:
        indent = "  " * (r["depth"] - 1) + ("- " if r["depth"] > 1 else "")
        cost = f"${r['cost_usd']:.4f}" if r["cost_usd"] is not None else "n/a"
        span = f"{r['span_s']}s" if r["span_s"] else "-"
        print(f"{(indent + r['agent'])[:30]:<30} {(r['type'] or '?')[:16]:<16} "
              f"{r['input']:>10,} {r['output']:>9,} {r['cache_read']:>11,} "
              f"{r['cache_hit'] * 100:>4.0f}% {r['tool_calls']:>5} {span:>8} {cost:>9}")
    m = s["summary"]
    cost = f"${m['cost_usd']:.4f}" if m["cost_usd"] is not None else "n/a (pass --prices)"
    print(f"TOTAL agents={m['agents']} (nested={m['nested_agents']}, max_depth={m['max_depth']}) "
          f"in={m['input']:,} out={m['output']:,} cache_read={m['cache_read']:,} "
          f"cache_hit={m['cache_hit'] * 100:.0f}% tools={m['tool_calls']}")
    print(f"      wall={fmt(m['wall_s'], 's')} sum_agent_span={m['sum_agent_span_s']}s "
          f"parallelism={fmt(m['parallelism'], 'x')} cost={cost}")
    print()


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Aggregate run journals and agent transcripts.")
    ap.add_argument("paths", nargs="*",
                    help="files, directories or globs (default: <root>/.sdd/retro/)")
    ap.add_argument("--root", default=".", help="repository root (default: current directory)")
    ap.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    ap.add_argument("--prices", help="JSON file: {model_substr: {in,out,cache_read,cache_write}}")
    args = ap.parse_args(argv)

    prices = None
    if args.prices:
        with open(args.prices, encoding="utf-8") as fh:
            prices = json.load(fh)

    runs, aggs, unreadable = [], [], []
    for f in expand(args.paths, Path(args.root)):
        rows = read_rows(f)
        if not rows:
            unreadable.append(str(f))
            continue
        if is_run_journal(rows):
            runs.append(summarize_runs(f, rows))
        else:
            aggs.append(accumulate(f, rows))

    if not runs and not aggs:
        target = ", ".join(unreadable) or "(no files)"
        print(f"no readable journal rows in: {target}", file=sys.stderr)
        return 1

    result = {
        "run_journals": runs,
        "transcripts": summarize_transcripts(aggs, prices) if aggs else None,
        "unreadable": unreadable,
    }
    if args.json:
        print(json.dumps(result, indent=2))
        return 0
    for s in runs:
        print_runs(s)
    if result["transcripts"]:
        print_transcripts(result["transcripts"])
    for u in unreadable:
        print(f"skipped (empty or unreadable): {u}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
