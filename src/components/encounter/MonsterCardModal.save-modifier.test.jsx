/* @improved-by-ai */
/* @cleaned-by-ai */
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const _rollSavingThrow = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollSavingThrow,
    _rollDamage,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  let _computeReturn = null;
  const _computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultConditionEffects };
  });

  return {
    computeConditionEffects: _computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
    }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (range === 'touch') return 8;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn((_characterKey, _propertyName, _campaignName) => null),
  getRuntimeValue: vi.fn((_characterKey, _propertyName) => null),
}));

// ── Re-import for helper access ────────────────────────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as abilityLookup from '../../services/shared/abilityLookup.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - getSaveModifierForSaveType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
  });

  describe('player target with abilities array', () => {
    it('uses getAbilitySaveModifier from player.char.abilities when available', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });

      const playerChar = {
        name: 'Player A',
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Strength', bonus: 1 },
        ],
      };

      vi.mocked(abilityLookup.getAbilitySaveModifier).mockReturnValue(3);

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }], characters: [playerChar] })} />);

      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBeGreaterThan(0);
      fireEvent.click(clickableSaveLinks[0]);
      expect(abilityLookup.getAbilitySaveModifier).toHaveBeenCalledWith(playerChar.abilities, 'dex');
      expect(rollSavingThrow).toHaveBeenCalledWith('DEX', 3, expect.objectContaining({ saveDc: 13, saveType: 'Dexterity' }));
    });
  });

  describe('player target fallback chain', () => {
    it('uses creature.saving_throws when player has no abilities array', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player', saving_throws: { dex: { modifier: 2 } } }], characters: [] })} />);

      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBeGreaterThan(0);
      fireEvent.click(clickableSaveLinks[0]);
      expect(rollSavingThrow).toHaveBeenCalledWith('DEX', 2, expect.objectContaining({ saveDc: 13, saveType: 'Dexterity' }));
    });

    it('uses creature.ability_score_modifiers when saving_throws is also missing', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player', ability_score_modifiers: { dex: 4 } }], characters: [] })} />);

      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBeGreaterThan(0);
      fireEvent.click(clickableSaveLinks[0]);
      expect(rollSavingThrow).toHaveBeenCalledWith('DEX', 4, expect.objectContaining({ saveDc: 13, saveType: 'Dexterity' }));
    });

    it('returns 0 when no save modifier source is found', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }], characters: [] })} />);

      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBeGreaterThan(0);
      fireEvent.click(clickableSaveLinks[0]);
      expect(rollSavingThrow).toHaveBeenCalledWith('DEX', 0, expect.objectContaining({ saveDc: 13, saveType: 'Dexterity' }));
    });
  });

  describe('non-player target', () => {
    it('uses target.saving_throws for non-player targets', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Ogre',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Constitution Saving Throw: DC 13', save_dc: 13, save_type: 'Constitution' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Ogre' }, { name: 'Ogre', saving_throws: { con: { modifier: 4 } } }] })} />);

      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBeGreaterThan(0);
      fireEvent.click(clickableSaveLinks[0]);
      expect(rollSavingThrow).toHaveBeenCalledWith('CON', 4, expect.objectContaining({ saveDc: 13, saveType: 'Constitution' }));
    });

    it('uses target.ability_score_modifiers as fallback for non-player targets', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Ogre',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Constitution Saving Throw: DC 13', save_dc: 13, save_type: 'Constitution' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Ogre' }, { name: 'Ogre', ability_score_modifiers: { con: 3 } }] })} />);

      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBeGreaterThan(0);
      fireEvent.click(clickableSaveLinks[0]);
      expect(rollSavingThrow).toHaveBeenCalledWith('CON', 3, expect.objectContaining({ saveDc: 13, saveType: 'Constitution' }));
    });
  });

  describe('no target', () => {
    it('renders clickable save DC even without a target (modifier defaults to 0)', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin' }] })} />);

      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBeGreaterThan(0);
    });
  });
});

describe('MonsterCardModal - handleDamage with save DC context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
  });

  it('passes saveDc, saveType, and dcSuccess to rollSavingThrow context when action has save_dc', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Fireball', attack_bonus: null, damage_dice_primary: '8d6', damage_type_primary: 'fire', save_dc: 15, save_type: 'Dexterity', description: 'Dexterity Saving Throw: DC 15' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    const links = document.querySelectorAll('.mc-dice-link');
    let dmgLink = null;
    for (const el of links) {
      if (el.textContent.includes('8d6')) {
        dmgLink = el;
        break;
      }
    }
    expect(dmgLink).toBeTruthy();
    fireEvent.click(dmgLink);
    expect(rollSavingThrow).toHaveBeenCalledWith('DEX', 0, expect.objectContaining({ saveDc: 15, saveType: 'Dexterity', dcSuccess: 'half' }));
  });
});
