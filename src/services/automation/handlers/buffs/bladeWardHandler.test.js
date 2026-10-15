// @maintained-by-ai
// Blade Ward handler contract: activation/deactivation toggle, bane_penalty
// targetEffect registration (replace-in-place vs push), expiration, log,
// popup passthrough, and null/empty guards. Fully mocked and deterministic.
// The d20 subtraction math lives in d20RollComputation.subtract-die.test.js;
// dispatch routing in triggerSpells.test.js; new-initiative clearing in
// useInitiativeEffects.concentrationClearing.test.js — none cover this lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './bladeWardHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Constants & Helpers ────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestHero';

function makePlayerStats(overrides = {}) {
  return { name: PLAYER_NAME, ...overrides };
}

function makeAction(automation = {}) {
  return {
    name: 'Blade Ward',
    automation: { type: 'buff', ...automation },
  };
}

function setActive() {
  buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
}

function setToggledOff() {
  buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
}

// ── Tests ──────────────────────────────────────────────────────

describe('bladeWardHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('activation (wasActive false)', () => {
    it('toggles the buff, registers expiration, creates targetEffect, logs, and returns activation popup', async () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);
      setActive();

      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 minute' });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', duration: '1 minute', effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: ps.name, targetName: ps.name, effects: [{ type: 'remove_active_buff', buffName: action.name }], campaignName: CAMPAIGN_NAME });
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: PLAYER_NAME,
            effect: 'bane_penalty',
            source: PLAYER_NAME,
            displayLabel: 'Blade Ward',
            duration: 'concentration',
          }),
        ]),
        CAMPAIGN_NAME,
        true
      );
      expect(logService.addEntry).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        expect.objectContaining({
          type: 'automation',
          characterName: PLAYER_NAME,
          abilityName: 'Blade Ward',
          description: 'Blade Ward activated — attackers subtract 1d4 from attack rolls against you',
        })
      );
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Blade Ward',
          automationType: 'buff',
          description: 'Blade Ward activated — attackers subtract 1d4 from attack rolls against you',
          automation: action.automation,
        },
      });
    });

    it('replaces an existing bane_penalty from the same source in place, preserving unrelated effects', async () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { target: PLAYER_NAME, effect: 'bane_penalty', source: PLAYER_NAME, displayLabel: 'stale' },
        { target: 'Other', effect: 'bless_bonus', source: PLAYER_NAME },
      ]);
      setActive();

      await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      const written = runtimeState.setRuntimeValue.mock.calls.at(-1)[2];
      // Replace-in-place: no stacking — exactly one bane_penalty for this source, list length unchanged.
      expect(written).toHaveLength(2);
      const own = written.filter(te => te.target === PLAYER_NAME && te.effect === 'bane_penalty' && te.source === PLAYER_NAME);
      expect(own).toHaveLength(1);
      expect(own[0]).toEqual(expect.objectContaining({ displayLabel: 'Blade Ward', duration: 'concentration' }));
      expect(written).toContainEqual(expect.objectContaining({ target: 'Other', effect: 'bless_bonus' }));
    });

    it('treats null or undefined storedEffects as empty when activating', async () => {
      setActive();
      for (const stored of [null, undefined]) {
        runtimeState.getRuntimeValue.mockReturnValue(stored);
        await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'campaign',
          'targetEffects',
          expect.arrayContaining([
            expect.objectContaining({ target: PLAYER_NAME, effect: 'bane_penalty' }),
          ]),
          CAMPAIGN_NAME,
          true
        );
      }
    });

    it('threads the action name through the log abilityName and both popup descriptions', async () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);
      const action = { ...makeAction(), name: 'Custom Blade Ward' };

      setActive();
      const on = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);
      expect(logService.addEntry).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        expect.objectContaining({ abilityName: 'Custom Blade Ward' })
      );
      expect(on.payload.description).toBe('Custom Blade Ward activated — attackers subtract 1d4 from attack rolls against you');

      setToggledOff();
      runtimeState.getRuntimeValue.mockReturnValue([
        { target: PLAYER_NAME, effect: 'bane_penalty', source: PLAYER_NAME },
      ]);
      const off = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);
      expect(off.payload.description).toBe('Custom Blade Ward expired');
    });

    it('passes automation.type to popup automationType and the full automation object through the popup', async () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);
      setActive();

      const action = { name: 'Blade Ward', automation: { type: 'custom_type', customField: 'customValue' } };
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.automationType).toBe('custom_type');
      expect(result.payload.automation).toEqual({ type: 'custom_type', customField: 'customValue' });
    });
  });

  describe('deactivation (wasActive true)', () => {
    it('toggles the buff, skips expiration, removes the targetEffect, and returns expired popup', async () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { target: PLAYER_NAME, effect: 'bane_penalty', source: PLAYER_NAME, displayLabel: 'Blade Ward' },
      ]);
      setToggledOff();

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [],
        CAMPAIGN_NAME,
        true
      );
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Blade Ward',
          automationType: 'buff',
          description: 'Blade Ward expired',
          automation: action.automation,
        },
      });
    });

    it('does not write targetEffects when no matching bane_penalty exists (empty, non-matching, null, undefined)', async () => {
      setToggledOff();
      for (const stored of [
        [],
        [{ target: 'Other', effect: 'bless_bonus', source: PLAYER_NAME }],
        null,
        undefined,
      ]) {
        runtimeState.getRuntimeValue.mockReturnValue(stored);
        await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      }
    });
  });

  describe('edge cases', () => {
    it('spreads an empty automation object but always stamps effect: blade_ward for toggleBuff', async () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);
      setActive();

      const action = { name: 'Blade Ward', automation: {} };
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        makePlayerStats().name,
        action.name,
        { effect: 'blade_ward' },
        CAMPAIGN_NAME
      );
      expect(result.payload.description).toContain('activated');
    });

    it('returns a failure popup with no side effects when playerStats is missing', async () => {
      const result = await handle(makeAction(), null, CAMPAIGN_NAME, null);

      expect(result).toEqual(expect.objectContaining({
        type: 'popup',
        payload: expect.objectContaining({
          type: 'automation_info',
          name: 'Blade Ward',
          description: 'Failed to execute Blade Ward',
        }),
      }));
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });
});
