// @maintained-by-ai: 2026-10-15
// damageTypeModifierHandler — deterministic contract pins for the
// damage_type_modifier (Empowered Strikes, 2024) automation lane.
//
// Liveness (verified 2026-10-15):
// - handle: LIVE — registered as HANDLER_MAP.damage_type_modifier
//   (automation/index.js) and dispatched via executeHandler from the
//   CharActions / CharSpecialActions / useCharActionsAutomation rows.
//   NOTE: its modal branch (modalName 'damageTypeModifier') has no entry in
//   modalMap / MODAL_DISPATCH / CHOICE_MODAL_EVENTS, so every dispatcher
//   silently drops it (CLA-384 pattern). Pinned here as the handler's own
//   contract; the dropped-chooser wiring is reported, not fixed in tests.
// - applyDamageTypeChoice: NO production caller — the live apply lane is the
//   inline useModalHandlers.handleDamageTypeModifierChoice (covered by
//   useModalHandlers-damage.test.js). This export is nonetheless the SOLE
//   writer of the `empoweredStrikesDamageType` runtime key that
//   attackRollPostDamage.applyDamageTypeModifiers reads, so the exact runtime
//   bridge stays pinned; popup/log string plumbing of this dormant export is
//   kept to one verbatim pin each, and its duplicate addEntry-reject guard
//   (same .catch idiom as handle) was removed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as combatData from '../../../../services/encounters/combatData.js';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyDamageTypeChoice } from './damageTypeModifierHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestFighter',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Empowered Strikes',
    automation: {
      type: 'damage_type_modifier',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageTypeModifierHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    combatData.setCombatSummaryCache(null, campaignName);
  });

  describe('handle (live executeHandler lane)', () => {
    it('returns modal with action, playerStats, and campaignName when options are present', async () => {
      const action = makeAction({
        options: [
          { name: 'Thunder', damageType: 'Thunder' },
          { name: 'Lightning', damageType: 'Lightning' },
        ],
      });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'damageTypeModifier',
        payload: {
          action,
          playerStats: ps,
          campaignName,
        },
      });
    });

    it('returns info popup when options array is empty or undefined', async () => {
      const ps = makePlayerStats();

      // empty array
      let action = makeAction({ options: [] });
      let result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');

      // undefined options
      action = makeAction({ options: undefined });
      result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('logs ability_use on invocation regardless of options', async () => {
      const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestFighter',
          abilityName: 'Empowered Strikes',
          description: expect.stringContaining('Empowered Strikes'),
        }),
      );
    });

    it('does not throw when addEntry rejects', async () => {
      const action = makeAction({ options: [] });
      const ps = makePlayerStats();
      logService.addEntry.mockRejectedValueOnce(new Error('network'));

      await expect(handle(action, ps, campaignName, null)).resolves.toBeDefined();
    });
  });

  describe('applyDamageTypeChoice (dormant export — sole writer of the empoweredStrikesDamageType bridge key)', () => {
    it('returns null and makes no side effects when chosen option is not found', async () => {
      const action = makeAction({
        options: [
          { name: 'Thunder', damageType: 'Thunder' },
          { name: 'Lightning', damageType: 'Lightning' },
        ],
      });
      const ps = makePlayerStats();

      const result = await applyDamageTypeChoice(action, ps, campaignName, 'Fire');

      expect(result).toBeNull();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('writes the pipeline bridge keys verbatim — empoweredStrikesDamageType plus _Empowered_Strikes_usedRound from the round cache, defaulting to 1', async () => {
      const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
      const ps = makePlayerStats({ name: 'RogueNine' });
      const otherCampaign = 'OtherCampaign';

      combatData.setCombatSummaryCache({ round: 5 }, otherCampaign);

      await applyDamageTypeChoice(action, ps, otherCampaign, 'Thunder');

      // attackRollPostDamage reads exactly these keys — pin them verbatim.
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        ['RogueNine', 'empoweredStrikesDamageType', 'Thunder', otherCampaign],
        ['RogueNine', '_Empowered_Strikes_usedRound', 5, otherCampaign],
      ]);

      vi.clearAllMocks();
      combatData.setCombatSummaryCache(null, otherCampaign);

      await applyDamageTypeChoice(action, ps, otherCampaign, 'Thunder');

      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        ['RogueNine', 'empoweredStrikesDamageType', 'Thunder', otherCampaign],
        ['RogueNine', '_Empowered_Strikes_usedRound', 1, otherCampaign],
      ]);
    });

    it('returns the automation_info popup verbatim and logs the chosen damage type', async () => {
      const action = makeAction({ options: [{ name: 'Lightning', damageType: 'Lightning' }] });
      const ps = makePlayerStats();

      const result = await applyDamageTypeChoice(action, ps, campaignName, 'Lightning');

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Empowered Strikes',
          automationType: 'damage_type_modifier',
          description: 'Damage type set to Lightning for your next Unarmed Strike.',
          automation: { type: 'damage_type_modifier', options: [{ name: 'Lightning', damageType: 'Lightning' }] },
        },
      });
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestFighter',
          abilityName: 'Empowered Strikes',
          description: 'Empowered Strikes — damage type set to Lightning',
        }),
      );
    });
  });
});
