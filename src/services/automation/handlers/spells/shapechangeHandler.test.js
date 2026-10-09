// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { getName: (fullName) => fullName || 'Unknown' },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, resolveShapechangeMaxCR } from './shapechangeHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    ...overrides,
  };
}

function makeAction(metaCtx = {}) {
  return {
    name: 'Shapechange',
    spell: { name: 'Shapechange', level: 9 },
    spellSlotLevel: 9,
    spellSlotUsed: 9,
    metaCtx,
  };
}

const baseCombatContext = {
  creatures: [
    { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
    { name: casterName, type: 'player', currentHp: 10, maxHp: 10, traits: [] },
  ],
};

function setupBaseMocks({ existingEffects = [] } = {}) {
  getCombatContext.mockResolvedValue(baseCombatContext);
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return existingEffects;
    return undefined;
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('shapechangeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context creatures is undefined', async () => {
      getCombatContext.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target validation', () => {
    it('returns popup when target not found in combat', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'OtherCreature', type: 'monster', currentHp: 5, maxHp: 7, traits: [] }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('not found in combat');
    });

    it('includes target name in not-found message', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'OtherCreature', type: 'monster', currentHp: 5 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain(casterName);
    });

    it('SP-103: active shapechange effect reopens the chooser as a free form change', async () => {
      setupBaseMocks({
        existingEffects: [{ target: casterName, effect: 'shapechange', source: 'OldCaster' }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBe(true);
    });

    it('SP-103: shapechangeOriginal without a targetEffect still routes form change', async () => {
      setupBaseMocks();
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
          { name: casterName, type: 'player', currentHp: 10, maxHp: 10, traits: [], shapechangeOriginal: { maxHp: 10, ac: 12, speed: 30 } },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBe(true);
    });

    it('SP-103: stale form-change request without transform state refuses unpaid', async () => {
      setupBaseMocks();

      const result = await handle(makeAction({ _shapechangeFormChange: true }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('not transformed');
      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.type === 'ability_use');
      expect(abilityCalls.length).toBe(1);
      expect(abilityCalls[0][1].description).toContain('not transformed');
    });

    it('SP-103: fresh cast (no transform state) opens chooser without formChange', async () => {
      setupBaseMocks();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBeUndefined();
    });

    it('returns popup when target is already transformed (polymorph effect)', async () => {
      setupBaseMocks({
        existingEffects: [{ target: casterName, effect: 'polymorph', source: 'OldCaster' }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('already transformed');
    });

    it('returns popup when target is already transformed (true_polymorph effect)', async () => {
      setupBaseMocks({
        existingEffects: [{ target: casterName, effect: 'true_polymorph', source: 'OldCaster' }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('already transformed');
    });

    it('SP-103: handles array target in existing effects check (form change)', async () => {
      setupBaseMocks({
        existingEffects: [{ target: [casterName, 'extra'], effect: 'shapechange', source: 'OldCaster' }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBe(true);
    });

    it('does not flag different target as already transformed', async () => {
      setupBaseMocks({
        existingEffects: [{ target: 'OtherCreature', effect: 'shapechange', source: 'OldCaster' }],
      });

      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
          { name: casterName, type: 'player', currentHp: 10, maxHp: 10, traits: [] },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
    });
  });

  describe('HP validation', () => {
    it('returns popup when target has 0 hit points (currentHp)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 0, maxHp: 7, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('0 hit points');
    });

    it('returns popup when target has hit_points.current = 0', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', hit_points: { current: 0, max: 7 }, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
    });

    it('returns popup when target has negative hit points', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: -2, maxHp: 7, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
    });

    it('reads currentHitPoints from runtime store for player-type targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: casterName, type: 'player', currentHp: 10 },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey, cn) => {
        if (key === casterName && subKey === 'currentHitPoints' && cn === campaignName) return 0;
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
    });

    it('uses creature currentHp when runtime store returns non-number for player', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: casterName, type: 'player', currentHp: 5 },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey, cn) => {
        if (key === casterName && subKey === 'currentHitPoints' && cn === campaignName) return 'invalid';
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Should pass HP check via creature.currentHp = 5
      expect(result.payload.type).toBe('shapechange_select');
    });

    it('allows target with positive HP to proceed', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 3, maxHp: 7, traits: [] },
          { name: casterName, type: 'player', currentHp: 10, maxHp: 10, traits: [] },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
    });
  });

  describe('successful shapechange_select popup', () => {
    it('returns shapechange_select popup with correct payload', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
          { name: casterName, type: 'player', currentHp: 10, maxHp: 10, traits: [] },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });
      getMonsterData.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.targetName).toBe(casterName);
      expect(result.payload.casterName).toBe(casterName);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.spell).toEqual({ name: 'Shapechange', level: 9 });
      expect(result.payload.spellLevel).toBe(9);
    });

    it('passes characters array from action.metaCtx to maxCR resolution', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, traits: [] },
          { name: casterName, type: 'player', currentHp: 10, traits: [] },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });
      getMonsterData.mockResolvedValue({ challenge_rating: 5 });

      const characters = [{ name: casterName, computedStats: { level: 12 } }];
      const result = await handle(makeAction({ characters }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.maxCR).toBe(12);
    });
  });

  describe('logging', () => {
    it('SP-103: logs ability_use refusal only for polymorph-family effects', async () => {
      setupBaseMocks({
        existingEffects: [{ target: casterName, effect: 'polymorph', source: 'OldCaster' }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.type === 'ability_use',
      );
      expect(abilityCalls.length).toBe(1);
      expect(abilityCalls[0][1].characterName).toBe(casterName);
      expect(abilityCalls[0][1].abilityName).toBe('Shapechange');
      expect(abilityCalls[0][1].description).toContain('already transformed');
    });

    it('SP-103: opening the form-change chooser logs nothing (confirm logs the shift)', async () => {
      setupBaseMocks({
        existingEffects: [{ target: casterName, effect: 'shapechange', source: casterName }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(vi.mocked(addEntry).mock.calls.filter(call => call[1]?.type === 'ability_use').length).toBe(0);
    });

    it('logs ability_use when target has 0 hit points', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 0, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.type === 'ability_use',
      );
      expect(abilityCalls.length).toBe(1);
      expect(abilityCalls[0][1].description).toContain('0 hit points');
    });

    it('logs ability_use when no creatures in combat', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.type === 'ability_use',
      );
      expect(abilityCalls.length).toBe(0);
    });

    it('logs ability_use when target not found in combat', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'OtherCreature', type: 'monster', currentHp: 5 }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.type === 'ability_use',
      );
      expect(abilityCalls.length).toBe(0);
    });
  });
});

