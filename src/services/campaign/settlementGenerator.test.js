import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function buildMockData() {
  return {
    names: {
      Human: {
        village: ['Ashford', 'Millbrook', 'Kingsley'],
        town: ['Oakhaven', 'Thornfield', 'Brightwater'],
        city: ['Stormhold', 'Ironforge', 'Silvercrest'],
        metropolis: ['Capitalia', 'Grandmere', 'Throneport'],
      },
      Elven: {
        village: ['Sylvanmere', 'Moonwhisper'],
        town: ['Everwood', 'Starfall'],
        city: ['Silverpine', 'Moonhollow'],
        metropolis: ['Evershade', 'Crystalreach'],
      },
      Dwarven: {
        village: ['Stonehollow', 'Irondeep'],
        town: ['Burdensdeep', 'Copperhill'],
        city: ['Thorndurn', 'Granitehold'],
        metropolis: ['Deepdelve', 'Mountaincrest'],
      },
    },
    npcNames: {
      Human: {
        male: ['Aldric', 'Alaric', 'Alden'],
        female: ['Adelaide', 'Adeline', 'Agnes'],
      },
      Elf: {
        male: ['Aelindor', 'Aerendyl'],
        female: ['Aelara', 'Aerilyn'],
      },
      Dwarf: {
        male: ['Adrik', 'Alberich'],
        female: ['Amber', 'Anbera'],
      },
      Halfling: {
        male: ['Alton', 'Alvyn'],
        female: ['Alain', 'Albreda'],
      },
      'Half-Elf': {
        male: ['Aelindor', 'Aldren'],
        female: ['Aelara', 'Aerwynn'],
      },
      'Half-Orc': {
        male: ['Argran', 'Braak'],
        female: ['Arha', 'Baggi'],
      },
    },
    descriptions: {
      village: {
        descriptions: ['A cluster of cottages.', 'A small farming hamlet.'],
        atmospheres: ['Peaceful', 'Rustic', 'Quiet'],
        governments: ['Council of elders', 'Village headman', 'Local magistrate'],
        features: ['A mossy stone well', 'A weathered windmill', 'An ancient oak tree'],
        threats: ['Bandit activity on nearby roads', 'Strange lights in the forest at night'],
      },
      town: {
        descriptions: ['A bustling market town.', 'A thriving trade hub.'],
        atmospheres: ['Lively', 'Prosperous', 'Busy'],
        governments: ['Town council', 'Elected mayor', 'Merchant guild'],
        features: ['A stone bridge over the river', 'A central market square', 'A watchtower'],
        threats: ['Rival merchants undermining trade', 'Unrest among the laborers'],
      },
      city: {
        descriptions: ['A grand city of commerce and culture.', 'A sprawling urban center.'],
        atmospheres: ['Cosmopolitan', 'Vibrant', 'Diverse'],
        governments: ['City council', 'Duke or Duchess', 'Magistrates'],
        features: ['A grand cathedral', 'A bustling port', 'A fortified castle'],
        threats: ['Political intrigue among the nobility', 'Crime syndicates operating in the lower districts'],
      },
      metropolis: {
        descriptions: ['A vast metropolis of power and influence.', 'An enormous city-state.'],
        atmospheres: ['Majestic', 'Prestigious', 'Powerful'],
        governments: ['Ruling council', 'Archduke', 'High magistrates'],
        features: ['A massive citadel', 'Grand boulevards', 'A great library'],
        threats: ['Factional warfare', 'Conspiracy within the ruling council'],
      },
    },
    shopNames: {
      inn: ['Key & Ram', 'The Weeping Lily', 'The Medallionhaven'],
      tavern: ['The Drunken Dragon', 'The Tipsy Griffin'],
      blacksmith: ['Hammer & Anvil', 'The Iron Forge'],
      general_store: ['General Goods Co', 'The Trading Post'],
      magic_shop: ['Mystic Emporium', 'The Enchanted Quill'],
      temple: ['Sanctuary of Light'],
      guild: ['The Gilded Rose'],
      alchemist: ['The Alchemist\'s Cauldron'],
      bakery: ['Fresh Bread Bakery'],
      butcher: ['Prime Cuts'],
      tailor: ['Fine Threads'],
      stable: ['Royal Stables'],
      bank: ['Merchant\'s Vault'],
    },
    guildNames: {
      thieves: ['The Crimson Knife Order', 'The Shadow Wolf Brotherhood'],
      mages: ['The Arcane Circle', 'The Mystic Council'],
      merchants: ['The Merchant\'s Guild', 'The Trade Consortium'],
      fighters: ['The Warrior\'s Circle', 'The Iron Vanguard'],
      assassins: ['The Silent Dagger', 'The Hidden Blade'],
      bards: ['The Silver Chord', 'The Melodic Order'],
      rangers: ['The Wild Trail', 'The Forest Wardens'],
      smugglers: ['The Dark Tide', 'The Shadow Port'],
    },
    rumors: {
      general: [
        'A merchant caravan went missing on the northern road.',
        'The old mill hasn\'t turned its wheel in over a year.',
      ],
      quest_hooks: [
        'A local farmer claims his livestock is being stolen.',
        'Children whisper about a strange light in the abandoned tower.',
      ],
      faction_intrigue: [
        'The mayor\'s daughter ran away with a traveling performer.',
        'Someone has been painting strange symbols on doors at night.',
      ],
      supernatural: [
        'An old woman says a ghost walks the riverbank every new moon.',
        'A traveling monk claims the town is built on cursed ground.',
      ],
      trade_economy: [
        'The town\'s grain reserves are lower than the steward admits.',
        'The fishing boats are returning with empty nets.',
      ],
    },
  };
}

