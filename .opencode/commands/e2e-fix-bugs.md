---
name: e2e-fix-bugs
description: work through bug reports in .opencode/plans, delegating one fix per subagent, committing each fix.
---

You are the primary agent coordinating fixes for bugs found during exploratory QA of dnd-campaign-suite. You do not fix bugs yourself — you dispatch each one to a subagent, one at a time, and handle the bookkeeping (git, retries, playbook) between dispatches.

This command pairs with `e2e-explore`: explore produces the bug files in `.opencode/plans/bug-<slug>.md`; this command consumes them. A bug file only disappears when it is fixed or disproved.

## Support files

- `docs/app-exploration.md` — read before any subagent touches the running app.
- `docs/test-setup-playbook.md` — accumulated known-good setup recipes and pitfalls (shared with the automations/monster verify suites; read it, have subagents append new pitfalls).
- `docs/test-character-registry.json`, `docs/test-monster-registry.json` — reusable test characters/NPCs/monsters already in "test-campaign", so reuse is a lookup not a rebuild.

## Primary agent steps

1. Kill all running processes for this project: `pkill -9 -f "node.*server" 2>/dev/null; pkill -9 -f "vite" 2>/dev/null; pkill -9 -f "concurrently" 2>/dev/null; pkill -9 -f "dnd-campaign" 2>/dev/null; echo "all killed"`
2. List all bug files in `.opencode/plans/` (not already in `.opencode/plans/resolved/`). These are your work queue. If the queue is empty, report that and stop.
3. Read `docs/test-setup-playbook.md` if present — you'll pass it to each subagent.
4. For each bug file, one at a time (ONE subagent at a time — never run two fixers in parallel; memory conservation matters more than speed):
   a. Dispatch a subagent with the task template below, passing it the path to that single bug file plus the playbook/registry paths. Do not give the subagent the full queue or context on other bugs.
   b. Wait for it to return with one of: `FIX: FIXED`, `FIX: DISPROVED`, `FIX: FAILED`.
   c. **Retry rule (FAILED only):** re-dispatch exactly once with the subagent's failure notes prepended to the prompt, so the retry doesn't repeat the same dead end. If the retry also fails, leave the bug file in place in `.opencode/plans/` and move on. Do not retry a third time — that's a signal it needs a human.
   d. **Verify then commit — FIXED and DISPROVED only.** Confirm the bug file now has a `## Resolution` section and has been moved to `.opencode/plans/resolved/`; if not, treat the fix as failed and note it. Then stage explicitly by path — never `git add -A`:
      - the fixed source file(s) and new regression test file(s) as listed in the subagent's return message,
      - the bug file's move: `git add` both the old path (deletion) and `.opencode/plans/resolved/<bug-file>.md`.
      Commit message: first line `fix(<slug>): <title>` where `<slug>` is the bug file's slug and `<title>` is the `## Summary` text from the bug file (for disproved outcomes use `disproved(<slug>): <title>`). Do not add `Co-authored-by` or other trailers unless the repo history already uses them. Never commit on FAILED.
   e. **If the subagent reported a new playbook recipe or a new pitfall it hit**, append it to `docs/test-setup-playbook.md` now, so later bugs in this same run benefit.
   f. Move to the next bug file. Each subagent starts with clean context — do not carry findings or code changes from one bug into the next.
5. When the queue is empty, report a summary: how many bugs were fixed, disproved, and failed, with the commit hash for committed rows and the resolved file paths.

## Subagent task (given to each subagent, one bug at a time)

You are fixing a single bug described in the file at: `{bug_file_path}`

Read `docs/app-exploration.md` and `docs/test-setup-playbook.md` (if present) before touching the running app.

### Scope — read this before doing anything

- You may use the Playwright MCP browser tools to reproduce and verify this bug, but ONLY inside the campaign named "test-campaign". Never create, edit, or delete data in any other campaign — those are real production data.
- You may read and edit application source code anywhere in the repo as needed to fix the bug.
- GM features are localhost-only — run the app on localhost. Monsters join initiative only via Encounter Builder "Join Encounter" (exact names from `public/data/monsters.json`); set `targetName` on a monster's card before its actions; edits persist through a ~10s cache debounce — wait/reload/clear-cache via Admin before assuming something is broken.

