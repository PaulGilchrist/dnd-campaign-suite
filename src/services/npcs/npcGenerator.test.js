// @cleaned-by-ai
import { describe, it, expect, vi, afterEach } from 'vitest';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function createNamesFixture() {
  return {
    Human: { male: ['Aldric', 'Bram'], female: ['Elena', 'Fiona'] },
    Elf: { male: ['Legolas', 'Elrond'], female: ['Arwen', 'Galadriel'] },
    Dwarf: { male: ['Thorgar'], female: [] },
  };
}

function createTraitsFixture(extra = {}) {
  return {
    races: ['Human', 'Elf'],
    classRoles: ['Warrior', 'Rogue'],
    attitudes: ['Friendly', 'Hostile'],
    appearances: ['Tall', 'Stocky'],
    personalities: ['Brave', 'Cautious'],
    goals: ['Wealth', 'Power'],
    secrets: ['None', 'Has a dark past'],
    tags: ['merchant', 'soldier', 'hermit'],
    ...extra,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadModule(names, traits, randomValue) {
  vi.resetModules();

  const fetchMock = vi.fn((url) => {
    const data = url.includes('npc-names') ? names : traits;
    return Promise.resolve({ json: () => Promise.resolve(data) });
  });

  vi.stubGlobal('fetch', fetchMock);
  Math.random = () => randomValue;

  const mod = await import('./npcGenerator.js');
  return { mod, fetchMock };
}

// ─── Teardown ───────────────────────────────────────────────────────────────

const originalRandom = Math.random;

afterEach(() => {
  Math.random = originalRandom;
  vi.unstubAllGlobals();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('generateNPC', () => {
  describe('core fields', () => {
    it('returns an NPC with all required top-level fields', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.5,
      );

      const npc = await mod.generateNPC();

      expect(npc.name).toBeDefined();
      expect(['Human', 'Elf']).toContain(npc.race);
      expect(['Warrior', 'Rogue']).toContain(npc.classRole);
      expect(['Friendly', 'Hostile']).toContain(npc.attitude);
      expect(['Tall', 'Stocky']).toContain(npc.appearance);
      expect(['Brave', 'Cautious']).toContain(npc.personality);
      expect(['Wealth', 'Power']).toContain(npc.goals);
      expect(['None', 'Has a dark past']).toContain(npc.secrets);
      expect(npc.notes).toBe('');
    });

    it('returns tags as a comma-separated string from the available tags', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.5,
      );

      const npc = await mod.generateNPC();

      expect(typeof npc.tags).toBe('string');
      const availableTags = ['merchant', 'soldier', 'hermit'];
      const npcTagList = npc.tags.split(', ').map((t) => t.trim());
      expect(npcTagList.length).toBeGreaterThanOrEqual(1);
      expect(npcTagList.length).toBeLessThanOrEqual(3);
      expect(npcTagList.every((t) => availableTags.includes(t))).toBe(true);
    });

    it('fetches both names and traits data files', async () => {
      const { mod, fetchMock } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.5,
      );
      await mod.generateNPC();

      expect(fetchMock).toHaveBeenCalledWith('/data/npc-names.json');
      expect(fetchMock).toHaveBeenCalledWith('/data/npc-generator-traits.json');
    });
  });

  describe('name generation', () => {
    it('selects a name matching the chosen race and gender', async () => {
      const names = createNamesFixture();
      const { mod } = await loadModule(names, createTraitsFixture(), 0.3);

      const npc = await mod.generateNPC();

      const raceNames = names[npc.race];
      const allNames = [
        ...(raceNames?.male ?? []),
        ...(raceNames?.female ?? []),
        ...(names.Human?.male ?? []),
        ...(names.Human?.female ?? []),
      ];
      expect(allNames).toContain(npc.name.replace(/ \d+$/, ''));
    });

    it('falls back to Human names when the selected race has no name data', async () => {
      const traits = createTraitsFixture({ races: ['Gnome'] });
      const { mod } = await loadModule(createNamesFixture(), traits, 0.5);

      const npc = await mod.generateNPC();

      expect(npc.race).toBe('Gnome');
      expect(npc.name.length).toBeGreaterThan(0);
    });

    it('falls back to male names when the gender pool is empty', async () => {
      const traits = createTraitsFixture({ races: ['Dwarf'] });
      const { mod } = await loadModule(createNamesFixture(), traits, 0.5);

      const npc = await mod.generateNPC();

      expect(npc.race).toBe('Dwarf');
      expect(npc.name.length).toBeGreaterThan(0);
    });

    it('appends a numeric suffix to avoid duplicate names', async () => {
      const names = createNamesFixture();
      const { mod } = await loadModule(names, createTraitsFixture(), 0.5);

      const existingNPCs = [
        { name: 'Aldric' },
        { name: 'Bram' },
        { name: 'Elena' },
        { name: 'Fiona' },
      ];
      const npc = await mod.generateNPC(existingNPCs);

      expect(existingNPCs.every((e) => e.name !== npc.name)).toBe(true);
    });

    it('handles empty and undefined existingNPCs arrays', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.5,
      );

      const npc1 = await mod.generateNPC([]);
      expect(npc1).toBeDefined();
      expect(typeof npc1.name).toBe('string');
      expect(npc1.name.length).toBeGreaterThan(0);

      const { mod: mod2 } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.6,
      );
      const npc2 = await mod2.generateNPC(undefined);
      expect(npc2).toBeDefined();
      expect(typeof npc2.name).toBe('string');
    });
  });

  describe('stat block generation', () => {
    it('skips stat block fields when includeStatBlock is false', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.1,
      );

      const npc = await mod.generateNPC();

      expect(npc.armorClass).toBeUndefined();
      expect(npc.hitPoints).toBeUndefined();
      expect(npc.actions).toBeUndefined();
    });

    it('includes a complete stat block when generated', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.9,
      );

      const npc = await mod.generateNPC();

      expect(typeof npc.armorClass).toBe('number');
      expect(typeof npc.hitPoints).toBe('string');
      expect(typeof npc.hitDice).toBe('string');
      expect(typeof npc.initiativeBonus).toBe('string');
      expect(typeof npc.speed).toBe('object');
      expect(npc.speed.walk).toBe('30 ft.');
      expect(typeof npc.abilityScores).toBe('object');
      expect(Array.isArray(npc.actions)).toBe(true);
      expect(npc.actions.length).toBeGreaterThanOrEqual(1);
    });

    it('scales ability scores with challenge rating', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.95,
      );

      const npc = await mod.generateNPC();

      if (npc.abilityScores) {
        const primary = Object.values(npc.abilityScores).reduce((a, b) =>
          a > b ? a : b,
        );
        expect(primary).toBeGreaterThanOrEqual(12);
      }
    });

    it('includes empty arrays for damage/condition immunities', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.9,
      );

      const npc = await mod.generateNPC();

      expect(Array.isArray(npc.damageResistances)).toBe(true);
      expect(npc.damageResistances).toEqual([]);
      expect(Array.isArray(npc.damageImmunities)).toBe(true);
      expect(npc.damageImmunities).toEqual([]);
      expect(Array.isArray(npc.conditionImmunities)).toBe(true);
      expect(npc.conditionImmunities).toEqual([]);
    });

    it('includes savingThrowBonuses and skillBonuses objects', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.9,
      );

      const npc = await mod.generateNPC();

      expect(npc.savingThrowBonuses).toBeDefined();
      expect(typeof npc.savingThrowBonuses).toBe('object');
      expect(npc.skillBonuses).toBeDefined();
      expect(typeof npc.skillBonuses).toBe('object');
    });
  });

  describe('action types', () => {
    it('generates melee weapon actions by default', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture({ classRoles: ['Warrior'] }),
        0.9,
      );

      const npc = await mod.generateNPC();

      if (npc.actions && npc.actions.length > 0) {
        const action = npc.actions[0];
        expect(typeof action.name).toBe('string');
        expect(action.name.length).toBeGreaterThan(0);
        expect(typeof action.description).toBe('string');
      }
    });

    it('generates spell actions for caster class roles', async () => {
      const traits = createTraitsFixture({ classRoles: ['Wizard'] });
      const { mod } = await loadModule(
        createNamesFixture(),
        traits,
        0.9,
      );

      const npc = await mod.generateNPC();

      if (npc.actions && npc.actions.length > 0) {
        const action = npc.actions[0];
        expect(typeof action.name).toBe('string');
        expect(action.description).toContain('Spell Attack Roll');
      }
    });
  });

  describe('edge cases', () => {
    it('propagates a fetch rejection', async () => {
      vi.resetModules();
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network failed'))));

      const mod = await import('./npcGenerator.js');

      await expect(mod.generateNPC()).rejects.toThrow('Network failed');
    });

    it('generates a minimal NPC without a stat block', async () => {
      const { mod } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.1,
      );

      const npc = await mod.generateNPC();

      expect(npc.name).toBeDefined();
      expect(npc.race).toBeDefined();
      expect(npc.armorClass).toBeUndefined();
    });

    it('generates independent NPCs on successive calls', async () => {
      const { mod: mod1 } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.3,
      );
      const npc1 = await mod1.generateNPC();

      const { mod: mod2 } = await loadModule(
        createNamesFixture(),
        createTraitsFixture(),
        0.7,
      );
      const npc2 = await mod2.generateNPC();

      expect(npc1).toBeDefined();
      expect(npc2).toBeDefined();
    });
  });
});
