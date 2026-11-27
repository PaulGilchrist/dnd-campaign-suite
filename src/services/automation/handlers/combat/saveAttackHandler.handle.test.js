// @maintained-by-ai 2026-11-27
// Deterministic unit contract for handle()'s resource-cost
// consumption and variable damage/shape resolution (channel divinity & wild shape
// refusal popups, optionDetails merging, area-effect expiration, AoE-modal overlay
// lane incl. the awaited-getCombatContext regression pin). Pure logic
// through module-boundary mocks; stable unless runtime keys, popup copy, modal
// names, or payload shape change. isExhausted() booleans live in
// saveAttackHandler.exhausted.test.js; heal/condition/effect/damage-roll routing
// in saveAttackHandler.handle-2.test.js — do not cross-remove.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getAttackerTargetName: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
  resolveUses: vi.fn(),
  resolveScaling: vi.fn(),
}));

// overlayTargetId is a pure string parser — keep it REAL so the overlay-id
// round-trip (armed targetName → id looked up in fetched rows) is exercised;
// only the network fetch is mocked.
vi.mock('../../../maps/spellOverlayService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchSpellOverlays: vi.fn() };
});

// ── Imports ────────────────────────────────────────────────────

import { handle } from './saveAttackHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as spellOverlayService from '../../../maps/spellOverlayService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Breath Weapon',
    automation: {
      type: 'save_attack',
      ...automation,
    },
  };
}

// Argument-keyed re-seed for getRuntimeValue (no call-order *Once chains):
// only the named runtime keys return their values, everything else reads null.
// Option key for 'Breath Weapon' is '_Breath_Weapon_option' (applyOptionDetails).
function seedRuntime(entries = {}) {
  runtimeState.getRuntimeValue.mockImplementation((_name, key) =>
    Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null
  );
}

