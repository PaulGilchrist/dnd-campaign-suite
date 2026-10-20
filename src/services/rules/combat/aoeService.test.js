// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── aoeService lane: area-target orchestration only ─────────────────
// Cite table (owners consulted, not re-driven here):
//   shape geometry / exact-cell hits .... SpellOverlay.test.js (hitTestOverlay mocked)
//   save prompt internals ............... conditionSaveService CANON #1005
//   corona util scoping (dmg-type/elist)  coronaAuraUtils.test.js sync-lane describe
//   post-save damage arithmetic ......... applyDamage.helpers.test.js #1182
//   evasion save-type matching .......... evasionUtils.test.js (hasEvasionForSave mocked)
//   ability-scoped te predicate ......... targetEffectDefinitions (real code runs here)
// This file's faces: merged players+placedItems selection output, per-NPC
// roll→compute→apply wiring with full-output goldens (#1160), te rider apply
// vs consume byte-distinct legs (#903), soulstitch zero-damage, prompt payload
// + guid allocation, degenerate honest refusals (#945), heightenTarget legs.
// Old->new map: getAffectedCreatures 8→2; processAoeNpcs 15→9 (happy golden +
// fail/precedence/null folded; dcSuccess+evasion folded; multi+mixed folded;
// soulstitch 2→1; rider apply+consume 2→1; corona negs dropped→util owner);
// sendAoePlayerSaves 8→5 (param dupes folded into full-output golden).

// ── Mocks BEFORE imports ────────────────────────────────────────────

vi.mock('../../../models/SpellOverlay.js', () => ({
  hitTestOverlay: vi.fn(),
}));

vi.mock('./applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
  computeDamageAfterEvasion: vi.fn(),
  applyDamageToTarget: vi.fn(),
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
  getStore: vi.fn(),
}));

// Corona sync lane runs REAL (getCoronaSaveDisadvantageSync); its participant
// fallback hits this combat-summary cache — kept cold by default for legacy pins.
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  getCombatContext: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────────

import {
  getAffectedCreatures,
  processAoeNpcs,
  sendAoePlayerSaves,
} from './aoeService.js';

import { hitTestOverlay } from '../../../models/SpellOverlay.js';
import {
  rollSaveForCreature,
  computeDamageAfterEvasion,
  applyDamageToTarget,
  hasEvasionForSave,
  normalizeSaveType,
} from './applyDamage.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getRuntimeValue, setRuntimeValue, getStore } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, gridX = 1, gridY = 1) {
  return { name, type: 'npc', currentHp: 20, maxHp: 20, conditions: [], gridX, gridY };
}

function createPlayerCreature(name) {
  return { name, type: 'player' };
}

// Standard processAoeNpcs args — one fixture, per-test overrides.
function npcArgs(creature, overrides = {}) {
  return {
    combatSummary: makeCombatSummary([creature]),
    affected: [{ creature }],
    rawDamage: 6,
    damageType: 'Fire',
    saveDc: 15,
    saveType: 'dexterity',
    dcSuccess: 'half',
    campaignName: 'TestCampaign',
    attackerName: 'TestHero',
    characters: [],
    ...overrides,
  };
}

// Standard sendAoePlayerSaves args.
const PLAYER_SAVE_ARGS = {
  rawDamage: 8,
  damageType: 'Fire',
  saveDc: 15,
  saveType: 'dexterity',
  dcSuccess: 'half',
  campaignName: 'TestCampaign',
  spellName: 'Fireball',
  attackerName: 'Wizard',
  formula: '3d6',
};

// Determinism re-arm (#1057): every test starts from a cold store, neutral
// modifiers, identity save normalization — no sticky cross-test leakage.
beforeEach(() => {
  vi.resetAllMocks();
  normalizeSaveType.mockImplementation((t) => t);
  getRuntimeValue.mockReturnValue(null);
  getCombatSummary.mockReturnValue(null);
  getStore.mockReturnValue({ keys: () => [] });
  hasEvasionForSave.mockReturnValue(false);
});

// ── getAffectedCreatures ────────────────────────────────────────────

