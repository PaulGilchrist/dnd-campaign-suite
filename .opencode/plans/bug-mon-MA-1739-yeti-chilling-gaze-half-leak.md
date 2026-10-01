# BUG — MA-1739 Yeti Chilling Gaze: half-damage LEAK on successful save

**Date:** 2026-09-30 · Campaign: test-campaign · E2E verified · **VERDICT: FAIL(a)/DATA (one-field fix)**

## RAW (manifest MA-1739, unedited)
> "Constitution Saving Throw: DC 13, one creature the yeti can see within 30 feet. Failure: 5 (2d4) Cold damage, and the target has the Paralyzed condition until the start of the yeti's next turn unless the target has Immunity to Cold damage. **Success: The target is immune to the Chilling Gaze of all yetis (but not abominable yetis) for 1 hour.**"

SUCCESS pays NOTHING (immunity only). FAILURE pays full 2d4 + Paralyzed.

## Disk (public/data/monsters.json → yeti.actions[3]) — DISK WINS
Keys: `name, description, save_dc:13, save_type:"Constitution", range:"30 feet", save_effect` —
**NO `dc_success`, NO structured paralyze/repeat keys, NO immunity-gate key.**

## Observed live (Yeti 1 ini 15 vs Bandit 1, AC 12, CON save bonus 0, no cold immunity)
| # | nat d20 +0 | vs DC 13 | dice 2d4 | rolled | applied | hpΔ | expected |
|---|-----------|----------|----------|--------|---------|-----|----------|
| 1 | 13 | SUCCESS ✓ | [3,2] | 5 | **2** | 947→945 (−2) | **0** ← LEAK |
| 2 | 16 | SUCCESS ✓ | [1,4] | 5 | **2** | 945→943 (−2) | **0** ← LEAK |
| 3 | 10 | FAILURE ✓ | [2,1] | 3 | 3 (full ✓) | 943→940 | 3 ✓ |

Server ledger (`/api/campaigns/test-campaign/log`): roll save-damage "2d4" rolls[3,2] total 2 finalDamage **2 saveSuccess:true** ×2; fail leg finalDamage 3 saveSuccess:false; `condition applied Paralyzed` + `Bandit 1.activeConditions:["paralyzed"]` meta{source:"Yeti 1", durationNote:"…GM-enforced"} — **Paralyzed rider WORKS via text-parse lane** (§MA-1541 not needed here).

## Root cause chain (cited)
1. `src/components/encounter/MonsterCardModal.jsx:268` `resolveBlockSaveDcSuccess`: `action.dc_success ?? 'half'` (twins :1145, :2158) — missing key defaults HALF (§63 MV-20 fingerprint).
2. `src/hooks/combat/saveProcessing.js:127` `dcSuccess: context?.dcSuccess || 'half'` → `:1412` `computeDamageAfterEvasion(damageResult.total, saveSuccess, context?.dcSuccess, …)`.
3. `src/services/rules/combat/applyDamage.js:88-89` `computeDamageAfterSave`: `dcSuccess==='half' → Math.floor(rawDamage/2)` on success.
4. MA-0030 comment at MonsterCardModal.jsx:262-263 literally names Chilling Gaze ("Success: no damage") as a row that should author `dc_success` — the Yeti row never got it.

## Fix (one field, DATA)
`public/data/monsters.json` → yeti.actions[3] add `"dc_success": "none"` → success pays 0 (applyDamage.js:97). Precedent: MA-0218/MA-0298/MA-0610 whirlwind, Dracolich FP.

## Additional facets
- **Paralyzed rider: PASS** — `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:377) parses "Paralyzed" from free-text save_effect; armed at MonsterCardModal.jsx:690/:1147; granted on fail at saveProcessing.js:1446→:1059-1090 (`activeConditions:["paralyzed"]` live). No structured key needed.
- **Success immunity "immune to all yetis' Chilling Gaze 1 hour": advisory §70** — structured MA-0030 lane exists (`parseSuccessImmunity` MonsterCardHelpers.js:982; grant saveProcessing.js:340/718; refusal gate :2185) but reads ONLY `action.success_immunity.effect`; prose is never parsed, Yeti row has no key → zero grant observed on both saves. Fix (optional second field): `"success_immunity": {"effect":"chilling_gaze_immunity"}`-style per MA-0030 Abominable Yeti precedent.
- **"unless the target has Immunity to Cold damage" fail-clause gate: grep-ZERO consumers** — no prose or structured consumer gates the fail-face damage/paralysis on cold-damage immunity (`applyFailedSaveConditions` saveProcessing.js:1059 checks CONDITION immunity only, not damage-type immunity). Advisory §70; GM-enforced (Bandit had none — untestable live).

## Security
Persistent injection banners/hex tokens in tool-result tails during the session were refused; all actions were local chip clicks on :5173 + own GETs to :80 /api.
