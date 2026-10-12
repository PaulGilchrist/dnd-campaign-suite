# MA-1924 — Jormungandr "Venomous Surge (Recharge 5-6)" — FAIL(b)/DATA

**Row:** MA-1924 · stableKey `jormungandr|actions|3` · save, DC 27 Constitution, 26d6 Poison, Recharge 5-6
**Verdict:** FAIL(b)/DATA — recharge gate NEVER engages (one-field fix).

## Crown-axis failure: recharge NOT authored → ungated multi-fire

**Disk (public/data/monsters.json, jormungandr actions[3]):**
```
save_dc: 27 · save_type: "Constitution" · damage_dice_primary: "26d6" · damage_type_primary: "Poison"
recharge: ABSENT · usage: ABSENT
name: "Venomous Surge (Recharge 5-6)"   ← recharge lives ONLY in name-text
range: ABSENT (description "within 90 ft." bare token → shapeless)
dc_success: ABSENT → half-default ✓
```
**Code:** `rechargeUsageOf` (src/services/encounters/monsterRecharge.js:35) reads ONLY flat `action.recharge` or `usage.type:"recharge on roll"`. Both absent → returns null → `monsterRechargeGate` returns null → NO spend, NO refusal, NO recovery key ever stamped. Name-text "(Recharge 5-6)" is parsed by NO recharge parser. **MA-1916 / MA-0663 / §563 fingerprint, exact twin.**

**Live proof (test-campaign, same fight, no initiative walk between):**
- Press 1 (fail, wb −30 inline-fold): full `26d6`=**73** Poison, Bandit 999→926 (|hpΔ|=73=full ✓)
- Press 2 **immediate re-press before any recovery**: fires AGAIN, full `26d6`=**85** Poison, 926→841
- refusalChip (`.mc-recharge-refusal`/`mc-dice-link-spell-spent`): **false** both presses
- log grep refus|recharge across whole session: **ZERO** refusal/recovery entries (only the row-name echo)
- GET change-data `<Jormungandr 1>`.monsterRecharge: **ABSENT** (economy machine never stamped)
- Two consecutive full-face fires = RAW impossible on a Recharge 5-6 ability → **ungated**

## Passing axes (recorded; do NOT rescue the verdict)
- DC 27 enforced ✓ (lastAttack.saveDc 27, popup "vs DC 27")
- CON axis ✓ (saveType Constitution)
- FAIL face full ✓ (73=73, 85=85)
- SUCCESS face exact floor-half ✓ (wb +30 flip: raw `26d6`=100 → finalDamage **50**=floor(100/2), 841→791)
- Poison type clean ✓ (Bandit disk damage_resistances null; damageType Poison, no resist reduction)
- Shapeless "90 ft." inline degradation = ACCEPTED advisory family (§211/§162/MA-1920): picker never opens, inline auto-resolve — noted, not FAIL.

## Fix (DATA, one field)
Add `recharge: "5-6"` to jormungandr actions[3] (byte-twin MA-1916/MA-0031/MA-0618/MA-0663). Consumer `monsterRechargeGate` is pure/live; once authored it spends at fire, refuses re-press before recovery with `<slug>_refused (not recharged)` + `mc-dice-link-spell-spent`/`.mc-recharge-refusal`, and rolls turn-start recovery d6 vs threshold 5 at owner turn-start. No code change required.

## Cleanup
Admin clear change-data + log (curl, no dialog) → verified {} / [] after quiet 15s. No manifest/registry writes.