describe('getAffectedCreatures', () => {
  it('returns [] when overlay or combat-summary creatures are missing', () => {
    expect(getAffectedCreatures(null, [], [], makeCombatSummary([]))).toEqual([]);
    expect(getAffectedCreatures({ shape: 'sphere' }, [], [], {})).toEqual([]);
  });

  it('selects combatants from the merged players + placedItems position maps — exact output, untracked/non-npc/unnamed never consulted', () => {
    const hero = createPlayerCreature('Hero');
    const ranger = createPlayerCreature('Ranger');
    const goblin = createNpcCreature('Goblin', 7, 8);
    const overlay = { shape: 'sphere' };
    hitTestOverlay.mockImplementation((_o, x, y) => (x === 3 && y === 4) || (x === 7 && y === 8));

    const result = getAffectedCreatures(
      overlay,
      [
        { name: 'Hero', gridX: 3, gridY: 4 },
        { name: 'Ranger', gridX: 5, gridY: 6 },
      ],
      [
        { type: 'npc', name: 'Goblin', gridX: 7, gridY: 8 },
        { type: 'wall', name: 'Wall', gridX: 9, gridY: 9 },
        { type: 'npc', gridX: 1, gridY: 1 },
      ],
      makeCombatSummary([hero, ranger, goblin, createNpcCreature('Ghost')])
    );

    // Hero + Goblin hit; Ranger misses on its own cell; Ghost (no position),
    // Wall (non-npc) and the unnamed npc item never reach the hit-test.
    expect(result).toEqual([
      { creature: hero, gridX: 3, gridY: 4 },
      { creature: goblin, gridX: 7, gridY: 8 },
    ]);
    expect(hitTestOverlay.mock.calls).toEqual([
      [overlay, 3, 4],
      [overlay, 5, 6],
      [overlay, 7, 8],
    ]);
  });
});

// ── processAoeNpcs ──────────────────────────────────────────────────

