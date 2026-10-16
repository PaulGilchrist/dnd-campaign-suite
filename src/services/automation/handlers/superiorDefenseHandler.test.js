import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle } from './superiorDefenseHandler.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../ui/logService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

const campaignName = 'TestCampaign';

// Production shape from public/data/2024/classes.json (2024 Warrior lv18
// "Superior Defense"): dispatched as passive_rule/effect via
// PASSIVE_RULE_EFFECTS in automation/index.js (and mirrored in HANDLER_MAP
// by the superior_defense type key), routed to specialActions by
// automationRouter, and interactive via INTERACTIVE_PASSIVE_EFFECTS in
// automationService. The handler echoes auto.type and reads auto.cost /
// auto.duration only.
const PRODUCTION_AUTOMATION = {
  type: 'passive_rule',
  effect: 'superior_defense',
  cost: 3,
  resource: 'focus_point',
  duration: '1_minute',
  endsOnCondition: 'incapacitated',
};

const ACTIVATED_BUFF = {
  name: 'Superior Defense',
  effect: 'damage_resistance',
  duration: '1_minute',
  resistanceTypes: [
    'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
    'piercing', 'poison', 'slashing', 'thunder',
    'necrotic', 'psychic', 'radiant',
  ],
};

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    class: {
      class_levels: [
        { level: 5, focus_points: 6 },
      ],
    },
    ...overrides,
  };
}

// Explicit MERGE on automation (documented): production half plus overrides.
function makeAction(automationOverrides = {}) {
  return {
    name: 'Superior Defense',
    automation: { ...PRODUCTION_AUTOMATION, ...automationOverrides },
  };
}

function mockRuntimeValues(valuesByKey) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key) => valuesByKey[key]);
}

