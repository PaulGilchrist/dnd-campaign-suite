import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../../automation/index.js', () => ({
  executeHandler: vi.fn().mockResolvedValue({ type: 'popup', payload: {} }),
}));

// ── Imports ────────────────────────────────────────────────────

import {
  getPostCastRiderSaves,
  hasPostCastRiderSave,
  triggerPostCastRiderSaves,
} from '../../../rules/spells/postCastRiderService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationIndex from '../../../automation/index.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiencyBonus: 3,
    abilities: [
      { name: 'Strength', bonus: 2 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 0 },
      { name: 'Intelligence', bonus: 3 },
      { name: 'Wisdom', bonus: -1 },
      { name: 'Charisma', bonus: 4 },
    ],
    characterAdvancement: [],
    automation: { passives: [] },
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Charm Person',
    school: 'enchantment',
    level: 1,
    ...overrides,
  };
}

function makeMetaCtx(overrides = {}) {
  return { slotLevel: 1, ...overrides };
}

// ── Tests for getPostCastRiderSaves ────────────────────────────

describe('getPostCastRiderSaves', () => {
  it('should return empty array when no passives exist', () => {
    const ps = makePlayerStats({ automation: { passives: [] } });
    expect(getPostCastRiderSaves(ps)).toEqual([]);
  });

  it('should return empty array when passives is undefined', () => {
    const ps = makePlayerStats({ automation: {} });
    expect(getPostCastRiderSaves(ps)).toEqual([]);
  });

  it('should filter for post_cast_rider type passives', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_rider', name: 'Charm Save' },
          { type: 'post_cast_rider', name: 'Fear Save' },
        ],
      },
    });
    const result = getPostCastRiderSaves(ps);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Charm Save');
    expect(result[1].name).toBe('Fear Save');
  });

  it('should filter for passive_rule type with riderSave property', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', riderSave: { type: 'WIS' }, name: 'Rider Rule' },
          { type: 'passive_rule', name: 'No Rider' },
        ],
      },
    });
    const result = getPostCastRiderSaves(ps);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Rider Rule');
  });

  it('should exclude passives that are neither post_cast_rider nor passive_rule with riderSave', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_rider', name: 'Valid' },
          { type: 'passive_rule', riderSave: { type: 'CHA' }, name: 'ValidRule' },
          { type: 'passive_rule', name: 'InvalidNoRiderSave' },
          { type: 'some_other_type', name: 'InvalidType' },
        ],
      },
    });
    const result = getPostCastRiderSaves(ps);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.name)).toEqual(['Valid', 'ValidRule']);
  });

  it('should handle null playerStats gracefully', () => {
    expect(() => getPostCastRiderSaves(null)).toThrow();
  });
});

// ── Tests for hasPostCastRiderSave ─────────────────────────────

describe('hasPostCastRiderSave', () => {
  it('should return false when no rider saves exist', () => {
    const ps = makePlayerStats();
    expect(hasPostCastRiderSave(ps)).toBe(false);
  });

  it('should return true when at least one rider save exists', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [{ type: 'post_cast_rider', name: 'Charm Save' }],
      },
    });
    expect(hasPostCastRiderSave(ps)).toBe(true);
  });

  it('should return true when passive_rule with riderSave exists', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [{ type: 'passive_rule', riderSave: { type: 'CHA' }, name: 'RiderRule' }],
      },
    });
    expect(hasPostCastRiderSave(ps)).toBe(true);
  });

  it('should return false when only non-matching passives exist', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', name: 'NoRider' },
          { type: 'some_other_type', name: 'Other' },
        ],
      },
    });
    expect(hasPostCastRiderSave(ps)).toBe(false);
  });
});

// ── Tests for triggerPostCastRiderSaves ────────────────────────

