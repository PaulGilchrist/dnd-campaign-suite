// @maintained-by-ai
// Contract tests for the Font of Inspiration automation handler.
// Deterministic: handle(action, playerStats, campaignName) is a pure function of
// (action name, charisma bonus, spell slot maxes, runtime state) → popup payload +
// runtime writes + log entry. Runtime state is mocked as a consistent state map (not
// positional return sequences) so tests stay stable as long as handler behaviour holds.
// Note: the handler's "No spell slots of level N available" branch is defensive dead
// code (findLowestAvailableSpellSlot already guarantees stored > 0 in the same tick),
// so no test constructs that impossible state.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './fontOfInspirationHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'TestBard';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 5,
    abilities: [
      { name: 'Charisma', bonus: 3 },
    ],
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 2,
      spell_slots_level_4: 1,
    },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    automation: {
      type: 'font_of_inspiration',
      ...overrides.automation,
    },
    ...('name' in overrides ? { name: overrides.name } : {}),
  };
}

// Consistent runtime state shared by both reads and writes of a test.
// Keys are runtime store keys (the handler only ever reads one character per call).
function mockRuntimeState(state = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => state[key]);
}

// ── Tests ──────────────────────────────────────────────────────

describe('fontOfInspirationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bardic inspiration at maximum', () => {
    it('returns info popup and writes nothing when uses are at maximum', async () => {
      mockRuntimeState({ bardicInspirationUses: 3 });
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Font of Inspiration');
      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (3/3).'
      );
      expect(result.payload.automation).toEqual(action.automation);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('caps the popup display at max when stored uses exceed max', async () => {
      mockRuntimeState({ bardicInspirationUses: 5 });
      const ps = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 2 }] });

      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (2/2).'
      );
    });

    it('treats null or undefined stored uses as maximum', async () => {
      for (const stored of [null, undefined]) {
        mockRuntimeState({ bardicInspirationUses: stored });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toBe(
          'Font of Inspiration: Bardic Inspiration uses are already at maximum (3/3).'
        );
      }
    });

    it('defaults max to 0 when Charisma ability is missing or undefined', async () => {
      for (const abilities of [[], undefined]) {
        mockRuntimeState({ bardicInspirationUses: 0 });

        const result = await handle(
          makeAction(),
          makePlayerStats({ abilities }),
          campaignName,
          null
        );

        expect(result.payload.description).toBe(
          'Font of Inspiration: Bardic Inspiration uses are already at maximum (0/0).'
        );
      }
    });
  });

  describe('spell slot selection', () => {
    it('returns info popup and writes nothing when every spell slot is expended', async () => {
      mockRuntimeState({
        bardicInspirationUses: 2,
        spell_slots_level_1: 0,
        spell_slots_level_2: 0,
        spell_slots_level_3: 0,
        spell_slots_level_4: 0,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Font of Inspiration: No spell slots available to expend.'
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('expends the lowest available spell slot level, skipping empty lower levels', async () => {
      mockRuntimeState({
        bardicInspirationUses: 2,
        spell_slots_level_1: 0,
        spell_slots_level_2: 0,
        spell_slots_level_3: 2,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        playerName,
        'spell_slots_level_3',
        1,
        campaignName,
      );
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 3 spell slot. Bardic Inspiration uses: 3/3.'
      );
    });

    it('treats null stored slots as full and skips empty lower levels', async () => {
      mockRuntimeState({
        bardicInspirationUses: 1,
        spell_slots_level_1: 0,
        spell_slots_level_2: null,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        playerName,
        'spell_slots_level_2',
        2,
        campaignName,
      );
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 2 spell slot. Bardic Inspiration uses: 2/3.'
      );
    });
  });

  describe('successful font of inspiration', () => {
    it('decrements the spell slot and increments bardic inspiration uses for the given player', async () => {
      const ps = makePlayerStats({ name: 'Eldara the Wise' });
      mockRuntimeState({ bardicInspirationUses: 2, spell_slots_level_1: 4 });

      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'Eldara the Wise',
        'spell_slots_level_1',
        3,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'Eldara the Wise',
        'bardicInspirationUses',
        3,
        campaignName,
      );
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 1 spell slot. Bardic Inspiration uses: 3/3.'
      );
      expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('logs the ability use with correct data', async () => {
      mockRuntimeState({ bardicInspirationUses: 2, spell_slots_level_1: 4 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Font of Inspiration',
        description: 'TestBard used Font of Inspiration: expended a level 1 spell slot to regain 1 Bardic Inspiration use.',
        timestamp: expect.any(Number),
      });
    });

    it('converts string runtime values to numbers', async () => {
      mockRuntimeState({ bardicInspirationUses: '2', spell_slots_level_1: '3' });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        playerName,
        'spell_slots_level_1',
        2,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        playerName,
        'bardicInspirationUses',
        3,
        campaignName,
      );
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 1 spell slot. Bardic Inspiration uses: 3/3.'
      );
    });

    it('treats negative stored bardic inspiration uses as below maximum', async () => {
      mockRuntimeState({ bardicInspirationUses: -1, spell_slots_level_1: 4 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        playerName,
        'bardicInspirationUses',
        0,
        campaignName,
      );
    });
  });

  describe('feature name', () => {
    it('defaults the feature name when action.name is missing or empty', async () => {
      for (const overrides of [{}, { name: '' }]) {
        mockRuntimeState({ bardicInspirationUses: 3 });

        const result = await handle(makeAction(overrides), makePlayerStats(), campaignName, null);

        expect(result.payload.name).toBe('Font of Inspiration');
      }
    });

    it('uses the custom name in popup, description, and log entry', async () => {
      mockRuntimeState({ bardicInspirationUses: 2, spell_slots_level_1: 4 });
      const action = makeAction({ name: 'Inspiration Surge' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('Inspiration Surge');
      expect(result.payload.description).toBe(
        'Inspiration Surge: Expended a level 1 spell slot. Bardic Inspiration uses: 3/3.'
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Inspiration Surge',
        description: 'TestBard used Inspiration Surge: expended a level 1 spell slot to regain 1 Bardic Inspiration use.',
        timestamp: expect.any(Number),
      });
    });
  });
});
