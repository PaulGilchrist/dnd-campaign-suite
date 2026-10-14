import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getActionSpellNames,
  getBonusActionSpellNames,
  getReactionSpellNames,
  getExcludedSpellNames,
} from '../../services/ui/spellSectionUtils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Minimal mock: only what spellSectionUtils.js actually imports
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

const actionSpell = { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' };
const bonusActionSpell = { name: 'Shocking Grasp', casting_time: '1 bonus action', prepared: 'Prepared', damage: '1d8' };
const reactionSpell = { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared', damage: '1d4' };
const alwaysSpell = { name: 'Minor Illusion', casting_time: '1 action', prepared: 'Always', damage: 'Utility' };
const alwaysNoDamageSpell = { name: 'Prestidigitation', casting_time: '1 action', prepared: 'Always' };
const notPreparedSpell = { name: 'Unknown Spell', casting_time: '1 action', prepared: 'Not Prepared', damage: '4d6' };
const healSpell = { name: 'Cure Wounds', casting_time: '1 action', prepared: 'Prepared', heal_at_slot_level: true };
const actionSpellAltCase = { name: 'Lightning Bolt', casting_time: 'Action', prepared: 'Prepared', damage: '8d6' };

function createStats(overrides = {}) {
  return {
    name: 'TestCharacter',
    spellAbilities: { spells: [] },
    automation: {},
    ...overrides,
  };
}

function mockBuffs(buffs) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return buffs;
    return null;
  });
}

function mockBuffsAndConditions(buffs, conditions) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return buffs;
    if (key === 'activeConditions') return conditions;
    return null;
  });
}

