// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';

const flushMicrotasks = () => new Promise(r => setTimeout(r, 0));

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'beast' })),
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
  applyShieldOfFaithEffect: vi.fn(() => Promise.resolve({ payload: 'shieldOfFaith-popup' })),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve({ payload: 'protectionFromPoison-popup' })),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve({ payload: 'barkskin-popup' })),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve({ payload: 'circleOfPower-popup' })),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve({ payload: 'auraOfVitality-popup' })),
  applyDeathWardEffect: vi.fn(() => Promise.resolve({ payload: 'deathWard-popup' })),
  applyHeroism: vi.fn(() => Promise.resolve({ payload: 'heroism-popup' })),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve({ payload: 'stoneSkin-popup' })),
  handleSanctuary: vi.fn(() => Promise.resolve({ payload: 'sanctuary-popup' })),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve({ payload: 'removeCurse-popup' })),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve({ payload: 'regenerate-popup' })),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve({ payload: 'foresight-popup' })),
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
  triggerBanishment: vi.fn(() => Promise.resolve({ payload: 'banishment-popup' })),
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
  triggerRevivify: vi.fn(() => Promise.resolve({ payload: 'revivify-popup' })),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve({ payload: 'true-polymorph-popup' })),
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
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase(), 'goblin a', 'goblin b']),
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

// ── Popup payload tests (consolidated) ────────────────────────────────────────
// Each entry tests that a confirm handler calls setPopupHtml with the expected
// payload. Handlers fall into three categories:
//   1. Array targets (standard confirm) — handler receives ['Target Name']
//   2. Object targets — handler receives { targetName: 'Target Name' }
//   3. String targets — handler receives 'Target Name'

