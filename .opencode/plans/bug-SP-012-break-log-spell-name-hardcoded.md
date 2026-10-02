# Bug SP-012 — Concentration-break log hardcodes spell name "Flesh to Stone"

## Overview
When a Banishment concentration save fails (cnp-modal Roll Con Save, CON nat 5+2=7 vs DC 10, 2026-10-02, test-campaign, host Divine_Cleric lv17 Life), the concentration-break log entries print a hardcoded spell name from an unrelated spell. Cosmetic only — the purge itself is fully correct and live.

## Expected (app-data quote)
`public/data/2024/spells.json`:
> "banishment ... Duration: Concentration, up to 1 minute ... One creature that you can see within range must succeed on a Charisma saving throw or be transported to a harmless demiplane for the duration."

Break log should name the spell that actually ended, e.g. `Concentration broken; Banishment ends.`

## Actual
Two entries, wrong spell name:
```
ability_use | Divine_Cleric | "Concentration broken; Flesh to Stone ends."
ability_use | Divine_Cleric | "Concentration broken; Flesh to Stone ends."
```
Purge verified correct despite the label: cs `creatures[Divine_Cleric].concentration → null`, campaign `targetEffects → []`, Bandit 1 `activeConditions → []`, `concentrationPrompt-Divine_Cleric` key cleared.

## Steps
1. test-campaign, Divine_Cleric lv17 (Banishment prepared via wizard step-14).
2. Cast Banishment lv4/lv5 (concentration held, cs.concentration `{spell:'Banishment', dc:17}`).
3. Have NPC (Bandit Captain via EB join) hit the caster → cnp-modal CON DC 10 → Roll Con Save → fail.
4. Read campaign log: break line says "Flesh to Stone ends".

## Likely Location
`src/services/combat/concentration/concentrationService.js:411` — `description: 'Concentration broken; Flesh to Stone ends.',` (literal, not interpolating the broken spell name). Twin literal at `src/services/rules/effects/clearAllExpirationEffects.js:113` ("Rest; Flesh to Stone ends."). Same cosmetic family previously cited in SP-005 ("break log hardcodes 'Flesh to Stone ends' cosmetic") — now re-confirmed live on the banishment lane, double-emitted (×2).

## Notes
- Severity: cosmetic/log-only; does not gate any state. Grant/purge/economy all exact (see checkpoint-SP-012.md).
- Fix suggestion: interpolate the concentration spell name (available at the call site; `creature.concentration.spell`).
- Do not confuse with the functional SP-011 defect (bane DC-zeroing) — unrelated seam.
