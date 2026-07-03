// @cleaned-by-ai
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
}));

// ── Imports ─────────────────────────────────────────────────────────

import { handle } from './sorceryHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as useMetamagic from '../../../../hooks/combat/useMetamagic.js';
import * as buffService from '../../../combat/buffs/buffService.js';

// ── Helpers ─────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Sorcerer',
    level: 5,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Metamagic Spell',
    automation: {
      type: 'metamagic_sorcery',
      cost: 2,
      ...overrides,
    },
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('sorceryHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sorcery_aura automation type', () => {
    it('returns failure popup when innateSorceryUses is zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Metamagic Spell');
      expect(result.payload.automationType).toBe('sorcery_aura');
      expect(result.payload.description).toContain('has no remaining uses');
      expect(result.payload.description).toContain('Recharges on a long rest');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('activates sorcery and decrements uses when uses are available', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('1/3 uses remaining');
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

    it('activates sorcery and sets uses to zero when using the last use', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('0/1 uses remaining');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer',
        'innateSorceryUses',
        0,
        campaignName,
      );
      expect(buffService.setInnateSorceryActive).toHaveBeenCalled();
    });

    it('falls back to usesMax when currentUses is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'sorcery_aura' });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('1/2 uses remaining');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer',
        'innateSorceryUses',
        1,
        campaignName,
      );
    });

    it('uses playerStats.name for runtime state and buff calls', async () => {
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

  });

  describe('metamagic_sorcery automation type', () => {
    it('blocks activation when innateSorcery still has uses remaining', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Cannot use');
      expect(result.payload.description).toContain('while Innate Sorcery still has uses remaining');
      expect(result.payload.description).toContain('2 uses left');
      expect(useMetamagic.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('proceeds to SP check when innateSorceryUses is zero and maxInnateSorcery is also zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 0, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Not enough Sorcery Points');
      expect(result.payload.description).toContain('Have: 1 SP');
    });

    it('blocks activation when SP is insufficient', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', cost: 4 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Not enough Sorcery Points');
      expect(result.payload.description).toContain('Cost: 4 SP');
      expect(result.payload.description).toContain('Have: 2 SP');
      expect(useMetamagic.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('uses default cost of 2 when automation.cost is omitted', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Custom Spell',
        automation: { type: 'metamagic_sorcery' },
      };
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Cost: 2 SP');
    });

    it('spends SP, sets uses to 0, and activates sorcery on success', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', cost: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      const result = await handle(action, ps, campaignName, null);

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
      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('3 SP spent');
      expect(result.payload.description).toContain('Innate Sorcery is now active');
    });

    it('spends SP even when maxInnateSorcery is zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', cost: 1 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 0, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(3);

      const result = await handle(action, ps, campaignName, null);

      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith(
        'Sorcerer',
        1,
        campaignName,
      );
      expect(result.payload.description).toContain('0/0 uses remaining');
    });

    it('uses currentSP from getCurrentSorceryPoints for insufficient-SP check', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', cost: 5 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Have: 4 SP');
      expect(useMetamagic.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('uses playerStats.name for all side-effect calls', async () => {
      const ps = makePlayerStats({ name: 'Arch sorcerer' });
      const action = makeAction({ type: 'metamagic_sorcery', cost: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 1, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      await handle(action, ps, campaignName, null);

      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith(
        'Arch sorcerer',
        3,
        campaignName,
      );
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

  });
});
