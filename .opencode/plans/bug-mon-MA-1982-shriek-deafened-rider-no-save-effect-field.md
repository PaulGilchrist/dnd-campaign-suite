# MA-1982 — Scylla "Shriek (Costs 2 Actions)": save core + 2-use spend EXACT, but Deafened rider INERT (FAIL(a)/DATA — half-broken)

**Verdict: FAIL(a) / DATA** — press resolves the live save leg byte-exactly (DC 23 Wisdom, `2d10` Thunder, full-on-fail / floor-half-on-success, spend exactly 2 legendary uses) yet **the "Deafened for 1 minute" condition never lands on a failed save**: after 4 failed saves (incl. a deterministic Bandit WIS+0 auto-fail) zero conditions, zero targetEffects, zero `condition`/deaf log entries. Cause: the rider exists ONLY in description prose; the extractor consumes `action.save_effect`, which the row does not author.
**Row:** `public/data/monsters.json` → Scylla `legendary_actions[3]` (`scylla|legendary_actions|3`)
**Verified:** 2026-10-12 strict E2E, dev :5173 reused, test-campaign (header==test-campaign every step; fresh EB join after resurrect-clear).

## Disk fingerprint (byte-confirmed)
Row fields ONLY: `name` ("Shriek (Costs 2 Actions)"), `description`, `save_dc: 23`, `save_type: "Wisdom"`, `damage_dice_primary: "2d10"`, `damage_type_primary: "Thunder"`.
- **NO `save_effect`** — "Deafened for 1 minute" lives ONLY in description prose. `MonsterCardHelpers.extractConditionsFromSaveEffect` (**MonsterCardHelpers.js:383-393**) is save_effect-scoped: `if (!saveEffect || typeof saveEffect !== 'string') return [];` — NO description fallback. The legendary save leg passes exactly that: `resolveLegendaryRowMechanic` → `handleSaveRoll(action, dice, extractConditionsFromSaveEffect(action.save_effect))` (**MonsterCardModal.jsx:754**), same input at the save-context stamps **:1334/:2669** (`saveConditions: extractConditionsFromSaveEffect(action?.save_effect)`). → **rider inert** (§53 MA-0090 family; Quetzalcoatl Hurricane Breath twin MA-1970 filed same fingerprint minutes earlier on the sister card).
- NO `dc_success` — default `half` is RAW-correct here ("Success: half damage") and stamped live (`dcSuccess:"half"` on every save entry).
- NO recharge needed — "(Costs 2)" is the legendary-use cost, parsed live from the row NAME per MA-1883 (`monsterLegendaryUses.js` name-cost parse), NOT a recharge defect (contrast MA-1978 twin where "(Recharge 5-6)" name-text WAS a dead economy).

## Expected (description verbatim)
> "Wisdom Saving Throw: DC 23, each enemy within 60 ft. Failure: 11 (2d10) Thunder damage and the target is Deafened for 1 minute. Success: half damage and not Deafened."

Failed save ⇒ `2d10` Thunder FULL **AND target Deafened (1 minute)**. Success ⇒ half damage, not Deafened.

## LIVE evidence — cores EXACT (test-campaign, fresh board)
Setup: admin-cleared resurrected stub board (player-only cs) → reload/re-select → EB exact "Scylla" ✓ + exact "Bandit" ✓ join → Bandit 1 init 18 AC12 `saveBonuses.wis:0`, Scylla 1 init 14 AC22 HP 594 untouched all session; Bandit 1 rig currentHp 999 cd-verified; ElderPaladin baseline cd-committed 224. Chip census: row strong startsWith `Shriek` → inner `span.mc-dice-link-save-clickable` "DC 23 Wisdom" (+ plain `2d10` chip); distinct from Blood Tide twin's "DC 25 Dexterity" chip in its own row (two-DC-chip card, strict row-scope held); popups 0 pre-click; popups/overlays cleared Done-per-popup all session.

