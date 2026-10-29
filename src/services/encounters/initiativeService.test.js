// @maintained-by-ai
// Lane: initiativeService — the RUNTIME +NPC / turn-navigation seam of initiative.
// Ownership split (do not re-drive here): d20 ROLL math is owned by
// src/services/dice/diceRoller.test.js; encounter-BUILDER entry assembly and its
// phantasmal HP halving are owned by encounterToInitiative.test.js (#1078 byte
// contract); IRV *resolution* is owned by monsterIrvUtils.test.js and save-bonus
// derivation by encounterToInitiative.test.js — this file proves only the WIRING of
// those resolved values onto an existing combatSummary at this seam. UI consumers
// (components/initiative/*) MOCK this service (#862-#875), so real behavior lives
// only here. RNG discipline (#1072): rollD20 is mocked at its seam with exact
// fixed sequences; consumers of the initiative-rolled event live elsewhere (#863).
// No wall-clock here — initiative moves only at event seams.
//
// Old → new map (38 → 23 blocks): parseInitBonus ×2 → it.each; setupCreatures
// default/numbering/sort ×3 → verbatim-byte fixture + degenerate row; addNpc ×4 →
// it.each on the shared npc-default fixture; removeNpc / setTarget ×2-3 each →
// single multi-assert blocks; next/previous navigation ×3 each → it.each seam
// tables; isPreviousDisabled ×4 → it.each guard table; rollNpcInitiative ×3 →
// fixed-dice sequence (bonus + default + sort in one) and never-roll guard;
// applyNpcMonsterData ×9 → full-wiring byte + degenerate-defaults byte + guard +
// imagePath pair + NEW phantasmal table (resolvePhantasmalHp was unpinned);
// renameNpc ×3 → campaign-lane + bestiary/missing; clearCombat ×2 → verbatim byte;
// merge ×7 → contract / defaults+missing-summary / drop (sort & conditions folded
// into the contract test). Math.random spies replaced with the rollD20 seam.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

// rng seam: exact fixed sequences per test (#1072); roll math owned by diceRoller.test.js
vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));
// bestiary source for renameNpc's remote lookup — keeps tests offline
vi.mock('../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(() => Promise.resolve([
    { index: 'goblin', name: 'Goblin', armor_class: 12 },
    { index: 'orc', name: 'Orc', armor_class: 13 },
  ])),
}));
// phantasmal-store seam (zoneDurationClock also imports these names — keep all three)
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

import { rollD20 } from '../dice/diceRoller.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import {
  parseInitBonus,
  setupCreatures,
  isBareNpcPlaceholder,
  addNpc,
  removeNpc,
  getNextCreatureName,
  getPreviousCreatureName,
  isPreviousDisabled,
  setInitiative,
  rollNpcInitiative,
  applyNpcMonsterData,
  renameNpc,
  setTarget,
  clearCombat,
  mergeCombatSummaryWithCharacters,
} from './initiativeService.js';

const getName = (name) => name;

// Verbatim NPC default byte pushed by both setupCreatures and addNpc (#993).
const npcDefault = (n) => ({
  name: `NPC ${n}`,
  type: 'npc',
  initiative: '',
  targetName: null,
  ac: 10,
  resistances: [],
  immunities: [],
  concentration: null,
  maxHp: 10,
  currentHp: 10,
  saveBonuses: {},
});

const playerByte = (name, extra = {}) => ({
  name,
  type: 'player',
  initiative: '',
  targetName: null,
  concentration: null,
  ...extra,
});

