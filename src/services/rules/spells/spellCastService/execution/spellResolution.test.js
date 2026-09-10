// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — the surface area that spellResolution.js imports           */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_playerName, _key, _campaignName) => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/class-warlock/psychicSpellsHandler.js', () => ({
  getPsychicSpellsConfig: vi.fn(() => null),
}));

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */
/*  SUT imports after mocks are established                            */
/* ------------------------------------------------------------------ */

import { resolveSpellResolution } from './spellResolution.js';
import { getActiveBuffs, isInnateSorceryActive } from '../../../../combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { getPsychicSpellsConfig } from '../../../../automation/handlers/class-warlock/psychicSpellsHandler.js';
import { getSilenceSource, isCreatureInSilenceZone } from '../../../features/silenceService.js';
import { endFriendsOnHostileAction } from '../../../features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';
import { addEntry } from '../../../../ui/logService.js';

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'dex', dc_success: 'half' },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  beforeEach — reset all mock implementations to safe defaults       */
/* ------------------------------------------------------------------ */

describe('spellResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getActiveBuffs.mockReturnValue([]);
    isInnateSorceryActive.mockReturnValue(false);
    getSilenceSource.mockReturnValue(null);
    isCreatureInSilenceZone.mockReturnValue(false);
    getPsychicSpellsConfig.mockReturnValue(null);
    getRuntimeValue.mockReturnValue([]);
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — basic defaults                          */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution defaults', () => {
    const spell = makeSpell();
    const playerStats = makePlayerStats();

    it('returns a result with correct defaults for a basic spell', () => {
      const result = resolveSpellResolution(spell, {}, playerStats, 'test-campaign', null);

      expect(result.globeTargetName).toBeNull();
      expect(result.magicalAmbush).toBe(false);
      expect(result.casterConditions).toEqual([]);
      expect(result.hasInvisible).toBe(false);
      expect(result.psychicSpellsConfig).toBeNull();
      expect(result.spellLevel).toBe(3);
      expect(result.innateSorceryActive).toBe(false);
      expect(result.damageInfo).toBeNull();
      expect(result.formula).toBeNull();
      expect(result.damageType).toBe('Fire');
      expect(result.effectiveDamageType).toBe('Fire');
      expect(result.cantripSpellAbility).toBe('Intelligence');
      expect(result.spellToHit).toBe(9);
      expect(result.spellSaveDc).toBe(17);
      expect(result.spellCastingMod).toBe(5);
      expect(result.fullSpell).toBe(spell);
      // needsLookup is true because makeSpell has no area_of_effect
      expect(result.needsLookup).toBe(true);
    });

    it('uses spell.level from the spell object', () => {
      const spell = makeSpell({ level: 5 });
      const result = resolveSpellResolution(spell, {}, playerStats, 'test-campaign', null);
      expect(result.spellLevel).toBe(5);
    });

    it('defaults spellLevel to 1 when spell has no level', () => {
      const spell = makeSpell({ level: undefined });
      const result = resolveSpellResolution(spell, {}, playerStats, 'test-campaign', null);
      expect(result.spellLevel).toBe(1);
    });

    it('sets needsLookup when spell has no area_of_effect', () => {
      const spell = makeSpell({ area_of_effect: undefined });
      const result = resolveSpellResolution(spell, {}, playerStats, 'test-campaign', null);
      expect(result.needsLookup).toBe(true);
    });

    it('sets needsLookup when spell has automation.type but no automation.effects', () => {
      const spell = makeSpell({ automation: { type: 'damage' } });
      const result = resolveSpellResolution(spell, {}, playerStats, 'test-campaign', null);
      expect(result.needsLookup).toBe(true);
    });

    it('does not set needsLookup when spell has both area_of_effect and automation.effects', () => {
      const spell = makeSpell({
        area_of_effect: { type: 'cone', size: 60 },
        automation: { type: 'damage', effects: ['damage'] },
      });
      const result = resolveSpellResolution(spell, {}, playerStats, 'test-campaign', null);
      expect(result.needsLookup).toBe(false);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  CLA-212 — per-spell casting-ability override (LightBearer)     */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — per-spell spellCastingAbility override (CLA-212 LightBearer)', () => {
    // War_Cleric shape: 2024 Aasimar Light Domain Cleric lv6, WIS 9/-1, CHA 16/+3, PB +3.
    const clericStats = makePlayerStats({
      name: 'War_Cleric',
      proficiency: 3,
      abilities: [
        { name: 'Wisdom', bonus: -1 },
        { name: 'Charisma', bonus: 3 },
      ],
      spellAbilities: {
        spellCastingAbility: 'Wisdom',
        toHit: 2,
        saveDc: 10,
        modifier: -1,
      },
    });

    it('resolves a Light cantrip carrying spellCastingAbility Charisma on Charisma math', () => {
      const light = makeSpell({
        name: 'Light',
        level: 0,
        attack_type: null,
        dc: undefined,
        damage: undefined,
        spellCastingAbility: 'Charisma',
      });

      const result = resolveSpellResolution(light, {}, clericStats, 'test-campaign', null);

      expect(result.cantripSpellAbility).toBe('Charisma');
      expect(result.spellToHit).toBe(6); // CHA +3 + PB +3
      expect(result.spellSaveDc).toBe(14); // 8 + CHA +3 + PB +3
      expect(result.spellCastingMod).toBe(3);
    });

    it('falls back to the class ability when the spell carries no override', () => {
      const light = makeSpell({ name: 'Light', level: 0, attack_type: null, dc: undefined, damage: undefined });

      const result = resolveSpellResolution(light, {}, clericStats, 'test-campaign', null);

      expect(result.cantripSpellAbility).toBe('Wisdom');
      expect(result.spellToHit).toBe(2);
      expect(result.spellSaveDc).toBe(10);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — buff blocking                           */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — buff blocking', () => {
    it('returns { blockedByBuffs: true } when a buff blocks spellcasting', () => {
      getActiveBuffs.mockReturnValue([{ name: 'Silence', blocksSpellcasting: true }]);

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result).toEqual({ blockedByBuffs: true });
    });

    it('logs a *_refused automation entry when blocked by a blocksSpellcasting buff (CLA-391)', () => {
      getActiveBuffs.mockReturnValue([{ name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true }]);

      resolveSpellResolution(makeSpell(), {}, makePlayerStats(), 'test-campaign', null);

      const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'shape_shift_refused');
      expect(refusal).toBeDefined();
      expect(refusal.type).toBe('automation');
      expect(refusal.creatureName).toBe('TestWizard');
      expect(refusal.name).toBe('Wild Shape');
      expect(refusal.description).toContain('Fireball blocked');
    });

    it('continues normally when no buff blocks spellcasting', () => {
      getActiveBuffs.mockReturnValue([{ name: 'Shield', blocksSpellcasting: false }]);

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.blockedByBuffs).toBeUndefined();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — globe target name                       */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — globe target name', () => {
    it('resolves globeTargetName from async getTargetInfo', async () => {
      const targetInfo = vi.fn(() => Promise.resolve({ name: 'Goblin' }));
      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        targetInfo,
      );

      // globeTargetName is a Promise
      expect(result.globeTargetName).toBeInstanceOf(Promise);
      const resolved = await result.globeTargetName;
      expect(resolved).toBe('Goblin');
    });

    it('returns null when getTargetInfo returns undefined', async () => {
      const targetInfo = vi.fn(() => Promise.resolve(undefined));
      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        targetInfo,
      );

      const resolved = await result.globeTargetName;
      expect(resolved).toBeNull();
    });

    it('returns null when getTargetInfo returns object without name', async () => {
      const targetInfo = vi.fn(() => Promise.resolve({}));
      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        targetInfo,
      );

      const resolved = await result.globeTargetName;
      expect(resolved).toBeNull();
    });

    it('sets globeTargetName to null when getTargetInfo is not provided', () => {
      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.globeTargetName).toBeNull();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — magical ambush + invisibility           */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — magical ambush + invisibility', () => {
    it('sets magicalAmbush and hasInvisible when passive exists and caster is invisible', () => {
      const playerStats = makePlayerStats({
        automation: {
          passives: [{ type: 'passive_rule', effect: 'magical_ambush' }],
        },
      });
      getRuntimeValue.mockReturnValue(['invisible']);

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.magicalAmbush).toBe(true);
      expect(result.casterConditions).toEqual(['invisible']);
      expect(result.hasInvisible).toBe(true);
    });

    it('sets magicalAmbush to false when no magical_ambush passive', () => {
      const playerStats = makePlayerStats({
        automation: { passives: [] },
      });
      getRuntimeValue.mockReturnValue(['invisible']);

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.magicalAmbush).toBe(false);
      expect(result.hasInvisible).toBe(false);
    });

    it('sets hasInvisible to false when not invisible despite magical ambush', () => {
      const playerStats = makePlayerStats({
        automation: {
          passives: [{ type: 'passive_rule', effect: 'magical_ambush' }],
        },
      });
      getRuntimeValue.mockReturnValue(['burning']);

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.hasInvisible).toBe(false);
    });

    it('throws when passives is null', () => {
      const playerStats = makePlayerStats({ automation: { passives: null } });

      expect(() =>
        resolveSpellResolution(makeSpell(), {}, playerStats, 'test-campaign', null),
      ).toThrow('playerStats.automation.passives is required for magical ambush check');
    });

    it('throws when passives is undefined', () => {
      const playerStats = makePlayerStats({ automation: {} });

      expect(() =>
        resolveSpellResolution(makeSpell(), {}, playerStats, 'test-campaign', null),
      ).toThrow('playerStats.automation.passives is required for magical ambush check');
    });

    it('throws when activeConditions is null', () => {
      getRuntimeValue.mockReturnValue(null);
      const playerStats = makePlayerStats();

      expect(() =>
        resolveSpellResolution(makeSpell(), {}, playerStats, 'test-campaign', null),
      ).toThrow('activeConditions must be an array for caster');
    });

    it('throws when activeConditions is not an array', () => {
      getRuntimeValue.mockReturnValue('not-an-array');
      const playerStats = makePlayerStats();

      expect(() =>
        resolveSpellResolution(makeSpell(), {}, playerStats, 'test-campaign', null),
      ).toThrow('activeConditions must be an array for caster');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — silence blocking                        */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — silence blocking', () => {
    it('returns { blockedBySilence: true } when spell has Verbal and caster is silenced', () => {
      getSilenceSource.mockReturnValue('SilenceCaster');
      isCreatureInSilenceZone.mockReturnValue(true);

      const result = resolveSpellResolution(
        makeSpell({ components: ['V', 'S'] }),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result).toEqual({ blockedBySilence: true });
      const blockLog = addEntry.mock.calls.find(
        (c) => c[1].type === 'automation' && c[1].name === 'Silence'
      );
      expect(blockLog).toBeDefined();
      expect(blockLog[1].description).toContain('blocked');
      expect(blockLog[1].description).toContain('Fireball');
    });

    it('does not block when spell has no Verbal component', () => {
      getSilenceSource.mockReturnValue('SilenceCaster');
      isCreatureInSilenceZone.mockReturnValue(true);

      const result = resolveSpellResolution(
        makeSpell({ components: ['S'] }),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.blockedBySilence).toBeUndefined();
    });

    it('does not block when getSilenceSource returns null', () => {
      getSilenceSource.mockReturnValue(null);

      const result = resolveSpellResolution(
        makeSpell({ components: ['V'] }),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.blockedBySilence).toBeUndefined();
    });

    it('does not block when isCreatureInSilenceZone returns false', () => {
      getSilenceSource.mockReturnValue('SilenceCaster');
      isCreatureInSilenceZone.mockReturnValue(false);

      const result = resolveSpellResolution(
        makeSpell({ components: ['V'] }),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.blockedBySilence).toBeUndefined();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — psychic spells                          */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — psychic spells', () => {
    const psychicConfig = {
      spellSchools: ['Enchantment', 'Illusion'],
      componentReduction: ['V', 'S'],
      damageType: 'Psychic',
    };

    it('removes Verbal and Somatic components for matching school spells', () => {
      getPsychicSpellsConfig.mockReturnValue(psychicConfig);
      const spell = makeSpell({
        school: 'Enchantment',
        components: ['V', 'S', 'M'],
      });

      const result = resolveSpellResolution(
        spell,
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.psychicSpellsConfig).toEqual(psychicConfig);
      // Components should be reduced to ['M']
      expect(spell.components).toEqual(['M']);
    });

    it('does not modify components for non-matching school', () => {
      getPsychicSpellsConfig.mockReturnValue(psychicConfig);
      const spell = makeSpell({
        school: 'Evocation',
        components: ['V', 'S'],
      });

      resolveSpellResolution(spell, {}, makePlayerStats(), 'test-campaign', null);

      expect(spell.components).toEqual(['V', 'S']);
    });

    it('handles case-insensitive school matching', () => {
      getPsychicSpellsConfig.mockReturnValue(psychicConfig);
      const spell = makeSpell({
        school: 'enchantment',
        components: ['V', 'S'],
      });

      resolveSpellResolution(spell, {}, makePlayerStats(), 'test-campaign', null);

      expect(spell.components).toEqual([]);
    });

    it('handles undefined spell components gracefully', () => {
      getPsychicSpellsConfig.mockReturnValue(psychicConfig);
      const spell = makeSpell({ components: undefined });

      const result = resolveSpellResolution(
        spell,
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.psychicSpellsConfig).toEqual(psychicConfig);
    });

    it('does not modify components when psychicSpellsConfig is null', () => {
      getPsychicSpellsConfig.mockReturnValue(null);
      const spell = makeSpell({ school: 'Enchantment', components: ['V', 'S'] });

      resolveSpellResolution(spell, {}, makePlayerStats(), 'test-campaign', null);

      expect(spell.components).toEqual(['V', 'S']);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — Friends / Invisibility end             */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — Friends / Invisibility end', () => {
    it('calls endFriendsOnHostileAction for non-Friends spells', () => {
      const spell = makeSpell({ name: 'Fireball' });

      resolveSpellResolution(spell, {}, makePlayerStats(), 'test-campaign', null);

      expect(endFriendsOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });

    it('does NOT call endFriendsOnHostileAction for Friends spell', () => {
      const spell = makeSpell({ name: 'Friends' });

      resolveSpellResolution(spell, {}, makePlayerStats(), 'test-campaign', null);

      expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
    });

    it('calls endInvisibilityOnHostileAction for all spells', () => {
      const spell = makeSpell();

      resolveSpellResolution(spell, {}, makePlayerStats(), 'test-campaign', null);

      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });

    it('calls endInvisibilityOnHostileAction even for Friends spell', () => {
      const spell = makeSpell({ name: 'Friends' });

      resolveSpellResolution(spell, {}, makePlayerStats(), 'test-campaign', null);

      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });
  });
});
