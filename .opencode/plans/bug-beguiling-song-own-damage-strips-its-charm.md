# Bug: Beguiling Song's own damage strips the Charmed it just granted — the authored effect can never persist

## Summary

Performer Maestro's **Beguiling Song** (Humanoid; failed WIS save → 3d10+4 psychic damage **and** Charmed until the performer's next turn) applies the Charmed condition during save resolution and then, milliseconds later, the SAME effect's damage application strips it via the engine-wide "Charmed ends on damage" law. Net observable: the ability's condition clause NEVER lands (0/2 rides, apply→remove delta ~3 ms), plus the strip lane leaves an orphan `activeConditionMeta.charmed` row behind. Any damage-bearing "fail save → damaged AND charmed" row in the bestiary self-cannibalizes the same way.

## Steps to reproduce

1. `test-campaign`, dev pair :80/:5173, GM tab. Pre-select seed the victim (guarantees a failed save and isolates the PFEG gate):
   `POST /api/campaigns/test-campaign/Wild_Sage_Druid` `{"value":{"activeBuffs":[{"name":"Protection from Evil and Good","effect":"protection_from_evil_and_good"},{"effect":"warding_bond","saveBonus":-30}],"protectionFromEvilAndGoodWardedTypes":["Aberration","Celestial","Elemental","Fey","Fiend","Undead"],"activeConditions":["cursed","poisoned"],"hitPoints":200,"currentHitPoints":200}}`
2. Select campaign → Encounters → search `Performer Maestro` → tick `input.monster-checkbox[aria-label="Select Performer Maestro"]` → Join Encounter → Initiative.
3. Open the Maestro's card (`img.avatar-image[alt="Performer Maestro"]`), arm `[data-testid="target-select"]` = `Wild_Sage_Druid`, press the Beguiling Song `[data-kind="save"]` chip (`3d10 + 4`).
4. In the AoE picker tick ONLY `Wild_Sage_Druid`, confirm `Beguiling Song (1)`.
5. Resolve the `.sp-modal` prompt → Roll Save → drain Done/Close popups.
6. GET `/api/campaigns/test-campaign/log` → observe the pair `condition applied Charmed` then `condition removed Charmed, reason "took damage (Friends)"` before/around the `hp_change` row. GET change-data → `Wild_Sage_Druid.activeConditions` never contains `charmed` (stays `["cursed","poisoned"]`), while `activeConditionMeta` retains a stale `charmed: {dc:15, ability:"wis", source:"Performer Maestro"}` row.

Reproduced 2/2 (second press byte-identical pair). Control witnesses in the same session: Lamia's `cursed`/`poisoned` SURVIVED their own save-damage (the damage strip only targets frightened/charmed), and the Fiend charm lanes were separately blocked by the ward with an `automation blocked` row — so the Maestro lane is honestly ungated at the ward (correct for Humanoid) and dies only in the damage phase.

## Expected behavior

The condition granted by a failed save of a "damage AND charmed" effect must not be stripped by that same effect's damage component. Per the row's authored prose, Charmed lasts "until the end of the performer's next turn"; the app's own Charmed-ends-on-damage law (#27 §39 canon) is meant for LATER damage, not the damage clause of the very effect that establishes the charm. At minimum the strip must exempt the condition granted within the same resolution (a same-source/same-event guard), or the grant must be sequenced after the damage application.

## Actual behavior

Log order every press: `roll save-dailure` → `roll damage 22` → `condition applied Charmed` → `condition removed Charmed (reason: took damage (Friends))` → `hp_change −22`. `activeConditions` never observably contains `charmed`; the badge never mounts; the "until end of next turn" clause is inert by construction. Orphan `activeConditionMeta.charmed` row left behind (no meta cleanup in `removeConditionFromList`), a data-hygiene divergence from the initiative-seam fix which explicitly merges condition+meta purges.

## Likely location

Confident on the two lanes; guessing on the seam owner:
- `src/services/rules/combat/applyDamage.js` → `removeCombatConditionsOnDamage` (line ~571) / `removeConditionFromList` (line ~548): unconditional charmed strip on any damage, no "damage belongs to the effect that just granted the charm" exemption; also logs removal without touching `activeConditionMeta`.
- The save-resolution grant lane (`hooks/combat/saveProcessing.js` `applyFailedSaveConditions` path used by the monster AoE picker) runs the condition grant BEFORE `applyDamage` executes the same row's damage clause — the ordering that makes the strip fire on its own grant.

## Suggested fix

First read how the AoE save-result lane sequences grants vs damage (grep `applyFailedSaveConditions` callers + `dcSuccess` damage application in the monster save pipeline). Cheapest robust option: when a failed-save grant adds `charmed` as part of resolving effect E, stamp a short-lived per-target marker (e.g. `charmGrantContext = {source, abilityName}` carried into the immediately-following `applyDamage` call or the store), and have `removeCombatConditionsOnDamage` skip the strip when the damage event's attacker+ability matches the just-granted charm's source+ability. Secondarily: `removeConditionFromList` should purge the matching `activeConditionMeta[key]` row so removed conditions never orphan meta (mirror the initiative-seam "one merged conditions+meta write" idiom from `clearAllExpirationEffects`).

## Severity

Broken feature — a shared-bestiary monster's signature save effect can never apply its authored condition (any tab, any campaign using Performer Maestro or any damage+charm row); plus minor data-integrity residue (orphan meta rows). Not merely UX: the ability's non-damage clause is inert.
