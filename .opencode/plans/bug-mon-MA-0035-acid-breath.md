# Bug Report — MA-0035 Adult Black Dragon · Acid Breath (Recharge 5-6) — CLEAN RIG RE-VERIFY

**Verdict: FAIL** (line-shape absent + recharge ungated)
**Prior D1 "half damage on save failure" — RETRACTED** (was Evasion contamination, see below)

Campaign: test-campaign (header confirmed) · Date: 2026-09-13 · E2E via :5173 (GM/localhost)
Joined pre-existing "MA-0035 Acid Breath Test" via Encounters → Load → Join Encounter (no save/create). Pre-test change-data `{}` (clean rig).

## Target hygiene (fixes prior mistake)
- Dragon initiative card `[data-testid="target-select"]` armed to **ElderPaladin** BEFORE any action click;
  change-data confirmed `cs.creatures["Adult Black Dragon 1"].targetName === "ElderPaladin"` (195/195, immunities [Acid]).
- ElderPaladin (Paladin 20, Goliath): DEX 16 → +3, no DEX save proficiency, Aura +5 (CHA 20) → saveBonus 8 at runtime;
  `resistances: []`, `immunities: []`, **no Evasion**. Max HP 224 > 54 max breath.
- Dragon never targeted. Prior PC AasimarTest (Rogue 20, **Evasion**) excluded.

## Verified working
- **DC 18 Dexterity enforced** (both flows): save_result logs `saveDc:18, saveType:"Dexterity", saveBonus:8`.
- **SUCCESS → half (exact)**: d20 18 +8 = 26 vs 18 → success; save-damage 12d8 [4,4,7,6,6,3,6,5,3,2,2,3] = **51**, finalDamage **25** = floor(51/2); hp_change **-25**, 224 → 199. Exact.
- **FAILURE → full (exact)**: d20 2 +8 = 10 vs 18 → failure; save-damage 12d8 [7,2,3,7,6,5,7,2,1,6,3,5] = **54**, finalDamage **54**, saveSuccess:false; hp_change **-54**, 199 → 145. Exact, no halving, no resistance applied.

## RETRACTED: D1 "half damage on save failure"
Prior run recorded fail (13 vs 18) of 53 applied as 26 on **AasimarTest** — a Rogue 20 with **Evasion**
(prompt even showed "No damage on success, half damage on failure"). That is Evasion working as designed,
not a resolver defect. On a no-resistance/no-Evasion PC (ElderPaladin) this run, failure applied
**full 54 → -54** (199→145). Prior D1 retracted; resolver half/fail math is Evasion-driven, correct behavior.

## Defects (reproduced clean)

### D2 — "DC 18 Dexterity" save link absent in .mc-overlay (structural)
- Acid Breath row contains only `mc-dice-link` "12d8" chip + plain text; no labelled save link.
  Row text: "Acid Breath (Recharge 5-6). 12d8Dexterity Saving Throw: DC 18, ... Line. Failure: 54 (12d8) Acid damage. Success: Half damage. (5-6)".
- Chip click routes to handleSaveRoll and works (armed target honored), but the MV line-shape is absent.

### D3 — Line shape absent, single-target degradation (MV-21 fingerprint — EXPECTED FAIL)
- Single DOM query after trigger: `.line-picker, .aoe-picker, [class*=aoe], [class*=placement], [class*=line-target]` → **0 nodes**.
- 60-ft × 5-ft Line affects only the single row-selected target.

### D4 — Recharge ungated (MV-22 fingerprint — EXPECTED FAIL)
- 2nd activation in same fight/round 1 fired the save prompt **immediately** (no recharge d6, no "not ready" gate):
  flows at ts 1789281466 (1st) and 1789281581/1789281603 (2nd), round still 1. recharge "5-6" inert.

### D5 (minor)
- Damage popup shows "(d20 18 + 0)" / "(d20 2 + 0)" bonus vs actual saveBonus 8 (aura +5 not shown).
- HP not persisted: after hp_changes -25 then -54, runtime `ElderPaladin.hitPoints` still **224**, combatSummary placeholder 1/1.
- Chip click emits a spurious shadow "DEX" save roll log per trigger (e.g. rolls [8,10], bonus 0) before the prompt.

## Cleanup
Admin clear POSTs (Host: localhost) executed; browser closed. No manifest/playbook edits.