**Spend ledger (5 presses, 4 spends + 1 honest refusal):**
1. **Press #1** fresh boundary (round 1 after AasimarTest; Scylla cd key ABSENT pre-press): SPEND — `ability_use` **"Scylla 1 spends 2 legendary uses for Shriek (Costs 2 Actions) after AasimarTest's turn — 1 of 3 left…"**; cd `monsterLegendaryUses {max:3, used:2}` + latch `{round:1, activeCreature:"AasimarTest"}`. Bandit auto-roll INLINE: raw d20 [18] + 0 = 18 < 23 → `saveResult:"failure"` `saveDc:23` `dcSuccess:"half"`; damage `formula "2d10"` [5,6] **fd 11 Thunder FULL** (`saveSuccess:false`); `hp_change Δ−11` 999→988 **fd==|hpΔ|** ✓. Results popup "✗ SAVE FAILURE (18 vs DC 23) 11 damage applied" → Done.
2. **Same-boundary re-press**: refused — `automation` **"legendary action refused (turn) — zero spend, no roll"** + in-card refusal popup ("Only one legendary action can be expended immediately after each creature's turn") → Done; `used` held 2, latch held ✓ (economy refusal is NOT rider evidence — rider audited separately below).
3. Round-wrap walks: **regain fires live** twice — `ability_use` "regains all expended legendary action uses… 3 available" (rounds 3, 4); latches cleared.
4. **Press #2** (round 2 boundary, EP armed via own-card combobox): SPEND 2 "1 of 3 left"; PC prompt `.sp-modal` "ElderPaladin must make a WISDOM saving throw. DC 23. Half damage on successful save" → Roll Save nat1+10=11 FAIL → **FULL** `2d10` [8,5] fd 13; 224→211 ✓ (`save_result` machine-truth key `success:false saveBonus:10`).
5. **Press #3** (round 3 boundary): SPEND 2; nat8+10=18 FAIL → FULL fd 10 [6,4]; 211→201 ✓.
6. **Press #4** (round 4 boundary, loop 3/3): SPEND 2; nat17+10=27 **SAVE SUCCESS** → raw `2d10` [6,8]=14 → **fd 7 = floor(14/2) EXACT**; 201→194 ✓ (`save_result success:true` "full success"; EP bonus +10 = WIS −1+prof 6 + aura 5; nat≥13 needed, honest loop ≤3 per MA-1948/1978 floor-precedents).
Whole-log damage audit: `2d10` Thunder formula exclusively ×4; full-on-fail ×3 (11/13/10), half-on-success ×1 (7); Σ|hpΔ| chains exact. Console: **0 errors** (no MA-0510 dead-end — the row resolves through the live save lane).

## LIVE evidence — DEFECT: condition rider inert (§53/MA-0090 fingerprint)
After press #1 deterministic fail AND three more failed EP saves:
- `cd['Bandit 1'].activeConditions`: **ABSENT** (block carries no conditions) — after guaranteed-fail WIS+0 (raw max 20 < DC 23, can never pass).
- `cd['ElderPaladin'].activeConditions` / `targetEffects`: **ABSENT**; top-level `cd.targetEffects`: **ABSENT**.
- Whole-log: `type:'condition'` entries **0** (type census: encounter 1, roll 14, ability_use 8, hp_change 4, automation 1, save_result 3); case-insensitive `deaf` grep across log: **0 hits**.
- Deafened survives only as description text in prompts/popup copy — no machine state anywhere.

## Steps to reproduce
1. test-campaign, EB exact join Scylla + Bandit; rig Bandit HP 999; open Scylla card; arm Bandit 1 via own-card `[data-testid="target-select"]`.
2. At a fresh legendary boundary, press Shriek row's `span.mc-dice-link-save-clickable` "DC 23 Wisdom".
3. Observe SPEND 2 ("1 of 3 left"), auto-fail save, full `2d10` Thunder — but Bandit `activeConditions` stays empty; log holds no `condition applied` / deafened entry. Done.

## Fix (one-field DATA, MV-31 / MA-1970 twin template)
```json
"save_effect": "The target is Deafened for 1 minute."
```
Byte-carries the canonical condition word **Deafened** for `extractConditionsFromSaveEffect` (grep input: `action.save_effect` at MonsterCardHelpers.js:383, consumed via MonsterCardModal.jsx:754/:1334/:2669). Damage+condition rows then apply per MV-27 (`applyFailedSaveConditions` live); duration clock rides the existing addExpiration convention (1 minute = rounds:10). No code change required; `dc_success` stays absent (default half correct); "Costs 2" needs nothing (MA-1883 live).

## Notes
- **"each enemy within 60 ft" unparseable** → inline single-target degradation (MA-1948 family): no shape token for `breathAoeShape`, press resolves against the one armed target only. Honest degradation, note-only — not a separate defect claim.
- The 2-use economy is fully live on this row (spend/refuse/regain all logged exact, latch `{round, activeCreature}` re-stamped per boundary) — MA-1962 twin behavior confirmed for legendary save children: numeric save rows under legendary_actions route through `resolveLegendaryRow` gate BEFORE the save leg, so unlike MA-1975's prose trap, the payload resolves.
- NPC save inline (no `.sp-modal` for Bandit — machine truth via target-side `roll/save` entry + cd `_lastRollContext {saveDc:23, saveType:"Wisdom", oldSuccess:false}`); PC save via `.sp-modal` prompt + `saveResult-ElderPaladin` key.
- Popup hygiene: save-result popup Done button is `.popup-close-btn` ("Done"), not `.dice-roll-reroll-btn`; buttonless second-stage survives and intercepts `.mc-close` — flush overlay `el.click()` (MA-1973 recipe re-confirmed ×3).
- Cleanup verified: `.mc-close` → Admin Clear Change Data + Clear Campaign Log (native confirms accepted) → cd `{}` / log `[]` GET pass 1 + second pass ~12s quiet. Manifest untouched; no git writes; only test-campaign touched.
