// @maintained-by-ai
// sorceryHandler.js — Innate Sorcery lane (2024 Sorcerer resource economy).
// index.js HANDLER_MAP dispatches `sorcery_aura` and `sorcery_incarnate`
// here (public/data/2024/classes.json: aura uses=2 long_rest, incarnate
// cost=2 SP). The old test-only type string `metamagic_sorcery` is retired
// — it exists in no production data or dispatch table.
//
// This file OWNS: the sorceryHandler call-site composition (popup payload
// strings, runtime-store writes, buff activation, CLA-194 §5 log shape).
// CANONICAL HELPER DECISION: getCurrentSorceryPoints/spendSorceryPoints
// internals are pinned in useMetamagic.test.js (single home); this file
// mocks them and pins only its own args. reactionBonusHandler.test.js
// pins its separate applyD20Modifier call site of the same helpers —
// distinct seams, no overlap. fontOfMagic/resourcePool/naturalRecovery
// lanes are modal-openers/resource pools with zero overlap with this lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../combat/buffs/buffService.js', () => ({
  setInnateSorceryActive: vi.fn(),
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ─────────────────────────────────────────────────────────

import { handle } from './sorceryHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as useMetamagic from '../../../../hooks/combat/useMetamagic.js';
import * as buffService from '../../../combat/buffs/buffService.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ─────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

const ps = { name: 'Sorcerer', level: 5 };

// MERGE overrides (never replace the automation object wholesale).
// Shapes mirror public/data/2024/classes.json entries.
function makeAuraAction(overrides = {}) {
  const { automation: autoOverrides, ...rest } = overrides;
  return {
    name: 'Innate Sorcery',
    ...rest,
    automation: {
      type: 'sorcery_aura',
      uses: 2,
      recharge: 'long_rest',
      casting_time: '1 bonus action',
      ...autoOverrides,
    },
  };
}

