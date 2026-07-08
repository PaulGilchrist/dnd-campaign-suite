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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyAid } from './aidHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { addEntry } from '../../../ui/logService.js';

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

    it('resolves range from automation, spell, or default 30 feet', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );

      let result = await handle(
        makeAction({ range: '90 feet' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.range).toBe('90 feet');
      expect(result.payload.rangeFt).toBe(90);

      result = await handle(
        makeAction({}, { range: '60 feet' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.range).toBe('60 feet');
      expect(result.payload.rangeFt).toBe(60);

      result = await handle(
        makeAction({}, {}),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.range).toBe('30 feet');
      expect(result.payload.rangeFt).toBe(30);
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

    it('computes hpIncrease from custom expression, slot level, spell level, or default 5', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Ally', type: 'player' }]),
      );

      // custom expression
      evaluateAutoExpression.mockReturnValue(10);
      let result = await handle(
        {
          name: 'Aid',
          automation: { type: 'aid' },
          spell: { level: 2, automation: { hpMaxIncreaseExpression: '2d6+3' } },
        },
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.hpIncrease).toBe(10);
      expect(evaluateAutoExpression).toHaveBeenCalledWith(
        '2d6+3',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        2,
      );

      // spellSlotLevel priority
      evaluateAutoExpression.mockReturnValue(7);
      result = await handle(
        {
          name: 'Aid',
          automation: { type: 'aid' },
          spell: { level: 2 },
          spellSlotLevel: 4,
        },
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.hpIncrease).toBe(7);
      expect(evaluateAutoExpression).toHaveBeenCalledWith(
        '5',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        4,
      );

      // spell level fallback
      evaluateAutoExpression.mockReturnValue(5);
      result = await handle(
        {
          name: 'Aid',
          automation: { type: 'aid' },
          spell: { level: 3 },
        },
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.hpIncrease).toBe(5);
      expect(evaluateAutoExpression).toHaveBeenCalledWith(
        '5',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        3,
      );

      // invalid/zero falls back to 5
      evaluateAutoExpression.mockReturnValue(-1);
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.hpIncrease).toBe(5);

      evaluateAutoExpression.mockReturnValue(0);
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.hpIncrease).toBe(5);
    });
  });

  // ── applyAid ────────────────────────────────────────────────

  describe('applyAid', () => {
    it('returns null and performs no side effects when targetNames is empty', async () => {
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

    it('updates aidHpMaxIncrease and currentHitPoints for each target', async () => {
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

      const hpCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'currentHitPoints',
      );
      expect(hpCalls).toHaveLength(2);
      expect(hpCalls[0]).toEqual(['Ally1', 'currentHitPoints', 15, campaignName]);
      expect(hpCalls[1]).toEqual(['Ally2', 'currentHitPoints', 15, campaignName]);
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

    it('adds Aid buff with correct properties when not already present', async () => {
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
      const aidBuff = buffsCall[2].find((b) => b.name === 'Aid');
      expect(aidBuff).toBeDefined();
      expect(aidBuff.sourceCharacter).toBe('TestCleric');
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

    it('uses custom spell duration for Aid buff', async () => {
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

      expect(addEntry).toHaveBeenCalledTimes(2);
      expect(addEntry).toHaveBeenNthCalledWith(1, campaignName, {
        type: 'hp_change',
        targetName: 'Ally1',
        delta: 5,
        isHealing: true,
        sourceName: 'TestCleric',
        note: 'Aid (+5 HP max)',
      });
      expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, {
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
  });
});
