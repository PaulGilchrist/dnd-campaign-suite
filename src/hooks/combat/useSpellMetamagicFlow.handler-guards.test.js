// @maintained-by-ai: 2026-10-15
// Guard ownership for the useSpellMetamagicFlow exposed surface: every
// confirm/skip/two-stage handler must be a side-effect-free no-op when
// invoked WITHOUT pending state (misfire protection). A misfired confirm
// must not spend a slot (prepareSpellCast), log (addEntry), dispatch
// (onExecute/executeHandler), or apply an effect; a misfired skip must not
// refund slots (setRuntimeValue / incrementFreeCastResource) or log.
// Adding a spell to SIMPLE_SPELL_SPECS / useCustomHandlers / area / complex
// lanes? Add one row here — the guard sweep owns no-pending coverage.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { prepareSpellCast, incrementFreeCastResource } from '../../services/rules/spells/spellPreparationService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';
import {
  executeHandler,
  applyResistanceEffect,
  applyEnhanceAbilityEffect,
  applyProtectionFromEnergyHandler,
} from '../../services/automation/index.js';

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
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
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
  isWizardRitualAdeptSpell: vi.fn(() => false),
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

const CAMPAIGN = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

function renderFlow() {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: makePlayerStats(),
      campaignName: CAMPAIGN,
      onExecute,
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml: vi.fn(),
    })
  );
  return { result, onExecute };
}

// CamelCase spec keys → handle${key}Confirm / handle${key}Skip / pending${key}.
// Mirrors SIMPLE_SPELL_SPECS (useSimpleSpellHandlers.js) plus the custom
// (useCustomHandlers.js) and area (useAreaEffectHandlers.js) families.
const GUARDED_KEYS = [
  'Aid', 'Bane', 'Bless', 'FaerieFire', 'HolyAura', 'Slow', 'Haste',
  'Invisibility', 'GreaterInvisibility', 'FeignDeath', 'Heal', 'Longstrider',
  'SpareTheDying', 'BeaconOfHope', 'HeroesFeast', 'AuraOfLife', 'AuraOfPurity',
  'CircleOfPower', 'Compulsion', 'AuraOfVitality', 'DeathWard', 'Heroism',
  'GreaterRestoration', 'LesserRestoration', 'RemoveCurse', 'MageArmor',
  'Foresight', 'ProtectionFromEvilAndGood', 'ShieldOfFaith', 'Regenerate',
  'Sanctuary', 'SleetStorm', 'CureWounds', 'HoldMonster', 'HoldPerson',
  'Polymorph', 'AnimalFriendship', 'CharmPerson', 'CharmMonster', 'Banishment',
  'PrismaticSpray', 'Hex', 'Revivify', 'StinkingCloud', 'Confusion',
  'HealingWord', 'Web',
  // custom + area lanes (same confirm/skip/pending naming convention)
  'Barkskin', 'PassWithoutTrace', 'ProtectionFromPoison', 'StoneSkin', 'WardingBond',
  'Globe', 'Forcecage', 'AntimagicField',
];

// Neutral payload: every guarded handler early-returns on !pending before
// touching `result`, so one shape covers the whole table.
const CONFIRM_ARG = ['Goblin A'];

describe('useSpellMetamagicFlow — confirm guards (no pending ⇒ no-op)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const key of GUARDED_KEYS) {
    it(`handle${key}Confirm without pending spends nothing, logs nothing, executes nothing`, async () => {
      const { result, onExecute } = renderFlow();

      await act(async () => {
        await result.current[`handle${key}Confirm`](CONFIRM_ARG);
      });

      expect(onExecute).not.toHaveBeenCalled();
      expect(executeHandler).not.toHaveBeenCalled();
      expect(prepareSpellCast).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(result.current[`pending${key}`]).toBeNull();
    });
  }

  // Complex lane: hand-written guards (getPending) + createConfirmHandler shapes.
  const COMPLEX_ROWS = [
    { handler: 'handleMagicMissileConfirm', arg: { distribution: {} }, pending: 'pendingMagicMissile' },
    { handler: 'handleAnimalShapesTargetConfirm', arg: CONFIRM_ARG, pending: 'pendingAnimalShapes' },
    { handler: 'handleTruePolymorphTargetConfirm', arg: CONFIRM_ARG, pending: 'pendingTruePolymorph' },
    { handler: 'handleTruePolymorphPathSelect', arg: 'creature_to_creature', pending: 'pendingTruePolymorph' },
  ];
  for (const row of COMPLEX_ROWS) {
    it(`${row.handler} without pending is a no-op`, async () => {
      const { result, onExecute } = renderFlow();

      await act(async () => {
        await result.current[row.handler](row.arg);
      });

      expect(onExecute).not.toHaveBeenCalled();
      expect(prepareSpellCast).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(result.current[row.pending]).toBeNull();
    });
  }

  it('handleGreaterRestorationNoEffects without pending refunds nothing and logs nothing', () => {
    const { result } = renderFlow();

    act(() => {
      result.current.handleGreaterRestorationNoEffects();
    });

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingGreaterRestoration).toBeNull();
  });
});

