# Bug MA-0354 — Barbed Devil Claws: Grappled clause (escape DC 13) advertised, never lands

**Verdict: FAIL (expected class)** — grapple clause is prose-only; damage core exact.

## Row
- MA-0354 | Barbed Devil (monsterIndex barbed-devil) | actions[1] Claws | attack
- attackBonus +6 | "2d6 + 3" Piercing | reach 5 ft | clause: "If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from both claws."

## Root cause — disk key dump (monsters.json, disk-verified)
`actions[1]` keys: `name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary`.
- **NO `conditions`**, **NO `hit_conditions`**, **NO `escape_dc`** keys. The escape DC 13 grapple clause exists only inside the HTML prose `description`.

## Seam cite (known bar, not re-derived)
- `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:382-388) consumes ONLY `action.hit_conditions` + `action.escape_dc` (`escapeDc: action.escape_dc != null ? Number(action.escape_dc) : null`). Plain `conditions:[...]` not consumed — MA-0320 / MA-0334 / MA-0288 bar precedent.
- `escape_dc` grep (non-test): only two consumers — MonsterCardHelpers.js:388 (gate) and handlePlainDamage.js:483-518 (tentacle flavor text, itself gated on `hitClause.escapeDc`). Neither fires for barbed-devil (no keys).
- Grapple state-machine fully inert per MA-0287.

## E2E evidence (test-campaign only; header verified; page.url() localhost)
Setup: EB exact "Barbed Devil" → Join → cs curl Barbed Devil 1 (AC 15, 110/110) → initiative target-select armed **ElderPaladin** (Medium → clause applies; top HP 224/224); cs curl targetName=ElderPaladin ✓.

Claws "+6" chip ×4 (full popup cycles, §290-292):
1. nat 14 +6 = 20 vs AC 19 → HIT; Done → 2d6+3 [6,1]+3 = **10 Piercing**; EP 224→214 ✓
2. nat 8 +6 = 14 vs AC 19 → MISS; click-dismiss; zero damage ✓
3. nat 3 +6 = 9 vs AC 19 → MISS; zero damage ✓
4. nat 17 +6 = 23 vs AC 19 → HIT; Done → 2d6+3 [1,5]+3 = **9 Piercing**; EP 214→205 ✓

Post-hit probe (curl cs, after 2 hits on Medium target):
- ElderPaladin: no `grappled` condition anywhere (`/grappl/i` false on EP object); no escape/DC meta; no top-level grapple keys; no targetEffects.
- Whole-cs grep: only 3 hits, all cached prose (`combat-ui-viewingMonster.traits[0]` Barbed Hide text + `actions[1].description`) — zero applied state.
- EP currentHitPoints 205 == 224−10−9 ✓ (damage tracked, condition not).

## Log audit (curl /log)
- encounter joined "1x Barbed Devil"; initiative roll 7.
- 4 Claws attack entries: bonus 6, targetAc/effectiveAc 19 all four; hit true/false = nat14 T, nat8 F, nat3 F, nat17 T.
- 2 damage entries: formula "2d6 + 3" Piercing, total==finalDamage (10, 9), resisted false.
- 2 hp_change entries: −10→214, −9→205, breakdown Piercing exact; cumulative == runtime.
- **0 condition entries** despite two hits — clause silently dropped.

## Cleanup
- Admin → Clear Change Data + Clear Campaign Log, native confirms both naming "test-campaign"; curl verified `{}` / `[]` ✓.

## Notes
- Damage core exact (MA-0353 cite reconfirmed: 2d6+3 Piercing exact, boundary misses nat8/nat3 vs ≥13 hit line). Cached dice MA-0273 pattern seen in attack logs (rolls pool pair, total=nat).
- Fix shape: author `hit_conditions:["grappled"]` + `escape_dc:13` on actions[1] (and prose size-gate Large-or-smaller remains prose; state-machine itself still inert per MA-0287, so full grapple enforcement needs the subsystem too).

## VERDICT: FAIL
Grappled (escape DC 13) clause is advertised in prose on every hit, but disk actions[1] carries no `conditions`/`hit_conditions`/`escape_dc` keys; buildHitConditionClause (MonsterCardHelpers.js:382-388) never fires; post-hit null-proof shows zero condition/meta/state landed on ElderPaladin after 2 confirmed hits; log has 0 condition entries. Damage 2d6+3 Piercing exact.
