// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActionSpellNames, getBonusActionSpellNames, getReactionSpellNames, getExcludedSpellNames } from '../../services/ui/spellSectionUtils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
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
const alwaysSpell = { name: 'Minor Illusion', casting_time: '1 action', prepared: 'Always', damage: 'Utility' };
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

    it('returns Always prepared action spells that have damage or healing', () => {
      const stats = createStats({ spellAbilities: { spells: [alwaysSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Minor Illusion']));
    });

    it('excludes unprepared spells', () => {
      const stats = createStats({ spellAbilities: { spells: [notPreparedSpell] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });

    it('excludes Always prepared spells without damage or healing', () => {
      const stats = createStats({ spellAbilities: { spells: [{ name: 'Prestidigitation', casting_time: '1 action', prepared: 'Always' }] } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
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

    it('handles variant action casting time strings', () => {
      const spells = [
        { name: 'Spell A', casting_time: '1 Action', prepared: 'Prepared', damage: '1d6' },
        { name: 'Spell B', casting_time: 'action', prepared: 'Prepared', damage: '1d6' },
        { name: 'Spell C', casting_time: 'Action', prepared: 'Prepared', damage: '1d6' },
      ];
      const stats = createStats({ spellAbilities: { spells } });
      const result = getActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Spell A', 'Spell B', 'Spell C']));
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

    it('handles variant bonus action casting time strings', () => {
      const spells = [
        { name: 'Spell A', casting_time: '1 Bonus Action', prepared: 'Prepared', damage: '1d6' },
        { name: 'Spell B', casting_time: 'bonus action', prepared: 'Prepared', damage: '1d6' },
        { name: 'Spell C', casting_time: 'Bonus Action', prepared: 'Prepared', damage: '1d6' },
      ];
      const stats = createStats({ spellAbilities: { spells } });
      const result = getBonusActionSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Spell A', 'Spell B', 'Spell C']));
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

    it('handles variant reaction casting time strings', () => {
      const spells = [
        { name: 'Spell A', casting_time: '1 Reaction', prepared: 'Prepared', damage: '1d4' },
        { name: 'Spell B', casting_time: 'reaction', prepared: 'Prepared', damage: '1d4' },
        { name: 'Spell C', casting_time: 'Reaction', prepared: 'Prepared', damage: '1d4' },
      ];
      const stats = createStats({ spellAbilities: { spells } });
      const result = getReactionSpellNames(stats);
      expect(result).toEqual(new Set(['Spell A', 'Spell B', 'Spell C']));
    });
  });

  describe('getExcludedSpellNames', () => {
    it('returns union of action, bonus action, and reaction spell names', () => {
      const stats = createStats({ spellAbilities: { spells: [actionSpell, bonusActionSpell, reactionSpell] } });
      const result = getExcludedSpellNames(stats, 'test-campaign');
      expect(result).toEqual(new Set(['Fireball', 'Shocking Grasp', 'Shield']));
    });

    it('handles missing spellAbilities gracefully', () => {
      const stats = createStats({ spellAbilities: {} });
      const result = getExcludedSpellNames(stats, 'test-campaign');
      expect(result.size).toBe(0);
    });
  });
});
