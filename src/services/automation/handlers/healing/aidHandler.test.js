import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn((r) => {
    if (typeof r === 'number') return r;
    const m = String(r).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (expr === '5') return 5;
    if (expr === '2d6+3') return 8;
    return 5;
  }),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

import { handle, applyAid } from './aidHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}, spell = {}) {
  return {
    name: 'Aid',
    automation: { type: 'aid', ...automation },
    spell: { level: 2, ...spell },
    spellSlotLevel: 2,
  };
}

describe('aidHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup with aid_target_selection type', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'player' },
        { name: 'TestCleric', type: 'player' },
      ],
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('aid_target_selection');
  });

  it('should return popup when no combat context', async () => {
    getCombatContext.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No combat context found');
  });

  it('should exclude caster from creatureTargets', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally1', type: 'player' },
        { name: 'TestCleric', type: 'player' },
      ],
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.payload.creatureTargets).toEqual(['Ally1']);
  });

  it('should return maxTargets from automation', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });

    const result = await handle(makeAction({ maxTargets: 5 }), makePlayerStats(), campaignName, mapName);

    expect(result.payload.maxTargets).toBe(5);
  });

  it('should default maxTargets to 3', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.payload.maxTargets).toBe(3);
  });

  it('should calculate hpIncrease from spell expression', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });

    const result = await handle(makeAction({}, { automation: { hpMaxIncreaseExpression: '2d6+3' } }), makePlayerStats(), campaignName, mapName);

    expect(result.payload.hpIncrease).toBe(8);
  });

  it('should default hpIncrease to 5', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.payload.hpIncrease).toBe(5);
  });

  it('should include duration in payload', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });

    const result = await handle(makeAction({}, { duration: '8 hours' }), makePlayerStats(), campaignName, mapName);

    expect(result.payload.duration).toBe('8 hours');
  });

  it('should include attackerPos when mapName provided', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Ally1', type: 'player' }],
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.payload).toHaveProperty('attackerPos');
  });
});

describe('aidHandler.applyAid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no targetNames provided', async () => {
    const result = await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, null);
    expect(result).toBeNull();
  });

  it('should return null when empty targetNames array', async () => {
    const result = await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, []);
    expect(result).toBeNull();
  });

  it('should apply hpMaxIncrease to each target', async () => {
    getRuntimeValue.mockImplementation((target, key) => {
      if (key === 'aidHpMaxIncrease') return 0;
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 20;
      if (key === 'activeBuffs') return [];
      return null;
    });

    const result = await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1', 'Ally2']);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('2 target(s)');
    expect(result.payload.description).toContain('+5 HP maximum');
  });

  it('should update currentHitPoints', async () => {
    getRuntimeValue.mockImplementation((target, key) => {
      if (key === 'aidHpMaxIncrease') return 0;
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 20;
      if (key === 'activeBuffs') return [];
      return null;
    });

    await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Ally1',
      'currentHitPoints',
      15,
      campaignName,
    );
  });

  it('should stack aid hpMaxIncrease', async () => {
    getRuntimeValue.mockImplementation((target, key) => {
      if (key === 'aidHpMaxIncrease') return 5;
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 25;
      if (key === 'activeBuffs') return [];
      return null;
    });

    await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Ally1',
      'aidHpMaxIncrease',
      10,
      campaignName,
    );
  });

  it('should not exceed baseHp + aidHpMaxIncrease for currentHitPoints', async () => {
    getRuntimeValue.mockImplementation((target, key) => {
      if (key === 'aidHpMaxIncrease') return 10;
      if (key === 'currentHitPoints') return 25;
      if (key === 'hitPoints') return 20;
      if (key === 'activeBuffs') return [];
      return null;
    });

    await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

    // baseHp (20) + newIncrease (15) = 35, but currentHp + hpIncrease = 25 + 5 = 30, so min is 30
    expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'currentHitPoints', 30, campaignName);
  });

  it('should add Aid buff to activeBuffs', async () => {
    getRuntimeValue.mockImplementation((target, key) => {
      if (key === 'aidHpMaxIncrease') return 0;
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 20;
      if (key === 'activeBuffs') return [];
      return null;
    });

    await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Ally1',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Aid',
          effect: 'aid_hp_increase',
        }),
      ]),
      campaignName,
    );
  });



  it('should add expiration', async () => {
    getRuntimeValue.mockImplementation((target, key) => {
      if (key === 'aidHpMaxIncrease') return 0;
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 20;
      if (key === 'activeBuffs') return [];
      return null;
    });

    await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

    expect(addExpiration).toHaveBeenCalledWith(
      'TestCleric',
      'Ally1',
      expect.arrayContaining([{ type: 'remove_aid_buff', buffName: 'Aid', hpKey: 'aidHpMaxIncrease' }]),
      campaignName,
    );
  });

  it('should call postLogEntry for each target', async () => {
    getRuntimeValue.mockImplementation((target, key) => {
      if (key === 'aidHpMaxIncrease') return 0;
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 20;
      if (key === 'activeBuffs') return [];
      return null;
    });

    await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1', 'Ally2']);

    expect(postLogEntry).toHaveBeenCalledTimes(2);
    expect(postLogEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'hp_change',
        targetName: 'Ally1',
        delta: 5,
        isHealing: true,
        sourceName: 'TestCleric',
      }),
    );
  });
});
