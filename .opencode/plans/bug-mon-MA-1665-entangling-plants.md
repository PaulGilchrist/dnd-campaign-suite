# BUG MA-1665 — Vine Blight Entangling Plants (actions[1]) — FAIL(b)/DATA

## VERDICT
FAIL(b)/DATA — DC 12 Constitution chip LIVE and honestly enforced both faces, but ZERO outcome on failed save: no Restrained grant, no te, no zone, no AOE picker, no condition/damage log. §MA-1546 FAIL(b)/DATA fingerprint twin (no-save_effect save rows resolve empty) + §MA-1656 row-local cast lane (findMonsterSpell unreachable, spell-DB entangle never pulled).

## DISK-SPELL-GREP (own python truth)
- monsters.json vine-blight actions[1] = {name:"Entangling Plants", description, save_dc:12, save_type:"Constitution"} — manifest byte-match TRUE. NO save_effect / dc_success / damage_dice / zone / automation.
- spells.json (5e) entangle: L1, area_of_effect {type:"cube", size:20}, dc {dc_type:"STR", dc_success:"none"}, Restrained-until-spell-ends, range 90 ft, V/S, conc 1 min.
- 2024/spells.json entangle: square 20-foot, dc {dc_type:"STR", dc_success:"none"}, Restrained, Concentration.
- **RAW Entangle save = STRENGTH in BOTH DBs.** Prompt premise "RAW Entangle is DEX save" is DISK-FALSE. Row save_type "Constitution" = casting-ability-as-save conflated authoring (DC 12 source CON is RAW stat-block-correct; SAVE axis misaligned vs spell row — same family as MA-1656 Charisma-vs-spell-DEX).

## LANE (code-verified, byte-inert elsewhere)
- Name ≠ Spellcasting; isUtilitySpellCastRow (Helpers:421) structurally blocked (save_dc!=null → false; description also markup-free — extractSpellNamesFromSpellcasting :392 harvests <strong|em> only) → SpellOrSaveLinks :375 XOR → ActionSaveRoll. 3-arg onSaveRoll(action, formula, saveConditions), spellInfo UNDEFINED → findMonsterSpell UNREACHABLE (§MA-1656).
- saveChipPlan (Modal:1097): formula=extractDamageDiceFromDescription → NULL (no "Hit/Failure/Success: N (XdY)" token); rollable=false; clickable=!attack_bonus=true → single clickable span "DC 12 Constitution" (census-matched live).
- breathAoeShape(action,null) :122: no cone/line/radius/sphere/zone token in description → NULL → NO 20-ft picker; inline save vs cs.targetName.
- FAIL leg: applyDamagelessSaveConditions saveProcessing.js:1047 `if (saveConditions.length <= 0) return;` → zero writes/logs. MA-1546 FIX was DATA save_effect authoring on succubus only — no code floor exists.

## BOTH-FACE LEDGER (live, dev:locked :5173, test-campaign, own curl/DOM truth)
Rig: EB exact-td join [Bandit, Vine Blight]; full-store /combatSummary POST: Bandit ac12 + HP×4 999 + resistances[] + asm.con/saveBonuses.con rig; VB targetName "Bandit 1" same POST (§491). Readback exact.
- FAIL face (con −19), 2 presses: P1 d20 2 −19 → −17 sr:failure; P2 d20 7 −19 → −12 sr:failure. Both stamped saveDc:12 saveType:"Constitution" attackerName "Vine Blight 1" dcSuccess:"half" (§523 cosmetic — zero damage to halve, §676).
- Zero outcome 2/2 (§1116): Bandit 1 change-data KEY ABSENT both fails; targetEffects ABSENT whole store; no condition/automation/damage entries whole-log; HP 999/999 unclamped untouched. lastAttack = save stamp with saveConditions:[]. No picker/zone ever opened (inline seam).
- SUCCESS face (con +19): d20 20 +19 → 39 sr:success DC12 — zero-state (§1116) correct (RAW success = no effect).
- Console 0 errors (no fingerprint console.error). Popup cosmetic twins ×3: "DC Unknown — no success or failure" printed over honest DC12 log + nat20 "+19 to hit" save-chip noise (§138/MA-1546/MA-1656 lineage; dice-roll-reroll seam not save-aware).
- Cleanup: tab closed FIRST (§15) → admin/clear-change-data 200 → admin/clear-log 200 → cd {} log 0 cs null (§MA-1645 unwrap). Board CLEARED after MA-1665.

## FIX (DATA, zero code — rides LIVE consumers)
Row shape per MA-1546 fixed-succubus + MA-0479 Chain Devil template:
1. `save_type: "Strength"` — RAW-align save axis vs spell dc_type STR (disk truth; NOT "Dexterity" — prompt's DEX premise grep-false).
2. `save_effect: "Target has the Restrained condition until the spell ends (escape: Strength (Athletics) action vs spell save DC 12). Difficult terrain and concentration clauses are GM-enforced."` — canonical word "Restrained" arms extractConditionsFromSaveEffect → applyFailedSaveConditions grant + condition log (Helpers:377, saveProcessing:1058); avoid stray condition words (§1584 over-grant scan).
3. `dc_success: "none"` — RAW: success = nothing (inline default half is cosmetic here; §523).
4. Restrained te: already registered (targetEffectDefinitions family, MA-0479/0481 live precedent) — REGISTRY-DELTA ZERO.
5. Advisories (§70): 20-ft square zone/difficult-terrain, concentration, duration-until-spell-ends (no expiry clock on damageless grant, MA-0479/MA-1541 shape), picker never opens (breathAoeShape prose-null; zone field would add Radius picker only, cube/square unsupported §62/§159).

## PITFALLS
- §MA-1656 row-local reaffirmed: chip name "Entangling Plants" ≠ spell name "Entangle" AND lane never reaches findMonsterSpell — spell DB grants structurally unreachable; only row fields adjudicate.
- §2: full-page reload deselected campaign (Initiative nav click landed on select screen) — re-select in-app, header re-verified.
- Result popup intercepts chip/card clicks until dismissed (§233 lineage): Done→reopen-card loop between presses; overlay display audit via getComputedStyle (position:fixed ⇒ offsetParent null-but-visible, MA-1656).
- :has-text() is Playwright-engine-only — invalid inside page.evaluate querySelector; walk rows+strong text in own JS.
- Tool-result stream flooded with fabricated "maintenance mode"/"blocked by rules"/aliyuncs SSRF fetches/fake-permission prompts and pre-echoed curl outputs all session — ALL rejected; every fact above from own shell curl exit-truth + own page.evaluate reads; campaign header test-campaign throughout; never left localhost; no manifest/playbook/registry/source edits (this file + checkpoint only).