function makeIncarnateAction(overrides = {}) {
  const { automation: autoOverrides, ...rest } = overrides;
  return {
    name: 'Sorcery Incarnate',
    ...rest,
    automation: {
      type: 'sorcery_incarnate',
      casting_time: '1 bonus action',
      cost: 2,
      ...autoOverrides,
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('sorceryHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buffService.isInnateSorceryActive.mockReturnValue(false);
  });

  describe('already-active early return', () => {
    it('early-returns already-active popup, refused log, and zero spend for both live types', async () => {
      buffService.isInnateSorceryActive.mockReturnValue(true);

      const auraAction = makeAuraAction();
      const auraResult = await handle(auraAction, ps, campaignName, null);
      expect(auraResult).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Innate Sorcery',
          automationType: 'sorcery_aura',
          description: 'Innate Sorcery is already active.',
          automation: auraAction.automation,
        },
      });

      const incarnateAction = makeIncarnateAction();
      const metaResult = await handle(incarnateAction, ps, campaignName, null);
      expect(metaResult.payload.description).toBe('Sorcery Incarnate is already active.');
      expect(metaResult.payload.automationType).toBe('sorcery_incarnate');

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: 'Sorcerer',
        description: expect.stringContaining('innate_sorcery_refused already_active'),
      }));
      // zero-spend guard: refusal mutates nothing
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(useMetamagic.spendSorceryPoints).not.toHaveBeenCalled();
      expect(buffService.setInnateSorceryActive).not.toHaveBeenCalled();
    });
  });

  describe('sorcery_aura automation type', () => {
    it('returns no-uses popup, logs no_uses refusal, and writes nothing when uses are exhausted', async () => {
      const action = makeAuraAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Innate Sorcery',
          automationType: 'sorcery_aura',
          description: 'Innate Sorcery has no remaining uses. Recharges on a long rest.',
          automation: action.automation,
        },
      });
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(buffService.setInnateSorceryActive).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: 'Sorcerer',
        description: expect.stringContaining('innate_sorcery_refused no_uses'),
      }));
    });

    it('activates sorcery and decrements uses when uses are available', async () => {
      const action = makeAuraAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('Innate Sorcery activated (1/3 uses remaining).');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer',
        'innateSorceryUses',
        1,
        campaignName,
      );
      expect(buffService.setInnateSorceryActive).toHaveBeenCalledWith(
        'Sorcerer',
        true,
        campaignName,
      );
    });

    it('falls back to usesMax when currentUses is null or undefined', async () => {
      const action = makeAuraAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('Innate Sorcery activated (1/2 uses remaining).');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer',
        'innateSorceryUses',
        1,
        campaignName,
      );
    });
  });

  describe('sorcery_incarnate SP lane', () => {
    it('blocks activation and logs uses_remaining while Innate Sorcery uses remain', async () => {
      const action = makeIncarnateAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sorcery Incarnate',
          automationType: 'sorcery_incarnate',
          description: 'Cannot use Sorcery Incarnate while Innate Sorcery still has uses remaining (2 uses left).',
          automation: action.automation,
        },
      });
      expect(useMetamagic.spendSorceryPoints).not.toHaveBeenCalled();
      expect(buffService.setInnateSorceryActive).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: 'Sorcerer',
        description: expect.stringContaining('innate_sorcery_refused uses_remaining'),
      }));
    });

    it('blocks activation and logs insufficient_sorcery_points when current SP < cost', async () => {
      const action = makeIncarnateAction({ automation: { cost: 4 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      // Have: comes from currentSP (2), not maxSP (6)
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sorcery Incarnate',
          automationType: 'sorcery_incarnate',
          description: 'Not enough Sorcery Points to use Sorcery Incarnate. Cost: 4 SP, Have: 2 SP.',
          automation: action.automation,
        },
      });
      expect(useMetamagic.getCurrentSorceryPoints).toHaveBeenCalledWith('Sorcerer', 6);
      expect(useMetamagic.spendSorceryPoints).not.toHaveBeenCalled();
      expect(buffService.setInnateSorceryActive).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: 'Sorcerer',
        description: expect.stringContaining('innate_sorcery_refused insufficient_sorcery_points'),
      }));
    });

    it('uses default cost of 2 when automation.cost is omitted or undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(1);

      // omitted cost — raw action, fixture default cost stripped
      let result = await handle(
        { name: 'Sorcery Incarnate', automation: { type: 'sorcery_incarnate', casting_time: '1 bonus action' } },
        ps,
        campaignName,
        null,
      );
      expect(result.payload.description).toBe('Not enough Sorcery Points to use Sorcery Incarnate. Cost: 2 SP, Have: 1 SP.');

      // undefined cost
      result = await handle(makeIncarnateAction({ automation: { cost: undefined } }), ps, campaignName, null);
      expect(result.payload.description).toBe('Not enough Sorcery Points to use Sorcery Incarnate. Cost: 2 SP, Have: 1 SP.');
    });

    it('spends SP, sets uses to 0, activates sorcery, and returns full success popup', async () => {
      const action = makeIncarnateAction({ automation: { cost: 3 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sorcery Incarnate',
          automationType: 'sorcery_incarnate',
          description: 'Sorcery Incarnate activated (3 SP spent). Innate Sorcery is now active (0/2 uses remaining).',
          automation: action.automation,
        },
      });
      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith('Sorcerer', 3, campaignName, 6);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Sorcerer', 'innateSorceryUses', 0, campaignName);
      expect(buffService.setInnateSorceryActive).toHaveBeenCalledWith('Sorcerer', true, campaignName);
    });

    it('uses playerStats.name for all side-effect calls', async () => {
      const named = { name: 'Arch sorcerer', level: 5 };
      const action = makeIncarnateAction({ automation: { cost: 3 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 1, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      await handle(action, named, campaignName, null);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Arch sorcerer', 'innateSorceryUses', campaignName);
      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith('Arch sorcerer', 3, campaignName, 6);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Arch sorcerer', 'innateSorceryUses', 0, campaignName);
      expect(buffService.setInnateSorceryActive).toHaveBeenCalledWith('Arch sorcerer', true, campaignName);
    });

    it('defaults maxSorceryPoints to 0 in the spend call when getClassFeatures returns undefined', async () => {
      const action = makeIncarnateAction({ automation: { cost: 1 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue(undefined);
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(1);

      const result = await handle(action, ps, campaignName, null);

      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith('Sorcerer', 1, campaignName, 0);
      expect(result.payload.description).toBe('Sorcery Incarnate activated (1 SP spent). Innate Sorcery is now active (0/0 uses remaining).');
    });
  });

  // CLA-194 §5: activations log ability_use with the full buff description.
  describe('CLA-194 activation logging', () => {
    it('sorcery_aura activation logs ability_use with full buff description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      await handle(makeAuraAction(), ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Sorcerer',
        abilityName: 'Innate Sorcery',
        description: 'activated Innate Sorcery (+1 spell save DC, Advantage on Sorcerer spell attack rolls; 1/2 uses remaining)',
        timestamp: expect.any(Number),
      });
    });

    it('sorcery_incarnate activation logs ability_use with SP cost', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 0, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(2);

      await handle(makeIncarnateAction(), ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Sorcerer',
        abilityName: 'Innate Sorcery',
        description: 'activated Sorcery Incarnate via Sorcery Incarnate (2 SP spent; +1 spell save DC, Advantage on Sorcerer spell attack rolls)',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('resilience', () => {
    it('survives addEntry rejection without blocking activation', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failure = new Error('log down');
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });
      logService.addEntry.mockRejectedValueOnce(failure);

      const result = await handle(makeAuraAction(), ps, campaignName, null);

      expect(result.payload.description).toBe('Innate Sorcery activated (1/2 uses remaining).');
      expect(buffService.setInnateSorceryActive).toHaveBeenCalledWith('Sorcerer', true, campaignName);
      await vi.waitFor(() => {
        expect(errSpy).toHaveBeenCalledWith('[sorceryHandler:log-error]', failure);
      });
      errSpy.mockRestore();
    });
  });
});
