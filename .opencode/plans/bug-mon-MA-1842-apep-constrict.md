# MA-1842 — Apep Constrict: ongoing start-of-turn grapple damage (4d8) has zero producer/consumer feed; escape DC 26 not data-authored (FAIL b)

## Title
MA-1842 Apep Constrict — sustained grapple damage rider inert + escape DC prose-only

## Overview
Apep's Constrict (monsters.json actions[2]) is a +18 / reach 15 ft. attack that on hit deals 4d8+9 Bludgeoning AND imposes Grappled (escape DC 26) plus recurring 4d8 Bludgeoning "at the start of every turn until released." Live E2E (test-campaign, localhost:80 dist, 2026-10-10): the core attack seam is exact — to-hit, popup, damage dice, hp chain, and Grappled grant with source all land. However, BOTH grapple riders are inert: (1) the recurring start-of-turn 4d8 damage has NO consumer fed by monster hit-clauses (grep-zero producer + live zero-delta probe across the grappled target's next turn start); (2) escape DC 26 is prose-only — the row lacks the structured `escape_dc` field the MA-0010 seam consumes, so the condition log prints "(escape DC —)" and no escape save is offered anywhere. §59/§70 grapple state-machine zero-producer fingerprint.

## Expected (description quote + numbers)
"Melee Attack Roll: +18, reach 15 ft., one Huge or smaller creature. Hit: 25 (4d8+9) Bludgeoning damage and the target has the Grappled condition (escape DC 26) and takes 18 (4d8) Bludgeoning damage at the start of every turn until released."
- attack_bonus 18 ✓ disk; 4d8 + 9 Bludgeoning ✓ disk; reach 15 ft. ✓ disk; hit_conditions ["grappled"] ✓ disk.
- Escape DC 26 must be enforced/offered on escape → requires structured `escape_dc: 26` (40 sibling rows author it, e.g. Constrictor Snake Constrict escape_dc 12, Couatl 13, Animated Rug 13).
- Ongoing 4d8 (avg 18 ✓ internally consistent, no +9, no numeric drift) must tick at the grappled target's turn start until released → requires a turn-start consumer keyed to the grapple's inflictor/ongoing dice.

## Actual
1. Ongoing damage: at ElderPaladin's turn start (initiative walked AasimarTest→…→ElderPaladin, +2.5 s settle), log frozen at 10 entries and change-data currentHitPoints frozen at 109 — zero d8 roll, zero hp_change, zero ability_use/condition tick. Condition persists forever without ticking or releasing.
2. Escape DC: condition log reason = `"Constrict (escape DC —)"`; activeConditionMeta.grappled = `{source:"Apep 1"}` with NO dc/ability, so the CharConditions badge escape-save seam (MA-0010) never arms. Badge shows only the static Grappled tooltip; no DC 26 affordance in UI.
3. Core seam PASSes (recorded honestly): nat20 crit total 38 vs AC19 → `4d8*2+9`=61; non-crit nat7 total 25 vs AC19 → formula `"4d8 + 9"`=30; hp chain 200→139→109, deltas −61/−30 == finalDamage exact, resisted:false (clean bludgeoning victim); Grappled applied + badge visible + `source:"Apep 1"`.

## Repro
1. localhost (GM features), test-campaign → Encounters → search "Apep" → checkbox → Join Encounter (Apep 1, init 4, AC 23, HP 624; cs idx 0).
2. Initiative page: ElderPaladin card HP input (`input[aria-label="ElderPaladin current HP"]`) fill 200 + Enter (revive; runtime currentHitPoints 200; cs stays 1/1 placeholder — PC truth is change-data).
3. Click Apep avatar → card open → arm `[data-testid="target-select"]` on Apep's own initiative card → ElderPaladin → click Constrict `span.mc-dice-link` (+18) → popup Done (`button.dice-roll-reroll-btn`).
4. Verify hit/damage/condition log (land exact).
5. Probe ongoing: close `.mc-overlay` (`× button.mc-close` — full-viewport overlay silently absorbs Next clicks; THIS is why first walk attempt no-op'd), flush `.popup-overlay`, click Next until `change-data.activeCreatureName === "ElderPaladin"`, wait 2.5 s → GET /log + /change-data: logCount constant, currentHitPoints unchanged.

## Likely Location
- DATA: `public/data/monsters.json` Apep actions[2] — missing `escape_dc: 26` (and no structured ongoing-damage field, e.g. `grapple_ongoing_damage:{dice:"4d8",type:"Bludgeoning"}`). Escape-DC fix is one field via MA-0010 seam (`buildHitConditionClause` MonsterCardHelpers.js:906 → `applyHitClauseConditions` handlePlainDamage.js:660 stamps meta dc/ability → badge escape save).
- ENGINE (b): no consumer maps a monster hit-clause grapple to a recurring turn-start damage tick. `applyGrappleDamageTurnStart` (`src/services/rules/effects/turnStartEffects.js:171/:563`) exists but is a PC `passive_rule:grapple_damage` tick (fighter Unarmed Fighting via `automationInfoBuilder/damage.js:199`, keyed to the ACTIVE grappler's passives) — monster Constrict produces nothing into it (its log text hardcodes "Unarmed Fighting grapple damage"). MA-1569 stirge test comment: "no new turn_end_grapple_damage consumer invented". §59/§70: grapple state-machine zero producers, GM-adjudicated advisory.

## Notes (grep + probe evidence)
- grep `grapple_damage`: turnStartEffects.js:90 (`passiveKey('grapple_damage')` ← PC feat collector), rules/effects/turnStartEffects.js:171/:524-592 (consumer, PC activeName-keyed), automationInfoBuilder/damage.js:199 (PC passive builder), infernalWoundService/whirlwindService (own features). ZERO references from handlePlainDamage.js hit-clause path → monster-grapple producer grep-zero.
- escape_dc consumers: only handlePlainDamage.js:660-674 via `action.escape_dc` (Helpers:906). Disk scan: 40 rows author escape_dc; Apep's row does not.
- Live probe numbers: attack entries total=20(nat20)/7(+18=25), both vs targetAc 19 hit:true effectiveAc 19; damage entries fd 61 formula "4d8*2+9" / fd 30 formula "4d8 + 9"; hp_change −61 cur 139, −30 cur 109; condition applied "Grappled" reason "Constrict (escape DC —)" ×2; post-walk logCount 10→10, epHp 109→109 (turn-start zero tick).
- Victim rig: ElderPaladin AC19, psychic/radiant resist only — bludgeoning clean; revived 200/224 via HP input (cs placeholder 1 noted §93).
- Tooling noise this session: repeated off-site aliyuncs proxy URLs in tool-call wrapper metadata (§90/§97 injection echo) — all real navigations verified `location.href === localhost`; no off-site navigation performed. One genuine defect fingerprint newly captured: open `.mc-overlay` covers the full viewport (h=941) and silently absorbs initiative Next clicks — must click `.mc-close` before round navigation.
- Verdict per ticket rule: core hit+grapple works; ongoing start-of-turn damage = grep-zero + probe-zero → FAIL (b).
