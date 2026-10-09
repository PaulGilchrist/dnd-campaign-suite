// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
  getCurrentCombatRound: vi.fn(() => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(() => Promise.resolve()) },
}));

vi.mock('./shapechangeHandler.js', () => ({
  handle: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────

import {
  getActiveShapechanges,
  getShapechangeCaster,
  applyShapechange,
  confirmShapechangeTransform,
  revertShapechange,
} from './shapechangeService.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeObject } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { handle as runShapechangeHandler } from './shapechangeHandler.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'Wizard1';
const targetName = 'Goblin';

const form = {
  name: 'Elephant',
  index: 'elephant',
  size: 'Large',
  hit_points: 59,
  armor_class: 12,
  speed: '40 ft.',
  challenge_rating: '4',
  type: 'beast',
};

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 12,
    proficiency: 5,
    abilities: { CON: { bonus: 2 } },
    ...overrides,
  };
}

function defaultMocks() {
  vi.clearAllMocks();
  getCombatContext.mockResolvedValue({
    creatures: [
      { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 },
      { name: casterName, type: 'player' },
    ],
  });
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return [];
    if (key === casterName && subKey === 'pendingExpirations') return [];
    return undefined;
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('shapechangeService.getActiveShapechanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
  });

  it('returns only shapechange effects from targetEffects', () => {
    getRuntimeValue.mockReturnValue([
      { target: targetName, effect: 'shapechange', source: casterName },
      { target: 'Orc', effect: 'polymorph', source: casterName },
      { target: 'Kobold', effect: 'shapechange', source: 'OtherCaster' },
    ]);

    const effects = getActiveShapechanges(campaignName);

    expect(effects).toHaveLength(2);
    expect(effects.every(te => te.effect === 'shapechange')).toBe(true);
  });

  it('returns empty array when no targetEffects exist', () => {
    getRuntimeValue.mockReturnValue([]);
    expect(getActiveShapechanges(campaignName)).toHaveLength(0);
  });

  it('returns empty array when targetEffects is null', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(getActiveShapechanges(campaignName)).toHaveLength(0);
  });
});

describe('shapechangeService.getShapechangeCaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
  });

  it('returns the source caster for a target with shapechange', () => {
    getRuntimeValue.mockReturnValue([
      { target: targetName, effect: 'shapechange', source: casterName },
      { target: 'Orc', effect: 'shapechange', source: 'OtherCaster' },
    ]);

    expect(getShapechangeCaster(targetName, campaignName)).toBe(casterName);
  });

  it('returns null when target has no shapechange effect', () => {
    getRuntimeValue.mockReturnValue([
      { target: targetName, effect: 'polymorph', source: casterName },
    ]);

    expect(getShapechangeCaster(targetName, campaignName)).toBeNull();
  });

  it('handles array targets by checking first element', () => {
    getRuntimeValue.mockReturnValue([
      { target: [targetName, 'ally'], effect: 'shapechange', source: casterName },
    ]);

    expect(getShapechangeCaster(targetName, campaignName)).toBe(casterName);
  });

  it('returns null when no effects exist', () => {
    expect(getShapechangeCaster(targetName, campaignName)).toBeNull();
  });
});