describe('triggerPostCastRiderSaves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: getRuntimeValue returns 1 for any key (rider has uses)
    useRuntimeState.getRuntimeValue.mockReturnValue(1);
  });

  it('should return null for non-enchantment/illusion spells', async () => {
    const spell = makeSpell({ school: 'evocation' });
    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      makePlayerStats(),
      campaignName,
      mapName,
    );
    expect(result).toBeNull();
  });

  it('should return null for spells with no school', async () => {
    const spell = makeSpell({ school: '' });
    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      makePlayerStats(),
      campaignName,
      mapName,
    );
    expect(result).toBeNull();
  });

  it('should match enchantment school case-insensitively', async () => {
    const spell = makeSpell({ school: 'Enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] },
    });

    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );
    expect(result).not.toBeNull();
  });

  it('should match illusion school case-insensitively', async () => {
    const spell = makeSpell({ school: 'ILLUSION' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Phantom Save' }] },
    });

    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );
    expect(result).not.toBeNull();
  });

  it('should return null when spell uses no slot and level is 0', async () => {
    const spell = makeSpell({ school: 'enchantment', level: 0 });
    const metaCtx = { slotLevel: 0 };
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] },
    });

    const result = await triggerPostCastRiderSaves(
      spell,
      metaCtx,
      ps,
      campaignName,
      mapName,
    );
    expect(result).toBeNull();
  });

  it('should proceed when spell has slotLevel > 0', async () => {
    const spell = makeSpell({ school: 'enchantment', level: 0 });
    const metaCtx = { slotLevel: 1 };
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] },
    });

    const result = await triggerPostCastRiderSaves(
      spell,
      metaCtx,
      ps,
      campaignName,
      mapName,
    );
    expect(result).not.toBeNull();
  });

  it('should proceed when spell has level > 0 even with slotLevel 0', async () => {
    const spell = makeSpell({ school: 'illusion', level: 2 });
    const metaCtx = { slotLevel: 0 };
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Phantom Save' }] },
    });

    const result = await triggerPostCastRiderSaves(
      spell,
      metaCtx,
      ps,
      campaignName,
      mapName,
    );
    expect(result).not.toBeNull();
  });

  it('should return null when no rider saves are configured', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats();

    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );
    expect(result).toBeNull();
  });

  it('should skip riders with uses <= 0', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_rider', name: 'Charm Save' },
          { type: 'post_cast_rider', name: 'Fear Save' },
        ],
      },
    });
    useRuntimeState.getRuntimeValue.mockImplementation((_char, key) => {
      if (key.includes('Charm')) return 0;
      return 1;
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    // Only Fear Save should have been executed (Charm Save was skipped due to 0 uses)
    expect(automationIndex.executeHandler).toHaveBeenCalledTimes(1);
    expect(automationIndex.executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fear Save' }),
      ps,
      campaignName,
      mapName,
    );
  });

  it('should build correct action for riderSave type riders', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [
          {
            type: 'passive_rule',
            riderSave: {
              type: 'CHA',
              condition: 'Charmed',
              duration: '1 minute',
              range: '30 ft.',
              recharge: '6',
            },
            name: 'Charm Rider',
          },
        ],
      },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(automationIndex.executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Charm Rider',
        automation: expect.objectContaining({
          type: 'post_cast_rider',
          saveType: 'CHA',
          saveDc: 'ability',
          saveAbility: 'CHA',
          condition: 'Charmed',
          duration: '1 minute',
          range: '30 ft.',
          recharge: '6',
        }),
      }),
      ps,
      campaignName,
      mapName,
    );
  });

  it('should build correct action for non-riderSave type riders', async () => {
    const spell = makeSpell({ school: 'illusion' });
    const ps = makePlayerStats({
      automation: {
        passives: [
          {
            type: 'post_cast_rider',
            name: 'Phantom Rider',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'INT',
            condition: 'Frightened',
            duration: '1 round',
            range: '60 ft.',
            spellSchools: ['illusion'],
            recharge: '5-6',
          },
        ],
      },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(automationIndex.executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Phantom Rider',
        automation: expect.objectContaining({
          type: 'post_cast_rider',
          saveType: 'WIS',
          saveDc: 15,
          saveAbility: 'INT',
          condition: 'Frightened',
          duration: '1 round',
          range: '60 ft.',
          spellSchools: ['illusion'],
          recharge: '5-6',
        }),
      }),
      ps,
      campaignName,
      mapName,
    );
  });

  it('should collect results from multiple riders', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_rider', name: 'Rider A' },
          { type: 'post_cast_rider', name: 'Rider B' },
        ],
      },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: { name: 'result' } });

    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(result).toHaveLength(2);
    expect(result[0].payload.name).toBe('result');
    expect(result[1].payload.name).toBe('result');
  });

  it('should return null when all riders produce no results', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [{ type: 'post_cast_rider', name: 'Silent Rider' }],
      },
    });
    automationIndex.executeHandler.mockResolvedValue(null);

    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(result).toBeNull();
  });

  it('should catch and log errors from handler execution', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [{ type: 'post_cast_rider', name: 'Failing Rider' }],
      },
    });
    automationIndex.executeHandler.mockRejectedValue(new Error('handler broke'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      '[postCastRider] Failed to execute rider save for Failing Rider:',
      expect.any(Error),
    );
    expect(result).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should use runtime value default of 1 when getRuntimeValue returns undefined', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Default Uses' }] },
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    const result = await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(result).not.toBeNull();
  });

  it('should use metaCtx slotLevel when available', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Slot Rider' }] },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    await triggerPostCastRiderSaves(
      spell,
      { slotLevel: 3 },
      ps,
      campaignName,
      mapName,
    );

    expect(automationIndex.executeHandler).toHaveBeenCalled();
  });

  it('should use spell level when metaCtx is null', async () => {
    const spell = makeSpell({ school: 'illusion', level: 3 });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Null Meta Rider' }] },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    const result = await triggerPostCastRiderSaves(
      spell,
      null,
      ps,
      campaignName,
      mapName,
    );

    expect(result).not.toBeNull();
  });

  it('should use spell level when metaCtx is undefined', async () => {
    const spell = makeSpell({ school: 'enchantment', level: 2 });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Undefined Meta Rider' }] },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    const result = await triggerPostCastRiderSaves(
      spell,
      undefined,
      ps,
      campaignName,
      mapName,
    );

    expect(result).not.toBeNull();
  });

  it('should return null when metaCtx is null and spell level is 0', async () => {
    const spell = makeSpell({ school: 'enchantment', level: 0 });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'No Uses Rider' }] },
    });

    const result = await triggerPostCastRiderSaves(
      spell,
      null,
      ps,
      campaignName,
      mapName,
    );

    expect(result).toBeNull();
  });

  it('should use campaignName for runtime value lookup', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Campaign Rider' }] },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      'MyCampaign',
      mapName,
    );

    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'postCastRider_Campaign_Rider',
      'MyCampaign',
    );
  });

  it('should handle rider names with spaces in runtime key', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'My Special Rider' }] },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'postCastRider_My_Special_Rider',
      campaignName,
    );
  });

  it('should pass mapName to executeHandler', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Map Rider' }] },
    });
    automationIndex.executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

    await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      'DungeonMap1',
    );

    expect(automationIndex.executeHandler).toHaveBeenCalledWith(
      expect.any(Object),
      ps,
      campaignName,
      'DungeonMap1',
    );
  });

  it('should not call executeHandler when rider has no uses', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Exhausted Rider' }] },
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(automationIndex.executeHandler).not.toHaveBeenCalled();
  });

  it('should not call executeHandler when rider has negative uses', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Negative Rider' }] },
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(-1);

    await triggerPostCastRiderSaves(
      spell,
      makeMetaCtx(),
      ps,
      campaignName,
      mapName,
    );

    expect(automationIndex.executeHandler).not.toHaveBeenCalled();
  });
});