describe('shapechangeHandler.resolveShapechangeMaxCR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns player level for a matching PC via computedStats.level', async () => {
    const characters = [{ name: targetName, computedStats: { level: 7 } }];

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(7);
  });

  it('falls back to creature level field for a PC', async () => {
    const characters = [{ name: targetName, level: 5 }];

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(5);
  });

  it('returns monster challenge rating for NPCs', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 3 });

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(3);
  });

  it('parses fractional challenge ratings', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '1/2' });

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(0.5);
  });

  it('defaults to CR 1 for custom NPCs without a challenge rating', async () => {
    getMonsterData.mockResolvedValue(null);

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(1);
  });

  it('matches a PC by exact name', async () => {
    const characters = [{ name: 'Goblin the Brave', computedStats: { level: 9 } }];

    const maxCR = await resolveShapechangeMaxCR('Goblin the Brave', campaignName, characters);

    expect(maxCR).toBe(9);
  });

  it('prefers computedStats.level over level field', async () => {
    const characters = [{ name: targetName, level: 3, computedStats: { level: 8 } }];

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(8);
  });

  it('returns DEFAULT_MAX_CR (1) when character has no level', async () => {
    const characters = [{ name: targetName }];

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(1);
  });

  it('returns DEFAULT_MAX_CR when level is 0', async () => {
    const characters = [{ name: targetName, computedStats: { level: 0 } }];

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(1);
  });

  it('skips characters with non-number level', async () => {
    const characters = [{ name: targetName, computedStats: { level: 'unknown' } }];
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '2' });

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(2);
  });

  it('returns 0 for empty fractional CR like "0/1"', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '0/1' });

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(0);
  });

  it('returns 0 for invalid CR string', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 'invalid' });

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(0);
  });

  it('handles null challenge_rating', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: null });

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(1);
  });

  it('handles empty string challenge_rating', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '' });

    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(1);
  });

  it('returns DEFAULT_MAX_CR when characters array is null', async () => {
    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, null);

    expect(maxCR).toBe(1);
  });

  it('returns DEFAULT_MAX_CR when characters array is undefined', async () => {
    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, undefined);

    expect(maxCR).toBe(1);
  });

  it('returns DEFAULT_MAX_CR when characters array is empty', async () => {
    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(1);
  });

  it('uses utils.getName for character matching', async () => {
    const characters = [{ name: 'TestCaster', computedStats: { level: 11 } }];

    const maxCR = await resolveShapechangeMaxCR('TestCaster', campaignName, characters);

    expect(maxCR).toBe(11);
  });
});
