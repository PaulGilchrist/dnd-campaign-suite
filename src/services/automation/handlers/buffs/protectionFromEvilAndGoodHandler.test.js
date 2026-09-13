// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
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
    vi.restoreAllMocks();
  });

  describe('handle', () => {
    it('returns target selection popup with all creatures including caster', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      rangeValidation.rangeToFeet.mockReturnValue(60);
      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          { name: PLAYER_NAME, type: 'player' },
          { name: TARGET_NAME, type: 'creature' },
        ],
      });

      const result = await handle(action, ps, CAMPAIGN_NAME, 'test-map');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('protectionFromEvilAndGood_target_selection');
      expect(result.payload.name).toBe('Protection from Evil and Good');
      expect(result.payload.creatureTargets).toEqual([PLAYER_NAME, TARGET_NAME]);
      expect(result.payload.range).toBe('Touch');
      expect(result.payload.rangeFt).toBe(60);
    });

    it('includes caster at the beginning of the target list', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          { name: TARGET_NAME, type: 'creature' },
          { name: 'OtherCreature', type: 'creature' },
        ],
      });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets[0]).toBe(PLAYER_NAME);
    });

    it('does not duplicate caster when already in creature list', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          { name: PLAYER_NAME, type: 'player' },
          { name: TARGET_NAME, type: 'creature' },
        ],
      });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual([PLAYER_NAME, TARGET_NAME]);
      expect(result.payload.creatureTargets.filter((n) => n === PLAYER_NAME).length).toBe(1);
    });

    it('uses spell.range when provided, falling back to Touch', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Protection from Evil and Good',
        spell: { range: '30ft' },
        automation: { type: 'protection_from_evil_and_good' },
      };

      rangeValidation.rangeToFeet.mockReturnValue(30);
      combatData.getCombatSummary.mockReturnValue({ creatures: [] });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.range).toBe('30ft');
      expect(result.payload.rangeFt).toBe(30);
    });

    it('passes mapName to resolveMapPositions', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      combatData.getCombatSummary.mockReturnValue({ creatures: [] });

      await handle(action, ps, CAMPAIGN_NAME, 'my-map');

      expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        'my-map',
        PLAYER_NAME
      );
    });

    it('sets attackerPos to null when no mapName provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      combatData.getCombatSummary.mockReturnValue({ creatures: [] });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.attackerPos).toBe(null);
    });

    it('handles empty creature list by including only caster', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      combatData.getCombatSummary.mockReturnValue({ creatures: [] });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual([PLAYER_NAME]);
    });

    it('handles missing combatSummary gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      combatData.getCombatSummary.mockReturnValue(null);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual([PLAYER_NAME]);
    });
  });

  describe('applyProtectionFromEvilAndGood', () => {
    it('activates the spell on a new target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: PLAYER_NAME, type: 'player' }],
      });
      rangeValidation.rangeToFeet.mockReturnValue(60);

      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await applyProtectionFromEvilAndGood(
        action,
        ps,
        CAMPAIGN_NAME,
        null,
        TARGET_NAME
      );

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        TARGET_NAME,
        'Protection from Evil and Good',
        expect.objectContaining({
          effect: 'protection_from_evil_and_good',
          wardedCreatureTypes: [
            'Aberration',
            'Celestial',
            'Elemental',
            'Fey',
            'Fiend',
            'Undead',
          ],
        }),
        CAMPAIGN_NAME
      );

      expect(concentrationService.addConcentration).toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: TARGET_NAME,
            effect: 'protection_from_evil_and_good',
            source: PLAYER_NAME,
            duration: 'concentration',
          }),
        ]),
        CAMPAIGN_NAME
      );

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'protectionFromEvilAndGoodWardedTypes',
        [
          'Aberration',
          'Celestial',
          'Elemental',
          'Fey',
          'Fiend',
          'Undead',
        ],
        CAMPAIGN_NAME
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: TARGET_NAME, effects: expect.arrayContaining([
          expect.objectContaining({ type: 'remove_active_buff' }),
          expect.objectContaining({ type: 'remove_target_effect' }),
        ]), campaignName: CAMPAIGN_NAME, rounds: Infinity, expireOnCreatureName: TARGET_NAME });

      expect(logService.addEntry).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        expect.objectContaining({
          type: 'ability_use',
          characterName: PLAYER_NAME,
          abilityName: 'Protection from Evil and Good',
          description: expect.stringContaining('protected against'),
        })
      );

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain(`cast on ${TARGET_NAME}`);
    });

    it('activates with self-cast when target equals caster', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: PLAYER_NAME, type: 'player' }],
      });

      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await applyProtectionFromEvilAndGood(
        action,
        ps,
        CAMPAIGN_NAME,
        null,
        PLAYER_NAME
      );

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('self-cast');
    });

    it('deactivates the spell when already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
      ]);
      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          {
            name: PLAYER_NAME,
            type: 'player',
            concentration: { spell: 'Protection from Evil and Good' },
          },
        ],
      });

      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await applyProtectionFromEvilAndGood(
        action,
        ps,
        CAMPAIGN_NAME,
        null,
        TARGET_NAME
      );

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        TARGET_NAME,
        'Protection from Evil and Good',
        expect.objectContaining({
          wardedCreatureTypes: [],
        }),
        CAMPAIGN_NAME
      );

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'protectionFromEvilAndGoodWardedTypes',
        [],
        CAMPAIGN_NAME
      );

      expect(result.payload.description).toContain('deactivated');
    });

    it('clears concentration when deactivating and caster has concentration on this spell', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
      ]);
      const combatSummary = {
        creatures: [
          {
            name: PLAYER_NAME,
            type: 'player',
            concentration: { spell: 'Protection from Evil and Good' },
          },
        ],
      };
      combatData.getCombatSummary.mockReturnValue(combatSummary);

      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await applyProtectionFromEvilAndGood(action, ps, CAMPAIGN_NAME, null, TARGET_NAME);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'combatSummary',
        expect.objectContaining({
          creatures: expect.arrayContaining([
            expect.objectContaining({
              name: PLAYER_NAME,
              concentration: null,
            }),
          ]),
        }),
        CAMPAIGN_NAME
      );
    });

    it('does not clear concentration when caster does not have concentration on this spell', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
      ]);
      const combatSummary = {
        creatures: [
          {
            name: PLAYER_NAME,
            type: 'player',
            concentration: { spell: 'Other Spell' },
          },
        ],
      };
      combatData.getCombatSummary.mockReturnValue(combatSummary);

      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await applyProtectionFromEvilAndGood(action, ps, CAMPAIGN_NAME, null, TARGET_NAME);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'campaign',
        'combatSummary',
        expect.anything(),
        CAMPAIGN_NAME
      );
    });

    it('returns null when no target is provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyProtectionFromEvilAndGood(
        action,
        ps,
        CAMPAIGN_NAME,
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('returns null when target is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyProtectionFromEvilAndGood(
        action,
        ps,
        CAMPAIGN_NAME,
        null,
        ''
      );

      expect(result).toBeNull();
    });

    it('filters existing target effects before adding new one on activation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockImplementation(
        (_charKey, _prop, camp) => {
          if (camp === CAMPAIGN_NAME && _charKey === 'campaign') {
            return [
              { target: TARGET_NAME, effect: 'protection_from_evil_and_good', source: 'OldCaster' },
              { target: 'Other', effect: 'shield_of_faith' },
            ];
          }
          return [];
        }
      );
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: PLAYER_NAME, type: 'player' }],
      });

      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await applyProtectionFromEvilAndGood(action, ps, CAMPAIGN_NAME, null, TARGET_NAME);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ target: 'Other', effect: 'shield_of_faith' }),
        ]),
        CAMPAIGN_NAME
      );
      // The old pfeag effect for the same target should be filtered out
      const targetEffectsCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'targetEffects'
      );
      const effects = targetEffectsCall[2];
      const pfeagForTarget = effects.filter(
        (e) => e.target === TARGET_NAME && e.effect === 'protection_from_evil_and_good'
      );
      expect(pfeagForTarget).toHaveLength(1);
      expect(pfeagForTarget[0].source).toBe(PLAYER_NAME);
    });

    it('filters out only the matching target effect on deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockImplementation(
        (_charKey, _prop, camp) => {
          if (camp === CAMPAIGN_NAME && _charKey === 'campaign') {
            return [
              { target: TARGET_NAME, effect: 'protection_from_evil_and_good', source: PLAYER_NAME },
              { target: 'Other', effect: 'protection_from_evil_and_good', source: 'OtherCaster' },
              { target: TARGET_NAME, effect: 'shield_of_faith' },
            ];
          }
          if (camp === CAMPAIGN_NAME && _charKey === 'campaign') {
            return [
              { target: TARGET_NAME, effect: 'protection_from_evil_and_good', source: PLAYER_NAME },
              { target: 'Other', effect: 'protection_from_evil_and_good', source: 'OtherCaster' },
            ];
          }
          return [
            { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
          ];
        }
      );
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: PLAYER_NAME, type: 'player' }],
      });

      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await applyProtectionFromEvilAndGood(action, ps, CAMPAIGN_NAME, null, TARGET_NAME);

      const targetEffectsCall = runtimeState.setRuntimeValue.mock.calls.find(
        (call) => call[1] === 'targetEffects'
      );
      if (targetEffectsCall) {
        const effects = targetEffectsCall[2];
        const pfeagForOther = effects.filter(
          (e) => e.target === 'Other' && e.effect === 'protection_from_evil_and_good'
        );
        expect(pfeagForOther).toHaveLength(1);
      }
    });

    it('persists combatSummary to runtime when activating with a combatSummary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockReturnValue([]);
      const combatSummary = {
        creatures: [{ name: PLAYER_NAME, type: 'player' }],
      };
      combatData.getCombatSummary.mockReturnValue(combatSummary);

      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await applyProtectionFromEvilAndGood(action, ps, CAMPAIGN_NAME, null, TARGET_NAME);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'combatSummary',
        combatSummary,
        CAMPAIGN_NAME
      );
    });

    it('uses spell duration from action.spell when provided', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Protection from Evil and Good',
        spell: { duration: 'Up to 1 hour' },
        automation: { type: 'protection_from_evil_and_good' },
      };

      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: PLAYER_NAME, type: 'player' }],
      });

      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await applyProtectionFromEvilAndGood(action, ps, CAMPAIGN_NAME, null, TARGET_NAME);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        TARGET_NAME,
        'Protection from Evil and Good',
        expect.objectContaining({ duration: 'Up to 1 hour' }),
        CAMPAIGN_NAME
      );
    });
  });

  describe('isProtectionFromEvilAndGoodActive', () => {
    it('returns true when buff with correct name and effect exists', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
      ]);

      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns false when activeBuffs is empty or name/effect mismatch', () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);
      expect(isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'some_other_effect' },
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

    it('throws when activeBuffs is not an array', () => {
      runtimeState.getRuntimeValue.mockReturnValue('not-an-array');
      expect(() => isProtectionFromEvilAndGoodActive(PLAYER_NAME, CAMPAIGN_NAME)).toThrow();
    });

    it('does not guard empty string playerName', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
      ]);
      // The function does not validate playerName; it passes it to getRuntimeValue
      expect(() => isProtectionFromEvilAndGoodActive('', CAMPAIGN_NAME)).not.toThrow();
    });
  });

  describe('isCreatureWarded', () => {
    const WARDED_TYPES = [
      'Aberration',
      'Celestial',
      'Elemental',
      'Fey',
      'Fiend',
      'Undead',
    ];

    it('returns true for warded types and false for non-warded, null, or undefined', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);

      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('ABERRATION', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('Celestial', PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
      expect(isCreatureWarded('Humanoid', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
      expect(isCreatureWarded('Dragon', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

      runtimeState.getRuntimeValue.mockReturnValue([]);
      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

      expect(isCreatureWarded(null, PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
      expect(isCreatureWarded(undefined, PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
      expect(isCreatureWarded('Aberration', null, CAMPAIGN_NAME)).toBe(false);
      expect(isCreatureWarded('Aberration', undefined, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when wardedTypes is null or not an array', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

      runtimeState.getRuntimeValue.mockReturnValue('not-an-array');
      expect(isCreatureWarded('Aberration', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when creatureType is empty string', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);
      expect(isCreatureWarded('', PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when playerName is empty string', () => {
      runtimeState.getRuntimeValue.mockReturnValue(WARDED_TYPES);
      expect(isCreatureWarded('Aberration', '', CAMPAIGN_NAME)).toBe(false);
    });
  });

  describe('getProtectionFromEvilAndGoodWardedTypes', () => {
    it('returns the warded types array when stored', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        'Aberration',
        'Fiend',
        'Undead',
      ]);

      const result = getProtectionFromEvilAndGoodWardedTypes(
        PLAYER_NAME,
        CAMPAIGN_NAME
      );

      expect(result).toEqual(['Aberration', 'Fiend', 'Undead']);
    });

    it('returns empty array when stored value is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = getProtectionFromEvilAndGoodWardedTypes(
        PLAYER_NAME,
        CAMPAIGN_NAME
      );

      expect(result).toEqual([]);
    });

    it('returns empty array when stored value is not an array', () => {
      runtimeState.getRuntimeValue.mockReturnValue('not-an-array');

      const result = getProtectionFromEvilAndGoodWardedTypes(
        PLAYER_NAME,
        CAMPAIGN_NAME
      );

      expect(result).toEqual([]);
    });

    it('returns empty array when stored value is undefined', () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = getProtectionFromEvilAndGoodWardedTypes(
        PLAYER_NAME,
        CAMPAIGN_NAME
      );

      expect(result).toEqual([]);
    });
  });
});
