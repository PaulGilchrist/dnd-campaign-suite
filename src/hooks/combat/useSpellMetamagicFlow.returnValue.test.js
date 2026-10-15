// @maintained-by-ai: 2026-10-15
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';

// API-shape seam only: this file asserts the hook's return-value contract
// (pending getters, stage state, handler functions) against the current
// exports in ./useSpellMetamagicFlow/index.js. Behavioral lanes live in
// dedicated siblings: gate flow → .gate.test.js / .gate-two-stage.test.js,
// no-pending guards → .handler-guards.test.js, confirm/skip logging →
// .spellConfirm.test.js / .skip.test.js / .simple-handlers.test.js.

// ── Shared mocks (isolate the hook's import graph) ─────────────────────────────

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
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
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
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromEvilAndGood: vi.fn(),
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

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ creatures: [] }),
    text: () => Promise.resolve(''),
  })
);

// ── Expected API surface (mirrors useSpellMetamagicFlow/index.js exports) ────

const CORE_FUNCTIONS = [
  'gateMetamagic',
  'handleConfirm',
  'handleSkip',
  'handleMultiTargetConfirm',
  'handleMultiTargetSkip',
  'cfClearPending',
];

const PENDING_GETTERS = [
  'pendingMetamagic', 'pendingMultiTarget', 'pendingAid', 'pendingBane',
  'pendingBless', 'pendingFaerieFire', 'pendingHolyAura', 'pendingBeaconOfHope',
  'pendingSlow', 'pendingHaste', 'pendingEnhanceAbility', 'pendingBarkskin',
  'pendingInvisibility', 'pendingGreaterInvisibility', 'pendingFeignDeath',
  'pendingHeal', 'pendingHeroesFeast', 'pendingGreaterRestoration',
  'pendingLesserRestoration', 'pendingMageArmor', 'pendingShieldOfFaith',
  'pendingProtectionFromEvilAndGood', 'pendingProtectionFromPoison',
  'pendingStoneSkin', 'pendingProtectionFromEnergy', 'pendingResistance',
  'pendingRemoveCurse', 'pendingMagicMissile', 'pendingPassWithoutTrace',
  'pendingGlobe', 'pendingForcecage', 'pendingAntimagicField',
  'pendingRegenerate', 'pendingHealingWord', 'pendingCureWounds',
  'pendingStinkingCloud', 'pendingWeb', 'pendingAnimalFriendship',
  'pendingAuraOfLife', 'pendingAuraOfPurity', 'pendingCircleOfPower',
  'pendingCompulsion', 'pendingAuraOfVitality', 'pendingForesight',
  'pendingLongstrider', 'pendingSpareTheDying', 'pendingPrismaticSpray',
  'pendingConfusion', 'pendingRevivify', 'pendingSanctuary',
  'pendingSleetStorm', 'pendingHoldMonster', 'pendingHoldPerson',
  'pendingPolymorph', 'pendingShapechange', 'pendingAnimalShapes',
  'pendingTruePolymorph', 'pendingCharmPerson', 'pendingCharmMonster',
  'pendingBanishment', 'pendingDeathWard', 'pendingHeroism',
  'pendingHex', 'pendingWardingBond',
];

const STAGE_KEYS = ['resistanceStage', 'enhanceAbilityStage', 'protectionFromEnergyStage'];