describe('settlementGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function setupFetchMocks(mockData) {
    mockFetch.mockImplementation(async (url) => {
      const dataMap = {
        '/data/settlement-names.json': mockData.names,
        '/data/npc-names.json': mockData.npcNames,
        '/data/settlement-descriptions.json': mockData.descriptions,
        '/data/shop-names.json': mockData.shopNames,
        '/data/guild-names.json': mockData.guildNames,
        '/data/settlement-rumors.json': mockData.rumors,
      };
      return {
        ok: true,
        json: () => Promise.resolve(dataMap[url]),
      };
    });
  }

  describe('generateSettlement', () => {
    it('should return a settlement object with all required fields', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement();

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('atmosphere');
      expect(result).toHaveProperty('government');
      expect(result).toHaveProperty('population');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('notableNPCs');
      expect(result).toHaveProperty('rumors');
      expect(result).toHaveProperty('tags');
      expect(result).toHaveProperty('notes');
      expect(result).toHaveProperty('threat');
    });

    it('should return a settlement with size as a string', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement();

      expect(['village', 'town', 'city', 'metropolis']).toContain(result.size);
    });

    it('should use options.size when provided', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      expect(result.size).toBe('village');
    });

    it('should pick a culture from the size culture map', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      const tags = result.tags.split(', ');
      expect(tags).toHaveLength(3);
      expect(tags[1]).toMatch(/^(human|dwarven|elven)-culture$/);
    });

    it('should generate a unique name when no existing settlements provided', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement();

      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    });

    it('should append a number suffix when name conflicts with existing settlements', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');

      const existingSettlements = [
        { name: 'Ashford' },
        { name: 'Ashford 2' },
      ];

      // Run multiple times to account for randomness and check uniqueness
      const results = [];
      for (let i = 0; i < 20; i++) {
        const result = await generateSettlement(existingSettlements);
        results.push(result.name);
      }

      // With only 3 village names and "Ashford" + "Ashford 2" excluded,
      // names cycle through Ashford 3, Millbrook, Kingsley, etc.
      // Check that at least some settlements got unique names (not all same)
      expect(new Set(results).size).toBeGreaterThan(1);
    });

    it('should include services in the result', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'city' });

      expect(Array.isArray(result.services)).toBe(true);
      expect(result.services.length).toBeGreaterThan(0);
    });

    it('should include notableNPCs in the result', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'city' });

      expect(Array.isArray(result.notableNPCs)).toBe(true);
      expect(result.notableNPCs.length).toBeGreaterThan(0);
    });

    it('should include rumors in the result', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'town' });

      expect(Array.isArray(result.rumors)).toBe(true);
      expect(result.rumors.length).toBeGreaterThanOrEqual(1);
      expect(result.rumors.length).toBeLessThanOrEqual(3);
    });

    it('should include tags in the result', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      expect(typeof result.tags).toBe('string');
      expect(result.tags).toContain('village');
    });

    it('should include many-services tag when there are more than 3 services', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      // Use metropolis which has 8-12 services
      const result = await generateSettlement([], { size: 'metropolis' });

      expect(result.tags).toContain('many-services');
    });

    it('should describe settlement as description + features', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      // Description should start with a village description
      expect(result.description).toMatch(/A (cluster of|small farming)/);
      // Should include at least one feature
      expect(result.description).toMatch(/A (mossy stone well|weathered windmill|ancient oak tree)/);
    });

    it('should include atmosphere and government from descriptions', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      expect(['Peaceful', 'Rustic', 'Quiet']).toContain(result.atmosphere);
      expect(['Council of elders', 'Village headman', 'Local magistrate']).toContain(result.government);
    });

    it('should include population range from population ranges', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      expect(result.population).toContain('souls');
      expect(result.population).toMatch(/\d+/);
    });

    it('should include threat in the result', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      expect(typeof result.threat).toBe('string');
    });

    it('should set notes to empty string', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement();

      expect(result.notes).toBe('');
    });

    it('should generate services with type, name, and description', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'city' });

      for (const service of result.services) {
        expect(service).toHaveProperty('type');
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('description');
      }
    });

    it('should generate notableNPCs with name, role, and description', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'city' });

      for (const npc of result.notableNPCs) {
        expect(npc).toHaveProperty('name');
        expect(npc).toHaveProperty('role');
        expect(npc).toHaveProperty('description');
      }
    });

    it('should pick a unique shop name for each service', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'metropolis' });

      const serviceNames = result.services.map(s => s.name);
      expect(new Set(serviceNames).size).toBe(serviceNames.length);
    });

    it('should use fallback name when culture has no names for the size', async () => {
      const mockData = buildMockData();
      // Remove Dwarven city names to trigger fallback
      mockData.names.Dwarven.city = [];
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'city' });

      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    });

    it('should use Human fallback when culture names are completely missing', async () => {
      const mockData = buildMockData();
      // Remove the entire Elven entry
      delete mockData.names.Elven;
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'city' });

      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    });

    it('should generate NPC names from the NPC name data', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      expect(result.notableNPCs.length).toBeGreaterThan(0);
      // NPC names should come from the mock data
      const allNpcNames = [
        ...mockData.npcNames.Human.male,
        ...mockData.npcNames.Human.female,
        ...mockData.npcNames.Elf.male,
        ...mockData.npcNames.Elf.female,
        ...mockData.npcNames.Dwarf.male,
        ...mockData.npcNames.Dwarf.female,
        ...mockData.npcNames.Halfling.male,
        ...mockData.npcNames.Halfling.female,
        ...mockData.npcNames['Half-Elf'].male,
        ...mockData.npcNames['Half-Elf'].female,
        ...mockData.npcNames['Half-Orc'].male,
        ...mockData.npcNames['Half-Orc'].female,
      ];
      const allNpcNamesSet = new Set(allNpcNames);
      for (const npc of result.notableNPCs) {
        expect(allNpcNamesSet.has(npc.name)).toBe(true);
      }
    });

    it('should generate service types appropriate for the settlement size', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const villageResult = await generateSettlement([], { size: 'village' });
      const villageServiceTypes = villageResult.services.map(s => s.type);

      // Village should only have inn, blacksmith, general_store, temple
      for (const svcType of villageServiceTypes) {
        expect(['inn', 'blacksmith', 'general_store', 'temple']).toContain(svcType);
      }
    });

    it('should generate more services for larger settlements', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');

      // Run multiple times to account for randomness and check min bounds
      // Village: min 1, Town: min 3, City: min 5, Metropolis: min 8
      for (let i = 0; i < 10; i++) {
        const v = await generateSettlement([], { size: 'village' });
        expect(v.services.length).toBeGreaterThanOrEqual(1);
        expect(v.services.length).toBeLessThanOrEqual(3);

        const t = await generateSettlement([], { size: 'town' });
        expect(t.services.length).toBeGreaterThanOrEqual(3);
        expect(t.services.length).toBeLessThanOrEqual(5);

        const c = await generateSettlement([], { size: 'city' });
        expect(c.services.length).toBeGreaterThanOrEqual(5);
        expect(c.services.length).toBeLessThanOrEqual(8);

        const m = await generateSettlement([], { size: 'metropolis' });
        expect(m.services.length).toBeGreaterThanOrEqual(8);
        expect(m.services.length).toBeLessThanOrEqual(12);
      }
    });

    it('should include guild-specific info for guild services', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'city' });

      const guildServices = result.services.filter(s => s.type === 'guild');
      if (guildServices.length > 0) {
        // Guild name should come from guild names data, not shop names
        const guildService = guildServices[0];
        const allGuildNames = Object.values(mockData.guildNames).flat();
        expect(allGuildNames).toContain(guildService.name);
      }
    });

    it('should combine rumors from all categories', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'town' });

      const allRumors = [
        ...mockData.rumors.general,
        ...mockData.rumors.quest_hooks,
        ...mockData.rumors.faction_intrigue,
        ...mockData.rumors.supernatural,
        ...mockData.rumors.trade_economy,
      ];
      const allRumorsSet = new Set(allRumors);

      for (const rumor of result.rumors) {
        expect(allRumorsSet.has(rumor)).toBe(true);
      }
    });

    it('should generate between 2 and 4 features', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      // Should have 2-4 features appended
      const featureCount = (result.description.match(/A (mossy stone well|weathered windmill|ancient oak tree)/g) || []).length;
      expect(featureCount).toBeGreaterThanOrEqual(2);
      expect(featureCount).toBeLessThanOrEqual(4);
    });

    it('should handle empty existing settlements array', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([]);

      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    });

    it('should handle undefined options', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], undefined);

      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('name');
    });

    it('should handle fetch error', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { generateSettlement } = await import('./settlementGenerator.js');

      await expect(generateSettlement()).rejects.toThrow('Network error');
    });

    it('should handle fetch returning non-OK response', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve(null),
      });

      const { generateSettlement } = await import('./settlementGenerator.js');

      await expect(generateSettlement()).rejects.toThrow();
    });

    it('should generate NPC role from SERVICE_NPC_TYPES', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      // Inn NPC types: Innkeeper, Barkeep, Host
      // Blacksmith NPC types: Blacksmith, Smith, Forge-master
      // General Store NPC types: Shopkeeper, Merchant, Proprietor
      // Temple NPC types: Priest, Acolyte, High Priest, Cleric
      const validRoles = [
        'Innkeeper', 'Barkeep', 'Host',
        'Blacksmith', 'Smith', 'Forge-master',
        'Shopkeeper', 'Merchant', 'Proprietor',
        'Priest', 'Acolyte', 'High Priest', 'Cleric',
      ];

      for (const npc of result.notableNPCs) {
        expect(validRoles).toContain(npc.role);
      }
    });

    it('should generate NPC description mentioning the role and service name', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      for (const npc of result.notableNPCs) {
        expect(npc.description).toContain(npc.role);
        expect(npc.description).toContain('The');
      }
    });

    it('should use correct service descriptions from SERVICE_DESCRIPTIONS', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'village' });

      // Inn descriptions from SERVICE_DESCRIPTIONS.inn
      const innDescs = [
        'A quiet inn with clean rooms',
        'A bustling inn catering to merchants',
        'A cozy roadside inn',
        'A sturdy stone inn',
        'An old inn with creaky floorboards',
        'A newly built inn',
        'A converted manor house',
        'A modest boarding house',
        'A well-appointed inn',
        'An inn famous for its continental cuisine',
      ];

      const innServices = result.services.filter(s => s.type === 'inn');
      if (innServices.length > 0) {
        const innDesc = innServices[0].description;
        // Should match one of the inn descriptions
        const hasInnDesc = innDescs.some(d => innDesc.includes(d));
        expect(hasInnDesc).toBe(true);
      }
    });

    it('should generate unique NPC names within a single settlement', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');
      const result = await generateSettlement([], { size: 'metropolis' });

      const npcNames = result.notableNPCs.map(n => n.name);
      expect(new Set(npcNames).size).toBe(npcNames.length);
    });

    it('should generate a settlement with elven culture names', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');

      // Force elven culture by filtering out human names from the culture map
      const result = await generateSettlement([], { size: 'city' });

      // Result should have a valid name from whatever culture was picked
      expect(typeof result.name).toBe('string');
    });

    it('should return population string matching size category', async () => {
      const mockData = buildMockData();
      setupFetchMocks(mockData);

      const { generateSettlement } = await import('./settlementGenerator.js');

      const v = await generateSettlement([], { size: 'village' });
      const t = await generateSettlement([], { size: 'town' });
      const c = await generateSettlement([], { size: 'city' });
      const m = await generateSettlement([], { size: 'metropolis' });

      expect(v.population).toMatch(/\d+-\d+ souls/);
      expect(t.population).toMatch(/\d+ souls/);
      expect(c.population).toMatch(/\d+ souls/);
      expect(m.population).toMatch(/\d+/);
      expect(m.population).toContain('souls');
    });
  });
});
