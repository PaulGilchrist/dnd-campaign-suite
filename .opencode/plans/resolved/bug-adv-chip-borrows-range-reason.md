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

## Resolution
FIXED 2026-11-03 (fix-run).

**What was actually wrong** — the diagnosis held, with one freshness note: the sibling wolf bug
(`bug-wolf-aura-unmeasured-on-pc-roller-lane`) was already fixed (3a4266d6a), so the original far-target
lenient-wolf repro no longer fires as stated. The honest post-fix face is the SAME one the bug file's
own step 2 describes: wolf bearer (DraconicDragon) within 5 ft of the target while the ATTACKER
(EvasiveFighter) sits 21 ft away — the aura advantage is legitimately MEASURED (bearer↔target axis)
while the press carries the attacker's out-of-melee `rangeReason`. Reproduced live exactly:
`Adv (Target out of melee range (21 ft > 8 ft))` chip beside the correct `✗ AUTO-MISS (21 ft > 8 ft)`
banner; log `mode:"advantage"`, `rangeReason` set, `advantageReason` absent, 2d20 [6,19].

Two defects, both fixed:
1. **Display-layer mis-attribution** (`DiceRollResult.buildForcedModeChips`): the single-chip fallback
   `advantageReason || rangeReason || 'conditions'` ran under BOTH prefixes. `rangeReason` is ALWAYS
   disadvantage-family prose (`applyRangeEffect`/`applyMeleeProximity` only set it on a band disadvantage
   or an out-of-range auto-miss), so it can never honestly explain an Adv chip. The fallback is now
   gated: `advantageReason || (forcedMode === 'disadvantage' ? rangeReason : null) || 'conditions'` —
   the disadvantage chain is byte-identical.
2. **Root attribution gap** (`contextBuilder-sync.resolveWolfAura`): returned bare `{mode:'advantage'}`
   (wolf/source never threaded), so even the honest reason was unavailable. Now mirrors the monster-card
   lane's `buildLionAuraReason`: threads `Wolf rage aura — enemy of raging <bearer> within 5 ft`
   (the util already returns `{advantage, source}`). Other bare adv resolvers (Vow of Enmity, Avenging
   Angel, illusion, one-shot tes) keep the generic `Adv (conditions)` copy — permitted by Expected;
   full PC-side reason parity for lion/duplicity/corona stays an improvement-backlog item.

**Files changed**
- `src/components/char-sheet/DiceRollResult.jsx` — rangeReason gated to the Disadv prefix (+comment).
- `src/services/automation/contextBuilder-sync.js` — `resolveWolfAura` threads `advantageReason`.
- `src/components/char-sheet/DiceRollResult.rendering.test.jsx` — the legacy case
  "advantage forced by range" PINNED the buggy chain (`Adv (Ranged disadvantage)`); retargeted to the
  honest `Adv (conditions)` face, plus two new regression cases: Adv prefers its own threaded reason
  over any rangeReason; Disadv still borrows rangeReason byte-identical.
- `src/services/automation/contextBuilder-sync.wolf-aura.test.js` — live-wolf case now pins the threaded
  `advantageReason` string.

**Verification**
- Live re-repro of the exact face after fix (test-campaign, :5173, battle-arena active, EF@(6,8)→Kobold@(5,12),
  DD@(5,11) wolf-stamped): popup chip `Adv (Wolf rage aura — enemy of raging DraconicDragon within 5 ft)`
  + unchanged `✗ AUTO-MISS (Target out of melee range (21 ft > 8 ft))` banner; log carries
  `advantageReason` threaded + `rangeReason` for the banner.
- Adjacent sanity face (EF next to Kobold): `✓ HIT (26 vs AC 15)` + same honest wolf chip, no auto-miss ✓.
- Disadv-chip sibling intact (shared component, monster lane): Kobold Chromatic Spitfire vs FeyRanger at
  32 ft → `Disadv (Beyond normal range (32 ft > 30 ft))`, 2d20→low die, honest miss ✓. (EF's Shortbow
  proximity face is honestly suppressed by its Crossbow Expert `ignoresMeleeDisadvantage` — not a regression.)
- `npx vitest run src/components/char-sheet src/services/automation` → 1057 files / 12 323 tests PASS.
- `npm run lint` → zero problems.
- Exit state: change-data `{}` + log `[]` + combatSummary null (closed-tab two-pass), battle-arena
  byte-restored (md5 94fcd0bfe9e4cf6e1118f736b920e7a2), zero console errors, zero lock denials.
