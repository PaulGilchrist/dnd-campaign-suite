# Released delegation: visitor's already-open monster card keeps rolling damage

## Summary
When the GM releases a delegated monster (control-select back to "— GM —"), a visitor
device that ALREADY has that monster's stat-block card open (`mc-overlay`) is not
locked out: the overlay stays fully live and chip presses continue to roll, hit, and
apply real damage. The release audit promises control only "until released", and the
open-gate law (`controller !== null`, creatureControl.js LAN-trust D2) is only checked
at OPEN time — a fresh avatar click on the released monster is honestly inert, so the
gate works for new opens but not for stale-open cards.

## Steps to reproduce
1. In `test-campaign` on localhost (GM tab), join a Goblin via Encounter Builder
   ("Select Goblin" → "Join Encounter").
2. On the Goblin's Initiative card, set `[data-testid="control-select"]`
   (aria "Assign who controls Goblin") to a player, e.g. AasimarTest.
3. Open a second browser context as a LAN visitor (isolated context at
   `http://<en0-ip>:5173`), select `test-campaign`, go to Initiative.
4. Visitor: trusted-click the Goblin avatar (`img.avatar-image[alt="Goblin"]`) — the
   monster card overlay opens ("Your turn!" cue present). Arm AasimarTest in
   `[aria-label="Goblin target"]` (targetName lands server-side).
5. GM tab: release control — select "— GM —" in the control-select. Verify: audit row
   "Goblin returned to the GM.", cs row `controller` absent, visitor's YourTurnCue
   disappears live.
6. Visitor tab (overlay STILL open — it never closed): click the overlay's first
   `.mc-dice-link[data-kind="attack"]` (Scimitar +4), press Done on the popup.

## Expected behavior
Releasing control immediately revokes the visitor's ability to run the card — the
open overlay should close or disable its action chips (same zero-trust face as the
inert avatar click after release).

## Actual behavior
- The `mc-overlay` survives the release echo with zero visual change.
- The Scimitar press rolls honestly: popup "Scimitar | 19 | d20 15 +4 | ✓ HIT (19 vs
  AC 12)", and the log gains a `roll` row (characterName "Goblin", hit:true), a damage
  roll row, and an `hp_change` row applying damage to AasimarTest (runtime bucket
  143 → 136 witnessed earlier in the same lane; this press added more).
- Control probe: closing the overlay and re-clicking the avatar after release =
  correctly INERT (no overlay). So only the stale-open lane leaks.
- No console errors; all writes 200 (change-data buckets are visitor-writable by
  design for delegation, so the server cannot tell which device pressed).

## Likely location
Confident on the mechanism, guessing on the ideal fix site:
- Open-time gate: `createNpcClickHandler.js` / `creatureControl.js` (canOperate checks
  `creature.controller !== null` when the avatar is clicked).
- The visitor's `MonsterCardModal`/`mc-overlay` open state is per-client `useState`
  (the 579aca8d2 stat-block-privacy design); nothing re-validates `controller` on the
  combatSummary SSE echo while it is mounted. `src/components/initiative/Initiative.jsx`
  (modal render branch) or the modal component itself would need the live gate.

## Suggested fix
Make the visitor-side overlay render-gate on LIVE controller state, not open-time state:
when `isLocalhost === false`, only render `mc-overlay` for a creature whose CURRENT
`combatSummary` row still carries a `controller` (optionally still `!== null`, since
LAN-trust D2 accepts any device); when the controller field disappears, the modal
unmounts (or all `.mc-dice-link` chips + target-select disable with an honest
"control returned to the GM" notice). A closing effect on the combatSummary change
handler keyed by the open creature's name is the smallest surface. Add a regression
pin: released-mid-open → chip click produces zero roll rows.

## Severity
Data integrity risk — the release audit explicitly promises the device "can run its
card … until released", yet damage/rolls keep landing after release; GMs cannot trust
the picker as a kill-switch for an open tab.

