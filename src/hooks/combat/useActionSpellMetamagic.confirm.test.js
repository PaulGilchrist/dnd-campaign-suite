// @maintained-by-ai: 2026-10-14
// Authoritative lane for handleActionMetamagicConfirm: payment (CLA-271 psionic
// checkbox), metamagic/spell logging, metaCtx flag building, and pending clearing.
// Click-lane queuing is covered by the castClick/attackClick siblings.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import { makeHookProps, makeSpell, setupBeforeEach } from './useActionSpellMetamagic.test-utils.js';
import { spendSorceryPoints, logMetamagicUse } from './useMetamagic.js';
import { addEntry } from '../../services/ui/logService.js';
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js';
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';

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

// ── Helpers ──────────────────────────────────────────────────────────────────

// Mount as a sorcerer with `spell` known and queue the metamagic prompt for it
// via the damage-click lane. Costs are supplied by the confirm payload, so
// `totalCost` here only needs to match metamagicRules.js values by convention.
async function queueSorcererMetamagic(spell = makeSpell(), { psionic = false } = {}) {
  isPsionicSpell.mockReturnValue(psionic);
  hasPsionicSorcery.mockReturnValue(psionic);
  const props = makeHookProps({
    playerStats: {
      name: 'TestSorcerer',
      class: { name: 'Sorcerer' },
      level: 5,
      spellAbilities: { spells: [spell] },
    },
  });
  const { result } = renderHook(() => useActionSpellMetamagic(props));
  await act(async () => {
    result.current.handleActionSpellDamageClick({
      name: spell.name,
      spellLevel: spell.level,
      castingTime: spell.casting_time,
    });
  });
  expect(result.current.pendingActionMetamagic).not.toBeNull();
  return result;
}

async function confirmMetamagic(result, payload) {
  await act(async () => {
    result.current.handleActionMetamagicConfirm(payload);
  });
  expect(result.current.pendingActionMetamagic).toBeNull();
}

// metaCtx the pending action handed to executeSpellCast.
function lastMetaCtx() {
  return executeSpellCast.mock.calls.at(-1)[1];
}

describe('useActionSpellMetamagic - handleActionMetamagicConfirm', () => {
  setupBeforeEach();

  it('does nothing when there is no pending action', () => {
    const { result } = renderHook(() => useActionSpellMetamagic(makeHookProps()));

    act(() => {
      result.current.handleActionMetamagicConfirm({ totalCost: 2, options: ['Quickened Spell'] });
    });

    expect(result.current.pendingActionMetamagic).toBeNull();
    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(logMetamagicUse).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(executeSpellCast).not.toHaveBeenCalled();
  });

  it.each([
    ['empty options', {}],
    ['null result', null],
    ['undefined result', undefined],
  ])('free confirm (%s) clears pending, casts with an empty metaCtx, and spends nothing', async (_label, payload) => {
    const result = await queueSorcererMetamagic();

    await confirmMetamagic(result, payload);

    expect(executeSpellCast).toHaveBeenCalledTimes(1);
    expect(lastMetaCtx()).toEqual({});
    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(logMetamagicUse).not.toHaveBeenCalled();
  });

  it('spends sorcery points, logs metamagic use, and adds a spell entry on a paid confirm', async () => {
    const result = await queueSorcererMetamagic(makeSpell(), { psionic: true });

    await confirmMetamagic(result, { totalCost: 2, options: ['Quickened Spell'] });

    expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 2, 'test-campaign', 10);
    // Psionic cost is added only when its checkbox was selected, so the
    // unselected Psionic Sorcery never appears in the paid options either.
    expect(logMetamagicUse).toHaveBeenCalledWith(
      'test-campaign',
      'TestSorcerer',
      'Fireball',
      expect.not.arrayContaining(['Psionic Sorcery']),
      2,
    );
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Fireball',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: ['Quickened Spell'],
      spCost: 2,
      timestamp: expect.any(Number),
    }));
  });

  it('adds the psionic cost once when the Psionic Sorcery checkbox is selected (CLA-271)', async () => {
    const result = await queueSorcererMetamagic(makeSpell(), { psionic: true });

    await confirmMetamagic(result, { totalCost: 2, options: ['Quickened Spell'], psionicActive: true });

    // 2 (Quickened) + 3 (Psionic Sorcery at Fireball's spell level)
    expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 5, 'test-campaign', 10);
    expect(logMetamagicUse).toHaveBeenCalledWith(
      'test-campaign',
      'TestSorcerer',
      'Fireball',
      ['Quickened Spell', 'Psionic Sorcery'],
      5,
    );
    expect(lastMetaCtx()).toEqual(expect.objectContaining({ psionicSpell: true }));
  });

  it('charges the psionic cost alone when no metamagic option is selected', async () => {
    const result = await queueSorcererMetamagic(makeSpell(), { psionic: true });

    await confirmMetamagic(result, { totalCost: 0, options: [], psionicActive: true });

    expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 3, 'test-campaign', 10);
    expect(logMetamagicUse).toHaveBeenCalledWith(
      'test-campaign',
      'TestSorcerer',
      'Fireball',
      ['Psionic Sorcery'],
      3,
    );
    expect(lastMetaCtx().psionicSpell).toBe(true);
  });

  it('sets heighten, careful, and distant flags in metaCtx when all three are selected', async () => {
    const result = await queueSorcererMetamagic(makeSpell());

    // Heightened 3 + Careful 1 + Distant 1 per metamagicRules.js
    await confirmMetamagic(result, { totalCost: 5, options: ['Heightened Spell', 'Careful Spell', 'Distant Spell'] });

    const metaCtx = lastMetaCtx();
    expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 5, 'test-campaign', 10);
    expect(metaCtx.metamagicHeighten).toBe(true);
    expect(metaCtx.metamagicCareful).toBe(true);
    expect(metaCtx.metamagicDistant).toBe(true);
    expect(metaCtx).not.toHaveProperty('metamagicTwinTarget');
    expect(metaCtx).not.toHaveProperty('psionicSpell');
  });

  it('threads twinTarget into metaCtx for Twinned Spell, and omits it when absent', async () => {
    const magicMissile = makeSpell({ name: 'Magic Missile', level: 1 });
    const result = await queueSorcererMetamagic(magicMissile);

    // Twinned cost = spell level (min 1) per metamagicRules.js
    await confirmMetamagic(result, { totalCost: 1, options: ['Twinned Spell'], twinTarget: 'Goblin A' });

    expect(executeSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Magic Missile', level: 1 }),
      expect.objectContaining({ metamagicTwinTarget: 'Goblin A' }),
      expect.any(Object),
    );
  });

  it('does not set metamagicTwinTarget when Twinned Spell has no twinTarget', async () => {
    const result = await queueSorcererMetamagic(makeSpell({ name: 'Magic Missile', level: 1 }));

    await confirmMetamagic(result, { totalCost: 1, options: ['Twinned Spell'] });

    expect(lastMetaCtx()).not.toHaveProperty('metamagicTwinTarget');
  });
});
