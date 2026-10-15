// @maintained-by-ai
// Handler lane for Protection from Evil and Good (SP-094): deterministic contract
// tests over fully-mocked collaborators. Pins the popup payload, the single merged
// store writes (activeBuffs + warded types), exact targetEffects/combatSummary/
// expiration payloads, skipSync on deactivation writes, and the read-only helpers.
// The buff-entry shape itself is owned by buffToggle.test.js; consumer seams
// (contextBuilder-sync.pfeg, automationImmunities, badges, registry) mock this
// handler and live in their own lanes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, toggleBuff: vi.fn() };
});

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(() => 30),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import {
  handle,
  applyProtectionFromEvilAndGood,
  isProtectionFromEvilAndGoodActive,
  isCreatureWarded,
  getProtectionFromEvilAndGoodWardedTypes,
} from './protectionFromEvilAndGoodHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../../services/ui/logService.js';
import * as combatData from '../../../../services/encounters/combatData.js';
import * as rangeValidation from '../../../../services/rules/combat/rangeValidation.js';
import * as targetResolver from '../../common/targetResolver.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestHero';
const TARGET_NAME = 'Ally1';
const SPELL_NAME = 'Protection from Evil and Good';
const WARDED_TYPES = ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];
const DEFAULT_DURATION = 'Concentration, up to 10 minutes';

const PFEG_BUFF = { name: SPELL_NAME, effect: 'protection_from_evil_and_good' };

function makePlayerStats(overrides = {}) {
  return { name: PLAYER_NAME, ...overrides };
}

