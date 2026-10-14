import { describe, it, expect } from 'vitest';
import * as helpers from './CharSpells.test-utils.js';

describe('CharSpells.test-utils', () => {
  describe('mockPlayerStats', () => {
    it('has correct 5e ruleset metadata', () => {
      const { mockPlayerStats } = helpers;
      expect(mockPlayerStats.name).toBe('Test Character');
      expect(mockPlayerStats.rules).toBe('5e (default)');
      expect(mockPlayerStats.proficiency).toBe(4);
    });

    it('has automation and activeConditions as empty arrays', () => {
      const { mockPlayerStats } = helpers;
      expect(mockPlayerStats.automation.passives).toEqual([]);
      expect(mockPlayerStats.automation.actions).toEqual([]);
      expect(mockPlayerStats.activeConditions).toEqual([]);
    });

    it('has spellAbilities with expected properties', () => {
      const { mockPlayerStats } = helpers;
      const sa = mockPlayerStats.spellAbilities;
      expect(sa.toHit).toBe(5);
      expect(sa.modifier).toBe(3);
      expect(sa.saveDc).toBe(13);
      expect(sa.cantrips_known).toBe(3);
      expect(sa.prepared_spells).toBe(5);
      expect(sa.maxPreparedSpells).toBe(5);
      expect(sa.spell_slots_level_1).toBe(4);
      expect(sa.spell_slots_level_2).toBe(3);
    });

    it('has a spells array with expected entries', () => {
      const { mockPlayerStats } = helpers;
      const spells = mockPlayerStats.spellAbilities.spells;
      expect(Array.isArray(spells)).toBe(true);
      expect(spells.length).toBe(4);
      expect(spells.map((s) => s.name)).toEqual([
        'Fireball',
        'Magic Missile',
        'Light',
        'Detect Magic',
      ]);
    });

    it('has spell damage data for damageable spells', () => {
      const { mockPlayerStats } = helpers;
      const spells = mockPlayerStats.spellAbilities.spells;
      const fireball = spells.find((s) => s.name === 'Fireball');
      expect(fireball.damage.damage_type).toBe('Fire');
      expect(fireball.damage.damage_at_slot_level['3']).toBe('8d6');

      const magicMissile = spells.find((s) => s.name === 'Magic Missile');
      expect(magicMissile.damage.damage_type).toBe('Force');
      expect(magicMissile.damage.damage_at_slot_level['1']).toBe('1d4+1');
    });

    it('has correct casting_time for each spell', () => {
      const { mockPlayerStats } = helpers;
      const spells = mockPlayerStats.spellAbilities.spells;
      const byName = Object.fromEntries(spells.map((s) => [s.name, s]));
      expect(byName.Fireball.casting_time).toBe('1 action');
      expect(byName['Magic Missile'].casting_time).toBe('1 action');
      expect(byName.Light.casting_time).toBe('1 action');
      expect(byName['Detect Magic'].casting_time).toBe('1 action');
    });
  });

  describe('mockPlayerStats2024', () => {
    it('has correct 2024 ruleset metadata', () => {
      const { mockPlayerStats2024 } = helpers;
      expect(mockPlayerStats2024.name).toBe('Test Character');
      expect(mockPlayerStats2024.rules).toBe('2024');
    });

    it('does not have a class property', () => {
      const { mockPlayerStats2024 } = helpers;
      expect(mockPlayerStats2024.class).toBeUndefined();
    });

    it('has the same spell data as mockPlayerStats', () => {
      const { mockPlayerStats, mockPlayerStats2024 } = helpers;
      const spells1 = mockPlayerStats.spellAbilities.spells;
      const spells2 = mockPlayerStats2024.spellAbilities.spells;
      expect(spells2.length).toBe(spells1.length);
      expect(spells2.map((s) => s.name)).toEqual(spells1.map((s) => s.name));
    });
  });

  describe('mockPlayerStats2024Wizard', () => {
    it('has Wizard class metadata', () => {
      const { mockPlayerStats2024Wizard } = helpers;
      expect(mockPlayerStats2024Wizard.name).toBe('Test Wizard');
      expect(mockPlayerStats2024Wizard.rules).toBe('2024');
      expect(mockPlayerStats2024Wizard.class.name).toBe('Wizard');
    });

    it('has different spell counts from generic 2024 mock', () => {
      const { mockPlayerStats2024Wizard, mockPlayerStats2024 } = helpers;
      const wizardSpells = mockPlayerStats2024Wizard.spellAbilities.spells;
      const genericSpells = mockPlayerStats2024.spellAbilities.spells;
      expect(mockPlayerStats2024Wizard.spellAbilities.prepared_spells).toBe(4);
      expect(mockPlayerStats2024Wizard.spellAbilities.maxPreparedSpells).toBe(4);
      expect(wizardSpells.length).toBe(4);
      expect(genericSpells.length).toBe(4);
    });

    it('has unique Wizard spells (Shield, Fireball, Detect Magic, Light)', () => {
      const { mockPlayerStats2024Wizard } = helpers;
      const spells = mockPlayerStats2024Wizard.spellAbilities.spells;
      expect(spells.map((s) => s.name)).toEqual([
        'Fireball',
        'Shield',
        'Detect Magic',
        'Light',
      ]);
    });

    it('has Shield spell with reaction casting time', () => {
      const { mockPlayerStats2024Wizard } = helpers;
      const spells = mockPlayerStats2024Wizard.spellAbilities.spells;
      const shield = spells.find((s) => s.name === 'Shield');
      expect(shield).toBeDefined();
      expect(shield.casting_time).toBe('1 reaction');
      expect(shield.components).toEqual(['S']);
    });

    it('has Detect Magic marked as ritual', () => {
      const { mockPlayerStats2024Wizard } = helpers;
      const spells = mockPlayerStats2024Wizard.spellAbilities.spells;
      const detectMagic = spells.find((s) => s.name === 'Detect Magic');
      expect(detectMagic.ritual).toBe(true);
    });

    it('excludes Magic Missile present in generic 2024', () => {
      const { mockPlayerStats2024Wizard, mockPlayerStats2024 } = helpers;
      const wizardNames = mockPlayerStats2024Wizard.spellAbilities.spells.map(
        (s) => s.name,
      );
      const genericNames =
        mockPlayerStats2024.spellAbilities.spells.map((s) => s.name);
      expect(wizardNames).not.toContain('Magic Missile');
      expect(genericNames).toContain('Magic Missile');
    });
  });

  describe('mockHandleTogglePreparedSpells', () => {
    it('is a mock function', () => {
      expect(helpers.mockHandleTogglePreparedSpells).toBeInstanceOf(Function);
    });

    it('tracks call count and arguments', () => {
      const fn = helpers.mockHandleTogglePreparedSpells;
      fn.mockClear();
      expect(fn).toHaveBeenCalledTimes(0);

      fn('Fireball', true);
      fn('Light', false);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn.mock.calls[0]).toEqual(['Fireball', true]);
      expect(fn.mock.calls[1]).toEqual(['Light', false]);
    });

    it('resets to zero calls via mockClear', () => {
      const fn = helpers.mockHandleTogglePreparedSpells;
      fn();
      fn.mockClear();
      expect(fn).toHaveBeenCalledTimes(0);
    });
  });

  describe('mockGateMetamagic', () => {
    it('is a mock function', () => {
      expect(helpers.mockGateMetamagic).toBeInstanceOf(Function);
    });

    it('tracks call count and arguments', () => {
      const fn = helpers.mockGateMetamagic;
      fn.mockClear();
      fn({ spell: 'Fireball' });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0]).toEqual([{ spell: 'Fireball' }]);
    });
  });

  describe('mockGateUpcast', () => {
    it('is a mock function that returns false by default', () => {
      expect(helpers.mockGateUpcast).toBeInstanceOf(Function);
      const result = helpers.mockGateUpcast();
      expect(result).toBe(false);
    });

    it('can be overridden to return true', () => {
      const fn = helpers.mockGateUpcast;
      fn.mockClear();
      fn.mockReturnValue(true);
      expect(fn()).toBe(true);
    });

    it('resets to default false return after mockReset', () => {
      const fn = helpers.mockGateUpcast;
      fn.mockReturnValue(true);
      expect(fn()).toBe(true);
      fn.mockReset();
      expect(fn()).toBe(false);
    });
  });

  describe('mockGetCantripAutoLevel', () => {
    it('is a mock function that returns null by default', () => {
      expect(helpers.mockGetCantripAutoLevel).toBeInstanceOf(Function);
      const result = helpers.mockGetCantripAutoLevel();
      expect(result).toBe(null);
    });

    it('can be overridden to return a specific level', () => {
      const fn = helpers.mockGetCantripAutoLevel;
      fn.mockClear();
      fn.mockReturnValue(2);
      expect(fn()).toBe(2);
    });

    it('resets to default null return after mockReset', () => {
      const fn = helpers.mockGetCantripAutoLevel;
      fn.mockReturnValue(1);
      expect(fn()).toBe(1);
      fn.mockReset();
      expect(fn()).toBe(null);
    });
  });
});
