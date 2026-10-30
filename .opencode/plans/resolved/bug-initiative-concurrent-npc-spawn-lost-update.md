# Initiative board silently loses a creature on concurrent two-tab +NPC spawn

## Summary
Two localhost GM tabs that add an NPC to the initiative board at (near-)the-same-time converge on a board containing only ONE of the two spawned NPCs. The loser's spawn vanishes with zero toast, zero console output, zero log row. The initiative board (`combatSummary`) is a raw full-replace store with no stamp/version guard, so a read-modify-write race silently drops one tab's entire board mutation.

## Steps to reproduce
Starting state: test-campaign, two localhost tabs (A and B) both on the Initiative view, zero-reload markers planted (`window.__noReload`), recording confirm-spy armed TRUE on both tabs (`window.confirm = m => { __confirms.push(m); return true; }`), board = 12 PCs + 1 Goblin (13 creatures), server combatSummary GET-verified at 13.

1. In BOTH tabs, click the `+ NPC` button (`button[title^="Adds a statless NPC"]`) simultaneously (single `Promise.all([A.click, B.click])` in Playwright; each tab fires and accepts its own named confirm `Add NPC with placeholder AC 10 / HP 10? Edit on the card.`).
2. Wait ~2.5 s for echoes to settle.
3. `GET /api/campaigns/test-campaign/combatSummary` and count `creatures` (note: read shape is `{combatSummary:{…}}` — unwrap the `combatSummary` key, NOT `value`).
4. Observe both tabs' card lists.
5. CONTROL: click `+ NPC` in tab A, wait 1.5 s, then click `+ NPC` in tab B, wait 1.5 s, re-read the server board.

## Expected behavior
Two accepted spawns produce two creatures (server board 15: `NPC 1` + `NPC 2`), as the sequential control does — or, if a conflict is detected, the losing tab gets honest feedback (a toast/409-style guard like the `.ct-*` entity lanes have).

## Actual behavior
Server board ends at 14 creatures with exactly ONE non-player NPC (`Goblin` + `NPC 1`). One whole spawn is lost. Both tabs live-converge to the winner's board with zero reload markers tripped. Console is 100% clean on BOTH tabs (0 errors, 0 warnings). No `encounter`/`npc` log row records either spawn or the loss. The illusion is total because BOTH tabs independently name their spawn `NPC 1` (names derive from each tab's local creature count), so the loser's card text is indistinguishable from the survivor's and no disappearance is perceptible.
CONTROL result (sequential): board = 16 with `NPC 1`, `NPC 2`, `NPC 3` — the lane itself works; strict simultaneity is the differentiator.

## Likely location
Confident on the mechanism, guessing on the exact fix site. `+ NPC` → `handleAddNpc` (`src/components/initiative/createCreatureHandlers.js:255`, button wired at `Initiative.jsx:720`) reads the locally-mirrored `combatSummary`, appends the NPC, and `storage.set('combatSummary')` POSTs the FULL board — last write wins, no `updatedAt`/version stamp, no merge. This is the same class the `.ct-*` entity family closed with the `jsonEntityCrud` concurrent-write guard (409 + named banner), and it affects EVERY board mutation on this lane (HP edits, Clear, Prev/Next, target arming), not just +NPC — +NPC is just the cheapest deterministic repro. SSE echo ordering (`server/routes/campaigns-changedata.js` publishes synchronously pre-response) narrows but does not close the window between a tab's store-read and its POST.

## Suggested fix
First investigation step: read `createCreatureHandlers.js:255` + the shared `loadCombatSummary`/`storage.set` pair and confirm no stamp travels with the write. Options, in increasing ambition:
1. Minimal honest feedback: on `storage.set('combatSummary')`, compare the POSTed creature count/names against the echoed server board and toast when the tab's mutation is absent (same "post-ack row" doctrine as the EB join fix 26ffb4aa5).
2. Version-guarded write: carry a monotonic `boardVersion` (or `updatedAt`) inside the combatSummary value; POST includes the base version it was built from; server 409s a stale base; the client re-reads, re-applies its single mutation (append one NPC) onto fresh state, and retries once.
3. Targeted mutations: make +NPC (and Clear/HP) go through a per-mutation server-side patch endpoint instead of full-board replace.
Note: the name collision (`NPC 1` generated twice from local counts) is a secondary symptom — fixing numbering to read the FRESH board before naming is a cheap hardening even if a full guard lands.

## Severity
Data integrity risk — the initiative board is the most game-critical shared state in the app; a GM pair using two windows can silently lose a monster/spawn/HP edit with no observable signal anywhere (no toast, no console, no log row, converged UI hides it).

## Resolution
**FIXED (2026-10-29, fix run).** Reproduced live first (two dev:locked tabs, recording confirm-spies TRUE, `Promise.all` +NPC): both confirms accepted, server board 12→13 with ONE `NPC 1`, both tabs converged zero-reload, console 100% clean — the diagnosis in this file was confirmed: `handleAddNpc` read-modify-wrote the locally-mirrored board and `storage.set` full-replaced it with no stamp; names derived from the LOCAL count made the loss invisible.

