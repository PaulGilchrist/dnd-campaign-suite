# Bug: MA-1492 — Sphinx of Lore "Mind-Rending Roar" — half-damage leaks on RAW-silent save success

**Verdict: FAIL(a) / DATA** — one-field fix family (§63 half-default; MA-0781 / MA-1301 / MA-1427 / §678 precedent).

## Row (disk, public/data/monsters.json → "Sphinx of Lore" actions[2])
```json
{"name":"Mind-Rending Roar",
 "description":"Wisdom Saving Throw: DC 16, each enemy in a 300-foot Emanation originating from the sphinx. Failure: 35 (10d6) Psychic damage, and the target has the Incapacitated condition until the start of the sphinx's next turn.",
 "save_dc":16,"save_type":"Wisdom","range":"300-foot Emanation","recharge":"5-6",
 "save_effect":"The target takes 35 (10d6) Psychic damage and has the Incapacitated condition until the start of the sphinx's next turn."}
```
RAW: success = UNAFFECTED (only a "Failure:" clause; no "Success: Half" anywhere in description or save_effect).

## Defect
Row authors **no `dc_success`**. Engine default `action.dc_success ?? 'half'`
(`MonsterCardModal.jsx:255`, `:1032`, `:2017`) pays HALF Psychic damage on a
SUCCESSFUL save. Live-captured twice:

| ts | save | raw dmg | paid | hpΔ |
|---|---|---|---|---|
| 1790569487943 | success nat16 (bonus 0, picker seam §43) | 28 | **14** | −14 (999→985) |
| 1790569647276 | success nat20 | 41 | **20** | −20 (985→965) |

Picker preview also prints the wrong contract verbatim: "On a successful save,
target takes half damage." `dcSuccess:"half"` stamped on every save-damage log entry.

**Fix (DATA, one field):** add `"dc_success": "none"` to the row.
(MA-0781 Horrific Visage / MA-1301 twin pattern.)

## What WORKS (do not chase — full-fail + economy are honest)
- **FAIL face exact:** nat14<DC16 → raw 10d6 rolls [6,4,3,3,5,5,3,2,3,5]=total 39, `finalDamage:39`, hp_change −39 (965→926), 10 dice, Psychic, formula "10d6" (10d6 structured via `extractDamageDiceFromDescription` Failure-clause match; renders own damage chip ✓).
- **Condition grant:** ONE `condition applied` entry, Bandit 1 Incapacitated, source Sphinx/Mind-Rending Roar, duration carried in log: "until the start of the sphinx's next turn (GM-enforced)". Zero condition grants on both success legs — whole-log condition entries == 1 (§96 success-zero ✓). Meta shape {dc,ability,source} (no durationNote key — §926 accepted variant; duration surfaces in log).
- **Recharge 5-6 FULLY enforced (§61):** spend `ability_use` at picker-open ×3 (legs 2/3 only after recovery); immediate refire refused — "Not Recharged" popup (5+ at own next turn) + `mind_rending_roar_refused` zero-spend zero-roll; spent chips `mc-dice-link-spell-spent` on both chips + "(Recharge 5-6 — unavailable)" note; recovery d6 at owner turn-start logged twice (d6:6 ts …618149, d6:5 ts …729252, `lastAppliedTurnStartCreature`=3:Sphinx gate honest) — MA-1448 pattern.
- **Emanation:** §62/MA-0317 predicted single-target degradation — SUPERSEDED by the MA-0590 range-byte seam: row opens SaveAttackAoeModal "300-ft Radius (GM positions tokens; selection advisory)". Documented residual only (radius approximation + advisory); picker itself live and functional.
- **§67 staged_roar:** row authors no staged keys → ladder N/A, not a defect.
- **DC chip:** "DC 16 Wisdom" (`mc-dice-link-save-clickable`) routes the save path; chip landed first click 3/3.

## Session notes
- NPC picker save bonus lost (`saveBonus:0` vs Bandit WIS +1) = known §43 picker-key seam; does not affect verdict (success legs were nat≥16 raw anyway).
- Injection event: Playwright navigate args rewritten mid-session to offsite OSS proxy URL (§1/§90 pattern); actual loaded page verified localhost:5173; no offsite navigation performed.

## Suggested fix (orchestrator data write)
`public/data/monsters.json` → Sphinx of Lore actions[2]: add `"dc_success": "none"`.
Then re-verify success legs pay fd:0, log `dcSuccess:"none"`, zero hp_change.
