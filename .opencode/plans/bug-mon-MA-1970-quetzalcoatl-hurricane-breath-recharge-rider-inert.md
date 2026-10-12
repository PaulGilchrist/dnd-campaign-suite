# MA-1970 — Quetzalcoatl "Hurricane Breath (Recharge 5-6)": recharge economy DEAD + Prone/Deafened rider INERT

**Verdict:** FAIL(b) / DATA — save core exact; two-field row fix required.
**Row:** `public/data/monsters.json` → Quetzalcoatl `actions[3]` (monsterIndex quetzalcoatl)
**Verified:** 2026-10-12 strict E2E, dev :5173, test-campaign (EB exact-join rebuild; empty board pre-session).

## Disk fingerprint (re-verified)
Row authors ONLY: `name`, `save_type: "Dexterity"`, `save_dc: 25`, `description`, `damage_dice_primary: "20d6"`, `damage_type_primary: "Thunder"`.
- NO `recharge` field — "(Recharge 5-6)" is NAME-TEXT. `monsterRecharge.js` `rechargeUsageOf` (:35) reads ONLY `action.recharge` or structured `action.usage{type:/recharge on roll/i}` — name never parsed → gate null → **economy dead** (MA-0663/MA-1948 family).
- NO `dc_success` — default half, RAW-correct here.
- NO `save_effect` — Prone/Deafened exist ONLY in description prose. `MonsterCardHelpers.extractConditionsFromSaveEffect` (:383) is save_effect-scoped, `!saveEffect → []`; MonsterCardModal block-save legs pass `extractConditionsFromSaveEffect(action?.save_effect)` (:1334/:2669) → **rider inert** (§53 MA-0090; §153 analogous).

## Live evidence (save core EXACT)
- Picker: "90-ft Cone (GM positions tokens; selection advisory)", "Dexterity saving throw (DC 25)", "On a failed save… 20d6 Thunder… On a successful save… half damage". breathAoeShape parses "90-foot Cone" → SaveAttackAoeModal (`sp-overlay`; `dsp-overlay` reserved for death saves, re-confirmed §62).
- Save prompts machine truth: `savePrompt-<T>` × { saveDc:25, saveType:"Dexterity", dcSuccess:"half", saveConditions:[] }.
- 5 presses × auto/prompt saves, ALL fail (bandit dex +0 auto-face; EP +8, FR +8, Monk +11 w/ aura): `saveResult:"failure"` ×15 roll entries; 20d6 Thunder rolls 67/74/81/68/66 (bandit), 60/73/63/60 (EP), 82 (FR) — FULL on fail, `hp_change` deltas exact chains: Bandit 999→932→858→777→709→643; EP 224→164→91→28→0 (dsp Roll Death Save nat10 SUCCESS stable); FR 89→7.
- Success face NOT obtained honestly: 12 prompt/face rolls zero successes (EP max total 23<25 recipe-assumption WRONG — Paladin 2024 WIS/CHA saves only; Monk success-face carrier needs nat 14+, failed 9/4/9/11). Half-on-success verified only statically (prompt `dcSuccess:"half"` + picker copy), no runtime success leg.

## Live evidence (two DATA defects)
1. **Recharge economy dead:** 5 same-turn fires + walked to Quetzalcoatl turn-start round 5 → `automationType:*_refused` = 0, `type:'recharge'`/`recharge_failed` = 0, recovery d6 = 0, `Quetzalcoatl 1.monsterRecharge` key NEVER written (store keys: pendingExpirations only). Log audit by exact type only (name rides every entry).
2. **Condition rider inert:** 15 failed saves (incl. Bandit auto-fail face ×5) → `type:'condition'` entries = 0, `activeConditions` writes = 0 for Bandit/Monk/EP/FR. Prone/Deafened live ONLY in results-popup description text.

## NEW session findings
- **Reroll-submit lane drops damage (CODE):** Disciplined Survivor focus reroll on a queued cone save → `createSubmitSaveResult` (SavePromptModal.jsx:440) POSTs `sendSaveResult` + `applyRerollToCombatSummary` but never dispatches `save-result` with rawDamage and never applies fail-damage (design assumes first submit applied it; GM queue applies at submit) → failed reroll adjudicated **0 damage**: results row literal "Failed — takes 0 Thunder damage", no hp_change, HP 183 intact, focus spent (20→19). Non-rerolled queue targets apply exact — reroll-lane-specific defect.
- **Monk Evasion arms from suite 2024 class data (unrelated target-side):** `data/2024/classes.json` `Monk/class_levels[6]/features[0].automation {type:"evasion",saveType:"DEX"}` → Disciplined_Monk (feats: no Evasion) halved on EVERY failed save (`rollType:'evasion' saveResult:'failure' finalDamage:26=floor(52/2)`, -42=floor(84/2), -34=floor(68/2)) while Bandit/EP/FR pay full. 2024-Evasion math itself correct; the MONK-grants-Evasion authoring is the smell — for MA-1970 ledgers use non-evasion victim faces.
- ElderPaladin 2024 (WIS/CHA profs) dex save +3 base, +8 w/ aura — cannot reliably face DC25 success; recipe success-face carrier should be Monk (nat 14+) with reroll lane AVOIDED (see reroll defect).
- Tracker NPC max-HP spin accepts 999 in DOM but persists currentHp only (state kept 999/11); damage lane `applyCreatureHpDamage` uses creature.currentHp unclamped-by-max → rig safe.
- EB-join players appear in change-data combatSummary as hp 1/1 stubs while tracker shows true max (183/224) — oracle = tracker/char-store, not cs stubs.

## Fix (two-field DATA, per MA-1843 + MV-31 precedent)
```json
"recharge": "5-6",
"save_effect": "The target is also knocked Prone and Deafened for 1 minute on a failed save."
```
`save_effect` prose byte-carries canonical "Prone"/"Deafened" for `extractConditionsFromSaveEffect`; `recharge:"5-6"` arms the live MA-0031 gate (threshold 5, refusal popup + `hurricane_breath_refused`, turn-start d6 recovery).

## Cleanup
.mc-close → Admin Clear Change Data (confirm accepted) + Clear Campaign Log → two-pass empty verify (cd {} / log 0, ~15s apart). Manifest untouched; no git writes.
