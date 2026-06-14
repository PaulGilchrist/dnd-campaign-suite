import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../combat/baseCombatActions.js', () => ({
  MELEE_REACH_FEET: 5,
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './reactionDamageHandler.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Reaction Strike',
    automation,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionDamageHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return attack_roll when melee attack exists', async () => {
    const ps = makePlayerStats({
      attacks: [
        { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
      ],
    });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.attack).toEqual({ name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' });
    expect(result.payload.targetName).toBe('Enemy');
    expect(result.payload.sourceName).toBe(action.name);
  });

  it('should return first melee attack when multiple melee attacks exist', async () => {
    const ps = makePlayerStats({
      attacks: [
        { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
        { name: 'Rapier', type: 'Action', range: 5, damage: '1d8+3' },
        { name: 'Longbow', type: 'Action', range: 150, damage: '1d8+3' },
      ],
    });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.attack.name).toBe('Shortsword');
  });

  it('should fall back to first attack when no melee attacks match', async () => {
    const ps = makePlayerStats({
      attacks: [
        { name: 'Longbow', type: 'Action', range: 150, damage: '1d8+3' },
        { name: 'Shortsword', type: 'Bonus Action', range: 5, damage: '1d6+3' },
      ],
    });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.attack.name).toBe('Longbow');
  });

  it('should return no melee attack popup when playerStats.attacks is empty array', async () => {
    const ps = makePlayerStats({ attacks: [] });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe(`${action.name}: No melee attack available.`);
  });

  it('should return no melee attack popup when playerStats.attacks is null', async () => {
    const ps = makePlayerStats({ attacks: null });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
  });

  it('should return no melee attack popup when playerStats.attacks is undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
  });

  it('should include targetName in payload when combat context has a target', async () => {
    const ps = makePlayerStats({
      attacks: [
        { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
      ],
    });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'TargetCreature' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBe('TargetCreature');
  });

  it('should include null targetName when no combat context', async () => {
    const ps = makePlayerStats({
      attacks: [
        { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
      ],
    });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBeNull();
  });

  it('should include null targetName when getTargetFromAttacker returns null', async () => {
    const ps = makePlayerStats({
      attacks: [
        { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
      ],
    });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBeNull();
  });

  it('should use action.name as sourceName in payload', async () => {
    const ps = makePlayerStats({
      attacks: [
        { name: 'Shortsword', type: 'Action', range: 5, damage: '1d6+3' },
      ],
    });
    const action = makeAction();

    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.sourceName).toBe(action.name);
  });
});