describe('processAoeNpcs', () => {
  it('returns [] when affected is empty or players-only, rolling nothing', () => {
    const player = createPlayerCreature('Hero');
    expect(processAoeNpcs(npcArgs(player, { affected: [], combatSummary: makeCombatSummary([]) }))).toEqual([]);
    expect(processAoeNpcs(npcArgs(player))).toEqual([]);
    expect(rollSaveForCreature).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('happy-path NPC: full output tuple, exact roll/compute/apply wiring, cold modifiers', () => {
    const npc = createNpcCreature('Orc');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 18, bonus: 3 });
    computeDamageAfterEvasion.mockReturnValue(3);
    applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 17, damageReduced: false });

    const args = npcArgs(npc);
    const result = processAoeNpcs(args);

    expect(result).toEqual([{
      creatureName: 'Orc',
      saveSuccess: true,
      saveRoll: 18,
      saveBonus: 3,
      finalDamage: 3,
      newHp: 17,
      damageReduced: false,
      soulstitchProtected: false,
    }]);
    // disadvantage=corona/te (cold), advantage=circleOfPower (cold store)
    expect(rollSaveForCreature).toHaveBeenCalledWith(npc, 'dexterity', 15, false, false);
    expect(computeDamageAfterEvasion).toHaveBeenCalledWith(6, true, 'half', false);
    expect(applyDamageToTarget).toHaveBeenCalledWith(args.combatSummary, 'Orc', 3, ['Fire'], {
      campaignName: 'TestCampaign',
      characters: [],
      ignoreResistance: false,
      attackerName: 'TestHero',
    });
  });

  it('failed save takes full damage; applyDamageToTarget result wins over compute, null apply falls back', () => {
    const goblin = createNpcCreature('Goblin');
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14, damageReduced: true });

    expect(processAoeNpcs(npcArgs(goblin))).toEqual([{
      creatureName: 'Goblin',
      saveSuccess: false,
      saveRoll: 5,
      saveBonus: 0,
      finalDamage: 6,
      newHp: 14,
      damageReduced: true,
      soulstitchProtected: false,
    }]);

    // resistance applied inside apply: its finalDamage/newHp override compute's
    const dragon = createNpcCreature('Dragon');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 12, bonus: 1 });
    computeDamageAfterEvasion.mockReturnValue(5);
    applyDamageToTarget.mockReturnValue({ finalDamage: 2, newHp: 18 });
    const r2 = processAoeNpcs(npcArgs(dragon, { rawDamage: 6 }));
    expect(r2[0].finalDamage).toBe(2);
    expect(r2[0].damageReduced).toBeUndefined();

    // null apply result → honest fallback to the compute value, newHp undefined
    const golem = createNpcCreature('Golem');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 20, bonus: 5 });
    computeDamageAfterEvasion.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue(null);
    expect(processAoeNpcs(npcArgs(golem, { rawDamage: 10 }))).toEqual([{
      creatureName: 'Golem',
      saveSuccess: true,
      saveRoll: 20,
      saveBonus: 5,
      finalDamage: 0,
      newHp: undefined,
      damageReduced: undefined,
      soulstitchProtected: false,
    }]);

    expect(computeDamageAfterEvasion.mock.calls).toEqual([
      [6, false, 'half', false],
      [6, true, 'half', false],
      [10, true, 'half', false],
    ]);
  });

  it('dcSuccess policy and evasion flag flow through computeDamageAfterEvasion', () => {
    const goblin = createNpcCreature('Goblin');
    rollSaveForCreature.mockReturnValue({ success: true, roll: 15, bonus: 2 });
    computeDamageAfterEvasion.mockReturnValue(0);
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 20 });

    processAoeNpcs(npcArgs(goblin, { rawDamage: 8, dcSuccess: 'half' }));
    processAoeNpcs(npcArgs(goblin, { rawDamage: 10, dcSuccess: 'none' }));

    // evasion matches only when the lane forwards evasionEffects + normalized type
    const rogue = createNpcCreature('Rogue');
    rogue.evasionEffects = [{ saveType: 'DEX' }];
    hasEvasionForSave.mockReturnValue(true);
    processAoeNpcs(npcArgs(rogue, { rawDamage: 6 }));

    expect(computeDamageAfterEvasion.mock.calls).toEqual([
      [8, true, 'half', false],
      [10, true, 'none', false],
      [6, true, 'half', true],
    ]);
    expect(hasEvasionForSave).toHaveBeenLastCalledWith([{ saveType: 'DEX' }], 'dexterity');
  });

  it('processes each NPC independently in affected order, skipping players', () => {
    const goblin1 = createNpcCreature('Goblin 1');
    const hero = createPlayerCreature('Hero');
    const goblin2 = createNpcCreature('Goblin 2');

    rollSaveForCreature
      .mockReturnValueOnce({ success: true, roll: 15, bonus: 2 })
      .mockReturnValueOnce({ success: false, roll: 3, bonus: -1 });
    computeDamageAfterEvasion.mockReturnValueOnce(3).mockReturnValueOnce(8);
    applyDamageToTarget
      .mockReturnValueOnce({ finalDamage: 3, newHp: 17, damageReduced: true })
      .mockReturnValueOnce({ finalDamage: 8, newHp: 7 });

    const result = processAoeNpcs(npcArgs(goblin1, {
      combatSummary: makeCombatSummary([goblin1, hero, goblin2]),
      affected: [{ creature: goblin1 }, { creature: hero }, { creature: goblin2 }],
      damageType: 'Cold',
      saveType: 'wisdom',
    }));

    expect(result).toEqual([
      { creatureName: 'Goblin 1', saveSuccess: true, saveRoll: 15, saveBonus: 2, finalDamage: 3, newHp: 17, damageReduced: true, soulstitchProtected: false },
      { creatureName: 'Goblin 2', saveSuccess: false, saveRoll: 3, saveBonus: -1, finalDamage: 8, newHp: 7, damageReduced: undefined, soulstitchProtected: false },
    ]);
    expect(rollSaveForCreature.mock.calls.map(([c]) => c.name)).toEqual(['Goblin 1', 'Goblin 2']);
  });

  it('soulstitch: attacker-stored name list forces success at zero damage (compute skipped); unlisted targets take normal damage', () => {
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    const ally = createNpcCreature('Ally');

    getRuntimeValue.mockImplementation((key) => (key === 'Nemesis' ? ['Ally'] : null));
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 20 });
    expect(processAoeNpcs(npcArgs(ally, { attackerName: 'Nemesis' }))).toEqual([{
      creatureName: 'Ally',
      saveSuccess: true,
      saveRoll: 5,
      saveBonus: 0,
      finalDamage: 0,
      newHp: 20,
      damageReduced: undefined,
      soulstitchProtected: true,
    }]);
    expect(getRuntimeValue).toHaveBeenCalledWith('Nemesis', '_Nemesis_Soulstitch_Spells_active', 'TestCampaign');
    expect(computeDamageAfterEvasion).not.toHaveBeenCalled();

    getRuntimeValue.mockImplementation((key) => (key === 'Nemesis' ? ['OtherPerson'] : null));
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });
    const r2 = processAoeNpcs(npcArgs(ally, { attackerName: 'Nemesis' }));
    expect(r2[0].soulstitchProtected).toBe(false);
    expect(r2[0].saveSuccess).toBe(false);
    expect(r2[0].finalDamage).toBe(6);
  });

  it('te riders: disadvantage_on_next_save applies once and consumes (writing remaining te); ability_save_disadvantage (MA-1352) is save-type-scoped and never consumed', () => {
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    // Byte-distinct decoy te survives the consume-write untouched.
    const decoy = { target: 'Someone Else', effect: 'slow' };
    const rider = { target: 'Goblin', effect: 'disadvantage_on_next_save' };
    const goblin = createNpcCreature('Goblin');
    getRuntimeValue.mockImplementation((key, prop) =>
      (key === 'campaign' && prop === 'targetEffects') ? [decoy, rider] : null);

    processAoeNpcs(npcArgs(goblin));
    expect(rollSaveForCreature).toHaveBeenCalledWith(goblin, 'dexterity', 15, true, false);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [decoy], 'TestCampaign');

    // Ability-scoped te: INT save pays, WIS save unaffected, store never rewritten.
    const intTe = { target: 'Goblin', effect: 'ability_save_disadvantage', ability: 'int', source: 'Psychic Gray Ooze 1' };
    getRuntimeValue.mockImplementation((key, prop) =>
      (key === 'campaign' && prop === 'targetEffects') ? [intTe] : null);
    setRuntimeValue.mockClear();

    processAoeNpcs(npcArgs(goblin, { saveType: 'INT', damageType: 'Psychic' }));
    expect(rollSaveForCreature).toHaveBeenLastCalledWith(goblin, 'INT', 15, true, false);

    processAoeNpcs(npcArgs(goblin, { saveType: 'WIS', damageType: 'Psychic' }));
    expect(rollSaveForCreature).toHaveBeenLastCalledWith(goblin, 'WIS', 15, false, false);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('CLA-063: corona sunlight_aura disadvantages a listed enemy on Fire saves (sync lane)', () => {
    getCombatSummary.mockReturnValue(makeCombatSummary([createPlayerCreature('TestHero')]));
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'TestHero' && prop === 'activeBuffs') {
        return [{ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire', 'Radiant'] }];
      }
      if (key === 'TestHero' && prop === 'coronaOfLightEnemies') return ['Goblin'];
      return null;
    });
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    processAoeNpcs(npcArgs(createNpcCreature('Goblin')));

    expect(rollSaveForCreature).toHaveBeenCalledWith(expect.objectContaining({ name: 'Goblin' }), 'dexterity', 15, true, false);
  });

  it('heightenTarget disadvantages the named target only', () => {
    rollSaveForCreature.mockReturnValue({ success: false, roll: 5, bonus: 0 });
    computeDamageAfterEvasion.mockReturnValue(6);
    applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 14 });

    const goblin = createNpcCreature('Goblin');
    processAoeNpcs(npcArgs(goblin, { heightenTarget: 'Goblin' }));
    expect(rollSaveForCreature).toHaveBeenLastCalledWith(goblin, 'dexterity', 15, true, false);

    processAoeNpcs(npcArgs(goblin, { heightenTarget: 'Someone Else' }));
    expect(rollSaveForCreature).toHaveBeenLastCalledWith(goblin, 'dexterity', 15, false, false);
  });
});

