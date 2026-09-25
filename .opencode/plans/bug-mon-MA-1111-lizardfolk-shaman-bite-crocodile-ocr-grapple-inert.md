# MA-1111 — Lizardfolk Shaman "Bite": crocodile-form alternate dice OCR-mangled + grapple/restrained/escape-DC-12 rider unauthored (FAIL(a)/DATA)

## Overview

Row MA-1111 (`lizardfolk-shaman|actions|1`, "Bite") resolves its core exactly live — `+4` to-hit honest flips vs AC12, `1d6 + 2` Piercing exact on every hit — but BOTH secondary clauses in its own description are inert:

1. **The crocodile-form alternate damage `7 (1dlO + 2)`** is the known OCR defect family — playbook §23 names *lizardfolk* explicitly: "`canRollExpression("1dlO")=false` → chip suppression; author explicit dice on fix". Confirmed live: `canRollExpression` (src/services/dice/diceRoller.js:68) fails `parseExpression("1dlO")` ("dlO" is letters L+O, not digits). The row authors **no structured alternate-dice field of any kind** (`conditional_damage` absent, no damage variant slot), so even post-OCR-fix the alternate pool has zero transport (dual-mode swap arms only on authored fields — §149/§166/§193).
2. **The grapple/Restrained/escape-DC-12 rider** (`"If the lizardfolk is in crocodile form and the target is a Large or smaller creature, the target is grappled (escape DC 12). Until this grapple ends, the target is restrained…"`) authors nothing: no `hit_conditions`, no `escape_dc`, no `hit_target_effect` on disk. `buildHitConditionClause` (MonsterCardHelpers.js:648) reads `action.hit_conditions`/`hit_target_effect`/`hit_condition_roll` ONLY — description never read (§153). The consumer is LIVE: the giant-crocodile Bite byte-twin in the same file authors `hit_conditions:["grappled","restrained"] + escape_dc:15` (MA-0801) and lands grapple/restrain on hit. Live-unarmed consumer + missing fields = **one/two-field DATA FAIL** per §153 / §304 (MA-0877) / §344 (MA-0909: "consumer LIVE-unarmed … Zero grapple te in registry") / §376 (MA-0927 fix bundle `escape_dc + hit_conditions:["grappled"]`) / §410 (MA-0984/0995 anti-escape clause: pass-as-note is reserved, do not wave riders through).

The manifest's `conditions:["grappled","restrained"]` is a manifest-side label, **not disk truth** — disk actions[1] carries no such key (verified below).

## Expected Behavior

Row description (disk `public/data/monsters.json`, lizardfolk-shaman actions[1], quoted verbatim incl. the "Ifthe" run-on):

> Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage, or 7 (1dlO + 2) piercing damage in crocodile form. Ifthe lizardfolk is in crocodile form and the target is a Large or smaller creature, the target is grappled (escape DC 12). Until this grapple ends, the target is restrained, and the lizardfolk can't bite another target. If the lizardfolk reverts to its true form, the grapple ends.

monsters.json numbers on disk: `attack_bonus: 4`, `reach: "5 ft."`, `damage_dice_primary: "1d6 + 2"`, `damage_type_primary: "Piercing"` — core fields byte-match the manifest. STR 15 (+2) + CR2 PB (+2) = +4 ✓. crocodile-form alternate ("7 (1dlO + 2)" → canonical **1d10 + 2**, avg 7) and grapple (`hit_conditions:["grappled","restrained"]` + `escape_dc:12`) have **no authored structured fields** (§59: "attack-HIT grapple prose only lands via authored `hit_conditions:[...]`+`escape_dc`"; §153: missing = DATA FAIL MA-0291/0361 family).

## Actual Behavior

Core is honest and exact (22 presses, one `type:"roll" rollType:"attack"` + one `rollType:"damage"` entry per press, `name:"Bite"` — §390/§147):

