# BUG MA-1498 — Sphinx of Secrets "Curse of the Riddle" — FAIL(a)/DATA (half-leak on save success)

- stableKey: `sphinx-of-secrets|actions|2` | disk: `public/data/monsters.json` sphinx-of-secrets actions[2]
- Session: 2026-09-28, test-campaign ONLY, dev :5173 reused, Playwright E2E.

## ROW (verbatim)
{"id":"MA-1498","stableKey":"sphinx-of-secrets|actions|2","monsterIndex":"sphinx-of-secrets","monster":"Sphinx of Secrets","actionIndex":2,"actionType":"attack+save","saveDc":15,"saveType":"Intelligence","saveEffect":"The target takes 21 (6d6) Psychic damage and is cursed with a riddle. The cursed target has Disadvantage on ability checks and attack rolls. If it takes the Action, it must succeed on a DC 15 Intelligence saving throw or that action is wasted. The cursed target can take a Study action to make a DC 15 Intelligence check, solving the riddle and ending the curse on a success. The curse ends early if the sphinx curses another target.","range":"60 feet","description":"Intelligence Saving Throw: DC 15, one creature within 60 feet. Failure: 21 (6d6) Psychic damage, and the target is cursed with a riddle... (full text as save_effect)","verified":"not verified"}

## VERDICT: FAIL(a)/DATA — one-field fix `dc_success:"none"`
RAW = failure-only ("Failure: 21 (6d6) Psychic..."). Row authors NO `dc_success` → `buildSaveOptions` half-default (`action?.dc_success ?? 'half'`, MonsterCardModal.jsx:1032; same default :255) pays HALF damage on a save SUCCESS. LIVE-PROVEN (press #2): nat16+0=16 ≥ DC15 SUCCESS → save-damage fd **11** = floor(22/2), hp_change −11 (971→960). RAW success must pay ZERO. MA-1301/MA-1427/MA-0781 family (§63, playbook §914).

## LIVE LEDGER (Bandit 1, INT +0, AC12, resistances [], HP refilled 944→999 via card HP input)
| press | nat | bonus | total vs DC15 | result | 6d6 rolls | dmg paid | hpΔ | hp after | cursed grant |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | +0 | 5 | ✗ FAILURE | [6,3,6,1,6,6]=28 | 28 FULL | −28 | 971 | `condition applied` "Cursed" + change-data activeConditions["cursed"] meta{source} |
| 2 | 16 | +0 | 16 | ✓ SUCCESS | [3,5,1,5,6,2]=22 | **11 HALF (LEAK)** | −11 | 960 | none new (§96 clean — no second grant) |

- DC 15 INT ENFORCED: victim `roll save` saveDc:15/saveType:"Intelligence"/saveResult machine truth + lastAttack{saveDc,saveType,saveResult} (§96 EB-NPC inline seam — no saveResult-<T> key, inline auto-resolve, no .sp-modal §129).
- Fail face damage 6d6 FULL: formula "6d6" Psychic, rolls 6 dice, 28 ∈ [6,36], hpΔ==fd exact. Crit n/a (save row).
- Success face: RAW zero required, paid 11 → FAIL(a). Zero new condition grants on success ✓ (only 4 entries, no condition entry; stale cursed persists §96).
- Save chips: row renders "6d6" + "DC 15 Intelligence" (`.mc-dice-link-save-clickable`); DC chip fired FIRST click both presses (no §141 absorb this session); popups dismissed via own `button.popup-close-btn` (§927). Console 0 errors.

## STATIC
- Disk row: `save_dc:15`, `save_type:"Intelligence"`, `range:"60 feet"`, prose-only damage ("Failure: 21 (6d6)" scraped live via `extractDamageDiceFromDescription` :688 `Failure:` arm — transport OK). NO `damage_dice_primary`/`damage_type_primary`, NO `dc_success`, NO te/riddle/automation keys.
- te/riddle grep: `rg -i "riddle" src server` → **ZERO matches app-wide**. No `cursed`/riddle te in `targetEffectDefinitions.js`.
- Condition lane: `'cursed'` IS in canonical CONDITIONS word list (MonsterCardHelpers.js:52) + registered condition (`conditionUtils.js` key 'cursed' label 'Cursed') → `extractConditionsFromSaveEffect` word-scan grants Cursed on fail — LIVE ✓ (fail-face grant above). This differentiates from MA-0090 zero-state class (§53): damage AND a curse condition land.
- No test pins on this row/monster (grep-zero) → fix carries no stale-pin inversion risk (§216 N/A).

## BEHAVIOR CLAUSE GREP (advisory §70/§53 — do NOT rebuild without ticket)
| clause | consumer | status |
|---|---|---|
| Disadvantage on ability checks + attack rolls while cursed | zero in conditionEffects/combat seams (nearest twins: `ability_save_disadvantage` MA-1352, `disadvantage_next_attack`, `hex_ability_check_disadvantage` — none ride the cursed condition) | advisory-unbuilt |
| Wasted-Action gate (DC15 INT or action wasted) | grep-zero ("wasted" only maze/forcecage prose) | advisory-unbuilt |
| Study action solve (DC15 INT check ends curse) | Study machinery exists PC-side only (mazeHandler `banished_demiplane`) — no riddle consumer | advisory-unbuilt |
| Curse transfer ("ends early if sphinx curses another target") | zero consumers; grant meta {source} only, NO expiry clock (§70 persistent-until-GM, quasit §866 lineage) | advisory-unbuilt |

## FIX (one DATA field)
Add `"dc_success": "none"` to sphinx-of-secrets actions[2] (after `"save_type"`; MA-1301 single-target twin placement). Expected post-fix: SUCCESS face fd 0 / no hp_change (proof = "Saved — takes no damage (rolled N)" + unchanged HP §193); FAIL face byte-identical (full 6d6 + Cursed grant). Clause gaps above remain documented advisory residuals (MA-0090-class does NOT apply: fail face pays damage + condition state).

## END-STATE
Initiative left LIVE for MA-1499+ (same monster spellcasting — registry/manifest `sphinx-of-secrets|actions|3`); change-data + campaign log admin-cleared via Admin UI at session end. No manifest/git writes.
