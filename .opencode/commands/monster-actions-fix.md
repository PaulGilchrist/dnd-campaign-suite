---
name: monster-actions-fix
description: Loop through .opencode/plans/bug-mon-*.md files, fixing one monster-action bug per subagent, committing each fix.
---

You are the primary agent fixing broken monster actions. You do not fix bugs yourself — you dispatch each bug file to a single subagent, one at a time, and handle the bookkeeping (manifest, git, retries) between dispatches.

This command pairs with `monster-actions-verify`: verify produces the bug files in `.opencode/plans/bug-mon-<id>-<slug>.md`; this command consumes them. A bug file only disappears when it is fixed or disproved.

Monster-action bugs live in **two layers**, and the subagent must fix the right one:
- **Rule data** — `public/data/monsters.json` numbers/text drifted from the description (wrong `attack_bonus`, `save_dc`, `save_type`, damage dice, `recharge`, `uses`), or a missing/mis-categorized field.
- **Resolution code** — the GM monster-card path: `src/components/encounter/MonsterCardModal.jsx` (`handleAttack`/`handleSaveRoll`), `src/components/encounter/MonsterCardHelpers.js` (save-modifier + condition extraction), `src/hooks/combat/useLoggedDiceRollAttack.js`, `src/hooks/combat/hitResolution.js` (to-hit vs effective AC), `src/hooks/combat/saveProcessing.js` (`processNpcSave`/`processPlayerSave`, half-damage, `applyFailedSaveConditions`), `src/services/rules/combat/applyDamage.js`. Unimplemented mechanics (recharge/`uses`/legendary-use gating) land here.

## Support files

- `docs/monster-actions-manifest.json` — the coverage manifest. Each row has `id`, `monster`, `actionName`, `actionType`, `category`, the authored numbers, and `verified` (`"verified"`, `"broken — see ..."`, `"incomplete — ..."`, or `"needs manual decision — ..."`).
- `docs/test-setup-playbook.md` — accumulated known-good monster setup recipes and pitfalls (maintained by monster-actions-verify; read it, have subagents append new pitfalls).
- `docs/app-exploration.md` — read before any subagent touches the running app.

## Primary agent steps

1. Kill all running processes for this project: `pkill -9 -f "node.*server" 2>/dev/null; pkill -9 -f "vite" 2>/dev/null; pkill -9 -f "concurrently" 2>/dev/null; pkill -9 -f "dnd-campaign" 2>/dev/null; echo "all killed"`
2. Build your queue: `ls .opencode/plans/bug-mon-*.md` (alphabetical). Each file is one queue item. If `docs/test-setup-playbook.md` exists, read it — you'll pass it to each subagent.
3. For each bug file, one at a time (ONE subagent at a time — never run two fixers in parallel):

   a. Read the bug file and pass its full contents to a subagent (template below), along with the playbook path. Do not give it the other bug files. Memory conservation matters more than speed.

   b. Wait for it to return with one of: `FIX: FIXED`, `FIX: DISPROVED`, `FIX: SKIPPED`, `FIX: FAILED`.

   c. Immediately after it returns, update that row's `verified` field in `docs/monster-actions-manifest.json` on disk — never batch to the end:
      - `FIX: FIXED` or `FIX: DISPROVED` → `"verified"`
      - `FIX: SKIPPED` → `"needs manual decision — see .opencode/plans/<bug-file>.md"`
      - `FIX: FAILED` (after retry) → `"broken — fix attempts failed, see .opencode/plans/<bug-file>.md"`

   d. **Git commit — FIXED and DISPROVED only.** After the manifest row is updated (and the subagent has deleted its bug file and written its regression test), stage explicitly by path — never `git add -A`:
      - the fixed source file(s) and/or `public/data/monsters.json`, and the new regression test file(s) as listed in the subagent's return message,
      - `docs/monster-actions-manifest.json`,
      - the deleted bug file (`git rm` the path if it still shows as deleted-but-unstaged).
      Commit message: first line `fix(<BUG-ID>): <title>` where `<BUG-ID>` is the row id (e.g. `MA-0031`) and `<title>` is the `## Title` text from the bug file (for disproved outcomes use `disproved(<BUG-ID>): <title>`). Do not add `Co-authored-by` or other trailers unless the repo history already uses them.

   e. **If the subagent reported a new playbook recipe or pitfall it hit,** append it to `docs/test-setup-playbook.md` now, so later bugs in this same run benefit.

   f. **Retry rule (FAILED only):** re-dispatch exactly once with the subagent's failure notes prepended, so the retry doesn't repeat the same dead end. If the retry also fails, leave the bug file in place, set the manifest row per (c), and move on. Do not retry a third time — that needs a human.

   g. **SKIPPED:** the subagent has appended its `## Fix options` section to the bug file. Do not commit, do not retry. Move on — the user runs a manual pass on `needs manual decision` rows.

   h. Move to the next bug file.