describe('spellSectionUtils', () => {
  beforeEach(() => {
    getRuntimeValue.mockImplementation(() => null);
  });

  describe('getActionSpellNames', () => {
    it('returns action spells with damage or healing', () => {
      const stats = createStats({ spellAbilities: { spells: [actionSpell, healSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball', 'Cure Wounds']));
    });

    it('returns action spells with "Always" prepared status when they have damage', () => {
      const stats = createStats({ spellAbilities: { spells: [alwaysSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Minor Illusion']));
    });

    it('excludes "Always" spells without damage or healing', () => {
      const stats = createStats({ spellAbilities: { spells: [alwaysNoDamageSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });

    it('excludes unprepared spells and non-action spells', () => {
      const stats = createStats({ spellAbilities: { spells: [notPreparedSpell, bonusActionSpell, reactionSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });

    it('returns empty set when Elder Champion is active', () => {
      mockBuffs([{ name: 'Elder Champion' }]);
      const stats = createStats({ spellAbilities: { spells: [actionSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set());
    });

    it('filters multiple spells correctly', () => {
      const stats = createStats({
        spellAbilities: { spells: [actionSpell, healSpell, actionSpellAltCase, notPreparedSpell, bonusActionSpell] },
      });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball', 'Cure Wounds', 'Lightning Bolt']));
    });

    it('handles null/undefined spellAbilities gracefully', () => {
      expect(getActionSpellNames(createStats({ spellAbilities: undefined }), 'test-campaign')).toEqual(new Set());
      expect(getActionSpellNames(createStats({ spellAbilities: null }), 'test-campaign')).toEqual(new Set());
      expect(getActionSpellNames(createStats({ spellAbilities: {} }), 'test-campaign')).toEqual(new Set());
    });

    it('returns action spells when Elder Champion check throws (error suppressed)', () => {
      getRuntimeValue.mockImplementation(() => { throw new Error('store error'); });
      const stats = createStats({ spellAbilities: { spells: [actionSpell] } });
      expect(getActionSpellNames(stats, 'test-campaign')).toEqual(new Set(['Fireball']));
    });
  });

  describe('getBonusActionSpellNames', () => {
    it('returns bonus action spells', () => {
      const stats = createStats({ spellAbilities: { spells: [bonusActionSpell] } });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Shocking Grasp']));
    });

    it('includes action spells when Elder Champion is active', () => {
      mockBuffs([{ name: 'Elder Champion' }]);
      const stats = createStats({ spellAbilities: { spells: [actionSpell, bonusActionSpell] } });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball', 'Shocking Grasp']));
    });

    it('excludes unprepared bonus action spells', () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Hidden Spell', casting_time: '1 bonus action', prepared: 'Not Prepared', damage: '1d6' }] },
      });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });

    it('includes spells from active automation features (free_spell, fey_reinforcements, misty_wanderer)', () => {
      mockBuffsAndConditions([{ name: 'Mantle of Majesty' }, { name: 'Fey Presence' }, { name: 'Misty Wanderer' }], []);
      const stats = createStats({
        spellAbilities: { spells: [] },
        automation: {
          bonusActions: [{
            name: 'Mantle of Majesty',
            type: 'free_spell',
            spell: 'Command',
            casting_time: '1 bonus action',
          }, {
            name: 'Fey Presence',
            type: 'fey_reinforcements',
            spell: 'Faerie Fire',
            casting_time: '1 bonus action',
          }],
          specialActions: [{
            name: 'Misty Wanderer',
            type: 'misty_wanderer',
            spell: 'Misty Step',
            casting_time: '1 bonus action',
          }],
        },
      });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Command', 'Faerie Fire', 'Misty Step']));
    });

    it('excludes inactive automation features', () => {
      const stats = createStats({
        spellAbilities: { spells: [] },
        automation: {
          bonusActions: [{
            name: 'Mantle of Majesty',
            type: 'free_spell',
            spell: 'Command',
            casting_time: '1 bonus action',
          }],
          specialActions: [{
            name: 'Misty Wanderer',
            type: 'misty_wanderer',
            spell: 'Misty Step',
            casting_time: '1 bonus action',
          }],
        },
      });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });

    it('handles array spell values in features', () => {
      mockBuffsAndConditions([{ name: 'Mantle of Majesty' }], []);
      const stats = createStats({
        spellAbilities: { spells: [] },
        automation: {
          bonusActions: [{
            name: 'Mantle of Majesty',
            type: 'free_spell',
            spell: ['Command', 'Thaumaturgy'],
            casting_time: '1 bonus action',
          }],
        },
      });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Command', 'Thaumaturgy']));
    });

    it('handles Elder Champion with try/catch returning false', () => {
      getRuntimeValue.mockImplementation(() => { throw new Error('store error'); });
      const stats = createStats({ spellAbilities: { spells: [actionSpell, bonusActionSpell] } });
      expect(getBonusActionSpellNames(stats, 'test-campaign')).toEqual(new Set(['Shocking Grasp']));
    });

    it('returns empty set when spellAbilities or automation is null/undefined', () => {
      expect(getBonusActionSpellNames(createStats({ spellAbilities: undefined }), 'test-campaign')).toEqual(new Set());
      expect(getBonusActionSpellNames(createStats({ automation: undefined }), 'test-campaign')).toEqual(new Set());
    });
  });

  describe('getReactionSpellNames', () => {
    it('returns reaction spells with damage', () => {
      const stats = createStats({ spellAbilities: { spells: [reactionSpell] } });
      const result = getReactionSpellNames(stats);
      expect(result).toEqual(new Set(['Shield']));
    });

    it('excludes non-reaction and unprepared spells', () => {
      const stats = createStats({ spellAbilities: { spells: [actionSpell, bonusActionSpell, { name: 'Hidden Reaction', casting_time: '1 reaction', prepared: 'Not Prepared', damage: '1d4' }] } });
      const result = getReactionSpellNames(stats);
      expect(result.size).toBe(0);
    });

    it('handles null/undefined spellAbilities gracefully', () => {
      expect(getReactionSpellNames(createStats({ spellAbilities: undefined }))).toEqual(new Set());
      expect(getReactionSpellNames(createStats({ spellAbilities: null }))).toEqual(new Set());
      expect(getReactionSpellNames(createStats({ spellAbilities: {} }))).toEqual(new Set());
    });
  });

  describe('getExcludedSpellNames', () => {
    it('returns union of action, bonus, and reaction spell names', () => {
      const stats = createStats({
        spellAbilities: {
          spells: [actionSpell, bonusActionSpell, reactionSpell, alwaysSpell],
        },
      });
      const result = getExcludedSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball', 'Shocking Grasp', 'Shield', 'Minor Illusion']));
    });

    it('excludes spells from automation features too', () => {
      mockBuffsAndConditions([{ name: 'Mantle of Majesty' }], []);
      const stats = createStats({
        spellAbilities: { spells: [actionSpell] },
        automation: {
          bonusActions: [{
            name: 'Mantle of Majesty',
            type: 'free_spell',
            spell: 'Command',
            casting_time: '1 bonus action',
          }],
        },
      });
      const result = getExcludedSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball', 'Command']));
    });

    it('handles null/undefined spellAbilities gracefully', () => {
      expect(getExcludedSpellNames(createStats({ spellAbilities: undefined }), 'test-campaign')).toEqual(new Set());
      expect(getExcludedSpellNames(createStats({ spellAbilities: null }), 'test-campaign')).toEqual(new Set());
    });

    it('respects Elder Champion suppression for action spells', () => {
      const ecBuff = [{ name: 'Elder Champion' }];
      getRuntimeValue.mockImplementation(() => ecBuff);
      const stats = createStats({
        spellAbilities: { spells: [actionSpell, bonusActionSpell] },
      });
      const actionResult = getActionSpellNames(stats, 'test-campaign');
      expect(actionResult).toEqual(new Set());

      const bonusResult = getBonusActionSpellNames(stats, 'test-campaign');
      expect(bonusResult).toEqual(new Set(['Fireball', 'Shocking Grasp']));

      const result = getExcludedSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball', 'Shocking Grasp']));
    });
  });
});