describe('useSpellMetamagicFlow — skip guards (no pending ⇒ no refund, no log)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const key of GUARDED_KEYS) {
    it(`handle${key}Skip without pending refunds nothing and logs nothing`, () => {
      const { result, onExecute } = renderFlow();

      act(() => {
        result.current[`handle${key}Skip`]();
      });

      expect(onExecute).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(incrementFreeCastResource).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(result.current[`pending${key}`]).toBeNull();
    });
  }

  for (const row of [
    { handler: 'handleMagicMissileSkip', pending: 'pendingMagicMissile' },
    { handler: 'handleAnimalShapesSkip', pending: 'pendingAnimalShapes' },
    { handler: 'handleTruePolymorphSkip', pending: 'pendingTruePolymorph' },
  ]) {
    it(`${row.handler} without pending refunds nothing and logs nothing`, () => {
      const { result } = renderFlow();

      act(() => {
        result.current[row.handler]();
      });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(result.current[row.pending]).toBeNull();
    });
  }
});

describe('useSpellMetamagicFlow — two-stage guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Stage-2 confirm: truly guarded (getPending) — must not apply or log.
  const TWO_STAGE_GUARDS = [
    { handler: 'handleResistanceTypeSelect', arg: 'fire', stageKey: 'resistanceStage', pending: 'pendingResistance', applyFn: applyResistanceEffect },
    { handler: 'handleEnhanceAbilityConfirm', arg: CONFIRM_ARG, stageKey: 'enhanceAbilityStage', pending: 'pendingEnhanceAbility', applyFn: applyEnhanceAbilityEffect },
    { handler: 'handleProtectionFromEnergyTypeSelect', arg: 'fire', stageKey: 'protectionFromEnergyStage', pending: 'pendingProtectionFromEnergy', applyFn: applyProtectionFromEnergyHandler },
  ];
  for (const row of TWO_STAGE_GUARDS) {
    it(`${row.handler} without pending applies nothing and leaves ${row.stageKey} closed`, async () => {
      const { result } = renderFlow();

      await act(async () => {
        await result.current[row.handler](row.arg);
      });

      expect(row.applyFn).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(prepareSpellCast).not.toHaveBeenCalled();
      expect(result.current[row.stageKey]).toBeNull();
      expect(result.current[row.pending]).toBeNull();
    });
  }

  // Stage-2 skip: guarded — stage must stay closed, no refund, no log.
  const TWO_STAGE_SKIPS = [
    { handler: 'handleResistanceSkip', stageKey: 'resistanceStage', pending: 'pendingResistance' },
    { handler: 'handleEnhanceAbilitySkip', stageKey: 'enhanceAbilityStage', pending: 'pendingEnhanceAbility' },
    { handler: 'handleProtectionFromEnergySkip', stageKey: 'protectionFromEnergyStage', pending: 'pendingProtectionFromEnergy' },
  ];
  for (const row of TWO_STAGE_SKIPS) {
    it(`${row.handler} without pending leaves ${row.stageKey} closed and refunds nothing`, () => {
      const { result } = renderFlow();

      act(() => {
        result.current[row.handler]();
      });

      expect(result.current[row.stageKey]).toBeNull();
      expect(result.current[row.pending]).toBeNull();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  }

  // Stage-1 selects intentionally advance the UI stage without pending;
  // the misfire guard here is that they never execute/log/refund.
  const STAGE1_MISFIRES = [
    { handler: 'handleResistanceTargetSelect', arg: CONFIRM_ARG },
    { handler: 'handleProtectionFromEnergyTargetSelect', arg: CONFIRM_ARG },
    { handler: 'handleEnhanceAbilityAbilitySelect', arg: 'strength' },
  ];
  for (const row of STAGE1_MISFIRES) {
    it(`${row.handler} misfire without pending never executes, logs, or refunds`, async () => {
      const { result, onExecute } = renderFlow();

      await act(async () => {
        await result.current[row.handler](row.arg);
      });

      expect(onExecute).not.toHaveBeenCalled();
      expect(executeHandler).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  }
});
