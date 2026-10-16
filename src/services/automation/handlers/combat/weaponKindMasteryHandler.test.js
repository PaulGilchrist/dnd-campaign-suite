// @maintained-by-ai
// Deterministic unit tests for weaponKindMasteryHandler.js (weapon_kind_mastery modal lane:
// handle() → payload for WeaponKindMasteryModal, applySelections() → runtime write + log).
// Distinct module from the weaponMasteryHandler.* quint (nick/push/postDamage riders) —
// no shared helpers between the two; both depend only on useRuntimeState + logService.

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
    ...overrides,
    automation: {
      type: 'weapon_kind_mastery',
      ...(overrides.automation || {}),
    },
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
    it('pins the exact runtime key (cross-file contract with CharSheet.jsx literal)', () => {
      expect(WEAPON_KIND_KEY).toBe('_Weapon_Kind_Mastery_chosenWeapons');
    });
  });

  describe('handle', () => {
    it('returns modal with full payload when no existing selection', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'weaponKindMastery',
        payload: {
          action,
          playerStats,
          campaignName,
          meleeOnly: false,
          existing: [],
        },
      });
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        WEAPON_KIND_KEY,
        campaignName,
      );
    });

    it('passes meleeOnly through from automation', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const result = await handle(
        makeAction({ automation: { meleeOnly: true } }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.meleeOnly).toBe(true);
    });

    it('passes pre-existing array selections through, including an empty array', async () => {
      for (const existing of [['Greataxe', 'Handaxe'], []]) {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(existing);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.modalName).toBe('weaponKindMastery');
        expect(result.payload.existing).toEqual(existing);
      }
    });

    it('normalizes non-array existing values to an empty array', async () => {
      runtimeState.getRuntimeValue.mockReturnValue('not-an-array');
      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.existing).toEqual([]);
    });
  });

  describe('applySelections', () => {
    it('returns null and writes nothing for invalid inputs', async () => {
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
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('stores selections and returns popup confirmation for single weapon', async () => {
      const result = await applySelections(['Greataxe'], makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description:
            'Weapon kinds set to: Greataxe. Mastery properties will be available when attacking with these weapons.',
        },
      });
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

    it('joins multiple weapon kinds with comma separator in popup and log', async () => {
      const result = await applySelections(
        ['Greataxe', 'Handaxe', 'Battleaxe'],
        makePlayerStats({ name: 'Vanguard' }),
        campaignName,
      );

      expect(result.payload.description).toBe(
        'Weapon kinds set to: Greataxe, Handaxe, Battleaxe. Mastery properties will be available when attacking with these weapons.',
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Vanguard',
        WEAPON_KIND_KEY,
        ['Greataxe', 'Handaxe', 'Battleaxe'],
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Vanguard',
        abilityName: 'Weapon Mastery - Weapon Kinds',
        description: 'Selected weapon kinds: Greataxe, Handaxe, Battleaxe',
      });
    });

    it('still returns the popup when the campaign log write rejects', async () => {
      logService.addEntry.mockRejectedValueOnce(new Error('log down'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await applySelections(['Warhammer'], makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        WEAPON_KIND_KEY,
        ['Warhammer'],
        campaignName,
      );
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });
});
