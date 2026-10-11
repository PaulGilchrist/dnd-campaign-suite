# BUG MA-1878 — Demogorgon Gaze (actions[2]) — FAIL(a) choose-or-roll-d6 branch never adjudicates

## Row
MA-1878 / Demogorgon / actions[2] "Gaze" / aoe-save / DC 23 Wisdom / branches: 1-2 Stunned, 3-4 Confusion spell, 5-6 Charmed / "No damage."

## Verdict: FAIL(a) — DC 23 WIS enforced honestly, but failed save grants ZERO condition, ZERO d6 branch roll, ZERO Confusion te (MA-1855 stranded-save-shell twin + MA-0575 random-branch zero transport)

## Live evidence (:80 dist, test-campaign, 2026-10-11)
Rig: EB join Demogorgon 1 (init 10, AC22, HP464) + Bandit 1 (init 17, AC12, seed 999/999 full-store cs POST, saveBonuses.wis 0 ⇒ structurally always fails DC 23). Victim ElderPaladin left untouched.

- Chip: "DC 23 Wisdom" `mc-dice-link-save mc-dice-link-save-clickable` on `.mc-action` strong "Gaze." — LIVE, first-click fires ×3 (no absorb). Decoy audit: legendary Gaze row carries sibling "Expend Legendary" chip — scoped out; Spellcasting row also authors save_dc 23 Wisdom but rendered zero chips this session (MA-1850 watch clean).
- NEW SHAPE FINGERPRINT: press opens SaveAttackAoeModal **titled "60-ft Line (GM positions tokens; selection advisory)"** though row authors NO range — `breathAoeShape` MonsterCardModal.jsx:150 prose scrape `/\bline\b/i` matches "no longer within line of sight" in the Gaze description → fabricated Line shape; feet-token regex requires full word "foot|feet" and the row says "120 ft" → token list empty → `Line` default 60 (MA-1436 :139-141 misread fingerprint re-confirmed on a new row; RAW is 120 ft single-target sighted save).
- FAIL legs ×2 (Bandit): picker confirm "Gaze (1)" → results modal "Bandit 1: Failed the save (rolled 10)" / "(rolled 7)" — nat verdict honest vs DC 23. Close → log delta = `ability_use` "Gaze: Selecting 1 target(s) for save (DC 23 Wisdom)" ONLY: zero save_result entry, zero `roll damage`, zero hp_change (999/999 intact), zero condition applied, `change-data['Bandit 1']` absent (no activeConditions/meta), top-level targetEffects null, lastAttack null, **zero d6 branch rolls app-wide** (whole-log d6 audit []), zero confusion te.
- SUCCESS leg (rig: full-word cs `saveBonuses.wisdom:23` POST — picker computeNpcSave honors full-word keys §160): nat 3 + 23 = 26 ≥ 23 → "Saved — takes no damage (rolled 3)". RAW success = no effect: app matches — vacuously correct ("no damage" boilerplate is half-branch prose).
- No damage on any leg ✓ (row authors none, RAW none) — no FAIL on damage axis.
- Refire ungated ×3 — RAW-correct (Gaze has no usage limit; no usage fields authored, none required).
- Console: ZERO row-related errors (only pre-existing findFeat sheet-mount noise) → chip NOT inert → FAIL(a) not FAIL(b).

## Root cause (disk + code)
Row authors only `save_dc`/`save_type`/`description`:
1. BRANCH TABLE prose-only: no `variants[]` → `parseSaveVariantChooser` (MonsterCardHelpers.js:310, MA-1436) returns null; no `rays[]` → eye-ray picker lane inert; no choose-or-roll-d6 save-row parser exists app-wide (§107 MA-0575 random-condition rider zero transport; MA-0855 hit_choice is attack-path only).
2. CONDITION: save lane grants ONLY from `saveConditions` = `extractConditionsFromSaveEffect(action.save_effect)` (Modal buildSaveOptions:1197 / :2454); row has no `save_effect` → saveConditions [] → `applyFailedSaveConditions`/`applyDamagelessSaveConditions` (saveProcessing) grant nothing (MA-1868 CONFIRMED lane, byte-inert without key; MA-1855 stranded-shell twin).
3. CONFUSION te registered (targetEffectDefinitions.js:582, consumers turnStartEffects/ConditionEffectBadges/createRollConditionSaveHandler) but sole producers are PC Confusion spell (spellGates:829) — no monster-save-lane Confusion producer.

## Suggested fix
DATA (minimum, sanctioned MA-1436 template): author `variants:[{key:"beguiling",label:"Beguiling Gaze (1-2)",conditions:["stunned"],duration_note:"until start of demogorgon's next turn or until out of line of sight"},{key:"confusing",label:"Confusing Gaze (3-4)",te:"confusion",duration_note:"until start of demogorgon's next turn"},{key:"hypnotic",label:"Hypnotic Gaze (5-6)",conditions:["charmed"],duration_note:"until start of demogorgon's next turn; GM directs Action/Reaction/movement (GM-enforced)"}]` + range "120 ft." to kill the fabricated 60-ft Line shape. Random-d6 auto-pick OR GM chooser press — chooser ships live; d6 auto-roll needs the MA-0575 chooser-producer extension (ticket owed). `confusion` te grant needs a save-lane producer mapping variant te→targetEffects (MA-0595 zoneTe precedent).

## Cleanup
Admin clear-change-data + clear-log API-verified (cd base-cs-only, log []); cs restored {round:1,creatures:[]} per §9 wipe-recovery; NPCs off board; server 200; header test-campaign throughout.
