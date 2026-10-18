// Regression tests for CLA-184 Improved Circle Forms (Lunar Radiance):
// Moon druid wild shape attacks must offer a per-hit Normal-vs-Radiant
// damage type choice instead of a forced Radiant conversion.
//
// This file keeps ONLY the modal-lane-distinct click→ctx write: an attack-chip
// click must stamp action.damage_type_choices onto the rollAttack options via
// buildAttackRollOptions/getDamageTypeChoices (MonsterCardModal.jsx:709, 1387)
// — the sole pin of that CLA-184 transport byte from the monster lane.
// Remaining CLA-184 seams are owned elsewhere and stayed green:
//  - Choice buttons rendered in place of plain Done on a hit: DiceRollResult
//    owner seam "auto-damage type choices dispatch Done with the chosen type
//    instead of plain Done" (DiceRollResult.interactive.test.jsx).
//  - Choice click → dice-roll-done with the chosen type merged in:
//    AttackResultPopup owner seam "a damage-type choice acts as the Done click,
//    merging the chosen type into the payload"
//    (AttackResultPopup.close-behavior.test.jsx) — the modal's
//    MonsterAttackPopup is a pure passthrough (MonsterCardModal.jsx:2092).
//  - rollAttack ctx → popupHtml.autoDamage transport lives at
//    useLoggedDiceRollAttack.js:201 (no owner test found — reported upstream).
// @maintained-by-ai
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollAttack = vi.fn();
  return {
    default: vi.fn(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: _rollAttack,
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _rollAttack,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  // Fixed attacker row so getTarget() resolves the Ogre across lanes.
  findCreatureByName: vi.fn(() => ({ name: 'Brown Bear', conditions: [], targetName: 'Ogre' })),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

const bearBite = (choices) => ({
  name: 'Bite',
  attack_bonus: 7,
  damage_dice_primary: '1d8+3',
  damage_type_primary: 'Piercing',
  ...(choices ? { damage_type_choices: choices } : {}),
  description: choices ? '7 Piercing or Radiant damage.' : '7 Piercing damage.',
});

const creatures = [
  { name: 'Brown Bear', targetName: 'Ogre' },
  { name: 'Ogre', type: 'nonplayer' },
];

function clickDiceLinkByText(text) {
  const links = Array.from(document.querySelectorAll('.mc-dice-link'));
  const link = links.find(el => el.textContent.includes(text));
  if (link) fireEvent.click(link);
  return link;
}

describe('MonsterCardModal - Lunar Radiance per-hit damage type choice (CLA-184)', () => {
  it('passes damageTypeChoices from action.damage_type_choices to rollAttack context', () => {
    const m = makeMonster({ name: 'Brown Bear', actions: [bearBite(['Piercing', 'Radiant'])] });
    render(<MonsterCardModal {...makeProps(m, { creatures })} />);

    const link = clickDiceLinkByText('+7');
    expect(link).toBeTruthy();
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][2].damageTypeChoices).toEqual(['Piercing', 'Radiant']);
  });
});
