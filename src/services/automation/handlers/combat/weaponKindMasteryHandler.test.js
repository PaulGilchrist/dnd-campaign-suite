// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applySelections, WEAPON_KIND_KEY } from './weaponKindMasteryHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makeAction(overrides = {}) {
  return {
    name: 'Weapon Mastery',
    description: 'Select weapon kinds for mastery.',
    automation: {
      type: 'weapon_kind_mastery',
      meleeOnly: false,
      ...overrides.automation,
    },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    proficiency: 3,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('weaponKindMasteryHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WEAPON_KIND_KEY', () => {
    it('is a string constant', () => {
      expect(typeof WEAPON_KIND_KEY).toBe('string');
    });
  });

  describe('handle', () => {
    it('returns modal with full payload when no existing selection', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('weaponKindMastery');
      expect(result.payload).toEqual({
        action,
        playerStats,
        campaignName,
        meleeOnly: false,
        existing: [],
      });
    });

    it('returns modal with meleeOnly=true when action specifies it', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const action = makeAction({ automation: { meleeOnly: true } });

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.meleeOnly).toBe(true);
    });

    it('coerces falsy meleeOnly values to false', async () => {
      const falsyValues = [undefined, null, 0, false];
      for (const meleeOnly of falsyValues) {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
        const action = makeAction({ automation: { meleeOnly } });
        const result = await handle(action, makePlayerStats(), campaignName, mapName);
        expect(result.payload.meleeOnly).toBe(false);
      }
    });

    it('returns modal with pre-existing selection as array', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(['Greataxe', 'Handaxe']);
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('weaponKindMastery');
      expect(result.payload.existing).toEqual(['Greataxe', 'Handaxe']);
    });

    it('treats empty array as no existing selection (shows modal)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.existing).toEqual([]);
    });

    it('treats non-array existing value as no existing selection', async () => {
      runtimeState.getRuntimeValue.mockReturnValue('not-an-array');
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.existing).toEqual([]);
    });
  });

  describe('applySelections', () => {
    it('returns null for invalid inputs', async () => {
      const invalidInputs = [
        [],
        null,
        undefined,
        'Greataxe',
        42,
        { name: 'Greataxe' },
      ];
      for (const input of invalidInputs) {
        const result = await applySelections(input, makePlayerStats(), campaignName);
        expect(result).toBeNull();
      }
    });

    it('stores selections and returns popup confirmation for single weapon', async () => {
      const result = await applySelections(['Greataxe'], makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Weapon Mastery');
      expect(result.payload.description).toBe(
        'Weapon kinds set to: Greataxe. Mastery properties will be available when attacking with these weapons.',
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        WEAPON_KIND_KEY,
        ['Greataxe'],
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Weapon Mastery - Weapon Kinds',
        description: 'Selected weapon kinds: Greataxe',
      });
    });

    it('stores selections and returns popup confirmation for multiple weapons', async () => {
      const result = await applySelections(
        ['Greataxe', 'Handaxe', 'Battleaxe'],
        makePlayerStats(),
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Greataxe');
      expect(result.payload.description).toContain('Handaxe');
      expect(result.payload.description).toContain('Battleaxe');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        WEAPON_KIND_KEY,
        ['Greataxe', 'Handaxe', 'Battleaxe'],
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Weapon Mastery - Weapon Kinds',
        description: 'Selected weapon kinds: Greataxe, Handaxe, Battleaxe',
      });
    });

    it('logs ability_use with correct character name', async () => {
      const playerStats = makePlayerStats({ name: 'Vanguard' });
      await applySelections(['Warhammer'], playerStats, campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Vanguard',
        abilityName: 'Weapon Mastery - Weapon Kinds',
        description: 'Selected weapon kinds: Warhammer',
      });
    });
  });
});
