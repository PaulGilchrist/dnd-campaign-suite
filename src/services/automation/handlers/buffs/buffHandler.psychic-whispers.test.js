// @maintained-by-ai
// CLA-276 Psychic Whispers (Soulknife lv3, 2024): multi-target telepathic
// speech with psionic energy die cost + free first use after Long Rest.
// Pins the psychic-whispers lane of buffHandler: multiTarget routing to the
// psychicWhispersTarget picker (cap = proficiency, dieSize from psionic
// expression), confirm-time cost ledger (free first use / die expenditure /
// empty-pool refusal), stale-target relink, target slice, and the
// psychicWhispersFreeUsed long-rest latch. Fully mocked + deterministic
// (Math.random spied). Single-target telepathic siblings stay routed to the
// telepathicSpeech modal — anti-regression pin kept here; the single-target
// telepathicSpeech delegation/confirm contract lives in
// buffHandler.modal-delegation.test.js; the generic tracked-uses lane
// (Psychic Veil) lives in buffHandler.psychic-veil.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(() => ({ wasActive: false, isActive: true })),
  isBuffActive: vi.fn(() => false),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/vowOfEnmityHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../class-druid/wildShapeCreatureBuilder.js', () => ({
  cleanupWildShape: vi.fn(),
}));

import { handle, confirmPsychicWhispers } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import { LONG_REST_RESOURCES } from '../../../rules/effects/restRules-constants.js';

const campaignName = 'test-campaign';

const WHISPERS_AUTO = {
  type: 'temp_buff',
  effect: 'telepathic_speech',
  action: 'action',
  casting_time: '1 action',
  range: '35 ft',
  multiTarget: true,
  targets: 'proficiency_bonus',
  duration: 'psychic_energy_die_hours',
  resourceCost: 'psionic_energy',
  freeFirstUseAfterLongRest: true,
};

function makeWhispersAction() {
  return { name: 'Psychic Whispers', automation: { ...WHISPERS_AUTO } };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'AasimarTest',
    level: 14,
    proficiency: 6,
    _trackedResources: { psionicEnergy: { max: 10 } },
    ...overrides,
  };
}

function stageRuntime(values = {}) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => values[key]);
}