const SPELL_HANDLERS = [
  'handleAidConfirm', 'handleAidSkip',
  'handleBaneConfirm', 'handleBaneSkip',
  'handleBlessConfirm', 'handleBlessSkip',
  'handleFaerieFireConfirm', 'handleFaerieFireSkip',
  'handleHolyAuraConfirm', 'handleHolyAuraSkip',
  'handleBeaconOfHopeConfirm', 'handleBeaconOfHopeSkip',
  'handleSlowConfirm', 'handleSlowSkip',
  'handleHasteConfirm', 'handleHasteSkip',
  'handleInvisibilityConfirm', 'handleInvisibilitySkip',
  'handleGreaterInvisibilityConfirm', 'handleGreaterInvisibilitySkip',
  'handleFeignDeathConfirm', 'handleFeignDeathSkip',
  'handleHealConfirm', 'handleHealSkip',
  'handleHeroesFeastConfirm', 'handleHeroesFeastSkip',
  'handleLongstriderConfirm', 'handleLongstriderSkip',
  'handleSpareTheDyingConfirm', 'handleSpareTheDyingSkip',
  'handleAuraOfLifeConfirm', 'handleAuraOfLifeSkip',
  'handleAuraOfPurityConfirm', 'handleAuraOfPuritySkip',
  'handleCircleOfPowerConfirm', 'handleCircleOfPowerSkip',
  'handleCompulsionConfirm', 'handleCompulsionSkip',
  'handleAuraOfVitalityConfirm', 'handleAuraOfVitalitySkip',
  'handleDeathWardConfirm', 'handleDeathWardSkip',
  'handleHeroismConfirm', 'handleHeroismSkip',
  'handleGreaterRestorationConfirm', 'handleGreaterRestorationSkip',
  'handleGreaterRestorationNoEffects',
  'handleLesserRestorationConfirm', 'handleLesserRestorationSkip',
  'handleRemoveCurseConfirm', 'handleRemoveCurseSkip',
  'handleCureWoundsConfirm', 'handleCureWoundsSkip',
  'handleStinkingCloudConfirm', 'handleStinkingCloudSkip',
  'handleWebConfirm', 'handleWebSkip',
  'handleConfusionConfirm', 'handleConfusionSkip',
  'handleAnimalFriendshipConfirm', 'handleAnimalFriendshipSkip',
  'handleRegenerateConfirm', 'handleRegenerateSkip',
  'handleHealingWordConfirm', 'handleHealingWordSkip',
  'handleHoldMonsterConfirm', 'handleHoldMonsterSkip',
  'handleHoldPersonConfirm', 'handleHoldPersonSkip',
  'handlePolymorphConfirm', 'handlePolymorphSkip',
  'handleCharmPersonConfirm', 'handleCharmPersonSkip',
  'handleCharmMonsterConfirm', 'handleCharmMonsterSkip',
  'handleBanishmentConfirm', 'handleBanishmentSkip',
  'handlePrismaticSprayConfirm', 'handlePrismaticSpraySkip',
  'handleRevivifyConfirm', 'handleRevivifySkip',
  'handleSanctuaryConfirm', 'handleSanctuarySkip',
  'handleSleetStormConfirm', 'handleSleetStormSkip',
  'handleMagicMissileConfirm', 'handleMagicMissileSkip',
  'handleForesightConfirm', 'handleForesightSkip',
  'handleProtectionFromEvilAndGoodConfirm', 'handleProtectionFromEvilAndGoodSkip',
  'handleShieldOfFaithConfirm', 'handleShieldOfFaithSkip',
  'handleBarkskinConfirm', 'handleBarkskinSkip',
  'handlePassWithoutTraceConfirm', 'handlePassWithoutTraceSkip',
  'handleProtectionFromPoisonConfirm', 'handleProtectionFromPoisonSkip',
  'handleStoneSkinConfirm', 'handleStoneSkinSkip',
  'handleMageArmorConfirm', 'handleMageArmorSkip',
  'handleGlobeConfirm', 'handleGlobeSkip',
  'handleForcecageConfirm', 'handleForcecageSkip',
  'handleAntimagicFieldConfirm', 'handleAntimagicFieldSkip',
  'handleHexConfirm', 'handleHexSkip',
  'handleWardingBondConfirm', 'handleWardingBondSkip',
];

const TWO_STAGE_HANDLERS = [
  'handleResistanceTargetSelect', 'handleResistanceTypeSelect', 'handleResistanceSkip',
  'handleProtectionFromEnergyTargetSelect', 'handleProtectionFromEnergyTypeSelect', 'handleProtectionFromEnergySkip',
  'handleEnhanceAbilityAbilitySelect', 'handleEnhanceAbilityConfirm', 'handleEnhanceAbilitySkip',
  'handleTruePolymorphPathSelect', 'handleTruePolymorphTargetConfirm', 'handleTruePolymorphSkip',
  'handleAnimalShapesTargetConfirm', 'handleAnimalShapesBeastConfirm', 'handleAnimalShapesSkip',
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — return value shape', () => {
  let shape;

  beforeAll(() => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({
        playerStats: { name: 'TestSorcerer', class: { name: 'Sorcerer' }, level: 5 },
        campaignName: 'TestCampaign',
        onExecute: vi.fn(),
      })
    );
    shape = result.current;
  });

  it('exposes the core entry points as functions', () => {
    for (const key of CORE_FUNCTIONS) {
      expect(typeof shape[key], key).toBe('function');
    }
  });

  it('exposes a pending state getter for every supported spell', () => {
    for (const key of PENDING_GETTERS) {
      expect(shape, key).toHaveProperty(key);
    }
  });

  it('exposes two-stage stage keys, initially closed', () => {
    for (const key of STAGE_KEYS) {
      expect(shape, key).toHaveProperty(key);
      expect(shape[key], key).toBeNull();
    }
  });

  it('exposes every confirm/skip and multi-stage handler as a function', () => {
    for (const handler of [...SPELL_HANDLERS, ...TWO_STAGE_HANDLERS]) {
      expect(typeof shape[handler], handler).toBe('function');
    }
  });
});
