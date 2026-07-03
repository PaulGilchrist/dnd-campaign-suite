// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

import {
  getPostCastRiderSaves,
  triggerPostCastRiderSaves,
} from '../../../rules/spells/postCastRiderService.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../../automation/index.js';

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
  return { name: 'Charm Person', school: 'enchantment', level: 1, ...overrides };
}

function makeMetaCtx(overrides = {}) {
  return { slotLevel: 1, ...overrides };
}

// ── getPostCastRiderSaves ──────────────────────────────────────

describe('getPostCastRiderSaves', () => {
  it('returns empty array when passives is empty', () => {
    const ps = makePlayerStats();
    expect(getPostCastRiderSaves(ps)).toEqual([]);
  });

  it('returns passives with type post_cast_rider', () => {
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
    expect(result.map((p) => p.name)).toEqual(['Charm Save', 'Fear Save']);
  });

  it('returns passive_rule types that have a truthy riderSave', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', riderSave: { type: 'WIS' }, name: 'Rider Rule' },
          { type: 'passive_rule', name: 'No Rider' },
        ],
      },
    });
    expect(getPostCastRiderSaves(ps)).toHaveLength(1);
  });

  it('excludes passives that are neither post_cast_rider nor passive_rule with riderSave', () => {
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
    expect(getPostCastRiderSaves(ps).map((p) => p.name)).toEqual(['Valid', 'ValidRule']);
  });

  it('throws when automation.passives is missing or null', () => {
    expect(() => getPostCastRiderSaves({})).toThrow('Expected array');
    expect(() => getPostCastRiderSaves({ automation: { passives: null } })).toThrow('Expected array');
  });
});

// ── triggerPostCastRiderSaves ──────────────────────────────────

