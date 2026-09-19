# bug-mon-MA-0548 — Cyclops Sentry "Limited Foresight" reaction inert

- **Row:** MA-0548 | monster `cyclops-sentry` | category reactions | actionIndex 0 | actionType "attack" (misleading label) | recharge "6"
- **Verdict:** FAIL(b) — inert prose reaction, zero producer/affordance (MA-0516/0544 twin)

## Disk (public/data/monsters.json, cyclops-sentry reactions[0], own curl/python dump 2026-09-19)
```json
{"name":"Limited Foresight","trigger":"A creature the cyclops can see makes an attack roll against it.","description":"The cyclops imposes Disadvantage on the roll, and the cyclops gains Advantage on attack rolls against the target until the end of the cyclops's next turn.","recharge":"6"}
```
No `automation` field, no `attack_bonus`, no `save_dc`, no dice. Manifest `actionType:"attack"` is label-only — the renderer keys off disk fields, all absent.

## Code layer (grep + read)
- `getGatedMonsterReaction` (src/components/encounter/MonsterCardHelpers.js:1063-1066) reads ONLY `action?.automation?.effect`; absent → null → `GatedReactionSlot` returns null (MonsterAction.jsx:134-138). No chip renders.
- Attack chip gate `actionHasAttack = action.attack_bonus != null` (MonsterAction.jsx:190) → false; `ActionSaveRoll` needs `save_dc != null` → false; `ActionDamageLinks` (:41) — no dice in prose, `attackRowMissingToHit` word-pattern absent → null. Recharge renders cosmetic `<em> (6)</em>` via `RechargeNote` (:28-32) only.
- Trigger grep-zero: no consumer dispatches monster "attack roll against it" reactions. `GATED_MONSTER_REACTIONS` (:694) holds only automation-effect entries (feather_fall/counterspell/hellish_rebuke/parry family). te `foresight` (targetEffectDefinitions.js:669, conditionEffects.js:445) is the PC Foresight SPELL consumer (foresightHandler) — no producer keys it from a monster reaction row. Defensive-reaction consumers are PC structured-automation paths only.
- Recharge dead metadata: `rollMonsterRecharges` re-rolls only entries already spent at a chip/picker click (monsterRecharge.js) — no chip ever stamps spent, so the recharge "6" never engages (§60/MA-0544 precedent).

## Live proof (test-campaign, :5173, 2026-09-19, header verified test-campaign)
- EB exact-filter "Cyclops Sentry" single-row join → cs idx 0 "Cyclops Sentry 1" HP 138, round 1 (own fetch /combatSummary).
- Card Reactions section innerText: `Limited Foresight. The cyclops imposes Disadvantage ... (6)` — row audit: `chips: []` (zero `.mc-dice-link*`/[role=button]/a/button in row).
- Click probes: `<strong>` name click → log 2→2, zero popups; `(6)` `<em>` click → log 2→2, zero popups. Baseline = join-time `encounter`+`roll` entries only. Inert confirmed.

## Fix direction (DATA, MA-0516/0544 family policy)
Requires `automation:{type,trigger,effect}` + registered gated effect + new "impose disadvantage on incoming attack / grant self next-attack-advantage" trigger consumer keyed to monster reaction rows (no such seam app-wide; attack-against-me event does not dispatch to monster rows). Alternatively downgrade to advisory/GM-enforced and drop misleading recharge "6". §70 family — needs ticket.

## Cleanup
admin/clear-change-data 200 + admin/clear-log 200; own curl :80 log 0, cs null post-clear. Registry merged into `Cyclops Sentry.config.verifiedRowMA0548` (disk JSON.parse-checked). No manifest/git writes.
