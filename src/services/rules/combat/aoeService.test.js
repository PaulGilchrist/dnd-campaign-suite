// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
  computeDamageAfterEvasion: vi.fn(),
  hasEvasionForSave: vi.fn(),
  normalizeSaveType: vi.fn(),
}));

vi.mock('../../combat/conditions/savePromptService.js', () => ({ sendSavePrompt: vi.fn() }));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: vi.fn() }
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
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
  applyDamageToTarget,
  computeDamageAfterEvasion,
  hasEvasionForSave,
  normalizeSaveType,
} from './applyDamage.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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
});

// ── Tests for processAoeNpcs ────────────────────────────────────

describe('processAoeNpcs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    hasEvasionForSave.mockReturnValue(false);
    normalizeSaveType.mockImplementation((t) => t);
  });

  it('returns empty array for no affected creatures', () => {
    const result = processAoeNpcs({ combatSummary: makeCombatSummary([]), affected: [], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });
    expect(result).toEqual([]);
  });

  it('skips player creatures in affected list', () => {
    const player = createPlayerCreature('Hero');
    const result = processAoeNpcs({ combatSummary: makeCombatSummary([player]), affected: [{ creature: player }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });
    expect(result).toEqual([]);
    expect(rollSaveForCreature).not.toHaveBeenCalled();
  });

  it('processes NPC with successful save and applies damage', () => {
    const npc = createNpcCreature('Orc');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 18, bonus: 3 });
    computeDamageAfterEvasion.mockReturnValue(3);
    applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 17, damageReduced: false });

    const result = processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });

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
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14, damageReduced: true });

    const result = processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'constitution', dcSuccess: 'half', campaignName: 'TestCampaign' });

    expect(result[0].saveSuccess).toBe(false);
    expect(result[0].finalDamage).toBe(6);
    expect(result[0].newHp).toBe(14);
  });

  it('applies half damage on success with dcSuccess "half", no damage with "none"', () => {
    let npc = createNpcCreature('Goblin');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 15, bonus: 2 });
    computeDamageAfterEvasion.mockReturnValue(4);
    applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 16 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 8, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign' });
    expect(computeDamageAfterEvasion).toHaveBeenCalledWith(8, true, 'half', false);

    npc = createNpcCreature('Goblin2');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 20, bonus: 5 });
    computeDamageAfterEvasion.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 20 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 10, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'none', campaignName: 'TestCampaign' });
    expect(computeDamageAfterEvasion).toHaveBeenCalledWith(10, true, 'none', false);
  });

  it('handles multiple NPCs independently with different outcomes', () => {
    const npc1 = createNpcCreature('Goblin 1');
    const npc2 = createNpcCreature('Goblin 2');

    rollSaveForCreature
      .mockReturnValueOnce({ success: true, roll: 15, bonus: 2 })
      .mockReturnValueOnce({ success: false, roll: 3, bonus: -1 });
    computeDamageAfterEvasion
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(8);
    applyDamageToTarget
      .mockReturnValueOnce({ finalDamage: 3, newHp: 17, damageReduced: true })
      .mockReturnValueOnce({ finalDamage: 8, newHp: 7 });

    const result = processAoeNpcs({ combatSummary: makeCombatSummary([npc1, npc2]), affected: [{ creature: npc1 }, { creature: npc2 }], rawDamage: 6, damageType: 'Cold', saveDc: 14, saveType: 'wisdom', dcSuccess: 'none', campaignName: 'TestCampaign' });

    expect(result).toHaveLength(2);
    expect(result[0].creatureName).toBe('Goblin 1');
    expect(result[0].saveSuccess).toBe(true);
    expect(result[1].creatureName).toBe('Goblin 2');
    expect(result[1].saveSuccess).toBe(false);
  });

  it('calls applyDamageToTarget with correct parameters', () => {
    const npc = createNpcCreature('Troll');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 7, bonus: 1 });
    computeDamageAfterEvasion.mockReturnValue(5);
    applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 15 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 5, damageType: 'Acid', saveDc: 13, saveType: 'strength', dcSuccess: 'half', campaignName: 'MyCampaign', attackerName: 'TestHero', characters: ['char1', 'char2'] });

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Troll', 5, ['Acid'], 'MyCampaign', ['char1', 'char2'], { ignoreResistance: false, attackerName: 'TestHero' });
  });

  it('uses finalDamage from applyDamageToTarget when it differs from computeDamageAfterEvasion', () => {
    const npc = createNpcCreature('Dragon');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 8, bonus: 2 });
    computeDamageAfterEvasion.mockReturnValue(5);
    applyDamageToTarget.mockReturnValue({ finalDamage: 2, newHp: 18 });

    const result = processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 10, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign' });

    expect(result[0].finalDamage).toBe(2);
  });

  it('falls back to computeDamageAfterEvasion when applyDamageToTarget returns null', () => {
    const npc = createNpcCreature('Golem');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 20, bonus: 5 });
    computeDamageAfterEvasion.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue(null);

    const result = processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 10, damageType: 'Bludgeoning', saveDc: 20, saveType: 'constitution', dcSuccess: 'half', campaignName: 'TestCampaign' });

    expect(result[0].finalDamage).toBe(0);
  });

  it('passes rollSaveForCreature correct creature and save params', () => {
    const npc = createNpcCreature('Orc');
    npc.saveBonuses = { dexterity: 3 };
    rollSaveForCreature.mockReturnValue({ success: false, roll: 10, bonus: 3 });
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });

    expect(rollSaveForCreature).toHaveBeenCalledWith(npc, 'dexterity', 15, false, false);
  });

  it('handles mixed NPC and player in affected list — only processes NPCs', () => {
    const npc = createNpcCreature('Goblin');
    const player = createPlayerCreature('Hero');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 8, bonus: 1 });
    computeDamageAfterEvasion.mockReturnValue(4);
    applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 16 });

    const result = processAoeNpcs({ combatSummary: makeCombatSummary([npc, player]), affected: [{ creature: npc }, { creature: player }], rawDamage: 4, damageType: 'Fire', saveDc: 12, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign' });

    expect(result).toHaveLength(1);
    expect(result[0].creatureName).toBe('Goblin');
  });

  it('marks creature as soulstitchProtected when getRuntimeValue returns matching array', () => {
    const npc = createNpcCreature('Ally');
    getRuntimeValue.mockReturnValue(['Ally']);

    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterEvasion.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 20 });

    const result = processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'Nemesis' });

    expect(result[0].soulstitchProtected).toBe(true);
    expect(result[0].saveSuccess).toBe(true);
    expect(result[0].finalDamage).toBe(0);
  });

  it('does not mark protected when target name is not in stored array', () => {
    const npc = createNpcCreature('Ally');
    getRuntimeValue.mockReturnValue(['OtherPerson']);

    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    const result = processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'Nemesis' });

    expect(result[0].soulstitchProtected).toBe(false);
  });

  it('applies disadvantage when target has disadvantage_on_next_save targetEffect', () => {
    const npc = createNpcCreature('Goblin');
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') {
        return [{ target: 'Goblin', effect: 'disadvantage_on_next_save' }];
      }
      return null;
    });
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });

    expect(rollSaveForCreature).toHaveBeenCalledWith(npc, 'dexterity', 15, true, false);
  });

  it('applies evasion when creature has matching evasionEffects', () => {
    const npc = createNpcCreature('Rogue');
    npc.evasionEffects = [{ saveType: 'DEX' }];
    hasEvasionForSave.mockReturnValue(true);
    rollSaveForCreature.mockReturnValue({ success: true, roll: 18, bonus: 3 });
    computeDamageAfterEvasion.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 20 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });

    expect(computeDamageAfterEvasion).toHaveBeenCalledWith(6, true, 'half', true);
    expect(hasEvasionForSave).toHaveBeenCalledWith([{ saveType: 'DEX' }], 'dexterity');
  });

  it('does not apply evasion when creature has no evasionEffects', () => {
    const npc = createNpcCreature('Goblin');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 15, bonus: 2 });
    computeDamageAfterEvasion.mockReturnValue(3);
    applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 17 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });

    expect(computeDamageAfterEvasion).toHaveBeenCalledWith(6, true, 'half', false);
  });

  it('does not apply evasion when save type does not match evasionEffects', () => {
    const npc = createNpcCreature('Rogue');
    npc.evasionEffects = [{ saveType: 'CON' }];
    rollSaveForCreature.mockReturnValue({ success: true, roll: 15, bonus: 2 });
    computeDamageAfterEvasion.mockReturnValue(3);
    applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 17 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });

    expect(computeDamageAfterEvasion).toHaveBeenCalledWith(6, true, 'half', false);
  });

  it('consumes disadvantage_on_next_save effect after applying', () => {
    const npc = createNpcCreature('Goblin');
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') {
        return [{ target: 'Goblin', effect: 'disadvantage_on_next_save' }];
      }
      return null;
    });
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    processAoeNpcs({ combatSummary: makeCombatSummary([npc]), affected: [{ creature: npc }], rawDamage: 6, damageType: 'Fire', saveDc: 15, saveType: 'dexterity', dcSuccess: 'half', campaignName: 'TestCampaign', attackerName: 'TestHero' });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign', 'targetEffects', [], 'TestCampaign'
    );
  });
});