describe('CLA-276 Psychic Whispers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false, isActive: true });
    buffToggle.isBuffActive.mockReturnValue(false);
    automationService.evaluateAutoExpression.mockReturnValue(10);
    combatData.loadCombatSummary.mockResolvedValue({
      creatures: [
        { name: 'AasimarTest', type: 'player', currentHp: 90, maxHp: 90, size: 'Medium' },
        { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 20, size: 'Medium' },
        { name: 'Ally2', type: 'player', currentHp: 15, maxHp: 15, size: 'Small' },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks(); // undo Math.random spies even if an assertion fails mid-test
  });

  describe('handle (row click → picker)', () => {
    it('opens the multi-target picker modal capped at proficiency bonus', async () => {
      const result = await handle(makeWhispersAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('psychicWhispersTarget');
      expect(result.payload.maxTargets).toBe(6);
      expect(result.payload.dieSize).toBe(10);
      expect(result.payload.creatureTargets.map(t => t.name)).toEqual(['Ally1', 'Ally2']);
    });

    it('single-target telepathic siblings still use the telepathicSpeech modal', async () => {
      stageRuntime({ activeBuffs: [] });
      const sibling = {
        name: 'Telepathic Speech',
        automation: { type: 'temp_buff', effect: 'telepathic_speech', duration: 'sorcerer_level_minutes', action: 'bonus_action', casting_time: '1 bonus action' },
      };

      const result = await handle(sibling, makePlayerStats(), campaignName, null);

      // Anti-regression (CLA-276): the picker branch is gated on auto.multiTarget —
      // siblings without it must never be routed to psychicWhispersTarget.
      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('telepathicSpeech');
    });
  });

  describe('confirmPsychicWhispers', () => {
    it('first use after Long Rest is free: buffs granted, hours = die roll, no die spent', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.72); // d10 → 8
      stageRuntime({ activeBuffs: [], psychicWhispersFreeUsed: null, psychicWhispersTargets: [], psionicEnergy: null });

      const result = await confirmPsychicWhispers(makeWhispersAction(), makePlayerStats(), campaignName, ['Ally1', 'Ally2']);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith('AasimarTest', 'Psychic Whispers', expect.objectContaining({
        effect: 'telepathic_speech',
        duration: '8 hours',
      }), campaignName);
      expect(buffToggle.toggleBuff).toHaveBeenCalledWith('Ally1', 'Psychic Whispers', expect.objectContaining({ duration: '8 hours' }), campaignName);
      expect(buffToggle.toggleBuff).toHaveBeenCalledWith('Ally2', 'Psychic Whispers', expect.objectContaining({ duration: '8 hours' }), campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'psychicWhispersFreeUsed', true, campaignName);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('AasimarTest', 'psionicEnergy', expect.anything(), campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'psychicWhispersTargets', ['Ally1', 'Ally2'], campaignName);

      expect(result.payload.description).toContain('Rolled d10: 8');
      expect(result.payload.description).toContain('Free first use after Long Rest');

      const entry = logService.addEntry.mock.calls[0][1];
      expect(entry.type).toBe('ability_use');
      expect(entry.description).toContain('Rolled d10 for 8 hours');
      expect(entry.description).toContain('Ally1, Ally2');
      expect(entry.description).toContain('no Psionic Energy Die expended');
    });

    it('second use expends 1 psionic energy die and logs the expenditure', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.25); // d10 → 3
      stageRuntime({ activeBuffs: [{ name: 'Psychic Whispers' }], psychicWhispersFreeUsed: true, psychicWhispersTargets: ['Ally1'], psionicEnergy: 7 });
      buffToggle.isBuffActive.mockImplementation((name) => name === 'Ally1');

      const result = await confirmPsychicWhispers(makeWhispersAction(), makePlayerStats(), campaignName, ['Ally2']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'psionicEnergy', 6, campaignName);

      // Stale target link dropped, new link granted, caster buff refreshed
      expect(buffToggle.toggleBuff).toHaveBeenCalledWith('Ally1', 'Psychic Whispers', expect.any(Object), campaignName);
      expect(buffToggle.toggleBuff).toHaveBeenCalledWith('Ally2', 'Psychic Whispers', expect.any(Object), campaignName);

      expect(result.payload.description).toContain('Rolled d10: 3');
      expect(result.payload.description).toContain('Expended 1 Psionic Energy Die');
      expect(result.payload.description).toContain('Psionic Energy: 6/10');

      const entry = logService.addEntry.mock.calls[0][1];
      expect(entry.description).toContain('Expended 1 Psionic Energy Die');
      expect(entry.description).toContain('Psionic Energy: 6/10');
    });

    it('refuses with popup when pool is empty and use is not free — zero spend, zero buffs', async () => {
      stageRuntime({ activeBuffs: [], psychicWhispersFreeUsed: true, psychicWhispersTargets: [], psionicEnergy: 0 });

      const result = await confirmPsychicWhispers(makeWhispersAction(), makePlayerStats(), campaignName, ['Ally1']);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No Psionic Energy remaining');
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('caps selected targets at proficiency bonus', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // d10 → 1
      stageRuntime({ activeBuffs: [], psychicWhispersFreeUsed: null, psychicWhispersTargets: [], psionicEnergy: null });
      const many = ['Ally1', 'Ally2', 'Extra1', 'Extra2', 'Extra3', 'Extra4', 'Extra5'];

      await confirmPsychicWhispers(makeWhispersAction(), makePlayerStats(), campaignName, many);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'psychicWhispersTargets', many.slice(0, 6), campaignName);
    });
  });

  describe('long rest reset', () => {
    it('psychicWhispersFreeUsed is nulled by LONG_REST_RESOURCES', () => {
      expect(LONG_REST_RESOURCES).toContain('psychicWhispersFreeUsed');
    });
  });
});