describe('triggerPostCastRiderSaves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(1);
    executeHandler.mockResolvedValue({ type: 'popup', payload: {} });
  });

  it('returns null when spell school is not enchantment or illusion', async () => {
    const spell = makeSpell({ school: 'evocation' });
    const result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), makePlayerStats(), campaignName, mapName);
    expect(result).toBeNull();
  });

  it('returns null when spell school is undefined or empty', async () => {
    const ps = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] } });
    expect(
      await triggerPostCastRiderSaves(makeSpell({ school: undefined }), makeMetaCtx(), ps, campaignName, mapName)
    ).toBeNull();
    expect(
      await triggerPostCastRiderSaves(makeSpell({ school: '' }), makeMetaCtx(), ps, campaignName, mapName)
    ).toBeNull();
  });

  it('matches enchantment and illusion schools case-insensitively', async () => {
    const ps = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] } });
    const enchantResult = await triggerPostCastRiderSaves(makeSpell({ school: 'Enchantment' }), makeMetaCtx(), ps, campaignName, mapName);
    expect(enchantResult).not.toBeNull();

    const illusionPs = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Phantom Save' }] } });
    const illusionResult = await triggerPostCastRiderSaves(makeSpell({ school: 'ILLUSION' }), makeMetaCtx(), illusionPs, campaignName, mapName);
    expect(illusionResult).not.toBeNull();
  });

  it('returns null when both metaCtx.slotLevel and spell.level are 0', async () => {
    const spell = makeSpell({ level: 0 });
    const metaCtx = { slotLevel: 0 };
    const ps = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] } });
    const result = await triggerPostCastRiderSaves(spell, metaCtx, ps, campaignName, mapName);
    expect(result).toBeNull();
  });

  it('proceeds when metaCtx.slotLevel > 0 or spell.level > 0', async () => {
    const ps = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] } });
    const illusionPs = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Phantom Save' }] } });

    const slotLevelResult = await triggerPostCastRiderSaves(makeSpell({ level: 0, school: 'enchantment' }), { slotLevel: 1 }, ps, campaignName, mapName);
    expect(slotLevelResult).not.toBeNull();

    const spellLevelResult = await triggerPostCastRiderSaves(makeSpell({ school: 'illusion', level: 2 }), { slotLevel: 0 }, illusionPs, campaignName, mapName);
    expect(spellLevelResult).not.toBeNull();
  });

  it('returns null when metaCtx is null/undefined and spell.level is 0', async () => {
    const ps = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'No Uses Rider' }] } });
    expect(
      await triggerPostCastRiderSaves(makeSpell({ school: 'enchantment', level: 0 }), null, ps, campaignName, mapName)
    ).toBeNull();
    expect(
      await triggerPostCastRiderSaves(makeSpell({ school: 'enchantment', level: 0 }), undefined, ps, campaignName, mapName)
    ).toBeNull();
  });

  it('proceeds when metaCtx is null/undefined and spell.level > 0', async () => {
    const ps1 = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Null Meta Rider' }] } });
    const result1 = await triggerPostCastRiderSaves(makeSpell({ school: 'illusion', level: 3 }), null, ps1, campaignName, mapName);
    expect(result1).not.toBeNull();

    const ps2 = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Undefined Meta Rider' }] } });
    const result2 = await triggerPostCastRiderSaves(makeSpell({ school: 'enchantment', level: 2 }), undefined, ps2, campaignName, mapName);
    expect(result2).not.toBeNull();
  });

  it('returns null when no rider saves are configured', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), makePlayerStats(), campaignName, mapName);
    expect(result).toBeNull();
  });

  it('skips riders with zero or negative runtime uses', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Exhausted Rider' }] },
    });

    getRuntimeValue.mockReturnValue(0);
    let result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);
    expect(result).toBeNull();
    expect(executeHandler).not.toHaveBeenCalled();

    getRuntimeValue.mockReturnValue(-1);
    result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);
    expect(result).toBeNull();
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('defaults runtime uses to 1 when getRuntimeValue returns undefined', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Default Uses' }] },
    });
    getRuntimeValue.mockReturnValue(undefined);

    const result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);

    expect(result).not.toBeNull();
    expect(executeHandler).toHaveBeenCalled();
  });

  it('skips riders with exhausted uses and executes remaining ones', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_rider', name: 'Charm Save' },
          { type: 'post_cast_rider', name: 'Fear Save' },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_char, key) => {
      if (key.includes('Charm')) return 0;
      return 1;
    });

    const result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(executeHandler).toHaveBeenCalledTimes(1);
    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fear Save' }),
      ps,
      campaignName,
      mapName,
    );
  });

  it('builds correct action shape for passive_rule riders with riderSave', async () => {
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

    await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);

    expect(executeHandler).toHaveBeenCalledWith(
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

  it('builds correct action shape for post_cast_rider riders with direct properties', async () => {
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

    await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);

    expect(executeHandler).toHaveBeenCalledWith(
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

  it('collects results from multiple riders that all succeed', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_rider', name: 'Rider A' },
          { type: 'post_cast_rider', name: 'Rider B' },
        ],
      },
    });
    executeHandler.mockResolvedValue({ type: 'popup', payload: { name: 'result' } });

    const result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);

    expect(result).toHaveLength(2);
    expect(result[0].payload.name).toBe('result');
    expect(result[1].payload.name).toBe('result');
  });

  it('filters out null results from riders', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_rider', name: 'Silent Rider' },
        ],
      },
    });
    executeHandler.mockResolvedValue(null);

    const result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);

    expect(result).toBeNull();
  });

  it('returns null when all riders produce null results', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_rider', name: 'Silent A' },
          { type: 'post_cast_rider', name: 'Silent B' },
        ],
      },
    });
    executeHandler.mockResolvedValue(null);

    const result = await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName);

    expect(result).toBeNull();
  });

  it('throws and logs when a rider handler errors', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Failing Rider' }] },
    });
    executeHandler.mockRejectedValue(new Error('handler broke'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, mapName)
    ).rejects.toThrow('handler broke');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[postCastRider] Failed to execute rider save for Failing Rider:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('uses campaignName for runtime value lookup and converts spaces to underscores in key', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'My Special Rider' }] },
    });

    await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, 'MyCampaign', mapName);

    expect(getRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'postCastRider_My_Special_Rider',
      'MyCampaign',
    );
  });

  it('passes campaignName and mapName to executeHandler', async () => {
    const spell = makeSpell({ school: 'enchantment' });
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Map Rider' }] },
    });

    await triggerPostCastRiderSaves(spell, makeMetaCtx(), ps, campaignName, 'DungeonMap1');

    expect(executeHandler).toHaveBeenCalledWith(
      expect.any(Object),
      ps,
      campaignName,
      'DungeonMap1',
    );
  });
});
