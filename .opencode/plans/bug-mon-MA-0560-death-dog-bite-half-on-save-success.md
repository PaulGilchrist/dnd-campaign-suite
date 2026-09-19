# MA-0560 Death Dog Bite — attack+save rider FAIL

**Row:** MA-0560, Death Dog, Bite (`public/data/monsters.json`)
**Authored:** attack_bonus 4, reach 5 ft., Hit 4 (1d4 + 2) Piercing; rider CON save DC 12. First failure = Poisoned; while Poisoned, HP max does not recover on Long Rest, repeats save every 24h, ends on success; subsequent failures reduce Poisoned target HP max by 5 (1d10). RAW: the save gates ONLY the condition/ladder rider — bite damage is paid FULL regardless of save outcome.

## Defects (live-proven 2026-09-19, test-campaign)

1. **FAIL(a) half-on-save-success — half-leak (twin MA-0551 / MV-20).** Row has NO `dc_success` field → `getSaveDcSuccess` default `half` halves the attack damage on save success.
   - Evidence: Bandit 1 (CON+1, AC12, staged 999 via /combatSummary) — save SUCCESS nat20+1=21 vs DC12 → log `save-damage` total 4, `hp_change delta:-2`; second SUCCESS nat14+1=15 → total 5, delta -2. Damage halved on success = non-RAW.
   - Contrast: save FAILURE nat4+1=5 → total 4, delta -4 FULL (failure leg numerics correct).
   - Fix: DATA add `dc_success: "none"` to Bite row (honest copy on popup + log both surfaces).

2. **FAIL(b)/twin-class rider inert — Poisoned never lands.** Even on the proven save FAIL, zero condition state: no `condition applied` log entries, `targetEffects` null top-level, victim `activeConditions` null, no `saveResult-<T>` key. Matches §107 fingerprint: EB-NPC inline seam (`handleNpcSaveDamage.js`) consumes `statusEffects` only — `saveConditions`/prose `save_effect` riders structurally inert for EB-NPC victims (MA-0090 class).

3. **Note — HP-max ladder unbuilt (advisory residual).** "HP maximum decreases by 5" ladder has no structured fields (no `staged_*` keys) and app-wide maxHp-reduction consumers are readers-only, zero producers (§70, MA-0483 precedent). Not a new defect; note only.

## Rig / reproduction

Reused MA-0559 residual cs (Bandit 1 idx0 + Death Dog 1 idx1, both 999/999). Arming: `selectOption` Bandit 1 on Death Dog 1 initiative card; chips live on avatar-opened `.mc-overlay` Bite row (`+4` chip). Chip fire → stage-1 HIT popup → `button.dice-roll-reroll-btn` Done → stage-2 combined save-damage popup (NPC save auto-rolls inline, no .sp-modal). Target re-arm needed between fires.

## Cleanup

Admin clear + clear-log via curl, verified: log `[]`, combatSummary creatures `[]`; page hard-reloaded to campaign-select (quiet, no resurrection).
