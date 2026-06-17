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
    it('returns 0 when initiative_details has no match', () => {
      expect(parseInitBonus({ initiative_details: 'flat +2' })).toBe(0);
    });

    it('parses bonus from longer string', () => {
      expect(parseInitBonus({ initiative_details: '+3 initiative' })).toBe(3);
    });

    it('returns positive bonus from match', () => {
      expect(parseInitBonus({ initiative_details: '+4' })).toBe(4);
    });

    it('returns negative bonus from match', () => {
      expect(parseInitBonus({ initiative_details: '-2' })).toBe(-2);
    });
  });

  describe('setupCreatures', () => {
    it('creates player creatures with correct structure', () => {
      const characters = [{ name: 'Aldric' }, { name: 'Brenna' }];
      const getName = (name) => name;
      const result = setupCreatures(characters, 0, getName);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('player');
      expect(result[0].name).toBe('Aldric');
      expect(result[0].initiative).toBe('');
      expect(result[0].targetName).toBeNull();
      expect(result[0].concentration).toBeNull();
    });

    it('sorts creatures alphabetically by name', () => {
      const characters = [{ name: 'Zara' }, { name: 'Aldric' }, { name: 'Mira' }];
      const getName = (name) => name;
      const result = setupCreatures(characters, 0, getName);

      expect(result[0].name).toBe('Aldric');
      expect(result[1].name).toBe('Mira');
      expect(result[2].name).toBe('Zara');
    });

    it('creates NPC creatures with default values', () => {
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = setupCreatures(characters, 2, getName);

      expect(result).toHaveLength(3);
      expect(result[1].type).toBe('npc');
      expect(result[1].name).toBe('NPC 1');
      expect(result[1].ac).toBe(10);
      expect(result[1].maxHp).toBe(10);
      expect(result[1].currentHp).toBe(10);
      expect(result[1].resistances).toEqual([]);
      expect(result[1].immunities).toEqual([]);
      expect(result[1].conditions).toEqual([]);
      expect(result[1].saveBonuses).toEqual({});
    });

    it('names NPCs sequentially', () => {
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = setupCreatures(characters, 3, getName);

      expect(result[1].name).toBe('NPC 1');
      expect(result[2].name).toBe('NPC 2');
      expect(result[3].name).toBe('NPC 3');
    });

    it('handles zero characters', () => {
      const result = setupCreatures([], 1, (name) => name);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('NPC 1');
    });

    it('handles zero NPCs', () => {
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = setupCreatures(characters, 0, getName);
      expect(result).toHaveLength(1);
    });
  });

  describe('addNpc', () => {
    it('adds an NPC with sequential numbering', () => {
      const combatSummary = {
        round: 1,
        creatures: [
          { name: 'NPC 1', type: 'npc' },
          { name: 'NPC 2', type: 'npc' },
        ],
      };
      const result = addNpc(combatSummary);
      expect(result).toBe(3);
      expect(combatSummary.creatures[2].name).toBe('NPC 3');
      expect(combatSummary.creatures[2].type).toBe('npc');
      expect(combatSummary.creatures[2].ac).toBe(10);
      expect(combatSummary.creatures[2].maxHp).toBe(10);
      expect(combatSummary.creatures[2].currentHp).toBe(10);
    });

    it('handles combatSummary with no NPCs', () => {
      const combatSummary = {
        round: 1,
        creatures: [{ name: 'Aldric', type: 'player' }],
      };
      const result = addNpc(combatSummary);
      expect(result).toBe(1);
      expect(combatSummary.creatures[1].name).toBe('NPC 1');
    });
  });

  describe('removeNpc', () => {
    it('removes the specified NPC', () => {
      const combatSummary = {
        round: 1,
        creatures: [
          { name: 'Aldric', type: 'player' },
          { name: 'NPC 1', type: 'npc' },
          { name: 'NPC 2', type: 'npc' },
        ],
      };
      removeNpc(combatSummary, 'NPC 1');
      expect(combatSummary.creatures).toHaveLength(2);
      expect(combatSummary.creatures[1].name).toBe('NPC 2');
    });

    it('does nothing for non-existent NPC', () => {
      const combatSummary = {
        round: 1,
        creatures: [{ name: 'NPC 1', type: 'npc' }],
      };
      removeNpc(combatSummary, 'NPC 99');
      expect(combatSummary.creatures).toHaveLength(1);
    });
  });

  describe('getNextCreatureName', () => {
    it('returns next creature in list', () => {
      const combatSummary = {
        creatures: [
          { name: 'Aldric' },
          { name: 'Brenna' },
          { name: 'NPC 1' },
        ],
      };
      const result = getNextCreatureName(combatSummary, 'Aldric');
      expect(result.newActiveName).toBe('Brenna');
      expect(result.roundIncrement).toBe(false);
    });

    it('wraps to first creature and increments round at last', () => {
      const combatSummary = {
        creatures: [
          { name: 'Aldric' },
          { name: 'Brenna' },
        ],
      };
      const result = getNextCreatureName(combatSummary, 'Brenna');
      expect(result.newActiveName).toBe('Aldric');
      expect(result.roundIncrement).toBe(true);
    });

    it('handles single creature', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric' }],
      };
      const result = getNextCreatureName(combatSummary, 'Aldric');
      expect(result.newActiveName).toBe('Aldric');
      expect(result.roundIncrement).toBe(true);
    });
  });

  describe('getPreviousCreatureName', () => {
    it('returns previous creature in list', () => {
      const combatSummary = {
        creatures: [
          { name: 'Aldric' },
          { name: 'Brenna' },
          { name: 'NPC 1' },
        ],
      };
      const result = getPreviousCreatureName(combatSummary, 'NPC 1');
      expect(result.newActiveName).toBe('Brenna');
      expect(result.roundDecrement).toBe(false);
    });

    it('wraps to last creature at first', () => {
      const combatSummary = {
        creatures: [
          { name: 'Aldric' },
          { name: 'Brenna' },
        ],
      };
      const result = getPreviousCreatureName(combatSummary, 'Aldric');
      expect(result.newActiveName).toBe('Brenna');
      expect(result.roundDecrement).toBe(true);
    });

    it('handles single creature', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric' }],
      };
      const result = getPreviousCreatureName(combatSummary, 'Aldric');
      expect(result.newActiveName).toBe('Aldric');
      expect(result.roundDecrement).toBe(true);
    });
  });

  describe('isPreviousDisabled', () => {
    it('returns false when combatSummary is null', () => {
      expect(isPreviousDisabled(null, 'Aldric')).toBe(false);
    });

    it('returns false when not on first creature', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric' }, { name: 'Brenna' }],
        round: 1,
      };
      expect(isPreviousDisabled(combatSummary, 'Brenna')).toBe(false);
    });

    it('returns false when round > 1', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric' }],
        round: 2,
      };
      expect(isPreviousDisabled(combatSummary, 'Aldric')).toBe(false);
    });

    it('returns true when on first creature and round 1', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric' }],
        round: 1,
      };
      expect(isPreviousDisabled(combatSummary, 'Aldric')).toBe(true);
    });
  });

  describe('setInitiative', () => {
    it('sets initiative for a creature', () => {
      const combatSummary = {
        creatures: [
          { name: 'Aldric', initiative: '' },
          { name: 'Brenna', initiative: '' },
        ],
      };
      setInitiative(combatSummary, 'Aldric', '5');
      expect(combatSummary.creatures[0].initiative).toBe('5');
    });

    it('sorts creatures by initiative descending', () => {
      const combatSummary = {
        creatures: [
          { name: 'Aldric', initiative: '3' },
          { name: 'Brenna', initiative: '7' },
        ],
      };
      setInitiative(combatSummary, 'Aldric', '9');
      expect(combatSummary.creatures[0].name).toBe('Aldric');
      expect(combatSummary.creatures[1].name).toBe('Brenna');
    });

    it('does nothing for non-existent creature', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric', initiative: '3' }],
      };
      setInitiative(combatSummary, 'Nonexistent', '5');
      expect(combatSummary.creatures[0].initiative).toBe('3');
    });
  });

  describe('rollNpcInitiative', () => {
    it('rolls initiative for an NPC', () => {
      const combatSummary = {
        creatures: [
          { name: 'Aldric', type: 'player' },
          { name: 'NPC 1', type: 'npc', initiativeBonus: 2 },
        ],
      };
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = rollNpcInitiative(combatSummary, 'NPC 1');
      expect(result.roll).toBe(11);
      expect(result.bonus).toBe(2);
      expect(result.total).toBe(13);
      expect(combatSummary.creatures[1].initiative).toBe('13');
    });

    it('returns null for non-NPC', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric', type: 'player' }],
      };
      const result = rollNpcInitiative(combatSummary, 'Aldric');
      expect(result).toBeNull();
    });

    it('returns null for non-existent creature', () => {
      const combatSummary = {
        creatures: [{ name: 'NPC 1', type: 'npc' }],
      };
      const result = rollNpcInitiative(combatSummary, 'NPC 99');
      expect(result).toBeNull();
    });

    it('uses default initiativeBonus of 0', () => {
      const combatSummary = {
        creatures: [{ name: 'NPC 1', type: 'npc' }],
      };
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = rollNpcInitiative(combatSummary, 'NPC 1');
      expect(result.bonus).toBe(0);
    });
  });

  describe('applyNpcMonsterData', () => {
    it('sets monster data on creature', async () => {
      const combatSummary = {
        creatures: [
          { name: 'NPC 1', type: 'npc' },
        ],
      };
      const monster = {
        armor_class: 15,
        damage_resistances: ['fire'],
        damage_immunities: ['poison'],
        hit_points: 50,
        initiative_details: '+4',
        saving_throws: { str: { modifier: 5 } },
      };
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      expect(combatSummary.creatures[0].ac).toBe(15);
      expect(combatSummary.creatures[0].resistances).toEqual(['fire']);
      expect(combatSummary.creatures[0].immunities).toEqual(['poison']);
      expect(combatSummary.creatures[0].maxHp).toBe(50);
      expect(combatSummary.creatures[0].currentHp).toBe(50);
      expect(combatSummary.creatures[0].initiativeBonus).toBe(4);
      expect(combatSummary.creatures[0].saveBonuses.str).toBe(5);
    });

    it('defaults AC to 10 when not a number', async () => {
      const combatSummary = {
        creatures: [{ name: 'NPC 1', type: 'npc' }],
      };
      const monster = { armor_class: '15' };
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      expect(combatSummary.creatures[0].ac).toBe(10);
    });

    it('defaults HP to 10 when not defined', async () => {
      const combatSummary = {
        creatures: [{ name: 'NPC 1', type: 'npc' }],
      };
      const monster = {};
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      expect(combatSummary.creatures[0].maxHp).toBe(10);
      expect(combatSummary.creatures[0].currentHp).toBe(10);
    });

    it('defaults initiativeBonus to 0 when no match', async () => {
      const combatSummary = {
        creatures: [{ name: 'NPC 1', type: 'npc' }],
      };
      const monster = { initiative_details: 'flat +2' };
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      expect(combatSummary.creatures[0].initiativeBonus).toBe(0);
    });

    it('handles missing saveBonuses gracefully', async () => {
      const combatSummary = {
        creatures: [{ name: 'NPC 1', type: 'npc' }],
      };
      const monster = {};
      await applyNpcMonsterData(combatSummary, 0, monster, []);
      expect(combatSummary.creatures[0].saveBonuses).toBeDefined();
    });

    it('handles non-existent creature index', async () => {
      const combatSummary = { creatures: [] };
      const monster = { armor_class: 15 };
      await applyNpcMonsterData(combatSummary, 5, monster, []);
      expect(combatSummary.creatures).toEqual([]);
    });

    it('sets imagePath from campaignNpc', async () => {
      const combatSummary = {
        creatures: [{ name: 'goblin', type: 'npc' }],
      };
      const monster = {};
      const campaignNpcs = [{ name: 'Goblin', imagePath: '/images/goblin.png' }];
      await applyNpcMonsterData(combatSummary, 0, monster, campaignNpcs);
      expect(combatSummary.creatures[0].imagePath).toBe('/images/goblin.png');
    });

    it('does not set imagePath when no match', async () => {
      const combatSummary = {
        creatures: [{ name: 'goblin', type: 'npc' }],
      };
      const monster = {};
      const campaignNpcs = [{ name: 'Orc', imagePath: '/images/orc.png' }];
      await applyNpcMonsterData(combatSummary, 0, monster, campaignNpcs);
      expect(combatSummary.creatures[0].imagePath).toBeUndefined();
    });
  });

  describe('setTarget', () => {
    it('sets target for a creature', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric', targetName: null }],
      };
      setTarget(combatSummary, 'Aldric', 'Goblin');
      expect(combatSummary.creatures[0].targetName).toBe('Goblin');
    });

    it('clears target when value is null', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric', targetName: 'Goblin' }],
      };
      setTarget(combatSummary, 'Aldric', null);
      expect(combatSummary.creatures[0].targetName).toBeNull();
    });

    it('does nothing for non-existent creature', () => {
      const combatSummary = {
        creatures: [{ name: 'Aldric', targetName: 'Goblin' }],
      };
      setTarget(combatSummary, 'Nonexistent', null);
      expect(combatSummary.creatures[0].targetName).toBe('Goblin');
    });
  });

  describe('clearCombat', () => {
    it('creates fresh combat summary with setupCreatures', () => {
      const characters = [{ name: 'Aldric' }, { name: 'Brenna' }];
      const getName = (name) => name;
      const result = clearCombat(characters, 2, getName);

      expect(result.round).toBe(1);
      expect(result.creatures).toHaveLength(4);
      expect(result.creatures[0].type).toBe('player');
      expect(result.creatures[2].type).toBe('npc');
    });
  });

  describe('mergeCombatSummaryWithCharacters', () => {
    it('merges initial summary with characters', () => {
      const initialSummary = {
        round: 2,
        creatures: [
          { name: 'Aldric', type: 'player', initiative: '5', targetName: 'Goblin', concentration: 'spell1' },
          { name: 'NPC 1', type: 'npc', initiative: '3', conditions: ['poisoned'], currentHp: 5, maxHp: 10 },
        ],
      };
      const characters = [{ name: 'Aldric' }, { name: 'Brenna' }];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);

      expect(result.round).toBe(2);
      expect(result.creatures).toHaveLength(3);
      expect(result.creatures.find(c => c.name === 'Aldric').initiative).toBe('5');
      expect(result.creatures.find(c => c.name === 'NPC 1').currentHp).toBe(5);
      expect(result.creatures.find(c => c.name === 'Brenna').type).toBe('player');
    });

    it('preserves initiative from initial summary or defaults to empty', () => {
      const initialSummary = {
        round: 1,
        creatures: [
          { name: 'Aldric', type: 'player', initiative: '7', targetName: null, concentration: null },
        ],
      };
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].initiative).toBe('7');
    });

    it('defaults initiative to empty string when not in summary', () => {
      const initialSummary = {
        round: 1,
        creatures: [],
      };
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].initiative).toBe('');
    });

    it('defaults targetName to null when not in summary', () => {
      const initialSummary = {
        round: 1,
        creatures: [],
      };
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].targetName).toBeNull();
    });

    it('defaults concentration to null when not in summary', () => {
      const initialSummary = {
        round: 1,
        creatures: [],
      };
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].concentration).toBeNull();
    });

    it('defaults NPC currentHp to maxHp when not set', () => {
      const initialSummary = {
        round: 1,
        creatures: [
          { name: 'NPC 1', type: 'npc', maxHp: 20 },
        ],
      };
      const characters = [];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].currentHp).toBe(20);
    });

    it('defaults NPC maxHp to 10 when not set', () => {
      const initialSummary = {
        round: 1,
        creatures: [
          { name: 'NPC 1', type: 'npc' },
        ],
      };
      const characters = [];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].maxHp).toBe(10);
      expect(result.creatures[0].currentHp).toBe(10);
    });

    it('sorts merged creatures alphabetically', () => {
      const initialSummary = {
        round: 1,
        creatures: [
          { name: 'Zara', type: 'player', initiative: '', targetName: null, concentration: null },
        ],
      };
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures[0].name).toBe('Aldric');
      expect(result.creatures[1].name).toBe('Zara');
    });

    it('handles empty initial summary', () => {
      const initialSummary = { round: 1, creatures: [] };
      const characters = [{ name: 'Aldric' }];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures).toHaveLength(1);
      expect(result.round).toBe(1);
    });

    it('handles empty characters array', () => {
      const initialSummary = {
        round: 1,
        creatures: [
          { name: 'NPC 1', type: 'npc', initiative: '3' },
        ],
      };
      const characters = [];
      const getName = (name) => name;
      const result = mergeCombatSummaryWithCharacters(initialSummary, characters, getName);
      expect(result.creatures).toHaveLength(1);
    });
  });
});
