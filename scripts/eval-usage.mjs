#!/usr/bin/env node
// Token and tool-call medians per case and arm from a `claude plugin eval --json` result
// (docs/COST-BASELINE.md). The result JSON has cost and duration but no tokens. They are only in
// each run's trace, which survives only with `--keep-temp`. A run whose trace is gone is counted as
// missing, never guessed.
//
//   node scripts/eval-usage.mjs <results.json>
//
// Tokens come from the trace's `result` event, from `modelUsage`, summed over models. That
// includes subagents; the top-level `usage` covers the parent session only. Tool calls count
// every `tool_use` block in the trace, parent and subagents.
import { readFileSync, existsSync } from 'node:fs';

export function traceUsage(text) {
  const u = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, toolCalls: 0 };
  let seen = false;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'assistant') u.toolCalls += (o.message?.content ?? []).filter((c) => c.type === 'tool_use').length;
    if (o.type === 'result' && o.modelUsage) {
      seen = true;
      for (const m of Object.values(o.modelUsage)) {
        u.input += m.inputTokens ?? 0;
        u.output += m.outputTokens ?? 0;
        u.cacheRead += m.cacheReadInputTokens ?? 0;
        u.cacheWrite += m.cacheCreationInputTokens ?? 0;
      }
    }
  }
  return seen ? u : null;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function summarize(result, read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)) {
  const rows = [];
  for (const c of result.cases) {
    for (const [arm, runs] of Object.entries(c.arms)) {
      const usages = runs.map((r) => (r.tracePath ? read(r.tracePath) : null)).map((t) => (t ? traceUsage(t) : null));
      const ok = usages.filter(Boolean);
      const pick = (k) => median(ok.map((u) => u[k]));
      rows.push({
        case: c.name, arm, runs: runs.length, traced: ok.length,
        input: pick('input'), output: pick('output'), cacheRead: pick('cacheRead'), cacheWrite: pick('cacheWrite'),
        toolCalls: pick('toolCalls'),
        cost: median(runs.map((r) => r.costUsd)), seconds: median(runs.map((r) => r.durationSeconds)),
      });
    }
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/eval-usage.mjs <results.json>'); process.exit(2); }
  const rows = summarize(JSON.parse(readFileSync(file, 'utf8')));
  const f = (v) => (v == null ? '—' : String(Math.round(v)));
  console.log('| Case | Arm | Runs (traced) | Median input | Output | Cache read | Cache write | Tool calls | Median cost | Median s |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.case} | ${r.arm} | ${r.runs} (${r.traced}) | ${f(r.input)} | ${f(r.output)} | ${f(r.cacheRead)} | ${f(r.cacheWrite)} | ${f(r.toolCalls)} | $${r.cost.toFixed(3)} | ${f(r.seconds)} |`);
  }
}