// ── sendAoePlayerSaves ──────────────────────────────────────────────

describe('sendAoePlayerSaves', () => {
  it('returns [] and sends no prompts when there are no player targets', () => {
    expect(sendAoePlayerSaves({ affected: [], ...PLAYER_SAVE_ARGS })).toEqual([]);
    expect(sendAoePlayerSaves({ affected: [{ creature: createNpcCreature('Goblin') }], ...PLAYER_SAVE_ARGS })).toEqual([]);
    expect(sendSavePrompt).not.toHaveBeenCalled();
  });

  it('one exact prompt per player in order — full pending tuples, guids consumed per player, NPCs skipped', () => {
    const hero = createPlayerCreature('Hero');
    const ranger = createPlayerCreature('Ranger');
    utils.guid.mockReturnValueOnce('guid-1').mockReturnValueOnce('guid-2');

    const results = sendAoePlayerSaves({
      affected: [{ creature: createNpcCreature('Goblin') }, { creature: hero }, { creature: ranger }],
      ...PLAYER_SAVE_ARGS,
    });

    expect(results).toEqual([
      { promptId: 'guid-1', targetName: 'Hero', creature: hero },
      { promptId: 'guid-2', targetName: 'Ranger', creature: ranger },
    ]);
    expect(utils.guid).toHaveBeenCalledTimes(2);
    expect(sendSavePrompt.mock.calls).toEqual([
      ['TestCampaign', {
        promptId: 'guid-1', targetName: 'Hero', saveType: 'dexterity', saveDc: 15,
        dcSuccess: 'half', damageFormula: '3d6', damageType: 'Fire',
        sourceName: 'Fireball', sourceAttackerName: 'Wizard', rawDamage: 8, disadvantage: false,
      }],
      ['TestCampaign', {
        promptId: 'guid-2', targetName: 'Ranger', saveType: 'dexterity', saveDc: 15,
        dcSuccess: 'half', damageFormula: '3d6', damageType: 'Fire',
        sourceName: 'Fireball', sourceAttackerName: 'Wizard', rawDamage: 8, disadvantage: false,
      }],
    ]);
  });

  it('CLA-063: prompt carries corona sunlight_aura disadvantage for a listed enemy vs Fire', () => {
    const hero = createPlayerCreature('Hero');
    utils.guid.mockReturnValue('guid-coro');
    getCombatSummary.mockReturnValue(makeCombatSummary([createPlayerCreature('Wizard')]));
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Wizard' && prop === 'activeBuffs') {
        return [{ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire', 'Radiant'] }];
      }
      if (key === 'Wizard' && prop === 'coronaOfLightEnemies') return ['Hero'];
      return null;
    });

    sendAoePlayerSaves({ affected: [{ creature: hero }], ...PLAYER_SAVE_ARGS });

    expect(sendSavePrompt).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'Hero',
      damageType: 'Fire',
      disadvantage: true,
    }));
  });

  it('prompt disadvantage from rider te (never consumed on this lane) and from heightenTarget only', () => {
    const hero = createPlayerCreature('Hero');
    utils.guid.mockReturnValue('guid-rider');
    getRuntimeValue.mockImplementation((key, prop) =>
      (key === 'campaign' && prop === 'targetEffects')
        ? [{ target: 'Hero', effect: 'disadvantage_on_next_save' }]
        : null);

    sendAoePlayerSaves({ affected: [{ creature: hero }], ...PLAYER_SAVE_ARGS });
    expect(sendSavePrompt).toHaveBeenLastCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'Hero', disadvantage: true,
    }));
    // Player lane is read-only on the store — the rider survives for the roller.
    expect(setRuntimeValue).not.toHaveBeenCalled();

    getRuntimeValue.mockReturnValue(null);
    sendAoePlayerSaves({ affected: [{ creature: hero }], ...PLAYER_SAVE_ARGS, heightenTarget: 'Hero' });
    expect(sendSavePrompt).toHaveBeenLastCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'Hero', disadvantage: true,
    }));

    sendAoePlayerSaves({ affected: [{ creature: hero }], ...PLAYER_SAVE_ARGS, heightenTarget: 'Someone Else' });
    expect(sendSavePrompt).toHaveBeenLastCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'Hero', disadvantage: false,
    }));
  });

  it('MA-1352: ability-scoped te disadvantages only the matching save type', () => {
    const hero = createPlayerCreature('Hero');
    utils.guid.mockReturnValue('guid-ability');
    getRuntimeValue.mockImplementation((key, prop) =>
      (key === 'campaign' && prop === 'targetEffects')
        ? [{ target: 'Hero', effect: 'ability_save_disadvantage', ability: 'int', source: 'Psychic Gray Ooze 1' }]
        : null);

    sendAoePlayerSaves({ affected: [{ creature: hero }], ...PLAYER_SAVE_ARGS, saveType: 'INT' });
    expect(sendSavePrompt).toHaveBeenLastCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'Hero', disadvantage: true,
    }));

    sendAoePlayerSaves({ affected: [{ creature: hero }], ...PLAYER_SAVE_ARGS, saveType: 'DEX' });
    expect(sendSavePrompt).toHaveBeenLastCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'Hero', disadvantage: false,
    }));
  });
});
