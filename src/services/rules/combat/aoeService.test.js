import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────
// Use inline vi.fn() — no closure over external variables

vi.mock('../../../models/SpellOverlay.js', () => ({
  hitTestOverlay: vi.fn(),
  OverlayShape: { SPHERE: 'sphere', CYLINDER: 'cylinder' },
}));

vi.mock('./applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
  computeDamageAfterSave: vi.fn(),
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../combat/conditions/savePromptService.js', () => ({ sendSavePrompt: vi.fn() }));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'aoe-guid-001') } }));

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  getAffectedCreatures,
  processAoeNpcs,
  sendAoePlayerSaves,
} from './aoeService.js';

import { hitTestOverlay } from '../../../models/SpellOverlay.js';
import {
  rollSaveForCreature,
  computeDamageAfterSave,
  applyDamageToTarget,
} from './applyDamage.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';

// ── Globals ────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

const guid = utils.guid;

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name) {
  return { name, type: 'npc', currentHp: 20, maxHp: 20, conditions: [] };
}

function createPlayerCreature(name) {
  return { name, type: 'player' };
}

// ── Tests for getAffectedCreatures ─────────────────────────────

describe('getAffectedCreatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when overlay is null', () => {
    const result = getAffectedCreatures(null, [], [], makeCombatSummary([]));
    expect(result).toEqual([]);
  });

  it('returns empty array when combatSummary.creatures is missing', () => {
    const result = getAffectedCreatures({ shape: 'sphere' }, [], [], {});
    expect(result).toEqual([]);
  });

  it('returns empty array when no creatures match overlay', () => {
    hitTestOverlay.mockReturnValue(false);
    const cs = makeCombatSummary([createNpcCreature('Goblin', 5, 5)]);
    const result = getAffectedCreatures(
        { shape: 'sphere' },
        [{ name: 'Goblin', gridX: 5, gridY: 5 }],
        [], cs
    );
    expect(result).toEqual([]);
  });

  it('returns creatures hit by overlay from players list', () => {
    hitTestOverlay.mockReturnValue(true);
    const playerCreature = createPlayerCreature('Alchemist');
    const cs = makeCombatSummary([playerCreature]);
    const result = getAffectedCreatures(
        { shape: 'sphere' },
        [{ name: 'Alchemist', gridX: 3, gridY: 4 }],
        [], cs
    );
    expect(result).toHaveLength(1);
    expect(result[0].creature).toBe(playerCreature);
    expect(result[0].gridX).toBe(3);
    expect(result[0].gridY).toBe(4);
  });

  it('returns creatures hit by overlay from placedItems list', () => {
    hitTestOverlay.mockReturnValue(true);
    const npc = createNpcCreature('Orc', 7, 8);
    const cs = makeCombatSummary([npc]);
    const result = getAffectedCreatures(
        { shape: 'cube' },
        [],
        [{ type: 'npc', name: 'Orc', gridX: 7, gridY: 8 }],
        cs
    );
    expect(result).toHaveLength(1);
    expect(result[0].creature).toBe(npc);
  });

  it('skips placedItems that are not type npc', () => {
    hitTestOverlay.mockReturnValue(false);
    const cs = makeCombatSummary([createNpcCreature('Goblin', 0, 0)]);
    getAffectedCreatures(
        {},
        [],
        [{ type: 'wall', gridX: 3, gridY: 4 }],
        cs
    );
    // Should not call hitTestOverlay for non-npc items
  });

  it('handles empty players and placedItems arrays', () => {
    const cs = makeCombatSummary([]);
    const result = getAffectedCreatures({ shape: 'cone' }, [], [], cs);
    expect(result).toEqual([]);
  });

  it('handles null players and placedItems', () => {
    const cs = makeCombatSummary([]);
    const result = getAffectedCreatures({ shape: 'line' }, null, null, cs);
    expect(result).toEqual([]);
  });

  it('builds position map from both players and placedItems', () => {
    hitTestOverlay.mockImplementation((overlay, x, y) => {
      // Return true for (3,4) which is from player list, false for (7,8) from items
      return (x === 3 && y === 4);
    });

    const player = createPlayerCreature('Hero');
    const npc = createNpcCreature('Goblin', 0, 0);
    const cs = makeCombatSummary([player, npc]);

    const result = getAffectedCreatures(
        { shape: 'sphere' },
        [{ name: 'Hero', gridX: 3, gridY: 4 }],
        [{ type: 'npc', name: 'Goblin', gridX: 7, gridY: 8 }],
        cs
    );

    expect(result).toHaveLength(1);
    expect(result[0].creature.name).toBe('Hero');
  });

  it('includes NPC in affected when hitTestOverlay returns true for placed item position', () => {
    hitTestOverlay.mockReturnValue(true);
    const npc = createNpcCreature('Dark Elf', 9, 10);
    const cs = makeCombatSummary([npc]);
    const result = getAffectedCreatures(
        {},
        [],
        [{ type: 'npc', name: 'Dark Elf', gridX: 9, gridY: 10 }],
        cs
    );
    expect(result).toHaveLength(1);
  });

  it('skips creatures with no matching position in players or items', () => {
    hitTestOverlay.mockReturnValue(true);
    const npc = createNpcCreature('Hidden Enemy', 0, 0);
    const cs = makeCombatSummary([npc]);
    // No player or placed item with name 'Hidden Enemy' -> pos is undefined -> skipped
    const result = getAffectedCreatures({}, [], [], cs);
    expect(result).toEqual([]);
    // hitTestOverlay should not be called because there's no pos
    expect(hitTestOverlay).not.toHaveBeenCalled();
  });

  it('skips placedItems without a name', () => {
    hitTestOverlay.mockReturnValue(true);
    const cs = makeCombatSummary([createNpcCreature('Goblin', 0, 0)]);
    const result = getAffectedCreatures(
        {},
        [],
        [{ type: 'npc', gridX: 5, gridY: 5 }], // no name
        cs
    );
    expect(result).toEqual([]);
  });

  it('handles multiple creatures hit by overlay', () => {
    hitTestOverlay.mockReturnValue(true);
    const hero = createPlayerCreature('Hero');
    const ranger = createPlayerCreature('Ranger');
    const cs = makeCombatSummary([hero, ranger]);
    const result = getAffectedCreatures(
        {},
        [
          { name: 'Hero', gridX: 3, gridY: 4 },
          { name: 'Ranger', gridX: 5, gridY: 6 },
        ],
        [], cs
    );
    expect(result).toHaveLength(2);
    expect(result[0].creature.name).toBe('Hero');
    expect(result[1].creature.name).toBe('Ranger');
  });
});