- To-hit `d20+4` honest flips at AC12: hits nat 17,9,15,17,12,12,19,18,18,16,12,10 (totals ≥13 ✓) / honest misses nat 6,4,6,3,4,7,5 (totals ≤11 ✗). AC-rig flip (§316): same `+4`, victim ac:19 → nat7→11 MISS stamped `effectiveAc:19`, nat16→20 HIT; restored AC12 → nat16→20 HIT re-confirmed — resolver re-reads AC per press. Boundary exact-miss **nat7→11 vs AC12** observed honestly; nat8→12 tie unobserved in 22 rolls (tie-goes-to-attacker codified §206/§399). No nat20 → crit seam unobserved (§32).
- Damage: every hit formula `"1d6 + 2"` Piercing, `finalDamage==total==|hpΔ|`, `resisted:false`, `secondaryFormula` absent on all 14 hits; unclamped chain 999→917 (Σfd 82 == Σ|Δ|).
- Zero crocodile-dice surface: whole-overlay audit — `1dlO` appears exactly ONCE as inert description prose; ZERO `.mc-dice-link` referencing `1d10`/OCR/`7`; Bite row chips = `["+4"]` only (§116 single-chip correct); `[role=switch]/[role=radiogroup]/[role=tablist]/select` in overlay = **0** (§123/§150 toggle audit); no DC0 chip rendered (§411/§416/§417 avoided — attack chip only pressed).
- Rider zero-delta after 14 hits: victim change-data has **no `Bandit 1` key at all** (no `activeConditions`/`activeConditionMeta`), campaign top-level `targetEffects: null`, `lastAttack.hitClause:null`, `saveDc:null`; whole-log grep `grapple|restrain` = **0 entries**; no "can't bite another target" latch (second+ bites fired freely).

## Steps to Reproduce

1. `test-campaign` → EB Join "Lizardfolk Shaman" (exact td) + "Bandit" (exact td); full-store cs POST maxHp/currentHp/maxHitPoints/currentHitPoints = 999 (both NPCs) + reload + re-select (§296/§298).
2. Arm Bandit 1 on Shaman own-card `[data-testid="target-select"]` (`selectOption`) (§4/§152).
3. Open Shaman card (`img.avatar-image[alt="Lizardfolk Shaman 1"]`), press the Bite row's single `+4` chip; Done via real pointer click on `button.dice-roll-reroll-btn` (§286); flush stage-2 `.popup-overlay` via `el.click()` after log confirms damage (§294).
4. Observe: damage formula is always `1d6 + 2` (never 1d10 offer), victim acquires no Grappled/Restrained, log has no grapple entries.

## Likely Location

**Layer: `monsters.json` DATA drift vs its own description** (actions[1] of `lizardfolk-shaman`). The consumer chain is live and proven on authored twins — `buildHitConditionClause` (MonsterCardHelpers.js:648) → `hitClause` (MonsterCardModal.jsx:873) → `maybeApplyHitClause`/`applyHitClauseConditions` + `isLargeOrSmallerTarget` gate (handlePlainDamage.js:518/543/614) — giant-crocodile Bite (MA-0801, same file) is the byte-shape fix template with `hit_conditions:["grappled","restrained"]` + `escape_dc`. NOT a `hitResolution.js` / `applyDamage.js` / `handlePlainDamage.js` code defect (their behavior is exact). OCR fix axis is the description string itself ("1dlO"→"1d10", §23) plus, if the crocodile alternate is to roll at all, a structured alternate-dice decision (conditional_damage MA-0007-style offer is the nearest live seam; crocodile form itself is §70 zero-consumer — MA-1110 registry note "zero ATTACK gating consumers", so the form-conditional gate is a design question, but the grapple/escape fields are canonical-fixable).

## Notes

- Sustained-state legs ("until this grapple ends", "restrained", "can't bite another target", "reverts → grapple ends") = §59/§70 zero-producer advisory family (MA-0287/0288/0354/0909/0930 precedents); the *initial* on-hit grapple/restrained grant is the §153/§344 FAIL axis — do not adjudicate the whole clause as advisory (§410: inert-rider-note escape is narrow).
- Description OCR carries an additional run-on typo "Ifthe" (§23 family cosmetic; quote verbatim, adjudicate affordance only — §759).
- Fix suggestion (orchestrator/GM data decision, not applied here): `"1dlO + 2"`→`"1d10 + 2"` in description + `"hit_conditions":["grappled","restrained"]` + `"escape_dc":12` (giant-crocodile MA-0801 placement) — noting naive authoring would over-grapple true-form bites absent a shapeShiftForm gate (MA-1020 seam exists on cs; zero attack-gating consumer today — fix design should gate the grant or accept GM-adjudicated form state).
- Registry: prior MA-1110 Multiattack PASS-subset intact; this row is its own FAIL(a)/DATA ticket.
- 2026-09-24 session ledger: attacks nat [17,9,15,17,12,12,6✗,4✗,19,6✗,3✗,4✗,18,18 | AC19-rig 16✓,16✓,7✗ | AC12-restored 16✓,7✗,12✓,5✗,10✓]; damage fd [6,3,3,8,7,7,4,7,7,7,6,8,6,3]; 0 console errors; console/session: 22 attack entries == 22 presses, 14 damage == 14 hits (misses zero, Done-less §94).
