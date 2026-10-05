# BUG CLA-099 — Dragon Wings: uses never decrement, refusal/SP-restore dead, duration never expires

**Verdict: FAIL** (core uses/SP economy broken: unlimited free activations, refusal popup unreachable, 3 SP restore never fires).
Host: AberrantSorcerer lv20 (subclass temporarily swapped to Draconic Sorcery). Campaign: test-campaign. Env: localhost:5173.

## Manifest (public/data/2024/classes.json:11312)
`{type:'dragon_wings', casting_time:'1 bonus action', duration:'1_hour', flySpeed:60, hover:true, uses:1, recharge:'long_rest', resourceCost:'sorcery_points', restoreCost:3}` — "Once per Long Rest (or spend 3 SP to restore)."

## Failures
### F1 — Uses never decrement (FAIL-class)
- `dragonWingsHandler.js` activation branch (:102-129) writes `dragonWingsActive` + activeBuffs + log, **never writes `dragonWingsUses`**. Grep: the only write to the uses key is inside `restoreDragonWings` (:28, sets uses back to max).
- GET proof after activation and ×3 uses: key `aberrantsorcerer_dragonWingsUses` absent from change-data.

### F2 — 0-uses refusal + 3 SP restore lanes unreachable (FAIL-class)
- Gate `active = (storedUses != null ? Number(storedUses) : usesMax) > 0` (:87). storedUses is never 0 (F1) → `restoreDragonWings` (:13) never runs: refusal popup "no uses remaining… Long Rest… 3 SP" never shown; SP spend (:27) + "restored … 3 Sorcery Points" log (:30-35) never fire.
- Live: click 2 while active = **"Dragon Wings deactivated."** toggle, click 3 = free re-activation. Sorcery Points unchanged (sheet 20/20; GET `sorceryPoints:20` after 3 activations). RAW breach: unlimited fly activations per day, zero cost.

### F3 — 1-hour duration never expires (CLA-096 defect family)
- Handler has no `addExpiration` call (grep vs sorcerer siblings bulwarkOfForceHandler.js:65, celestialRevelationHandler.js:149 which do register).
- `EXPIRATION_HANDLERS['dragon_wings']` (clearExpirationEffects.js:403) has zero runtime producers.
- GET proof: `AberrantSorcerer.pendingExpirations: []` after activations. Buff stands until Long Rest wipes activeBuffs (restRules-longRest.js:79) or admin clear.

### F4 — `dragonWingsActive` stamp orphaned / not LR-cleared
- Written (:103); `isActive()`/`deactivate()` exports have **zero importers** (grep) — flag is decorative.
- Deactivate lane (:48-57) and Long Rest reset list (restRules-longRest.js:716+) never clear it: GET after LR shows `aberrantsorcerer_dragonWingsActive: true` with `activeBuffs: []`.

### F5 — No badge surface
- Sheet DOM after activation: only `creature-badge effect-buff` is Inner Radiance; no "Dragon Wings" badge anywhere (Speed suffix is the sole visible indicator).

### F6 — Cosmetic
- Popup + log render raw enum: "for 1_hour" / "(Bonus Action, 1_hour)" instead of "1 hour".

## Passes (live-evidenced)
1. Row: "Dragon Wings:" clickable in Bonus Actions after subclass swap (automationRouter specialActions :248).
2. Activation: popup "Dragon Wings activated. Fly Speed 60 feet (hover) for 1_hour."; GET `dragonWingsActive=true`, activeBuffs `[{effect:'dragon_wings', flySpeed:60, hover:true, duration:'1_hour'}]`; ability_use log entry.
3. Fly speed lands correctly: Speed line "30 ft., fly 60 ft. (hover)" — fly 60 (not fly==walk; NON_GENERIC_FLY_EFFECTS charSummaryCalc.js:9,220; hover suffix CharSummary.jsx:131).
4. Deactivate lane: re-click while active removes buff (GET activeBuffs []), Speed reverts, popup + ability_use log "Dragon Wings deactivated."
5. Long Rest clears activeBuffs + Speed reverts.
6. Bonus-action gating: unmodeled (click activates instantly, no combat/resource gate) — advisory.

## Suggested fix sketch
On activation: `setRuntimeValue(playerName, usesKey, 0)`; restore lane then reachable (SP<3 refusal, spend 3 SP, log). Register rounds clock via `addExpiration({type:'remove_active_buff', buffName:'Dragon Wings'}, rounds:600)` honoring existing `EXPIRATION_HANDLERS['dragon_wings']`; clear `dragonWingsActive` on expiry/deactivation/long rest and re-arm uses on LR (restRules-longRest reset list). Add CreatureBadge (removable) for the buff. Format duration enum for display.

## Cleanup performed
Subclass reverted disk-verified (GET AberrantSorcerer.json → Aberrant Sorcery). Admin Clear Change Data + Clear Campaign Log GET-verified (change-data has no dragon/buff keys; log entries=0). Console: only known featFinder.js:3 noise.
