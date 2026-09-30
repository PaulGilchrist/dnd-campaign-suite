# BUG MA-1690 — Water Weird Surge: on-hit Grappled+Restrained rider never applied (FAIL(a)/DATA)

- **Date:** 2026-09-30 | **Campaign:** test-campaign only | **Verdict:** FAIL(a)/DATA
- **Row:** MA-1690 `water-weird|actions|0` Surge — Melee +5, reach 10 ft., 3d6 + 3 Cold, RAW hit rider: Medium-or-smaller target Grappled (escape DC 13) + Restrained until grapple ends.

## Defect
Disk `public/data/monsters.json` water-weird actions[0] authors NO condition rider:
`keys: ['attack_bonus', 'damage_dice_primary', 'damage_type_primary', 'description', 'name', 'reach']` — **hit_conditions ABSENT, escape_dc ABSENT**. Manifest `conditions:["grappled","restrained"]` is prose-extracted, not disk-true (§153).

Consumer is LIVE and unarmed (not a code gap): `buildHitConditionClause` MonsterCardHelpers.js:850 reads `action.hit_conditions` ONLY (:827-828, escapeDc :856) → `applyHitClauseConditions` handlePlainDamage.js:553 armed at :841. Prose-only rider + zero structured fields → grant never fires.

## Live proof (8 real-pointer §442 presses, one MCP tab, board cleared after)
- Rig: Water Weird 1 (EB join, cs idx0 this session) vs Bandit 1 Medium AC12 HP999 resistances[] (§491 full-store /combatSummary POST, readback exact); own-card selectOption armed, cs targetName 'Bandit 1' confirmed (§699, card closed).
- Core axis PASS: 8/8 presses → 8 attack + 8 damage + 8 hp_change 1:1; nat 17/10/8/12/11/19/13/14, hit-flag==(nat+5>=12) 8/8, ac:12, mode normal. Formula "3d6 + 3" byte-exact 8/8, damageType Cold, mod 3, fd==Σdice+3==|hpΔ| (6/14/12/14/12/10/19/9), chain 999→903 Σ96 UNCLAMPED, resistanceReduction:0 (resisted false). Crit straddled 0/8 honest (§MA-1632; miss face nat≤6 starved, honest). Console 0 errors.
- Rider axis FAIL: **zero grapple/restrained grants 8/8 hits** — 'Bandit 1' change-data STORE KEY ABSENT whole session (§1116), whole-log "grapple|restrain" tokens 0, condition-applied entries 0, lastAttack saveDc/saveType/dcSuccess null, ability_use 0 (no spend, correct).

## Fix (DATA, two-field, in-file byte-twins exist)
Add to water-weird Surge row:
`"hit_conditions": ["grappled", "restrained"], "escape_dc": 13`
Exact numeric twin: giant-octopus Tentacles (hc grappled+restrained, escape_dc:13, attack_bonus 5); precedents MA-0775/MA-1274 byte-shape, MA-1111 template census.

## Advisories (record, do not build)
- Consumer size gate is Large-or-smaller vs RAW "Medium or smaller" (§1116/§1141) — Bandit Medium clean this probe.
- "Restrained until the grapple ends" retain-clause = §70 advisory-in-file (grapple state-machine zero consumers); grant lands as fixed-duration meta like all twins.
