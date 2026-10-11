# BUG MA-1881 — Demogorgon Legendary Gaze (legendary_actions[1], delegates_to "Gaze") — FAIL(a) delegation live, choose-or-roll-d6 branch never adjudicates (MA-1878 dead-branch lane inherited)

## Row
MA-1881 / Demogorgon / legendary_actions[1] "Gaze" / other / delegates_to:"Gaze" / "The demogorgon uses Gaze, choosing Beguiling Gaze or Confusing Gaze."

## Verdict: FAIL(a) — legendary economy + delegation + DC 23 WIS adjudication all LIVE and honest, but failed save grants ZERO condition, ZERO d6 branch roll, ZERO confusion te — byte-twin of MA-1878 (parent Gaze strand). NOT FAIL(b): chip fires, picker opens, verdicts roll, spends log.

## Live evidence (:80 dist, test-campaign, 2026-10-11)
Rig: EB join Demogorgon 1 (init 6, AC22, HP464) + Bandit 1 (init 20, AC12, seed 999/999 full-store cs POST, saveBonuses.wis 0 ⇒ deterministic FAIL lane). Own-card select armed cs.targetName=Bandit 1 (anchor img[alt="Demogorgon 1"] — text-anchor grabs Bandit card whose options list Demogorgon).

- STATIC: LA rows [0] header uses:2 ✓, [1] Gaze delegates_to:"Gaze" NO own choose/branch fields (no save_dc/variants[]/save_effect on child); parent actions[2] Gaze {save_dc:23, save_type:"Wisdom"} prose-only d6 branch table — MA-1878 documented zero transport.
- Chip census: child LA chip "Expend Legendary" `.mc-dice-link mc-dice-link-legendary` (no -clickable suffix); row "Gaze." strong collides main-row5 vs LA-row8 — nth(8) scope required.
- PRESS #1 (fail face, Bandit wis+0): gate allowed after AasimarTest turn — chip LIVE opens SaveAttackAoeModal titled "60-ft Line (GM positions tokens; selection advisory)" (fabricated-shape fingerprint: breathAoeShape /\bline\b/ scrape of "line of sight" prose, feet-token regex misses "120 ft" → default 60 — MA-1878 byte-twin); picker prose "On a failed save, target takes null null damage" NEW cosmetic null numerics on delegate lane (parent authors no damage). Confirm "Gaze (1)" → results "Bandit 1: Failed the save (rolled 11)" honest nat-vs-DC23. Close → log: ability_use "expends a legendary use for Gaze (Gaze save) after AasimarTest's turn — 1 of 2 left" + ability_use "Gaze: Selecting 1 target(s) for save (DC 23 Wisdom)". Post: change-data has NO 'Bandit 1' entry, targetEffects null, lastAttack null, saveResult keys [], Bandit hp 999 intact, zero condition applied, whole-log d6 roll audit ZERO, zero confusion te — STRANDED EXACTLY LIKE MA-1878.
- LA ECONOMY HONEST: monsterLegendaryUses {max:2, used:2} after 2 fires; UI "(2 left)→(1 left)→(0 left)"; same-window re-press refused "legendary_use_refused (turn) — zero spend, no roll" ×2 (1-per-turn latch, counter unmoved on refusals); press #2 logged "after AberrantSorcerer's turn — 0 of 2 left" — boundary-keyed latch real.
- PRESS #2 (success face, rig full-word cs saveBonuses.wisdom:23 §160): after reload+re-select unstick (see pitfalls), gate allowed; results "Bandit 1: Saved — takes no damage (rolled 20)" (nat20+23=43≥23) — RAW success = no effect, vacuously correct, zero state either way.
- Ungated extra-fire NO (turn-latch enforces 1/turn); exhaustion refusal not tested (stopped at 0-left honest). Console: no row-related errors → not FAIL(b).

## Root cause (disk + code) — inherited from MA-1878
Child delegates_to:"Gaze" resolves to parent actions[2] and rides the SAME dead lane:
1. Branch table prose-only, no variants[] → parseSaveVariantChooser null; no rays[]; no choose-or-roll-d6 save-row parser app-wide (§107/MA-0575; MA-0855 hit_choice attack-path only).
2. No save_effect on parent → saveConditions [] → applyFailedSaveConditions/applyDamagelessSaveConditions grant nothing (MA-1868 byte-inert-without-key lane).
3. `confusion` te registered but zero monster-save-lane producer (spellGates PC-only).

## Suggested fix
Fix rides MA-1878's suggested DATA patch (parent Gaze variants[] MA-1436 template + range "120 ft." + confusion-te save-lane producer) — legendary child needs NO own fix once parent lane is live; delegation already resolves and spends honestly.

## NEW pitfalls (this row)
- Legendary "turn" refusal latch reads CLIENT runtime activeCreatureName which FREEZES after initiative-Next (cs mirror freeze §100/§113) → legitimate post-boundary re-press refuses "(turn)"; reliable unstick = RELOAD + re-select (re-seeds runtime from change-data truth), then press works ("after AberrantSorcerer's turn").
- Refusal popup backdrop click ABSENT-dismiss absorbed; needs its "Done" button click.
- Delegate-lane picker prose prints "takes null null damage" — cosmetic null numeric fingerprint when parent row has no damage fields.
- Press fires TWO ability_use entries (expend "Gaze (Gaze save)" + lane "Gaze"); refusals log automation/legendary_use_refused only — count by log not popups (replay-cache).

## Cleanup
Admin clear-change-data + clear-log API-verified; cs restored {round:1,creatures:[]}; server 200; header test-campaign throughout.
