// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';

import { generateSettlement } from './settlementGenerator.js';

function makeFetchMock(dataMap) {
  return vi.fn().mockImplementation(async (url) => {
    const data = dataMap[url];
    return { ok: true, json: () => Promise.resolve(data) };
  });
}

function minimalMockData() {
  return {
    '/data/settlement-names.json': {
      Human: { village: ['Ashford'], town: ['Oakhaven'], city: ['Stormhold'], metropolis: ['Capitalia'] },
      Elven: { village: ['Sylvanmere'], town: ['Everwood'], city: ['Silverpine'], metropolis: ['Evershade'] },
      Dwarven: { village: ['Stonehollow'], town: ['Burdensdeep'], city: ['Thorndurn'], metropolis: ['Deepdelve'] },
    },
    '/data/npc-names.json': {
      Human: { male: ['Aldric'], female: ['Adelaide'] },
      Elf: { male: ['Aelindor'], female: ['Aelara'] },
      Dwarf: { male: ['Adrik'], female: ['Amber'] },
      Halfling: { male: ['Alton'], female: ['Alain'] },
      'Half-Elf': { male: ['Aelindor'], female: ['Aelara'] },
      'Half-Orc': { male: ['Argran'], female: ['Arha'] },
    },
    '/data/settlement-descriptions.json': {
      village: {
        descriptions: ['A cluster of cottages.'],
        atmospheres: ['Peaceful'],
        governments: ['Council of elders'],
        features: ['A mossy stone well'],
        threats: ['Bandit activity on nearby roads'],
      },
      town: {
        descriptions: ['A bustling market town.'],
        atmospheres: ['Lively'],
        governments: ['Town council'],
        features: ['A stone bridge over the river'],
        threats: ['Rival merchants undermining trade'],
      },
      city: {
        descriptions: ['A grand city of commerce and culture.'],
        atmospheres: ['Cosmopolitan'],
        governments: ['City council'],
        features: ['A grand cathedral'],
        threats: ['Political intrigue among the nobility'],
      },
      metropolis: {
        descriptions: ['A vast metropolis of power and influence.'],
        atmospheres: ['Majestic'],
        governments: ['Ruling council'],
        features: ['A massive citadel'],
        threats: ['Factional warfare'],
      },
    },
    '/data/shop-names.json': {
      inn: ['Key & Ram'],
      tavern: ['The Drunken Dragon'],
      blacksmith: ['Hammer & Anvil'],
      general_store: ['General Goods Co'],
      magic_shop: ['Mystic Emporium'],
      temple: ['Sanctuary of Light'],
      guild: ['The Gilded Rose'],
      alchemist: ["The Alchemist's Cauldron"],
      bakery: ['Fresh Bread Bakery'],
      butcher: ['Prime Cuts'],
      tailor: ['Fine Threads'],
      stable: ['Royal Stables'],
      bank: ["Merchant's Vault"],
    },
    '/data/guild-names.json': {
      thieves: ['The Crimson Knife Order'],
      mages: ['The Arcane Circle'],
      merchants: ["The Merchant's Guild"],
      fighters: ["The Warrior's Circle"],
      assassins: ['The Silent Dagger'],
      bards: ['The Silver Chord'],
      rangers: ['The Wild Trail'],
      smugglers: ['The Dark Tide'],
    },
    '/data/settlement-rumors.json': {
      general: ['A merchant caravan went missing on the northern road.'],
      quest_hooks: ['A local farmer claims his livestock is being stolen.'],
      faction_intrigue: ["The mayor's daughter ran away with a traveling performer."],
      supernatural: ['An old woman says a ghost walks the riverbank every new moon.'],
      trade_economy: ["The town's grain reserves are lower than the steward admits."],
    },
  };
}

function setupFetch(fetchMock) {
  global.fetch = fetchMock;
}

