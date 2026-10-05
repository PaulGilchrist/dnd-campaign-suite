# Bug Report — CLA-100 Dread Ambush (Gloom Stalker) — Ambusher's Leap re-grant never re-arms

**Verdict:** FAIL (Leg A sub-effect "each combat" inert from combat #2 onward; Legs B, C PASS)

## Defect
`applyDreadAmbushSpeedTurnStart` (`src/services/rules/effects/turnStartEffects.js:290-323`) latches `dreadAmbushSpeedActive=true` on the round-1 first-turn grant and **nothing ever resets it**:

- Only reference pair in the entire codebase: read at `:301` (guard `if (isActive) return;`) and write `true` at `:304` (verified by grep `dreadAmbushSpeedActive` — no other writers anywhere).
- `useInitiativeEffects.js` resets `dreadAmbushUsedThisTurn` (:80) but NOT `dreadAmbushSpeedActive`.
- `clearAllExpirationEffects`/`clearSelfBuffs` removes the `speed_boost` buff but not the latch.
- Initiative-view **Clear** resets round/active but preserves per-creature runtime stores (GET-verified: latch stays `true` after Clear).

Consequence: combat #1 grants Speed +10 correctly, but every subsequent combat in the same runtime session is blocked by the stale latch (`round===1` passes, `isActive` returns early). Feature text is "start of first turn of **each combat**".

## Live repro (test-campaign, FeyRanger lv17 Gloom Stalker, localhost:5173)
1. Fresh combat, Clear → walk Next to FeyRanger's first turn (round 1) → grant works:
   - GET change-data: `dreadAmbushSpeedActive: true`, `activeBuffs: [{"name":"Dread Ambush","effect":"speed_boost","duration":"until_end_of_turn","speedBonus":10}]`
   - Sheet Speed line: **60 ft.** (base 50 = 30 Human +10 Speedy +10 Roving).
2. After that turn: buffs `[]`, Speed back to 50 ft. (until_end_of_turn expiry OK).
3. Initiative **Clear** (confirm accepted) → round resets to 1, all init blank, gate None.
4. Walk Next to FeyRanger again in new round 1 (first turn of new combat):
   - GET: latch still `true`, `activeBuffs: []` → **no re-grant**
   - Sheet Speed line: **50 ft.** (expected 60 ft.).

## Fix suggestion
Clear `dreadAmbushSpeedActive` in the initiative-rolled handler (`useInitiativeEffects.js` buildInitiativeUpdates, next to `dreadAmbushUsedThisTurn`) and/or in the turn-end pass that removes the `speed_boost` buff (`clearExpirationEffects.js:405`).

## Verified working (not bugs)
- Initiative +WIS: sheet +5 (DEX 2 + WIS 3); rolls "d20 20 +5"=25, "d20 11 +5"=16; log `initiative-rolled` latch `dreadAmbushUsedThisTurn=null`.
- Dreadful Strike (reaction row, manual lane): "Dealt 5 Psychic … (Rolled 2d8.)" r1, "13 … 2d8" r2, "12 … 2d8" r3; uses ledger 3→2→1→0; `dreadAmbushUsedThisTurn` round latch 1→2→3 (oncePerTurn enforced: "Already used this turn. Once per turn."; re-arms on round change); miss ("✗ MISS 11 vs AC 12") → no offer, no consume; Long Rest → uses restore (key deleted → re-derived full, tracker **3/3**, log `long_rest`).
- 2d8 at lv17 matches data `scaling:{11:'2d8'}`; manifest "2d6" is the lv3 base text — data-consistent, not a mismatch.

## Notes / advisories
- 0-uses refusal ("no uses remaining. Recharges on a Long Rest.") grep-verified in `dreadAmbushHandler.js:44-47`; live same-turn probe hit oncePerTurn gate first (uses checked first in handler, but fresh round with uses=0 not walked) — advisory only.
- Lv17 Stalker's Flurry auto-offer modal appears after hit ("Apply Effect" disabled until a flurry option checked); reaction-row lane is the working dread_ambush_damage consumer (CLA-100 scope).
- Turn tracker walk quirk: traversal order is insertion order; blank-init creatures + stale active can cause a round wrap before the target's first turn — fill all blank inits and confirm active=None before walking (round-1 grant is gated on `round===1`).