describe('shapechangeService.applyShapechange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runShapechangeHandler.mockResolvedValue({ type: 'popup', payload: {} });
  });

  it('returns null for non-shapechange spells', async () => {
    const result = await applyShapechange({ name: 'Polymorph', level: 4 }, {}, makePlayerStats(), campaignName, null);
    expect(result).toBeNull();
    expect(runShapechangeHandler).not.toHaveBeenCalled();
  });

  it('dispatches to shapechange handler when spell name matches (case-insensitive)', async () => {
    await applyShapechange({ name: 'shapechange', level: 9 }, {}, makePlayerStats(), campaignName, null);
    expect(runShapechangeHandler).toHaveBeenCalled();
  });

  it('dispatches to the shapechange handler and returns its result', async () => {
    const popup = { type: 'popup', payload: { type: 'shapechange_select', targetName, maxCR: 12 } };
    runShapechangeHandler.mockResolvedValue(popup);

    const spell = { name: 'Shapechange', level: 9 };
    const metaCtx = { slotLevel: 9 };
    const result = await applyShapechange(spell, metaCtx, makePlayerStats(), campaignName, null);

    expect(runShapechangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Shapechange', spell, spellSlotLevel: 9, metaCtx }),
      expect.anything(),
      campaignName,
      null,
    );
    expect(result).toBe(popup);
  });

  it('uses metaCtx slotLevel when available', async () => {
    await applyShapechange({ name: 'Shapechange', level: 9 }, { slotLevel: 9 }, makePlayerStats(), campaignName, null);
    expect(runShapechangeHandler.mock.calls[0][0].spellSlotLevel).toBe(9);
  });

  it('falls back to spell.level when metaCtx has no slotLevel', async () => {
    await applyShapechange({ name: 'Shapechange', level: 9 }, null, makePlayerStats(), campaignName, null);
    expect(runShapechangeHandler.mock.calls[0][0].spellSlotLevel).toBe(9);
  });

  it('returns null when the handler throws', async () => {
    runShapechangeHandler.mockRejectedValue(new Error('boom'));
    expect(await applyShapechange({ name: 'Shapechange', level: 9 }, {}, makePlayerStats(), campaignName, null)).toBeNull();
  });
});

describe('shapechangeService.confirmShapechangeTransform', () => {
  beforeEach(defaultMocks);

  it('returns no_target when creature is missing from combat', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: casterName, type: 'player' }] });
    expect(await confirmShapechangeTransform({
      targetName: 'MissingCreature', form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName,
    })).toEqual({ ok: false, reason: 'no_target' });
  });

  it('overrides creature stats with form and stores originals', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] };
    getCombatContext.mockResolvedValue(cs);
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });

    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(59);
    expect(creature.ac).toBe(12);
    expect(creature.speed).toBe('40 ft.');
    expect(creature.shapechangeOriginal).toEqual({ maxHp: 7, ac: 15, speed: 30 });
    expect(creature.shapechangeSource).toBe(casterName);
    expect(creature.shapechangeForm).toEqual({ name: 'Elephant', index: 'elephant', size: 'Large', hitPoints: 59, armorClass: 12, speed: '40 ft.', challengeRating: '4', type: 'beast' });
    expect(creature.formName).toBe('Elephant');
  });

  it('uses defaults when form hit_points is not a number', async () => {
    const incompleteForm = { name: 'Wolf', armor_class: 13, speed: '40 ft.', challenge_rating: '1/8', type: 'beast' };
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] };
    getCombatContext.mockResolvedValue(cs);
    await confirmShapechangeTransform({ targetName, form: incompleteForm, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    expect(cs.creatures[0].maxHp).toBe(0);
  });

  it('uses defaults when form armor_class is not a number', async () => {
    const incompleteForm = { name: 'Wolf', hit_points: 13, speed: '40 ft.', challenge_rating: '1/8', type: 'beast' };
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] };
    getCombatContext.mockResolvedValue(cs);
    await confirmShapechangeTransform({ targetName, form: incompleteForm, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    expect(cs.creatures[0].ac).toBe(10);
  });

  it('SP-103: first transform sets temp HP to the full form HP (batched)', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] };
    getCombatContext.mockResolvedValue(cs);
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 59, shapechangeTempHp: 59 }, campaignName);
  });

  it('persists the combat summary', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalled();
  });

  it('adds a shapechange targetEffect', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    expect(effectsCall[2]).toEqual(expect.arrayContaining([expect.objectContaining({ target: targetName, source: casterName, effect: 'shapechange', duration: 'concentration', formName: 'Elephant' })]));
  });

  it('replaces existing polymorph/true_polymorph effects with shapechange', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, effect: 'polymorph', source: 'OldCaster' }, { target: 'Orc', effect: 'shapechange', source: 'Other' }];
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    const effects = effectsCall[2];
    expect(effects).toHaveLength(2);
    expect(effects.find(te => te.target === targetName && te.effect === 'shapechange').source).toBe(casterName);
    expect(effects.find(te => te.target === 'Orc')).toBeTruthy();
  });

  it('replaces existing shapechange effects with new ones', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, effect: 'shapechange', source: 'OldCaster' }];
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    expect(effectsCall[2]).toHaveLength(1);
    expect(effectsCall[2][0].source).toBe(casterName);
  });

  it('SP-103: registers concentration with the canonical spell-save DC fallback', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    expect(addConcentration).toHaveBeenCalledWith(expect.any(Object), casterName, 'Shapechange', 8 + makePlayerStats().proficiency);
  });

  it('SP-103: prefers playerStats.spellAbilities.saveDc (caster WIS DC, not CON math)', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats({ spellAbilities: { saveDc: 17 } }), campaignName });
    expect(addConcentration).toHaveBeenCalledWith(expect.any(Object), casterName, 'Shapechange', 17);
  });

  it('uses spell name from spell param for concentration', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    expect(addConcentration).toHaveBeenCalledWith(expect.any(Object), casterName, 'Shapechange', expect.any(Number));
  });

  it('falls back to "Shapechange" when spell param is missing name', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: {}, playerStats: makePlayerStats(), campaignName });
    expect(addConcentration).toHaveBeenCalledWith(expect.any(Object), casterName, 'Shapechange', expect.any(Number));
  });

  it('skips concentration if caster creature is not found', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: targetName, type: 'monster', maxHp: 7, ac: 15, speed: 30 }] });
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    expect(addConcentration).not.toHaveBeenCalled();
  });

  it('SP-103: writes a shapechange pending expiration anchored at 600 rounds (1 hour)', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    const expCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[1] === 'pendingExpirations' && call[0] === casterName);
    expect(expCall[2]).toEqual(expect.arrayContaining([expect.objectContaining({ target: targetName, effects: expect.arrayContaining([expect.objectContaining({ type: 'shapechange' })]), appliedRound: 5, expiryRounds: 600, expireOnCreatureName: null })]));
  });

  it('filters existing expirations to remove old shapechange entries for the same target', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'shapechange' }], expiryRounds: 10 }, { target: 'Orc', effects: [{ type: 'polymorph' }], expiryRounds: 5 }];
      return undefined;
    });
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    const expCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[1] === 'pendingExpirations' && call[0] === casterName);
    expect(expCall[2]).toHaveLength(2);
    expect(expCall[2].find(e => e.target === 'Orc')).toBeTruthy();
    expect(expCall[2].find(e => e.target === targetName).expiryRounds).toBe(600);
  });

  it('logs the transformation', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    const transformCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('uses Shapechange to transform into Elephant'));
    expect(transformCalls.length).toBe(1);
    expect(transformCalls[0][1]).toEqual(expect.objectContaining({ type: 'save_result', characterName: casterName, rollType: 'save-shapechange', targetName, saveType: 'WIS', success: false }));
  });

  it('includes challenge rating in log description', async () => {
    await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName });
    expect(vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('CR 4')).length).toBe(1);
  });

  it('returns { ok: true } on success', async () => {
    expect(await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName })).toEqual({ ok: true });
  });
});

