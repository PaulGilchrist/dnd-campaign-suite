# Bug — MA-1932 King Kong "Thunder Roar (Recharge 5-6)" actions[3]

**Verdict: FAIL(b)/DATA** — recharge name-text never gates (MA-1916/MA-1924 twin, third+ family instance). Save core (DC/face/grant) passes.

## Row
`king-kong|actions|3` — save row, DC 23 Wisdom, Frightened-until-end-of-next-turn on fail, nothing on success, **no damage dice**, "(Recharge 5-6)" in the action NAME only.

## Defect 1 (primary) — recharge ungated: name-text, no structured field
Disk actions[3] has **NO `recharge` field and NO usage recharge dict**. `rechargeUsageOf` (`src/services/encounters/monsterRecharge.js:35`) reads only flat `action.recharge` or `usage.type:/recharge on roll/i` → **gate null → economy never engages**. "(Recharge 5-6)" is inert name text (MA-1890/MA-1916 codified: "name-text never gates").

### Live machine proof (test-campaign, :5173, Kong idx0 vs Bandit 1 clean canvas, cs HP 999/999, Bandit cd pre-cleared)
- **Ungated multi-fire 3/3 same fight, zero recovery**: three chip presses all resolved — save seam never refused, never spent:
  - Fire #1 (wb −30): `roll save` Bandit d20 **17** total **−13** saveResult **failure** dc:23 Wisdom → `condition` **Frightened** granted + `condition_clauses_advisory`
  - Fire #2 (wb −30, immediate re-press, all popups flushed via `popup-close-btn` Done first): d20 **16** total **−14** failure → **second** Frightened grant
  - Fire #3 (wb +30 success leg): d20 **8** total **38** **success** — third fire, still ungated
- **Zero refusal**: log `refused` count **0**; no `.mc-recharge-refusal` popup; chip class stays `mc-dice-link-save-clickable`, **no `mc-dice-link-spell-spent`** spent chip after any fire.
- **Zero spend/state**: `monsterRecharge` **absent** everywhere (change-data top-level keys `[]`, `King Kong 1.monsterRecharge` null, `Bandit 1.monsterRecharge` null, whole-store regex `rechargeAnywhere:false` — /recharge/i log hits are description/name-text echoes only); **zero `ability_use`** log entries whole-session.
- No recovery d6 possible at Kong turn-start: nothing was ever stamped spent (rollMonsterRecharges no-ops on empty map).
- Raw unlimited repeat-fire of a 5-6 recharge AoE = RAW violation.

**Fix (one field):** `"recharge": "5-6"` on actions[3] — rides the live MA-0031/MA-0488/MA-1859 lane (spend at fire + `<slug>_refused (not recharged)` popup/log + spent chip + d6 recovery at Kong's own turn-start vs threshold 5). `thunder_roar` refusal slug derives from name via `rechargeActionKey` (strips the "(Recharge 5-6)" suffix cleanly).

## Defect 2 (secondary, cosmetic DATA contradiction) — save_effect vs description
`save_effect` byte: "…Success: **half damage** and not Frightened." vs `description`: "Success: no effect. **No damage**." With zero damage dice authored the half-claim is **mechanically inert** — `dc_success` absent → engine default half (§335) but there is no pool: success face emitted **ZERO save-damage entries** (not even finalDamage:0), zero hp_change. Honest fix: save_effect → "Success: no effect." (drop half-damage clause; consider `dc_success:"none"` per §530 condition-only-row convention so no fake "takes half damage" copy can ever surface).

## What PASSED (save core, exact)
- **FAIL face**: saveDc **23**, saveType **Wisdom** enforced (lastAttack.saveDc/saveType + victim roll entry); wb −30 folds at the shapeless inline seam (total −13 = 17−30, structural fail at DC23 — MA-1920 twin: wb ±30 sole fold channel).
- **Frightened granted** on fail: cd `activeConditions:["frightened"]` + meta `{source:"King Kong 1", durationNote:"until the end of its next turn (GM-enforced)"}`. Duration lane = advisory durationNote, **no machine rounds:2 clock / no pendingExpirations** (§0711 fork resolved as advisory — §70-class residual, noted not FAIL).
- **SUCCESS face**: wb +30 → success; **ZERO new Frightened grant** (store stays empty on cleared canvas), zero damage of any kind. §335 half-default inert pool-less — honest zero.
- Shapeless "within 60 ft." (description-only, no range field) → inline auto-resolve, no picker, 3/3 first-click after popup flush (MA-1920/MA-1931 twin); save-chip popup prints cosmetic "DC Unknown" — lastAttack/log decisive (§591 re-confirm).
- Popup chrome: el.click() on `.popup-overlay` backdrop does NOT dismiss — its **`button.popup-close-btn` "Done"** does; un-flushed popup absorbed one chip press mid-probe (§29/§141 re-confirm).
- "can hear Kong" qualifier: zero-consumer advisory note only.

## Victim note
ElderPaladin invalid frightened victim (§492 Aura of Courage) — EB Bandit clean canvas used, per plan.

## Ops
Cleanup: admin clear cd+log POST 200 → GET `{}` + `[]`, quiet 15s re-verified `{}`/`[]`. Console 0 errors. No manifest/registry writes.
