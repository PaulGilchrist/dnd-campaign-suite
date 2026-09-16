# Bug — MA-0305 Arch-hag "Tongue Twister" (data-wiring gap)

VERDICT: FAIL

## Row
- Arch-hag (arch-hag), LIVE combatSummary idx2, init 19
- reactions[0] "Tongue Twister", manifest actionType=save

## Evidence
### Static
- Raw dict public/data/monsters.json:6179 — name + description ONLY.
  No automation, no actionType, no save_dc/save_type. Zero numbers authored
  despite manifest actionType=save.
- Seam EXISTS but keys off automation.effect:
  GATED_MONSTER_REACTIONS.counterspell src/components/encounter/MonsterCardHelpers.js:486;
  gate counterspellGate :506-520; chip via getGatedMonsterReaction reading
  action?.automation?.effect :539-541. MA-0013 twin proves seam live.
  Arch-hag row has NO automation → seam never consulted.

### DOM (Playwright, test-campaign header verified at every step)
- Arch-hag card Reactions section (pre- and post-probe):
  `<div class="mc-section"><div class="mc-action"><strong>Tongue Twister.</strong>
  <span>The hag casts Counterspell…</span></div></div>`
  interactive elements (button/[role=button]/badge/chip/gated) = 0. Text-only inert
  (MA-0300 lineage).

### Probe
- DivinationWizard Fire Bolt click → executor defect recurred:
  `activeConditions must be an array for caster`
  (spellCastService/execution/index.js:136) — noted, switched caster.
- AberrantSorcerer Fire Bolt cast (Metamagic modal → "Cast Without Metamagic"):
  log entries spell+roll recorded, characterName=AberrantSorcerer,
  spellName=Fire Bolt, rollType=attack, targetName=None (roll 13).
- Post-cast: no reaction prompt, no chip, no gate refusal, no banner.
- Log grep (500 entries): tongue/counterspell hits = 0.
  3 "reaction"-adjacent entries are Slowed condition apps from other abilities.

## Conclusion
Prose-only inert. Gated counterspell seam exists but is not wired to this row
(no automation.effect on Tongue Twister). Manifest actionType=save is an
unbacked claim — no save numbers anywhere. Needs data authoring
(automation.effect=counterspell + save_dc/type) to engage the seam.

## Constraints honored
No save-file edits, no mutating POSTs, no manifest/playbook/registry edits.
test-campaign only; campaign header re-verified after every navigation.
