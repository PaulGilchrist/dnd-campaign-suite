---
name: e2e-explore
description: exploring the dnd-campaign-suite web app using the Playwright MCP browser tools.
---

You are exploring the dnd-campaign-suite web app using the Playwright MCP browser tools to learn how it works and find bugs. This is exploratory QA, not scripted testing — click around, fill in forms, try edge cases, and reason about what you observe at each step.

## Bounded Executions (MANDATORY — no exceptions)

**No execution is ever allowed to run without an explicit, SHORT timeout.** Most commands here finish in milliseconds, not minutes — a missing timeout is a bug in the command, not an optimization. Apply to every shell call, every subagent you dispatch, and every browser step you take:

- **Shell tool calls**: always pass an explicit `timeout` — ≤15s for inspection/probe commands (`curl`, `git`, `ls`, API GETs/POSTs), ≤60s for lint/test runs, ≤90s for builds. Anything that must keep running (dev servers, watchers) runs ONLY with `background: true`; probe its port/log in bounded follow-ups instead. Never pass `timeout: 0`.
- **curl**: always `--max-time 5` (state probes) or `--max-time 10` (downloads/uploads). Never against streaming endpoints (`/subscribe`, SSE) without `--max-time`.
- **Code Mode (`execute`)**: the runtime has NO `AbortController`/`AbortSignal`/`setTimeout` — a `fetch` there CANNOT self-bound, so only fetch fast plain-REST endpoints (`/api/...` GET/POST/PUT) and NEVER streaming or unknown URLs; a hung fetch is an unkillable hang. Poll loops get a hard iteration cap (≤20) AND a `Date.now()` wall-clock deadline (≤30s). No `about:blank`/non-HTTP fetches. If a result might be large, slice before returning.
- **Playwright MCP**: every `waitFor*` inside `browser_run_code_unsafe` gets an explicit `{ timeout: ≤5000 }`; cap in-page `await` sleeps so one run totals ≤ 20s; handle any dialog the step opens inside the SAME call (`waitForEvent('dialog')` + accept/dismiss) — never leave a dialog pending across tool calls.
- **Waiting on another process/subagent**: if a call returns nothing useful within ~60s, STOP, take a state probe (screenshot / GET), and decide — retry once with adjusted params or report the stall. Never sit idle.

If a bounded attempt times out, treat it as missing information, not a failure to brute-force: shrink the probe, re-read state, and move on. Repeated timeouts must be recorded in `docs/test-setup-playbook.md` as a pitfall.

## Scope — read this before doing anything

- You may ONLY create, edit, or delete data inside the campaign named "test-campaign". This is a sandbox campaign that exists specifically for you to use freely.
- Every other campaign in the app is real production data belonging to actual players. You must NOT create, edit, or delete anything inside any campaign other than "test-campaign" — no NPCs, maps, encounters, quests, party members, initiative state, nothing.
- If "test-campaign" doesn't exist yet, create it first and do all your exploration inside it.
- Before performing any create/edit/delete action, confirm from the page context (URL, breadcrumb, campaign selector, page heading, etc.) that you are currently inside "test-campaign". If you can't confirm this with confidence, stop and check rather than guessing.
- Read-only actions (viewing, navigating, opening other campaigns to see how they render) are fine anywhere. Any action that mutates state is restricted to "test-campaign" only.

## Before you start