describe('initiativeService', () => {
  beforeEach(() => {
    rollD20.mockReset(); // determinism re-arm (#1057)
    getRuntimeValue.mockReset().mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks(); // restores console spies (#1007)
  });

  describe('parseInitBonus', () => {
    it.each([
      { label: 'absent details', monster: {}, expected: 0 },
      { label: 'non-matching text', monster: { initiative_details: 'flat +2' }, expected: 0 },
      { label: 'leading +N with text', monster: { initiative_details: '+3 initiative' }, expected: 3 },
      { label: 'bare +N', monster: { initiative_details: '+4' }, expected: 4 },
      { label: 'bare -N', monster: { initiative_details: '-2' }, expected: -2 },
    ])('parses $label as $expected', ({ monster, expected }) => {
      expect(parseInitBonus(monster)).toBe(expected);
    });
  });

  describe('setupCreatures', () => {
    it('produces exact bytes: players sorted alphabetically, then sequentially-numbered NPCs with defaults', () => {
      const characters = [{ name: 'Zara' }, { name: 'Aldric' }];
      expect(setupCreatures(characters, 1, getName)).toEqual([
        playerByte('Aldric'),
        playerByte('Zara'),
        npcDefault(1),
      ]);
    });

    it('returns an empty roster for zero characters and zero NPCs (#945)', () => {
      expect(setupCreatures([], 0, getName)).toEqual([]);
    });
  });

  describe('addNpc', () => {
    it.each([
      { label: 'no NPCs yet', creatures: [playerByte('Aldric')], expected: 1 },
      { label: 'sequential numbering continues', creatures: [npcDefault(1), npcDefault(2)], expected: 3 },
      { label: 'gaps are skipped, max wins', creatures: [npcDefault(1), npcDefault(3)], expected: 4 },
      { label: 'players do not affect numbering', creatures: [playerByte('Aldric'), npcDefault(5)], expected: 6 },
    ])('addNpc: $label → next number is $expected', ({ creatures, expected }) => {
      const combatSummary = { round: 1, creatures: [...creatures] };
      expect(addNpc(combatSummary)).toBe(expected);
      expect(combatSummary.creatures.at(-1)).toEqual(npcDefault(expected));
    });
  });

  describe('removeNpc', () => {
    it('removes only the matching creature and ignores unknown names', () => {
      const combatSummary = {
        round: 1,
        creatures: [playerByte('Aldric'), npcDefault(1), npcDefault(2)],
      };
      removeNpc(combatSummary, 'NPC 99'); // unknown name: no-op
      expect(combatSummary.creatures).toHaveLength(3);
      removeNpc(combatSummary, 'NPC 1');
      expect(combatSummary.creatures.map(c => c.name)).toEqual(['Aldric', 'NPC 2']);
    });
  });

  describe('getNextCreatureName', () => {
    it.each([
      { names: ['Aldric', 'Brenna', 'NPC 1'], active: 'Brenna', expectedName: 'NPC 1', expectedFlag: false },
      { names: ['Aldric', 'Brenna'], active: 'Brenna', expectedName: 'Aldric', expectedFlag: true },
      { names: ['Aldric'], active: 'Aldric', expectedName: 'Aldric', expectedFlag: true },
    ])('getNextCreatureName: $active of [$names] → $expectedName (roundIncrement: $expectedFlag)', ({ names, active, expectedName, expectedFlag }) => {
      const combatSummary = { creatures: names.map(name => ({ name })) };
      const result = getNextCreatureName(combatSummary, active);
      expect(result.newActiveName).toBe(expectedName);
      expect(result.roundIncrement).toBe(expectedFlag);
    });
  });

  describe('getPreviousCreatureName', () => {
    it.each([
      { names: ['Aldric', 'Brenna', 'NPC 1'], active: 'NPC 1', expectedName: 'Brenna', expectedFlag: false },
      { names: ['Aldric', 'Brenna'], active: 'Aldric', expectedName: 'Brenna', expectedFlag: true },
      { names: ['Aldric'], active: 'Aldric', expectedName: 'Aldric', expectedFlag: true },
    ])('getPreviousCreatureName: $active of [$names] → $expectedName (roundDecrement: $expectedFlag)', ({ names, active, expectedName, expectedFlag }) => {
      const combatSummary = { creatures: names.map(name => ({ name })) };
      const result = getPreviousCreatureName(combatSummary, active);
      expect(result.newActiveName).toBe(expectedName);
      expect(result.roundDecrement).toBe(expectedFlag);
    });
  });

  describe('isPreviousDisabled', () => {
    it.each([
      { label: 'null summary', names: null, active: 'Aldric', round: 1, expected: false },
      { label: 'not the first creature', names: ['Aldric', 'Brenna'], active: 'Brenna', round: 1, expected: false },
      { label: 'first creature but round > 1', names: ['Aldric'], active: 'Aldric', round: 2, expected: false },
      { label: 'first creature on round 1', names: ['Aldric'], active: 'Aldric', round: 1, expected: true },
    ])('isPreviousDisabled: $label → $expected', ({ names, active, round, expected }) => {
      const combatSummary = names && { creatures: names.map(name => ({ name })), round };
      expect(isPreviousDisabled(combatSummary, active)).toBe(expected);
    });
  });

  describe('setInitiative', () => {
    it('sets the value, re-sorts descending (ties keep insertion order), and ignores unknown creatures', () => {
      const combatSummary = {
        creatures: [
          { name: 'Aldric', initiative: '3' },
          { name: 'Brenna', initiative: '7' },
          { name: 'Zara', initiative: '3' },
        ],
      };
      setInitiative(combatSummary, 'Nope', '20'); // unknown: no-op (#936)
      setInitiative(combatSummary, 'Aldric', '9');
      expect(combatSummary.creatures.map(c => c.name)).toEqual(['Aldric', 'Brenna', 'Zara']);
      setInitiative(combatSummary, 'Zara', '7'); // tie with Brenna — stable order (#949)
      expect(combatSummary.creatures.map(c => c.name)).toEqual(['Aldric', 'Brenna', 'Zara']);
      expect(combatSummary.creatures[0].initiative).toBe('9');
    });
  });

  describe('rollNpcInitiative', () => {
    it('rolls exactly one die per NPC call, adds the bonus, stores the total as a string, and re-sorts', () => {
      rollD20.mockReturnValueOnce(11).mockReturnValueOnce(17);
      const combatSummary = {
        creatures: [
          { name: 'NPC 1', type: 'npc', initiativeBonus: 2, initiative: '4' },
          { name: 'NPC 2', type: 'npc', initiative: '' },
        ],
      };
      expect(rollNpcInitiative(combatSummary, 'NPC 1')).toEqual({ roll: 11, bonus: 2, total: 13 });
      // default initiativeBonus of 0 when absent; second roll outranks first → re-sort
      expect(rollNpcInitiative(combatSummary, 'NPC 2')).toEqual({ roll: 17, bonus: 0, total: 17 });
      expect(combatSummary.creatures.map(c => c.name)).toEqual(['NPC 2', 'NPC 1']);
      expect(combatSummary.creatures.map(c => c.initiative)).toEqual(['17', '13']);
      expect(rollD20).toHaveBeenCalledTimes(2); // one dispatch per roll (#951)
    });

    it('returns null without consuming a die roll for players or unknown names', () => {
      const combatSummary = { creatures: [playerByte('Aldric'), npcDefault(1)] };
      expect(rollNpcInitiative(combatSummary, 'Aldric')).toBeNull();
      expect(rollNpcInitiative(combatSummary, 'NPC 99')).toBeNull();
      expect(rollD20).not.toHaveBeenCalled();
    });
  });

  describe('applyNpcMonsterData', () => {
    it('wires resolved monster data onto the creature byte (IRV resolution owned by monsterIrvUtils.test.js, save derivation by encounterToInitiative.test.js)', async () => {
      const combatSummary = { creatures: [{ name: 'Ogre', type: 'npc' }] };
      await applyNpcMonsterData(combatSummary, 0, {
        armor_class: 15,
        damage_resistances: ['fire'],
        damage_immunities: ['poison'],
        hit_points: 50,
        initiative_details: '+4',
        saving_throws: { str: { modifier: 5 } },
        size: 'Huge',
        type: 'Giant',
      }, []);
      expect(combatSummary.creatures[0]).toEqual({
        name: 'Ogre',
        type: 'npc',
        ac: 15,
        resistances: ['fire'],
        immunities: ['poison'],
        vulnerabilities: [],
        initiativeBonus: 4,
        maxHp: 50,
        currentHp: 50,
        saveBonuses: { str: 5, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        size: 'Huge',
        monsterType: 'Giant',
      });
    });

    it('degenerate monster data defaults honestly and keeps existing size/monsterType (MN-015, CLA-303)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const combatSummary = {
        creatures: [{ name: 'NPC 1', type: 'npc', monsterType: 'Undead', size: 'Medium' }],
      };
      await applyNpcMonsterData(combatSummary, 0, { armor_class: '15', initiative_details: 'flat +2' }, []);
      expect(combatSummary.creatures[0]).toEqual({
        name: 'NPC 1',
        type: 'npc',
        ac: 10, // non-numeric armor_class → logged default, not silent
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        initiativeBonus: 0,
        maxHp: 10,
        currentHp: 10,
        saveBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        size: 'Medium',
        monsterType: 'Undead',
      });
      expect(errSpy).toHaveBeenCalled();
    });

    it('does nothing for a non-existent creature index (#936)', async () => {
      const combatSummary = { creatures: [] };
      await applyNpcMonsterData(combatSummary, 5, { armor_class: 15 }, []);
      expect(combatSummary.creatures).toEqual([]);
    });

    it('adopts imagePath from a case-insensitive campaignNpc match only', async () => {
      const combatSummary = { creatures: [{ name: 'goblin', type: 'npc' }, { name: 'Skeleton', type: 'npc' }] };
      const campaignNpcs = [{ name: 'Goblin', imagePath: '/images/goblin.png' }];
      await applyNpcMonsterData(combatSummary, 0, { armor_class: 12 }, campaignNpcs);
      await applyNpcMonsterData(combatSummary, 1, { armor_class: 12 }, campaignNpcs);
      expect(combatSummary.creatures[0].imagePath).toBe('/images/goblin.png');
      expect(combatSummary.creatures[1].imagePath).toBeUndefined();
    });

    it.each([
      { label: 'Bestial Spirit tracked by a PC', name: 'Bestial Spirit', list: ['Bestial Spirit'], hp: 21, expected: 10 },
      { label: 'Fey Spirit tracked by a PC', name: 'Fey Spirit', list: ['Fey Spirit'], hp: 20, expected: 10 },
      { label: 'spirit tracked by no one', name: 'Bestial Spirit', list: null, hp: 21, expected: 21 },
      { label: 'non-spirit name never halves', name: 'Wolf', list: ['Wolf'], hp: 21, expected: 21 },
    ])('phantasmal HP: $label → $hp lands as $expected', async ({ name, list, hp, expected }) => {
      getRuntimeValue.mockImplementation((_char, key) =>
        key === '_phantasmalCreatures_list' ? list : null);
      const combatSummary = { creatures: [playerByte('Druid'), { name, type: 'npc' }] };
      await applyNpcMonsterData(combatSummary, 1, { armor_class: 10, hit_points: hp }, []);
      expect(combatSummary.creatures[1]).toMatchObject({ maxHp: expected, currentHp: expected });
    });
  });

  describe('renameNpc', () => {
    it('renames, refreshes stats from the campaign NPC, and rewrites image-map bytes with the campaign-prefixed local URL', async () => {
      const combatSummary = { creatures: [{ name: 'Old Name', type: 'npc' }] };
      const campaignNpcs = [{ name: 'New Name', armorClass: 15, hitPoints: 30, imagePath: 'images/new.png' }];
      const setNpcImages = vi.fn();
      await renameNpc({ combatSummary, oldName: 'Old Name', newName: 'New Name', campaignNpcs, setNpcImages, campaignName: 'campaign-1' });
      expect(combatSummary.creatures[0].name).toBe('New Name');
      expect(combatSummary.creatures[0].ac).toBe(15);
      expect(combatSummary.creatures[0].maxHp).toBe(30);
      const updater = setNpcImages.mock.calls[0][0];
      expect(updater({ 'Old Name': 'https://example.com/old.jpg', Stranger: 'keep.jpg' })).toEqual({
        Stranger: 'keep.jpg',
        'New Name': 'campaigns/campaign-1/images/new.png',
      });
    });

    it('resolves the remote bestiary URL for a monster name and does nothing for an unknown creature', async () => {
      const combatSummary = { creatures: [{ name: 'NPC 1', type: 'npc' }] };
      const setNpcImages = vi.fn();
      await renameNpc({ combatSummary, oldName: 'NPC 1', newName: 'Goblin', campaignNpcs: [], setNpcImages, campaignName: 'campaign-1' });
      expect(combatSummary.creatures[0]).toMatchObject({ name: 'Goblin', ac: 12 }); // bestiary stat block applied
      const updater = setNpcImages.mock.calls[0][0];
      expect(updater({ 'NPC 1': 'https://example.com/old.jpg' })).toEqual({
        Goblin: 'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg',
      });

      await renameNpc({ combatSummary, oldName: 'Nope', newName: 'Ghost', campaignNpcs: [], setNpcImages, campaignName: 'campaign-1' });
      expect(combatSummary.creatures[0].name).toBe('Goblin');
      expect(setNpcImages).toHaveBeenCalledTimes(1); // no image churn for a missing creature
    });
  });

  describe('setTarget', () => {
    it('sets, clears (null and empty-string both normalize to null), and ignores unknown creatures', () => {
      const combatSummary = { creatures: [{ name: 'Aldric', targetName: null }] };
      setTarget(combatSummary, 'Aldric', 'Goblin');
      expect(combatSummary.creatures[0].targetName).toBe('Goblin');
      setTarget(combatSummary, 'Aldric', '');
      expect(combatSummary.creatures[0].targetName).toBeNull();
      setTarget(combatSummary, 'Aldric', 'Orc');
      setTarget(combatSummary, 'Nope', null); // unknown: no-op (#936)
      expect(combatSummary.creatures[0].targetName).toBe('Orc');
    });
  });

  describe('clearCombat', () => {
    it('builds a fresh round-1 summary with sorted players then NPCs, verbatim bytes', () => {
      expect(clearCombat([{ name: 'Brenna' }, { name: 'Aldric' }], 2, getName)).toEqual({
        round: 1,
        creatures: [playerByte('Aldric'), playerByte('Brenna'), npcDefault(1), npcDefault(2)],
      });
    });

    // bug-initiative-clear-monsters-become-npc-stubs: monsters cleared off the
    // board must NEVER resurrect as anonymous NPC stubs — only untouched
    // "+ NPC" placeholders count toward the carried-over number.
    it('re-seeds players only when the cleared board held just EB monsters/summons (no bare placeholders)', () => {
      const board = [
        playerByte('Aldric'),
        playerByte('Brenna'),
        { name: 'Goblin', type: 'npc', monsterIndex: 'goblin', ac: 15, maxHp: 7, currentHp: 7 },
        { name: 'Goblin 2', type: 'npc', monsterIndex: 'goblin', ac: 15, maxHp: 7, currentHp: 3 },
        { name: 'Goblin', type: 'npc', monsterIndex: 'goblin', summonedBy: 'Aldric', summonSource: 'spell', ac: 15, maxHp: 7, currentHp: 7 },
      ];
      const carried = board.filter(isBareNpcPlaceholder).length;
      expect(carried).toBe(0);
      expect(clearCombat([{ name: 'Brenna' }, { name: 'Aldric' }], carried, getName)).toEqual({
        round: 1,
        creatures: [playerByte('Aldric'), playerByte('Brenna')],
      });
    });
  });

  describe('isBareNpcPlaceholder', () => {
    it('matches untouched +NPC placeholder rows', () => {
      expect(isBareNpcPlaceholder({ name: 'NPC 1', type: 'npc', ac: 10, maxHp: 10, currentHp: 10 })).toBe(true);
      expect(isBareNpcPlaceholder({ name: 'NPC 12', type: 'npc' })).toBe(true);
    });

    it('rejects EB-joined monsters, summons, renamed placeholders, players, and nameless rows', () => {
      expect(isBareNpcPlaceholder({ name: 'Goblin', type: 'npc', monsterIndex: 'goblin' })).toBe(false);
      expect(isBareNpcPlaceholder({ name: 'Goblin 2', type: 'npc', monsterIndex: 'goblin' })).toBe(false);
      expect(isBareNpcPlaceholder({ name: 'Bear', type: 'npc', monsterIndex: 'bear', summonedBy: 'Wild_Sage_Druid' })).toBe(false);
      expect(isBareNpcPlaceholder({ name: 'Goblin', type: 'npc' })).toBe(false); // renamed NPC / index-less monster
      expect(isBareNpcPlaceholder({ name: 'npc 1', type: 'npc' })).toBe(false); // case-exact name shape
      expect(isBareNpcPlaceholder({ name: 'NPC 1', type: 'elemental' })).toBe(false);
      expect(isBareNpcPlaceholder({ name: 'Alice', type: 'player' })).toBe(false);
      expect(isBareNpcPlaceholder({ type: 'npc' })).toBe(false); // nameless row never matches
    });
  });

  describe('mergeCombatSummaryWithCharacters', () => {
    it('preserves stored state, adds new players with defaults, sorts init-desc then name, and keeps round', () => {
      const initialSummary = {
        round: 3,
        creatures: [
          playerByte('Zara'),
          { name: 'Aldric', type: 'player', initiative: '5', targetName: 'Goblin', concentration: 'spell1' },
          { name: 'NPC 1', type: 'npc', initiative: '3', conditions: ['poisoned'], currentHp: 5, maxHp: 10 },
        ],
      };
      const characters = [{ name: 'Aldric' }, { name: 'Zara' }, { name: 'Brenna' }];
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);

      expect(result.round).toBe(3); // round survives re-merge — event-seam only, no clock
      // init desc, '' ties (Zara/Brenna) resolved alphabetically (#1036)
      expect(result.creatures.map(c => c.name)).toEqual(['Aldric', 'NPC 1', 'Brenna', 'Zara']);
      expect(result.creatures[0]).toEqual({ name: 'Aldric', type: 'player', initiative: '5', targetName: 'Goblin', concentration: 'spell1' });
      expect(result.creatures[1]).toMatchObject({ conditions: ['poisoned'], currentHp: 5, maxHp: 10 });
      expect(result.creatures[2]).toEqual(playerByte('Brenna')); // new player gets defaults
    });

    it('defaults missing fields for NPCs and produces a fresh round-1 roster when the summary is absent', () => {
      const initialSummary = {
        round: 2,
        creatures: [
          { name: 'NPC 1', type: 'npc', maxHp: 20 },
          { name: 'NPC 2', type: 'npc' },
        ],
      };
      const result = mergeCombatSummaryWithCharacters(initialSummary, [], getName);
      expect(result.creatures[0]).toMatchObject({ name: 'NPC 1', currentHp: 20 }); // currentHp ← maxHp
      expect(result.creatures[1]).toMatchObject({
        name: 'NPC 2', currentHp: 10, maxHp: 10, initiative: '', concentration: null, saveBonuses: {},
      }); // currentHp/maxHp ← 10 defaults

      expect(mergeCombatSummaryWithCharacters(undefined, [{ name: 'Aldric' }], getName)).toEqual({
        round: 1, creatures: [playerByte('Aldric')],
      });
    });

    it('drops stored players no longer in the character list and keeps NPCs', () => {
      const initialSummary = {
        round: 1,
        creatures: [
          { name: 'Aldric', type: 'player', initiative: '5' },
          { name: 'OldPlayer', type: 'player', initiative: '8' },
          { name: 'NPC 1', type: 'npc', currentHp: 5, maxHp: 10 },
        ],
      };
      const result = mergeCombatSummaryWithCharacters(initialSummary, [{ name: 'Aldric' }], getName);
      expect(result.creatures.map(c => c.name)).toEqual(['Aldric', 'NPC 1']);
    });
  });
});
