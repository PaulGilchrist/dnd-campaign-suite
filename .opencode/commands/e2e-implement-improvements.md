---
name: e2e-implement-improvements
description: work through the Improvement backlog in docs/app-exploration.md, delegating one improvement per subagent, committing each verified improvement.
---

You are the primary agent coordinating implementation of improvement opportunities found during exploratory QA of dnd-campaign-suite. You do not implement improvements yourself — you dispatch each one to a subagent, one at a time, and handle the bookkeeping (git, retries, playbook) between dispatches.

This command pairs with `e2e-explore`: explore appends dated bullets to the `## Improvement backlog` section of `docs/app-exploration.md`; this command consumes them. Consumed bullets are REMOVED from the backlog once resolved (DONE, blocked, or skipped by the user) — the backlog holds only open items, so a future run never re-attempts resolved work. Do not leave `DONE:` or `WON'T DO:` markers behind. The final run summary is the durable record of what was delivered, blocked, or skipped this run.

## Support files

- `docs/app-exploration.md` — the backlog lives in its `## Improvement backlog` section; read the whole file before any subagent touches the running app.
- `docs/test-setup-playbook.md` — accumulated known-good setup recipes and pitfalls (shared with the automations/monster verify suites; read it, have subagents append new pitfalls).
- `docs/test-character-registry.json`, `docs/test-monster-registry.json` — reusable test characters/NPCs/monsters already in "test-campaign", so reuse is a lookup not a rebuild.
- `.opencode/plans/bug-*.md` — some backlog bullets reference an open bug file; check before dispatching (see triage rule 4d).

## Primary agent steps

1. Kill all running processes for this project: `pkill -9 -f "node.*server" 2>/dev/null; pkill -9 -f "vite" 2>/dev/null; pkill -9 -f "concurrently" 2>/dev/null; pkill -9 -f "dnd-campaign" 2>/dev/null; echo "all killed"`
2. Read `docs/app-exploration.md` and collect every bullet in its `## Improvement Backlog` section into an ordered work queue (oldest date first; within a date, document order). Under the removal policy the backlog holds only open items — no filtering for `DONE:` prefixes is needed. If `$ARGUMENTS` is non-empty, filter to bullets matching it (`next` = exactly the first unqueued bullet). If the section is empty, report that and stop.
3. Read `docs/test-setup-playbook.md` if present — you'll pass it to each subagent.
4. Present the queue to the user as a numbered table: slug, one-line description, likely area/files, size `S`/`M`/`L`. Flag `L` items (cross-stack design changes, new automation types, architecture passes) and ask for explicit go/no-go before dispatching them. Do not invent scope beyond a bullet; if a bullet is ambiguous, ask ONE clarifying question, then proceed.
5. For each queued improvement, one at a time (ONE subagent at a time — never run two implementers in parallel; memory conservation matters more than speed):
   a. **Write the acceptance criteria first.** Before dispatching, write down exactly what "done" means for this bullet, concrete and observable (e.g. "duplicate NPC name shows inline error and no second record persists"; "map editor heading renders displayName verbatim"; "player tab renders the active map within ~2s of GM activation, no manual clicks"). These go into the subagent prompt and become your verification checklist.
   b. Dispatch a subagent with the task template below, passing it the improvement text, your acceptance criteria, and the playbook/registry paths. Do not give the subagent the full queue or context on other improvements.
   c. Wait for it to return with one of: `IMP: DONE`, `IMP: FAILED`, `IMP: BLOCKED`.
   d. **Triage before dispatch (do this per item):** if the bullet references a `bug-*.md` file still in `.opencode/plans/` (not `resolved/`), the matching `e2e-fix-bugs` fix may subsume it — note the dependency, implement only the polish remainder, and say so in the subagent prompt so it doesn't re-fix the bug.
   e. **Retry rule (FAILED only):** re-dispatch exactly once with the subagent's failure notes prepended to the prompt, so the retry doesn't repeat the same dead end. If the retry also fails, leave the bullet in the backlog (FAILED items are NOT removed — they stay for a future run or human) and move on. Do not retry a third time — that's a signal it needs a human. Report it as blocked in the final summary.
   f. **Verify then commit — DONE only.** `IMP: DONE` is not enough. Confirm the subagent's evidence: changed files listed, the regression/unit tests it ran, lint clean, and the live browser re-verification against each acceptance criterion (exact observable: rendered text, network call, SSE timing, no console errors). Inspect `git diff` yourself — changes outside the improvement's area mean treat it as FAILED and re-dispatch. Then stage explicitly by path — never `git add -A`:
      - the source file(s) and test file(s) as listed in the subagent's return message,
      - `docs/app-exploration.md` (after you REMOVE the bullet per step 6).
      Commit message: first line `improve(<slug>): <one-line description>` where `<slug>` is derived from the backlog bullet (kebab-case, stable across the run). Do not add `Co-authored-by` or other trailers unless the repo history already uses them. Never commit source changes on FAILED. BLOCKED and user-skipped items commit nothing but their backlog bullet removal (step 6).
   g. **If the subagent reported a new playbook recipe or a new pitfall it hit**, append it to `docs/test-setup-playbook.md` now, so later items in this same run benefit.
   h. Move to the next improvement. Each subagent starts with clean context — do not carry findings or code changes from one improvement into the next.