describe('useSpellMetamagicFlow — confirm handlers set popup html', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  const popupPayloadTests = [
    {
      name: 'Banishment',
      spellName: 'Banishment',
      spellLevel: 4,
      handler: 'handleBanishmentConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'banishment-popup',
    },
    {
      name: 'Revivify',
      spellName: 'Revivify',
      spellLevel: 5,
      handler: 'handleRevivifyConfirm',
      handlerArg: [{ targetName: 'Goblin A' }],
      expectedPayload: 'revivify-popup',
    },
    {
      name: 'Sanctuary',
      spellName: 'Sanctuary',
      spellLevel: 1,
      handler: 'handleSanctuaryConfirm',
      handlerArg: ['Goblin A'],
      expectedPayload: 'sanctuary-popup',
    },
    {
      name: 'Polymorph',
      spellName: 'Polymorph',
      spellLevel: 4,
      handler: 'handlePolymorphConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'polymorph-popup',
      overridePolymorph: true,
      overrideValue: { payload: 'polymorph-popup' },
    },
    {
      name: 'True Polymorph (object_into_creature resolves at path-select)',
      spellName: 'True Polymorph',
      spellLevel: 9,
      handler: 'handleTruePolymorphPathSelect',
      handlerArg: ['object_into_creature'],
      expectedPayload: 'true-polymorph-popup',
    },
    {
      name: 'True Polymorph (creature_to_creature)',
      spellName: 'True Polymorph',
      spellLevel: 9,
      preHandler: 'handleTruePolymorphPathSelect',
      preHandlerArg: ['creature_to_creature'],
      handler: 'handleTruePolymorphTargetConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'true-polymorph-popup',
    },
    {
      name: 'Healing Word (with heal result)',
      spellName: 'Healing Word',
      spellLevel: 1,
      handler: 'handleHealingWordConfirm',
      handlerArg: [{ targetName: 'Goblin A' }],
      expectedPayload: 'heal',
      isPartialMatch: true,
      overrideFeature: true,
      overrideValue: {
        formula: '1d4+2',
        rolls: [3],
        rawTotal: 5,
        healAmount: 5,
        targetName: 'Goblin A',
        bonusHeal: 2,
        bonusDetails: [{ amount: 2, name: 'Tavern Heal' }],
      },
    },
    {
      name: 'Regenerate',
      spellName: 'Regenerate',
      spellLevel: 7,
      handler: 'handleRegenerateConfirm',
      handlerArg: [{ targetName: 'Goblin A' }],
      expectedPayload: 'regenerate-popup',
    },
    {
      name: 'Confusion',
      spellName: 'Confusion',
      spellLevel: 4,
      handler: 'handleConfusionConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'confusion-popup',
      overrideAutomation: true,
      overrideValue: { payload: 'confusion-popup' },
    },
    {
      name: 'Globe of Invulnerability',
      spellName: 'Globe of Invulnerability',
      spellLevel: 4,
      handler: 'handleGlobeConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'globe-popup',
      overrideAutomation: true,
      overrideValue: { payload: 'globe-popup' },
    },
    {
      name: 'Forcecage',
      spellName: 'Forcecage',
      spellLevel: 7,
      handler: 'handleForcecageConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'forcecage-popup',
      overrideAutomation: true,
      overrideValue: { payload: 'forcecage-popup' },
    },
    {
      name: 'Antimagic Field',
      spellName: 'Antimagic Field',
      spellLevel: 4,
      handler: 'handleAntimagicFieldConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'antimagic-popup',
      overrideAutomation: true,
      overrideValue: { payload: 'antimagic-popup' },
    },
    {
      name: 'Protection from Poison',
      spellName: 'Protection from Poison',
      spellLevel: 2,
      handler: 'handleProtectionFromPoisonConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'protectionFromPoison-popup',
    },
    {
      name: 'Stone Skin',
      spellName: 'Stone Skin',
      spellLevel: 3,
      handler: 'handleStoneSkinConfirm',
      handlerArg: ['Goblin A'],
      expectedPayload: 'stoneSkin-popup',
    },
    {
      name: 'Remove Curse',
      spellName: 'Remove Curse',
      spellLevel: 3,
      handler: 'handleRemoveCurseConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'removeCurse-popup',
    },
    {
      name: 'Foresight',
      spellName: 'Foresight',
      spellLevel: 9,
      handler: 'handleForesightConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'foresight-popup',
    },
    {
      name: 'Death Ward',
      spellName: 'Death Ward',
      spellLevel: 4,
      handler: 'handleDeathWardConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'deathWard-popup',
    },
    {
      name: 'Heroism',
      spellName: 'Heroism',
      spellLevel: 2,
      handler: 'handleHeroismConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'heroism-popup',
    },
    {
      name: 'Barkskin',
      spellName: 'Barkskin',
      spellLevel: 2,
      handler: 'handleBarkskinConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'barkskin-popup',
    },
    {
      name: 'Aura of Vitality',
      spellName: 'Aura of Vitality',
      spellLevel: 3,
      handler: 'handleAuraOfVitalityConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'auraOfVitality-popup',
    },
    {
      name: 'Circle of Power',
      spellName: 'Circle of Power',
      spellLevel: 7,
      handler: 'handleCircleOfPowerConfirm',
      handlerArg: [['Goblin A']],
      expectedPayload: 'circleOfPower-popup',
    },
  ];

  for (const test of popupPayloadTests) {
    it(`calls setPopupHtml with ${test.expectedPayload} for ${test.name}`, async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn(), null, [], setPopupHtml)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: test.spellName, level: test.spellLevel }));
      });

      // Apply overrides before calling handlers
      if (test.overrideAutomation) {
        const automation = await import('../../services/automation/index.js');
        automation.executeHandler.mockReturnValue(Promise.resolve(test.overrideValue));
      }
      if (test.overridePolymorph) {
        const polymorphService = await import('../../services/automation/handlers/spells/polymorphService.js');
        polymorphService.applyPolymorph.mockReturnValue(Promise.resolve(test.overrideValue));
      }
      if (test.overrideFeature) {
        const rulesFeatures = await import('../../services/rules/features/healingWordService.js');
        rulesFeatures.triggerHealingWord.mockReturnValue(Promise.resolve(test.overrideValue));
      }

      // Run pre-handler if needed (for multi-stage spells)
      if (test.preHandler) {
        act(() => {
          result.current[test.preHandler](...test.preHandlerArg);
        });
      }

      // Run the confirm handler
      await act(async () => {
        await result.current[test.handler](...test.handlerArg);
      });

      await flushMicrotasks();

      if (test.isPartialMatch) {
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          type: test.expectedPayload,
        }));
      } else {
        expect(setPopupHtml).toHaveBeenCalledWith(test.expectedPayload);
      }
    });
  }
});
