// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { npcHasStatBlock, npcHasAttacks } from '../encounters/npcStatBlockUtils.js';
import { rollD20 } from '../dice/diceRoller.js';
import { loadCombatSummary } from '../encounters/combatData.js';
import storage from '../ui/storage.js';
import { addNPCToInitiative } from './npcCombatService.js';

vi.mock('../encounters/npcStatBlockUtils.js', () => ({
  npcHasStatBlock: vi.fn(),
  npcHasAttacks: vi.fn(),
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
const withAttack = (npc) => ({
  ...npc,
  actions: [{ name: 'Scimitar', attack_bonus: '+4', damage_dice_primary: '1d6', damage_type_primary: 'slashing' }],
});

describe('npcCombatService - addNPCToInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npcHasStatBlock.mockReturnValue(true);
    npcHasAttacks.mockReturnValue(true);
    rollD20.mockReturnValue(15);
    loadCombatSummary.mockResolvedValue(null);
    storage.set.mockImplementation(() => Promise.resolve());
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
    // Default: GM declines the weapon prompt and lets the NPC join anyway.
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hard gate: combat stats required', () => {
    it('throws without loading combat or persisting when the NPC lacks AC and HP', async () => {
      npcHasStatBlock.mockReturnValue(false);
      await expect(addNPCToInitiative(CAMPAIGN, defaultNPC())).rejects.toThrow(/needs AC and HP/);
      expect(loadCombatSummary).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('does not invoke onViewInitiative when the NPC lacks a stat block', async () => {
      npcHasStatBlock.mockReturnValue(false);
      const callback = vi.fn();
      await expect(addNPCToInitiative(CAMPAIGN, defaultNPC(), callback)).rejects.toThrow();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('weapon prompt when the NPC has no attacks', () => {
    it('asks for a weapon when the NPC has no usable attacks', async () => {
      npcHasAttacks.mockReturnValue(false);
      await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(window.confirm.mock.calls[0][0]).toMatch(/no weapons or attacks/i);
    });

    it('returns needs-weapon without persisting when the GM opts to provide a weapon', async () => {
      npcHasAttacks.mockReturnValue(false);
      window.confirm.mockReturnValue(true);
      const callback = vi.fn();
      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);
      expect(result).toBe('needs-weapon');
      expect(storage.set).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    it('adds the NPC anyway when the GM cancels the prompt (unarmed strike fallback)', async () => {
      npcHasAttacks.mockReturnValue(false);
      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC());
      expect(result).toBe('added');
      expect(storage.set).toHaveBeenCalledTimes(1);
    });

    it('does not prompt when the NPC has a usable attack', async () => {
      const result = await addNPCToInitiative(CAMPAIGN, withAttack(defaultNPC()));
      expect(result).toBe('added');
      expect(window.confirm).not.toHaveBeenCalled();
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
    it('returns already without persisting when NPC already exists as npc type', async () => {
      loadCombatSummary.mockResolvedValue({ round: 1, creatures: [{ type: 'npc', name: 'Goblin' }] });
      const callback = vi.fn();
      const result = await addNPCToInitiative(CAMPAIGN, defaultNPC(), callback);
      expect(result).toBe('already');
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

    it('copies AC straight from the NPC — no silent 10 default', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 15, hitPoints: 7 });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.ac).toBe(15);
    });

    it('copies HP straight from the NPC — no silent 10 default', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12, hitPoints: 25 });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.maxHp).toBe(25);
      expect(creature.currentHp).toBe(25);
    });

    it('accepts string HP (the form stores text), coercing once', async () => {
      await addNPCToInitiative(CAMPAIGN, { name: 'Goblin', armorClass: 12, hitPoints: '18' });
      const creature = storage.set.mock.calls[0][1].creatures[0];
      expect(creature.maxHp).toBe(18);
      expect(creature.currentHp).toBe(18);
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

      await expect(addNPCToInitiative(CAMPAIGN, defaultNPC())).resolves.toBe('added');
      expect(storage.set).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
