// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { npcHasStatBlock } from '../encounters/npcStatBlockUtils.js';
import { rollD20 } from '../dice/diceRoller.js';
import { loadCombatSummary } from '../encounters/combatData.js';
import storage from '../ui/storage.js';
import { addNPCToInitiative } from './npcCombatService.js';

vi.mock('../encounters/npcStatBlockUtils.js', () => ({
  npcHasStatBlock: vi.fn(),
}));

vi.mock('../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

vi.mock('../encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../ui/utils.js', () => ({
  default: { guid: vi.fn(() => 'test-guid') },
}));

const CAMPAIGN = 'testCampaign';
const defaultNPC = () => ({ name: 'Goblin', armorClass: 12, hitPoints: 7 });

describe('npcCombatService - addNPCToInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npcHasStatBlock.mockReturnValue(true);
    rollD20.mockReturnValue(15);
    loadCombatSummary.mockResolvedValue(null);
    storage.set.mockImplementation(() => Promise.resolve());
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  });

  describe('early return when NPC lacks stat block', () => {
    it('returns undefined without loading combat or persisting', async () => {
      npcHasStatBlock.mockReturnValue(false);
      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(result).toBeUndefined();
      expect(loadCombatSummary).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('does not invoke onViewInitiative callback on early return', async () => {
      npcHasStatBlock.mockReturnValue(false);
      const callback = vi.fn();
      await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('combat summary initialization', () => {
    it('creates a default combatSummary when none exists', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.round).toBe(1);
      expect(saved.creatures.length).toBe(1);
    });

    it('preserves existing round number and creatures from combat summary', async () => {
      loadCombatSummary.mockResolvedValue({ round: 5, creatures: [{ type: 'pc', name: 'Hero' }] });
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.round).toBe(5);
      expect(saved.creatures.length).toBe(2);
    });
  });

  describe('duplicate NPC check', () => {
    it('returns early without persisting when NPC already exists as npc type', async () => {
      loadCombatSummary.mockResolvedValue({ round: 1, creatures: [{ type: 'npc', name: 'Goblin' }] });
      const callback = vi.fn();
      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);
      expect(result).toBeUndefined();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('allows an NPC with the same name but different type (pc)', async () => {
      loadCombatSummary.mockResolvedValue({ round: 1, creatures: [{ type: 'pc', name: 'Goblin' }] });
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.creatures.length).toBe(2);
    });

    it('adds NPC when only NPCs with different names exist', async () => {
      loadCombatSummary.mockResolvedValue({ round: 1, creatures: [{ type: 'npc', name: 'Orc' }] });
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.creatures.length).toBe(2);
    });
  });

  describe('initiative bonus', () => {
    it('adds a positive bonus to the d20 roll', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '+3' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiative).toBe('18');
      expect(creature.initiativeBonus).toBe(3);
    });

    it('subtracts a negative bonus from the d20 roll', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '-2' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiative).toBe('13');
    });

    it('defaults bonus to 0 for invalid, empty, null, whitespace, and undefined values', async () => {
      const invalidValues = ['invalid', '', null, '   ', undefined];
      for (const bonus of invalidValues) {
        await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: bonus });
        const creature = storage.set.mock.calls[0][1].creatures[0];
        expect(creature.initiative).toBe('15');
        expect(creature.initiativeBonus).toBe(0);
      }
    });
  });

  describe('creature fields', () => {
    it('sets all required default fields on the pushed creature', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const creature = storage.set.mock.calls[0][1].creatures[0];

      expect(creature.type).toBe('npc');
      expect(creature.name).toBe('Goblin');
      expect(creature.targetName).toBeNull();
      expect(creature.concentration).toBeNull();
      expect(creature.saveBonuses).toEqual({});
      expect(creature.ac).toBe(12);
      expect(creature.maxHp).toBe(7);
      expect(creature.currentHp).toBe(7);
      expect(creature.resistances).toEqual([]);
      expect(creature.immunities).toEqual([]);
      expect(creature.imagePath).toBe('');
    });

    it('defaults AC to 10 and logs error when armorClass is not a number', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: null });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.ac).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith('[AC] NPC "Goblin" has no AC defined. Defaulting to 10.');
      consoleSpy.mockRestore();
    });

    it('defaults maxHp and currentHp to 10 when hitPoints is missing, 0, NaN, or falsy', async () => {
      const invalidValues = [undefined, 0, NaN];
      for (const hp of invalidValues) {
        await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12, hitPoints: hp });
        const creature = storage.set.mock.calls[0][1].creatures[0];
        expect(creature.maxHp).toBe(10);
        expect(creature.currentHp).toBe(10);
      }
    });

    it('uses hitPoints when it is a valid number', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12, hitPoints: 25 });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.maxHp).toBe(25);
      expect(creature.currentHp).toBe(25);
    });

    it('carries over damageResistances and damageImmunities from NPC', async () => {
      await addNPCToInitiative(CAMPAIGN, {
        ...defaultNPC(),
        damageResistances: ['fire', 'cold'],
        damageImmunities: ['poison'],
      });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.resistances).toEqual(['fire', 'cold']);
      expect(creature.immunities).toEqual(['poison']);
    });

    it('prefers imagePath over image when both are present', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), imagePath: '/images/goblin.jpg', image: '/images/goblin.png' });
      expect(storage.set.mock.calls[0][1].creatures[0].imagePath).toBe('/images/goblin.jpg');
    });
  });

  describe('sorting and persistence', () => {
    it('sorts creatures by initiative in descending order', async () => {
      loadCombatSummary.mockResolvedValue({
        round: 1,
        creatures: [{ type: 'npc', name: 'Orc', initiative: 20 }],
      });
      rollD20.mockReturnValue(8);

      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.creatures[0].name).toBe('Orc');
      expect(saved.creatures[1].name).toBe('Goblin');
    });

    it('calls storage.set with combatSummary key and campaignName', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(storage.set).toHaveBeenCalledWith(
        'combatSummary',
        expect.objectContaining({ round: expect.any(Number), creatures: expect.any(Array) }),
        CAMPAIGN
      );
    });

    it('dispatches the initiative-rolled custom event', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'initiative-rolled' })
      );
      dispatchSpy.mockRestore();
    });

    it('calls onViewInitiative callback after adding a new NPC', async () => {
      const callback = vi.fn();
      await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('logInitiativeRoll fetch payload', () => {
    it('sends correct log payload for a normal roll', async () => {
      rollD20.mockReturnValue(14);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());

      const callArgs = global.fetch.mock.calls[0];
      expect(callArgs[0]).toBe(`/api/campaigns/${encodeURIComponent(CAMPAIGN)}/log`);
      const body = JSON.parse(callArgs[1].body);
      expect(body.type).toBe('roll');
      expect(body.characterName).toBe('Goblin');
      expect(body.rollType).toBe('initiative');
      expect(body.name).toBe('Initiative');
      expect(body.rolls).toEqual([14]);
      expect(body.total).toBe(14);
      expect(body.bonus).toBe(0);
      expect(body.isNatural20).toBe(false);
      expect(body.isNatural1).toBe(false);
    });

    it('sets isNatural20/isNatural1 based on roll value', async () => {
      rollD20.mockReturnValue(20);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      let body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.isNatural20).toBe(true);
      expect(body.isNatural1).toBe(false);

      rollD20.mockReturnValue(1);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      body = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(body.isNatural1).toBe(true);
      expect(body.isNatural20).toBe(false);
    });

    it('includes the initiative bonus in the log payload', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '+3' });
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.bonus).toBe(3);
    });

    it('includes a timestamp and GUID id in the log payload', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.timestamp).toBeTypeOf('number');
      expect(body.id).toBe('test-guid');
    });
  });

  describe('resilience', () => {
    it('does not throw when the logInitiativeRoll fetch fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch = vi.fn(() =>
        Promise.reject(new Error('network error')).catch(() => {})
      );

      await expect(addNPCToInitiative(CAMPAIGN, defaultNPC())).resolves.toBeUndefined();
      expect(storage.set).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
