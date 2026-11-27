// @maintained-by-ai 2026-11-26
// handleSpellAttackClick lane only. The shared showCastPopup routing, confirm
// payment/metaCtx/pending-clearing semantics, skip lane, base API shape, and
// the damage-lane psionic truth table are owned by the sibling lanes
// (castClick / confirm / skip / modalRouting / aoeClick / base .test.js) —
// this file owns the attack-click contract: cannotAct gate (with denial
// popup), spell-not-found delegation, the non-sorcerer immediate cast, and
// the pendingActionMetamagic the sorcerer lane queues from the SPELL object
// (spell.level / spell.casting_time — this lane ignores
// attack.spellLevel/castingTime), plus CLA-230 forcedMode/advantageReason
// threading through both cast paths and the attack-lane metamagic-wins gate.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import {
  makeHookProps,
  makeAttack,
  makeSpell,
  makePlayerStats,
  makeNonSorcererStats,
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

const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');

// ── Click harness ────────────────────────────────────────────────────────────
// Renders the hook and clicks handleSpellAttackClick; returns props/result and
// a lazy lastCast() reader so assertions made after a later confirm see the
// newest cast, not a click-time snapshot. Mirrors the clickAoE pattern in the
// aoeClick lane.

async function clickAttack(propsOverrides = {}, attackOverrides = {}) {
  const props = makeHookProps(propsOverrides);
  const attack = makeAttack(attackOverrides);
  const { result } = renderHook(() => useActionSpellMetamagic(props));

  await act(async () => {
    await result.current.handleSpellAttackClick(attack);
  });

  return {
    props,
    attack,
    result,
    lastCast: () => executeSpellCast.mock.calls.at(-1) ?? [null, null, null],
  };
}

const sorcererWith = (spell) => ({
  playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
});

