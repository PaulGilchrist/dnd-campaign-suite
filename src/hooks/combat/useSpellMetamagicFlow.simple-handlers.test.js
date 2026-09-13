// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';

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
    // Goblin C dead (0 HP) so the SP-100 Revivify dead-target gate arms pending.
    // Goblin A is a dying PC (runtime 0 HP) so the SP-110 Spare the Dying gate arms pending.
    creatures: [{ name: 'Goblin A', type: 'player' }, { name: 'Goblin B' }, { name: 'Goblin C', type: 'monster', currentHp: 0 }],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
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
  // SP-110: Goblin A must read as a dying PC (runtime 0 HP) for the Spare the
  // Dying gate; everything else keeps the legacy 3.
  getRuntimeValue: vi.fn((name, key) => {
    if (name === 'Goblin A' && key === 'currentHitPoints') return 0;
    if (name === 'Goblin A' && (key === 'isDead' || key === 'deathSaves')) return null;
    return 3;
  }),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

// Automation mocks — only the functions actually used by the simple handlers
// tested in this file. Each mock tracks call count and arguments.
vi.mock('../../services/automation/index.js', () => ({
  applyBaneEffect: vi.fn(() => Promise.resolve(null)),
  applyBlessEffect: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(() => Promise.resolve(null)),
  applyInvisibility: vi.fn(() => Promise.resolve(null)),
  applyGreaterInvisibility: vi.fn(() => Promise.resolve(null)),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfPurityEffect: vi.fn(() => Promise.resolve(null)),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ creatures: [] }) });
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

