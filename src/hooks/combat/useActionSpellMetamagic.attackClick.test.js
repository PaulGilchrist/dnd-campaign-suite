// @maintained-by-ai: 2026-10-14
// handleSpellAttackClick lane only. The shared showCastPopup routing, confirm
// payment/metaCtx semantics, and skip lane are covered by the sibling lanes
// (castClick / confirm / skip / modalRouting / aoeClick) — this file owns the
// attack-click contract: cannotAct gate, spell-not-found delegation, the
// non-sorcerer immediate cast, and the pendingActionMetamagic the sorcerer
// lane queues from the SPELL object (spell.level / spell.casting_time — this
// lane ignores attack.spellLevel/castingTime), plus CLA-230 forcedMode
// threading through both cast paths.
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
// the last executeSpellCast args (or null when nothing cast) for downstream
// assertions. Mirrors the clickAoE pattern in the aoeClick lane.

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
    // Re-read on demand so assertions made after a later confirm/skip see
    // the newest cast, not a click-time snapshot.
    lastCast: () => executeSpellCast.mock.calls.at(-1) ?? [null, null, null],
  };
}

describe('useActionSpellMetamagic - handleSpellAttackClick', () => {
  setupBeforeEach();

  // ── Guards and delegation ──────────────────────────────────────────────────

  it('returns early without casting when cannotAct is true, and still exposes the full API', async () => {
    const { props, result } = await clickAttack({ cannotAct: true });

    expect(props.handleAttackClick).not.toHaveBeenCalled();
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(executeSpellCast).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      pendingActionMetamagic: null,
      handleActionMetamagicConfirm: expect.any(Function),
      handleActionMetamagicSkip: expect.any(Function),
      handleActionSpellDamageClick: expect.any(Function),
      handleSpellAttackClick: expect.any(Function),
    });
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

  it('casts immediately for a non-sorcerer, threading targetName and never inventing forcedMode', async () => {
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
    expect(await castOpts.getTargetInfo()).toEqual({ name: 'Orc B' });
  });

  it('CLA-230: threads ctx.forcedMode into the non-sorcerer cast metaCtx', async () => {
    const spell = makeSpell();
    const buildCtx = vi.fn(async () => ({ targetName: 'Zombie 1', forcedMode: 'advantage' }));
    const { lastCast } = await clickAttack(
      { playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }), buildCtx },
    );

    expect(lastCast()[1].forcedMode).toBe('advantage');
  });

  // ── Sorcerer: queue pending metamagic from the SPELL, not the attack row ──

  it('queues pendingActionMetamagic populated from the spell (level, casting_time)', async () => {
    const spell = makeSpell({ level: 4, casting_time: '1 Bonus Action' });
    const { result } = await clickAttack({
      playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
    }, { spellLevel: 0 }); // attack-row level ignored by this lane — spell.level wins

    const pending = result.current.pendingActionMetamagic;
    expect(pending).not.toBeNull();
    expect(pending.spellName).toBe('Fireball');
    expect(pending.spellLevel).toBe(4);
    expect(pending.castingTime).toBe('1 Bonus Action');
    expect(pending.isPsionic).toBe(false);
    expect(pending.psionicCost).toBe(0);
  });

  it("falls back to castingTime 'Action' when the spell has no casting_time", async () => {
    const spell = makeSpell({ casting_time: undefined });
    const { result } = await clickAttack({
      playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
    });

    expect(result.current.pendingActionMetamagic.castingTime).toBe('Action');
  });

  it('flags psionic and costs spell.level only when both spell and sorcery are psionic', async () => {
    const cases = [
      { isPsionic: true, hasSorcery: true, expectPsionic: true, expectCost: 3 },
      { isPsionic: true, hasSorcery: false, expectPsionic: false, expectCost: 0 },
    ];

    for (const c of cases) {
      vi.clearAllMocks();
      isPsionicSpell.mockReturnValue(c.isPsionic);
      hasPsionicSorcery.mockReturnValue(c.hasSorcery);
      const spell = makeSpell();

      const { result } = await clickAttack({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const pending = result.current.pendingActionMetamagic;
      expect(pending.isPsionic, `isPsionic ${c.isPsionic} hasSorcery ${c.hasSorcery}`).toBe(c.expectPsionic);
      expect(pending.psionicCost, `isPsionic ${c.isPsionic} hasSorcery ${c.hasSorcery}`).toBe(c.expectCost);
    }
  });

  // ── Sorcerer: metamagic-resolved cast (queueSpellAttackMetamagic.action) ──

  it('executes the queued cast on confirm with ctx.forcedMode and target info, then clears pending', async () => {
    const spell = makeSpell();
    const buildCtx = vi.fn(async () => ({ targetName: 'Goblin A', forcedMode: 'advantage' }));
    const { result, lastCast } = await clickAttack({
      playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      buildCtx,
    });

    expect(result.current.pendingActionMetamagic).not.toBeNull();
    expect(executeSpellCast).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleActionMetamagicConfirm({});
    });

    // CLA-230: ctx.forcedMode survives into the metamagic-resolved cast.
    const [, castMetaCtx, castOpts] = lastCast();
    expect(castMetaCtx.forcedMode).toBe('advantage');
    expect(await castOpts.getTargetInfo()).toEqual({ name: 'Goblin A' });
    expect(result.current.pendingActionMetamagic).toBeNull();
  });

  it('CLA-230: metamagic-provided forcedMode (e.g. innate sorcery) wins over ctx value', async () => {
    const spell = makeSpell();
    const buildCtx = vi.fn(async () => ({ targetName: 'Zombie 1', forcedMode: 'advantage' }));
    const { result } = await clickAttack({
      playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
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