describe('useActionSpellMetamagic - handleSpellAttackClick', () => {
  setupBeforeEach();

  // ── Guards and delegation ──────────────────────────────────────────────────

  it('blocks the click when cannotAct is true: loud denial popup, no delegate, no cast, nothing queued', async () => {
    const { props, result } = await clickAttack({ cannotAct: true });

    // RB-1115: a blocked press pops the canonical condition reason (enforcement
    // off path) and stops before any spell lookup or cast dispatch.
    expect(props.setPopupHtml).toHaveBeenCalledWith(
      expect.stringContaining('cannot take actions'),
    );
    expect(props.handleAttackClick).not.toHaveBeenCalled();
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(executeSpellCast).not.toHaveBeenCalled();
    expect(result.current.pendingActionMetamagic).toBeNull();
  });

  it('delegates to handleAttackClick when the spell is not found (any class)', async () => {
    for (const stats of [makePlayerStats(), makeNonSorcererStats()]) {
      const { props, attack } = await clickAttack({
        playerStats: { ...stats, spellAbilities: { spells: [] } },
      }, { name: 'UnknownSpell' });

      expect(props.handleAttackClick).toHaveBeenCalledWith(attack);
      expect(executeSpellCast).not.toHaveBeenCalled();
    }
  });

  // ── Non-sorcerer: immediate cast (castSpellAttackWithoutMetamagic) ───────

  it('casts immediately for a non-sorcerer, threading target info and inventing no forcedMode/advantageReason', async () => {
    const spell = makeSpell();
    const buildCtx = vi.fn(async () => ({ targetName: 'Orc B' }));
    const { lastCast } = await clickAttack(
      { playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }), buildCtx },
    );

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(executeSpellCast).toHaveBeenCalledTimes(1);
    const [, castMetaCtx, castOpts] = lastCast();
    // CLA-230: no ctx.forcedMode ⇒ nothing fabricated into the cast metaCtx.
    expect(castMetaCtx.forcedMode).toBeUndefined();
    expect(castMetaCtx.advantageReason).toBeUndefined();
    expect(await castOpts.getTargetInfo()).toEqual({ name: 'Orc B' });
  });

  it('CLA-230 + attribution parity: threads ctx.forcedMode and advantageReason into the non-sorcerer cast', async () => {
    const buildCtx = vi.fn(async () => ({
      targetName: 'Zombie 1',
      forcedMode: 'disadvantage',
      advantageReason: 'Corona of Light — sunlight aura of War_Cleric — proximity unmeasured (gridless) — GM-enforced',
    }));
    const { lastCast } = await clickAttack(
      { playerStats: makeNonSorcererStats({ spellAbilities: { spells: [makeSpell()] } }), buildCtx },
    );

    const castMetaCtx = lastCast()[1];
    expect(castMetaCtx.forcedMode).toBe('disadvantage');
    expect(castMetaCtx.advantageReason).toBe('Corona of Light — sunlight aura of War_Cleric — proximity unmeasured (gridless) — GM-enforced');
  });

  // ── Sorcerer: queue pending metamagic from the SPELL, not the attack row ──

  it.each([
    {
      label: 'spell.level and spell.casting_time win over the attack row',
      spell: { level: 4, casting_time: '1 Bonus Action' },
      attack: { spellLevel: 0 },
      expected: { spellName: 'Fireball', spellLevel: 4, castingTime: '1 Bonus Action' },
    },
    {
      label: "castingTime falls back to 'Action' when the spell has no casting_time",
      spell: { casting_time: undefined },
      attack: {},
      expected: { spellName: 'Fireball', spellLevel: 3, castingTime: 'Action' },
    },
  ])('queues pendingActionMetamagic from the SPELL — $label', async ({ spell, attack, expected }) => {
    const { result } = await clickAttack(
      sorcererWith(makeSpell(spell)),
      attack,
    );

    expect(result.current).toMatchObject({
      pendingActionMetamagic: expect.objectContaining({
        ...expected,
        isPsionic: false,
        psionicCost: 0,
        action: expect.any(Function),
      }),
    });
    // Queue-only: the click itself never prepares or casts.
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(executeSpellCast).not.toHaveBeenCalled();
  });

  it('flags psionic and charges spell.level only when spell and sorcery both agree', async () => {
    const cases = [
      // spell.level (4), not the attack row (2), sets the psionic cost.
      { isPsionic: true, hasSorcery: true, expectPsionic: true, expectCost: 4 },
      { isPsionic: true, hasSorcery: false, expectPsionic: false, expectCost: 0 },
    ];

    for (const c of cases) {
      isPsionicSpell.mockReturnValue(c.isPsionic);
      hasPsionicSorcery.mockReturnValue(c.hasSorcery);

      const { result } = await clickAttack(
        sorcererWith(makeSpell({ level: 4 })),
        { spellLevel: 2 },
      );

      const pending = result.current.pendingActionMetamagic;
      expect(pending.isPsionic, `isPsionic ${c.isPsionic} hasSorcery ${c.hasSorcery}`).toBe(c.expectPsionic);
      expect(pending.psionicCost, `isPsionic ${c.isPsionic} hasSorcery ${c.hasSorcery}`).toBe(c.expectCost);
    }
  });

  // ── Sorcerer: metamagic-resolved cast (queueSpellAttackMetamagic.action) ──

  it('executes the queued cast on confirm with ctx.forcedMode, advantageReason, and target info', async () => {
    const buildCtx = vi.fn(async () => ({
      targetName: 'Goblin A',
      forcedMode: 'disadvantage',
      advantageReason: 'Lion rage aura — enemy of raging ElderPaladin — proximity unmeasured (gridless) — GM-enforced',
    }));
    const { result, lastCast } = await clickAttack({
      ...sorcererWith(makeSpell()),
      buildCtx,
    });

    expect(executeSpellCast).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleActionMetamagicConfirm({});
    });

    // CLA-230 + attribution parity survive the metamagic detour; pending
    // clearing and payment are the confirm lane's contract.
    const [, castMetaCtx, castOpts] = lastCast();
    expect(castMetaCtx.forcedMode).toBe('disadvantage');
    expect(castMetaCtx.advantageReason).toBe('Lion rage aura — enemy of raging ElderPaladin — proximity unmeasured (gridless) — GM-enforced');
    expect(await castOpts.getTargetInfo()).toEqual({ name: 'Goblin A' });
  });

  it('CLA-230: a forcedMode already in the metaCtx (e.g. innate sorcery) wins over the ctx value', async () => {
    const buildCtx = vi.fn(async () => ({ targetName: 'Zombie 1', forcedMode: 'advantage' }));
    const { result } = await clickAttack({
      ...sorcererWith(makeSpell()),
      buildCtx,
    });

    // An explicit forcedMode already in metaCtx must not be overwritten by the
    // ctx value (mirrors handleNoSavePath's innate-sorcery `!metaCtx?.forcedMode` gate).
    await act(async () => {
      await result.current.pendingActionMetamagic.action({ forcedMode: 'normal' });
    });

    expect(executeSpellCast.mock.calls.at(-1)[1].forcedMode).toBe('normal');
  });
});
