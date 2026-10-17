// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getActionSpellNames,
  getBonusActionSpellNames,
  getReactionSpellNames,
  getExcludedSpellNames,
} from '../../services/ui/spellSectionUtils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// The runtime store is mocked so buff lookups (Elder Champion, active features)
// are deterministic; the partitioning logic under test runs unmocked.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';

function createStats(spells = [], automation = {}) {
  return { name: 'TestCharacter', spellAbilities: { spells }, automation };
}

function mockActiveBuffs(buffs) {
  getRuntimeValue.mockImplementation((_name, key) => (key === 'activeBuffs' ? buffs : null));
}

describe('spellSectionUtils section partitioning', () => {
  beforeEach(() => {
    getRuntimeValue.mockImplementation(() => null);
  });

  describe('getActionSpellNames', () => {
    it('includes only prepared action-time spells with damage or healing, in any casting-time casing', () => {
      const stats = createStats([
        { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        { name: 'Cure Wounds', casting_time: '1 action', prepared: 'Prepared', heal_at_slot_level: true },
        { name: 'Minor Illusion', casting_time: '1 action', prepared: 'Always', damage: 'Utility' },
        { name: 'Lightning Bolt', casting_time: 'Action', prepared: 'Prepared', damage: '8d6' },
        // excluded: no damage/healing, unprepared, wrong casting time
        { name: 'Prestidigitation', casting_time: '1 action', prepared: 'Always' },
        { name: 'Unknown Spell', casting_time: '1 action', prepared: 'Not Prepared', damage: '4d6' },
        { name: 'Shocking Grasp', casting_time: '1 bonus action', prepared: 'Prepared', damage: '1d8' },
        { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared', damage: '1d4' },
      ]);
      expect(getActionSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Fireball', 'Cure Wounds', 'Minor Illusion', 'Lightning Bolt']));
    });

    it('suppresses all action spells while Elder Champion is active', () => {
      mockActiveBuffs([{ name: 'Elder Champion' }]);
      const stats = createStats([{ name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }]);
      expect(getActionSpellNames(stats, CAMPAIGN)).toEqual(new Set());
    });
  });

  describe('getBonusActionSpellNames', () => {
    it('includes prepared bonus-action spells only', () => {
      const stats = createStats([
        { name: 'Shocking Grasp', casting_time: '1 bonus action', prepared: 'Prepared', damage: '1d8' },
        { name: 'Healing Word', casting_time: 'Bonus Action', prepared: 'Always' },
        { name: 'Hidden Spell', casting_time: '1 bonus action', prepared: 'Not Prepared', damage: '1d6' },
        { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
      ]);
      expect(getBonusActionSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Shocking Grasp', 'Healing Word']));
    });

    it('promotes prepared action spells to bonus actions while Elder Champion is active', () => {
      mockActiveBuffs([{ name: 'Elder Champion' }]);
      const stats = createStats([
        { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        { name: 'Shocking Grasp', casting_time: '1 bonus action', prepared: 'Prepared', damage: '1d8' },
        { name: 'Hidden Spell', casting_time: '1 action', prepared: 'Not Prepared', damage: '4d6' },
        { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared', damage: '1d4' },
      ]);
      expect(getBonusActionSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Fireball', 'Shocking Grasp']));
    });

    it('includes spell names from active automation features, honoring type, spell list, and bonus casting time', () => {
      // Only Mantle of Majesty and Misty Wanderer are active buffs.
      mockActiveBuffs([{ name: 'Mantle of Majesty' }, { name: 'Misty Wanderer' }]);
      const stats = createStats([], {
        bonusActions: [
          // active, array spell value → both names included
          { name: 'Mantle of Majesty', type: 'free_spell', spell: ['Command', 'Thaumaturgy'], casting_time: '1 bonus action' },
          // inactive feature → excluded
          { name: 'Fey Presence', type: 'fey_reinforcements', spell: 'Faerie Fire', casting_time: '1 bonus action' },
          // active-ish but wrong casting time → excluded
          { name: 'Mantle of Majesty', type: 'free_spell', spell: 'Charm Person', casting_time: '1 action' },
        ],
        specialActions: [
          // misty_wanderer is allowed in specialActions (no casting-time requirement)
          { name: 'Misty Wanderer', type: 'misty_wanderer', spell: 'Misty Step' },
          // type not in the specialActions allowlist → excluded
          { name: 'Misty Wanderer', type: 'charged_ability', spell: 'Hidden Step' },
        ],
      });
      expect(getBonusActionSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Command', 'Thaumaturgy', 'Misty Step']));
    });
  });

  describe('getReactionSpellNames', () => {
    it('includes prepared reaction spells only', () => {
      const stats = createStats([
        { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared', damage: '1d4' },
        { name: 'Feather Fall', casting_time: 'Reaction', prepared: 'Always' },
        { name: 'Hidden Reaction', casting_time: '1 reaction', prepared: 'Not Prepared', damage: '1d4' },
        { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
      ]);
      expect(getReactionSpellNames(stats)).toEqual(new Set(['Shield', 'Feather Fall']));
    });
  });

  describe('getExcludedSpellNames', () => {
    it('unions action, bonus, and reaction spell names including automation feature spells', () => {
      mockActiveBuffs([{ name: 'Mantle of Majesty' }]);
      const stats = createStats(
        [
          { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
          { name: 'Shocking Grasp', casting_time: '1 bonus action', prepared: 'Prepared', damage: '1d8' },
          { name: 'Shield', casting_time: '1 reaction', prepared: 'Prepared', damage: '1d4' },
          { name: 'Prestidigitation', casting_time: '1 action', prepared: 'Always' },
        ],
        { bonusActions: [{ name: 'Mantle of Majesty', type: 'free_spell', spell: 'Command', casting_time: '1 bonus action' }] }
      );
      expect(getExcludedSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Fireball', 'Shocking Grasp', 'Shield', 'Command']));
    });
  });

  it('falls back to normal partitioning when the runtime store throws', () => {
    getRuntimeValue.mockImplementation(() => { throw new Error('store error'); });
    const stats = createStats([
      { name: 'Fireball', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
      { name: 'Shocking Grasp', casting_time: '1 bonus action', prepared: 'Prepared', damage: '1d8' },
    ]);
    expect(getActionSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Fireball']));
    expect(getBonusActionSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Shocking Grasp']));
  });

  it('returns empty sets when spell data is missing', () => {
    for (const spellAbilities of [undefined, null, {}]) {
      const stats = { name: 'TestCharacter', spellAbilities };
      expect(getActionSpellNames(stats, CAMPAIGN)).toEqual(new Set());
      expect(getBonusActionSpellNames(stats, CAMPAIGN)).toEqual(new Set());
      expect(getReactionSpellNames(stats)).toEqual(new Set());
      expect(getExcludedSpellNames(stats, CAMPAIGN)).toEqual(new Set());
    }
  });
});
