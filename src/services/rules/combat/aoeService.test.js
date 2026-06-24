// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

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

vi.mock('../../ui/utils.js', () => ({
  default: { guid: vi.fn() }
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

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
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, gridX, gridY) {
  return { name, type: 'npc', currentHp: 20, maxHp: 20, conditions: [], gridX, gridY };
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
    expect(getAffectedCreatures(null, [], [], makeCombatSummary([]))).toEqual([]);
  });

  it('returns empty array when combatSummary is missing creatures', () => {
    expect(getAffectedCreatures({ shape: 'sphere' }, [], [], {})).toEqual([]);
  });

  it('returns empty array when no creatures match overlay', () => {
    hitTestOverlay.mockReturnValue(false);
    const cs = makeCombatSummary([createNpcCreature('Goblin')]);
    const result = getAffectedCreatures(
      { shape: 'sphere' },
      [{ name: 'Goblin', gridX: 5, gridY: 5 }],
      [],
      cs
    );
    expect(result).toEqual([]);
  });

  it('returns creatures hit by overlay from players list', () => {
    hitTestOverlay.mockReturnValue(true);
    const player = createPlayerCreature('Alchemist');
    const cs = makeCombatSummary([player]);
    const result = getAffectedCreatures(
      { shape: 'sphere' },
      [{ name: 'Alchemist', gridX: 3, gridY: 4 }],
      [],
      cs
    );
    expect(result).toEqual([
      { creature: player, gridX: 3, gridY: 4 },
    ]);
  });

  it('returns creatures hit by overlay from placedItems list', () => {
    hitTestOverlay.mockReturnValue(true);
    const npc = createNpcCreature('Orc');
    const cs = makeCombatSummary([npc]);
    const result = getAffectedCreatures(
      { shape: 'cube' },
      [],
      [{ type: 'npc', name: 'Orc', gridX: 7, gridY: 8 }],
      cs
    );
    expect(result).toEqual([
      { creature: npc, gridX: 7, gridY: 8 },
    ]);
  });

  it('skips placedItems that are not type npc', () => {
    const cs = makeCombatSummary([createNpcCreature('Goblin')]);
    const result = getAffectedCreatures(
      {},
      [],
      [{ type: 'wall', gridX: 3, gridY: 4 }],
      cs
    );
    expect(result).toEqual([]);
    expect(hitTestOverlay).not.toHaveBeenCalled();
  });

  it('handles empty players and placedItems arrays', () => {
    const result = getAffectedCreatures({ shape: 'cone' }, [], [], makeCombatSummary([]));
    expect(result).toEqual([]);
  });

  it('handles null players and placedItems', () => {
    const result = getAffectedCreatures({ shape: 'line' }, null, null, makeCombatSummary([]));
    expect(result).toEqual([]);
  });

  it('matches creatures by name across players and placedItems position maps', () => {
    hitTestOverlay.mockImplementation((_overlay, x, y) => x === 3 && y === 4);

    const player = createPlayerCreature('Hero');
    const cs = makeCombatSummary([player]);

    const result = getAffectedCreatures(
      { shape: 'sphere' },
      [{ name: 'Hero', gridX: 3, gridY: 4 }],
      [{ type: 'npc', name: 'Goblin', gridX: 7, gridY: 8 }],
      cs
    );

    expect(result).toEqual([
      { creature: player, gridX: 3, gridY: 4 },
    ]);
  });

  it('skips creatures whose name is not in any position map', () => {
    const npc = createNpcCreature('Hidden Enemy');
    const cs = makeCombatSummary([npc]);
    const result = getAffectedCreatures({}, [], [], cs);
    expect(result).toEqual([]);
    expect(hitTestOverlay).not.toHaveBeenCalled();
  });

  it('skips placedItems without a name', () => {
    const cs = makeCombatSummary([createNpcCreature('Goblin')]);
    const result = getAffectedCreatures(
      {},
      [],
      [{ type: 'npc', gridX: 5, gridY: 5 }],
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
      [],
      cs
    );
    expect(result).toHaveLength(2);
    expect(result[0].creature).toBe(hero);
    expect(result[1].creature).toBe(ranger);
  });

  it('does not call hitTestOverlay when overlay or creatures are absent', () => {
    getAffectedCreatures(null, [], [], makeCombatSummary([]));
    expect(hitTestOverlay).not.toHaveBeenCalled();

    getAffectedCreatures({ shape: 'sphere' }, [], [], {});
    expect(hitTestOverlay).not.toHaveBeenCalled();
  });
});

