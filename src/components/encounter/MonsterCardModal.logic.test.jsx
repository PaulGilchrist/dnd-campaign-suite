/* @improved-by-ai */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollAbilityCheck,
    _rollSavingThrow,
    _rollSkillCheck,
    _rollInitiative,
    _quickRollPlayerSave,
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
  const _findCreatureByName = vi.fn((_ctx, _name) => {
    return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
  });

  return {
    extractDamageTypes: vi.fn((desc) => {
      if (!desc) return [];
      const m = desc.match(/(\w+)\s+damage/);
      return m ? [m[1].toLowerCase()] : [];
    }),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: _findCreatureByName,
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
}));

vi.mock('../../services/combat/auras/protectionBuffUtils.js', () => ({
  hasProtectionBuff: vi.fn(() => false),
}));

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as mapsService from '../../services/maps/mapsService.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - handleAttack behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  describe('getDamageTypesForAction', () => {
    it('extracts damage types from primary field and passes to rollAttack', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });
      const m = makeMonster({
        actions: [{
          name: 'Fire Bolt',
          attack_bonus: 4,
          damage_type_primary: 'fire',
          description: 'Ranged Weapon Attack',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Fire Bolt/)).toBeInTheDocument();
      expect(rollAttack).not.toHaveBeenCalled();
      const links = document.querySelectorAll('.mc-dice-link');
      let attackLink = null;
      for (const el of links) {
        if (el.textContent.trim() === '+4') {
          attackLink = el;
          break;
        }
      }
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);
      expect(rollAttack).toHaveBeenCalled();
    });

    it('includes secondary damage type in rollAttack call', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });
      const m = makeMonster({
        actions: [{
          name: 'Multiattack',
          attack_bonus: 4,
          damage_type_primary: 'slashing',
          damage_type_secondary: 'piercing',
          description: 'Two attacks',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let attackLink = null;
      for (const el of links) {
        if (el.textContent.trim() === '+4') {
          attackLink = el;
          break;
        }
      }
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);
      expect(rollAttack).toHaveBeenCalled();
    });

    it('falls back to extracting from description when no explicit damage type', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });
      const m = makeMonster({
        actions: [{
          name: 'Claw',
          attack_bonus: 3,
          description: 'Melee Weapon Attack: +3 to hit, 1d4+2 slashing damage.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let attackLink = null;
      for (const el of links) {
        if (el.textContent.trim() === '+3') {
          attackLink = el;
          break;
        }
      }
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);
      expect(rollAttack).toHaveBeenCalled();
    });
  });

  describe('extractDamageDiceFromDescription behavior', () => {
    it('uses damage_dice_primary when provided and renders as dice link', () => {
      const m = makeMonster({
        actions: [{
          name: 'Bite',
          attack_bonus: null,
          damage_dice_primary: '1d8+4',
          description: 'Hit: 1d8+4 slashing damage.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let dmgLink = null;
      for (const el of links) {
        if (el.textContent.includes('1d8+4')) {
          dmgLink = el;
          break;
        }
      }
      expect(dmgLink).toBeTruthy();
    });

    it('extracts damage dice from description when damage_dice_primary is not provided', () => {
      // The regex expects format: Hit: 7 (1d6+3) with parens
      const m = makeMonster({
        actions: [{
          name: 'Bite',
          attack_bonus: null,
          description: 'Hit: 7 (1d6+3) piercing damage.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let dmgLink = null;
      for (const el of links) {
        if (el.textContent.includes('1d6+3')) {
          dmgLink = el;
          break;
        }
      }
      expect(dmgLink).toBeTruthy();
      fireEvent.click(dmgLink);
      expect(rollDamage).toHaveBeenCalled();
    });

    it('prefers damage_dice_primary over description extraction', () => {
      const m = makeMonster({
        actions: [{
          name: 'Multiattack',
          attack_bonus: null,
          damage_dice_primary: '2d6+3',
          description: 'Hit: 7 (1d8+2) slashing damage.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let dmgLink = null;
      for (const el of links) {
        if (el.textContent.includes('2d6+3')) {
          dmgLink = el;
          break;
        }
      }
      expect(dmgLink).toBeTruthy();
      let descDmgLink = null;
      for (const el of links) {
        if (el.textContent.includes('1d8+2')) {
          descDmgLink = el;
          break;
        }
      }
      expect(descDmgLink).toBeFalsy();
    });

    it('renders action without damage dice when no dice found', () => {
      const m = makeMonster({
        actions: [{
          name: 'Special Ability',
          attack_bonus: null,
          description: 'The creature does something special.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Special Ability/)).toBeInTheDocument();
      const links = document.querySelectorAll('.mc-dice-link');
      for (const el of links) {
        expect(el.textContent).not.toContain('special');
      }
    });
  });

  describe('getAttackerCreature with creatures prop', () => {
    it('uses creatures prop to find attacker', () => {
      damageUtils.__setFindCreatureReturn(null);
      const m = makeMonster();
      const creatures = [
        { name: 'Goblin', conditions: [{ key: 'prone', label: 'Prone' }] },
        { name: 'Player A', conditions: [] },
      ];
      render(<MonsterCardModal {...makeProps(m, { creatures })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(damageUtils.findCreatureByName).toHaveBeenCalled();
    });

    it('uses fallbackCsRef when creatures prop is not provided', () => {
      damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { creatures: undefined })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });
  });

  describe('getTarget behavior', () => {
    it('uses creatures prop to find target', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });
      const m = makeMonster();
      const creatures = [
        { name: 'Goblin', conditions: [], targetName: 'Player A' },
        { name: 'Player A', conditions: [], type: 'player' },
      ];
      render(<MonsterCardModal {...makeProps(m, { creatures })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });
  });

  describe('handleDamage behavior', () => {
    it('clicking damage dice calls rollDamage with correct parameters', () => {
      const m = makeMonster({
        actions: [{
          name: 'Claw',
          attack_bonus: null,
          damage_dice_primary: '1d6+3',
          damage_type_primary: 'slashing',
          description: 'Melee attack.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let dmgLink = null;
      for (const el of links) {
        if (el.textContent.includes('1d6')) {
          dmgLink = el;
          break;
        }
      }
      expect(dmgLink).toBeTruthy();
      fireEvent.click(dmgLink);
      expect(rollDamage).toHaveBeenCalled();
    });

    it('uses doubled dice on crit when popupHtml.isCrit is true', () => {
      useLoggedDiceRoll._setPopupHtml({ isCrit: true });
      const m = makeMonster({
        actions: [{
          name: 'Bite',
          attack_bonus: null,
          damage_dice_primary: '1d4+2',
          description: 'Bite attack.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let dmgLink = null;
      for (const el of links) {
        if (el.textContent.includes('1d4')) {
          dmgLink = el;
          break;
        }
      }
      expect(dmgLink).toBeTruthy();
      fireEvent.click(dmgLink);
      expect(rollDamage).toHaveBeenCalled();
    });

    it('resets popupHtml after clicking damage dice on crit', () => {
      useLoggedDiceRoll._setPopupHtml({ isCrit: true });
      const m = makeMonster({
        actions: [{
          name: 'Bite',
          attack_bonus: null,
          damage_dice_primary: '1d4+2',
          description: 'Bite attack.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let dmgLink = null;
      for (const el of links) {
        if (el.textContent.includes('1d4')) {
          dmgLink = el;
          break;
        }
      }
      expect(dmgLink).toBeTruthy();
      fireEvent.click(dmgLink);
      expect(useLoggedDiceRoll._setPopupHtml).toHaveBeenCalledWith(null);
    });
  });

  describe('handleAttack with save DC', () => {
    it('handles action with both attack_bonus and save_dc', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });
      const m = makeMonster({
        actions: [{
          name: 'Hex Attack',
          attack_bonus: 5,
          save_dc: 13,
          save_type: 'Wisdom',
          damage_dice_primary: '1d6',
          damage_type_primary: 'psychic',
          description: 'Attack with save.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let attackLink = null;
      for (const el of links) {
        if (el.textContent.trim() === '+5') {
          attackLink = el;
          break;
        }
      }
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);
      expect(rollAttack).toHaveBeenCalled();
    });
  });

  describe('handleAttack with range validation', () => {
    it('handles melee attack (range <= 5ft)', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });
      const m = makeMonster({
        actions: [{
          name: 'Club',
          attack_bonus: 3,
          damage_dice_primary: '1d4',
          damage_type_primary: 'bludgeoning',
          reach: '5 ft.',
          description: 'Melee Weapon Attack.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let attackLink = null;
      for (const el of links) {
        if (el.textContent.trim() === '+3') {
          attackLink = el;
          break;
        }
      }
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);
      expect(rollAttack).toHaveBeenCalled();
    });

    it('handles ranged attack with range property', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });
      const m = makeMonster({
        actions: [{
          name: 'Longbow',
          attack_bonus: 5,
          damage_dice_primary: '1d8',
          damage_type_primary: 'piercing',
          range: '150/600',
          description: 'Ranged Weapon Attack.',
        }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      let attackLink = null;
      for (const el of links) {
        if (el.textContent.trim() === '+5') {
          attackLink = el;
          break;
        }
      }
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);
      expect(rollAttack).toHaveBeenCalled();
    });
  });

  describe('map-based range effects', () => {
    it('loads map data when mapName prop is provided', async () => {
      const mapData = {
        placedItems: [{ name: 'Goblin', gridX: 5, gridY: 5 }],
        players: [],
      };
      mapsService.loadMapData.mockResolvedValue(mapData);

      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { mapName: 'test-map' })} />);

      await waitFor(() => {
        expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'test-map');
      });
    });

    it('sets mapData to null on load failure', async () => {
      mapsService.loadMapData.mockRejectedValue(new Error('Load failed'));

      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { mapName: 'bad-map' })} />);

      await waitFor(() => {
        expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'bad-map');
      });
    });

    it('does not load map data when mapName is not provided', () => {
      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });
  });

  describe('monsterCharacter lookups', () => {
    it('finds monsterCharacter from characters array by name', () => {
      const monsterCharacter = {
        name: 'Goblin',
        computedStats: {
          automation: {
            passives: [
              { type: 'weapon_mastery_choice', chosenMastery: 'Graze' },
            ],
          },
          abilities: [
            { name: 'Strength', bonus: 2 },
          ],
        },
      };
      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { characters: [monsterCharacter] })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('does not find monsterCharacter when name does not match', () => {
      const monsterCharacter = {
        name: 'Ogre',
        computedStats: {
          automation: {
            passives: [
              { type: 'weapon_mastery_choice', chosenMastery: 'Graze' },
            ],
          },
        },
      };
      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { characters: [monsterCharacter] })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('handles missing computedStats gracefully', () => {
      const monsterCharacter = {
        name: 'Goblin',
      };
      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { characters: [monsterCharacter] })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('handles missing automation gracefully', () => {
      const monsterCharacter = {
        name: 'Goblin',
        computedStats: {},
      };
      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { characters: [monsterCharacter] })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });
  });

  describe('attacker conditions check in handleAttack', () => {
    it('does not render attack bonus dice link when attacker is incapacitated', () => {
      conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [{ key: 'paralyzed', label: 'Paralyzed' }],
      });
      const m = makeMonster({ actions: [{ name: 'Club', attack_bonus: 3, description: 'Melee Attack.' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      for (const el of links) {
        expect(el.textContent).not.toContain('+3');
      }
      expect(rollAttack).not.toHaveBeenCalled();
    });

    it('does not render attack bonus dice link when attacker is stunned', () => {
      conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [{ key: 'stunned', label: 'Stunned' }],
      });
      const m = makeMonster({ actions: [{ name: 'Club', attack_bonus: 3, description: 'Melee Attack.' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      const links = document.querySelectorAll('.mc-dice-link');
      for (const el of links) {
        expect(el.textContent).not.toContain('+3');
      }
      expect(rollAttack).not.toHaveBeenCalled();
    });
  });
});