4. When the queue is empty, report totals: fixed, disproved, skipped (needs manual decision), failed. List each bug ID under its outcome with the commit hash for committed rows.

---

## Subagent task (given one bug file at a time)

You are fixing a single monster-action bug: `{bug_file_contents}`

Read `docs/app-exploration.md` and `docs/test-setup-playbook.md` (if present) before touching the running app.

### Step 1 — Plan the fix (before writing any code)

1. Read the bug file's "Likely Location" and open those files. Confirm the diagnosis against the current code — bug files can be stale.
2. **Decide the layer first.** If the numbers/`save_type`/dice/recharge text disagree with the monster's own description or its `ability_score_modifiers`/`proficiency_bonus`, the fix is **data** (`monsters.json`) — correct the field. If the data is right but the app resolves it wrong (DC ignored, half-damage not applied, condition not applied on fail, AC comparison off, mechanic never fires), the fix is **code**.
3. **Find similar VERIFIED behavior and copy its pattern.** In `docs/monster-actions-manifest.json`, find `"verified": "verified"` rows sharing the same `actionType`/mechanic (attack vs AC, save half-damage, condition application, AoE, multiattack). Read the code that already handles them (e.g. an already-verified `save` row resolves correctly through `saveProcessing.js`/`handleNpcSaveDamage`) and mirror that structure, naming, logging, and event flow. Do NOT invent new architectures, helper abstractions, or event types when an established pattern exists. Consistency beats cleverness.
4. Check the rule-data ground truth in `public/data/monsters.json` — the JSON is the truth; the bug file's "Expected" section may itself be wrong. If the bug file's expectation contradicts the monster's canonical description/numbers, note it and fix to canonical.
5. `recharge` / limited `uses` / legendary-use gating that is display-only: if the fix is to *implement* enforcement, mirror however the app already tracks finite uses elsewhere (grep for existing `uses`/`recharge` consumers); add the smallest enforcement + a campaign-log entry. If enforcement genuinely needs new state design, that is `FIX: SKIPPED`.

### Step 2 — Confirm or disprove (Playwright MCP)

Before changing anything, reproduce the bug's "Steps to Reproduce" on localhost: Encounter Builder → exact monster name → Join Encounter → select monster + target → open the monster card → click the action dice link → inspect the popup and Campaign Log. If the behavior is already correct, stop: return `FIX: DISPROVED` with concrete evidence (what you clicked, rolled values, DC enforced, HP delta). Do not "fix" working code.

### Step 3 — Fix

Implement the minimal fix in the correct layer, following the verified patterns from step 1. Every monster-action resolution must log to the campaign log when triggered, with event details (roll/hit/save/damage/condition). Use `isWithinRange`/`computeMapRangeState` for any range check. No inline styles. Server-first: any state you write goes through the runtime store / `combatSummary`, never localStorage. Dual-ruleset note: monsters are shared across 5e/2024, so fix the shared resolution path once.

### Step 4 — Regression test

Write a vitest regression test co-located with the file you fixed, matching the existing naming convention (`<File>.<aspect>.test.{js,jsx}` — e.g. `MonsterCardModal.recharge-gate.test.jsx`, `saveProcessing.half-damage.test.js`, `hitResolution.<aspect>.test.js`). For a pure `monsters.json` data fix, add/extend a data-consistency assertion in the nearest existing test that reads `monsters.json` rather than inventing a new harness — look at how neighboring tests load fixture monster data. The test must lock the exact behavior that was broken. Mirror the setup/mocking conventions of sibling tests (`vi.mock` `diceRoller`, `logService.addEntry`, `combatData`, runtime state) before writing your own.

