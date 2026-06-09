import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { npcHasStatBlock } from '../encounters/npcStatBlockUtils.js';
import { rollD20 } from '../dice/diceRoller.js';
import { loadCombatSummary } from '../encounters/combatData.js';
import storage from '../ui/storage.js';
import { addNPCToInitiative } from './npcCombatService.js';

const CAMPAIGN = 'testCampaign';
const defaultNPC = () => ({ name: 'Goblin', armorClass: 12, hitPoints: 7 });

describe('npcCombatService - addNPCToInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npcHasStatBlock.mockReturnValue(true);
    rollD20.mockReturnValue(15);
    loadCombatSummary.mockResolvedValue(null);
    storage.set.mockReset().mockImplementation(() => Promise.resolve());
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  });

  // === Early return — NPC lacks stat block ===

  describe('early return when NPC lacks stat block', () => {
    it('returns undefined when npcHasStatBlock is false', async () => {
      npcHasStatBlock.mockReturnValue(false);
      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(result).toBeUndefined();
      expect(loadCombatSummary).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('does not call onViewInitiative on early return', async () => {
      npcHasStatBlock.mockReturnValue(false);
      const callback = vi.fn();
      await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // === Combat summary initialization ===

  describe('combat summary initialization', () => {
    it('creates a default combatSummary when loadCombatSummary returns null', async () => {
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

  // === Duplicate NPC handling ===

  describe('duplicate NPC check', () => {
    it('returns early and calls onViewInitiative for a duplicate NPC', async () => {
      loadCombatSummary.mockResolvedValue({ round: 1, creatures: [{ type: 'npc', name: 'Goblin' }] });
      const callback = vi.fn();
      await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('returns gracefully without callback when already added', async () => {
      loadCombatSummary.mockResolvedValue({ round: 1, creatures: [{ type: 'npc', name: 'Goblin' }] });
      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(result).toBeUndefined();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('adds NPC even when a PC with the same name exists', async () => {
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

  // === Initiative bonus ===

  describe('initiative bonus', () => {
    it('uses a valid positive bonus', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '+3' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiative).toBe('18'); // 15 + 3
      expect(creature.initiativeBonus).toBe(3);
    });

    it('uses a negative bonus', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: '-2' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiative).toBe('13'); // 15 - 2
    });

    it('defaults bonus to 0 when parseInt fails', async () => {
      await addNPCToInitiative(CAMPAIGN, { ...defaultNPC(), initiativeBonus: 'invalid' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiative).toBe('15'); // 15 + 0
      expect(creature.initiativeBonus).toBe(0);
    });

    it('defaults bonus to 0 when initiativeBonus is undefined', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.initiative).toBe('15');
    });
  });

  // === Creature properties ===

  describe('creature fields', () => {
    it('sets all required default fields on the pushed creature', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const creature = storage.set.mock.calls[0][1].creatures[0];

      expect(creature.type).toBe('npc');
      expect(creature.name).toBe('Goblin');
      expect(creature.targetName).toBeNull();
      expect(creature.conditions).toEqual([]);
      expect(creature.concentration).toBeNull();
      expect(creature.saveBonuses).toEqual({});
    });

    it('defaults AC to 10 and logs error when armorClass is not a number', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Bypass npcHasStatBlock so we get past the early return,
      // but pass an NPC without valid AC to hit the else branch.
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: null });

      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.ac).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith('[AC] NPC "Goblin" has no AC defined. Defaulting to 10.');

      consoleSpy.mockRestore();
    });

    it('uses npc.armorClass when it is a valid number', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(storage.set.mock.calls[0][1].creatures[0].ac).toBe(12);
    });

    it('defaults maxHp and currentHp to 10 when hitPoints is missing', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12 });
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

  // === Image path resolution ===

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
  });

  // === Sorting and persistence ===

  describe('sorting and persistence', () => {
    it('sorts creatures by initiative in descending order', async () => {
      loadCombatSummary.mockResolvedValue({
        round: 1,
        creatures: [{ type: 'npc', name: 'Orc', initiative: 20 }],
      });
      rollD20.mockReturnValue(8); // lower than Orc

      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      const saved = storage.set.mock.calls[0][1];
      expect(saved.creatures[0].name).toBe('Orc');    // higher initiative first
      expect(saved.creatures[1].name).toBe('Goblin'); // lower initiative second
    });

    it('calls storage.set with combatSummary key and campaignName', async () => {
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(storage.set).toHaveBeenCalledWith(
        'combatSummary',
        expect.any(Object),
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

  // === logInitiativeRoll — fetch payload verification ===

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
  });

  // === Resilience to errors ===

  describe('resilience', () => {
    it('does not throw when the logInitiativeRoll fetch fails', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('network error')));

      await expect(addNPCToInitiative(CAMPAIGN, defaultNPC())).resolves.toBeUndefined();
      expect(storage.set).toHaveBeenCalled();
    });
  });
});
