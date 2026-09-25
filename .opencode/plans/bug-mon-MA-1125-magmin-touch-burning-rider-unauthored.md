# MA-1125 — Magmin "Touch": burning-on-hit rider unauthored (FAIL(a)/DATA, one-field)

**Verdict:** FAIL(a)/DATA — attack core exact and live; the "it starts burning" on-hit rider is
expressible through the LIVE generic `hit_target_effect` passthrough (te registered + transport
proven on twins) and the disk row authors nothing. One-field fix. (2026-09-24 session.)

## Row
- manifest: MA-1125, `magmin|actions|0`, Magmin, Touch, actionType label "attack+save" (label noise §117 — disk `save_dc:0`/`save_type:""`/`save_effect:""` decoy).
- disk: `public/data/monsters.json:39613` (monster block) → `actions[0]`:
  `"attack_bonus": 4` (PB 2 at CR ½ + DEX 2 from 15 ✓), `"damage_dice_primary": "2d4 + 2"`, `"damage_type_primary": "Fire"`, reach "5 ft.", no save fields, **no `hit_target_effect`**.

## Expected (quotes row text)
> "Melee Attack Roll: +4, reach 5 ft. Hit: 7 (2d4 + 2) Fire damage. If the target is a creature or a flammable object that isn't being worn or carried, **it starts burning**."

On a hit, the target should carry the registered `burning` target effect (badge + top-level
targetEffects entry + `condition applied` log), same grant model as MA-0995 speed_reduction.

## Likely Location — one-field DATA fix
`public/data/monsters.json` magmin `actions[0]`: add **`"hit_target_effect": "burning"`**.

MA-0995 byte-shape twin template (`monsters.json:34364`, hobgoblin-warlord Javelin):
```json
"range": "30/120 ft.",
"hit_target_effect": "speed_reduction",
"damage_dice_primary": "2d6 + 4",
```
Placement: after `reach`/`range`, before `damage_dice_primary` (versatile/passthrough family convention §219).

Transport chain (live, fully generic — no per-effect whitelist):
- `buildHitConditionClause` — `src/components/encounter/MonsterCardHelpers.js:648`, forwards `targetEffect = action?.hit_target_effect || null` (:651).
- Consumer `maybeApplyHitClause` → `applyHitClauseTargetEffect` — `src/hooks/combat/handlers/handlePlainDamage.js:611/:654`: `registerTargetEffect(campaignName, target.name, hitClause.targetEffect, …)` (:656) **verbatim**, stamps `duration:'until_start_of_next_turn'`, ONE attacker-anchored `addExpiration` clock (:659), `condition applied` log with registry label (:671). Size gate `isLargeOrSmallerTarget(target)` (:614) — Medium Bandit passes.
- te registered: `src/services/combat/conditions/targetEffectDefinitions.js:150-162` — `effect:'burning'`, label "Burning", group Defensive (FIRST, MA-0673 sort-pin), cls `effect-debuff`, fields `['source']`; registry description self-declares "no ongoing fire damage ... GM-enforced (no burn tick consumer in this engine)".

## Live evidence (2026-09-24, dev:locked test-campaign)
Fresh EB joins: "Magmin 1" (cs monsterIndex `magmin`, init 4) + "Bandit 1" (`bandit`, AC12, init 8); exact-td filter "Magmin" yielded exactly 1 row (§441); full-store cs POST all-four HP 999 both (§258), reload + re-select (header==test-campaign).
- Card Touch row: exactly ONE `.mc-dice-link` "+4", ZERO DC chips (§116; MA-1071 `save_dc>0` gate §437 holds — DC-dice trap never presented, never pressed).
- Roll 1: nat 12 (+4) = 16 vs AC12 targetAc/effectiveAc 12 → HIT; real-pointer Done (§286) → damage `"2d4 + 2"` Fire rolls [2,1] finalDamage 5; hp_change Δ−5 (999→994), breakdown `{Fire,5,resisted:false}` (§936/§75).
- Roll 2: nat 17 (+4) = 21 vs AC12 → HIT; `"2d4 + 2"` rolls [2,2] fd 6; Δ−6 (994→988), resisted:false. No nat20 → crit variant not observed (§32 n/a).
- **Burning probe per hit:** victim change-data `GET /Bandit 1` → `{"value":null}` both times (store key absent — §443 strictest zero-grant proof); top-level `targetEffects` → `{"value":null}`; log: 0 `burn` entries, 0 `type:"condition"` entries (total log 10 = joins/init/2×attack/2×damage/2×hp).
- **Recurring-tick probe:** initiative walked through round wrap (`__initiative__.lastAppliedTurnStartCreature` reached `2:Bandit 1` — victim turn-start fired twice post-hit); zero new hp_change/condition/burn entries. Bandit's only HP deltas are the two attack hits.
- lastAttack machine truth post-hit: `saveDc/saveType/saveResult/dcSuccess` ABSENT/null (§117 decoy-proof), `damageFormula:"2d4 + 2"`, `actualDamage:5`.
- Console: 0 errors (2 pre-existing cosmetic warnings).

## Notes / design caveats
- **Recurring burn tick (§87):** no consumer app-wide — grep `"burning"` non-test hits only targetEffectDefinitions.js (registry :156), MonsterCardHelpers.js (:161 exhaustion-clause guard, :2325 MA-0673 advisory), materialComponents.js + MagicInitiateModal test-utils (Burning Hands PC lore, irrelevant). `applyTurnStartEffects` has no burn phase; MA-0367 infernalWound precedent shows recurring ticks need an explicit new service — out of scope for this one-field fix. Grant-only model = accepted §415-style honest precedent (MA-0995: grant lands = live transport; tick = residual).
- **Flammable-object half (§70):** "a flammable object that isn't being worn or carried" has zero object-state model/consumer in the engine — advisory, not fixable in this ticket.
- **RAW duration caveat:** the passthrough clock is `until_start_of_next_turn` (attacker-anchored); magmin RAW burning persists until extinguished/damaged. The MA-0673 registry note + grant-log boilerplate already declare the GM-enforced anchor; badge is removable (MA-0995 residual family). If longer persistence is wanted, a `rounds:` clock or dedicated te would be a separate design call.
- **MA-0673 picker twin lane:** Clinging Flames rides the rays[] picker and today's disk bytes make burning a pure *advisory* there (`te_grants` absent; honest advisory text "add the Burning badge manually") — i.e. even the picker lane does not auto-grant burning today. The attack-row `hit_target_effect` passthrough is the only live automated lane → strengthens FAIL(a), not FAIL(b): the transport CAN deliver `burning`; the row simply doesn't author it.
