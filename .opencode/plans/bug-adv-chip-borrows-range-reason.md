# Forced-mode chip prints the range-reason under an "Adv" prefix ("Adv (Target out of melee range…)")

## Summary
When a PC attack is forced to Advantage by an aura (no `advantageReason` threaded) AND the same press carries a range `rangeReason` (out-of-melee auto-miss or long-range band), the popup's forced-mode chip renders `Adv (Target out of melee range (21 ft > 8 ft))` — attributing a *disadvantage-family* range fact as the reason for *advantage*. Misleading adjudication copy on the GM's primary attribution surface.

## Steps to reproduce
1. In test-campaign with `battle-arena` active and positioned tokens, place an NPC token (e.g. Winged Kobold) **more than 8 ft** from a player attacker but within the map (any weapon-reach-exceeding distance, e.g. attacker (6,8), target (5,12) → 21 ft).
2. Give the attacker an armed target on that NPC (initiative row `[data-testid="target-select"]`) and stamp ANY party wolf-bearer advantage source that doesn't set an `advantageReason` (e.g. `POST /api/campaigns/test-campaign/DraconicDragon` `{"value":{"activeConditions":[],"activeBuffs":[{"name":"Rage of the Wilds","effect":"power_of_wilds_option","optionName":"Wolf","range":"5 ft"}]}}` with the target within 5 ft of the bearer; or use any sync-resolver advantage source per `contextBuilder-sync.js:526`).
3. On the character sheet press the weapon's to-hit cell.
4. OBSERVE popup: banner correctly reads `✗ AUTO-MISS (Target out of melee range (21 ft > 8 ft))` **and** the badge reads `Adv (Target out of melee range (21 ft > 8 ft))` — the range miss text printed as the advantage reason.

## Expected behavior
The Adv chip should print the advantage's own reason (e.g. `Adv (Wolf rage aura — …)`) or the generic `Adv (conditions)`, never a range-miss string. The range reason belongs to the AUTO-MISS banner / Disadv chip only.

## Actual behavior
Badge text = `Adv (Target out of melee range (21 ft > 8 ft))` while the same popup's banner separately prints the AUTO-MISS. Log truth this run: `mode:"advantage"`, `rangeReason:"Target out of melee range (21 ft > 8 ft)"`, `advantageReason:null` — reproduced twice (both out-of-range re-presses), zero console errors.

## Likely location
`src/components/char-sheet/DiceRollResult.jsx` → `buildForcedModeChips()` (added by d85d2d099). The single-chip fallback is `advantageReason || rangeReason || 'conditions'` under `prefix = forcedMode==='advantage' ? 'Adv' : 'Disadv'` — when an aura advantage lands without an `advantageReason` (all four sync resolvers in `contextBuilder-sync.js` return `{mode}` only, no reason) and `rangeReason` is set, the range string rides the Adv prefix. Secondary contributor: aura resolvers never thread `advantageReason` text (wolf/lion/duplicity/corona all `{mode:'advantage'}` bare), unlike the new `buildLionAuraReason` used on the monster-card lane.

## Suggested fix
In `buildForcedModeChips`, only fall back to `rangeReason` when `forcedMode === 'disadvantage' || isAutoMiss`; for `advantage` use `advantageReason || 'conditions'`. Better, mirror the monster-card lane: have PC-lane aura resolvers thread a reason string (e.g. `Wolf rage aura — enemy of raging <bearer> within 5 ft`) so the chip is honest in both directions. Note the sibling wolf bug (`bug-wolf-aura-unmeasured-on-pc-roller-lane.md`) is the reason a far-target press had advantage at all — fix that first or this chip face only narrows.

## Severity
Minor UX issue — wrong adjudication prose; no numeric effect (the d20 mode itself is correct per its inputs).
