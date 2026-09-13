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

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      // Dead so the SP-100 Revivify dead-target gate arms pending.
      { name: 'Goblin C', type: 'monster', currentHp: 0 },
    ],
  })),
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

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
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

describe('useSpellMetamagicFlow — complex spell skip handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  describe('pending state clears on skip', () => {
    // These spells use complex/custom handlers (not in simple-handlers.test.js)
    // and go through gateMetamagic which sets pending state for sorcerers.
    // Note: Hold Person, Charm Person, Animal Shapes, and Animal Friendship
    // are excluded here because their gate handlers filter creatures by type
    // (humanoids/beasts/allies) and the test mocks only provide goblins.
    const skipCases = [
      { spell: 'Magic Missile', level: 1, handler: 'handleMagicMissileSkip', pending: 'pendingMagicMissile' },
      { spell: 'Healing Word', level: 1, handler: 'handleHealingWordSkip', pending: 'pendingHealingWord' },
      { spell: 'Cure Wounds', level: 1, handler: 'handleCureWoundsSkip', pending: 'pendingCureWounds' },
      { spell: 'Hold Monster', level: 5, handler: 'handleHoldMonsterSkip', pending: 'pendingHoldMonster' },
      { spell: 'Polymorph', level: 4, handler: 'handlePolymorphSkip', pending: 'pendingPolymorph' },
      { spell: 'Charm Monster', level: 4, handler: 'handleCharmMonsterSkip', pending: 'pendingCharmMonster' },
      { spell: 'Prismatic Spray', level: 7, handler: 'handlePrismaticSpraySkip', pending: 'pendingPrismaticSpray' },
      { spell: 'Revivify', level: 5, handler: 'handleRevivifySkip', pending: 'pendingRevivify' },
      { spell: 'Greater Restoration', level: 5, handler: 'handleGreaterRestorationSkip', pending: 'pendingGreaterRestoration' },
    ];

    for (const tc of skipCases) {
      it(`clears ${tc.pending} when ${tc.handler} is called for ${tc.spell}`, () => {
        const setPopupHtml = vi.fn();
        const { result } = renderHook(() =>
          useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
        );

        act(() => {
          result.current.gateMetamagic(makeSpell({ name: tc.spell, level: tc.level }));
        });

        expect(result.current[tc.pending]).not.toBeNull();

        act(() => {
          result.current[tc.handler]();
        });

        expect(result.current[tc.pending]).toBeNull();
      });
    }
  });

  describe('area-effect skip handlers', () => {
    const areaSkipCases = [
      { spell: 'Web', level: 1, handler: 'handleWebSkip', pending: 'pendingWeb' },
      { spell: 'Confusion', level: 4, handler: 'handleConfusionSkip', pending: 'pendingConfusion' },
      { spell: 'Stinking Cloud', level: 1, handler: 'handleStinkingCloudSkip', pending: 'pendingStinkingCloud' },
      { spell: 'Antimagic Field', level: 4, handler: 'handleAntimagicFieldSkip', pending: 'pendingAntimagicField' },
      { spell: 'Forcecage', level: 7, handler: 'handleForcecageSkip', pending: 'pendingForcecage' },
      { spell: 'Globe of Invulnerability', level: 4, handler: 'handleGlobeSkip', pending: 'pendingGlobe' },
    ];

    for (const tc of areaSkipCases) {
      it(`clears ${tc.pending} when ${tc.handler} is called for ${tc.spell}`, () => {
        const setPopupHtml = vi.fn();
        const { result } = renderHook(() =>
          useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
        );

        act(() => {
          result.current.gateMetamagic(makeSpell({ name: tc.spell, level: tc.level }));
        });

        expect(result.current[tc.pending]).not.toBeNull();

        act(() => {
          result.current[tc.handler]();
        });

        expect(result.current[tc.pending]).toBeNull();
      });
    }
  });

  describe('custom handler skip handlers', () => {
    const customSkipCases = [
      { spell: 'Pass Without Trace', level: 2, handler: 'handlePassWithoutTraceSkip', pending: 'pendingPassWithoutTrace' },
      { spell: 'Barkskin', level: 2, handler: 'handleBarkskinSkip', pending: 'pendingBarkskin' },
    ];

    for (const tc of customSkipCases) {
      it(`clears ${tc.pending} when ${tc.handler} is called for ${tc.spell}`, () => {
        const setPopupHtml = vi.fn();
        const { result } = renderHook(() =>
          useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
        );

        act(() => {
          result.current.gateMetamagic(makeSpell({ name: tc.spell, level: tc.level }));
        });

        expect(result.current[tc.pending]).not.toBeNull();

        act(() => {
          result.current[tc.handler]();
        });

        expect(result.current[tc.pending]).toBeNull();
      });
    }
  });

  describe('no-op when no pending state', () => {
    it('handleMagicMissileSkip does nothing when no pending', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      const { addEntry } = vi.mocked(await import('../../services/ui/logService.js'));

      act(() => {
        result.current.handleMagicMissileSkip();
      });

      expect(addEntry).not.toHaveBeenCalled();
    });

    it('handleAnimalShapesSkip does nothing when no pending', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      const { addEntry } = vi.mocked(await import('../../services/ui/logService.js'));

      act(() => {
        result.current.handleAnimalShapesSkip();
      });

      expect(addEntry).not.toHaveBeenCalled();
    });

    it('handleTruePolymorphSkip does nothing when no pending', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      const { addEntry } = vi.mocked(await import('../../services/ui/logService.js'));

      act(() => {
        result.current.handleTruePolymorphSkip();
      });

      expect(addEntry).not.toHaveBeenCalled();
    });
  });
});
