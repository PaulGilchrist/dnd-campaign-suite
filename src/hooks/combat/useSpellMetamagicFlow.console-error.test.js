// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
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

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — null creatures behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  // When getCombatSummary returns creatures: null, gate handlers that call
  // getCsAndTargets log a console.error and return early without setting any
  // pending state. This is the same behavior verified for individual spells in
  // useSpellMetamagicFlow.gate.test.js; this file tests the behavior with a
  // representative subset of gate handler categories.

  const gateSpellNames = [
    'Foresight',
    'Sanctuary',
    'Stone Skin',
    'Greater Restoration',
    'Aid',
    'Slow',
    'Haste',
    'Invisibility',
    'Heal',
    'Mage Armor',
    'Magic Missile',
    'Globe of Invulnerability',
    'Regenerate',
    'Cure Wounds',
  ];

  for (const spellName of gateSpellNames) {
    it(`logs console.error for ${spellName} gate when creatures is null`, () => {
      const spy = vi.spyOn(console, 'error');
      getCombatSummary.mockReturnValueOnce({ creatures: null });

      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: spellName }));
      });

      expect(spy).toHaveBeenCalledWith(
        'Creature targets empty for unknown: cs=exists, characters.length=undefined'
      );
      // Gate handler returns false (no creatureTargets), so flow falls through
      // to Sorcerer metamagic path which sets pendingMetamagic
      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spellName).toBe(spellName);

      spy.mockRestore();
    });
  }

  // SP-100: Revivify is handled even with no creatures — it refuses instead of
  // falling through (a fall-through would spend the slot + diamond untargeted).
  it('blocks Revivify (no pendingMetamagic fall-through) when creatures is null', () => {
    const spy = vi.spyOn(console, 'error');
    getCombatSummary.mockReturnValueOnce({ creatures: null });

    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Revivify' }));
    });

    expect(spy).toHaveBeenCalledWith(
      'Creature targets empty for unknown: cs=exists, characters.length=undefined'
    );
    expect(result.current.pendingMetamagic).toBeNull();
    expect(result.current.pendingRevivify).toBeNull();

    spy.mockRestore();
  });

  // ── Non-gated spells fall through to Sorcerer metamagic flow ──────────────

  it('falls through to metamagic pending when a non-gated spell is used with null creatures', () => {
    getCombatSummary.mockReturnValueOnce({ creatures: null });

    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Shield of Faith', level: 1 }));
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellName).toBe('Shield of Faith');
  });

  // ── Non-Sorcerer flow with null creatures ────────────────────────────────

  it('non-Sorcerer falls through prepareSpellCast even when creatures is null', async () => {
    getCombatSummary.mockReturnValueOnce({ creatures: null });
    const onExecute = vi.fn();

    const { result } = renderHook(() =>
      useSpellMetamagicFlow(
        { playerStats: { name: 'TestWizard', class: { name: 'Wizard' }, level: 5 }, campaignName: 'TestCampaign', onExecute: onExecute }
      )
    );

    await act(async () => {
      await result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    expect(onExecute).toHaveBeenCalled();
  });

  // ── getMultiTargetSpreadForSpell returns truthy with null creatures ──────

  it('sets multiTarget pending when getMultiTargetSpreadForSpell returns a spread with null creatures', () => {
    getMultiTargetSpreadForSpell.mockReturnValue({ range: '30 feet' });
    getCombatSummary.mockReturnValueOnce({ creatures: null });

    const characters = [{ name: 'Ally One' }];
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: characters })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    expect(result.current.pendingMultiTarget).not.toBeNull();
    expect(result.current.pendingMultiTarget.spellName).toBe('Fireball');
    expect(result.current.pendingMultiTarget.range).toBe('30 feet');
  });
});
