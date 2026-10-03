# SP-013 Barkskin — cast resolves to ZERO effect (applyBarkskinEffect dead call seam)

## Overview
Casting Barkskin (2024, lv2 Druid, Bonus Action, Touch) on a willing AC<17 target via the sheet opens the correct target picker, logs the `spell` entry, then applies NOTHING: no activeBuffs, no AC floor, no result popup, no `ability_use` log, no spell-slot spend. `useCustomHandlers.handleBarkskinConfirm` calls `applyBarkskinEffect` with POSITIONAL args while the function signature destructures a SINGLE object — `targetNames` is always `undefined` → early `return null` on every live cast.

## Expected (canonical 2024/spells.json, index=barkskin)
> "You touch a willing creature. Until the spell ends, the target's skin assumes a bark-like appearance, and the target has an Armor Class of 17 if its AC is lower than that."

Live-expected: activeBuff {name:'Barkskin',effect:'barkskin'} on target, sheet+initiative AC display 17 (displayCreatureUtils.js:29, CharSummary.jsx:47), `ability_use` log "X cast Barkskin on Y. Target's AC becomes 17.", lv2 slot consumed, AC>=17 targets skipped. Duration 1 hour, NOT concentration.

## Actual (live, test-campaign, :5173)
Wild_Sage_Druid (lv20 Druid Circle of the Sea, 2024, AC 9, lv2 slots 3/3) self-cast Barkskin:
1. Barkskin row (Bonus Actions section) → detail popup text EXACT 2024 wording ✓
2. Cast Spell → gateBarkskin target picker with all 16 cs combatants, "Target's AC becomes 17." ✓
3. Radio self → "Cast Barkskin" click.
4. Result: sheet AC STAYS 9; change-data `Wild_Sage_Druid.activeBuffs=null`; lv2 slots UNCHANGED 3; `pendingExpirations=[]`; log has ONLY the raw `spell` entry (caster+target stamped), NO `ability_use` apply log; no result popup.

## Live control probe (same browser session, sandbox campaign)
- `applyBarkskinEffect.length === 1` (object param).
- Positional call, byte-shape copied from useCustomHandlers.js:80-87 → returns **null**, zero delta.
- Object call `{action, playerStats, campaignName, targetNames, characters}` → returns popup `"1 target(s) gained Barkskin from a cast: ProbeTarget."` and wrote activeBuff + pendingExpiration + ability_use log "Target's AC becomes 17." verbatim.
- ⇒ handler internals CORRECT; only the caller arg-shape is dead. Probe wrote to throwaway campaign dir (deleted after; test-campaign untouched).

## Steps to Reproduce
1. test-campaign, localhost:5173, GM.
2. EB: Join Goblin (AC15) + Knight (AC18); Initiative board populated.
3. Wild_Sage_Druid (Barkskin prepared via Edit wizard step 14, lv2 slots 3).
4. Bonus Actions → Barkskin row → Cast Spell → radio self → Cast Barkskin.
5. Observe: AC stays 9, no badge/buff/log/popup, slot 3/3.

## Likely Location
- `src/hooks/combat/useSpellMetamagicFlow/useCustomHandlers.js:80-87` — positional call `applyBarkskinEffect(actionObj, playerStats, campaignName, null, result, characters)` must become `applyBarkskinEffect({ action: actionObj, playerStats, campaignName, targetNames: result, characters })`.
- `src/services/automation/handlers/buffs/barkskinHandler.js:80` — signature `applyBarkskin({ action, playerStats, campaignName, targetNames, characters })`.

## Notes
- Slot payment also missing on this custom-confirm path (no `prepareSpellCast` in handleBarkskinConfirm; SP-085 Pass Without Trace family fingerprint — §useSpellMetamagicGates early-return bypass). Fix must land both or Barkskin stays free-cast.
- On the object-probe, expiration enqueued `expiryRounds: null` → 1-hour duration clock never consumes (CLA-235/addExpiration rounds-omission family).
- Display floor is unconditional `return 17` (CharSummary.jsx:47; displayCreatureUtils.js:29): if target ever gains real AC>=17 while buffed, display DROPS to 17 (grant-side skips AC>=17 so normally unreachable; edge note only).
- Attack-math seam `computeTargetAc` (targetAcComputation.js) reads computedStats.armorClass only — barkskin NOT folded into hit resolution even after buff lands (display-only buff risk; verify post-fix).
- Manifest paths stale: real handler is automation/handlers/buffs/barkskinHandler.js (no combat/automation/ tree).
- 5e/spells.json Barkskin differs (AC 16, concentration, action) — PASS criteria here pin the 2024 wording per manifest.
