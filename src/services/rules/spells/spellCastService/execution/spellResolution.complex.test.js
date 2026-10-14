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
import { resolveSpellDamageWithTypes } from '../../../core/spellDamageUtils.js';

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

describe('spellResolution (complex scenarios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getActiveBuffs.mockReturnValue([]);
    isInnateSorceryActive.mockReturnValue(false);
    getSilenceSource.mockReturnValue(null);
    isCreatureInSilenceZone.mockReturnValue(false);
    getPsychicSpellsConfig.mockReturnValue(null);
    getRuntimeValue.mockReturnValue([]);
    resolveSpellDamageWithTypes.mockReturnValue(null);
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — damage resolution                       */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — damage resolution', () => {
    it('resolves damageInfo from resolveSpellDamageWithTypes', () => {
      const damageInfo = { formula: '8d6', primaryType: 'Fire' };
      resolveSpellDamageWithTypes.mockReturnValue(damageInfo);

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.damageInfo).toEqual(damageInfo);
      expect(result.formula).toBe('8d6');
      expect(result.damageType).toBe('Fire');
    });

    it('defaults formula/damageType when resolveSpellDamageWithTypes returns null', () => {
      resolveSpellDamageWithTypes.mockReturnValue(null);

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.damageInfo).toBeNull();
      expect(result.formula).toBeNull();
      expect(result.damageType).toBe('Fire');
    });

    it('falls back to spell.damage.damage_type when resolveSpellDamageWithTypes returns null', () => {
      resolveSpellDamageWithTypes.mockReturnValue(null);
      const spell = makeSpell({ damage: { damage_type: 'Lightning' } });

      const result = resolveSpellResolution(
        spell,
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.damageType).toBe('Lightning');
    });

    it('sets effectiveDamageType from damageType by default', () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '1d8', primaryType: 'Cold' });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.effectiveDamageType).toBe('Cold');
    });

    it('overrides effectiveDamageType with psychicSpellsConfig.damageType', () => {
      getPsychicSpellsConfig.mockReturnValue({ damageType: 'Psychic' });
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '1d8', primaryType: 'Fire' });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.effectiveDamageType).toBe('Psychic');
    });

    it('does not override effectiveDamageType when psychicSpellsConfig exists but spell has no damage', () => {
      getPsychicSpellsConfig.mockReturnValue({ damageType: 'Psychic' });
      resolveSpellDamageWithTypes.mockReturnValue(null);

      const spell = makeSpell({ damage: undefined });
      const result = resolveSpellResolution(
        spell,
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.effectiveDamageType).toBe('');
    });

    it('does not override effectiveDamageType when psychicSpellsConfig exists but damageType is empty', () => {
      getPsychicSpellsConfig.mockReturnValue({ damageType: 'Psychic' });
      resolveSpellDamageWithTypes.mockReturnValue(null);

      const spell = makeSpell({ damage: {} });
      const result = resolveSpellResolution(
        spell,
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.effectiveDamageType).toBe('');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — spell stats (ability, toHit, saveDc)   */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — spell stats', () => {
    it('uses spell.spellCastingAbility when present', () => {
      const spell = makeSpell({ spellCastingAbility: 'Wisdom' });

      const result = resolveSpellResolution(
        spell,
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.cantripSpellAbility).toBe('Wisdom');
    });

    it('falls back to playerStats.spellAbilities.spellCastingAbility', () => {
      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.cantripSpellAbility).toBe('Intelligence');
    });

    it('sets spellToHit from playerStats.spellAbilities.toHit', () => {
      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.spellToHit).toBe(9);
    });

    it('defaults spellToHit to 0 when spellAbilities is missing', () => {
      const playerStats = makePlayerStats({ spellAbilities: null });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.spellToHit).toBe(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — save DC resolution                      */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — save DC', () => {
    it('uses playerStats.spellAbilities.saveDc when present', () => {
      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.spellSaveDc).toBe(17);
    });

    it('calculates save DC from proficiency when saveDc is missing', () => {
      const playerStats = makePlayerStats({
        spellAbilities: { toHit: 9, modifier: 5 },
      });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.spellSaveDc).toBe(12); // 8 + 4
    });

    it('throws when saveDc is missing and proficiency is also missing', () => {
      const playerStats = makePlayerStats({
        spellAbilities: { toHit: 9, modifier: 5 },
        proficiency: null,
      });

      expect(() =>
        resolveSpellResolution(makeSpell(), {}, playerStats, 'test-campaign', null),
      ).toThrow('playerStats.proficiency is required for spell save DC calculation');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — cantrip ability path                    */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — cantrip ability path', () => {
    it('calculates spellToHit and spellSaveDc from ability when cantripSpellAbility matches', () => {
      const playerStats = makePlayerStats({
        spellAbilities: {
          spellCastingAbility: 'Intelligence',
          toHit: 99,
          saveDc: 99,
          modifier: 5,
        },
      });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      // ability.bonus(5) + proficiency(4) = 9
      expect(result.spellToHit).toBe(9);
      // 8 + ability.bonus(5) + proficiency(4) = 17
      expect(result.spellSaveDc).toBe(17);
      expect(result.spellCastingMod).toBe(5);
    });

    it('does not override when cantripSpellAbility does not match any ability', () => {
      const playerStats = makePlayerStats({
        spellAbilities: {
          spellCastingAbility: 'Charisma',
          toHit: 99,
          saveDc: 99,
          modifier: 7,
        },
        abilities: [{ name: 'Intelligence', bonus: 5 }],
      });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      // No matching ability — spellCastingMod stays at default 0 because
      // the else-if branch is unreachable when cantripSpellAbility && abilities are both truthy
      expect(result.spellToHit).toBe(99);
      expect(result.spellSaveDc).toBe(99);
      expect(result.spellCastingMod).toBe(0);
    });

    it('does not override when playerStats.abilities is missing', () => {
      const playerStats = makePlayerStats({
        spellAbilities: {
          spellCastingAbility: 'Intelligence',
          toHit: 99,
          saveDc: 99,
          modifier: 7,
        },
        abilities: null,
      });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.spellToHit).toBe(99);
      expect(result.spellSaveDc).toBe(99);
      expect(result.spellCastingMod).toBe(7);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — spellCastingMod fallback                */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — spellCastingMod fallback', () => {
    it('uses ability.bonus when cantripSpellAbility matches and ability exists', () => {
      const playerStats = makePlayerStats({
        spellAbilities: null,
      });

      const result = resolveSpellResolution(
        makeSpell({ spellCastingAbility: 'Intelligence' }),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.spellCastingMod).toBe(5);
    });

    it('does not fall through to spellAbilities.modifier when cantripSpellAbility is set but ability not found', () => {
      const playerStats = makePlayerStats({
        spellAbilities: {
          spellCastingAbility: 'Charisma',
          modifier: 3,
        },
        abilities: [{ name: 'Intelligence', bonus: 5 }],
      });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      // cantripSpellAbility='Charisma' && abilities exists => enters first if,
      // but find(Charisma) returns undefined, so spellCastingMod stays at default 0
      // The else-if is unreachable in this case
      expect(result.spellCastingMod).toBe(0);
    });

    it('defaults to 0 when cantripSpellAbility is missing and spellAbilities has no modifier', () => {
      const playerStats = makePlayerStats({
        spellAbilities: { toHit: 5 },
        abilities: null,
      });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.spellCastingMod).toBe(0);
    });

    it('defaults to 0 when cantripSpellAbility is missing and spellAbilities is null', () => {
      const playerStats = makePlayerStats({
        spellAbilities: null,
        abilities: null,
      });

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        playerStats,
        'test-campaign',
        null,
      );

      expect(result.spellCastingMod).toBe(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  resolveSpellResolution — innate sorcery                          */
  /* ---------------------------------------------------------------- */

  describe('resolveSpellResolution — innate sorcery', () => {
    it('sets innateSorceryActive from isInnateSorceryActive', () => {
      isInnateSorceryActive.mockReturnValue(true);

      const result = resolveSpellResolution(
        makeSpell(),
        {},
        makePlayerStats(),
        'test-campaign',
        null,
      );

      expect(result.innateSorceryActive).toBe(true);
    });
  });
});