// ── Tests for processAoeNpcs ────────────────────────────────────

describe('processAoeNpcs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns empty array for no affected creatures', () => {
    const result = processAoeNpcs(
      makeCombatSummary([]), [], 6, 'Fire', 15, 'dexterity', 'half',
      'TestCampaign', 'TestHero'
    );
    expect(result).toEqual([]);
  });

  it('skips player creatures in affected list', () => {
    const player = createPlayerCreature('Hero');
    const result = processAoeNpcs(
      makeCombatSummary([player]), [{ creature: player }],
      6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'TestHero'
    );
    expect(result).toEqual([]);
    expect(rollSaveForCreature).not.toHaveBeenCalled();
  });

  it('processes NPC with successful save and applies damage', () => {
    const npc = createNpcCreature('Orc');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 18, bonus: 3 });
    computeDamageAfterSave.mockReturnValue(3);
    applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 17, damageReduced: false });

    const result = processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'TestHero'
    );

    expect(result).toEqual([
      {
        creatureName: 'Orc',
        saveSuccess: true,
        saveRoll: 18,
        saveBonus: 3,
        finalDamage: 3,
        newHp: 17,
        damageReduced: false,
        soulstitchProtected: false,
      },
    ]);
  });

  it('processes NPC with failed save taking full damage', () => {
    const npc = createNpcCreature('Goblin');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterSave.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14, damageReduced: true });

    const result = processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      6, 'Fire', 15, 'constitution', 'half', 'TestCampaign'
    );

    expect(result[0].saveSuccess).toBe(false);
    expect(result[0].finalDamage).toBe(6);
    expect(result[0].newHp).toBe(14);
  });

  it('applies half damage on successful save when dcSuccess is half', () => {
    const npc = createNpcCreature('Goblin');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 15, bonus: 2 });
    computeDamageAfterSave.mockReturnValue(4);
    applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 16 });

    processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      8, 'Fire', 15, 'dexterity', 'half', 'TestCampaign'
    );

    expect(computeDamageAfterSave).toHaveBeenCalledWith(8, true, 'half');
  });

  it('applies no damage on successful save when dcSuccess is none', () => {
    const npc = createNpcCreature('Goblin');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 20, bonus: 5 });
    computeDamageAfterSave.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 20 });

    processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      10, 'Fire', 15, 'dexterity', 'none', 'TestCampaign'
    );

    expect(computeDamageAfterSave).toHaveBeenCalledWith(10, true, 'none');
  });

  it('handles multiple NPCs independently with different outcomes', () => {
    const npc1 = createNpcCreature('Goblin 1');
    const npc2 = createNpcCreature('Goblin 2');

    rollSaveForCreature
      .mockReturnValueOnce({ success: true, roll: 15, bonus: 2 })
      .mockReturnValueOnce({ success: false, roll: 3, bonus: -1 });
    computeDamageAfterSave
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(8);
    applyDamageToTarget
      .mockReturnValueOnce({ finalDamage: 3, newHp: 17, damageReduced: true })
      .mockReturnValueOnce({ finalDamage: 8, newHp: 7 });

    const result = processAoeNpcs(
      makeCombatSummary([npc1, npc2]), [{ creature: npc1 }, { creature: npc2 }],
      6, 'Cold', 14, 'wisdom', 'none', 'TestCampaign'
    );

    expect(result).toHaveLength(2);
    expect(result[0].creatureName).toBe('Goblin 1');
    expect(result[0].saveSuccess).toBe(true);
    expect(result[1].creatureName).toBe('Goblin 2');
    expect(result[1].saveSuccess).toBe(false);
  });

  it('calls applyDamageToTarget with correct parameters', () => {
    const npc = createNpcCreature('Troll');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 7, bonus: 1 });
    computeDamageAfterSave.mockReturnValue(5);
    applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 15 });

    processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      5, 'Acid', 13, 'strength', 'half', 'MyCampaign', 'TestHero', ['char1', 'char2']
    );

    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object), 'Troll', 5, ['Acid'], 'MyCampaign', ['char1', 'char2'], false, 'TestHero'
    );
  });

  it('uses finalDamage from applyDamageToTarget when it differs from computeDamageAfterSave', () => {
    const npc = createNpcCreature('Dragon');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 8, bonus: 2 });
    computeDamageAfterSave.mockReturnValue(5);
    applyDamageToTarget.mockReturnValue({ finalDamage: 2, newHp: 18 });

    const result = processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      10, 'Fire', 15, 'dexterity', 'half', 'TestCampaign'
    );

    expect(result[0].finalDamage).toBe(2);
  });

  it('falls back to computeDamageAfterSave when applyDamageToTarget returns null', () => {
    const npc = createNpcCreature('Golem');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 20, bonus: 5 });
    computeDamageAfterSave.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue(null);

    const result = processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      10, 'Bludgeoning', 20, 'constitution', 'half', 'TestCampaign'
    );

    expect(result[0].finalDamage).toBe(0);
  });

  it('passes rollSaveForCreature correct creature and save params', () => {
    const npc = createNpcCreature('Orc');
    npc.saveBonuses = { dexterity: 3 };
    rollSaveForCreature.mockReturnValue({ success: false, roll: 10, bonus: 3 });
    computeDamageAfterSave.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'TestHero'
    );

    expect(rollSaveForCreature).toHaveBeenCalledWith(npc, 'dexterity', 15);
  });

  it('handles mixed NPC and player in affected list — only processes NPCs', () => {
    const npc = createNpcCreature('Goblin');
    const player = createPlayerCreature('Hero');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 8, bonus: 1 });
    computeDamageAfterSave.mockReturnValue(4);
    applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 16 });

    const result = processAoeNpcs(
      makeCombatSummary([npc, player]), [{ creature: npc }, { creature: player }],
      4, 'Fire', 12, 'dexterity', 'half', 'TestCampaign'
    );

    expect(result).toHaveLength(1);
    expect(result[0].creatureName).toBe('Goblin');
  });

  it('marks creature as soulstitchProtected when getRuntimeValue returns matching array', () => {
    const npc = createNpcCreature('Ally');
    getRuntimeValue.mockReturnValue(['Ally']);

    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterSave.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 20 });

    const result = processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'Nemesis'
    );

    expect(result[0].soulstitchProtected).toBe(true);
    expect(result[0].saveSuccess).toBe(true);
    expect(result[0].finalDamage).toBe(0);
  });

  it('does not mark protected when getRuntimeValue returns non-array', () => {
    const npc = createNpcCreature('Ally');
    getRuntimeValue.mockReturnValue('not-an-array');

    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterSave.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    const result = processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'Nemesis'
    );

    expect(result[0].soulstitchProtected).toBe(false);
    expect(result[0].saveSuccess).toBe(false);
  });

  it('does not mark protected when target name is not in stored array', () => {
    const npc = createNpcCreature('Ally');
    getRuntimeValue.mockReturnValue(['OtherPerson']);

    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterSave.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    const result = processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', 'Nemesis'
    );

    expect(result[0].soulstitchProtected).toBe(false);
  });

  it('skips protection check when attackerName is undefined', () => {
    const npc = createNpcCreature('Ally');
    getRuntimeValue.mockReturnValue(['Ally']);

    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterSave.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    const result = processAoeNpcs(
      makeCombatSummary([npc]), [{ creature: npc }],
      6, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', undefined
    );

    expect(result[0].soulstitchProtected).toBe(false);
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });
});

