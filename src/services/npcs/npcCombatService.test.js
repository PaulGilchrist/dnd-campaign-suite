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

  // --- Early return: NPC lacks stat block ---

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

  // --- Combat summary initialization ---

  describe('combat summary initialization', () => {
    it('creates a default combatSummary when none exists', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.round).toBe(1);
      expect(saved.creatures.length).toBe(1);
    });

    it('preserves existing round number from combat summary', async () => {
      loadCombatSummary.mockResolvedValue({ round: 5, creatures: [] });
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.round).toBe(5);
    });

    it('preserves existing creatures when summary already exists', async () => {
      loadCombatSummary.mockResolvedValue({ round: 3, creatures: [{ type: 'pc', name: 'Hero' }] });
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.creatures.length).toBe(2);
    });
  });

  // --- Duplicate NPC handling ---

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

  // --- Initiative bonus ---

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

    it('defaults bonus to 0 when parseInt returns NaN', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: 'invalid' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiative).toBe('15');
      expect(creature.initiativeBonus).toBe(0);
    });

    it('defaults bonus to 0 when initiativeBonus is undefined', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiative).toBe('15');
      expect(creature.initiativeBonus).toBe(0);
    });

    it('defaults bonus to 0 when initiativeBonus is an empty string', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiativeBonus).toBe(0);
    });

    it('defaults bonus to 0 when initiativeBonus is null', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: null });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiativeBonus).toBe(0);
    });

    it('defaults bonus to 0 when initiativeBonus is whitespace-only', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '   ' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiativeBonus).toBe(0);
    });
  });

  // --- Creature properties ---

  describe('creature fields', () => {
    it('sets all required default fields on the pushed creature', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const creature = storage.set.mock.calls[0][1].creatures[0];

      expect(creature.type).toBe('npc');
      expect(creature.name).toBe('Goblin');
      expect(creature.targetName).toBeNull();
      expect(creature.concentration).toBeNull();
      expect(creature.saveBonuses).toEqual({});
    });

    it('uses npc.armorClass when it is a valid number', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(storage.set.mock.calls[0][1].creatures[0].ac).toBe(12);
    });

    it('defaults AC to 10 and logs error when armorClass is not a number', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: null });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.ac).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith('[AC] NPC "Goblin" has no AC defined. Defaulting to 10.');
      consoleSpy.mockRestore();
    });

    it('defaults AC to 10 when armorClass is undefined', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin' });
      expect(storage.set.mock.calls[0][1].creatures[0].ac).toBe(10);
      consoleSpy.mockRestore();
    });

    it('defaults AC to 10 when armorClass is a string', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: '12' });
      expect(storage.set.mock.calls[0][1].creatures[0].ac).toBe(10);
      consoleSpy.mockRestore();
    });

    it('defaults maxHp and currentHp to 10 when hitPoints is missing', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12 });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.maxHp).toBe(10);
      expect(creature.currentHp).toBe(10);
    });

    it('uses hitPoints when it is a valid number', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12, hitPoints: 25 });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.maxHp).toBe(25);
      expect(creature.currentHp).toBe(25);
    });

    it('defaults HP to 10 when hitPoints is 0', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12, hitPoints: 0 });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.maxHp).toBe(10);
      expect(creature.currentHp).toBe(10);
    });

    it('defaults HP to 10 when hitPoints is NaN', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12, hitPoints: NaN });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.maxHp).toBe(10);
      expect(creature.currentHp).toBe(10);
    });

    it('carries over damageResistances from NPC', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), damageResistances: ['fire', 'cold'] });
      expect(storage.set.mock.calls[0][1].creatures[0].resistances).toEqual(['fire', 'cold']);
    });

    it('defaults resistances to empty array when missing', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(storage.set.mock.calls[0][1].creatures[0].resistances).toEqual([]);
    });

    it('carries over damageImmunities from NPC', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), damageImmunities: ['poison'] });
      expect(storage.set.mock.calls[0][1].creatures[0].immunities).toEqual(['poison']);
    });

    it('defaults immunities to empty array when missing', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(storage.set.mock.calls[0][1].creatures[0].immunities).toEqual([]);
    });
  });

  // --- Image path resolution ---

  describe('imagePath resolution', () => {
    it('uses npc.imagePath when present', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), imagePath: '/images/goblin.jpg' });
      expect(storage.set.mock.calls[0][1].creatures[0].imagePath).toBe('/images/goblin.jpg');
    });

    it('falls back to npc.image when imagePath is missing', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), image: '/images/goblin.png' });
      expect(storage.set.mock.calls[0][1].creatures[0].imagePath).toBe('/images/goblin.png');
    });

    it('defaults imagePath to empty string when neither property exists', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(storage.set.mock.calls[0][1].creatures[0].imagePath).toBe('');
    });

    it('prefers imagePath over image when both are present', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), imagePath: '/images/goblin.jpg', image: '/images/goblin.png' });
      expect(storage.set.mock.calls[0][1].creatures[0].imagePath).toBe('/images/goblin.jpg');
    });
  });

  // --- Sorting and persistence ---

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

  // --- logInitiativeRoll — fetch payload verification ---

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
      expect(body.mode).toBe('normal');
      expect(body.isNatural20).toBe(false);
      expect(body.isNatural1).toBe(false);
    });

    it('sets isNatural20 to true when roll is 20', async () => {
      rollD20.mockReturnValue(20);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.isNatural20).toBe(true);
      expect(body.isNatural1).toBe(false);
    });

    it('sets isNatural1 to true when roll is 1', async () => {
      rollD20.mockReturnValue(1);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.isNatural1).toBe(true);
      expect(body.isNatural20).toBe(false);
    });

    it('includes the initiative bonus in the log payload', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '+3' });
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.bonus).toBe(3);
    });

    it('includes a timestamp in the log payload', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.timestamp).toBeTypeOf('number');
    });

    it('includes a GUID id in the log payload', async () => {
      rollD20.mockReturnValue(15);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.id).toBe('test-guid');
    });
  });

  // --- Resilience to errors ---

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
