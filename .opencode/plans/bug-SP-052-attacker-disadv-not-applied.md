# BUG SP-052 — Foresight: attacker Disadvantage lane not applied to PC attack rolls; cast-target radio locked

## Title
SP-052 Foresight — target self-advantage works (mode:advantage) but other creatures attacking the foresighted target roll mode:normal; spell-target radio cannot be changed off Bandit 1.

## Overview
Foresight (2024 lv9, touch, 8h, no concentration) casts via the sheet spell panel and applies its targetEffects (verified live). The foresighted creature's own d20 tests correctly roll `mode:"advantage"`. However, a non-foresighted PC (ElfTest) attacking the foresighted target (Bandit 1) logs `mode:"normal"` — the attacker-disadvantage rule was not applied in the observed PC attack roll path, despite the "Disadv vs" badge being present on the target card. Additionally, the cast-target radio list locks to the first initiative combatant (Bandit 1), making the canonical "willing ally" scenario impossible to select.

## Expected Behavior (canonical app-data wording, public/data/2024/spells.json)
"You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target has Advantage on D20 Tests, and other creatures have Disadvantage on attack rolls against it. The spell ends early if you cast it again."

## Actual Behavior
- Cast path: Foresight detail panel → "Cast Spell" → radio list → "Cast Foresight" → spell log + automation popup ("Bandit 1 has Advantage on D20 Tests … for 8 hours") ✔
- te store: Bandit 1 card shows badges `Adv` ("Advantage on attack rolls (Foresight, DivinationWizard)"), `Adv Save`, `Adv Check`, `Disadv vs` ("Attackers have disadvantage on attack rolls against this creature") ✔
- Foresighted target's own roll: `{"c":"Bandit 1","t":"ElfTest","mode":"advantage","rolls":[17,16],"total":17,"name":"Scimitar"}` ✔
- OTHER creature attacking foresighted target (FAIL): `{"c":"ElfTest","t":"Bandit 1","mode":"normal","rolls":[5,15],"total":5,"name":"Unarmed Strike"}` — expected `mode:"disadvantage"`. ElfTest has no Blindsight/Truesight.
- Not concentration: no concentration set on caster/target (Bandit 1 concentration:null in combatSummary; handler writes no concentration key) ✔
- Target selection (FAIL): in the Foresight cast radio panel, clicking the ElfTest radio twice leaves `checked: "Bandit 1"`; the cast logged `targetName:"Bandit 1"` both times. Could not cast on a willing ally.

## Steps to Reproduce
1. test-campaign, localhost:5173, GM. Join Bandit via Encounters → search "Bandit" → tick → Join Encounter (Bandit 1 at initiative 6).
2. DivinationWizard sheet → Spells → Foresight (lv9, prepared) → Cast Spell → try selecting ElfTest radio → it snaps back to Bandit 1 → Cast Foresight (logs target Bandit 1).
3. Initiative page → ElfTest armed on Bandit 1 (combatSummary `ElfTest->Bandit 1`) → ElfTest sheet → Actions → Unarmed Strike → roll popup → Done.
4. GET /api/campaigns/test-campaign/log → last roll: `characterName:ElfTest, targetName:Bandit 1, mode:"normal"` — no forced disadvantage.

## Likely Location
- `src/services/automation/contextBuilder-sync.js:504-513` `hasBlurOrForesightWithoutCounter` + `:684-686` (`dis++` when te foresight on target) — the `dis` counter is returned but evidently not converted into forced `mode:"disadvantage"` for this roll path (PC sheet Unarmed Strike popup, which offers manual "Advantage / Disadvantage" toggle buttons).
- `src/services/rules/features/foresightService.js` — te write side is correct (te 'foresight' + advantage_attacks/saves/abilities, 8_hours, source caster); no concentration written (correct).
- Cast-target radio component (spell target selection on character sheet, `spell-popup-parent` flow in `src/hooks/combat/useSpellMetamagicFlow/` — `runForesight` reads `result[0] || pending.creatureTargets[0]`): radio click does not update selection state (stays first combatant).
- Manifest paths in mission row are STALE: real files are `src/services/automation/handlers/spells/foresightHandler.js` (not `src/services/combat/automation/...`) and `src/services/automation/contextBuilder-sync.js`.

## Notes
- Normal-mode logs in this app routinely contain two d20s (`rolls:[6,7]` initiative, `total`=first die), so dice count alone is not adv/dis evidence; per playbook, `mode` is the only adv/dis truth — and it reads `normal` for the attacking-foresighted-target lane.
- 8-hour expiry / long-rest clear not verifiable in-session (long clock unmodelled) — reported gap.
- Foresight was cast twice (targets defaulting to Bandit 1); "ends early if cast again" re-applied cleanly (single te set, badges refreshed).
- Control: Bandit 1 initiative + ElfTest STR check roll `mode:"normal"` (single-path baseline), Bandit 1 scimitar `mode:"advantage"` while foresighted — advantage lane differential IS exact.
- Side effect left armed: AasimarTest→Bandit 1 in combatSummary (incidental during card anchoring attempts).
