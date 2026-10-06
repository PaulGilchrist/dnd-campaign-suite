// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

function makePlayerStats(overrides = {}) {
  return {
    name: 'Sorcerer',
    level: 5,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  const automation = {
    type: 'metamagic_sorcery',
    cost: 2,
    ...overrides.automation,
    ...(overrides.type && { type: overrides.type }),
  };

  const rest = {};
  for (const key of Object.keys(overrides)) {
    if (key !== 'automation' && key !== 'type') {
      rest[key] = overrides[key];
    }
  }

  return {
    name: 'Metamagic Spell',
    automation,
    ...rest,
  };
}

function makeSorceryAuraAction(overrides = {}) {
  return {
    name: 'Metamagic Spell',
    automation: {
      type: 'sorcery_aura',
      ...overrides.automation,
    },
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('sorceryHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buffService.isInnateSorceryActive.mockReturnValue(false);
  });

  describe('early return — innate sorcery already active', () => {
    it('returns popup with already active message for both automation types', async () => {
      const ps = makePlayerStats();
      buffService.isInnateSorceryActive.mockReturnValue(true);

      // sorcery_aura
      const auraResult = await handle(makeSorceryAuraAction(), ps, campaignName, null);
      expect(auraResult.type).toBe('popup');
      expect(auraResult.payload.description).toContain('already active');

      // metamagic_sorcery
      const metaResult = await handle(makeAction({ type: 'metamagic_sorcery' }), ps, campaignName, null);
      expect(metaResult.type).toBe('popup');
      expect(metaResult.payload.description).toContain('already active');
    });
  });

  describe('sorcery_aura automation type', () => {
    it('returns failure popup when innateSorceryUses is zero or negative', async () => {
      const ps = makePlayerStats();
      const action = makeSorceryAuraAction();
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
      const action = makeSorceryAuraAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
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
      const action = makeSorceryAuraAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0/1 uses remaining');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer',
        'innateSorceryUses',
        0,
        campaignName,
      );
      expect(buffService.setInnateSorceryActive).toHaveBeenCalled();
    });

    it('falls back to usesMax when currentUses is null or undefined', async () => {
      const ps = makePlayerStats();
      const action = makeSorceryAuraAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('1/2 uses remaining');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer',
        'innateSorceryUses',
        1,
        campaignName,
      );
    });

    it('returns failure when maxInnateSorcery is undefined (falls back to 0, no remaining uses)', async () => {
      const ps = makePlayerStats();
      const action = makeSorceryAuraAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      classFeatures.getClassFeatures.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('has no remaining uses');
      expect(result.payload.description).toContain('Recharges on a long rest');
    });

    it('uses playerStats.name for runtime state and buff calls', async () => {
      const ps = makePlayerStats({ name: 'Arch sorcerer' });
      const action = makeSorceryAuraAction();
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

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Cannot use');
      expect(result.payload.description).toContain('while Innate Sorcery still has uses remaining');
      expect(result.payload.description).toContain('uses left');
    });

    it('proceeds to SP check when innateSorceryUses is zero and maxInnateSorcery is also zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 0, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Not enough Sorcery Points');
      expect(result.payload.description).toContain('Have: 1 SP');
    });

    it('blocks activation when SP is insufficient', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', automation: { type: 'metamagic_sorcery', cost: 4 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Not enough Sorcery Points');
      expect(result.payload.description).toContain('Cost: 4 SP');
      expect(result.payload.description).toContain('Have: 2 SP');
    });

    it('uses default cost of 2 when automation.cost is omitted or undefined', async () => {
      const ps = makePlayerStats();
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(1);

      // omitted cost
      let result = await handle(
        { name: 'Custom Spell', automation: { type: 'metamagic_sorcery' } },
        ps,
        campaignName,
        null,
      );
      expect(result.payload.description).toContain('Cost: 2 SP');

      // undefined cost
      result = await handle(
        { name: 'Custom Spell', automation: { type: 'metamagic_sorcery', cost: undefined } },
        ps,
        campaignName,
        null,
      );
      expect(result.payload.description).toContain('Cost: 2 SP');
    });

    it('spends SP, sets uses to 0, and activates sorcery on success', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', automation: { type: 'metamagic_sorcery', cost: 3 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith(
        'Sorcerer',
        3,
        campaignName,
        6,
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
      const action = makeAction({ type: 'metamagic_sorcery', automation: { type: 'metamagic_sorcery', cost: 1 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 0, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(3);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith(
        'Sorcerer',
        1,
        campaignName,
        6,
      );
      expect(result.payload.description).toContain('0/0 uses remaining');
    });

    it('uses currentSP from getCurrentSorceryPoints for insufficient-SP check', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', automation: { type: 'metamagic_sorcery', cost: 5 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Have: 4 SP');
    });

    it('uses playerStats.name for all side-effect calls', async () => {
      const ps = makePlayerStats({ name: 'Arch sorcerer' });
      const action = makeAction({ type: 'metamagic_sorcery', automation: { type: 'metamagic_sorcery', cost: 3 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 1, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      await handle(action, ps, campaignName, null);

      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith(
        'Arch sorcerer',
        3,
        campaignName,
        6,
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

    it('uses maxSorceryPoints from getClassFeatures for spendSorceryPoints call', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', automation: { type: 'metamagic_sorcery', cost: 3 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(5);

      await handle(action, ps, campaignName, null);

      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith(
        'Sorcerer',
        3,
        campaignName,
        10,
      );
    });

    it('defaults maxSorceryPoints to 0 when getClassFeatures returns undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', automation: { type: 'metamagic_sorcery', cost: 1 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue(undefined);
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(1);

      await handle(action, ps, campaignName, null);

      expect(useMetamagic.spendSorceryPoints).toHaveBeenCalledWith(
        'Sorcerer',
        1,
        campaignName,
        0,
      );
    });
  });

  // CLA-194: activation must log ability_use, refusals must log
  // automation + innate_sorcery_refused (§5 log conventions).
  describe('CLA-194 activation logging', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      buffService.isInnateSorceryActive.mockReturnValue(false);
    });

    it('sorcery_aura activation logs an ability_use entry', async () => {
      const ps = makePlayerStats();
      const action = makeSorceryAuraAction({ name: 'Innate Sorcery' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'Sorcerer',
        abilityName: 'Innate Sorcery',
      }));
      const entry = logService.addEntry.mock.calls.at(-1)[1];
      expect(entry.description).toContain('activated');
      expect(entry.description).toContain('1/2 uses remaining');
    });

    it('already-active refusal logs innate_sorcery_refused with zero spend', async () => {
      const ps = makePlayerStats();
      const action = makeSorceryAuraAction({ name: 'Innate Sorcery' });
      buffService.isInnateSorceryActive.mockReturnValue(true);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('already active');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: 'Sorcerer',
        description: expect.stringContaining('innate_sorcery_refused already_active'),
      }));
    });

    it('no-remaining-uses refusal logs innate_sorcery_refused no_uses', async () => {
      const ps = makePlayerStats();
      const action = makeSorceryAuraAction({ name: 'Innate Sorcery' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 2 });

      await handle(action, ps, campaignName, null);

      expect(buffService.setInnateSorceryActive).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        description: expect.stringContaining('innate_sorcery_refused no_uses'),
      }));
    });

    it('SP-lane activation logs ability_use with SP cost', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'metamagic_sorcery', automation: { type: 'metamagic_sorcery', cost: 2 } });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      classFeatures.getClassFeatures.mockReturnValue({ maxInnateSorcery: 0, maxSorceryPoints: 6 });
      useMetamagic.getCurrentSorceryPoints.mockReturnValue(2);

      await handle(action, ps, campaignName, null);

      const entry = logService.addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
      expect(entry).toBeDefined();
      expect(entry.characterName).toBe('Sorcerer');
      expect(entry.description).toContain('activated');
      expect(entry.description).toContain('2 SP');
    });
  });
});
