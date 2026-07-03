// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

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
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyAid } from './aidHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { postLogEntry } from '../../../shared/logPoster.js';

// ── Helpers ────────────────────────────────────────────────────

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

function makeCombatContext(creatures) {
  return { creatures };
}

// ── Tests ──────────────────────────────────────────────────────

describe('aidHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateAutoExpression.mockReturnValue(5);
  });

  // ── handle ──────────────────────────────────────────────────

  describe('handle', () => {
    it('returns automation_info popup when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
      expect(addExpiration).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns aid_target_selection popup with creature list', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([
          { name: 'TestCleric', type: 'player' },
          { name: 'Ally1', type: 'player' },
          { name: 'Ally2', type: 'monster' },
        ]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('aid_target_selection');
      expect(result.payload.creatureTargets).toEqual(['Ally1', 'Ally2']);
    });

    it('uses automation range when provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );

      const result = await handle(
        makeAction({ range: '90 feet' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe('90 feet');
      expect(result.payload.rangeFt).toBe(90);
    });

    it('uses spell range when automation range is not provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );

      const result = await handle(
        makeAction({}, { range: '60 feet' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe('60 feet');
      expect(result.payload.rangeFt).toBe(60);
    });

    it('defaults range to 30 feet when neither automation nor spell range is provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );

      const result = await handle(
        makeAction({}, {}),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe('30 feet');
      expect(result.payload.rangeFt).toBe(30);
    });

    it('defaults maxTargets to 3 when not in automation', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.maxTargets).toBe(3);
    });

    it('uses automation maxTargets when provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );

      const result = await handle(
        makeAction({ maxTargets: 5 }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.maxTargets).toBe(5);
    });

    it('includes attackerPos when mapName is provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );
      resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
    });

    it('includes duration from spell with default fallback', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );

      let result = await handle(
        makeAction({}, { duration: '1 hour' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.duration).toBe('1 hour');

      result = await handle(
        makeAction({}, {}),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.duration).toBe('8 hours');
    });

    it('uses spellSlotLevel for hpIncrease calculation', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );
      evaluateAutoExpression.mockReturnValue(7);

      const action = {
        name: 'Aid',
        automation: { type: 'aid' },
        spell: { level: 2 },
        spellSlotLevel: 4,
      };

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.payload.hpIncrease).toBe(7);
      expect(evaluateAutoExpression).toHaveBeenCalledWith(
        '5',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        4,
      );
    });

    it('uses spell level as fallback for hpIncrease when spellSlotLevel is not provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );
      evaluateAutoExpression.mockReturnValue(5);

      const action = {
        name: 'Aid',
        automation: { type: 'aid' },
        spell: { level: 3 },
      };

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.payload.hpIncrease).toBe(5);
      expect(evaluateAutoExpression).toHaveBeenCalledWith(
        '5',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        3,
      );
    });

    it('uses custom hpMaxIncreaseExpression from spell.automation when provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );
      evaluateAutoExpression.mockReturnValue(10);

      const action = {
        name: 'Aid',
        automation: { type: 'aid' },
        spell: { level: 2, automation: { hpMaxIncreaseExpression: '2d6+3' } },
      };

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.payload.hpIncrease).toBe(10);
      expect(evaluateAutoExpression).toHaveBeenCalledWith(
        '2d6+3',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        2,
      );
    });

    it('defaults hpIncrease to 5 when evaluateAutoExpression returns invalid or zero value', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );
      evaluateAutoExpression.mockReturnValue(-1);

      let result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.hpIncrease).toBe(5);

      evaluateAutoExpression.mockReturnValue(0);
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.hpIncrease).toBe(5);
    });
  });

  // ── applyAid ────────────────────────────────────────────────

  describe('applyAid', () => {
    it('returns null when targetNames is empty array', async () => {
      const result = await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        [],
      );

      expect(result).toBeNull();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('returns null when targetNames is null', async () => {
      const result = await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        null,
      );

      expect(result).toBeNull();
    });

    it('returns null when targetNames is not an array', async () => {
      const result = await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        'Ally1',
      );

      expect(result).toBeNull();
    });

    it('updates aidHpMaxIncrease for each target', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });

      const result = await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1', 'Ally2'],
      );

      const aidCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'aidHpMaxIncrease',
      );
      expect(aidCalls).toHaveLength(2);
      expect(aidCalls[0]).toEqual(['Ally1', 'aidHpMaxIncrease', 5, campaignName]);
      expect(aidCalls[1]).toEqual(['Ally2', 'aidHpMaxIncrease', 5, campaignName]);
      expect(result.payload.description).toContain('2 target(s)');
    });

    it('stacks aidHpMaxIncrease with existing value', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 10;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 30;
        if (key === 'activeBuffs') return [];
        return null;
      });

      await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1'],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'aidHpMaxIncrease',
        15,
        campaignName,
      );
    });

    it('updates currentHitPoints when storedCurrentHp is set', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });

      await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1'],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'currentHitPoints',
        15,
        campaignName,
      );
    });

    it('caps currentHitPoints at baseHp + newIncrease', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 18;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });

      await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1'],
      );

      // baseHp + newIncrease = 20 + 5 = 25, currentHp + hpIncrease = 18 + 5 = 23, min = 23
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'currentHitPoints',
        23,
        campaignName,
      );
    });

    it('skips currentHitPoints update when storedCurrentHp is null', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return null;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });

      await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1'],
      );

      const hpCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'currentHitPoints',
      );
      expect(hpCalls).toHaveLength(0);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'aidHpMaxIncrease',
        5,
        campaignName,
      );
    });

    it('adds Aid buff when not already present', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [{ name: 'Shield' }];
        return null;
      });

      await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1'],
      );

      const buffsCall = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
      );
      expect(buffsCall).toBeDefined();
      expect(buffsCall[2].length).toBe(2);
      expect(buffsCall[2].find((b) => b.name === 'Aid')).toBeDefined();
    });

    it('does not add duplicate Aid buff when already present', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [{ name: 'Aid' }];
        return null;
      });

      await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1'],
      );

      const buffsCall = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
      );
      expect(buffsCall).toBeUndefined();
    });

    it('includes sourceCharacter in Aid buff', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });

      await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1'],
      );

      const buffsCall = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
      );
      expect(buffsCall[2][0].sourceCharacter).toBe('TestCleric');
    });

    it('uses spell duration for Aid buff', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });

      const action = {
        name: 'Aid',
        automation: { type: 'aid' },
        spell: { level: 2, duration: '1 hour' },
      };

      await applyAid(action, makePlayerStats(), campaignName, mapName, ['Ally1']);

      const buffsCall = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
      );
      expect(buffsCall[2][0].duration).toBe('1 hour');
    });

    it('posts hp_change log entry for each target', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });

      await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1', 'Ally2'],
      );

      expect(postLogEntry).toHaveBeenCalledTimes(2);
      expect(postLogEntry).toHaveBeenNthCalledWith(1, campaignName, {
        type: 'hp_change',
        targetName: 'Ally1',
        delta: 5,
        isHealing: true,
        sourceName: 'TestCleric',
        note: 'Aid (+5 HP max)',
      });
      expect(postLogEntry).toHaveBeenNthCalledWith(2, campaignName, {
        type: 'hp_change',
        targetName: 'Ally2',
        delta: 5,
        isHealing: true,
        sourceName: 'TestCleric',
        note: 'Aid (+5 HP max)',
      });
    });

    it('returns correct popup description with target count and hpIncrease', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });

      const result = await applyAid(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
        ['Ally1', 'Ally2', 'Ally3'],
      );

      expect(result.payload.description).toContain('3 target(s)');
      expect(result.payload.description).toContain('+5 HP maximum');
    });

    it('uses spellSlotLevel for hpIncrease when provided', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });
      evaluateAutoExpression.mockReturnValue(7);

      const action = {
        name: 'Aid',
        automation: { type: 'aid' },
        spell: { level: 2 },
        spellSlotLevel: 3,
      };

      await applyAid(action, makePlayerStats(), campaignName, mapName, ['Ally1']);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'aidHpMaxIncrease',
        7,
        campaignName,
      );
    });

    it('uses custom hpMaxIncreaseExpression for applyAid', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });
      evaluateAutoExpression.mockReturnValue(12);

      const action = {
        name: 'Aid',
        automation: { type: 'aid', hpMaxIncreaseExpression: '2d6+3' },
        spell: { level: 2 },
      };

      await applyAid(action, makePlayerStats(), campaignName, mapName, ['Ally1']);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'aidHpMaxIncrease',
        12,
        campaignName,
      );
    });

    it('defaults slotLevel to 2 when neither spellSlotLevel nor spell.level is set', async () => {
      getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'aidHpMaxIncrease') return 0;
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 20;
        if (key === 'activeBuffs') return [];
        return null;
      });
      evaluateAutoExpression.mockReturnValue(5);

      const action = {
        name: 'Aid',
        automation: { type: 'aid' },
        spell: {},
      };

      await applyAid(action, makePlayerStats(), campaignName, mapName, ['Ally1']);

      expect(evaluateAutoExpression).toHaveBeenCalledWith(
        '5',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        2,
      );
    });
  });
});
