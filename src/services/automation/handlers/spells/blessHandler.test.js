import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn((r) => {
    if (typeof r === 'number') return r;
    if (!r || typeof r !== 'string') return null;
    const m = String(r).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handle } from './blessHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Bless',
    automation: { type: 'bless', ...overrides.automation },
    spell: overrides.spell || {},
    spellSlotLevel: overrides.spellSlotLevel || undefined,
    ...overrides,
  };
}

function makeCombatContext(creatures) {
  return { creatures };
}

describe('blessHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── handle: no combat context ──────────────────────────────

  describe('handle - no combat context', () => {
    it('returns automation_info popup when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Bless');
      expect(result.payload.description).toContain('No combat context found');
      expect(result.payload.description).toContain('Bless');
    });

    it('returns automation_info popup when combat context is undefined', async () => {
      getCombatContext.mockResolvedValue(undefined);

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
    });
  });

  // ── handle: target selection popup ─────────────────────────

  describe('handle - target selection', () => {
    it('returns bless_target_selection popup with creature list', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster' },
          { name: 'Dragon', type: 'monster' },
        ]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('bless_target_selection');
      expect(result.payload.name).toBe('Bless');
      expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc', 'Dragon']);
    });

    it('includes all payload fields in target selection', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload).toHaveProperty('type', 'bless_target_selection');
      expect(result.payload).toHaveProperty('name', 'Bless');
      expect(result.payload).toHaveProperty('creatureTargets');
      expect(result.payload).toHaveProperty('range');
      expect(result.payload).toHaveProperty('rangeFt');
      expect(result.payload).toHaveProperty('maxTargets');
      expect(result.payload).toHaveProperty('slotLevel');
      expect(result.payload).toHaveProperty('attackerPos');
      expect(result.payload).toHaveProperty('automation');
    });

    it('defaults range to 30 feet when not specified', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction({ spell: {} }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe('30 feet');
      expect(result.payload.rangeFt).toBe(30);
    });

    it('uses automation range when provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction({ automation: { range: '60 feet' } }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe('60 feet');
      expect(result.payload.rangeFt).toBe(60);
    });

    it('uses spell.range when provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction({ spell: { range: '45 feet' } }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe('45 feet');
      expect(result.payload.rangeFt).toBe(45);
    });

    it('uses spellSlotLevel when provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction({ spellSlotLevel: 3 }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.slotLevel).toBe(3);
      expect(result.payload.maxTargets).toBe(5);
    });

    it('uses spell.level when spellSlotLevel is not provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction({ spell: { level: 4 } }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.slotLevel).toBe(4);
      expect(result.payload.maxTargets).toBe(6);
    });

    it('defaults slotLevel to 1 when neither spellSlotLevel nor spell.level provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.slotLevel).toBe(1);
      expect(result.payload.maxTargets).toBe(3);
    });

    it('computes maxTargets as max(3, 3 + (slotLevel - 1)) matching spell rules', async () => {
      // slotLevel 1 → max(3, 3) = 3 (up to three creatures base)
      let result = await handle(
        makeAction({ spellSlotLevel: 1 }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.maxTargets).toBe(3);

      // slotLevel 2 → max(3, 4) = 4 (one additional creature for each slot above 1st)
      result = await handle(
        makeAction({ spellSlotLevel: 2 }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.maxTargets).toBe(4);

      // slotLevel 5 → max(3, 7) = 7
      result = await handle(
        makeAction({ spellSlotLevel: 5 }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.maxTargets).toBe(7);

      // slotLevel 9 → max(3, 11) = 11
      result = await handle(
        makeAction({ spellSlotLevel: 9 }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result.payload.maxTargets).toBe(11);
    });

    it('includes attackerPos when mapName is provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
    });

    it('sets attackerPos to null when no mapName provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.attackerPos).toBeNull();
    });

    it('sets attackerPos to null when mapName provided but resolveMapPositions returns no position', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );
      resolveMapPositions.mockResolvedValue({ attackerPos: null });

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.attackerPos).toBeNull();
    });

    it('passes automation object in payload', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const auto = { type: 'bless', saveType: 'CHA', saveDc: 15 };
      const result = await handle(
        makeAction({ automation: auto }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.automation).toEqual(auto);
    });

    it('handles empty creature list in combat context', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('bless_target_selection');
      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  // ── rangeToFeet integration ────────────────────────────────

  describe('rangeToFeet integration', () => {
    it('parses "30 feet" to 30', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction({ spell: { range: '30 feet' } }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(rangeToFeet).toHaveBeenCalledWith('30 feet');
      expect(result.payload.rangeFt).toBe(30);
    });

    it('parses "60 feet" to 60', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction({ spell: { range: '60 feet' } }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.rangeFt).toBe(60);
    });

    it('handles numeric range input', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction({ spell: { range: 90 } }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.rangeFt).toBe(90);
    });
  });

  // ── resolveMapPositions integration ────────────────────────

  describe('resolveMapPositions integration', () => {
    it('calls resolveMapPositions with correct args when mapName is provided', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(resolveMapPositions).toHaveBeenCalledWith(
        campaignName,
        mapName,
        'TestCaster',
      );
    });

    it('does not call resolveMapPositions when mapName is null', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(resolveMapPositions).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles action with no automation object', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        { name: 'Bless' },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('bless_target_selection');
      expect(result.payload.automation).toEqual({});
    });

    it('handles action with no spell object', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        { name: 'Bless', automation: { type: 'bless' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.slotLevel).toBe(1);
      expect(result.payload.range).toBe('30 feet');
    });

    it('handles creature names with special characters', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([
          { name: "Goblin's Ally" },
          { name: 'Orc#2' },
          { name: 'Dragon (Young)' },
        ]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.creatureTargets).toEqual([
        "Goblin's Ally",
        'Orc#2',
        'Dragon (Young)',
      ]);
    });

    it('throws when playerStats is undefined (requires playerStats.name)', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      await expect(
        handle(makeAction(), undefined, campaignName, mapName),
      ).rejects.toThrow();
    });

    it('handles undefined campaignName gracefully', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatContext([{ name: 'Goblin' }]),
      );

      const result = await handle(
        makeAction(),
        makePlayerStats(),
        undefined,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('bless_target_selection');
    });
  });
});
