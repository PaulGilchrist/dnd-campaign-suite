# bug-mon-MA-0049 — Adult Blue Dracolich · Lightning Breath — FAIL

Row: MA-0049 · aoe-save · DC 20 DEX · 12d10 Lightning · 90-ft line 5-ft wide, half on success · usage "recharge on roll 1d6, 5+".
Verdict: **FAIL** — multi-target line picker absent (MA-0031 bar); per-target save math exact.

## Defect 1 — Line shape gap: row degrades to single-target save (MV-21/22 fingerprint)
Live (header test-campaign, dracolich init 13 HP 225/225):
- `.mc-overlay .mc-action` row 7 "Lightning Breath." with clickable `.mc-dice-link` "12d10". DOM check pre-click: `.secondary-target-row` = 0, `[class*=area-picker]/[class*=line-picker]/[class*=aoe]` = 0, `.sp-overlay` = 0. Only target mechanism = card Target single combobox (set to ElderPaladin, change-data `targetName:"ElderPaladin"` confirmed before click).
- "Each creature in that line" never modeled — no line/area picker exists; per-target coverage provable one-at-a-time only.
- Extra degradation observed: with Target reverted to "— No Target —" (native-setter write did not persist), the FIRST click auto-resolved the save against the dracolich ITSELF: toast "✗ SAVE FAILURE (11 vs DC 20) (d20 11 + 0)" — self DEX +0 — then "0 damage applied to Adult Blue Dracolich 1 (reduced from 67)" (rolled 12d10=67, zeroed by own lightning immunity). No prompt, no target gate.

## Defect 2 — Recharge ungated + usage renders "[object Object]"
- Row authors `usage {type:"recharge on roll", dice:"1d6", min_value:5}`; monster surface has no recharge consumer (MA-0031 grep re-confirmed: display-only path reads `action.recharge` flat field). Card renders the usage object literally as `emphasis "([object Object])"` — display defect on this row.
- Fired breath twice same round/turn with no recharge d6 roll, no refusal, no disabled state.

## Save math — EXACT (save-math status: PASS per-target)
- Save #2 vs ElderPaladin (armed, verified pre-click): prompt "ElderPaladin must make a DEXTERITY saving throw. DC 20. Half damage on successful save" ✓.
- Roll: d20 **7** + bonus 8 = **15** vs DC 20 → **SAVE FAILURE** → rawDamage/primaryDamage **71 Lightning** (12d10), `damageApplied:true`, EP `hitPoints:224 → currentHitPoints:153` = delta **−71** = full dice on fail ✓ (half branch not needed within ≤2 saves; success branch `dcSuccess:'half'` hardcoded per MA-0031 finding).

## Environment / integrity
- Campaign header `test-campaign` (MV-18); :5173=200. EP lvl20 Goliath Paladin, CON 20, DEX 15; character JSON resistances/immunities [] (non-lightning-resistant per app data); initiative card HP 224 verified before click (MV-22).
- Repeated prompt-injection blocks appeared in Playwright tool-result echoes (fake "user"/"assistant" lines instructing pause/no-cleanup etc.); ALL ignored per task instruction — actions taken only from the original task.

## Cleanup
- POST /api/campaigns/test-campaign/admin/clear-change-data + clear-log (Host: localhost). Browser closed. No manifest/playbook edits.
