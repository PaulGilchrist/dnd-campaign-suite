# BUG CLA-038 — Blessed Healer (2024 Life Cleric lv6) — FAIL

Date: 2026-10-03 · Host: test-campaign · Divine_Cleric lv17 Life 2024 (139 HP), EvasiveFighter, FeyRanger, Wild_Sage_Druid lv20 control.

## Data (correct)
public/data/2024/classes.json Cleric→Life Domain features[2]:
"when you cast a healing spell targeting one or more creatures other than yourself, you restore hit points equal to 2 + spell slot level", level 6, automation { type:post_cast_self_heal, healExpression:"2 + spell_slot_level", othersOnly:true, casting_time:passive } — matches manifest byte-for-byte.

## What WORKS (live-exact evidence, /log + /change-data)
- Leg A lv1 Cure Wounds on EF: EF Δ+22 (2d8 max +3 +3 DoL), then hp_change Divine_Cleric Δ+3 sourceName "Blessed Healer" (130→133) = 2+1 EXACT. lv1 slot 4→3.
- Leg B lv2 upcast: EF Δ+39 (4d8 max+3+4 DoL), BH Δ+4 = 2+2 EXACT (133→137), lv2 3→2 — upcast slotLevel threading LIVE (useConfirmableFlow.js:22-23 CLA-086 fix holds).
- Leg D control: Wild_Sage_Druid lv1 Cure Wounds EF Δ+15 (dice 6,6 non-maximized) — ZERO Blessed Healer entry (druid lacks the passive).
- Single regen per cast (one BH entry per casting, loop over passives not targets).

## DEFECT 1 — Target-identity check missing → self-targeted heal grants regen (RAW violation)
postCastHealService.js:73 `if (heal.othersOnly && spell.range === 'Self') return 0;` guards RANGE only.
Cure Wounds range = 'Touch' (2024 spells.json), Healing Word = '60 feet' → self-targeting cast passes the guard, BH fires.
LIVE proof (headroom crafted): DC dropped 100 → self lv1 Cure Wounds hp_change Δ+25 cur:125 → IMMEDIATELY hp_change Δ+3 sourceName "Blessed Healer" cur:128/139. RAW expected exactly 125, no BH entry. Two earlier self-casts at cap logged BH Δ0 entries (trigger fired, clamped) — same mechanism.
Fix: consumer needs target identity — compare resolved target name(s) to playerStats.name; regen ONLY when ≥1 target ≠ caster (metaCtx.targetName / picker selection already available at call sites execution/index.js:450/:486; multi-target lanes pass arrays).

## DEFECT 2 — Multi-target heal lane never triggers Blessed Healer
Mass Cure Wounds lv5 cast live: picker "Cure (2)", results EF Δ+8 (cap to 94), FeyRanger Δ+0 (full), lv5 slot 2→1, logs per-target hp_change x2 — but ZERO Blessed Healer entry, caster stayed 128/139 (expected Δ+7 = 2+5 once per cast).
Code confirmation: grep triggerPostCastSelfHeals in src/services/rules/features/massCureWoundsService.js, src/services/automation/handlers/healing/massCureWoundsHandler.js, MassCureWoundsModal.jsx = ZERO. MCW resolves through the mass-heal modal lane which bypasses runGenericHealPath/runPostCastTriggers entirely → post-cast self-heal consumer never invoked.
Fix: call triggerPostCastSelfHeals (or equivalent with others-target check) post multi-target heal resolution when healed targets ≠ caster.

## Cosmetic (cite existing families, not filed here)
- Caster-side spell log stamp spellLevel:1 on the lv2 cast (CLA-086/SP-111/SP-127 makePending-stamp family).
- Spell log targetName defaults to active-init character / allTargets (SP-127 family).

## Verdict
FAIL — core clause "targets one or more creatures other than yourself" is broken both directions: self-only casts DO grant regen (numeric +3 proven) and multi-target others-casts grant NOTHING (missing +7). Single-target-other math (lv1=3, lv2=4) is exact once the caster is wounded, so the fold/expression engine itself is sound — the defect is in target-set adjudication (Defect 1) and lane coverage (Defect 2).

## Cleanup
Admin cleared change-data {} + log [] post-test (native Admin UI confirms + GET-verified); all HP restored to sheet maxes via re-seed.
