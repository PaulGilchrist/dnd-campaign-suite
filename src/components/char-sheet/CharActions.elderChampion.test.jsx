// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActionSpellNames, getBonusActionSpellNames, getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
}));

const basePlayerStats = {
  name: 'TestCharacter',
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

const actionSpell = { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' };
const bonusActionSpell = { name: 'Shocking Grasp', casting_time: '1 bonus action', prepared: 'Prepared', damage: '1d8' };
const reactionSpell = { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared', damage: '1d4' };
const notPreparedSpell = { name: 'Unknown Spell', casting_time: '1 action', prepared: 'Not Prepared', damage: '4d6' };
const healSpell = { name: 'Cure Wounds', casting_time: '1 action', prepared: 'Prepared', heal_at_slot_level: true };

describe('spellSectionUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  describe('getActionSpellNames', () => {
    it('returns action spells with damage or healing', () => {
      const stats = createStats({ spellAbilities: { spells: [actionSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball']));

      const healStats = createStats({ spellAbilities: { spells: [healSpell] } });
      const healResult = getActionSpellNames(healStats, 'test-campaign');
      expect(healResult).toEqual(new Set(['Cure Wounds']));
    });

    it('handles Always prepared and unprepared spells', () => {
      const alwaysSpell = { name: 'Minor Illusion', casting_time: '1 action', prepared: 'Always', damage: 'Utility' };
      const alwaysNoDamageSpell = { name: 'Prestidigitation', casting_time: '1 action', prepared: 'Always' };
      const stats = createStats({ spellAbilities: { spells: [alwaysSpell, alwaysNoDamageSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Minor Illusion']));

      const notPreparedStats = createStats({ spellAbilities: { spells: [notPreparedSpell] } });
      const notPreparedResult = getActionSpellNames(notPreparedStats, 'test-campaign');
      expect(notPreparedResult.size).toBe(0);
    });

    it('excludes non-action spells', () => {
      const stats = createStats({ spellAbilities: { spells: [bonusActionSpell, reactionSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });

    it('returns empty set when Elder Champion is active', () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Elder Champion' }];
        return null;
      });
      const stats = createStats({ spellAbilities: { spells: [actionSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set());
    });
  });

  describe('getBonusActionSpellNames', () => {
    it('returns bonus action spells', () => {
      const stats = createStats({ spellAbilities: { spells: [bonusActionSpell] } });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Shocking Grasp']));
    });

    it('includes action spells when Elder Champion is active', () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Elder Champion' }];
        return null;
      });
      const stats = createStats({ spellAbilities: { spells: [actionSpell, bonusActionSpell] } });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball', 'Shocking Grasp']));
    });

    it('excludes unprepared bonus action spells', () => {
      const stats = createStats({ spellAbilities: { spells: [{ name: 'Hidden Spell', casting_time: '1 bonus action', prepared: 'Not Prepared', damage: '1d6' }] } });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });

    it('includes spells from active bonus action free_spell features', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Mantle of Majesty' }];
        if (key === 'activeConditions') return [];
        return null;
      });
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Command', casting_time: 'Action', prepared: 'Always' }] },
        automation: {
          bonusActions: [{
            name: 'Mantle of Majesty',
            type: 'free_spell',
            spell: 'Command',
            casting_time: '1 bonus action',
          }],
        },
      });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Command']));
    });

    it('excludes spells from inactive bonus action free_spell features', () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Command', casting_time: 'Action', prepared: 'Always' }] },
        automation: {
          bonusActions: [{
            name: 'Mantle of Majesty',
            type: 'free_spell',
            spell: 'Command',
            casting_time: '1 bonus action',
          }],
        },
      });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });
  });

  describe('getReactionSpellNames', () => {
    it('returns reaction spells', () => {
      const stats = createStats({ spellAbilities: { spells: [reactionSpell] } });
      const result = getReactionSpellNames(stats);
      expect(result).toEqual(new Set(['Shield']));
    });

    it('excludes non-reaction spells', () => {
      const stats = createStats({ spellAbilities: { spells: [actionSpell, bonusActionSpell] } });
      const result = getReactionSpellNames(stats);
      expect(result.size).toBe(0);
    });

    it('excludes unprepared reaction spells', () => {
      const stats = createStats({ spellAbilities: { spells: [{ name: 'Hidden Reaction', casting_time: '1 reaction', prepared: 'Not Prepared', damage: '1d4' }] } });
      const result = getReactionSpellNames(stats);
      expect(result.size).toBe(0);
    });
  });
});