## Resolution
**FIXED 2026-11-11** — diagnosis in the filed bug confirmed exactly; the suggested
fix site was adopted with one refinement.

**What was actually wrong:** the visitor's open-gate (`CreatureCard.jsx` `CardAvatar`
⇒ `getCreatureController(creature, allCreatures, myTargetEffects) !== null`, LAN-trust
D2) is evaluated only at avatar-CLICK time, while the mounted `mc-overlay` lives in
per-client `useState` (`viewingMonster`/`viewingMonsterName` in `Initiative.jsx`) and
was rendered by `GmStatBlockModal` with NO re-validation against the live
`combatSummary` — so the release echo (cs-field delete + `control_released` audit)
dropped the avatar gate and the `YourTurnCue`, but the stale-open card stayed fully
live: pre-fix repro logged 3 attack rolls + damage roll + an `hp_change` applying real
damage to AasimarTest (runtime 143 → 137) entirely AFTER the release row.

**Fix:** `GmStatBlockModal` in `src/components/initiative/Initiative.jsx` now re-checks
the SAME predicate on every render for non-localhost clients: look up the open
creature's LIVE `combatSummary` row by `monsterName`, filter the reactive
`targetEffects` mirror the same way `CreatureCard` does, and unmount when
`getCreatureController(...) === null`. Chose unmount over chip-disabling — identical
zero-trust face to the inert avatar click, and it also takes any staged damage popup
down with it (Done can never fire post-release). Because the gate is exactly the
open-time predicate, every lane that could OPEN also survives KEEPING: explicit
controller, summoned-te (release falls back to the summoner), wild-shape/shapechange
forms; GM (localhost) renders are untouched, and re-assigning control re-mounts the
card (per-client open state is preserved). No server change: change-data buckets are
visitor-writable by delegation design, the client gate is the revocation surface.
Dual-ruleset N/A (UI gate, not rules logic). `Map.jsx`'s own `MonsterCardModal` render
is the GM-only map-token lane — out of scope.

**Files changed:**
- `src/components/initiative/Initiative.jsx` — live-control gate in `GmStatBlockModal`
  (+1 import, gate hook moved inside the modal component to stay under the
  complexity ratchet).
- `src/components/initiative/Initiative.statblock-release-gate.test.jsx` — NEW
  regression suite (5 tests, mirrors `Initiative.tv.test.jsx` harness): delegated-open
  survives an unrelated echo; RELEASE mid-open unmounts (the exact broken behavior);
  derived summoned lane survives release; GM lane unchanged; row-removal unmounts.

**Verification:**
- Pre-fix live repro (test-campaign, GM localhost:5173 + isolated LAN context via
  en0 IP): Goblin EB-joined → delegated to AasimarTest → visitor opened the card +
  armed AasimarTest → GM released (cs controller ABSENT + "Goblin returned to the
  GM." audit) → stale overlay survived and rolled: rows `roll(hit:false)×2`,
  `roll(hit:true)` + damage roll + `hp_change` (143→137) ALL after the release row;
  control probe: close+re-click = inert. Bug confirmed.
- Post-fix live re-run (fresh reload of both tabs): release → visitor's overlay
  UNMOUNTS within ~0.4–4 s of the echo (0 chips residue), avatar re-click inert, and
  ZERO log rows land between release and re-delegation. Adjacent sanity: re-delegate
  → card re-mounts live on the untouched visitor tab → arm + Scimitar press → honest
  hit/damage/`hp_change` trio. Console 0 errors.
- Tests: new file 5/5; anti-vacuity proved (gate stubbed → exactly the 2 unmount pins
  fail); `src/components/initiative` 107 files / 783 tests green; `App.map-activate` +
  `encounter/MonsterCardModal.attack-logic` + `services/encounters` 106 files / 1257
  tests green; `npm run lint` 0 errors 0 warnings; `no-timers-guard` OK.
- Exit: test-campaign change-data `{}` + log `[]` two-pass GET-verified via the
  Admin clear routes; no monsters left on the board.