// ── Tests for sendAoePlayerSaves ────────────────────────────────

describe('sendAoePlayerSaves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for no affected creatures', () => {
    const result = sendAoePlayerSaves({
      affected: [], rawDamage: 5, damageType: 'Fire', saveDc: 15, saveType: 'dexterity',
      dcSuccess: 'half', campaignName: 'TestCampaign', spellName: '', attackerName: '', formula: '',
    });
    expect(result).toEqual([]);
  });

  it('skips NPC creatures and returns empty array', () => {
    const npc = createNpcCreature('Goblin');
    const result = sendAoePlayerSaves({
      affected: [{ creature: npc }], rawDamage: 5, damageType: 'Fire', saveDc: 15, saveType: 'dexterity',
      dcSuccess: 'half', campaignName: 'TestCampaign', spellName: '', attackerName: '', formula: '',
    });
    expect(result).toEqual([]);
    expect(sendSavePrompt).not.toHaveBeenCalled();
  });

  it('sends save prompt and returns pending entry for each player', () => {
    const player = createPlayerCreature('Hero');
    utils.guid.mockReturnValue('guid-abc');

    const results = sendAoePlayerSaves({
      affected: [{ creature: player }], rawDamage: 8, damageType: 'Fire', saveDc: 15, saveType: 'dexterity',
      dcSuccess: 'half', campaignName: 'TestCampaign', spellName: 'Fireball', attackerName: 'Wizard', formula: '3d6',
    });

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
      disadvantage: false,
    });
  });

  it('returns pending list for all player creatures, calls sendSavePrompt once per player, generates unique prompt IDs', () => {
    const hero = createPlayerCreature('Hero');
    const ranger = createPlayerCreature('Ranger');
    utils.guid
      .mockReturnValueOnce('guid-1')
      .mockReturnValueOnce('guid-2');

    let results = sendAoePlayerSaves({
      affected: [{ creature: hero }, { creature: ranger }], rawDamage: 5, damageType: 'Fire', saveDc: 15, saveType: 'dexterity',
      dcSuccess: 'half', campaignName: 'TestCampaign', spellName: 'Fireball', attackerName: 'Wizard', formula: '4d6',
    });
    expect(results).toHaveLength(2);
    expect(results[0].targetName).toBe('Hero');
    expect(results[0].creature).toBe(hero);
    expect(results[1].targetName).toBe('Ranger');
    expect(results[1].creature).toBe(ranger);

    sendSavePrompt.mockClear();
    sendAoePlayerSaves({
      affected: [
        { creature: createPlayerCreature('Hero') },
        { creature: createPlayerCreature('Ranger') },
        { creature: createPlayerCreature('Cleric') },
      ], rawDamage: 10, damageType: 'Thunder', saveDc: 15, saveType: 'strength',
      dcSuccess: 'none', campaignName: 'MyCampaign', spellName: 'Thunderstorm', attackerName: 'Druid', formula: '8d6',
    });
    expect(sendSavePrompt).toHaveBeenCalledTimes(3);

    utils.guid.mockClear();
    utils.guid
      .mockReturnValueOnce('id-a')
      .mockReturnValueOnce('id-b');

    results = sendAoePlayerSaves({
      affected: [
        { creature: createPlayerCreature('Player1') },
        { creature: createPlayerCreature('Player2') },
      ], rawDamage: 5, damageType: 'Fire', saveDc: 10, saveType: 'dexterity',
      dcSuccess: 'half', campaignName: 'TestCampaign', spellName: 'Burning Hands', attackerName: 'Wizard', formula: '4d6',
    });
    expect(results[0].promptId).toBe('id-a');
    expect(results[1].promptId).toBe('id-b');
    expect(utils.guid).toHaveBeenCalledTimes(2);
  });

  it('handles mixed players and NPCs — only sends prompts for players', () => {
    const results = sendAoePlayerSaves({
      affected: [
        { creature: createNpcCreature('Goblin') },
        { creature: createPlayerCreature('Hero') },
        { creature: createNpcCreature('Orc') },
      ], rawDamage: 5, damageType: 'Fire', saveDc: 12, saveType: 'dexterity',
      dcSuccess: 'half', campaignName: 'TestCampaign', spellName: 'Burning Hands', attackerName: null, formula: '',
    });

    expect(results).toHaveLength(1);
    expect(sendSavePrompt).toHaveBeenCalledTimes(1);
  });

  it('passes all params correctly to sendSavePrompt', () => {
    utils.guid.mockReturnValue('guid-target');

    sendAoePlayerSaves({
      affected: [{ creature: createPlayerCreature('Target') }], rawDamage: 7, damageType: 'Radiant', saveDc: 16, saveType: 'wisdom',
      dcSuccess: 'half', campaignName: 'CampaignX', spellName: 'Guiding Bolt', attackerName: 'Cleric', formula: '4d8',
    });

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
      disadvantage: false,
    });
  });

  it('includes disadvantage in prompt when target has disadvantage_on_next_save', () => {
    utils.guid.mockReturnValue('guid-rider');
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') {
        return [{ target: 'Hero', effect: 'disadvantage_on_next_save' }];
      }
      return null;
    });

    sendAoePlayerSaves({
      affected: [{ creature: createPlayerCreature('Hero') }], rawDamage: 8, damageType: 'Fire', saveDc: 15, saveType: 'dexterity',
      dcSuccess: 'half', campaignName: 'TestCampaign', spellName: 'Fireball', attackerName: 'Wizard', formula: '8d6',
    });

    expect(sendSavePrompt).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'Hero',
      disadvantage: true,
    }));
  });
});
