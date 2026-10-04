# MN-004 — Commanding Presence — PASS-subset

**Verdict: PASS-subset** — clause 1 (superiority die on CHA skill check) fully verified live; clause 2 (success-spark reaction → forced WIS save) unreachable due to a missing info-builder entry. Downstream reaction executor is fully implemented but its row is dropped at collection time.

## Data row (verbatim, `public/data/2024/maneuvers.json` lines 26–37)

```json
  {
    "name": "Commanding Presence",
    "description": "When you make a Charisma (Intimidation, Performance, or Persuasion) check, you can expend one Superiority Die and add the die to the roll. Additionally, if the check succeeds, you can use your Reaction to force one creature that you can see within 30 feet of you to make a Wisdom saving throw against your maneuver save DC. On a failed save, the creature has disadvantage on its next attack roll before the end of your next turn.",
    "actionType": "skill_check",
    "skills": ["Intimidation", "Performance", "Persuasion"],
    "ability": "Charisma",
    "dieExpression": "superiority_die",
    "reactionSaveType": "WIS",
    "reactionEffect": "disadvantage_next_attack",
    "reactionDuration": "until_end_of_next_turn",
    "reactionRange": "30_ft"
  },
```

## Clause 1 — VERIFIED (live, EvasiveFighter, test-campaign)

- Arming: CS row click → Select-View (0/9) → tick Commanding Presence → Confirm persisted `BattleMasterManeuvers_selection = ["Commanding Presence"]` (change-data GET). MN-003 recipe re-confirmed.
- Offer on ALL three CHA skills: rolled Intimidation (+5), Performance (-1), Persuasion (-1) from sheet skill chips → each result popup showed `.dice-roll-reroll-btn` **"Commanding Presence (Superiority Die)"**. MN-019 skill-check rider precedent generalizes to CHA skills (`targetResolution.js` `computeAvailableSuperiorityManeuvers` filters by name match only, rollType `skill`).
- Die-added roll: offer clicked on Intimidation → popup **"Rolled d12 for 8. Intimidation: 23 → 31 (+8)"**; pool delta 6/6 → 5/6 (exactly −1); change-data `superiorityDice = 5`.
- Log: `"Used Commanding Presence on Intimidation check. Superiority die rolled 8. Adjusted total: 23 → 31."` (`type: ability_use`).
- Cosmetic nit: skill-popup sub-label says "(+5 to hit)" for a skill check.

## Clause 2 — GAP (grep-backed, zero reachable consumers)

Root cause: `automationInfoBuilder.js:50-52` — `DISPATCH[auto.type]` has **no handler for `combat_superiority_commanding_presence_reaction`** (no `combat_superiority_reaction` either); `buildAttackInfo` returns null → `automationCollector.js:130` `continue` → the `(Reaction)` feature pushed at `maneuvers.js:149-166` never lands in `automation.reactions` → `CharReactions.jsx:53` `appendDynamicReactions` has nothing to render.
- Live confirmation: with selection armed, EvasiveFighter Reactions section = only "Intervene Shield", "Opportunity Attack". No reaction row → modal/spark untestable → no enemy joined.

Consumer map (exists downstream, unreachable):
| Seam | File:line | Status |
|---|---|---|
| Feature push w/ reaction auto | `src/services/rules/core/maneuvers.js:149-166` | produces row |
| Info builder for type | `automationInfoBuilder/combatSuperiority.js` | **MISSING** (only combat_superiority, _movement, _skill_check) |
| Collector drop | `automationCollector.js:129-130` | drops (info null) |
| Router pushTo('reactions') | `automationRouter.js:216-224` | registered, never fed |
| Handler registry | `automation/index.js:381` | registered |
| Dispatcher | `dispatchers.js:310-323` | registered |
| Executor + target modal + disadvantage te + expiration | `executeActionManeuvers.js:551-699` | implemented |
| Modal UI/wiring | `CharReactions.jsx:48, 291-300, 612-632` | implemented |

Additional latent rule deviations in dead executor (fix alongside):
1. `executeActionManeuvers.js:677-678` expends a SECOND Superiority Die on the reaction (rule spends the die once, on the check).
2. No WIS save roll/DC check — `applyCommandingPresenceDisadvantage` applies disadvantage unconditionally on target confirm (`saveDc` computed at line 601 for modal text only).
3. No success-spark: `CharSheet.handlers.js:437-486` (`handleSuperiorityManeuver`) never inspects check success nor arms any reaction; even with the builder fixed, reaction would be a manual row, not tied to "if the check succeeds".

## Fix recipe (one entry, mirrors `combat_superiority_skill_check` pattern)

Add to `automationInfoBuilder/combatSuperiority.js`:
```js
'combat_superiority_commanding_presence_reaction': (feature, _playerStats) => {
    const auto = feature.automation
    return {
        type: 'combat_superiority_commanding_presence_reaction',
        name: feature.name,
        description: feature.description || '',
        maneuverName: auto.maneuverName || feature.name,
        reactionSaveType: auto.reactionSaveType || 'WIS',
        reactionEffect: auto.reactionEffect || 'disadvantage_next_attack',
        reactionDuration: auto.reactionDuration || 'until_end_of_next_turn',
        reactionRange: auto.reactionRange || '30_ft',
        saveDc: auto.saveDc || 'ability',
        saveAbility: auto.saveAbility || 'CHA',
        hasAutomation: true
    }
}
```

## Cleanup done

- De-armed: original selection was UNSET → Admin Clear Change Data restored unset (verified `selection: None`).
- Pool restored (change-data cleared → sheet shows stored 6/6).
- Log cleared (0 entries). No NPCs joined. No EffectAdder round-trip needed (no interference occurred). No save-file mutations.
