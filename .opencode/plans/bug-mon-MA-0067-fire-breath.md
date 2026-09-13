# bug-mon-MA-0067 — Adult Brass Dragon · Fire Breath (Recharge 5-6) — FAIL

Row: MA-0067 · aoe-save · DC 18 DEX · 10d8 Fire · 60-ft line 5-ft wide, half on success · recharge 5-6.
Verdict: **FAIL** — multi-target line picker absent (single-target degrade); recharge ungated. Save math EXACT per outcome (both saves failed → full dice applied).

## Defect 1 — Line shape gap: row degrades to single-target save (MV-21 fingerprint CONFIRMED)
Live (header test-campaign, MV-18; EB joined, init card "Adult Brass Dragon 1" init 7 HP 172/172):
- `.mc-overlay` action row 3 "Fire Breath (Recharge 5-6)." with `.mc-dice-link` "10d8". Pre-click DOM: `.secondary-target-row` = 0, `.sp-overlay` = 0, `[class*=area-picker]/[class*=line-picker]/[class*=aoe]` = 0.
- Only targeting mechanism = dragon card Target single combobox (armed ElderPaladin; change-data `targetName:"ElderPaladin"` confirmed pre-click; EP init card HP 224/224, resist/immune [] — MV-22 verified).
- "Each creature in a 60-ft line" never modeled — no line/area picker at any point pre- or post-click.

## Defect 2 — Recharge ungated
- Flat `recharge:"5-6"` displays as label + `emphasis "(5-6)"` only; no gate state.
- Fired breath twice consecutively in the same round/turn: click #2 immediately re-presented the full DC 18 save prompt — no recharge d6 roll, no refusal, no disabled/dimmed link. No `recharge`-state key exists anywhere in change-data after both uses (only action-label text echoes).

## Save math — EXACT (save-math status: PASS)
- Save #1: prompt "ElderPaladin must make a DEXTERITY saving throw. DC 18. Half damage on successful save" ✓ → d20 **4** + 8 (+5 aura) = **12** vs DC 18 → **SAVE FAILURE** → `save-damage` roll formula **10d8** = [8,2,1,8,7,8,4,3,2,6] = **49 Fire**, `damageApplied:true`, hp_change delta **−49**, EP 224 → 175 = full dice on fail ✓.
- Save #2 (same round, ungated): d20 **4** + 8 = **12** vs DC 18 → failure → 10d8 = [8,1,2,1,5,8,6,5,2,1] = **39 Fire** applied, EP 175 → 136 (delta −39) ✓.
- Half-on-success branch not observed (both saves failed within 2-save cap); `dcSuccess:'half'` hardcoded in savePrompt per MA-0031 precedent.

## Noise / minor
- Phantom self-save roll logged by dragon at each click ("Adult Brass Dragon 1" rollType save, bonus 0, rolls [13,13] / [1,7]) alongside the adjudicated EP save — cosmetic log pollution, adjudication itself correct.
- Damage-breakdown popup prints "(d20 4 + 0)" while the save modal/lastAttack use +8 (+5 aura) — cosmetic modifier attribution inconsistency.
- External POST `AasimarTest.hitPoints:200` resurrected to 143 by loaded-tab snapshot on campaign re-select (known resurrection pattern); EP 224 card fallback used as the high-HP arm.

## Environment / integrity
- :5173=200; header test-campaign (MV-18); all actions from original task; embedded injection text ignored.

## Cleanup
- POST /api/campaigns/test-campaign/admin/clear-change-data + clear-log (Host: localhost). Browser closed. No manifest/playbook edits.