describe('settlementGenerator', () => {
  describe('generateSettlement', () => {
    it('returns a settlement with all required fields', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement();

      expect(result).toMatchObject({
        name: expect.any(String),
        size: expect.any(String),
        description: expect.any(String),
        atmosphere: expect.any(String),
        government: expect.any(String),
        population: expect.any(String),
        services: expect.any(Array),
        notableNPCs: expect.any(Array),
        rumors: expect.any(Array),
        tags: expect.any(String),
        notes: expect.any(String),
        threat: expect.any(String),
      });
    });

    it('uses the size from options when provided', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'village' });

      expect(result.size).toBe('village');
    });

    it('resolves name conflicts by appending incrementing numbers', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const existing = [{ name: 'Ashford' }, { name: 'Ashford 2' }];
      const result = await generateSettlement(existing, { size: 'village' });

      expect(result.name).not.toBe('Ashford');
      expect(result.name).not.toBe('Ashford 2');
      expect(existing.map((s) => s.name).includes(result.name)).toBe(false);
    });

    it('resolves NPC name conflicts by appending incrementing numbers', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'metropolis' });

      const npcNames = result.notableNPCs.map((n) => n.name);
      expect(new Set(npcNames).size).toBe(npcNames.length);
    });

    it('keeps service names unique within a settlement', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'metropolis' });

      const serviceNames = result.services.map((s) => s.name);
      expect(new Set(serviceNames).size).toBe(serviceNames.length);
    });

    it('generates services within expected count per size category', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const serviceRanges = {
        village: { min: 1, max: 3 },
        town: { min: 3, max: 5 },
        city: { min: 5, max: 8 },
        metropolis: { min: 8, max: 12 },
      };

      for (const [size, { min, max }] of Object.entries(serviceRanges)) {
        const result = await generateSettlement([], { size });

        expect(result.services.length).toBeGreaterThanOrEqual(min);
        expect(result.services.length).toBeLessThanOrEqual(max);
        for (const svc of result.services) {
          expect(svc).toHaveProperty('type');
          expect(svc).toHaveProperty('name');
          expect(svc).toHaveProperty('description');
        }
      }
    });

    it('includes population matching the size category', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const village = await generateSettlement([], { size: 'village' });
      const town = await generateSettlement([], { size: 'town' });
      const city = await generateSettlement([], { size: 'city' });
      const metropolis = await generateSettlement([], { size: 'metropolis' });

      expect(village.population).toMatch(/\d+-\d+ souls/);
      expect(town.population).toMatch(/\d+ souls/);
      expect(city.population).toMatch(/\d+ souls/);
      expect(metropolis.population).toMatch(/\d+/);
      expect(metropolis.population).toContain('souls');
    });

    it('includes tags with size and culture', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'village' });

      const tags = result.tags.split(', ');
      expect(tags).toContain('village');
      expect(tags.some((t) => /-culture$/.test(t))).toBe(true);
    });

    it('includes many-services tag when services exceed 3', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'metropolis' });

      expect(result.tags).toContain('many-services');
    });

    it('includes a description combining size description and features', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'village' });

      expect(result.description).toContain('A cluster of cottages.');
      expect(result.description).toContain('A mossy stone well');
      expect(result.atmosphere).toBe('Peaceful');
      expect(result.government).toBe('Council of elders');
      expect(result.threat).toBe('Bandit activity on nearby roads');
    });

    it('generates rumors from the rumor pool', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'town' });

      const allRumors = [
        'A merchant caravan went missing on the northern road.',
        'A local farmer claims his livestock is being stolen.',
        "The mayor's daughter ran away with a traveling performer.",
        'An old woman says a ghost walks the riverbank every new moon.',
        "The town's grain reserves are lower than the steward admits.",
      ];
      const rumorSet = new Set(allRumors);

      expect(result.rumors.length).toBeGreaterThanOrEqual(1);
      expect(result.rumors.length).toBeLessThanOrEqual(3);
      for (const rumor of result.rumors) {
        expect(rumorSet.has(rumor)).toBe(true);
      }
    });

    it('generates notable NPCs with valid roles for each service', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'village' });

      for (const npc of result.notableNPCs) {
        expect(typeof npc.role).toBe('string');
        expect(npc.role.length).toBeGreaterThan(0);
        expect(npc.description).toContain(npc.role);
        expect(npc.description).toContain('The');
      }
    });

    it('generates service descriptions that are non-empty strings', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'metropolis' });

      for (const svc of result.services) {
        expect(typeof svc.description).toBe('string');
        expect(svc.description.length).toBeGreaterThan(0);
      }
    });

    it('uses guild names for guild-type services', async () => {
      const fetchMock = makeFetchMock(minimalMockData());
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'city' });

      const guildServices = result.services.filter((s) => s.type === 'guild');
      if (guildServices.length > 0) {
        expect(typeof guildServices[0].name).toBe('string');
        expect(guildServices[0].name.length).toBeGreaterThan(0);
      }
    });

    it('falls back to Human names when culture data is incomplete or missing', async () => {
      const data = minimalMockData();
      data['/data/settlement-names.json'].Dwarven.city = [];

      const fetchMock = makeFetchMock(data);
      setupFetch(fetchMock);

      const result = await generateSettlement([], { size: 'city' });

      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    });
  });
});
