# BUG CLA-398/SP-068 — Hunter's Mark re-mark after kill does not move concentration (2026-10-05)

## Verdict context
- Cast + 1d6 Force rider + concentration + adv: PASS (CLA-398 same session).
- FAILING LEG: after marked target drops to 0 HP, RAW allows bonus-action move of the mark to a new creature. App lane is recast-driven; recast DOES fire spell log but concentration entry never moves.

## Machine evidence (test-campaign)
- combatSummary.creatures[FeyRanger].concentration = {id:0e2cd570..., spell:"Hunter's Mark", dc:17, target:"Zombie 1"}
- Kill: Zombie 1 currentHp 15->0 server-confirmed. Re-arm + recast: log 'spell FeyRanger->Bandit 1 Hunter's Mark' written, BUT concentration remains {id:0e2cd570..., target:"Zombie 1"} for 45+s (>>10s debounce; te id never replaced).
- Root cause pointer: spellPreparationService.js:791-798 applyNewConcentration does not fire on the free post-kill re-mark path (same concentration id retained).
- Secondary: bonus-action timing ungated (recast immediate allowed).

## Repro
1. Join Zombie+Bandit in initiative. 2. Arm Zombie, cast Hunter's Mark (concentration.target=Zombie). 3. HP-input Zombie to 0. 4. Arm Bandit, recast Hunter's Mark. 5. GET change-data/combatSummary: concentration.target still 'Zombie 1'.

## Expected
Recast post-kill replaces concentration entry (new id, target=Bandit 1) or a dedicated bonus-action re-mark affordance appears.
