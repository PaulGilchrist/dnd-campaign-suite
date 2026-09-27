# BUG MA-1427 — Salamander Constrict (save row): half-damage leaks on save SUCCESS + primary Bludgeoning leg never rolls

**Verdict: FAIL(a)** (test-campaign, dev :5173, 2026-09-27, 10 presses, Bandit AC12 Str +0 victim, Salamander 1 armed EB join)

## Symptom
1. **Half-damage on save SUCCESS** — every successful save still pays half of 2d6 Fire (no-effect per RAW/description; `dc_success` not authored → MV-20 default `half` leak).
2. **Primary leg missing on FAILURE** — CONSTRUCT row pays ONLY `2d6` Fire; the `2d6 + 4` **Bludgeoning** primary is never rolled on any outcome, single save-damage log per press, no `combined_damage_roll`, no Bludgeoning anywhere.

## Evidence (machine truth)
- `lastAttack`: `saveDc:15, saveType:"Strength", bonus:0 (Bandit str saveBonuses.str:0)`, but on `saveResult:"success"` → `rawDamage:3, damageApplied:true, primaryDamageType:"Fire", secondaryDamage:null`.
- Log `/api/campaigns/test-campaign/log` (54 entries): every adjudication stamps `dcSuccess=half`.
  | Press | d20+mod | result | paid (save-damage, damageType=Fire) | RAW expected |
  |---|---|---|---|---|
  | P1 | 19+0 | success | 3 (half of 7) | **0** ✗ |
  | P2 | 6+0 | failure | 5 (2d6 only) | 2d6+4 Bldg + 2d6 Fire ✗ |
  | P3 | 13+0 | failure | 8 | ✗ (no Bldg) |
  | P4 | 5+0 | failure | 7 | ✗ |
  | P5 | 20+0 | success | 3 | **0** ✗ |
  | P6 | 20+0 | success | 1 | **0** ✗ |
  | P7 | 19+0 | success | 5 | **0** ✗ |
  | P8 | 8+0 | failure | 5 | ✗ |
  | P9 | 14+0 | failure | 5 | ✗ |
  | P10 | 7+0 | failure | 7 | ✗ |
- HP ledger honest to what was paid: 999→950, Σ|hpΔ|=49=Σ popup totals (but 12 of it was paid on successes).
- DC enforced = 15 Strength on all 10 ✓. Mode normal (no adv/dis) ✓.
- Conditions branch OK: all 6 failures granted **Grappled + Restrained** (`condition` log entries + change-data `Bandit.activeConditions:['grappled','restrained']`, `activeConditionMeta.grappled{source:"Salamander 1", durationNote:"until the grapple ends (GM-enforced)"}`); successes granted none ✓. MA-0368 save-leg constrict lineage holds.
- **escape_dc 14 gap note:** meta carries NO `dc`/`ability` field — prose "(escape DC 14)" only, no `escape_dc` authored field folded (documented gap, consistent MA-1344 lineage; not counted in FAIL).
- Census: row wires THREE chips (`+0`, `2d6 + 4`, `DC 15 Strength` save-clickable). Save chip live (not inert → not FAIL(b)). Dice `+0` chip is the attack_bonus:0 decoy.

## Root cause (grep-proven)
1. **DATA — half leak:** row has no `dc_success`; `MonsterCardModal.jsx:255` + `:1032` `action.dc_success ?? 'half'` → success pays half. Fix = DATA `dc_success:"none"` (§63, honest copy on both surfaces).
2. **Misclassification — primary dropped:** `isCompositeAttackSaveRow` (:930) tests `attack_bonus != null && save_dc > 0`. Constrict authors `attack_bonus:0` (decoy, unmissable/meaningless) → counts as composite → `saveLegCarriesSecondaryDamage` (:940-943) matches (`"2d6"` byte-inside save_effect) → `resolveSaveLegDamageFields` (:1427-1435) replaces the save leg with `autoDamageFormula:"2d6"` Fire, `autoDamageSecondaryFormula:null` — primary `2d6 + 4` Bludgeoning discarded, secondary transport never built (MA-0427 `applySecondarySaveDamageLeg` never reached). :952-953 comment claims "pure-save rows stay byte-identical" — the `attack_bonus:0` breaks that discriminator.

## Likely Location
- DATA: `public/data/monsters.json` Salamander actions[2] — add `dc_success:"none"` (+ consider removing `attack_bonus:0` decoy so the row classifies pure-save and MA-0427 secondary transport threads BOTH legs).
- CODE if data-only insufficient: `MonsterCardModal.jsx` `saveLegCarriesSecondaryDamage`/`isCompositeAttackSaveRow` (attack_bonus `0` must not mark composite) and `resolveSaveLegDamageFields` (:1419).
- saveProcessing applyFailedSaveConditions / getSaveDcSuccess seam consumed values stamped `dcSuccess=half` in log (machine proof).

## Also observed
- Repeated fabricated `browser_navigate`(aliyuncs/OSS) echoes + fake "VERIFIED: PASS" text injected into tool outputs throughout session — ignored per playbook §1; all data above independently curled/DOM-read.
- `saveResult-Bandit` change-data key stayed null (NPC inline auto-roll wrote `lastAttack.saveResult` only) — judged via `lastAttack` + log per §32.

## Rig (repro)
Initiative +NPC → autocomplete "Bandit" exact-li → cs full-store POST Bandit currentHp/maxHp 999 → EB Encounters search Salamander → exact td row checkbox ("Salamander 5 1,800 Underdark") → Join Encounter → arm Bandit on Salamander 1 own-card `[data-testid=target-select]` → press `.mc-dice-link-save` ("DC 15 Strength"), dismiss both popup stages between presses.