// ── Tests for sendAoePlayerSaves ────────────────────────────────

describe('sendAoePlayerSaves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for no affected creatures', () => {
    const result = sendAoePlayerSaves(
      [], 5, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', '', '', [], ''
    );
    expect(result).toEqual([]);
  });

  it('skips NPC creatures and returns empty array', () => {
    const npc = createNpcCreature('Goblin');
    const result = sendAoePlayerSaves(
      [{ creature: npc }], 5, 'Fire', 15, 'dexterity', 'half', 'TestCampaign', '', '', [], ''
    );
    expect(result).toEqual([]);
    expect(sendSavePrompt).not.toHaveBeenCalled();
  });

  it('sends save prompt and returns pending entry for each player', () => {
    const player = createPlayerCreature('Hero');
    utils.guid.mockReturnValue('guid-abc');

    const results = sendAoePlayerSaves(
      [{ creature: player }], 8, 'Fire', 15, 'dexterity', 'half',
      'TestCampaign', 'Fireball', 'Wizard', [], '3d6'
    );

    expect(results).toHaveLength(1);
    expect(results[0].targetName).toBe('Hero');
    expect(results[0].creature).toBe(player);
    expect(results[0].promptId).toBe('guid-abc');

    expect(sendSavePrompt).toHaveBeenCalledWith('TestCampaign', {
      promptId: 'guid-abc',
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
  });

  it('returns pending list for all player creatures', () => {
    const hero = createPlayerCreature('Hero');
    const ranger = createPlayerCreature('Ranger');
    utils.guid
      .mockReturnValueOnce('guid-1')
      .mockReturnValueOnce('guid-2');

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

  it('calls sendSavePrompt once per player creature', () => {
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

  it('generates a unique prompt ID per player via utils.guid', () => {
    utils.guid
      .mockReturnValueOnce('id-a')
      .mockReturnValueOnce('id-b');

    const results = sendAoePlayerSaves(
      [
        { creature: createPlayerCreature('Player1') },
        { creature: createPlayerCreature('Player2') },
      ], 5, 'Fire', 10, 'dexterity', 'half',
      'TestCampaign', 'Burning Hands', 'Wizard', [], '4d6'
    );

    expect(results[0].promptId).toBe('id-a');
    expect(results[1].promptId).toBe('id-b');
    expect(utils.guid).toHaveBeenCalledTimes(2);
  });

  it('handles mixed players and NPCs — only sends prompts for players', () => {
    const results = sendAoePlayerSaves(
      [
        { creature: createNpcCreature('Goblin') },
        { creature: createPlayerCreature('Hero') },
        { creature: createNpcCreature('Orc') },
      ], 5, 'Fire', 12, 'dexterity', 'half',
      'TestCampaign', 'Burning Hands', null, [], ''
    );

    expect(results).toHaveLength(1);
    expect(sendSavePrompt).toHaveBeenCalledTimes(1);
  });

  it('passes all params correctly to sendSavePrompt', () => {
    utils.guid.mockReturnValue('guid-target');

    sendAoePlayerSaves(
      [{ creature: createPlayerCreature('Target') }], 7, 'Radiant', 16, 'wisdom', 'half',
      'CampaignX', 'Guiding Bolt', 'Cleric', [4, 3, 5], '4d8'
    );

    expect(sendSavePrompt).toHaveBeenCalledWith('CampaignX', {
      promptId: 'guid-target',
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

  it('passes empty strings through when spellName and attackerName are absent', () => {
    utils.guid.mockReturnValue('guid-empty');

    sendAoePlayerSaves(
      [{ creature: createPlayerCreature('Hero') }], 5, '', 10, 'strength', 'none',
      'TestCampaign', '', '', [], ''
    );

    expect(sendSavePrompt).toHaveBeenCalledWith('TestCampaign', {
      promptId: 'guid-empty',
      targetName: 'Hero',
      saveType: 'strength',
      saveDc: 10,
      dcSuccess: 'none',
      damageFormula: '',
      damageType: '',
      sourceName: '',
      sourceAttackerName: '',
      rawDamage: 5,
    });
  });
});