// Full-shape AoE modal expectation shared by the shape/option routing tests.
function expectAoeModal(result, action, playerStats, overrides = {}) {
  expect(result).toEqual({
    type: 'modal',
    modalName: 'saveAttackAoe',
    payload: {
      action,
      playerStats,
      campaignName,
      shape: 'cone',
      range: 30,
      damage: '1d8',
      damageType: '',
      saveType: 'DEX',
      saveDc: 13,
      dcSuccess: 'half',
      activeOverlay: null,
      ...overrides,
    },
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('saveAttackHandler - handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getAttackerTargetName.mockReturnValue(null);
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('handle - variable damage type', () => {
    it.each([
      { title: 'from subrace when variable', damageType: 'variable', subrace: { damage_resistance: 'fire' }, expected: 'fire' },
      { title: 'explicit kept despite subrace', damageType: 'lightning', subrace: { damage_resistance: 'fire' }, expected: 'lightning' },
      { title: 'variable kept when no subrace damage_resistance', damageType: 'variable', subrace: undefined, expected: 'variable' },
    ])('resolves damage type $title', async ({ damageType, subrace, expected }) => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });

      const ps = makePlayerStats(subrace ? { race: { subrace } } : {});
      const result = await handle(makeAction({ damageType, damage: '2d6' }), ps, campaignName, null);

      expect(result.type).toBe('roll');
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d6');
      expect(result.payload.contextConfig).toEqual({
        damageType: expected,
        saveDc: 13,
        saveType: 'DEX',
        dcSuccess: 'none',
        attackerName: 'TestCaster',
        conditionInflicted: null,
        shape: '',
      });
    });
  });

  describe('handle - variable shape resolution', () => {
    it.each([
      { title: 'without optionDetails', options: {} },
      // hasOptions but nothing chosen yet → still the cone fallback
      { title: 'with unchosen optionDetails', options: { hasOptions: true, optionDetails: { line: { shape: 'line' } } } },
    ])('falls back to cone for variable shape $title', async ({ options }) => {
      const action = makeAction({ shape: 'variable', damage: '1d8', ...options });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expectAoeModal(result, action, ps);
    });

    it('merges the chosen optionDetails over the base automation', async () => {
      seedRuntime({ _Breath_Weapon_option: 'line' });
      // The merged option overrides BOTH the variable shape and the base damage.
      const action = makeAction({
        shape: 'variable',
        damage: '1d8',
        hasOptions: true,
        optionDetails: {
          cone: { shape: 'cone' },
          line: { shape: 'line', damage: '6d6' },
        },
      });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expectAoeModal(result, action, ps, { shape: 'line', damage: '6d6', dcSuccess: 'none' });
    });
  });

  describe('handle - AoE modal overlay lane (awaited getCombatContext)', () => {
    // buildAoeModal must AWAIT getCombatContext (async damageUtils export) before
    // reading the attacker cs row target: without the await `cs` is a Promise,
    // getAttackerTargetName resolves nothing, and payload.activeOverlay is always
    // null — the overlay picker lane silently degrades to the fallback face.
    // Regression pin for bug-saveattackhandler-aoe-modal-missing-await-getcombatcontext.
    it('ships the live overlay row by reference on activeOverlay', async () => {
      const cs = { creatures: [{ name: 'TestCaster', targetName: 'overlay-zz1' }] };
      const overlay = { id: 'zz1', shape: 'sphere', startGridX: 4, startGridY: 4, radiusFt: 20 };
      damageUtils.getCombatContext.mockResolvedValue(cs);
      damageUtils.getAttackerTargetName.mockImplementation((ctx) => ctx === cs ? 'overlay-zz1' : null);
      spellOverlayService.fetchSpellOverlays.mockResolvedValue([overlay]);

      const result = await handle(makeAction({ shape: 'cone', damage: '1d8' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackAoe');
      // The RESOLVED context (not a pending Promise) is handed to the reader,
      // and the real overlayTargetId parsed exactly one id from it.
      expect(damageUtils.getAttackerTargetName).toHaveBeenCalledWith(cs, 'TestCaster');
      expect(spellOverlayService.fetchSpellOverlays).toHaveBeenCalledTimes(1);
      expect(spellOverlayService.fetchSpellOverlays).toHaveBeenCalledWith(campaignName);
      // The overlay ships BY REFERENCE — identity, not a copy.
      expect(result.payload.activeOverlay).toBe(overlay);
    });

    it('ships activeOverlay null when the armed id matches no live row', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestCaster', targetName: 'overlay-gone' }] });
      damageUtils.getAttackerTargetName.mockReturnValue('overlay-gone');
      spellOverlayService.fetchSpellOverlays.mockResolvedValue([]);

      const result = await handle(makeAction({ shape: 'cone', damage: '1d8' }), makePlayerStats(), campaignName, null);

      expect(result.modalName).toBe('saveAttackAoe');
      expect(result.payload.activeOverlay).toBe(null);
    });

    it('ships activeOverlay null for a non-overlay-armed attacker without fetching', async () => {
      damageUtils.getAttackerTargetName.mockReturnValue('Victim One');

      const result = await handle(makeAction({ shape: 'cone', damage: '1d8' }), makePlayerStats(), campaignName, null);

      expect(result.modalName).toBe('saveAttackAoe');
      expect(result.payload.activeOverlay).toBe(null);
      expect(spellOverlayService.fetchSpellOverlays).not.toHaveBeenCalled();
    });
  });

  describe('handle - resource cost refusal and consumption', () => {
    // NOTE: consumeChannelDivinity looks up class data POSITIONALLY at
    // class_levels[level - 1], so those fixtures use level 1 with the entry at
    // index 0 (wild shape fixtures resolve via find by level).
    it.each([
      {
        title: 'no channel divinity charges',
        ps: { level: 1, class: { class_levels: [{ level: 1, channel_divinity: 2 }] } },
        automation: { resourceCost: 'channel_divinity' },
        seed: { channelDivinityCharges: 0 },
        description: 'No Channel Divinity charges remaining.',
      },
      {
        title: 'insufficient wild shape uses (singular copy)',
        ps: { class: { class_levels: [{ level: 5, wild_shape: 1 }] } },
        automation: { resourceCost: 'wild_shape' },
        seed: { wildShapeUses: 0 },
        description: 'Breath Weapon: Not enough Wild Shape uses remaining. 1 use required.',
      },
      {
        title: 'doubleEmanation requires 2 uses (plural copy)',
        ps: { class: { class_levels: [{ level: 5, wild_shape: 2 }] } },
        automation: { resourceCost: 'wild_shape', doubleEmanation: true },
        seed: { wildShapeUses: 1 },
        description: 'Breath Weapon: Not enough Wild Shape uses remaining. 2 uses required.',
      },
    ])('refuses with full popup and spends nothing when $title', async ({ ps: psOverrides, automation, seed, description }) => {
      seedRuntime(seed);

      const action = makeAction(automation);
      const result = await handle(action, makePlayerStats(psOverrides), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Breath Weapon',
          description,
          automation: action.automation,
        },
      });
      // zero-spend census: refusal halts before any write or roll
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it.each([
      {
        title: 'channel divinity decrements by 1',
        ps: { level: 1, class: { class_levels: [{ level: 1, channel_divinity: 2 }] } },
        automation: { resourceCost: 'channel_divinity' },
        seed: { channelDivinityCharges: 2 },
        key: 'channelDivinityCharges',
        written: 1,
      },
      {
        title: 'wild shape decrements by 1',
        ps: { class: { class_levels: [{ level: 5, wild_shape: 2 }] } },
        automation: { resourceCost: 'wild_shape' },
        seed: { wildShapeUses: 2 },
        key: 'wildShapeUses',
        written: 1,
      },
      {
        title: 'doubleEmanation wild shape decrements by 2',
        ps: { class: { class_levels: [{ level: 5, wild_shape: 3 }] } },
        automation: { resourceCost: 'wild_shape', doubleEmanation: true },
        seed: { wildShapeUses: 3 },
        key: 'wildShapeUses',
        written: 1,
      },
    ])('$title and is the only runtime write', async ({ ps: psOverrides, automation, seed, key, written }) => {
      seedRuntime(seed);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      await handle(makeAction(automation), makePlayerStats(psOverrides), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestCaster', key, written, campaignName);
    });
  });

  describe('handle - area-effect duration expiration', () => {
    it.each([
      {
        title: 'encounter-scoped duration ships without a rounds key',
        shape: 'cone',
        duration: '1_minute_rounds',
        expected: {
          attackerName: 'TestCaster',
          targetName: 'TestCaster',
          effects: [{ type: 'remove_active_buff', buffName: 'Breath Weapon' }],
          campaignName,
        },
      },
      {
        title: 'underscore-suffixed area shape with explicit rounds',
        shape: 'emanation_30ft',
        duration: '2_rounds',
        expected: {
          attackerName: 'TestCaster',
          targetName: 'TestCaster',
          effects: [{ type: 'remove_active_buff', buffName: 'Breath Weapon' }],
          campaignName,
          rounds: 2,
        },
      },
      { title: 'non-area shape', shape: 'single_target', duration: '2_rounds', expected: null },
      { title: 'unparseable duration', shape: 'cone', duration: 'invalid', expected: null },
    ])('sets expiration only for area shape + parseable duration ($title)', async ({ shape, duration, expected }) => {
      seedRuntime({ wildShapeUses: 2 });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ resourceCost: 'wild_shape', shape, duration });
      await handle(action, makePlayerStats({ class: { class_levels: [{ level: 5, wild_shape: 2 }] } }), campaignName, null);

      if (expected) {
        expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
        expect(expirations.addExpiration).toHaveBeenCalledWith(expected);
      } else {
        expect(expirations.addExpiration).not.toHaveBeenCalled();
      }
    });
  });
});
