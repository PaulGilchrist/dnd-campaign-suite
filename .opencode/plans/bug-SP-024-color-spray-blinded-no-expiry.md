# Bug SP-024 — Color Spray (2024, save_only): Blinded condition never expires

**Verdict: FAIL** — Blinded persists permanently. Canonical expiry "until the end of your next turn" is not modeled: the aoeCondition lane never stamps an expiration, so failed targets stay Blinded past round 4+ with no drain and no broken event.

## Canonical (public/data/2024/spells.json, index color-spray)
> "You launch a dazzling array of flashing, colorful light. Each creature in a 15-foot Cone originating from you must succeed on a Constitution saving throw or have the **Blinded condition until the end of your next turn**."
- duration: "Instantaneous", concentration: false, damage: null
- dc: { dc_type: "CON", dc_success: "none" }
- automation: { type: "save_only", saveType: "CON", effects.fail: [{ type: "blinded", condition: "blinded" }] }
- classes: Bard, Sorcerer, Wizard

## Test run (live, 2026-10-04)
- Caster: DivinationWizard (lv20 2024 Wizard, INT 20, PB +6 → **DC 19** — matches sheet "Save DC: 19" and every log line).
- Targets: Goblin 1 / Goblin 2 (EB Join Encounter; combatSummary type "npc", saveBonuses.con = 0).
- Lane: savePath.js:31→handleAoE; :169 `isConditionOnlyAoe = !hasDamage && automationEffects?.fail?.length>0` → :173 `modalName:'aoeCondition'` → AOEConditionModal.

### What worked (exact)
- Per-target CON save adjudication, DC 19, rolled mode normal single d20:
  - `save_result Goblin 1 failed CON save (DC 19, rolled 16 + 0 = 16)` (success:false)
  - `save_result Goblin 2 failed CON save (DC 19, rolled 10 + 0 = 10)` (success:false)
- Condition applied on fail only: `condition applied | Goblin 1 | blinded | ability CON | sourceName DivinationWizard` (+ Goblin 2). dc_success none semantics OK — no success path existed (both failed); success branch structurally grants nothing (AOEConditionModal :344-346, effects.success empty in canonical).
- **Zero damage**: 0 damage/hp entries in entire log post-cast; addTargetResult payloads `appliedDamage: 0` (:73, :161).
- Slot spend: spell_slots_level_1 **4 → 3** (−1 lv1), no concentration (spell data concentration:false; no concentration stamp appeared).
- Shape/range gap (documented, not root cause): chooser lists ALL 16 combatants — AOEConditionModal.jsx:376-384 eligibleTargets = every combatSummary.creatures; no cone geometry/15-ft filter.

### The defect (root cause)
**No expiry is ever registered for the granted condition.**
- `applyConditionsToTarget` (AOEConditionModal.jsx:245-259) pushes `'blinded'` onto the target's `activeConditions` and stops. `grep addExpiration src/components/char-sheet/modals/shared/AOEConditionModal.jsx` → zero hits; the module doesn't even import `rules/effects/expirations.js`.
- Expiry machinery exists and is used by siblings (saveOnlyHandler.js:89-91 `addExpiration({... rounds: undefined, expireOnCreatureName})`; expirationQueue.js:19 `expiryRounds: rounds ?? Infinity, expireOnCreatureName`):
  - App convention for "end of caster's next turn" (§CLA-045 precedent): stamp `{appliedRound: casterRound, expiryRounds: 1, expireOnCreatureName: caster}` → drains at round-wrap (`Expired = currentRound >= appliedRound + rounds`, expirationQueue.js:25).
- Live proof of inert expiry: after cast (round 1), initiative advanced to **round 4** (activeCreature cycled past caster):
  - `Goblin 1 activeConditions: ['blinded'] | pendingExpirations: []`
  - `Goblin 2 activeConditions: ['blinded'] | pendingExpirations: []`
  - `campaign targetEffects: null`, DW `pendingExpirations: []`
  - campaign-log `blinded` events: only 2 × `applied` (ts 1791084733478/481), **no broken/expired entry ever**.
- `grep -n blinded src/services/rules/effects/{turnStartEffects,expireStaleEffects,expirations}.js` → no generic turn-end purge of blinded; only explicit te-driven cleanups (e.g. Feign Death in clearExpirationEffects.js:190) — none keyed to this cast.

### Secondary cosmetic defect
ResultsSummaryModal shows **"0 targets saved, 0 targets failed"** after both goblins failed. `resolveNpcTarget` returns `null` on failure (AOEConditionModal.jsx:163) so failures never reach `resultsState`; the summary only ever counts successes. Conditions/logs are correct — display-only.

## Fix sketch
In AOEConditionModal failure branches (:127/:339/:502), after `applyConditionsToTarget`, register `addExpiration({ attackerName, targetName, effects:[{type:'blinded',condition:'blinded'}], campaignName, rounds:1, expireOnCreatureName: casterName })` honoring the spell's "end of your next turn" (honor per-spell duration rather than hardcoding if other condition-only AoEs join this lane). Also return a record (not null) from resolveNpcTarget on failure so the summary counts failed targets.

## Fixtures/restore status
- spells[] restored (Color Spray removed, 51 originals disk-verified); joined goblins removed; Admin Clear Change Data + Clear Campaign Log; quiet verified (see checkpoint-SP-024.md).