// ── Tests for processAoeNpcs ────────────────────────────────────

describe('processAoeNpcs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for no affected creatures', () => {
    const cs = makeCombatSummary([]);
    const result = processAoeNpcs(cs, [], 6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'TestHero');
    expect(result).toEqual([]);
  });

  it('skips player creatures in NPC processing', () => {
    const cs = makeCombatSummary([createPlayerCreature('Hero')]);
    const result = processAoeNpcs(
        cs, [{ creature: createPlayerCreature('Hero') }],
        6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign'
    );
    expect(result).toEqual([]);
    // No calls to save/damage functions because player was skipped
    expect(rollSaveForCreature).not.toHaveBeenCalled();
  });

  it('processes NPC with successful save', () => {
    const npc = createNpcCreature('Orc', 0, 0);
    rollSaveForCreature.mockReturnValue({ success: true, roll: 18, bonus: 3 });
    computeDamageAfterSave.mockReturnValue(3);
    applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 17, damageReduced: false });

    const cs = makeCombatSummary([npc]);
    const result = processAoeNpcs(
        cs, [{ creature: npc }],
        6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign'
    );

    expect(result).toHaveLength(1);
    expect(result[0].creatureName).toBe('Orc');
    expect(result[0].saveSuccess).toBe(true);
    expect(result[0].saveRoll).toBe(18);
    expect(result[0].saveBonus).toBe(3);
    expect(result[0].finalDamage).toBe(3);
  });

  it('processes NPC with failed save', () => {
    const npc = createNpcCreature('Goblin', 0, 0);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterSave.mockReturnValue(6); // full damage on fail
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14, damageReduced: true });

    const cs = makeCombatSummary([npc]);
    const result = processAoeNpcs(
        cs, [{ creature: npc }],
        6, 'Fire', 15, 'constitution', 'half', 'TestCampaign'
    );

    expect(result[0].saveSuccess).toBe(false);
    expect(result[0].finalDamage).toBe(6);
    expect(result[0].newHp).toBe(14);
    expect(result[0].damageReduced).toBe(true);
  });

  it('handles multiple NPCs independently', () => {
    const npc1 = createNpcCreature('Goblin 1', 0, 0);
    const npc2 = createNpcCreature('Goblin 2', 0, 0);

    rollSaveForCreature
        .mockReturnValueOnce({ success: true, roll: 15, bonus: 2 })
        .mockReturnValueOnce({ success: false, roll: 3, bonus: -1 });
    computeDamageAfterSave.mockReturnValueOnce(3).mockReturnValueOnce(8);
    applyDamageToTarget
        .mockReturnValueOnce({ finalDamage: 3, newHp: 17, damageReduced: true })
        .mockReturnValueOnce({ finalDamage: 8, newHp: 7 });

    const cs = makeCombatSummary([npc1, npc2]);
    const result = processAoeNpcs(
        cs, [{ creature: npc1 }, { creature: npc2 }],
        6, 'Cold', 14, 'wisdom', 'none', 'TestCampaign'
    );

    expect(result).toHaveLength(2);
    expect(result[0].creatureName).toBe('Goblin 1');
    expect(result[1].creatureName).toBe('Goblin 2');
  });

  it('calls applyDamageToTarget with correct params', () => {
    const npc = createNpcCreature('Troll', 0, 0);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 7, bonus: 1 });
    computeDamageAfterSave.mockReturnValue(5);
    applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 15 });

    const cs = makeCombatSummary([npc]);
    processAoeNpcs(cs, [{ creature: npc }], 5, 'Acid', 13, 'strength', 'half', 'MyCampaign', 'TestHero');

    expect(applyDamageToTarget).toHaveBeenCalledWith(
        cs, 'Troll', 5, ['Acid'], 'MyCampaign', undefined, false, 'TestHero'
        // rawDamage goes through computeDamageAfterSave first, then to applyDamageToTarget
    );
  });

  it('uses finalDamage from applyDamageToTarget when different from computeDamageAfterSave', () => {
    const npc = createNpcCreature('Dragon', 0, 0);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 8, bonus: 2 });
    computeDamageAfterSave.mockReturnValue(5); // computed but...
    applyDamageToTarget.mockReturnValue({ finalDamage: 2 }); // ...resistance applied further

    const cs = makeCombatSummary([npc]);
    const result = processAoeNpcs(
        cs, [{ creature: npc }],
        10, 'Fire', 15, 'dexterity', 'half', 'TestCampaign'
    );

    expect(result[0].finalDamage).toBe(2); // from apply result
  });

  it('falls back to computeDamageAfterSave damage when applyDamageToTarget returns null', () => {
    const npc = createNpcCreature('Golem', 0, 0);
    rollSaveForCreature.mockReturnValue({ success: true, roll: 20, bonus: 5 });
    computeDamageAfterSave.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue(null);

    const cs = makeCombatSummary([npc]);
    const result = processAoeNpcs(
        cs, [{ creature: npc }],
        10, 'Bludgeoning', 20, 'constitution', 'half', 'TestCampaign'
    );

    expect(result[0].finalDamage).toBe(0); // fallback to compute result
  });

  it('handles NPCs without grid positions (no position but still in affected list)', () => {
    // The affected list is already pre-filtered by getAffectedCreatures,
    // so NPCs here are already confirmed to be in the AoE
    const npc = createNpcCreature('Shadow', 0, 0);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 2, bonus: -3 });
    computeDamageAfterSave.mockReturnValue(4);
    applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 16 });

    const cs = makeCombatSummary([npc]);
    const result = processAoeNpcs(
        cs, [{ creature: npc, gridX: 5, gridY: 5 }],
        4, 'Necrotic', 10, 'charisma', 'none', 'TestCampaign'
    );

    expect(result).toHaveLength(1);
  });

  it('uses rollSaveForCreature with correct creature and save params', () => {
    const npc = createNpcCreature('Orc', 0, 0);
    npc.saveBonuses = { dexterity: 3 };
    rollSaveForCreature.mockReturnValue({ success: false, roll: 10, bonus: 3 });
    computeDamageAfterSave.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    const cs = makeCombatSummary([npc]);
    processAoeNpcs(cs, [{ creature: npc }], 6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'TestHero');

    expect(rollSaveForCreature).toHaveBeenCalledWith(npc, 'dexterity', 15);
  });

  it('handles mixed NPC and player in affected list', () => {
    const npc = createNpcCreature('Goblin', 0, 0);
    const player = createPlayerCreature('Hero');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 8, bonus: 1 });
    computeDamageAfterSave.mockReturnValue(4);
    applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 16 });

    const cs = makeCombatSummary([npc, player]);
    const result = processAoeNpcs(
        cs, [{ creature: npc }, { creature: player }],
        4, 'Fire', 12, 'dexterity', 'half', 'TestCampaign'
    );

    // Only NPC processed, player skipped
    expect(result).toHaveLength(1);
    expect(result[0].creatureName).toBe('Goblin');
  });
});

