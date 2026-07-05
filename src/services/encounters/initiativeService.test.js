// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseInitBonus,
  setupCreatures,
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

describe('initiativeService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseInitBonus', () => {
    it('returns 0 when initiative_details is absent or non-matching', () => {
      expect(parseInitBonus({})).toBe(0);
      expect(parseInitBonus({ initiative_details: 'flat +2' })).toBe(0);
    });

    it('parses positive and negative bonuses from a leading +/-N pattern', () => {
      expect(parseInitBonus({ initiative_details: '+3 initiative' })).toBe(3);
      expect(parseInitBonus({ initiative_details: '+4' })).toBe(4);
      expect(parseInitBonus({ initiative_details: '-2' })).toBe(-2);
    });
  });

  describe('setupCreatures', () => {
    function getName(name) {
      return name;
    }

    it('creates player creatures sorted alphabetically with correct defaults', () => {
      const characters = [{ name: 'Zara' }, { name: 'Aldric' }, { name: 'Mira' }];
      const result = setupCreatures(characters, 0, getName);

      expect(result).toHaveLength(3);
      expect(result.map(c => c.name)).toEqual(['Aldric', 'Mira', 'Zara']);
      result.forEach(c => {
        expect(c.type).toBe('player');
        expect(c.initiative).toBe('');
        expect(c.targetName).toBeNull();
        expect(c.concentration).toBeNull();
      });
    });

    it('appends sequentially-numbered NPCs after players', () => {
      const characters = [{ name: 'Aldric' }];
      const result = setupCreatures(characters, 3, getName);

      expect(result).toHaveLength(4);
      expect(result[0].name).toBe('Aldric');
      expect(result[0].type).toBe('player');
      expect(result[1].name).toBe('NPC 1');
      expect(result[2].name).toBe('NPC 2');
      expect(result[3].name).toBe('NPC 3');
    });

    it('gives NPCs default stats', () => {
      const result = setupCreatures([], 1, getName);
      const npc = result[0];
      expect(npc.ac).toBe(10);
      expect(npc.maxHp).toBe(10);
      expect(npc.currentHp).toBe(10);
      expect(npc.resistances).toEqual([]);
      expect(npc.immunities).toEqual([]);
      expect(npc.saveBonuses).toEqual({});
    });

    it('handles zero characters and zero NPCs', () => {
      const result = setupCreatures([], 0, getName);
      expect(result).toHaveLength(0);
    });
  });

  describe('addNpc', () => {
    function makeCombatSummary(creatureList) {
      return { round: 1, creatures: creatureList };
    }

    it('appends a new NPC with sequential number and returns the number', () => {
      const combatSummary = makeCombatSummary([
        { name: 'NPC 1', type: 'npc' },
        { name: 'NPC 2', type: 'npc' },
      ]);
      const result = addNpc(combatSummary);
      expect(result).toBe(3);
      expect(combatSummary.creatures[2].name).toBe('NPC 3');
      expect(combatSummary.creatures[2].type).toBe('npc');
      expect(combatSummary.creatures[2].ac).toBe(10);
    });

    it('skips numbers when existing NPCs have gaps', () => {
      const combatSummary = makeCombatSummary([
        { name: 'NPC 1', type: 'npc' },
        { name: 'NPC 3', type: 'npc' },
      ]);
      const result = addNpc(combatSummary);
      expect(result).toBe(4);
    });

    it('finds the max among mixed player and NPC creatures', () => {
      const combatSummary = makeCombatSummary([
        { name: 'Aldric', type: 'player' },
        { name: 'NPC 5', type: 'npc' },
      ]);
      const result = addNpc(combatSummary);
      expect(result).toBe(6);
    });

    it('returns 1 when there are no NPCs', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric', type: 'player' }]);
      const result = addNpc(combatSummary);
      expect(result).toBe(1);
    });
  });

  describe('removeNpc', () => {
    function makeCombatSummary(creatureList) {
      return { round: 1, creatures: creatureList };
    }

    it('removes the matching creature', () => {
      const combatSummary = makeCombatSummary([
        { name: 'Aldric', type: 'player' },
        { name: 'NPC 1', type: 'npc' },
        { name: 'NPC 2', type: 'npc' },
      ]);
      removeNpc(combatSummary, 'NPC 1');
      expect(combatSummary.creatures).toHaveLength(2);
      expect(combatSummary.creatures[1].name).toBe('NPC 2');
    });

    it('does nothing for a non-existent name', () => {
      const combatSummary = makeCombatSummary([{ name: 'NPC 1', type: 'npc' }]);
      removeNpc(combatSummary, 'NPC 99');
      expect(combatSummary.creatures).toHaveLength(1);
    });
  });

  describe('getNextCreatureName', () => {
    function makeCombatSummary(creatureList) {
      return { creatures: creatureList };
    }

    it('returns the next creature without round increment', () => {
      const combatSummary = makeCombatSummary([
        { name: 'Aldric' },
        { name: 'Brenna' },
        { name: 'NPC 1' },
      ]);
      const result = getNextCreatureName(combatSummary, 'Brenna');
      expect(result.newActiveName).toBe('NPC 1');
      expect(result.roundIncrement).toBe(false);
    });

    it('wraps to first creature and increments round at last', () => {
      const combatSummary = makeCombatSummary([
        { name: 'Aldric' },
        { name: 'Brenna' },
      ]);
      const result = getNextCreatureName(combatSummary, 'Brenna');
      expect(result.newActiveName).toBe('Aldric');
      expect(result.roundIncrement).toBe(true);
    });

    it('wraps and increments round for a single creature', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric' }]);
      const result = getNextCreatureName(combatSummary, 'Aldric');
      expect(result.newActiveName).toBe('Aldric');
      expect(result.roundIncrement).toBe(true);
    });
  });

  describe('getPreviousCreatureName', () => {
    function makeCombatSummary(creatureList) {
      return { creatures: creatureList };
    }

    it('returns the previous creature without round decrement', () => {
      const combatSummary = makeCombatSummary([
        { name: 'Aldric' },
        { name: 'Brenna' },
        { name: 'NPC 1' },
      ]);
      const result = getPreviousCreatureName(combatSummary, 'NPC 1');
      expect(result.newActiveName).toBe('Brenna');
      expect(result.roundDecrement).toBe(false);
    });

    it('wraps to last creature and decrements round at first', () => {
      const combatSummary = makeCombatSummary([
        { name: 'Aldric' },
        { name: 'Brenna' },
      ]);
      const result = getPreviousCreatureName(combatSummary, 'Aldric');
      expect(result.newActiveName).toBe('Brenna');
      expect(result.roundDecrement).toBe(true);
    });

    it('wraps and decrements round for a single creature', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric' }]);
      const result = getPreviousCreatureName(combatSummary, 'Aldric');
      expect(result.newActiveName).toBe('Aldric');
      expect(result.roundDecrement).toBe(true);
    });
  });

  describe('isPreviousDisabled', () => {
    function makeCombatSummary(creatureList, round) {
      return { creatures: creatureList, round: round ?? 1 };
    }

    it('returns false when combatSummary is null or undefined', () => {
      expect(isPreviousDisabled(null, 'Aldric')).toBe(false);
      expect(isPreviousDisabled(undefined, 'Aldric')).toBe(false);
    });

    it('returns false when not on first creature', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric' }, { name: 'Brenna' }]);
      expect(isPreviousDisabled(combatSummary, 'Brenna')).toBe(false);
    });

    it('returns false when round > 1 even on first creature', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric' }], 2);
      expect(isPreviousDisabled(combatSummary, 'Aldric')).toBe(false);
    });

    it('returns true when on first creature and round is 1', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric' }], 1);
      expect(isPreviousDisabled(combatSummary, 'Aldric')).toBe(true);
    });
  });

  describe('setInitiative', () => {
    function makeCombatSummary(creatureList) {
      return { creatures: creatureList };
    }

    it('sets initiative for a creature and sorts by descending value', () => {
      const combatSummary = makeCombatSummary([
        { name: 'Aldric', initiative: '3' },
        { name: 'Brenna', initiative: '7' },
      ]);
      setInitiative(combatSummary, 'Aldric', '9');
      expect(combatSummary.creatures.map(c => c.name)).toEqual(['Aldric', 'Brenna']);
    });

    it('does nothing for a non-existent creature', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric', initiative: '3' }]);
      setInitiative(combatSummary, 'Nonexistent', '5');
      expect(combatSummary.creatures[0].initiative).toBe('3');
    });
  });

  describe('rollNpcInitiative', () => {
    function makeCombatSummary(creatureList) {
      return { creatures: creatureList };
    }

    it('rolls initiative for an NPC and returns the result', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const combatSummary = makeCombatSummary([
        { name: 'Aldric', type: 'player' },
        { name: 'NPC 1', type: 'npc', initiativeBonus: 2 },
      ]);
      const result = rollNpcInitiative(combatSummary, 'NPC 1');
      expect(result.roll).toBe(11);
      expect(result.bonus).toBe(2);
      expect(result.total).toBe(13);
      expect(combatSummary.creatures[1].initiative).toBe('13');
    });

    it('returns null for a player or non-existent creature', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric', type: 'player' }]);
      expect(rollNpcInitiative(combatSummary, 'Aldric')).toBeNull();

      combatSummary.creatures.push({ name: 'NPC 1', type: 'npc' });
      expect(rollNpcInitiative(combatSummary, 'NPC 99')).toBeNull();
    });

    it('uses default initiativeBonus of 0 and sorts after rolling', () => {
      const combatSummary = makeCombatSummary([
        { name: 'NPC 1', type: 'npc', initiative: '15' },
        { name: 'NPC 2', type: 'npc', initiative: '20' },
      ]);
      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      const result = rollNpcInitiative(combatSummary, 'NPC 1');
      expect(result.bonus).toBe(0);
      expect(combatSummary.creatures[0].name).toBe('NPC 1');
    });
  });

  describe('applyNpcMonsterData', () => {
    function makeCombatSummary(creatureList) {
      return { creatures: creatureList };
    }

    it('sets full monster data on a creature', async () => {
      const combatSummary = makeCombatSummary([{ name: 'NPC 1', type: 'npc' }]);
      const monster = {
        armor_class: 15,
        damage_resistances: ['fire'],
        damage_immunities: ['poison'],
        hit_points: 50,
        initiative_details: '+4',
        saving_throws: { str: { modifier: 5 } },
      };
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      const c = combatSummary.creatures[0];
      expect(c.ac).toBe(15);
      expect(c.resistances).toEqual(['fire']);
      expect(c.immunities).toEqual(['poison']);
      expect(c.maxHp).toBe(50);
      expect(c.currentHp).toBe(50);
      expect(c.initiativeBonus).toBe(4);
      expect(c.saveBonuses.str).toBe(5);
    });

    it('defaults AC to 10 when armor_class is not a number, and HP to 10 when absent', async () => {
      const combatSummary = makeCombatSummary([{ name: 'NPC 1', type: 'npc' }]);
      const monster = { armor_class: '15' };
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      expect(combatSummary.creatures[0].ac).toBe(10);
      expect(combatSummary.creatures[0].maxHp).toBe(10);
    });

    it('defaults initiativeBonus to 0 when initiative_details has no match', async () => {
      const combatSummary = makeCombatSummary([{ name: 'NPC 1', type: 'npc' }]);
      const monster = { armor_class: 12, initiative_details: 'flat +2' };
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      expect(combatSummary.creatures[0].initiativeBonus).toBe(0);
    });

    it('handles missing saveBonGracefully and sets empty resistances/immunities', async () => {
      const combatSummary = makeCombatSummary([{ name: 'NPC 1', type: 'npc' }]);
      const monster = { armor_class: 12, hit_points: 20 };
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      const c = combatSummary.creatures[0];
      expect(c.saveBonuses).toBeDefined();
      expect(c.resistances).toEqual([]);
      expect(c.immunities).toEqual([]);
    });

    it('does nothing for a non-existent creature index', async () => {
      const combatSummary = makeCombatSummary([]);
      const monster = { armor_class: 15 };
      await applyNpcMonsterData(combatSummary, 5, monster, []);
      expect(combatSummary.creatures).toEqual([]);
    });

    it('sets imagePath from a matching campaignNpc (case-insensitive)', async () => {
      const combatSummary = makeCombatSummary([{ name: 'goblin', type: 'npc' }]);
      const monster = { armor_class: 12 };
      const campaignNpcs = [{ name: 'Goblin', imagePath: '/images/goblin.png' }];
      await applyNpcMonsterData(combatSummary, 0, monster, campaignNpcs);
      expect(combatSummary.creatures[0].imagePath).toBe('/images/goblin.png');
    });

    it('does not set imagePath when no campaignNpc matches', async () => {
      const combatSummary = makeCombatSummary([{ name: 'goblin', type: 'npc' }]);
      const monster = { armor_class: 12 };
      const campaignNpcs = [{ name: 'Orc', imagePath: '/images/orc.png' }];
      await applyNpcMonsterData(combatSummary, 0, monster, campaignNpcs);
      expect(combatSummary.creatures[0].imagePath).toBeUndefined();
    });
  });

  describe('renameNpc', () => {
    function makeCombatSummary(creatureList) {
      return { creatures: creatureList };
    }

    it('renames the creature and updates monster data from campaignNpc', async () => {
      const combatSummary = makeCombatSummary([
        { name: 'Old Name', type: 'npc' },
      ]);
      const campaignNpcs = [
        { name: 'New Name', armorClass: 15, hitPoints: 30 },
      ];
      const setNpcImages = vi.fn();
      await renameNpc(combatSummary, 'Old Name', 'New Name', campaignNpcs, setNpcImages);
      expect(combatSummary.creatures[0].name).toBe('New Name');
      expect(combatSummary.creatures[0].ac).toBe(15);
      expect(combatSummary.creatures[0].maxHp).toBe(30);
      expect(setNpcImages).toHaveBeenCalledWith(expect.any(Function));
    });

    it('does nothing for a non-existent creature', async () => {
      const combatSummary = makeCombatSummary([{ name: 'NPC 1', type: 'npc' }]);
      await renameNpc(combatSummary, 'Nope', 'New Name', [], undefined);
      expect(combatSummary.creatures[0].name).toBe('NPC 1');
    });
  });

  describe('setTarget', () => {
    function makeCombatSummary(creatureList) {
      return { creatures: creatureList };
    }

    it('sets target for a creature', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric', targetName: null }]);
      setTarget(combatSummary, 'Aldric', 'Goblin');
      expect(combatSummary.creatures[0].targetName).toBe('Goblin');
    });

    it('clears target when value is null', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric', targetName: 'Goblin' }]);
      setTarget(combatSummary, 'Aldric', null);
      expect(combatSummary.creatures[0].targetName).toBeNull();
    });

    it('does nothing for a non-existent creature', () => {
      const combatSummary = makeCombatSummary([{ name: 'Aldric', targetName: 'Goblin' }]);
      setTarget(combatSummary, 'Nonexistent', null);
      expect(combatSummary.creatures[0].targetName).toBe('Goblin');
    });
  });

  describe('clearCombat', () => {
    it('creates a fresh combat summary with round 1 and setup creatures', () => {
      const characters = [{ name: 'Aldric' }, { name: 'Brenna' }];
      const getName = (name) => name;
      const result = clearCombat(characters, 2, getName);

      expect(result.round).toBe(1);
      expect(result.creatures).toHaveLength(4);
      expect(result.creatures.filter(c => c.type === 'player')).toHaveLength(2);
      expect(result.creatures.filter(c => c.type === 'npc')).toHaveLength(2);
    });

    it('resets round to 1 regardless of previous state', () => {
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = clearCombat(characters, 0, getName);
      expect(result.round).toBe(1);
    });
  });

  describe('mergeCombatSummaryWithCharacters', () => {
    function makeSummary(creatureList, round) {
      return { round: round ?? 1, creatures: creatureList };
    }

    function getName(name) {
      return name;
    }

    it('merges initial summary creatures with new player characters, preserving NPC state', () => {
      const initialSummary = makeSummary([
        { name: 'Aldric', type: 'player', initiative: '5', targetName: 'Goblin', concentration: 'spell1' },
        { name: 'NPC 1', type: 'npc', initiative: '3', conditions: ['poisoned'], currentHp: 5, maxHp: 10 },
      ]);
      const characters = [{ name: 'Aldric' }, { name: 'Brenna' }];
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);

      expect(result.round).toBe(1);
      expect(result.creatures).toHaveLength(3);
      const aldric = result.creatures.find(c => c.name === 'Aldric');
      expect(aldric.initiative).toBe('5');
      expect(aldric.targetName).toBe('Goblin');
      expect(aldric.concentration).toBe('spell1');
      const npc1 = result.creatures.find(c => c.name === 'NPC 1');
      expect(npc1.currentHp).toBe(5);
      expect(npc1.conditions).toEqual(['poisoned']);
      const brenna = result.creatures.find(c => c.name === 'Brenna');
      expect(brenna.type).toBe('player');
      expect(brenna.initiative).toBe('');
      expect(brenna.targetName).toBeNull();
      expect(brenna.concentration).toBeNull();
    });

    it('defaults player fields and NPC hp when not in summary', () => {
      const initialSummary = makeSummary([]);
      const characters = [{ name: 'Aldric' }];
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].initiative).toBe('');
      expect(result.creatures[0].targetName).toBeNull();
      expect(result.creatures[0].concentration).toBeNull();
    });

    it('defaults NPC currentHp to maxHp and maxHp to 10 when not set', () => {
      const initialSummary = makeSummary([
        { name: 'NPC 1', type: 'npc', maxHp: 20 },
      ]);
      const result = mergeCombatSummaryWithCharacters(initialSummary, [], getName);
      expect(result.creatures[0].currentHp).toBe(20);
    });

    it('handles empty inputs and preserves round', () => {
      const initialSummary = makeSummary([], 1);
      const characters = [{ name: 'Aldric' }];
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures).toHaveLength(1);
      expect(result.round).toBe(1);
    });

    it('sorts merged creatures alphabetically by name', () => {
      const initialSummary = makeSummary([
        { name: 'Zara', type: 'player', initiative: '', targetName: null, concentration: null },
      ]);
      const characters = [{ name: 'Aldric' }];
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].name).toBe('Aldric');
      expect(result.creatures[1].name).toBe('Zara');
    });

    it('preserves NPC conditions when present', () => {
      const initialSummary = makeSummary([
        { name: 'NPC 1', type: 'npc', conditions: ['poisoned', 'blinded'] },
      ]);
      const result = mergeCombatSummaryWithCharacters(initialSummary, [], getName);
      expect(result.creatures[0].conditions).toEqual(['poisoned', 'blinded']);
    });
  });
});
