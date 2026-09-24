---
name: automations-fix
description: Loop through .opencode/plans/bug-*.md files, fixing one bug per subagent, committing each fix.
---

You are the primary agent fixing broken combat automations. You do not fix bugs yourself — you dispatch each bug file to a single subagent, one at a time, and handle the bookkeeping (manifest, git, retries) between dispatches.

This command pairs with `automations-verify`: verify produces the bug files in `.opencode/plans/bug-<id>-<slug>.md`; this command consumes them. A bug file only disappears when it is fixed or disproved.

## Support files

- `docs/automations-manifest.json` — the coverage manifest. Each row has an `id`, `name`, `verified` field (`"verified"`, `"broken — see ..."`, `"incomplete — ..."`, or `"needs manual decision — ..."`), plus handler/router/infoBuilder paths and expectedBehavior.
- `docs/test-setup-playbook.md` — accumulated known-good setup recipes and pitfalls (maintained by automations-verify; read it if present, and have subagents append new pitfalls).
- `docs/app-exploration.md` — read before any subagent touches the running app.

## Primary agent steps

1. Kill all running processes for this project: `pkill -9 -f "node.*server" 2>/dev/null; pkill -9 -f "vite" 2>/dev/null; pkill -9 -f "concurrently" 2>/dev/null; pkill -9 -f "dnd-campaign" 2>/dev/null; echo "all killed"`
2. Build your queue: `ls .opencode/plans/bug-*.md` (alphabetical). Each file is one queue item. If `docs/test-setup-playbook.md` exists, read it — you'll pass it to each subagent.
3. For each bug file, one at a time (ONE subagent at a time — never run two fixers in parallel):

   a. Read the bug file and pass its full contents to a subagent (task template below), along with the playbook path. Do not give it the other bug files. Memory conservation matters more than speed.

   b. Wait for it to return with one of: `FIX: FIXED`, `FIX: DISPROVED`, `FIX: SKIPPED`, `FIX: FAILED`.

   c. Immediately after the subagent returns, update that row's `verified` field in `docs/automations-manifest.json` on disk — do not hold updates in memory and write them all at the end:
      - `FIX: FIXED` or `FIX: DISPROVED` → `"verified"`
       - `FIX: SKIPPED` → do NOT park it; go to step (g) — the primary decides and re-dispatches.
      - `FIX: FAILED` (after retry) → `"broken — fix attempts failed, see .opencode/plans/<bug-file>.md"`

   d. **Git commit — FIXED and DISPROVED only.** After the manifest row is updated (and the subagent has already deleted its bug file and written its regression test), stage explicitly by path — never `git add -A`:
      - the fixed source file(s) and new regression test file(s) as listed in the subagent's return message,
      - `docs/automations-manifest.json`,
      - the deleted bug file (`git rm` the path if it still shows as deleted-but-unstaged).
       Commit message: first line `fix(<BUG-ID>): <title>` where `<BUG-ID>` is the row id (e.g. `CLA-192`) and `<title>` is the `## Title` text from the bug file (for disproved outcomes use `disproved(<BUG-ID>): <title>`). Do not add `Co-authored-by` or other trailers unless the repo history already uses them.

   e. **If the subagent reported a new playbook recipe or a new pitfall it hit**, append it to `docs/test-setup-playbook.md` now, so later bugs in this same run benefit.

   f. **Retry rule (FAILED only):** re-dispatch exactly once with the subagent's failure notes prepended to the prompt, so the retry doesn't repeat the same dead end. If the retry also fails, leave the bug file in place, set the manifest row per (c), and move on. Do not retry a third time — that's a signal it needs a human.

    g. **SKIPPED → the PRIMARY decides, then re-dispatches.** The subagent has appended its `## Fix options` to the bug file. Read the options and pick ONE yourself — the option that best fits all of: (1) the automation's RAW description / rule data, (2) the current code (which verified seams already exist), and (3) how the game already works for comparable automations, features, targeted effects, spells, and abilities. Criteria learned this suite:
       - **Reuse the canonical gameplay path, don't build parallel state.** When a feature already resolves through an established path (a spell-cast/merge seam, an existing automation handler, a verified grant/attack flow), ride that path instead of building parallel state. Never fabricate bonuses into static rule-data rows to compensate for a merge the engine already performs, and never add a GM-input modal when the existing path already resolves the mechanic.
       - **Register onto existing seams; new consumer CODE is sanctioned.** Registering a targeted effect in `targetEffectDefinitions.js`, adding a parser/grant leg, gating a reaction/feature via an existing gate, threading a transport field (e.g. secondary damage), or a pre-guard turn-start tick are fixes — build them, mirroring the cited sibling byte-shapes. A "new subsystem" is not by itself a skip reason.
       - **Advisory is the floor only where the mechanic genuinely has no consumer** and the rules say the GM decides (GM-positioned zones, square grids, count enforcement, instakill wording).
       - **Prefer data authoring over code** (name/`save_dc`/`uses`/`delegates_to`/markup) when the engine already consumes the field.
       Then re-dispatch ONE fixer with your chosen option as binding instruction ("implement option X, full stop — do not re-litigate"). If it returns FIXED → normal FIXED flow. If it returns FAILED → retry once (f). Only if the re-dispatch is blocked by a genuine hard blocker (e.g. a required UI cannot exist without new persistence + user sign-off) park the row as `"needs manual decision — see .opencode/plans/<bug-file>.md"` with the blocker named. Do not commit a SKIPPED row in the interim.

   h. Move to the next bug file.

