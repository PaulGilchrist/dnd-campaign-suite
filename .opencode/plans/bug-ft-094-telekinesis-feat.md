# FT-094 — Telekinesis (feat) E2E — Verdict: PASS-subset

## Canonical text (public/data/2024/feats.json, index `telekinesis`)
> **Telekinetic Shove.** As a Bonus Action, you can telekinetically shove one creature you can see within 30 feet of yourself. When you do so, the target must succeed on a Strength saving throw (DC 8 plus the ability modifier of the score increased by this feat and your Proficiency Bonus) or be moved 5 feet toward or away from you.

Automation block: `{type: telekinetic_shove, saveType: STR, saveDc: "ability", saveAbility: INT, range: "30", pushDistance: 5, action: bonus_action}`.

## Host
EvasiveFighter lv18 2024 BM; feats[] includes Telekinesis; featAbilityChoices `Telekinesis-3/2: Intelligence`; INT 17 (+3), STR 16 (+3), prof +6 → DC 17 (matches UI + code).

## Verified (live, test-campaign)
- Surfaces as Bonus Actions row "Telekinetic Shove" (routeBonusByAction → bonusActions; handler `feats/telekineticShoveHandler.js`, router line 291).
- Press → STR save prompt, DC 17, Roll Save → failed (1 +9 = 10). STR **save** (not opposed contest) — correct per canonical text.
- te written to disk: `{target, effect: telekinetic_movement, value: 5, movedDistanceFt: 5, duration: instant}` — CLA-357 push-mirror model. Consumer: shared `telekinetic_movement` registry entry + telekineticMovementHandler precedent; no prone/speed_zero te (correct — feat pushes, does not prone).
- Logs: `ability_use` (trigger, DC, push), `save_result` ×2 (raw roll + handler outcome `save-telekinetic_shove`), `automation/telekinetic_shove_refused` on second press same turn.
- Once-per-turn latch `_Telekinetic_Shove_usedRound` stamped at trigger; second press refused with popup + log ✓.

## Subset caveats (not defects)
- Gridless-lenient: 30ft/visible gate not enforced in code; no-target press falls back to self-target (`resolveTarget || playerName`) rather than refusing — advisory, no grid in test rig.
- Bandit 1 not joined (EB join not run); save resolved against self via fallback.
- Minor Telekinesis (free Mage Hand, featBuffService `minor_telekinesis_spell`, routed) not pressed.

## Cleanup proof
- `POST /admin/clear-change-data` + `/admin/clear-log` → 200; GET log = 0 entries; `character-change-data.json` removed (no `targetEffects`, no latch). No joins added; browser back at "Select a Campaign" (deselected). localhost only.