function makeAction(automation = {}) {
  return {
    name: SPELL_NAME,
    automation: { type: 'protection_from_evil_and_good', ...automation },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('protectionFromEvilAndGoodHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // Neutral defaults so tests are order-independent.
    targetResolver.resolveMapPositions.mockResolvedValue(null);
    runtimeState.getRuntimeValue.mockReturnValue([]);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    combatData.getCombatSummary.mockReturnValue({ creatures: [] });
    buffToggle.toggleBuff.mockReturnValue({ isActive: false, wasActive: false, buffs: [], targetName: null });
  });

  describe('handle', () => {
    it('returns the full target-selection popup contract for a mapped combat', async () => {
      targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 3, y: 4 } });
      rangeValidation.rangeToFeet.mockReturnValue(60);
      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          { name: PLAYER_NAME, type: 'player' },
          { name: TARGET_NAME, type: 'creature' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'test-map');

      // Caster already in the creature list → included once, unchanged order.
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'protectionFromEvilAndGood_target_selection',
          name: SPELL_NAME,
          creatureTargets: [PLAYER_NAME, TARGET_NAME],
          range: 'Touch',
          rangeFt: 60,
          duration: DEFAULT_DURATION,
          attackerPos: { x: 3, y: 4 },
        },
      });
      expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        'test-map',
        PLAYER_NAME
      );
    });

    it('prepends the caster when absent and skips map resolution without a map', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          { name: TARGET_NAME, type: 'creature' },
          { name: 'OtherCreature', type: 'creature' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual([PLAYER_NAME, TARGET_NAME, 'OtherCreature']);
      expect(result.payload.attackerPos).toBe(null);
      expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });

    it('uses spell.range and spell.duration over defaults', async () => {
      const action = {
        name: SPELL_NAME,
        spell: { range: '30ft', duration: 'Up to 1 hour' },
        automation: { type: 'protection_from_evil_and_good' },
      };
      rangeValidation.rangeToFeet.mockReturnValue(30);

      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('30ft');
      expect(result.payload.range).toBe('30ft');
      expect(result.payload.rangeFt).toBe(30);
      expect(result.payload.duration).toBe('Up to 1 hour');
    });

    it('includes only the caster when there is no combat summary', async () => {
      combatData.getCombatSummary.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual([PLAYER_NAME]);
    });
  });

  describe('applyProtectionFromEvilAndGood', () => {
    it('activates on a new target with single merged writes and exact registrations', async () => {
      const combatSummary = { creatures: [{ name: PLAYER_NAME, type: 'player' }] };
      combatData.getCombatSummary.mockReturnValue(combatSummary);
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const result = await applyProtectionFromEvilAndGood(
        makeAction(),
        makePlayerStats(),
        CAMPAIGN_NAME,
        null,
        TARGET_NAME
      );

      // SP-094: activeBuffs + warded types land in ONE merged store write
      // (no racing per-key toggleBuff POST).
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeObject).toHaveBeenCalledWith(
        TARGET_NAME,
        {
          activeBuffs: [
            expect.objectContaining({
              name: SPELL_NAME,
              effect: 'protection_from_evil_and_good',
              duration: DEFAULT_DURATION,
              castingTime: '1 action',
              sourceCharacter: PLAYER_NAME,
            }),
          ],
          protectionFromEvilAndGoodWardedTypes: WARDED_TYPES,
        },
        CAMPAIGN_NAME
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        combatSummary,
        PLAYER_NAME,
        SPELL_NAME,
        0
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'combatSummary',
        combatSummary,
        CAMPAIGN_NAME
      );
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'combat-summary-updated' })
      );

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [
          { target: TARGET_NAME, effect: 'protection_from_evil_and_good', source: PLAYER_NAME, duration: 'concentration' },
        ],
        CAMPAIGN_NAME
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: PLAYER_NAME,
        targetName: TARGET_NAME,
        effects: [
          { type: 'remove_active_buff', buffName: SPELL_NAME },
          { type: 'remove_target_effect', effectKey: 'protection_from_evil_and_good', source: PLAYER_NAME },
        ],
        campaignName: CAMPAIGN_NAME,
        rounds: Infinity,
        expireOnCreatureName: TARGET_NAME,
      });

      expect(logService.addEntry).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        expect.objectContaining({
          type: 'ability_use',
          characterName: PLAYER_NAME,
          abilityName: SPELL_NAME,
          description: expect.stringContaining('protected against'),
        })
      );

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(SPELL_NAME);
      expect(result.payload.description).toContain(`cast on ${TARGET_NAME}`);
    });

    it('describes self-cast when target equals caster', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: PLAYER_NAME, type: 'player' }],
      });

      const result = await applyProtectionFromEvilAndGood(
        makeAction(),
        makePlayerStats(),
        CAMPAIGN_NAME,
        null,
        PLAYER_NAME
      );

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('self-cast');
    });

    it('deactivates when already active: clears buff, warded types, target effect, and concentration', async () => {
      runtimeState.getRuntimeValue.mockImplementation((key) => {
        if (key === TARGET_NAME) return [PFEG_BUFF];
        if (key === 'campaign') {
          return [
            { target: TARGET_NAME, effect: 'protection_from_evil_and_good', source: PLAYER_NAME },
            { target: 'Other', effect: 'protection_from_evil_and_good', source: 'OtherCaster' },
            { target: TARGET_NAME, effect: 'shield_of_faith' },
          ];
        }
        return [];
      });
      const combatSummary = {
        creatures: [
          { name: PLAYER_NAME, type: 'player', concentration: { spell: SPELL_NAME } },
        ],
      };
      combatData.getCombatSummary.mockReturnValue(combatSummary);

      const result = await applyProtectionFromEvilAndGood(
        makeAction(),
        makePlayerStats(),
        CAMPAIGN_NAME,
        null,
        TARGET_NAME
      );

      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
      // SP-094: buff removed + warded types cleared in ONE merged store write.
      expect(runtimeState.setRuntimeObject).toHaveBeenCalledWith(
        TARGET_NAME,
        { activeBuffs: [], protectionFromEvilAndGoodWardedTypes: [] },
        CAMPAIGN_NAME
      );

      // Only this target's pfeag effect is removed; other entries untouched.
      // skipSync=true because the server already has the data (SSE echo guard).
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [
          { target: 'Other', effect: 'protection_from_evil_and_good', source: 'OtherCaster' },
          { target: TARGET_NAME, effect: 'shield_of_faith' },
        ],
        CAMPAIGN_NAME,
        true
      );

      expect(combatSummary.creatures[0].concentration).toBe(null);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'combatSummary',
        combatSummary,
        CAMPAIGN_NAME
      );

      expect(result.payload.description).toContain('deactivated');
      expect(logService.addEntry).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        expect.objectContaining({
          type: 'ability_use',
          characterName: PLAYER_NAME,
          abilityName: SPELL_NAME,
          description: expect.stringContaining('deactivated'),
        })
      );
    });

    it('does not clear concentration when caster concentrates on another spell', async () => {
      runtimeState.getRuntimeValue.mockImplementation((key) => {
        if (key === TARGET_NAME) return [PFEG_BUFF];
        return [];
      });
      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          { name: PLAYER_NAME, type: 'player', concentration: { spell: 'Other Spell' } },
        ],
      });

      await applyProtectionFromEvilAndGood(
        makeAction(),
        makePlayerStats(),
        CAMPAIGN_NAME,
        null,
        TARGET_NAME
      );

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'campaign',
        'combatSummary',
        expect.anything(),
        CAMPAIGN_NAME
      );
    });

    it('replaces the existing target effect for the same target on activation', async () => {
      runtimeState.getRuntimeValue.mockImplementation((key) => {
        if (key === 'campaign') {
          return [
            { target: TARGET_NAME, effect: 'protection_from_evil_and_good', source: 'OldCaster' },
            { target: 'Other', effect: 'shield_of_faith' },
          ];
        }
        return [];
      });
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: PLAYER_NAME, type: 'player' }],
      });

      await applyProtectionFromEvilAndGood(
        makeAction(),
        makePlayerStats(),
        CAMPAIGN_NAME,
        null,
        TARGET_NAME
      );

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [
          { target: 'Other', effect: 'shield_of_faith' },
          { target: TARGET_NAME, effect: 'protection_from_evil_and_good', source: PLAYER_NAME, duration: 'concentration' },
        ],
        CAMPAIGN_NAME
      );
    });

    it('uses spell.duration and spell.casting_time from action.spell', async () => {
      const action = {
        name: SPELL_NAME,
        spell: { duration: 'Up to 1 hour', casting_time: '1 bonus action' },
        automation: { type: 'protection_from_evil_and_good' },
      };

      await applyProtectionFromEvilAndGood(
        action,
        makePlayerStats(),
        CAMPAIGN_NAME,
        null,
        TARGET_NAME
      );

      expect(runtimeState.setRuntimeObject).toHaveBeenCalledWith(
        TARGET_NAME,
        expect.objectContaining({
          activeBuffs: [
            expect.objectContaining({
              name: SPELL_NAME,
              effect: 'protection_from_evil_and_good',
              duration: 'Up to 1 hour',
              castingTime: '1 bonus action',
            }),
          ],
        }),
        CAMPAIGN_NAME
      );
    });

    it('returns null without any writes when target is missing', async () => {
      for (const target of [null, '']) {
        const result = await applyProtectionFromEvilAndGood(
          makeAction(),
          makePlayerStats(),
          CAMPAIGN_NAME,
          null,
          target
        );

        expect(result).toBeNull();
      }
      expect(runtimeState.setRuntimeObject).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('isProtectionFromEvilAndGoodActive', () => {
    it('returns true only for an exact name+effect buff match', () => {
      runtimeState.getRuntimeValue.mockReturnValue([PFEG_BUFF]);
      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);

      runtimeState.getRuntimeValue.mockReturnValue([]);
      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

      runtimeState.getRuntimeValue.mockReturnValue([
        { name: SPELL_NAME, effect: 'some_other_effect' },
      ]);
      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Other Spell', effect: 'protection_from_evil_and_good' },
      ]);
      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('throws when activeBuffs is not an array and does not validate playerName', () => {
      runtimeState.getRuntimeValue.mockReturnValue('not-an-array');
      expect(() => isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toThrow();

      // playerName is passed straight through to getRuntimeValue — no guard.
      runtimeState.getRuntimeValue.mockReturnValue([PFEG_BUFF]);
      expect(isProtectionFromEvilAndGoodActive('', CAMPAIGN_NAME)).toBe(true);
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('', 'activeBuffs', CAMPAIGN_NAME);
    });
  });

  describe('isCreatureWarded', () => {
    it('matches warded types case-insensitively', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('ABERRATION', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('Undead', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('Humanoid', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
      expect(isCreatureWarded('Dragon', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false for empty ward list, falsy creatureType, or falsy playerName', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);
      for (const creatureType of ['', null, undefined]) {
        expect(isCreatureWarded(creatureType, PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
      }
      for (const playerName of ['', null, undefined]) {
        expect(isCreatureWarded('Aberration', playerName, CAMPAIGN_NAME)).toBe(false);
      }

      runtimeState.getRuntimeValue.mockReturnValue([]);
      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when stored wardedTypes is null or not an array', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

      runtimeState.getRuntimeValue.mockReturnValue('not-an-array');
      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });
  });

  describe('getProtectionFromEvilAndGoodWardedTypes', () => {
    it('returns the stored array read from the warded-types key', () => {
      runtimeState.getRuntimeValue.mockReturnValue(['Aberration', 'Fiend', 'Undead']);

      expect(getProtectionFromEvilAndGoodWardedTypes(PLAYER_NAME, CAMPAIGN_NAME)).toEqual([
        'Aberration',
        'Fiend',
        'Undead',
      ]);
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        PLAYER_NAME,
        'protectionFromEvilAndGoodWardedTypes',
        CAMPAIGN_NAME
      );
    });

    it('returns empty array when stored value is null, undefined, or not an array', () => {
      for (const stored of [null, undefined, 'not-an-array']) {
        runtimeState.getRuntimeValue.mockReturnValue(stored);
        expect(getProtectionFromEvilAndGoodWardedTypes(PLAYER_NAME, CAMPAIGN_NAME)).toEqual([]);
      }
    });
  });
});
