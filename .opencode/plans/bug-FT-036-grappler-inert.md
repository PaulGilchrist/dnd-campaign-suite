# FT-036 Grappler — FAIL(b): inert feat, no same-hit damage+grapple automation

## Title
FT-036 Grappler (2024 General Feat) — Punch and Grab benefit has zero automation consumers; unarmed-strike hit is damage-only (or zero-delta), identical to a non-Grappler strike.

## Overview
The feat's distinguishing RAW benefit — "When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can use both the Damage and the Grapple option. You can use this benefit only once per turn." — is not implemented anywhere in the combat pipeline. `public/data/2024/feats.json` Grappler row carries `automation: null`, so no chip, no router dispatch, no handler, no once-per-turn gate, and no feat-specific log exists. Granting Grappler to a PC changes nothing observable: the same unarmed-strike hit produces zero delta versus a non-Grappler strike. The only Grappler code path in the app is a partial, separately-gated implementation of the *Attack Advantage* sub-benefit (`countGrapplerAdvantage`, src/services/automation/contextBuilder-sync.js:202), which is not the adjudicated benefit and itself depends on a `saveModifiers` marker that nothing auto-generates from the feat (feat has `automation:null`).

## Expected Behavior (canonical app-data wording, feats.json:1286)
"When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can use both the Damage and the Grapple option. You can use this benefit only once per turn."

Plus (feats.json benefits[]): Attack Advantage — "You have Advantage on attack rolls against a creature Grappled by you"; Fast Wrestler — movement clause.

## Actual Behavior
- Source grep (2026-10-05, `rg -n 'Grappler' src server`): the ONLY consumers are `countGrapplerAdvantage` (contextBuilder-sync.js:202, gated on `playerStats.saveModifiers` containing an attack_roll modifier — never populated from feats.json because automation:null) and descriptive strings in effectDescriptions.js. There is **no** consumer that applies Grappled on an unarmed-strike hit; no once-per-turn counter; no `ability_use`/`automation` Grappler log.
- Manifest paths are STALE: `src/services/combat/automation/handlers/featHandler.js`, `routers/featRouter.js`, `infoBuilders/featInfoBuilder.js` do not exist.
- LIVE (test-campaign, Playwright E2E):
  - Granted Grappler via Edit wizard Step 4 Feats to **ElderPaladin** (lv20 STR 20) and **Disciplined_Monk** (lv20 STR 17); disk GET confirms `feats[]` includes "Grappler" (both), `featAbilityChoices` auto-homed `Grappler-1: Strength`.
  - Sheet renders "Punch and Grab:" / "Fast Wrestler:" as static Special Actions prose. Clicking "Punch and Grab:" produces **zero affordance** — no overlay/modal/popup, no log entry, no change-data key (targetEffects `null`).
  - Arm `targetName:"Bandit 1"` on the feat-holder Monk's initiative card select (confirmed persisted), clicked the Unarmed Strike action row: popup logs `roll/attack "Unarmed Strike" rolls:[16,13] total:16 bonus:11 → ✓ HIT (27 vs AC 12)`. Clicked Done (`dice-roll-reroll-btn`).
  - Machine truth after 12s debounce: Bandit 1 `currentHp 11/11` **unchanged**, `activeConditions: null`, campaign `targetEffects: null`, change-data has **zero** attack/grapple/feat keys, campaign log contains **no** `ability_use`, `automation`, `condition applied`, or `hp_change` entries for this feat-holder's hit (log total = 3 entries: encounter joined, Bandit initiative roll, the Monk attack roll).
- Control probe: a non-Grappler strike lane is **identical** — no grapple telemetry exists for any unarmed strike, so holder vs non-holder delta is exactly zero (same popup shape, same roll-only log, same absence of Grappled). Per-victim absence of any change-data key (§1116 discriminator) is the strongest zero-grant proof: `applyHitClauseConditions`/grapple machinery never runs for this feat.
- Note: BA-002 Grapple is a **separate base action** (contested STR, its own bug-BA-002 contest-math problem). Completing the feat via "attack, then Grapple action" is manual two-action realization, NOT the feat's single-hit both-effect, and does not count as implementation.

## Steps to Reproduce
1. localhost:5173 → select **test-campaign**.
2. Characters → Disciplined_Monk → Edit → Step 4: Feats → tick Grappler → ✓Save (disk: `/api/campaigns/test-campaign/Disciplined_Monk.json` feats[] gains "Grappler").
3. Encounters → search "Bandit" → tick row → Join Encounter (Bandit 1 joins initiative).
4. Initiative → arm target select on Disciplined_Monk's card = "Bandit 1".
5. Characters → Disciplined_Monk sheet → click "Unarmed Strike" action row → popup ✓ HIT → Done.
6. Observe: Bandit 1 stays 11/11, `activeConditions null`, `targetEffects null`, log has only the `roll/attack` entry; clicking the "Punch and Grab:" prose row opens nothing.

## Likely Location
- `public/data/2024/feats.json` (Grappler row, automation:null) — needs `automation` metadata (e.g. `hit_conditions:["grappled"]`-style unarmed-attack lane) analogous to MA-0909/MA-0930 grapple fixes.
- `src/services/rules/core/attackWeaponUtils.js:100` `buildFallbackUnarmedAttacks` / `src/services/rules/core/attackCalc2024.js:328` — unarmed-attack rows carry no feat hook; also note unarmed rows render ONLY when no weapon produces attacks (fallback-only), so armed PCs (ElderPaladin, Longsword) never see an Unarmed Strike row at all.
- `src/services/combat/steps/attackRollPostDamage.js` / `src/hooks/combat/handlers/handlePlainDamage.js` — home of on-hit condition application (`hit_conditions`), currently unreferenced by any Grappler data.
- `src/services/automation/contextBuilder-sync.js:202` — partial Attack Advantage sub-benefit, gated on saveModifiers marker never generated by the feat.
- Manifest paths (`featHandler.js`, `featRouter.js`, `featInfoBuilder.js`) are stale — files do not exist.

## Notes
- Also observed on this build: clicking popup Done after the HIT popup did not commit HP damage either (Bandit 11/11 post-debounce) — consistent with §1247 "unarmed press → popup cosmetic HIT, zero damage" hazards; regardless, the adjudicated feat benefit (Grappled applied by the same hit) is absent in every reading, and its absence is architectural (no consumer), not timing.
- Fix candidates: author `automation` on the Grappler row consumed at the on-hit stage, with a once-per-turn flag in the attack context; wire unarmed-strike availability independent of weapon fallback.