describe('superiorDefenseHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Handler .catch()es addEntry and awaits setRuntimeValue — both must
    // return promises regardless of reset semantics.
    logService.addEntry.mockResolvedValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks(); // safety net for console.error spies
  });

  describe('deactivation', () => {
    it('ends the buff: exact popup, buff removed, logged, focus never read', async () => {
      mockRuntimeValues({
        activeBuffs: [ACTIVATED_BUFF],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Superior Defense',
          automationType: 'passive_rule',
          description: 'Superior Defense ended.',
          automation: PRODUCTION_AUTOMATION,
        },
      });
      // Deactivation reads only activeBuffs — the focus lane is untouched.
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledTimes(1);
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs', campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs', [], campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Superior Defense',
        description: 'TestHero ended Superior Defense.',
      });
    });

    it('removes only the matching buff and preserves others (name-keyed filter)', async () => {
      const otherBuff = { name: 'Other Buff', effect: 'other' };
      mockRuntimeValues({
        activeBuffs: [ACTIVATED_BUFF, otherBuff],
      });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs', [otherBuff], campaignName,
      );
    });

    it('survives addEntry rejection during deactivation (console.error branch)', async () => {
      mockRuntimeValues({ activeBuffs: [ACTIVATED_BUFF] });
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logService.addEntry.mockRejectedValueOnce(new Error('log failure'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe('Superior Defense ended.');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs', [], campaignName,
      );
      expect(errSpy).toHaveBeenCalledWith(
        '[superiorDefenseHandler:log-error]',
        expect.any(Error),
      );
      errSpy.mockRestore();
    });
  });

  describe('focus validation', () => {
    it('refuses activation without touching state: under default cost, under custom cost, stored zero, and zero maxFocus', async () => {
      // Under default cost (3).
      mockRuntimeValues({ activeBuffs: [], focusPoints: 2 });
      const underDefault = await handle(makeAction(), makePlayerStats(), campaignName);
      expect(underDefault.payload.description).toBe(
        'Not enough Focus Points. Superior Defense requires 3 Focus Points.',
      );

      // Custom cost read from automation.
      mockRuntimeValues({ activeBuffs: [], focusPoints: 2 });
      const underCustom = await handle(
        makeAction({ cost: 5 }), makePlayerStats(), campaignName,
      );
      expect(underCustom.payload.description).toBe(
        'Not enough Focus Points. Superior Defense requires 5 Focus Points.',
      );

      // Stored 0 must be read as 0, not coalesced to maxFocus (guards ??).
      mockRuntimeValues({ activeBuffs: [], focusPoints: 0 });
      const zeroStored = await handle(makeAction(), makePlayerStats(), campaignName);
      expect(zeroStored.payload.description).toBe(
        'Not enough Focus Points. Superior Defense requires 3 Focus Points.',
      );

      // Key unset AND no class_levels → maxFocus 0.
      mockRuntimeValues({ activeBuffs: [], focusPoints: undefined });
      const noClass = await handle(
        makeAction(), makePlayerStats({ class: undefined }), campaignName,
      );
      expect(noClass.payload.description).toBe(
        'Not enough Focus Points. Superior Defense requires 3 Focus Points.',
      );

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('falls back to class focus_points when the runtime key is unset', async () => {
      mockRuntimeValues({ activeBuffs: [] }); // focusPoints absent

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'focusPoints', campaignName,
      );
      // maxFocus 6 − cost 3 = 3 remaining.
      expect(result.payload.description).toBe(
        'Superior Defense activated. Resistance to all damage except Force for 1 minute or until Incapacitated. (3 Focus Points remaining)',
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'focusPoints', 3, campaignName,
      );
    });
  });

  describe('activation', () => {
    it('activates from production shape: exact popup, focus spent, buff written, logged', async () => {
      mockRuntimeValues({ activeBuffs: [], focusPoints: 6 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Superior Defense',
          automationType: 'passive_rule',
          description: 'Superior Defense activated. Resistance to all damage except Force for 1 minute or until Incapacitated. (3 Focus Points remaining)',
          automation: PRODUCTION_AUTOMATION,
        },
      });
      expect(runtimeState.getRuntimeValue.mock.calls.map(c => c[1])).toEqual([
        'activeBuffs', 'focusPoints',
      ]);
      // Strict write table + seam order: focus first, then buffs.
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
      expect(runtimeState.setRuntimeValue.mock.calls.map(c => c[1])).toEqual([
        'focusPoints', 'activeBuffs',
      ]);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'focusPoints', 3, campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs', [ACTIVATED_BUFF], campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Superior Defense',
        description: 'TestHero activated Superior Defense. Resistance to all damage except Force for 1 minute or until Incapacitated.',
      });
    });

    it('appends the buff to existing buffs (strict full array)', async () => {
      const otherBuff = { name: 'Other Buff', effect: 'other' };
      mockRuntimeValues({ activeBuffs: [otherBuff], focusPoints: 6 });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs', [otherBuff, ACTIVATED_BUFF], campaignName,
      );
    });

    it('honours custom duration from automation (strict buff table)', async () => {
      mockRuntimeValues({ activeBuffs: [], focusPoints: 6 });

      await handle(makeAction({ duration: '10_minutes' }), makePlayerStats(), campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs',
        [{ ...ACTIVATED_BUFF, duration: '10_minutes' }],
        campaignName,
      );
    });

    it('treats non-array stored activeBuffs as empty (corruption guard)', async () => {
      mockRuntimeValues({ activeBuffs: 'invalid', focusPoints: 6 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe(
        'Superior Defense activated. Resistance to all damage except Force for 1 minute or until Incapacitated. (3 Focus Points remaining)',
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs', [ACTIVATED_BUFF], campaignName,
      );
    });

    it('activates at the exact-cost boundary with 0 remaining', async () => {
      mockRuntimeValues({ activeBuffs: [], focusPoints: 3 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe(
        'Superior Defense activated. Resistance to all damage except Force for 1 minute or until Incapacitated. (0 Focus Points remaining)',
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'focusPoints', 0, campaignName,
      );
    });

    it('survives addEntry rejection during activation (writes persist)', async () => {
      mockRuntimeValues({ activeBuffs: [], focusPoints: 6 });
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logService.addEntry.mockRejectedValueOnce(new Error('log failure'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe(
        'Superior Defense activated. Resistance to all damage except Force for 1 minute or until Incapacitated. (3 Focus Points remaining)',
      );
      // Focus and buff were written BEFORE the log attempt — both persist.
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'focusPoints', 3, campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero', 'activeBuffs', [ACTIVATED_BUFF], campaignName,
      );
      expect(errSpy).toHaveBeenCalledWith(
        '[superiorDefenseHandler:log-error]',
        expect.any(Error),
      );
      errSpy.mockRestore();
    });
  });
});
