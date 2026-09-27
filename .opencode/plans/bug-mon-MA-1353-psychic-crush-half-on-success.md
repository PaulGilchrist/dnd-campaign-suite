# MA-1353 FAIL(a)/DATA — Psychic Gray Ooze "Psychic Crush": successful Intelligence save still pays HALF damage (RAW: zero)

## Row (disk truth, public/data/monsters.json psychic-gray-ooze actions[1])
```json
{
  "name": "Psychic Crush",
  "description": "Intelligence Saving Throw: DC 10, one creature the ooze can see within 60 feet. Failure: 13 (3d8) Psychic damage.",
  "attack_bonus": 0,
  "save_dc": 10,
  "save_type": "Intelligence",
  "save_effect": "Failure: 13 (3d8) Psychic damage.",
  "range": "", "reach": "", "recharge": "",
  "damage_dice_primary": "3d8",
  "damage_type_primary": "Psychic"
}
```
RAW: damage clause is **Failure-only** — a successful save takes **no damage**. Row authors **NO `dc_success`** field.

## App behavior (live, test-campaign, localhost:5173, 2026-09-26)
Half-on-silence convention (MV-20, §63/§456) leaks half onto a RAW-none row:
- `MonsterCardModal.jsx:255/:1011/:1996` — `action.dc_success ?? 'half'`
- `applyDamage.js:88-97 computeDamageAfterSave` — saveSuccess && 'half' → `Math.floor(raw/2)`; returns 0 only for `'none'`.

### Live ledger (EB Join "Psychic Gray Ooze 1" idx0 + "+NPC" Bandit AC12, HP 999 full-store cs POST, armed targetName='Bandit'; inline seam; `saving_throws:{int:{modifier:±19}}` nested-abbrev cs POST determinism §212)
- **FAIL leg (−19)**: victim save `total −9 (nat10 −19) vs saveDc:10 Intelligence`, `saveSuccess:false`; save-damage `formula "3d8" rolls[7,1,8] finalDamage:16 damageType:"Psychic"`; hp 999→983 (Δ16 = full rolled ✓). CORE enforcement LIVE: DC 10 ✓, Intelligence stamp ✓, Psychic ✓, fail=full ✓.
- **SUCCESS leg #1 (+19)**: `✓ SAVE SUCCESS (31 vs DC 10)` (nat12+19) — **5 damage applied to Bandit — HP 983→978**; log `saveSuccess:true, dcSuccess:"half", finalDamage:5` (applied pool 10/11 halved; log `rolls:[2,7,1]` display re-roll diverges §33/§449). **OVER-DAMAGE vs RAW zero.**
- **SUCCESS leg #2 (+19)**: `✓ SAVE SUCCESS (32 vs DC 10)` (nat13+19) — **6 damage applied — HP 978→972**; arithmetic self-consistent floor(13/2)=6. **OVER-DAMAGE again — not a one-off face.**
- Ledger addition honest: ΣfinalDamage 27 = Σ|hpΔ| = 999−972. Console 0 errors.
- No phantom conditions: victim change-data `{}`, targetEffects null (row has no condition rider — correct).

## Chip census (§409/§705 triple-chip trap confirmed)
Row renders `+0` junk chip (attack_bonus:0, §490), bare `3d8` auto-damage trap chip, and real `DC 10 Intelligence` save chip. **Only the DC chip pressed** (3/3 first-click, zero absorb, §796/§771 family). `+0`/`3d8` never pressed.

## Secondary axis (advisory, not core)
`range:""` on disk — prose "within 60 feet" has no structured field → distance gate inert/lenient (§149/§42, §181-adjacent advisory note only).

## Fix (one-field DATA, MA-0481/MA-0622/MA-0781/§678 family)
Add `"dc_success": "none"` after `save_type` on psychic-gray-ooze actions[1].
- `computeDamageAfterSave` then returns 0 on success byte-correctly; fail leg byte-identical.
- Stale-pin watch (§216/§219): any test pinning this row's absent dc_success or half-on-success must invert same pass; MA-0286 suppression scan skips save_dc rows — no inversion needed there.
- Post-fix re-verify needs full §280 refresh sequence (cache:reload → reload → re-select → re-join → re-stage).

## Verdict
**FAIL(a)/DATA** — core DC/ability/damage-type/fail-full axis LIVE and exact; decisive success-leg axis over-pays half damage contrary to RAW none (MA-0781 family). Distance-gate advisory noted (range absent).