**What was actually wrong:** exactly the guessed mechanism — no version/stamp travelled with the full-board POST, and no writer ever checked the echo. The fix chose a hybrid of Options 1+2 (least-ambitious-honest): a server-side **version guard with one client re-apply**, mirroring the `.ct-*` lanes' jsonEntityCrud 409 doctrine plus the EB-join post-ack doctrine (26ffb4aa5), instead of toast-only feedback — so the Expected primary outcome ("two accepted spawns produce two creatures") now happens **deterministically**, not just honestly-labelled.

**Changes:**
- `server/routes/campaigns-changedata.js` — new `staleCombatSummaryBase()` guard in the generic POST: a write carrying `baseVersion` commits only when it equals the CURRENT stored `combatSummary.boardVersion` (stamp rides inside the value, so unversioned legacy writes pass through untouched and the chain travels/clears with the board); stale base → 409 `{conflict:true, boardVersion}` + single-layer server WARN.
- `src/services/ui/storage.js` — combatSummary queue lane gained an optional 4th arg `{ baseVersion }`: stamp rides in the POST body, guarded calls resolve `{ ok, status }` (409 distinguishable from transport failure); 3-arg TRUE/FALSE contract stays byte-exact for every legacy writer.
- `src/components/initiative/createCreatureHandlers.js` — `handleAddNpc` is now the guarded flow: strict fresh read (transport failure aborts honestly, EB read-blip doctrine) → numbering derived from the FRESH board (the cheap hardening — racing tabs stamp distinct names) → `mergeCombatSummaryWithCharacters` keeps roster PCs in the written shape → mutation on a clone (mirror prop stays pristine pre-ack, no phantom card) → guarded awaited POST → on 409, ONE re-apply onto the fresh board (never re-prompts the confirm) → a second conflict or any failure is a named toast. The utils guid-for-NPCs warning is sidestepped entirely: the guard stamp is a board-level `boardVersion`, never a creature identity.
- `src/components/initiative/Initiative.jsx` + `Initiative.css` — `.initiative-toast` (`role=status`, mirrors `.encounter-toast` tokens) fed by a stable `showToast` dep; auto-hide timer is the benign toast category (no-timers guard passes).
- Dual-ruleset: no 5e/2024 sibling — the Initiative tracker lane (`createCreatureHandlers`/`storage`/change-data) is ruleset-agnostic shared code.

**Tests:** new `createCreatureHandlers.npc-spawn-race.test.js` (7) — deterministic two-tab Promise.all simulation against a fake guarded server: concurrent spawns converge on `NPC 1`+`NPC 2` (loser re-applies, single confirm, zero toast), fresh-board numbering, PC-merge preserved, repeated-409 honest toast bounded at one retry, non-409 failure no-retry, strict-read-blip abort, legacy-undefined ack semantics; new `server/routes/campaigns-changedata.combatsummary-guard.test.js` (7) — 409-without-touch, chain-reset via unversioned seed, legacy/other-key passthrough; +4 guarded-lane pins in `storage.combat-summary-status.test.js`; existing `createCreatureHandlers.test.jsx` +NPC lane updated to the clone/guarded contract; `mergeCombatSummaryWithCharacters` added to the three factory-lane mocks (hp-clamp/sp069/gm-hp-death-floor). Touched folders green (initiative 67/67 files, 535 tests; server/routes+services/ui 86/86, 1400); **full suite green: 2921 files, 32266 passed (+3 expected-fail)**; `npm run lint` 0/0; `node .opencode/plans/no-timers-guard.mjs` OK.

**Live re-verification (dev:locked, test-campaign, API restarted for the server edit):** clean 12-PC board, two tabs, spies armed — race leg: server 12→**14 with `NPC 1` + `NPC 2`**, boardVersion 2, both tabs 14 cards zero-reload, each confirm once, no toast (fresh-read naming alone serialized this pair — the guard wasn't even needed); forced-409 leg (route-delayed tab B's POST so its stale base landed after tab A's commit): B's POST → **409** → re-applied as `NPC 6` → 200, server converged 18 creatures, one confirm, zero reload, console = the single browser resource-409 line, server WARN `base version 4 vs current 5` (single-layer); sequential control: `NPC 7`/`NPC 8` land; adjacent mutation sanity: GM HP edit on the untouched 3-arg lane persists (`NPC 7 → currentHp 7` server-side). Final cleanup: change-data `{}` + log `[]` + combatSummary null, GET-verified two-pass from closed-tab quiet.

**Residual (documented, pre-existing class):** the guard covers GUARDED writers vs each other; unguarded writers (HP edits, Next/Prev, EB join) still full-replace without a base check — a concurrent HP edit can still clobber a spawn (unchanged from before; Option-3 targeted-mutation endpoints remain the eventual closer). +NPC still writes no campaign-log row (unchanged product behavior — no `npc_spawn` renderer type exists); the honest signals for this lane are the toast + server WARN.
