// @maintained-by-ai: 2026-10-15
// Generic upcast maxTargets threading through the gate lane: extractMaxTargets
// (spellGateHelpers.js) parsing the "N targets" string from upcast_at_slot_level
// into pending.maxTargets for Charm Monster and Banishment — the two gates no
// sibling lane pins (cla086 owns the heal-slot seam, sp075 the Magic Missile
// darts, sp127 the Aid ladder, gate.test.js the Hold Monster lv6 parse and the
// gate-open breadth). Fixtures mirror public/data/2024/spells.json ladders (the
// 5e rows for these spells carry no upcast_at_slot_level). Defensive-branch
// coverage (missing ladder / non-string value / no matching key / regex variants)
// is unique to this lane and kept as folded tables.
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
  isWizardRitualAdeptSpell: vi.fn(() => false),
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

const UPCAST_LADDER_4TO9 = { 4: '1 target', 5: '2 targets', 6: '3 targets', 7: '4 targets', 8: '5 targets', 9: '6 targets' };

function gate(spellOverrides, pendingKey) {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: 'TestSorcerer', class: { name: 'Sorcerer' }, level: 9 },
      campaignName: 'TestCampaign',
      onExecute: vi.fn(),
    })
  );
  act(() => {
    result.current.gateMetamagic({
      casting_time: '1 action',
      ...spellOverrides,
    });
  });
  return result.current[pendingKey];
}

describe('useSpellMetamagicFlow — extractMaxTargets threading (Charm Monster / Banishment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  // 2024 spells.json ladders: both spells scale +1 target per slot above 4th.
  it.each([
    { name: 'Charm Monster', pendingKey: 'pendingCharmMonster', upcastLevel: 4, expectedMaxTargets: 1 },
    { name: 'Charm Monster', pendingKey: 'pendingCharmMonster', upcastLevel: 6, expectedMaxTargets: 3 },
    { name: 'Banishment', pendingKey: 'pendingBanishment', upcastLevel: 5, expectedMaxTargets: 2 },
    { name: 'Banishment', pendingKey: 'pendingBanishment', upcastLevel: 7, expectedMaxTargets: 4 },
  ])('$name at slot $upcastLevel threads maxTargets $expectedMaxTargets onto the pending', ({ name, pendingKey, upcastLevel, expectedMaxTargets }) => {
    const pending = gate({
      name,
      level: 4,
      range: '30 feet',
      upcastLevel,
      upcast_at_slot_level: UPCAST_LADDER_4TO9,
    }, pendingKey);

    expect(pending).not.toBeNull();
    expect(pending.spellName).toBe(name);
    expect(pending.maxTargets).toBe(expectedMaxTargets);
    expect(pending.creatureTargets).toContain('Goblin A');
  });

  // /(\d+)\s+targets?/i grammar variants, folded across one spell.
  it.each([
    ['1 target', 1],
    ['up to 4 targets or more', 4],
    ['10 TARGETS', 10],
  ])('regex variant %o parses to %i', (raw, expectedMaxTargets) => {
    const pending = gate({
      name: 'Charm Monster',
      level: 4,
      upcastLevel: 6,
      upcast_at_slot_level: { '6': raw },
    }, 'pendingCharmMonster');

    expect(pending.maxTargets).toBe(expectedMaxTargets);
  });

  it('falls back to spell.level when upcastLevel is not provided', () => {
    const pending = gate({
      name: 'Charm Monster',
      level: 6,
      upcast_at_slot_level: UPCAST_LADDER_4TO9,
    }, 'pendingCharmMonster');

    expect(pending.maxTargets).toBe(3);
  });

  // Defensive branches: every malformed ladder shape must yield null maxTargets
  // (the gate stays open; the picker then runs uncapped).
  it.each([
    ['missing ladder', undefined],
    ['null ladder', null],
    ['string ladder', '4 targets'],
    ['no matching slot key', { 7: '4 targets' }],
    ['non-string rung', { 6: 42 }],
  ])('returns null maxTargets when the ladder is %s', (_label, ladder) => {
    const pending = gate({
      name: 'Charm Monster',
      level: 4,
      upcastLevel: 6,
      ...(ladder === undefined ? {} : { upcast_at_slot_level: ladder }),
    }, 'pendingCharmMonster');

    expect(pending).not.toBeNull();
    expect(pending.maxTargets).toBeNull();
  });
});