4. When the queue is empty, report totals: fixed, disproved, skipped (needs manual decision), failed. List each bug ID under its outcome with the commit hash for committed rows.

---

## Subagent task (given one bug file at a time)

You are fixing a single automation bug: `{bug_file_contents}`

Read `docs/app-exploration.md` and `docs/test-setup-playbook.md` (if present) before touching the running app.

### Step 1 — Plan the fix (before writing any code)

1. Read the bug file's "Likely Location" entries and open those files. Confirm the diagnosis against the current code — bug files can be stale (they were written against an earlier snapshot).
2. **Find similar VERIFIED automations and copy their patterns.** In `docs/automations-manifest.json`, find rows with `"verified": "verified"` that share the same handler, router, trigger type, or mechanic (slot expenditure, attack granting, condition application, modal confirm, etc.). Read those handlers' implementations and mirror their structure, naming, logging, and event flow. Do NOT invent new architectures, new helper abstractions, or new event types when an established pattern exists. Established working patterns are the standard — consistency beats cleverness.
3. Check the rule data ground truth in `public/data/2024/` or `public/data/` (classes.json, spells.json, monsters.json) — several bug files note stale manifest expectations (e.g. feature level differences). The JSON data is the truth; the bug file's expected section may itself be wrong.
4. If the rules engine is involved, remember the dual-ruleset architecture: fix the module for the correct ruleset (`5e` vs `2024`), and check whether the sibling module needs the same fix.

### Step 2 — Confirm or disprove (Playwright MCP)

Before changing any code, reproduce the bug's "Steps to Reproduce" against the running app with Playwright MCP. If the behavior is already correct (bug disproved), stop: return `FIX: DISPROVED` with the concrete evidence (what you clicked, what happened, exact values). Do not "fix" working code.

### Step 3 — Fix

Implement the minimal fix following the verified patterns from step 1. Every automation fix must log to the campaign log when triggered, with event details. Use `isWithinRange` for any range check. No inline styles. Server-first: any state you write goes through the runtime store, never localStorage.

### Step 4 — Regression test

Write a vitest regression test co-located with the file you fixed, matching the existing naming convention (e.g. `warMagicSpellHandler.test.js` or `warMagicSpellHandler-warMagic.test.js` if a sibling test file already exists there). The test must exercise the exact broken behavior — the bug reproducing before the fix is what the test locks down after. Look at neighboring test files for setup/mocking conventions before writing your own.

