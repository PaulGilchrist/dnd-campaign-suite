# Bug CLA-107 — Eldritch Hex: chosen ability dropped (pinned STR), save-disadvantage te has zero consumers, no expiry

## Title
Eldritch Hex (Warlock lv10, Great Old One Patron): HexAbilityModal choice is discarded (defaults STR), `hex_save_disadvantage` te is never consumed by any save seam, and the hex te never expires on concentration break.

## Overview
Feature lane verified on HexWarlock lv14 with a temporary swap to Great Old One Patron (reverted, disk-verified). Prepared-rule works; the chooser renders; but chosen ability does not persist, and the saving-throw disadvantage — the actual delta this row automates — has no roll-seam consumer (zero observable difference vs non-hexed target), and no concentration/expiry consumer clears the te.

## Expected Behavior
Canonical app-data (`public/data/2024/classes.json:12570`): "Always have Hex spell prepared. When you cast Hex and choose an ability, the target also has Disadvantage on saving throws of the chosen ability for the duration." Automation: `{type:'passive_rule', effect:'always_prepared_spells', spells:['Hex']}` + `{type:'conditional_disadvantage', target:'saving_throw', abilities:[STR..CHA]}`.

## Actual Behavior
1. PASS — swap to GOO collects `always_prepared_spells(Hex)` + `conditional_disadvantage` (disk-verified); Hex castable (Bonus Action, 90ft). (Weakened by all warlock known-spells stamping Prepared:'Always'.)
2. FAIL — HexAbilityModal renders 6 abilities, but chosen DEX dropped on BOTH live casts: log + te show `ability:"STR"`. Cause: `spellCastService/execution/index.js:484` `metaCtx?.hexAbility || 'STR'` — chooser→target-picker→execute chain loses hexAbility.
3. Producer te lands (`hex_ability_check_disadvantage` + `hex_save_disadvantage` STR on Bandit; concentration {Hex, DC16}; Pact slots 3→2→0; log "ability check disadvantage + saving throw disadvantage") — but
4. FAIL — ZERO CONSUMER for `hex_save_disadvantage`: `savePromptUtils.js:7` GM-prompt checks only `ability_save_disadvantage`; inline `applyDamage.js` handles only concentration_breaker. Live probes: saves vs hexed Bandit → `saveRawRolls:[11,17]/[5,16] mode:"normal"` — no disadvantage on any seam.
5. FAIL — expiry: `hex_duration` producer-only; no concentration-break/expiration consumer clears hex te (grep: no hex in concentrationService/clearExpirationEffects); concentration anchor outlives te; manual badge-remove works (te clears).

## Steps to Reproduce
1. test-campaign, HexWarlock → Edit wizard step-7 → Great Old One Patron → Save, reload.
2. Cast Hex on Bandit; pick DEX in chooser → hex resolves as STR (log/te).
3. Force Bandit any saving throw → single d20, mode normal (no disadvantage) vs hexed target.
4. Break concentration → hex te persists until manual badge-remove.

## Likely Location
- `src/services/rules/spells/spellCastService/execution/index.js:484` (hexAbility threading into metaCtx lost; STR default).
- `src/services/rules/spells/spellCastService/execution/helpers.js` + chooser plumbing (hexAbility not persisted through target-picker).
- Consumer MISSING: `savePromptUtils.js:7` must include `hex_save_disadvantage` (and inline NPC save lane); CLA-104/SPA042 seam-family precedent (handleNpcSaveDamage.js:112 rides rider-save seam only).
- Expiry consumer missing: concentrationService/clearExpirationEffects must clear hex te on conc-break (CLA-005/SP-035 purge precedent).

## Notes
- 2014-canon Hex = disadvantage on chosen-ability CHECKS; app-data additionally asserts saving throws — the ability-check lane's actual behavior not captured live (no cheap check seam surfaced); adjudicate per app-data wording: saving-throw disadvantage is the mandated delta and is inert = FAIL.
- Subclass-revert note: computedStats.class.major/automation linger in disk blob after revert (deep-merge retention); verify reverts via UI/features, not computedStats.
- Verified 2026-10-04; cleanup GET-verified clean; HexWarlock left on Archfey Patron.