### Steps

1. Read the bug file in full.
2. Using the Playwright MCP browser tools, reproduce the bug live in "test-campaign" by
   following the exact steps to reproduce. Confirm you can see the actual behavior described
   before touching any code. Do not substitute reading the code, running vitest,
   or hitting the API directly for this step — the point is confirming what a real user sees
   in the browser, not just confirming the code path exists.
   If the behavior is already correct, stop: return `FIX: DISPROVED` with concrete evidence
   (what you clicked, what happened, exact values). Do not "fix" working code.
3. Investigate the actual root cause in the codebase. The bug file's "Likely location" and
   "Suggested fix" are a starting point from black-box testing, not confirmed diagnoses —
   verify them against the real code rather than trusting them outright. Bug files can be
   stale against the current snapshot.
4. **Find similar working code and copy its pattern.** Locate sibling implementations that
   already do this kind of thing correctly (same handler/router/hook, same mechanic — damage
   application, condition application, dice rolls, SSE writes) and mirror their structure,
   naming, logging, and event flow. Do NOT invent new architectures, helper abstractions, or
   event types when an established pattern exists. Consistency beats cleverness.
   Rule-data ground truth: `public/data/` and `public/data/2024/` JSON are the truth — if
   the bug file's "Expected" contradicts canonical app data, note it and fix to canonical.
5. Implement the minimal fix. Every automation/attack/save resolution must log to the campaign
   log when triggered, with event details. Use `isWithinRange` for any range check. No inline
   styles. Server-first: any game state you write goes through the runtime store, never
   localStorage. Dual-ruleset: check whether the sibling module (5e vs 2024) needs the same fix.
6. **Regression test.** Write a vitest regression test co-located with the file you fixed,
   matching the existing naming convention (`<File>.<aspect>.test.{js,jsx}`). The test must
   lock the exact behavior that was broken. Mirror the setup/mocking conventions of sibling
   test files before writing your own. Run, in this order, fixing until each passes:
   1. `npx vitest run <the new test file>`
   2. `npx vitest run <other test files in the touched folder(s)>`
   3. `npm run lint` (zero warnings enforced)
   If the touched-area run has unrelated pre-existing failures, note them in your return
   message — do not "fix" unrelated tests.
7. Using the Playwright MCP browser tools, re-run the original repro steps in "test-campaign"
   to confirm the "Expected" behavior now occurs exactly — correct value, correct condition,
   correct log entry. A partial improvement is not a fix. Also do a quick sanity check that you
   haven't broken adjacent behavior (re-check a related flow if the fix touched shared code).
8. Clean up: clear the change-data cache and campaign log for "test-campaign" via the Admin panel.
9. Update the bug file: add a `## Resolution` section documenting what was actually wrong (if different from the original guess), which files changed, and how you verified the fix (repro steps re-run + test/lint results).
10. Move the bug file from `.opencode/plans/` to `.opencode/plans/resolved/`.
11. Report back to the primary agent with your outcome and:
    - Explicit list of changed/new file paths (for the primary's git staging).
    - The `## Summary` text from the bug file (for the commit message).
    - Evidence: Playwright re-verification results + passing test/lint summary.
    - Any new playbook recipe or pitfall worth recording.

### Outcomes

**FIX: FIXED** — fix implemented, regression test passes, lint clean, live re-verification exact. Confirm with `ls` that the bug file is in `.opencode/plans/resolved/` with its `## Resolution` section before returning.

**FIX: DISPROVED** — behavior was already correct: no source/test changes, move the bug file to `resolved/` with the evidence in `## Resolution`, return `FIX: DISPROVED` with the evidence and the summary.

**FIX: FAILED** — you attempted the fix and it does not work (can't reproduce it, tests fail, re-verification fails, or the fix requires a decision only Paul can make). Do NOT guess. Append a `## Fix attempt` section to the bug file: what you tried, what changed (if anything), what failed, exact error output. Leave partially-correct changes in place and note that clearly; revert changes that make things worse. Leave the bug file in `.opencode/plans/` (not resolved/), and return `FIX: FAILED` with the failure summary.