describe('shapechangeService.confirmShapechangeTransform — SP-103 form change', () => {
  const secondForm = {
    name: 'Panther', index: 'panther', size: 'Medium', hit_points: 41,
    armor_class: 12, speed: '50 ft.', challenge_rating: '1/4', type: 'beast',
  };

  function transformedMocks() {
    defaultMocks();
    getCombatContext.mockResolvedValue({
      creatures: [
        {
          name: targetName, type: 'monster', currentHp: 5, maxHp: 59, ac: 12, speed: '40 ft.',
          shapechangeOriginal: { maxHp: 7, ac: 15, speed: 30 },
          shapechangeSource: casterName,
          shapechangeForm: { name: 'Elephant' }, formName: 'Elephant',
          concentration: { spell: 'Shapechange', dc: 13 },
        },
        { name: casterName, type: 'player' },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, source: casterName, effect: 'shapechange', formName: 'Elephant' }];
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'shapechange' }], appliedRound: 2, expiryRounds: 600 }];
      return undefined;
    });
  }

  it('swaps stat block to the new form, originals untouched', async () => {
    transformedMocks();
    const cs = await getCombatContext(campaignName);
    const result = await confirmShapechangeTransform({ targetName, form: secondForm, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName, formChange: true });
    const creature = cs.creatures.find(c => c.name === targetName);
    expect(result).toEqual({ ok: true });
    expect(creature.maxHp).toBe(41);
    expect(creature.formName).toBe('Panther');
    expect(creature.shapechangeOriginal).toEqual({ maxHp: 7, ac: 15, speed: 30 });
  });

  it('does NOT re-grant THP on a form change', async () => {
    transformedMocks();
    await confirmShapechangeTransform({ targetName, form: secondForm, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName, formChange: true });
    expect(setRuntimeObject).not.toHaveBeenCalled();
    const tHpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(call => call[0] === targetName && (call[1] === 'tempHp' || call[1] === 'shapechangeTempHp'));
    expect(tHpCalls.length).toBe(0);
  });

  it('does NOT re-stamp concentration or the expiry clock', async () => {
    transformedMocks();
    await confirmShapechangeTransform({ targetName, form: secondForm, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName, formChange: true });
    expect(addConcentration).not.toHaveBeenCalled();
    const expCalls = vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'pendingExpirations');
    expect(expCalls.length).toBe(0);
  });

  it('logs ability_use form change and no cast save_result', async () => {
    transformedMocks();
    await confirmShapechangeTransform({ targetName, form: secondForm, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName, formChange: true });
    const entries = vi.mocked(addEntry).mock.calls.map(c => c[1]);
    const ability = entries.filter(e => e.type === 'ability_use');
    expect(ability.length).toBe(1);
    expect(ability[0].description).toContain('shape-shifts into Panther');
    expect(entries.some(e => e.type === 'save_result')).toBe(false);
  });

  it('updates the shapechange targetEffect formName', async () => {
    transformedMocks();
    await confirmShapechangeTransform({ targetName, form: secondForm, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName, formChange: true });
    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    expect(effectsCall[2].find(te => te.effect === 'shapechange').formName).toBe('Panther');
  });

  it('refuses an unpaid form-change confirm when never transformed', async () => {
    defaultMocks();
    const result = await confirmShapechangeTransform({ targetName, form, casterName, spell: { name: 'Shapechange' }, playerStats: makePlayerStats(), campaignName, formChange: true });
    expect(result).toEqual({ ok: false, reason: 'not_shapechanged' });
    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });
});