Run, in this order, fixing until each passes:
1. `npx vitest run <the new test file>`
2. `npx vitest run <other test files in the touched folder(s)>`
3. `npm run lint` (zero warnings enforced)

If the full-suite run of the touched area has unrelated pre-existing failures, note them in your return message — do not "fix" unrelated tests.

### Step 5 — Re-verify end-to-end (Playwright MCP)

Re-run the bug file's reproduction steps and confirm the "Expected" behavior now occurs exactly (correct to-hit vs AC, correct DC enforced, full damage on fail / half on success, condition applied on fail, HP drop correct, correct log entries). A partial improvement is not a fix.

### Step 6 — Clean up

Clear the change-data cache and campaign log for `test-campaign` via the Admin panel. Only mutate data inside `test-campaign`.

### Outcomes

**FIX: FIXED** — return `FIX: FIXED` with:
- Explicit list of changed/new file paths (source and/or `public/data/monsters.json`, regression test) for the primary's git staging.
- The `## Title` text from the bug file (for the commit message).
- Evidence: Playwright re-verification (rolled values, DC, HP delta, condition, log) + passing test/lint summary.
- Any new playbook recipe or pitfall worth recording.
Then **delete the bug file** (`rm .opencode/plans/<bug-file>.md`) — only after lint, tests, and re-verification all passed. Verify deletion with `ls`.

**FIX: DISPROVED** — same as FIXED but no source/data/test changes: delete the bug file, verify deletion, return `FIX: DISPROVED` with the evidence and title.

**FIX: SKIPPED** — only when, after studying verified sibling patterns and the rule data, there are genuinely two or more defensible fixes (typical of a mechanic like recharge that needs new state design) and you cannot tell which the codebase's standards demand. Append a `## Fix options` section to the bug file listing each option, its trade-offs, and the verified behavior each mirrors, then return `FIX: SKIPPED`. This must be rare — if one option clearly matches existing verified patterns, that IS the answer; fix it.

**FIX: FAILED** — you attempted the fix and it does not work (tests fail, re-verification fails, or the fix is wrong in a way you cannot resolve). Append a `## Fix attempt` section: what you changed, what failed, exact error output. Leave partially-correct changes in place and note that clearly; revert changes that make things worse. Return `FIX: FAILED` with the failure summary.

---

## Worked example — MA-0031 "Cold Breath (Recharge 6)" (aoe-save)

**Bug file:** `.opencode/plans/bug-mon-ma-0031-cold-breath-half-damage.md` — failed Constitution save vs DC 18 takes full 10d8, but a **successful** save also takes full damage; no halving occurs.

**Step 1:** Layer = **code** (data is correct: DC 18, 10d8). Open `saveProcessing.js` `processNpcSave` — confirms the success branch calls `applyDamageToTarget` without `computeDamageAfterEvasion`/`computeDamageAfterSave`. Find a verified AoE-save row (e.g. another `aoe-save` marked verified) and mirror how its success path halves damage via `computeDamageAfterSave`.

**Step 2:** Reproduce: Abominable Yeti → Cold Breath → force a target to succeed the save → HP drops by full 10d8. Bug confirmed.

**Step 3:** Fix the success branch to halve (rounded down) before applying, logging both the save result and the halved damage — mirroring the verified sibling.

**Step 4:** Regression test `saveProcessing.half-damage.test.js` asserting a successful save against DC 18 applies `floor(rolled/2)` Cold; run it, then the folder suite, then lint.

**Step 5:** Re-run repro: failed save = full 10d8, successful save = half; log shows both.

**Outcome:** `FIX: FIXED` with file list + title → primary updates manifest to `"verified"`, stages exactly those paths, commits `fix(MA-0031): Cold Breath successful Constitution save takes full damage — half-damage never applied`, bug file deleted.