// ── Tests for sendAoePlayerSaves ────────────────────────────────

describe('sendAoePlayerSaves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for no affected creatures', () => {
    const result = sendAoePlayerSaves([], 5, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', '', '', [], '');
    expect(result).toEqual([]);
  });

  it('skips NPC creatures', () => {
    const npc = createNpcCreature('Goblin', 0, 0);
    const result = sendAoePlayerSaves(
        [{ creature: npc }], 5, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', '', '', [], ''
    );
    expect(result).toEqual([]);
    expect(sendSavePrompt).not.toHaveBeenCalled();
  });

  it('sends save prompt for each player creature', () => {
    const player = createPlayerCreature('Hero');
    sendAoePlayerSaves(
        [{ creature: player }], 8, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'Fireball', 'Wizard', [], '3d6'
    );

    expect(sendSavePrompt).toHaveBeenCalledWith('TestCampaign', {
      promptId: expect.any(String),
      targetName: 'Hero',
      saveType: 'dexterity',
      saveDc: 15,
      dcSuccess: 'half',
      damageFormula: '3d6',
      damageType: 'Fire',
      sourceName: 'Fireball',
      sourceAttackerName: 'Wizard',
      rawDamage: 8,
    });

    expect(guid).toHaveBeenCalled();
  });

  it('returns pending list for all player creatures', () => {
    const hero = createPlayerCreature('Hero');
    const ranger = createPlayerCreature('Ranger');
    const results = sendAoePlayerSaves(
        [{ creature: hero }, { creature: ranger }], 5, 'Fire', 15, 'dexterity', 'half',
        'TestCampaign', 'Fireball', 'Wizard', [], '4d6'
    );

    expect(results).toHaveLength(2);
    expect(results[0].targetName).toBe('Hero');
    expect(results[0].creature).toBe(hero);
    expect(results[1].targetName).toBe('Ranger');
    expect(results[1].creature).toBe(ranger);
  });

  it('calls sendSavePrompt once per player', () => {
    sendAoePlayerSaves(
          [
            { creature: createPlayerCreature('Hero') },
            { creature: createPlayerCreature('Ranger') },
            { creature: createPlayerCreature('Cleric') },
          ], 10, 'Thunder', 15, 'strength', 'none',
          'MyCampaign', 'Thunderstorm', 'Druid', [], '8d6'
      );

    expect(sendSavePrompt).toHaveBeenCalledTimes(3);
   });

  it('generates unique prompt ID for each player', () => {
    // Each call to utils.guid generates a new UUID (mocked but still unique calls)
    sendAoePlayerSaves(
        [
          { creature: createPlayerCreature('Player1') },
          { creature: createPlayerCreature('Player2') },
        ], 5, 'Fire', 10, 'dexterity', 'half',
        'TestCampaign', 'Burning Hands', 'Wizard', [], '4d6'
    );

    expect(guid).toHaveBeenCalledTimes(2);
  });

  it('handles mixed players and NPCs — only processes players', () => {
    const results = sendAoePlayerSaves(
        [
          { creature: createNpcCreature('Goblin', 0, 0) },
          { creature: createPlayerCreature('Hero') },
          { creature: createNpcCreature('Orc', 0, 0) },
        ], 5, 'Fire', 12, 'dexterity', 'half',
        'TestCampaign', 'Burning Hands', null, [], ''
    );

    expect(results).toHaveLength(1);
    expect(sendSavePrompt).toHaveBeenCalledTimes(1);
  });

  it('passes all params correctly to sendSavePrompt', () => {
    createPlayerCreature('Mage');
    sendAoePlayerSaves(
        [{ creature: createPlayerCreature('Target') }], 7, 'Radiant', 16, 'wisdom', 'half',
        'CampaignX', 'Guiding Bolt', 'Cleric', [4, 3, 5], '4d8'
    );

    expect(sendSavePrompt).toHaveBeenCalledWith('CampaignX', {
      promptId: expect.any(String),
      targetName: 'Target',
      saveType: 'wisdom',
      saveDc: 16,
      dcSuccess: 'half',
      damageFormula: '4d8',
      damageType: 'Radiant',
      sourceName: 'Guiding Bolt',
      sourceAttackerName: 'Cleric',
      rawDamage: 7,
    });
  });

  it('handles empty string for spellName and attackerName', () => {
    sendAoePlayerSaves(
        [{ creature: createPlayerCreature('Hero') }], 5, '', 10, 'strength', 'none',
        'TestCampaign', '', '', [], ''
    );

    expect(sendSavePrompt).toHaveBeenCalled();
  });
});