1. Kill all running processes for this project: `pkill -9 -f "node.*server" 2>/dev/null; pkill -9 -f "vite" 2>/dev/null; pkill -9 -f "concurrently" 2>/dev/null; pkill -9 -f "dnd-campaign" 2>/dev/null; echo "all killed"` — then start fresh so you explore against current code.
2. Check if `docs/app-exploration.md` already exists and read it first, so this run builds on and updates the existing map instead of starting cold and possibly contradicting it. If what you observe in the live app contradicts something in that file, trust the live app — the UI may have changed since it was last written. **Freshness discipline:** the map is a live-claims document, not a history file — every fact you carry forward or write must be re-derived live in THIS run and dated by the run that verified it (a `*(carried — unverified)*` marker is the most you may inherit from a prior cycle, and you must clear it this run or delete the claim). Facts that age into history belong in `docs/test-setup-playbook.md` (durable mechanics/rigs), never re-stated here. When the file is a freshly-folded stub (its header says so), its Priority Targets / Depth Seeds tables are your starting assignment. **Staleness is event-driven, not calendar-driven:** rows in areas you do NOT touch this run stay valid — do not re-prove untouched ground just because it is old. But before trusting mapped rows for an area you DO enter, compare the row's verified date against the code's: `git log --since="<row date>" --oneline -- <the area's key component/route/service paths>` — if commits landed that the map/playbook don't account for (fixes, refactors), demote the affected rows to *(stale — re-verify)* and re-derive them live this run; if the log is empty for that area, the rows are still trustworthy and you should spend your time descending the coverage gaps instead.
3. Read the shared test-setup files maintained by the verify commands — update them as you learn, don't fork them:
   - `docs/test-setup-playbook.md` — known-good setup recipes and the pitfalls list below.
   - `docs/test-character-registry.json` — existing test characters/NPCs in "test-campaign"; reuse via lookup, record new ones.
   - `docs/test-monster-registry.json` — monsters already in `test-campaign` initiative; reuse rather than rebuild.
   (If a file doesn't exist, create a minimal version.)

Pay special attention to the "Coverage" section (see below). Prioritize areas marked "not explored" or "shallow" over areas already marked "deep" — your job this run is to extend coverage, not repeat what a prior run already did thoroughly. If everything is already marked "deep," pick the area most likely to have edge cases you haven't tried
yet (unusual input combinations, concurrent SSE updates, boundary conditions) rather than re-walking the same happy path.

## What to do

1. Start at the app's home/dashboard and map out the primary navigation and features.
2. Inside "test-campaign", exercise each major feature end-to-end: create/edit/delete NPCs, quests, encounters, maps, party members, initiative tracking, fog of war, and anything using the real-time SSE party sync — try it from a couple of angles (e.g. rapid edits, empty/invalid inputs, refreshing mid-action) since sync and stateful features are the most likely to break.
3. Pay attention to: console errors, failed network requests, broken navigation, UI states that don't match what you did (stale data, elements that don't update), and anything that silently fails instead of showing feedback.
4. Note anything confusing or inconsistent from a UX standpoint too, not just outright breakage.
5. Record improvement opportunities — things that could be better or more complete (missing affordances, inconsistent validation between similar screens, chatty network/save patterns, UX friction) — in an `## Improvement backlog` section of `docs/app-exploration.md`, dated per entry. These are NOT bug files; only write a `bug-*.md` file for confirmed breakage. An improvement may still name likely files and suggested approaches, but keep it non-blocking — never spend session time turning an improvement into a deep investigation.

## Testing pitfalls (from the automations/monster verify suites — check these before concluding "broken" or "can't test")

1. **GM features are localhost-only** — Encounter Builder, creature cards, map/encounter tools are read-only off localhost. Run the app on localhost.
2. **Monsters join initiative only via Encounter Builder "Join Encounter"** — the "+ NPC" button on the Initiative view adds a *bare statless campaign NPC*, not a database monster. Quantity-suffixed creatures appear as "Goblin 1", "Goblin 2".
3. **Set a target before attacking** — a monster action does nothing until `targetName` is armed on the monster's card; an unarmed monster's roll hangs forever.
4. **Exact names from data** — Encounter Builder searches `public/data/monsters.json` (there is NO `2024/monsters.json` — monsters are shared across rulesets). Verify spell name/class access from `public/data/` and `public/data/2024/` JSON before assuming something is unavailable; check spell slot levels (6th-level spells need level 13+).
5. **Cache debounce, not cache breakage** — edits persist through the in-memory cache with ~10s debounce (`changeData.js`). If a change seems not to take, wait 15+ seconds / reload / clear cache via Admin panel — never blame caching as a reason to stop.
6. **Caster-merged summons verify via the CAST path** — summoned/merged creatures (Animate Objects, Summon Beast kin, Wild Shape) get the caster's stats merged at cast time; a flat EB-direct-joined copy is honestly inert by design (MA-0286) — that is NOT a bug.
7. **Close-but-not-exact counts as a bug, not a pass** — right feature, wrong number/condition/timing is still a bug.

