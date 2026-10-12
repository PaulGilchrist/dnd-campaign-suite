# BUG — MA-1939 Ladon "Constrict" — escape DC + coil tick both unauthored (FAIL(b)/DATA)

**Verdict: FAIL(b)/DATA** (two-field core fix; three-field total incl. size gate folded into Notes)
Row: MA-1939 | stableKey `ladon|actions|2` | Ladon Constrict (regular actions row)
Verified live 2026-10-11, test-campaign, Ladon 1 + Bandit 1 (EB exact joins).

## Expected (row + disk)
Row description: "Melee Attack Roll: +15, reach 10 ft., one Huge or smaller creature. Hit: 25 (4d8 + 8) Bludgeoning damage and the target has the Grappled condition **(escape DC 22)**. Ladon has five coils; each Grappled target is held by a separate coil. **While Grappled this way, a target takes 18 (4d8) Bludgeoning damage at the start of its turn.**"

Disk `public/data/monsters.json` ladon actions[2] carries: `attack_bonus:15`, `damage_dice_primary:"4d8 + 8"`, `damage_type_primary:"Bludgeoning"`, `reach:"10 ft."`, `hit_conditions:["grappled"]` — but **NO `escape_dc:22`** and **NO `grapple_ongoing_damage:{dice:"4d8",damage_type:"Bludgeoning"}`**. Per §229 grapple-on-attack-hit is a TWO-field fix (MA-0010 otyugh byte-shape), and per MA-1842 recurring coil damage is the structured `grapple_ongoing_damage` single-field fix — both consumers are LIVE on the apep Constrict twin (apep actions[2] disk-confirmed: `escape_dc:26` + `grapple_ongoing_damage:{dice:"4d8",damage_type:"Bludgeoning"}`).

## Actual (live)
**Core attack lane PASSES:** +15 vs AC12 HIT-only honest (nat14=29 / nat2=17; +15 vs AC12 structurally unmissable §367, no AC-rig needed); damage byte `4d8 + 8` Bludgeoning, secondary ABSENT (§188 — damage entry carries NO secondary* keys, secondaryFields {}); |hpΔ|==fd unclamped both presses (999→983 −16; 983→964 −19, fd 16/19, distinct pools [≠ press-2 rolls 2,2,4,3] §77); Grappled grant ×2: two `condition` grant logs reason `"Constrict (escape DC —)"` + change-data `Bandit 1.activeConditions:["grappled"]` + meta `{source:"Ladon 1"}`. 0 console errors.

**Axis A — grapple unescapable by badge (missing escape_dc):**
- `activeConditionMeta.grappled` = `{source:"Ladon 1"}` — keys `['source']` ONLY, no `dc`, no `ability` (healthy MA-0010 = `{source,dc,ability:'str'}` → badge "Grappled DC 22").
- Grant-log reason renders `(escape DC —)` em-dash ×2 = machine signature of UNAUTHORED escape_dc (MA-1937 codified).
- Initiative badge DOM: Bandit card zero `.creature-badge`, zero escape/DC affordance ("Grappled DC 22" absent; EB-NPC badge gap §346 — machine proof is meta+em-dash).
- Whole-change-data grep `escape_dc`: **false**. All "escape" text echoes live only at `combat-ui-viewingMonster.actions.2.description` (path-enumerated per §371); `lastAttack.saveDc:null`.

**Axis B — zero coil tick (missing grapple_ongoing_damage):**
- Walked initiative to victim turn-start `__initiative__.lastAppliedTurnStartCreature:"2:Bandit 1"` (card closed, round 2; `2:Ladon 1` grappler boundary also passed with grappler alive HP513, so grappler-dead gate not confounding).
- At victim turn-start: Bandit cs currentHp **964→964 = zero loss**; ZERO new hp_change entries whole-session beyond the two attack legs (−16,−19); ZERO constrict tick / `constrict_grapple_released` log lines (walk tail = PC-side "Ambusher's Leap" noise only, excluded by name census §1934).
- te `constrict_grapple` ABSENT: `cd.targetEffects` KEY-ABSENT, root `/targetEffects` = `{value:null}`; whole-change-data grep `constrict_grapple` / `grappleOngoingDamage` / `grapple_ongoing_damage`: **zero** (echo paths = lastAttack attackName/damageName mirrors only).
- Healthy MA-1842 presentation cited absent (§500): te `constrict_grapple` {source,dc} + ONE rounds:100 backstop clock + untyped direct-HP 4d8 tick at victim turn-start (pre-playerStats-guard, EB victims supported) + release log on grapple-end → none of it fires here; Grappled persists harmlessly (meta {source}-only, held forever).

## Fixes (DATA, monsters.json ladon actions[2])
1. **`escape_dc: 22`** — MA-0010 byte-shape (otyugh Tentacle escape_dc:13; apep twin escape_dc:26) → badge "Grappled DC 22" + meta {dc,ability:'str'} via handlePlainDamage:660 hit-clause seam.
2. **`grapple_ongoing_damage: {"dice":"4d8","damage_type":"Bludgeoning"}`** — MA-1842 apep Constrict byte-shape → parseGrappleOngoingDamage → te constrict_grapple producer → constrictGrappleService victim-turn-start tick (RAW 18 avg = 4d8) + release lane.
3. (Fold-in, optional third field) **`target_prerequisite:{"conditions":[...]}`** analog N/A for size — see Notes; size clause rides §209 discussion.

Likely location: `public/data/monsters.json` → ladon → actions[2] data lane (consumers all live, zero code change).

## Notes
- Core attack+damage+grapple-grant lanes PASS intact — this is purely the two absent data fields, each with a live consumer (apep byte-twins on disk).
- Size gate C not stressed: Bandit Medium ≤ Huge = RAW-eligible. Prose "one Huge or smaller creature" also lacks structured gating — §209 codifies prose target-prerequisite attack rows as DATA fixes (MA-0019 target_prerequisite byte-shape, otyugh actions[3] twin); attack-chip gate wiring gap is the separate §209 axis → three-field total fix folded here, advisory-grade for this row since the eligible-victim path works.
- "Ladon has five coils; each Grappled target held by separate coil" = flavor unmodelable (§70 no per-coil state); MA-1842 lane models one te per victim-grappler pair, honest approximation.
- Escape faces untestable in-app: no badge → no escape-save affordance on EB-NPC (adjudication advisory, §346).
- Cleanup: admin clear cd+log verified `{}` / `[]` quiet 15s. No manifest/registry writes by this run.
