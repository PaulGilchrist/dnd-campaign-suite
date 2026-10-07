# BUG CLA-211 Leading Evasion — chooser selection inert; share auto-applied to ALL same-save creatures (over-grant)

**Date:** 2026-10-06 | **Host:** HeroesFeastBard lv20 Bard / **College of Dance** (disk-confirmed; Leading Evasion = classes.json 2024 Bard majors[0].features[3] lv14, automation `{type:"evasion", saveType:"DEX", shareable:true, shareRange:5}`) — host qualifies as-is, no subclass edit made.
**Verdict:** FAIL (b) — numeric over-grant to unselected creatures; share selection mechanically inert.

## Live evidence (test-campaign, Behir 1 Lightning Breath DC16 DEX 12d10, prompt lane SavePromptModal, per-victim 12d10 re-roll model)
| Target | Role (per GM chooser) | Save | Raw | Final | Ledger name | Expected | Result |
|---|---|---|---|---|---|---|---|
| HeroesFeastBard | holder | 7+9=16 vs 16 SUCCESS | 68 | **0** | Evasion | 0 | ✅ exact |
| HexWarlock | **ticked** sharee | 7+−1=6 vs 16 FAIL | 60 | **30** | Leading Evasion | floor(60/2)=30 | ✅ exact |
| ElderPaladin | control — NOT ticked | 6+3+5aura=14 vs 16 FAIL | 66 | **33** | Leading Evasion | **FULL 66** | ❌ half granted |
| FeyRanger | control — chooser **SKIPPED** | 17+8=25 vs 16 SUCCESS | 76 | **0** | Leading Evasion | **half 38** | ❌ zero granted |

hp_change machine truth: ElderPaladin −33 (224→191), HexWarlock −30 (103→73), Bard 163±0.
Chooser UI fired correctly ("Leading Evasion — Choose Allies", per-prompt, "Apply Evasion (1)", "Skip") — but Skip cleared only `selectedAlliesRef` (SavePromptModal.jsx:818) and adjudication folded anyway.

## Root cause (grep-grounded)
Selection lives ONLY in client-local `selectedAlliesRef` (SavePromptModal.jsx:729, consumed at :780 → computeHasEvasion :262 for the verdict note). NO producer stamps the chosen set into runtime/cs/te (grep `selectedAllies` zero server-side consumers). Every damage-adjudication resolver independently re-derives shared evasion by pure presence of any shareable holder:
- `saveProcessing.resolveSaveEvasion` :336-340 `(characters).some(c => c≠target && ev.shareable && shareRange>=5)`
- `evasionUtils.resolveAoESaveEvasion` :46-47 (CLA-124/125-fixed picker lane) — same selector-agnostic shape
- `useLoggedDiceRollEventHandlers.determineEvasion` :44-49 — `detail.evasionActive ?? (own||shared)`; with false/undefined detail flag the `||shared` fallback folds.
Consequence: once the Bard is in the fight, EVERY non-holder DC16 Dex half-save target silently gets Evasion math and a "Leading Evasion" ledger entry, whether shared or not. Controls cannot pay full-on-fail anywhere.

## Holder-fail face
Not live this session (Bard succeeded; honest dice, no rigs). Prior run 2026-08-29 (registry) logged Bard fail→floor(57/2)=28 "Evasion"; `computeDamageAfterEvasion` (applyDamage.js:124-127) fail→floor(raw/2) is the same function that produced the live 30/33 halves — structurally identical, judged OK.

## Fix shape
Per-save share selection must be persisted at chooser-confirm (runtime stamp keyed by savePromptId/target set, e.g. `sharedEvasionTargets-<promptId>` or te on selected allies only) and consumed by all three resolvers instead of the blanket `some(shareable)` presence check; unselected targets must fall through to `computeDamageAfterSave` (full on fail / half on success, no evasion ledger). Incapacitated exemption + CoP ordering preserved (evasionUtils:41 gate mirror).

## Repro recipe
EB Join Behir + Bard + ≥2 no-evasion PCs → Behir turn → `.mc-overlay` span.mc-dice-link-save "DC 16 Dexterity" → area picker tick targets → chooser ticks ONE ally → Roll others (control) → watch ledger: controls fold. Skip on chooser → fold persists (selection inert).
Pitfalls: recharge 5-6 blocks refire (walk ~rounds; loaded tab keeps client stale-spent chip after server recharged — hard reload only); prompt-lane dice are honest (no ±N cs rig folding there, §209 inline-only); death-save/old Results popups stale-stack behind monster modal (§SP-023).
