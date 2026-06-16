import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

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
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle } from './sorceryHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as useMetamagic from '../../../../hooks/combat/useMetamagic.js';
import * as buffService from '../../../combat/buffs/buffService.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Sorcerer',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Metamagic Spell',
    automation: {
      type: 'metamagic_sorcery',
      cost: 2,
      ...automation,
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('sorceryHandler.handle', () => {
  function resetMocks() {
    useRuntimeState.getRuntimeValue.mockClear().mockReset();
    useRuntimeState.setRuntimeValue.mockClear().mockReset();
    classFeatures.getClassFeatures.mockClear().mockReset();
    useMetamagic.getCurrentSorceryPoints.mockClear().mockReset();
    useMetamagic.spendSorceryPoints.mockClear().mockReset();
    buffService.setInnateSorceryActive.mockClear().mockReset();
  }

  beforeEach(() => {
    resetMocks();
  });

  // ── sorcery_aura automation type ───────────────────────────────

  describe('sorcery_aura automation type', () => {
    it('returns popup with no remaining uses when currentUses is 0', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('has no remaining uses');
      expect(result.payload.description).toContain('Recharges on a long rest');
    });

    it('returns popup with no remaining uses when currentUses is null and maxInnateSorcery is 0', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('has no remaining uses');
    });

    it('decrements uses and activates sorcery when there are uses remaining', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      await handle(action, ps, campaignName, null);

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
      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('returns activation popup with remaining uses on success', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('1/3 uses remaining');
    });

    it('activates even when using the last use (remaining becomes 0)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer',
        'innateSorceryUses',
        0,
        campaignName,
      );
      expect(buffService.setInnateSorceryActive).toHaveBeenCalled();
      expect(result.payload.description).toContain('0/1 uses remaining');
    });

    it('falls back to usesMax when currentUses is null (and usesMax > 0)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('1/2 uses remaining');
    });

    it('includes correct payload structure for sorcery_aura', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Metamagic Spell');
      expect(result.payload.automationType).toBe('sorcery_aura');
    });
  });

  // ── metamagic_sorcery (default) mode ───────────────────────────

  describe('metamagic_sorcery default mode', () => {
    it('returns early popup when Innate Sorcery still has uses remaining', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'metamagic_sorcery' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('while Innate Sorcery still has uses remaining');
      expect(result.payload.description).toContain('2 uses left');
      expect(useMetamagic.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('returns early popup when currentUses is null but usesMax > 0', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'metamagic_sorcery' });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('while Innate Sorcery still has uses remaining');
    });

    it('returns popup about insufficient SP when cost exceeds current points', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'metamagic_sorcery', cost: 4 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0); // no innate uses
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Not enough Sorcery Points');
      expect(result.payload.description).toContain('Cost: 4 SP');
      expect(result.payload.description).toContain('Have: 2 SP');
    });

    it('uses default cost of 2 when auto.cost is not specified', async () => {
      const ps = makePlayerStats({});
      const action = {
        name: 'Custom Spell',
        automation: { type: 'metamagic_sorcery' }, // no cost field
      };
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Cost: 2 SP');
    });

    it('spends sorcery points and sets innateSorceryUses to 0 on success', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'metamagic_sorcery', cost: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      await handle(action, ps, campaignName, null);

      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith(
        'Sorcerer',
        3,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer',
        'innateSorceryUses',
        0,
        campaignName,
      );
      expect(buffService.setInnateSorceryActive).toHaveBeenCalledWith(
        'Sorcerer',
        true,
        campaignName,
      );
      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('returns activation popup on successful spend', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'metamagic_sorcery', cost: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('3 SP spent');
      expect(result.payload.description).toContain('Innate Sorcery is now active');
    });

    it('includes correct payload structure for metamagic_sorcery', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'metamagic_sorcery' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 1, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(3);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Metamagic Spell');
      expect(result.payload.automationType).toBe('metamagic_sorcery');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    it('does not dispatch event or spend points on sorcery_aura with zero uses', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(buffService.setInnateSorceryActive).not.toHaveBeenCalled();
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('does not call spendSorceryPoints when SP is insufficient', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'metamagic_sorcery', cost: 5 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 4 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(3);

      await handle(action, ps, campaignName, null);

      expect(useMetamagic.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('uses action.name in all popup payloads', async () => {
      const ps = makePlayerStats({});
      const action = {
        name: 'Careful Spell',
        automation: { type: 'metamagic_sorcery', cost: 2 },
      };
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 1, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Careful Spell');
    });

    it('uses playerStats.name for all runtime state calls', async () => {
      const ps = makePlayerStats({ name: 'Arch sorcerer' });
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Arch sorcerer',
        'innateSorceryUses',
        0,
        campaignName,
      );
      expect(buffService.setInnateSorceryActive).toHaveBeenCalledWith(
        'Arch sorcerer',
        true,
        campaignName,
      );
    });

    it('includes automation object in returned payload', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual(action.automation);
    });

    it('handles negative currentUses as zero for sorcery_aura', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(-1); // treated as Number(-1) <= 0
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('has no remaining uses');
    });
  });
});
