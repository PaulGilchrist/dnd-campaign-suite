// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(),
  applyHeroesFeastEffect: vi.fn(),
  applyLesserRestorationEffect: vi.fn(),
  applyMageArmorEffect: vi.fn(),
  applyShieldOfFaithEffect: vi.fn(),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve(null)),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/charmPersonService.js', () => ({
  triggerCharmPerson: vi.fn(),
}));

vi.mock('../../services/rules/features/charmMonsterService.js', () => ({
  triggerCharmMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/banishmentService.js', () => ({
  triggerBanishment: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/healService.js', () => ({
  triggerHeal: vi.fn(),
}));

vi.mock('../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
}));

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ creatures: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

// ── Upcast maxTargets parsing ─────────────────────────────────────────────────
// Tests verify that spell gates which use extractMaxTargets correctly parse the
// "N targets" string from upcast_at_slot_level and set pending.maxTargets.

describe('useSpellMetamagicFlow — upcast maxTargets parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  const spellCases = [
    { name: 'Hold Monster', level: 5, upcastLevel: 7, upcastSlotKey: '7', expectedMaxTargets: 4 },
    { name: 'Charm Monster', level: 4, upcastLevel: 6, upcastSlotKey: '6', expectedMaxTargets: 5 },
    { name: 'Banishment', level: 4, upcastLevel: 5, upcastSlotKey: '5', expectedMaxTargets: 2 },
  ];

  for (const { name, level, upcastLevel, upcastSlotKey, expectedMaxTargets } of spellCases) {
    it(`parses maxTargets from ${name} upcast_at_slot_level["${upcastSlotKey}"]`, () => {
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
      );

      const pendingKey = name === 'Hold Monster' ? 'pendingHoldMonster'
        : name === 'Charm Monster' ? 'pendingCharmMonster'
        : 'pendingBanishment';

      act(() => {
        result.current.gateMetamagic(makeSpell({
          name,
          level,
          upcastLevel,
          upcast_at_slot_level: { [upcastSlotKey]: `${expectedMaxTargets} targets` },
        }));
      });

      const pending = result.current[pendingKey];
      expect(pending).not.toBeNull();
      expect(pending.maxTargets).toBe(expectedMaxTargets);
      expect(pending.spellName).toBe(name);
      expect(pending.creatureTargets).toContain('Goblin A');
    });
  }

  it('returns null maxTargets when upcast_at_slot_level has no matching slot key', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 8,
        upcast_at_slot_level: { '7': '4 targets' },
      }));
    });

    expect(result.current.pendingHoldMonster.maxTargets).toBeNull();
  });

  it('returns null maxTargets when upcast_at_slot_level is missing', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 7,
      }));
    });

    expect(result.current.pendingHoldMonster.maxTargets).toBeNull();
  });

  it('returns null maxTargets when upcast_at_slot_value is not a string', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 7,
        upcast_at_slot_level: { '7': 42 },
      }));
    });

    expect(result.current.pendingHoldMonster.maxTargets).toBeNull();
  });

  it('parses maxTargets from value with surrounding text (regex finds embedded number)', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 7,
        upcast_at_slot_level: { '7': 'up to 4 targets or more' },
      }));
    });

    // The regex /(\d+)\s+targets?/i finds the first number before "targets"
    expect(result.current.pendingHoldMonster.maxTargets).toBe(4);
  });

  it('falls back to spell.level when upcastLevel is not provided', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 7,
        upcast_at_slot_level: { '7': '4 targets' },
      }));
    });

    expect(result.current.pendingHoldMonster.maxTargets).toBe(4);
  });

  it('returns null maxTargets when upcast_at_slot_level is not an object', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 7,
        upcast_at_slot_level: '4 targets',
      }));
    });

    expect(result.current.pendingHoldMonster.maxTargets).toBeNull();
  });

  it('returns null maxTargets when upcast_at_slot_level is null', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 7,
        upcast_at_slot_level: null,
      }));
    });

    expect(result.current.pendingHoldMonster.maxTargets).toBeNull();
  });

  it('parses singular "target" variant', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 7,
        upcast_at_slot_level: { '7': '1 target' },
      }));
    });

    expect(result.current.pendingHoldMonster.maxTargets).toBe(1);
  });

  it('parses uppercase "TARGETS" variant', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 7,
        upcast_at_slot_level: { '7': '10 TARGETS' },
      }));
    });

    expect(result.current.pendingHoldMonster.maxTargets).toBe(10);
  });
});