6. **Backlog removal (your only file edit besides the playbook):** when an improvement is implemented AND you have verified it (DONE), REMOVE its bullet from the `## Improvement Backlog` section of `docs/app-exploration.md`. Also REMOVE bullets that return `IMP: BLOCKED` (premise contradicted — re-verifying them on every run is waste) and bullets the user explicitly skips in triage (step 4/5d). Do NOT remove FAILED bullets — they stay open. Never leave `DONE:`, `WON'T DO:` or other status markers in the backlog. Capture each removed bullet's slug, disposition (DONE/BLOCKED/skipped) and reason in your working notes — the final run summary is the record. Never delete or rewrite other sections or other entries.
7. When the queue is empty, report a summary: how many improvements implemented, blocked, skipped, or left failed, with the commit hash and files for each, plus any playbook additions. Note that a blocked removal can be re-added via `e2e-explore` in a future QA cycle if the premise resurfaces. If the backlog is now empty, offer (never do unprompted) to archive `docs/app-exploration.md` to start a fresh QA cycle.

## Subagent task (given to each subagent, one improvement at a time)

You are implementing a single improvement from the QA backlog of dnd-campaign-suite.

**Improvement:** `{improvement_text}`

**Acceptance criteria (all must hold, verbatim):**
{acceptance_criteria}

Read `docs/app-exploration.md` and `docs/test-setup-playbook.md` (if present) before touching the running app.

### Scope — read this before doing anything

- You may use the Playwright MCP browser tools to verify, but ONLY inside the campaign named "test-campaign". Never create, edit, or delete data in any other campaign — those are real production data. Verify the campaign header reads `test-campaign` after every campaign-select.
- You may read and edit application source code anywhere in the repo as needed to implement the improvement.
- GM features are localhost-only — run the app on localhost. Edits persist through a ~10s cache debounce (`changeData.js`) — wait/reload/clear-cache via Admin before assuming something is broken. ONE shared SSE per campaign (`subscribeToSSE`, never `new EventSource`; `skipSync=true` on SSE echoes).

### Steps

1. Read the improvement text and acceptance criteria in full. If the improvement's premise is contradicted by the live app or current code (e.g. the thing was already fixed), stop: return `IMP: BLOCKED` with concrete evidence — do not "improve" working code into something the backlog didn't ask for.
2. Investigate the current code. The backlog note may name stale files — verify against the current snapshot rather than trusting it.
3. **Find similar working code and copy its pattern.** Locate sibling implementations that already do this kind of thing correctly (same component family, validation flow, SSE seam, modal chrome, CSS conventions) and mirror their structure, naming, and events. Do NOT invent new architectures, helper abstractions, or event types when an established pattern exists. Consistency beats cleverness. The Maps manager is the reference for validation-with-error UX; existing global CSS is the first stop for styling.
4. Implement the minimal change that satisfies every acceptance criterion. Server-first: any game state written goes through the runtime store, never localStorage. No inline styles, no `!important`. Re-use existing CSS classes/components (CreatureBadge, ct-*, sp-modal, etc.) where they fit. Every automation touched must still log to the campaign log. Dual-ruleset: check whether the sibling module (5e vs 2024) needs the same change.
5. **Tests.** Add or update vitest coverage locking the new behavior, co-located, matching sibling test conventions (`<File>.<aspect>.test.{js,jsx}`). For pure-UX tweaks with no testable seam, say so explicitly in your return message instead. Run, in this order, fixing until each passes:
   1. `npx vitest run <the new/updated test file>`
   2. `npx vitest run <other test files in the touched folder(s)>`
   3. `npm run lint` (zero warnings enforced; complexity cap 15 — hoist to helpers if needed)
   If the touched-area run has unrelated pre-existing failures, note them in your return message — do not "fix" unrelated tests.
6. **Live browser verification.** Using the Playwright MCP browser tools on localhost against "test-campaign", re-run the improvement's scenario and check EVERY acceptance criterion exactly — rendered text, network requests, live sync timing, console cleanliness. A partial improvement is not done. Also do a quick sanity check that adjacent behavior in the same screen still works.
7. Clean up: delete any entities you created in "test-campaign" for verification, then clear the change-data cache and campaign log via the Admin panel.
8. Report back to the primary agent with:
   - Explicit list of changed/new file paths (for the primary's git staging).
   - Per-criterion evidence from the live browser pass.
   - Passing test/lint summary.
   - Any new playbook recipe or pitfall worth recording.

### Outcomes

**IMP: DONE** — all acceptance criteria met, tests pass (or seam genuinely untestable, stated), lint clean, live re-verified. Return the evidence pack.

**IMP: FAILED** — you attempted it and something concrete fails (criterion not met, tests red, browser check contradicts). Append a short `## Attempt notes` block to your return message: what you tried, what failed, exact errors. Leave the working tree in the best state you achieved; revert changes that make things worse.

**IMP: BLOCKED** — premise invalid (already done / contradicted by live app), or it requires a product decision only Paul can make. Return with the specific blocker and evidence; make no code changes.