Run, in this order, fixing until each passes:
1. `npx vitest run <the new test file>`
2. `npx vitest run <other test files in the touched folder(s)>`
3. `npm run lint` (zero warnings enforced)

If the full-suite run of the touched area cannot pass without unrelated pre-existing failures, note the pre-existing failures in your return message — do not "fix" unrelated tests.

### Step 5 — Re-verify end-to-end (Playwright MCP)

Re-run the bug file's reproduction steps and confirm the "Expected" behavior now occurs exactly (correct value, correct slot spent, correct attack rolled, correct log entry). A partial improvement is not a fix.

### Step 6 — Clean up

Clear the change-data cache and campaign log for test-campaign via the admin panel. Only mutate data inside test-campaign.

### Outcomes

**FIX: FIXED** — Return `FIX: FIXED` with:
- Explicit list of changed/new file paths (for the primary's git staging).
- The `## Title` text from the bug file (for the commit message).
- Evidence: Playwright re-verification results + passing test/lint output summary.
- Any new playbook recipe or pitfall worth recording.
Then **delete the bug file** (`rm .opencode/plans/<bug-file>.md`) — only after lint, tests, and re-verification all passed. Verify deletion with `ls`.

**FIX: DISPROVED** — Same as FIXED but no source/test changes: delete the bug file, verify deletion, return `FIX: DISPROVED` with the evidence and the title.

**FIX: SKIPPED** — only when you cannot map ANY option onto an existing automation seam and genuinely need the primary to break a tie between two or more defensible designs (or the fix would require brand-new persisted GM-input state with no path to reuse). Append a `## Fix options` section to the bug file listing each option, its trade-offs, the verified behavior each mirrors, and which existing seam (if any) it could ride — then return `FIX: SKIPPED`; the primary will pick one and re-dispatch you (or another fixer) with a binding instruction. Building new consumer code that mirrors an existing verified seam is NOT a skip — fix it. If one option clearly matches existing verified patterns, that IS the answer; fix it.

**FIX: FAILED** — You attempted the fix and it does not work (tests fail, re-verification fails, or the fix is wrong in a way you cannot resolve). Append a `## Fix attempt` section to the bug file: what you changed, what failed, exact error output. Leave the code changes in place if they are partially correct and note that clearly; revert them if they make things worse. Return `FIX: FAILED` with the failure summary.

---

## Worked example — CLA-192 "Improved War Magic"

**Bug file:** `.opencode/plans/bug-cla-192-improved-war-magic.md` — lv18 spell+attack replacement never fires; row opens the lv7 cantrip picker, confirms to log-only popup.

**Step 1:** Open `automationService.js:69` — confirms `automation[0]` drops the `war_magic_spell` entry. Search manifest for verified spell+attack combinators (e.g. Eldritch Knight base War Magic, any `war_magic_*` rows marked verified) and read `warMagicCantripHandler.js` plus a verified handler that spends a spell slot and resolves damage to copy their flow.

**Step 2:** Reproduce with Playwright: EvasiveFighter → Improved War Magic row → cantrip picker → confirm → no slot spent, no attack. Bug confirmed real.

**Step 3:** Fix: dispatch both array entries (`automationService.js`), stop the name-dedupe dropping the spell info (`featureCategorizationUtils.js`), and make `confirmWarMagicSpell` spend the slot, resolve spell damage, then grant+roll one weapon attack against the card target — each half mirroring an already-verified handler, with campaign-log entries.

**Step 4:** Regression test beside `warMagicSpellHandler.js` asserting slot expenditure, damage application, and attack grant on confirm; run it, then the folder suite, then lint.

**Step 5:** Re-run repro: Magic Missile offered and selectable, slot spent, damage applied, weapon attack resolves, log shows all three events.

**Outcome:** `FIX: FIXED` with file list + title → primary updates manifest to `"verified"`, stages exactly those paths, commits `fix(CLA-192): lv18 spell+attack replacement never fires — row triggers lv7 cantrip picker, confirms to log-only popup with no spell cast and no weapon attack`, bug file deleted.
