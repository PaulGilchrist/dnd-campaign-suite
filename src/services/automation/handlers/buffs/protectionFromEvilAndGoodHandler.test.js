// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import {
  handle,
  isProtectionFromEvilAndGoodActive,
  isCreatureWarded,
} from './protectionFromEvilAndGoodHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestHero';

function makePlayerStats(overrides = {}) {
  return { name: PLAYER_NAME, ...overrides };
}

function makeAction(automation = {}) {
  return {
    name: 'Protection from Evil and Good',
    automation: { type: 'protection_from_evil_and_good', ...automation },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('protectionFromEvilAndGoodHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    describe('toggleBuff interaction', () => {
      it('calls toggleBuff with playerName, buffName, merged effect object, and campaignName on activation', async () => {
        const ps = makePlayerStats();
        const action = makeAction({
          duration: 'Concentration, up to 10 minutes',
          casting_time: '1 action',
          range: 'Touch',
        });
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        await handle(action, ps, CAMPAIGN_NAME, 'test-map');

        expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
          ps.name,
          action.name,
          expect.objectContaining({
            type: 'protection_from_evil_and_good',
            effect: 'protection_from_evil_and_good',
            wardedCreatureTypes: [
              'Aberration',
              'Celestial',
              'Elemental',
              'Fey',
              'Fiend',
              'Undead',
            ],
            duration: 'Concentration, up to 10 minutes',
            casting_time: '1 action',
            range: 'Touch',
          }),
          CAMPAIGN_NAME
        );
      });

      it('overrides effect to protection_from_evil_and_good even if automation specifies a different value', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ effect: 'wrong_effect' });
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        await handle(action, ps, CAMPAIGN_NAME, null);

        expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
          ps.name,
          action.name,
          expect.objectContaining({ effect: 'protection_from_evil_and_good' }),
          CAMPAIGN_NAME
        );
      });

      it('always includes wardedCreatureTypes regardless of automation content', async () => {
        const ps = makePlayerStats();
        const action = makeAction({});
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        await handle(action, ps, CAMPAIGN_NAME, null);

        expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            wardedCreatureTypes: [
              'Aberration',
              'Celestial',
              'Elemental',
              'Fey',
              'Fiend',
              'Undead',
            ],
          }),
          expect.any(String)
        );
      });
    });

    describe('expiration registration', () => {
      it('calls addExpiration on activation (wasActive false)', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        await handle(action, ps, CAMPAIGN_NAME, null);

        expect(expirations.addExpiration).toHaveBeenCalledWith(
          ps.name,
          ps.name,
          [{ type: 'remove_active_buff', buffName: action.name }],
          CAMPAIGN_NAME
        );
      });

      it('does NOT call addExpiration on deactivation (wasActive true)', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

        await handle(action, ps, CAMPAIGN_NAME, null);

        expect(expirations.addExpiration).not.toHaveBeenCalled();
      });
    });

    describe('setRuntimeValue for warded types', () => {
      it('stores WARDED_CREATURE_TYPES on activation', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        await handle(action, ps, CAMPAIGN_NAME, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          ps.name,
          'protectionFromEvilAndGoodWardedTypes',
          ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'],
          CAMPAIGN_NAME
        );
      });

      it('stores empty array on deactivation', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

        await handle(action, ps, CAMPAIGN_NAME, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          ps.name,
          'protectionFromEvilAndGoodWardedTypes',
          [],
          CAMPAIGN_NAME
        );
      });

      it('does NOT call addExpiration when deactivating (setRuntimeValue still called)', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

        await handle(action, ps, CAMPAIGN_NAME, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
      });
    });

    describe('return value on activation', () => {
      it('returns popup with automation_info payload', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
      });

      it('includes buff name in payload', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.payload.name).toBe(action.name);
      });

      it('includes automationType from action.automation.type', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.payload.automationType).toBe('protection_from_evil_and_good');
      });

      it('includes activation description with warded creature mechanics', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.payload.description).toContain('activated');
        expect(result.payload.description).toContain('Disadvantage');
        expect(result.payload.description).toContain('charmed');
        expect(result.payload.description).toContain('frightened');
        expect(result.payload.description).toContain('possessed');
        expect(result.payload.description).toContain('advantage');
      });

      it('uses the action name in the activation description', async () => {
        const ps = makePlayerStats();
        const action = { ...makeAction(), name: 'Custom Buff' };
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.payload.description).toContain('Custom Buff activated');
      });

      it('includes the automation object in payload', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ duration: '10 minutes' });
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.payload.automation).toEqual(action.automation);
      });
    });

    describe('return value on deactivation', () => {
      it('returns popup with automation_info payload', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
      });

      it('includes deactivated description', async () => {
        const ps = makePlayerStats();
        const action = makeAction();
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.payload.description).toBe(
          'Protection from Evil and Good deactivated'
        );
      });

      it('uses the action name in the deactivated description', async () => {
        const ps = makePlayerStats();
        const action = { ...makeAction(), name: 'My Ward' };
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

        const result = await handle(action, ps, CAMPAIGN_NAME, null);

        expect(result.payload.description).toBe('My Ward deactivated');
      });
    });
  });

  describe('isProtectionFromEvilAndGoodActive', () => {
    it('returns true when buff with correct name and effect exists', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
      ]);

      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns true when buff exists among other active buffs', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Rage', effect: 'rage' },
        { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
        { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
      ]);

      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns false when activeBuffs is empty', () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);

      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when buff name matches but effect differs', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'some_other_effect' },
      ]);

      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when effect matches but name differs', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Other Spell', effect: 'protection_from_evil_and_good' },
      ]);

      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('uses playerName to fetch activeBuffs', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
      ]);

      isProtectionFromEvilAndGoodActive('DifferentHero', CAMPAIGN_NAME);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'DifferentHero',
        'activeBuffs',
        CAMPAIGN_NAME
      );
    });
  });

  describe('isCreatureWarded', () => {
    const WARDED_TYPES = ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];

    it('returns true for each warded creature type', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      for (const type of WARDED_TYPES) {
        expect(isCreatureWarded(type, PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      }
    });

    it('returns false for non-warded creature types', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded('Humanoid', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
      expect(isCreatureWarded('Dragon', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
      expect(isCreatureWarded('Monstrosity', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('is case-insensitive for creature type matching', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded('aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('ABERRATION', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('AbErRaTiOn', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns false when no warded types are stored', () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);

      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when creatureType is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded(null, PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when creatureType is undefined', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded(undefined, PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when playerName is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded('Aberration', null, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when playerName is undefined', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded('Aberration', undefined, CAMPAIGN_NAME)).toBe(false);
    });

    it('converts creatureType to string before matching', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded(42, PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });
  });
});
