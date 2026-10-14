import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { clearDataCache } from '../ui/dataLoader.js';

function createMockResponse(json) {
  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('generateLootFromCombatSummary', () => {
  let getRuntimeValue;

  beforeEach(() => {
    clearDataCache();
    global.fetch = vi.fn().mockResolvedValue(createMockResponse([]));
    getRuntimeValue = vi.fn().mockReturnValue(null);
    vi.doMock('../../hooks/runtime/useRuntimeState.js', () => ({
      getRuntimeValue,
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // ── Early return / null handling ─────────────────────────────────

  it('returns empty result for null/missing combatSummary or creatures', async () => {
    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');
    expect(await generateLootFromCombatSummary(null, [], 'TestCampaign')).toEqual({ lootEntries: [], totalEncounterXp: 0 });
    expect(await generateLootFromCombatSummary({ creatures: null }, [], 'TestCampaign')).toEqual({ lootEntries: [], totalEncounterXp: 0 });
    expect(await generateLootFromCombatSummary({}, [], 'TestCampaign')).toEqual({ lootEntries: [], totalEncounterXp: 0 });
  });

  // ── Summoned creature filtering — player summons excluded ────────

  it('excludes NPC creatures summoned by a character in the character list', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
      { index: 'orc', name: 'Orc', xp: 200, challenge_rating: 1 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [{ target: 'Goblin 1', source: 'Druid', effect: 'summoned' }];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [
        { name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' },
        { name: 'Orc 1', type: 'npc', monsterIndex: 'orc' },
      ],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(200);
  });

  it('excludes multiple creatures summoned by the same player', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
      { index: 'wolf', name: 'Wolf', xp: 50, challenge_rating: 0.25 },
      { index: 'owlbear', name: 'Owlbear', xp: 300, challenge_rating: 3 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [
          { target: 'Goblin 1', source: 'Druid', effect: 'summoned' },
          { target: 'Wolf 1', source: 'Druid', effect: 'summoned' },
        ];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [
        { name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' },
        { name: 'Wolf 1', type: 'npc', monsterIndex: 'wolf' },
        { name: 'Owlbear 1', type: 'npc', monsterIndex: 'owlbear' },
      ],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(300);
  });

  // ── Summoned creature filtering — GM summons included ────────────

  it('includes NPC creatures summoned by GM regardless of character list', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [{ target: 'Goblin 1', source: 'GM', effect: 'summoned' }];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [{ name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' }],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(50);
  });

  it('includes NPC summoned by an unknown source (not in character list)', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [{ target: 'Goblin 1', source: 'Wizard', effect: 'summoned' }];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [{ name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' }],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(50);
  });

  it('includes NPC without summoned effect', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
    ]));

    getRuntimeValue.mockReturnValue(null);

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [{ name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' }],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(50);
  });

  // ── Non-NPC creatures bypass summoned check ──────────────────────

  it('includes non-NPC creatures (elemental) even when marked summoned by a player', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'fire_elemental', name: 'Fire Elemental', xp: 100, challenge_rating: 2 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [{ target: 'Fire Elemental', source: 'Druid', effect: 'summoned' }];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [{ name: 'Fire Elemental', type: 'elemental', monsterIndex: 'fire_elemental' }],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(100);
  });

  // ── Creatures without monsterIndex ───────────────────────────────

  it('excludes XP from creatures without monsterIndex even when summoned', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [{ target: 'Custom Creature', source: 'Druid', effect: 'summoned' }];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [{ name: 'Custom Creature', type: 'npc' }],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }, ], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(0);
  });

  it('includes custom creatures (no monsterIndex) regardless of summoned status', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [{ target: 'Dragon', source: 'Druid', effect: 'summoned' }];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [
        { name: 'Dragon', type: 'npc' },
        { name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' },
      ],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(50);
  });

  // ── Characters parameter edge cases ──────────────────────────────

  it('handles empty or undefined characters array', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
    ]));

    getRuntimeValue.mockReturnValue(null);

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [{ name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' }],
    };

    expect((await generateLootFromCombatSummary(combatSummary, [], 'TestCampaign')).totalEncounterXp).toBe(50);
    expect((await generateLootFromCombatSummary(combatSummary, undefined, 'TestCampaign')).totalEncounterXp).toBe(50);
  });

  // ── Aggregation ──────────────────────────────────────────────────

  it('aggregates XP across multiple creatures of the same type', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
    ]));

    getRuntimeValue.mockReturnValue(null);

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [
        { name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' },
        { name: 'Goblin 2', type: 'npc', monsterIndex: 'goblin' },
        { name: 'Goblin 3', type: 'npc', monsterIndex: 'goblin' },
      ],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(150);
  });

  it('aggregates XP across multiple creature types', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
      { index: 'orc', name: 'Orc', xp: 200, challenge_rating: 1 },
    ]));

    getRuntimeValue.mockReturnValue(null);

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [
        { name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' },
        { name: 'Goblin 2', type: 'npc', monsterIndex: 'goblin' },
        { name: 'Orc 1', type: 'npc', monsterIndex: 'orc' },
        { name: 'Orc 2', type: 'npc', monsterIndex: 'orc' },
        { name: 'Orc 3', type: 'npc', monsterIndex: 'orc' },
      ],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(700);
  });

  // ── Missing monster data ─────────────────────────────────────────

  it('handles missing monster data gracefully (no match in monster registry)', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([]));

    getRuntimeValue.mockReturnValue(null);

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [{ name: 'Unknown', type: 'npc', monsterIndex: 'nonexistent' }],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(0);
  });

  // ── Mixed filtering scenarios ────────────────────────────────────

  it('filters some creatures and includes others in the same combat', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
      { index: 'orc', name: 'Orc', xp: 200, challenge_rating: 1 },
      { index: 'treant', name: 'Treant', xp: 400, challenge_rating: 5 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [
          { target: 'Goblin 1', source: 'Druid', effect: 'summoned' },
          { target: 'Orc 1', source: 'GM', effect: 'summoned' },
        ];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [
        { name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' },
        { name: 'Orc 1', type: 'npc', monsterIndex: 'orc' },
        { name: 'Treant 1', type: 'npc', monsterIndex: 'treant' },
      ],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(600);
  });

  // ── targetEffects edge cases ─────────────────────────────────────

  it('ignores targetEffects entries with non-summoned effects', async () => {
    global.fetch.mockResolvedValueOnce(createMockResponse([
      { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
    ]));

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'targetEffects') {
        return [
          { target: 'Goblin 1', source: 'Druid', effect: 'slowed' },
          { target: 'Goblin 1', source: 'Cleric', effect: 'blessed' },
        ];
      }
      return null;
    });

    const { generateLootFromCombatSummary } = await import('./lootGenerator.js');

    const combatSummary = {
      creatures: [{ name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin' }],
    };

    const result = await generateLootFromCombatSummary(combatSummary, [{ name: 'Druid' }], 'TestCampaign');
    expect(result.totalEncounterXp).toBe(50);
  });
});