describe('useSpellMetamagicFlow — simple handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pending state clears on confirm', () => {
    const pendingClearCases = [
      { spell: 'Bane', level: 0, handler: 'handleBaneConfirm', pending: 'pendingBane', arg: ['Goblin A'] },
      { spell: 'Bless', level: 1, handler: 'handleBlessConfirm', pending: 'pendingBless', arg: ['Goblin A'] },
      { spell: 'Faerie Fire', level: 1, handler: 'handleFaerieFireConfirm', pending: 'pendingFaerieFire', arg: ['Goblin A'] },
      { spell: 'Haste', level: 3, handler: 'handleHasteConfirm', pending: 'pendingHaste', arg: ['Goblin A'] },
      { spell: 'Invisibility', level: 2, handler: 'handleInvisibilityConfirm', pending: 'pendingInvisibility', arg: ['Goblin A'] },
      { spell: 'Greater Invisibility', level: 4, handler: 'handleGreaterInvisibilityConfirm', pending: 'pendingGreaterInvisibility', arg: ['Goblin A'] },
      { spell: 'Feign Death', level: 3, handler: 'handleFeignDeathConfirm', pending: 'pendingFeignDeath', arg: ['Goblin A'] },
      { spell: 'Longstrider', level: 0, handler: 'handleLongstriderConfirm', pending: 'pendingLongstrider', arg: ['Goblin A'] },
      { spell: 'Spare The Dying', level: 0, handler: 'handleSpareTheDyingConfirm', pending: 'pendingSpareTheDying', arg: ['Goblin A'] },
      { spell: 'Beacon of Hope', level: 3, handler: 'handleBeaconOfHopeConfirm', pending: 'pendingBeaconOfHope', arg: ['Goblin A'] },
      { spell: 'Aura of Life', level: 4, handler: 'handleAuraOfLifeConfirm', pending: 'pendingAuraOfLife', arg: ['Goblin A'] },
      { spell: 'Aura of Purity', level: 4, handler: 'handleAuraOfPurityConfirm', pending: 'pendingAuraOfPurity', arg: ['Goblin A'] },
      { spell: 'Circle of Power', level: 9, handler: 'handleCircleOfPowerConfirm', pending: 'pendingCircleOfPower', arg: ['Goblin A'] },
      { spell: 'Compulsion', level: 4, handler: 'handleCompulsionConfirm', pending: 'pendingCompulsion', arg: ['Goblin A'] },
      { spell: 'Aura of Vitality', level: 3, handler: 'handleAuraOfVitalityConfirm', pending: 'pendingAuraOfVitality', arg: ['Goblin A'] },
      { spell: 'Death Ward', level: 4, handler: 'handleDeathWardConfirm', pending: 'pendingDeathWard', arg: ['Goblin A'] },
      { spell: 'Heroism', level: 1, handler: 'handleHeroismConfirm', pending: 'pendingHeroism', arg: ['Goblin A'] },
      { spell: 'Sanctuary', level: 1, handler: 'handleSanctuaryConfirm', pending: 'pendingSanctuary', arg: 'Goblin A' },
      { spell: 'Foresight', level: 9, handler: 'handleForesightConfirm', pending: 'pendingForesight', arg: ['Goblin A'] },
    ];

    for (const tc of pendingClearCases) {
      it(`clears ${tc.pending} when ${tc.handler} is called`, async () => {
        const setPopupHtml = vi.fn();
        const { result } = renderHook(() =>
          useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
        );

        act(() => {
          result.current.gateMetamagic(makeSpell({ name: tc.spell, level: tc.level }));
        });

        expect(result.current[tc.pending]).not.toBeNull();

        await act(async () => {
          await result.current[tc.handler](tc.arg);
        });

        expect(result.current[tc.pending]).toBeNull();
      });
    }
  });

  describe('pending state clears on skip', () => {
    const pendingSkipCases = [
      { spell: 'Bane', level: 0, handler: 'handleBaneSkip', pending: 'pendingBane' },
      { spell: 'Bless', level: 1, handler: 'handleBlessSkip', pending: 'pendingBless' },
      { spell: 'Faerie Fire', level: 1, handler: 'handleFaerieFireSkip', pending: 'pendingFaerieFire' },
      { spell: 'Haste', level: 3, handler: 'handleHasteSkip', pending: 'pendingHaste' },
      { spell: 'Invisibility', level: 2, handler: 'handleInvisibilitySkip', pending: 'pendingInvisibility' },
      { spell: 'Greater Invisibility', level: 4, handler: 'handleGreaterInvisibilitySkip', pending: 'pendingGreaterInvisibility' },
      { spell: 'Feign Death', level: 3, handler: 'handleFeignDeathSkip', pending: 'pendingFeignDeath' },
      { spell: 'Longstrider', level: 0, handler: 'handleLongstriderSkip', pending: 'pendingLongstrider' },
      { spell: 'Spare The Dying', level: 0, handler: 'handleSpareTheDyingSkip', pending: 'pendingSpareTheDying' },
      { spell: 'Beacon of Hope', level: 3, handler: 'handleBeaconOfHopeSkip', pending: 'pendingBeaconOfHope' },
      { spell: 'Aura of Life', level: 4, handler: 'handleAuraOfLifeSkip', pending: 'pendingAuraOfLife' },
      { spell: 'Aura of Purity', level: 4, handler: 'handleAuraOfPuritySkip', pending: 'pendingAuraOfPurity' },
      { spell: 'Circle of Power', level: 9, handler: 'handleCircleOfPowerSkip', pending: 'pendingCircleOfPower' },
      { spell: 'Compulsion', level: 4, handler: 'handleCompulsionSkip', pending: 'pendingCompulsion' },
      { spell: 'Aura of Vitality', level: 3, handler: 'handleAuraOfVitalitySkip', pending: 'pendingAuraOfVitality' },
      { spell: 'Death Ward', level: 4, handler: 'handleDeathWardSkip', pending: 'pendingDeathWard' },
      { spell: 'Heroism', level: 1, handler: 'handleHeroismSkip', pending: 'pendingHeroism' },
      { spell: 'Sanctuary', level: 1, handler: 'handleSanctuarySkip', pending: 'pendingSanctuary' },
      { spell: 'Foresight', level: 9, handler: 'handleForesightSkip', pending: 'pendingForesight' },
    ];

    for (const tc of pendingSkipCases) {
      it(`clears ${tc.pending} when ${tc.handler} is called`, async () => {
        const setPopupHtml = vi.fn();
        const { result } = renderHook(() =>
          useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
        );

        act(() => {
          result.current.gateMetamagic(makeSpell({ name: tc.spell, level: tc.level }));
        });

        expect(result.current[tc.pending]).not.toBeNull();

        await act(async () => {
          result.current[tc.handler]();
        });

        expect(result.current[tc.pending]).toBeNull();
      });
    }
  });

  describe('automation functions are invoked on confirm', () => {
    const automationCases = [
      { spell: 'Bane', level: 0, handler: 'handleBaneConfirm', automation: 'applyBaneEffect', arg: ['Goblin A'] },
      { spell: 'Bless', level: 1, handler: 'handleBlessConfirm', automation: 'applyBlessEffect', arg: ['Goblin A'] },
      { spell: 'Haste', level: 3, handler: 'handleHasteConfirm', automation: 'applyHaste', arg: ['Goblin A'] },
      { spell: 'Invisibility', level: 2, handler: 'handleInvisibilityConfirm', automation: 'applyInvisibility', arg: ['Goblin A'] },
      { spell: 'Greater Invisibility', level: 4, handler: 'handleGreaterInvisibilityConfirm', automation: 'applyGreaterInvisibility', arg: ['Goblin A'] },
      { spell: 'Feign Death', level: 3, handler: 'handleFeignDeathConfirm', automation: 'applyFeignDeath', arg: ['Goblin A'] },
      { spell: 'Longstrider', level: 0, handler: 'handleLongstriderConfirm', automation: 'applyLongstriderEffect', arg: ['Goblin A'] },
      { spell: 'Spare The Dying', level: 0, handler: 'handleSpareTheDyingConfirm', automation: 'applySpareTheDyingEffect', arg: ['Goblin A'] },
      { spell: 'Beacon of Hope', level: 3, handler: 'handleBeaconOfHopeConfirm', automation: 'applyBeaconOfHopeEffect', arg: ['Goblin A'] },
      { spell: 'Aura of Life', level: 4, handler: 'handleAuraOfLifeConfirm', automation: 'applyAuraOfLifeEffect', arg: ['Goblin A'] },
      { spell: 'Aura of Purity', level: 4, handler: 'handleAuraOfPurityConfirm', automation: 'applyAuraOfPurityEffect', arg: ['Goblin A'] },
      { spell: 'Circle of Power', level: 9, handler: 'handleCircleOfPowerConfirm', automation: 'applyCircleOfPowerEffect', arg: ['Goblin A'] },
      { spell: 'Compulsion', level: 4, handler: 'handleCompulsionConfirm', automation: 'applyCompulsionEffect', arg: ['Goblin A'] },
      { spell: 'Aura of Vitality', level: 3, handler: 'handleAuraOfVitalityConfirm', automation: 'applyAuraOfVitalityEffect', arg: ['Goblin A'] },
      { spell: 'Death Ward', level: 4, handler: 'handleDeathWardConfirm', automation: 'applyDeathWardEffect', arg: ['Goblin A'] },
      { spell: 'Heroism', level: 1, handler: 'handleHeroismConfirm', automation: 'applyHeroism', arg: ['Goblin A'] },
      { spell: 'Sanctuary', level: 1, handler: 'handleSanctuaryConfirm', automation: 'handleSanctuary', arg: 'Goblin A' },
    ];

    for (const tc of automationCases) {
      it(`calls ${tc.automation} when ${tc.handler} is invoked`, async () => {
        const setPopupHtml = vi.fn();
        const { result } = renderHook(() =>
          useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
        );

        act(() => {
          result.current.gateMetamagic(makeSpell({ name: tc.spell, level: tc.level }));
        });

        const automationFn = vi.mocked(await import('../../services/automation/index.js'))[tc.automation];

        await act(async () => {
          await result.current[tc.handler](tc.arg);
        });

        expect(automationFn).toHaveBeenCalledTimes(1);
      });
    }
  });

  describe('executeHandler-based spells', () => {
    it('calls executeHandler for Slow', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Slow', level: 3 }));
      });

      const { executeHandler } = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleSlowConfirm(['Goblin A']);
      });

      expect(executeHandler).toHaveBeenCalledTimes(1);
    });

    it('calls executeHandler for Web', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Web', level: 1 }));
      });

      const { executeHandler } = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleWebConfirm(['Goblin A']);
      });

      expect(executeHandler).toHaveBeenCalledTimes(1);
    });

    it('calls executeHandler for Sleet Storm', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Sleet Storm', level: 3 }));
      });

      const { executeHandler } = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleSleetStormConfirm(['Goblin A']);
      });

      expect(executeHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('feature service functions are invoked', () => {
    it('calls triggerFaerieFire for Faerie Fire', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Faerie Fire', level: 1 }));
      });

      const { triggerFaerieFire } = await import('../../services/rules/features/faerieFireService.js');

      await act(async () => {
        await result.current.handleFaerieFireConfirm(['Goblin A']);
      });

      expect(triggerFaerieFire).toHaveBeenCalledTimes(1);
    });

    it('calls triggerForesight for Foresight', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Foresight', level: 9 }));
      });

      const { triggerForesight } = await import('../../services/rules/features/foresightService.js');

      await act(async () => {
        await result.current.handleForesightConfirm(['Goblin A']);
      });

      expect(triggerForesight).toHaveBeenCalledTimes(1);
    });

    it('calls triggerRevivify for Revivify', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Revivify', level: 5 }));
      });

      const { triggerRevivify } = await import('../../services/rules/features/revivifyService.js');

      await act(async () => {
        await result.current.handleRevivifyConfirm({ targetName: 'Goblin A' });
      });

      expect(triggerRevivify).toHaveBeenCalledTimes(1);
    });
  });

  describe('log entries are created', () => {
    it('calls addEntry on confirm', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Bane', level: 0 }));
      });

      const { addEntry } = await import('../../services/ui/logService.js');

      await act(async () => {
        await result.current.handleBaneConfirm(['Goblin A']);
      });

      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        spellName: 'Bane',
        targetName: 'Goblin A',
        targets: expect.arrayContaining(['Goblin A']),
      }));
    });

    it('calls addEntry on skip', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Bane', level: 0 }));
      });

      const { addEntry } = await import('../../services/ui/logService.js');

      await act(async () => {
        result.current.handleBaneSkip();
      });

      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        spellName: 'Bane',
      }));
    });
  });

  describe('no-op when no pending state', () => {
    it('handleConfirm does nothing when pending is null', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      const { addEntry } = await import('../../services/ui/logService.js');

      await act(async () => {
        await result.current.handleBaneConfirm(['Goblin A']);
      });

      expect(addEntry).not.toHaveBeenCalled();
    });

    it('handleSkip does nothing when pending is null', async () => {
      const setPopupHtml = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      const { addEntry } = await import('../../services/ui/logService.js');

      await act(async () => {
        result.current.handleBaneSkip();
      });

      expect(addEntry).not.toHaveBeenCalled();
    });
  });
});