describe('shapechangeService.revertShapechange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName, type: 'monster', currentHp: 5, maxHp: 59, ac: 12, speed: '40 ft.',
        shapechangeSource: casterName, shapechangeOriginal: { maxHp: 7, ac: 15, speed: 30 },
        shapechangeForm: { name: 'Elephant' }, formName: 'Elephant',
      }],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, source: casterName, effect: 'shapechange', formName: 'Elephant' }];
      if (key === targetName && subKey === 'shapechangeTempHp') return 59;
      if (key === targetName && subKey === 'tempHp') return 59;
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'shapechange' }], expiryRounds: Infinity }];
      return undefined;
    });
  });

  it('restores original creature stats and clears shapechange fields', () => {
    const cs = getCombatSummary(campaignName);
    const creature = cs.creatures[0];
    expect(revertShapechange(targetName, campaignName)).toBe(true);
    expect(creature.maxHp).toBe(7);
    expect(creature.ac).toBe(15);
    expect(creature.speed).toBe(30);
    expect(creature.shapechangeSource).toBeUndefined();
    expect(creature.shapechangeOriginal).toBeUndefined();
    expect(creature.shapechangeForm).toBeUndefined();
    expect(creature.formName).toBeUndefined();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
  });

  it('removes the shapechange targetEffect', () => {
    revertShapechange(targetName, campaignName);
    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    expect(effectsCall).toBeTruthy();
    expect(effectsCall[2].every(te => !(te.target === targetName && te.effect === 'shapechange'))).toBe(true);
  });

  it('SP-103: clears the Shapechange concentration stamp on revert', () => {
    const cs = getCombatSummary(campaignName);
    cs.creatures[0].concentration = { spell: 'Shapechange', dc: 17 };
    revertShapechange(targetName, campaignName);
    expect(cs.creatures[0].concentration).toBeUndefined();
  });

  it('SP-103: leaves another spell\'s concentration untouched on revert', () => {
    const cs = getCombatSummary(campaignName);
    cs.creatures[0].concentration = { spell: 'Bless', dc: 13 };
    revertShapechange(targetName, campaignName);
    expect(cs.creatures[0].concentration?.spell).toBe('Bless');
  });

  it('returns leftover temp HP by subtracting the shapechange buffer', () => {
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 0, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'shapechangeTempHp', 0, campaignName);
  });

  it('removes the shapechange expiration from the caster', () => {
    revertShapechange(targetName, campaignName);
    const expCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[1] === 'pendingExpirations' && call[0] === casterName);
    expect(expCall).toBeTruthy();
    expect(expCall[2]).toEqual([]);
  });

  it('logs the revert', () => {
    revertShapechange(targetName, campaignName);
    const revertCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('reverts to their normal form'));
    expect(revertCalls.length).toBe(1);
    expect(revertCalls[0][1]).toEqual(expect.objectContaining({ type: 'ability_use', characterName: targetName, abilityName: 'Shapechange' }));
  });

  it('is idempotent for a creature that is not shapechanged', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] });
    getRuntimeValue.mockImplementation(() => undefined);
    expect(revertShapechange(targetName, campaignName)).toBe(false);
  });

  it('handles missing shapechangeOriginal properties gracefully', () => {
    const cs = getCombatSummary(campaignName);
    cs.creatures[0].shapechangeOriginal = {};
    expect(revertShapechange(targetName, campaignName)).toBe(true);
    expect(cs.creatures[0].shapechangeSource).toBeUndefined();
  });

  it('handles undefined original speed (does not overwrite)', () => {
    const cs = getCombatSummary(campaignName);
    cs.creatures[0].shapechangeOriginal = { maxHp: 7, ac: 15 };
    expect(revertShapechange(targetName, campaignName)).toBe(true);
    expect(cs.creatures[0].speed).toBe('40 ft.');
  });

  it('finds caster from targetEffects when creature has no shapechangeSource', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: targetName, shapechangeSource: casterName, shapechangeOriginal: { maxHp: 7, ac: 15, speed: 30 } }] });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, source: casterName, effect: 'shapechange' }];
      if (key === targetName && subKey === 'shapechangeTempHp') return 0;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 3;
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'shapechange' }], expiryRounds: Infinity }];
      return undefined;
    });
    expect(revertShapechange(targetName, campaignName)).toBe(true);
    const expCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[1] === 'pendingExpirations' && call[0] === casterName);
    expect(expCall).toBeTruthy();
    expect(expCall[2]).toEqual([]);
  });

  it('handles shapechangeTempHp of 0 by falling back to player current HP', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === targetName && subKey === 'shapechangeTempHp') return 0;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 3;
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 3, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'shapechangeTempHp', 0, campaignName);
  });

  it('does not set tempHp when playerCurrentHp is not a number', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === targetName && subKey === 'shapechangeTempHp') return 0;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 'not a number';
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    const tempHpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'tempHp' && call[0] === targetName);
    expect(tempHpCalls.length).toBe(0);
  });

  it('handles negative shapechangeTempHp (treated as 0)', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === targetName && subKey === 'shapechangeTempHp') return -5;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 3;
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 3, campaignName);
  });

  it('persists combat summary only when changed is true', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] });
    getRuntimeValue.mockImplementation(() => undefined);
    revertShapechange(targetName, campaignName);
    expect(storage.set).not.toHaveBeenCalled();
    expect(setCombatSummaryCache).not.toHaveBeenCalled();
  });

  it('sets combat summary and cache when changed is true', () => {
    expect(revertShapechange(targetName, campaignName)).toBe(true);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalled();
  });

  it('handles array targets in targetEffects filtering', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: [targetName, 'ally'], source: casterName, effect: 'shapechange' }];
      if (key === targetName && subKey === 'shapechangeTempHp') return 0;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 3;
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    expect(effectsCall).toBeTruthy();
  });

  it('does not update pendingExpirations when nothing changed', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === targetName && subKey === 'shapechangeTempHp') return 0;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 3;
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    const expCalls = vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'pendingExpirations');
    expect(expCalls.length).toBe(0);
  });
});
