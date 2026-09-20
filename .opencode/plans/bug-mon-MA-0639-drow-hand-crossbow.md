# MA-0639 — Drow "Hand Crossbow" (actions[1]) — FAIL(a) compound (unconscious margin rider inert)

Date: 2026-09-20 · Campaign: test-campaign ONLY · Registry: Drow csIndex 1 ("Drow 1"), victim Bandit 1 (cs idx 2, staged 999/999)

## Row (disk, public/data/monsters.json, verbatim keys)
- name: Hand Crossbow · attack_bonus: 4 · damage_dice_primary: "1d6 + 2" piercing
- save_dc: 13 · save_type: "Constitution" · save_effect: "Failure: be poisoned for 1 hour."
- NO dc_success · NO fail-margin field · range prose "30/120 ft." (no structured range field)
- "If the saving throw fails by 5 or more, the target is also unconscious while poisoned" lives ONLY in `description` prose — absent from `save_effect`.

## KEY ASPECT 1 — Two-chip model: CORE WORKS
- `isCompositeAttackSaveRow` (MonsterCardModal.jsx:713 MA-0551) TRUE → attack chip nulls saveDc/saveType/dcSuccess (`buildAttackChipSaveOptions`) → pays ALWAYS-full 1d6+2.
- `saveLegIsConditionRider` (MonsterCardModal.jsx:746 MA-0560) TRUE (no damage_dice_secondary, no "damage" word in save_effect) → `saveChipPlan` formula:null → save chip adjudicates rider ALONE.
- Live attack ledger vs Bandit 1 AC12: MISS nat3 (7vs12, hit:false, zero hpΔ) · HIT nat14→18 fd4==|hpΔ| · HIT nat14→18 fd6==|hpΔ| (fresh damage rolls [2],[4]; popup nat-replay §77 dismissed via log delta). 2 hits + 1 miss.
- Live save ledger (DC 13 CON, picker bonus 0 — cs keys abbreviated `con:1`, `computeNpcSave`/SavePromptModal:71 read full-word ⇒ raw d20, §160): nat13→`lastAttack.saveResult:"success"` — ZERO damage (no new hp_change), NO poisoned · nat9→failure · nat2→failure ⇒ Poisoned applied (runtime `Bandit 1.activeConditions:["poisoned"]`, dedup single, TWO `condition applied` log entries w/ sourceName Drow 1 + sourceAbility Hand Crossbow).
- **No default-half leak** (§63/MV-20): no hp_change EVER from save chip — success or fail — MA-0560 riderOnly strips the formula so missing dc_success is inert. No double-dip.
- Unconscious: ABSENT from all change-data + log on nat2 fail (margin 11 — clause would demand it) = primary defect evidence.
- Display seam note: Poisoned badge NOT rendered on EB-NPC victim initiative card / card overlay (`.creature-conditions` = Add-only, DOM-wide poisoned-title grep 0); runtime + log truth intact (MA-0586 badge claim did not reproduce for EB-NPC victims).

## KEY ASPECT 2 — Fail-by-5 unconscious rider: FAIL(a)
- App-wide grep `fail_by|failBy|fails by|by 5 or more|save.?margin|margin` over src/services + src/components: ZERO consumers.
- `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:277) scans save_effect ONLY ⇒ ["poisoned"]; description margin clause never parsed; no structured `staged_*` analogue (cf. staged_sleep MA-0068 / staged_paralysis MA-0248 templates).
- ⇒ Compound attack+save row resolves core-exact but the unconscious margin rider is structurally inert = **FAIL(a) compound** per §10 trichotomy.

## Fix direction
DATA-first + one structured consumer (proven clause trio §5):
1. DATA: move the margin clause out of prose into a structured key, e.g. `save_margin:{fails_by:5, also:"unconscious"}` (description byte-unchanged), and optionally `dc_success` stays absent (riderOnly fork makes it inert).
2. Parser: `parseSaveMarginClause(action)` in MonsterCardHelpers.js, structured-keys-only arm (byte-inert elsewhere) → forward on save options/context.
3. Consumer: in `applyDamagelessSaveConditions`/`applyFailedSaveConditions` (saveProcessing.js:799+) — context.saveMargin && (saveDc − saveTotal) >= fails_by ⇒ add "unconscious" alongside saveConditions, ONE addExpiration clock (hours ⇒ ×600 rounds), grant log. Waking-on-damage/shake-awake = advisory residual (§69 family, no consumers).
4. te: unconscious is a canonical condition (no new te key needed); register margin te only if a targetEffect route is chosen.
5. Tests: MonsterCardHelpers + saveProcessing margin tests (co-located).

## VERDICT: FAIL(a) — attack chip full-damage core + poisoned save core LIVE & exact; fail-by-5 unconscious margin rider INERT (grep-zero, prose-only, never in save_effect). Sub-note: EB-NPC victim Poisoned badge display seam missing.

## Cleanup
Admin clear-log + clear-change-data POSTs; curl: log == [], combatSummary creatures == []; no src/, no public-data, no manifest, no git writes.