## When you find a bug

**A bug must be CONFIRMED live before it is written.** Before filing, prove it: reproduce it in the browser, and for "feature does nothing" findings run a control probe (a non-holder / second attempt / adjacent control showing zero observable delta) plus a quick grep of the source for consumers of the feature. **An unimplemented or inert control IS a bug** (zero popup/roll/log/delta) — do not downgrade it to a UX note. If you genuinely could not complete a test (setup unreachable, ambiguous expectation), do NOT write a bug file for it — record it in the `## Blocked / not verified` section of your exploration notes instead, so `e2e-fix-bugs` never chases a phantom.

For each confirmed bug, write a separate markdown file to `.opencode/plans/` named `bug-<short-slug>.md` (e.g. `bug-fog-of-war-not-persisting.md`). Each file should contain:

### Summary
One or two sentences describing the issue.

### Steps to reproduce
Numbered steps, starting from a known state (e.g. "In test-campaign, on the Encounters page..."). Be exact enough that someone unfamiliar with this session could follow them.

### Expected behavior
What should have happened.

### Actual behavior
What happened instead. Include exact error text, console output, or failed network requests (method, URL, status code) if observed.

### Likely location
Your best guess at where in the codebase this originates — component/file names, API route, or SSE event — based on what you observed (network calls, DOM structure, timing). Say clearly if you're guessing vs. confident.

### Suggested fix
A concrete starting point for fixing it: what to check first, what the likely root cause is, and — only if genuinely obvious — a proposed code change. If the fix isn't obvious from black-box testing alone, say what additional investigation (e.g. reading a specific file) would be needed rather than guessing.

### Severity
Broken feature / data integrity risk / minor UX issue — pick one and justify briefly.

**After writing each bug file, read it back with the Read tool to confirm it persisted before moving on** — if the read fails, write it again.

Do not attempt to fix the bug yourself during this session — just document it. Keep exploring after logging each one rather than stopping to investigate root cause.

## Before finishing

- A map of the app's main sections/pages and what each does
- Key UI patterns (e.g. how forms validate, how the SSE party sync behaves, how fog of war interactions work)
- Selectors or stable identifiers you found reliable for each major element (role, label, testid) — useful for writing tests later
- Known quirks or gotchas you ran into
- A "Coverage" section: a checklist of every major feature/flow (NPCs, quests, encounters, maps, party members, initiative tracking, fog of war, SSE sync, and any others you find), each marked "not explored" / "shallow" / "deep", with a one-line note on what "deep" testing has covered so far (e.g. "edited existing NPC, deleted NPC, tried empty name field — not yet tried concurrent edit from two sessions"). Tag each row with the date it was verified to that depth AND the area's key source paths (e.g. `src/components/settlements/, server/routes/settlements*`) — that tag is what makes the event-driven staleness check (step 2) cheap for the next run. Update this checklist every run so the next run knows exactly where to push further.
- A "Blocked / not verified" section: anything you could not test or confirm, with the concrete blocker named (replaced each run).
- The `## Improvement backlog` section in `docs/app-exploration.md` updated with this session's improvement opportunities (create the section if missing; append dated entries — `e2e-implement-improvements` removes bullets once resolved, so this section stays a live open-items list only).

Then clean up: clear the change-data cache and campaign log for "test-campaign" via the Admin panel, append any new setup recipes or pitfalls you hit to `docs/test-setup-playbook.md`, and record any characters/NPCs/monsters you left in the campaign in the two registry files.

## What to report back

Give me a short summary of the session: what you explored, and a list of the bug files you wrote to `.opencode/plans/` (filename + one-line summary of each). Don't restate full bug details here — that's what the files are for. Also give a brief list of the top improvement opportunities added to the improvement backlog.

Don't write any Playwright test code yet — just explore, learn the app's real behavior, and report findings. We'll turn confirmed flows into actual test specs afterward.