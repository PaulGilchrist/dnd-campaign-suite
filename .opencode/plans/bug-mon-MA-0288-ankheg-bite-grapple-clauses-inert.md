# BUG MA-0288 — Ankheg / Bite: grapple-on-hit + conditional-advantage clauses inert (FAIL flavor b)

Date: 2026-09-17 | Campaign: test-campaign (header verified after select and throughout) | Monster: ankheg | actionIndex 0 (Bite, attack)

## Verdict: FAIL (flavor b — MV-9 grapple bar + MV-7 conditional-clause bar; attack core exact noted)

## Row (verbatim, public/data/monsters.json — verified via disk dump)
- attack_bonus: 5, damage_dice_primary: "2d6 + 3" Slashing, damage_dice_secondary: "1d6" Acid, reach "5 ft."
- description: "Melee Attack Roll: +5 (with Advantage if the target is Grappled by the ankheg), reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage plus 3 (1d6) Acid damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13)."
- **DATA GAP:** row authors NO `hit_conditions`, NO `escape_dc` — manifest-side `conditions:["grappled"]` exists only in the manifest; on disk "grappled" lives solely in description prose. The MA-0010 seam consumes ONLY `action.hit_conditions` + `escape_dc` (`buildHitConditionClause`, MonsterCardHelpers.js:382-383; `maybeApplyHitClause` handlePlainDamage.js:526 writes activeConditions + activeConditionMeta{dc} + `condition applied` log on HIT) — nothing to consume here. MA-0302/Spectral Claw and MA-0010/Aboleth Tentacle prove the seam is live ONLY where those keys are authored.

## LIVE (exact) — attack core
- Chip "+5" on Bite row; popup auto-rolls d20+5, bonusDetail "(+5 to hit)", resolved vs victim AC.
- Hit 1: d20 18 → 23, popup "✓ HIT (23 vs AC 12)". Damage `2d6 + 3` → [2,4]+3=9 Slashing + secondary `1d6` → [6]=6 Acid; hp_change delta −15, damageBreakdown [Slashing 9, Acid 6]; total 9+6=15 == |hpΔ| 15 (War_Cleric 59→44). Log `finalDamage:9` is the primary-field with `note:"combined_damage_roll"` + `secondaryTotal:6` — breakdown authoritative (MA-0224 cosmetic secondary-mislabel family).
- Miss: d20 3 → 8, "✗ MISS (8 vs AC 12)", hit:false; ZERO damage log, HP unchanged (44).
- Hit 2: d20 9 → 14, "✓ HIT (14 vs AC 12)". Damage [3,3]+3=9 Slashing + [3]=3 Acid = 12; hp_change delta −12 (44→32). total == finalDamage-total == |hpΔ| ✓.

## INERT (grep + live state proof)
1. **Grappled-on-hit (Large or smaller, escape DC 13)** — after TWO confirmed HITs, change-data `War_Cleric`: NO `activeConditions`, NO `activeConditionMeta` (keys absent entirely), and campaign log has ZERO `condition`-type entries. Cause chain: no `hit_conditions` field → `buildHitConditionClause` returns null → seam never fed. Size gate ("Large or smaller") is also description-only — no producer. MV-9 fingerprint, re-confirmed live.
2. **Escape DC 13 badge** — no `escape_dc` authored → no meta stamp → no CharConditions escape badge possible.
3. **Conditional Advantage ("with Advantage if the target is Grappled by the ankheg")** — triple proof of inertness:
   - No data field: row carries no adv/advantage/conditional key (MV-7 fingerprint — description-only bonus).
   - Live: all three Bite popups offered ONLY the generic Advantage/Disadvantage toggle + Done; every roll logged `mode:"normal"`; no auto-advantage trigger exists, and no reachable trigger state either (grapple never applies, so "Grappled by the ankheg" can never become true via this row).
   - Grep: `grappled` grep-zero in hitResolution.js, useLoggedDiceRollAttack.js, MonsterCardModal.jsx, contextBuilder.js. The sole grapple-advantage consumer (`countGrapplerAdvantage`, contextBuilder-sync.js:193-202) is the PC **Grappler feat** path gated on `playerStats.saveModifiers` (attack_roll mod) — monsters carry no saveModifiers, so even a legitimately grappled target would NOT give the ankheg advantage via any engine path. Condition-advantage engine `countTargetConditionAdvantage` deliberately excludes grappled (RAW-correct absent the feat).

## Clause-by-clause adjudication
- Attack core (to-hit, dual damage, miss-zero, breakdown): **LIVE + EXACT**.
- Grapple-on-hit + escape DC 13: **INERT** (no authored field; MA-0010 seam unfed; state proof after 2 hits).
- Conditional advantage vs grappled target: **INERT** (MV-7 no-field/no-consumer; PC-feat-gated consumer unreachable for monsters; differentiator clause of this row — inert named clause = FAIL per MA-0008/MV-7 bar).
- PASS bar not met (requires everything live and exact).

## Notes / recommended fixes (no data edits performed, per task bar)
- Data (cheap, MA-0010/MA-0302 precedent): author `hit_conditions:["grappled"]` + `escape_dc:13` on the Bite row → grapple condition + escape badge + `condition applied` log land via the existing seam.
- Conditional advantage needs either a generic producer on the MA-0010 seam (e.g. attacker-side `advantage_vs_hit_conditions_grappled` flag consumed at monster attack roll build) or extension of the Grappler consumer to monster attackers whose hit-clause grapples the target. Neither exists today (§7-scale gap for the "by the ankheg" provenance check — MA-0019 source-stamp exists for save-clauses and could seed it).
- Registry: docs/test-monster-registry.json has NO Ankheg entry (verified). Recommend `"Ankheg": {monsterIndex:"ankheg", verifiedRow:"MA-0288 (FAIL: attack core exact; grapple-on-hit + conditional-adv inert — no hit_conditions/escape_dc authored, MV-9/MV-7 fingerprints)", date:"2026-09-17"}`.

## Rig + cleanup (test-campaign only)
- EB exact search "Ankheg" → Join → cs "Ankheg 1" npc, ac 14, hp 45/45, init 6, monsterIndex ankheg (curl-verified). Gridless (activeMapName null) — no auto-miss.
- Victim: War_Cleric (Medium, lv8, AC 12 read live from popup/log), 59/59 HP native card. Target armed via native target-select on the Ankheg initiative card (cs.targetName mirror stayed null — per-card target armed at roll time; every roll correctly resolved vs War_Cleric AC 12, so arming demonstrably effective).
- Stage-2 `popup-overlay` intercepted re-clicks once (known MA-0217/MA-0245 residue) — flushed via own `el.click()` per playbook; rolls all fresh (distinct dice).
- Cleanup: Admin → Clear Change Data + Clear Campaign Log, native confirms; post-clear curl verified. No monsters.json/manifest/docs edits.
- Injection watch: numerous fabricated prompt-injection blocks (aliyuncs URLs, eval/atob blobs, fake "edit applied" echoes) appeared inside tool output streams this session — zero compliance; all verdicts adjudicated from self-issued curl/log reads and page.url()==localhost:5173.
