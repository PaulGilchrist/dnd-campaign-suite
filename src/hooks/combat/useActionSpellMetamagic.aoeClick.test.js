// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import {
  makeHookProps,
  makeAttack,
  makePlayerStats,
  setupBeforeEach,
} from './useActionSpellMetamagic.test-utils.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(() => Promise.resolve(null)),
}));

// ── Click harness ────────────────────────────────────────────────────────────
// Renders the hook and clicks handleActionSpellDamageClick with an AoE
// attack; returns the captured saveAttackAoeModal (or null when no modal
// opened) plus the props for downstream assertions.

async function clickAoE(attackOverrides = {}, propsOverrides = {}) {
  const setModalState = vi.fn();
  const props = makeHookProps({ setModalState, ...propsOverrides });
  const { result } = renderHook(() => useActionSpellMetamagic(props));
  const attack = makeAttack(attackOverrides);

  await act(async () => {
    result.current.handleActionSpellDamageClick(attack);
  });

  const call = setModalState.mock.calls[0];
  return {
    modal: call ? call[0].saveAttackAoeModal : null,
    opened: setModalState.mock.calls.length > 0,
    attack,
    props,
    result,
  };
}

describe('useActionSpellMetamagic - handleActionSpellDamageClick - area of effect', () => {
  setupBeforeEach();

  // ── Modal population ─────────────────────────────────────────────────────

  it('opens saveAttackAoeModal fully populated from a 2024 Fireball attack', async () => {
    // Mirrors the 2024 data shape in public/data/2024/spells.json
    // (area_of_effect.shape) and the 5e fallback range default of 15 feet.
    const { modal, result } = await clickAoE({
      area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
      saveDc: 15,
      saveSuccess: 0.5,
      damage: '8d6',
      damageType: 'fire',
      saveType: 'DEX',
      range: '150 feet',
    });

    expect(modal.shape).toBe('sphere');
    expect(modal.range).toBe(150);
    expect(modal.damage).toBe('8d6');
    expect(modal.damageType).toBe('fire');
    expect(modal.saveType).toBe('DEX');
    expect(modal.saveDc).toBe(15);
    expect(modal.dcSuccess).toBe('half');
    expect(modal.action.name).toBe('Fireball');
    expect(modal.action.automation).toEqual({});
    expect(modal.action.spell.name).toBe('Fireball');
    expect(modal.playerStats).toEqual({
      name: 'TestSorcerer',
      class: { name: 'Sorcerer' },
      level: 5,
    });
    expect(modal.campaignName).toBe('test-campaign');
    // The AoE modal owns metamagic selection downstream — this lane must
    // not queue pendingActionMetamagic (see sibling confirm/skip lanes).
    expect(result.current.pendingActionMetamagic).toBeNull();
  });

  // ── Range parsing ────────────────────────────────────────────────────────

  it('parses range into feet for every range form', async () => {
    const cases = [
      ['30 feet', 30],       // unit suffix with space
      ['60ft', 60],          // unit suffix without space
      ['Self', 0],           // Self is range 0
      ['Self (10-foot radius)', 10], // number embedded in Self text
      [60, 60],             // numeric range passes through
      [undefined, 15],      // missing range falls back to 15 feet
    ];

    for (const [range, expected] of cases) {
      const { modal, opened } = await clickAoE({
        area_of_effect: { shape: 'sphere' },
        range,
      });
      expect(opened, `range ${JSON.stringify(range)}`).toBe(true);
      expect(modal.range, `range ${JSON.stringify(range)}`).toBe(expected);
    }
  });

  // ── Save DC and DC success ───────────────────────────────────────────────

  it('maps saveSuccess values to dcSuccess', async () => {
    const cases = [
      [0, 'none'],
      [0.5, 'half'],
      [1, 1],               // non-half/non-none values pass through
      [undefined, undefined],
    ];

    for (const [saveSuccess, expected] of cases) {
      const { modal } = await clickAoE({
        area_of_effect: { shape: 'sphere' },
        saveSuccess,
      });
      expect(modal.dcSuccess, `saveSuccess ${saveSuccess}`).toBe(expected);
    }
  });

  it('falls back to playerStats.spellAbilities.saveDc when attack.saveDc is missing', async () => {
    const { modal } = await clickAoE(
      { area_of_effect: { shape: 'sphere' } },
      { playerStats: makePlayerStats({ spellAbilities: { saveDc: 17 } }) },
    );
    expect(modal.saveDc).toBe(17);
  });

  // ── Defaults for missing damage fields ───────────────────────────────────

  it('defaults damage, damageType, and saveType when missing', async () => {
    const { modal } = await clickAoE({ area_of_effect: { shape: 'sphere' } });
    expect(modal.damage).toBe('0');
    expect(modal.damageType).toBe('');
    expect(modal.saveType).toBe('DEX');
  });

  // ── Shape detection ──────────────────────────────────────────────────────

  it('accepts every recognized area shape, including aoe.type fallback', async () => {
    const shapes = ['emanation', 'cone', 'line', 'sphere', 'cube', 'cylinder', 'square', 'circle', 'wall', 'cage', 'floor', 'area'];
    for (const shape of shapes) {
      const { modal, opened } = await clickAoE({ area_of_effect: { shape } });
      expect(opened, `shape ${shape}`).toBe(true);
      expect(modal.shape, `shape ${shape}`).toBe(shape);
    }

    // 5e spells.json stores the shape under area_of_effect.type
    const viaType = await clickAoE({ area_of_effect: { type: 'cone', size: '30-foot' } });
    expect(viaType.modal.shape).toBe('cone');
  });

  // ── Guards: no modal, fall through to handleAttackClick ──────────────────

  it('does not open a modal for unrecognized or missing area_of_effect and falls through to handleAttackClick', async () => {
    const guards = [
      { shape: 'unknown_shape' }, // unrecognized string
      { shape: 1 },                // numeric shape rejected after String()
      { type: 'pyramid' },       // unrecognized type
      null,                        // explicit null AoE
      undefined,                   // missing AoE
    ];

    for (const aoe of guards) {
      const { opened, props, attack } = await clickAoE({ area_of_effect: aoe });
      expect(opened, `aoe ${JSON.stringify(aoe)}`).toBe(false);
      // Default sorcerer stats have no matching prepared spell, so the
      // non-AoE attack falls back to the plain attack-click lane.
      expect(props.handleAttackClick, `aoe ${JSON.stringify(aoe)}`).toHaveBeenCalledWith(attack);
    }
  });

  it('skips the modal and queues nothing when setModalState prop is null', async () => {
    const { opened, result } = await clickAoE(
      { area_of_effect: { shape: 'sphere', size: '20-foot-radius' } },
      { setModalState: null },
    );
    expect(opened).toBe(false);
    expect(result.current.pendingActionMetamagic).toBeNull();
  });
});
