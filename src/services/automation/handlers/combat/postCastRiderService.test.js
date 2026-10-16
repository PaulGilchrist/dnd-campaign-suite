// @maintained-by-ai
// SERVICE lane for src/services/rules/spells/postCastRiderService.js (not the
// postCastRiderHandler terminal-executor lane). The co-located suite
// (src/services/rules/spells/postCastRiderService.test.js) owns the canonical module
// coverage: school/slot gates, rider action shapes (both formats), result collection,
// exhausted-uses(0), multi-target spreads, soulstitch/bewitching lanes.
// This file keeps ONLY the service-trigger pins the co-located suite lacks:
// passives-missing throw, uses <= 0 boundary (incl. negative), `?? 1` default,
// partial-exhaustion dispatch, null-result filtering, error rethrow + log message,
// service-side usesKey splicing, null/undefined metaCtx, undefined spell.
// Deterministic pure behaviour over mocked executeHandler — no app churn expected.
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

  it('matches enchantment and illusion schools case-insensitively', async () => {
    const ps = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] } });
    await triggerPostCastRiderSaves(makeSpell({ school: 'Enchantment' }), makeMetaCtx(), ps, campaignName, mapName);
    expect(executeHandler).toHaveBeenCalledTimes(1);

    const illusionPs = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Phantom Save' }] } });
    await triggerPostCastRiderSaves(makeSpell({ school: 'ILLUSION' }), makeMetaCtx(), illusionPs, campaignName, mapName);
    expect(executeHandler).toHaveBeenCalledTimes(2);
  });

  it('proceeds when metaCtx is null/undefined and spell.level > 0', async () => {
    const ps1 = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Null Meta Rider' }] } });
    await triggerPostCastRiderSaves(makeSpell({ school: 'illusion', level: 3 }), null, ps1, campaignName, mapName);
    expect(executeHandler).toHaveBeenCalledTimes(1);

    const ps2 = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Undefined Meta Rider' }] } });
    await triggerPostCastRiderSaves(makeSpell({ school: 'enchantment', level: 2 }), undefined, ps2, campaignName, mapName);
    expect(executeHandler).toHaveBeenCalledTimes(2);
  });

  it('skips riders with zero or negative runtime uses', async () => {
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Exhausted Rider' }] },
    });

    for (const uses of [0, -1]) {
      getRuntimeValue.mockReturnValue(uses);
      const result = await triggerPostCastRiderSaves(makeSpell(), makeMetaCtx(), ps, campaignName, mapName);
      expect(result).toBeNull();
    }
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('defaults runtime uses to 1 when getRuntimeValue returns undefined', async () => {
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Default Uses' }] },
    });
    getRuntimeValue.mockReturnValue(undefined);

    const result = await triggerPostCastRiderSaves(makeSpell(), makeMetaCtx(), ps, campaignName, mapName);

    expect(result).toHaveLength(1);
    expect(executeHandler).toHaveBeenCalledTimes(1);
  });

  it('skips riders with exhausted uses and dispatches remaining one with exact args', async () => {
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

    const result = await triggerPostCastRiderSaves(makeSpell(), makeMetaCtx(), ps, campaignName, mapName);

    expect(result).toHaveLength(1);
    expect(executeHandler).toHaveBeenCalledTimes(1);
    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fear Save' }),
      ps,
      campaignName,
      mapName,
    );
  });

  it('filters out null results from riders and returns null when all are null', async () => {
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Silent Rider' }] },
    });
    executeHandler.mockResolvedValue(null);

    const result = await triggerPostCastRiderSaves(makeSpell(), makeMetaCtx(), ps, campaignName, mapName);

    expect(result).toBeNull();
  });

  it('throws and logs when a rider handler errors', async () => {
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'Failing Rider' }] },
    });
    executeHandler.mockRejectedValueOnce(new Error('handler broke'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      triggerPostCastRiderSaves(makeSpell(), makeMetaCtx(), ps, campaignName, mapName)
    ).rejects.toThrow('handler broke');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[postCastRider] Failed to execute rider save for Failing Rider:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('splices spaces to underscores in the uses key and forwards campaignName', async () => {
    const ps = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_rider', name: 'My Special Rider' }] },
    });

    await triggerPostCastRiderSaves(makeSpell(), makeMetaCtx(), ps, 'MyCampaign', mapName);

    expect(getRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'postCastRider_My_Special_Rider',
      'MyCampaign',
    );
  });

  it('throws before dispatch when spell is undefined', async () => {
    const ps = makePlayerStats({ automation: { passives: [{ type: 'post_cast_rider', name: 'Charm Save' }] } });
    await expect(
      triggerPostCastRiderSaves(undefined, makeMetaCtx(), ps, campaignName, mapName)
    ).rejects.toThrow();
    expect(executeHandler).not.toHaveBeenCalled();
  });
});
