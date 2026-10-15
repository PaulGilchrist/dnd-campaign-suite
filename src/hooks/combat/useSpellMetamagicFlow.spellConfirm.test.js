// @maintained-by-ai: 2026-10-15
//
// CONFIRM-LANE AUTHORITY — the confirm twin of .skip.test.js (skip 19-row table).
// Owns the gate → pending → CONFIRM contract for the lanes with no chooser spec table:
//  - metamagic popup lane (useMetamagicHandler): confirm pays SP once at the popup's
//    totalCost, logs ONE spell entry (metamagic[] + spCost + RAW spellLevel), pays the
//    slot via prepareSpellCast, executes, clears pending. handleSkip is the mirror:
//    casts UNMODIFIED (spCost 0, no spend) but still logs — unlike the 'clear' chooser skips.
//  - multi-target lane (useMultiTargetHandler): confirm/skip both log the full combat
//    roster at RAW level; only metaCtx.multiTarget differs (confirm {secondTarget} vs {}).
//  - Magic Missile lv1 baseline (CLA-389 pay-at-confirm): clear + execute threading;
//    upcast arg matrix → .sp075-magicMissile-upcast; skip row → .skip.test.js.
// Owned elsewhere — do not duplicate here:
//  - popup payload shapes:            useSpellMetamagicFlow/confirm-payloads.test.js
//  - metamagic-handler psionic unit: useSpellMetamagicFlow/metamagic-handler.psionic.test.js
//  - two-stage chains (Resistance, PfE, Enhance Ability): .gate-two-stage.test.js
//  - simple-spec confirm dispatch:   .simple-handlers.test.js (Remove Curse rows live HERE —
//    removeCurse is absent from its SPELL_ROWS)
//  - chooser skip lanes + refunds:   .skip.test.js; no-pending guards for spec keys:
//    .handler-guards.test.js (metamagic/multi-target guards below are NOT in its sweep).
// Levels are RAW, verified against public/data/spells.json + public/data/2024/spells.json
// (Word of Radiance & psionic picks are 2024 cantrip-era names; lv3/lv1 fixtures were stale).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js';
import { confirmRemoveCurse } from '../../services/rules/features/removeCurseService.js';
import { spendSorceryPoints, logMetamagicUse } from './useMetamagic.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
    ],
  })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

// Passthrough prepareSpellCast so the confirm lane's metaCtx (metamagic flags,
// psionic payment, MM distribution) is assertable on onExecute.
vi.mock('../../services/rules/spells/spellPreparationService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  prepareSpellCast: vi.fn(async (spell, metaCtx) => ({
    modifiedSpell: spell,
    metaCtx: { ...metaCtx },
    slotConsumed: false,
    freeCastUsed: false,
  })),
  isFreeCastAuthorized: vi.fn(() => false),
}));

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ creatures: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

const CAMPAIGN = 'TestCampaign';
const CASTER = 'TestSorcerer';

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 action',
    range: '150 ft.',
    ...overrides,
  };
}

function renderFlow() {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: CASTER, class: { name: 'Sorcerer' }, level: 5 },
      campaignName: CAMPAIGN,
      onExecute,
    })
  );
  return { result, onExecute };
}

async function arm(result, spell) {
  await act(async () => {
    await result.current.gateMetamagic(spell);
  });
}

// ── Metamagic popup lane: confirm pays → logs → executes → clears ────────────
// One row per popup-cast shape. confirmCost = the popup's totalCost (options only;
// CLA-271: psionic SP is prepareSpellCast's money, folded into the log, not spent).
describe('useSpellMetamagicFlow — metamagic popup lane confirm authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const popupCases = [
    { spell: 'Fireball', level: 3, options: [], cost: 0, flags: {} },
    { spell: 'Fireball', level: 3, options: ['Empowered Spell'], cost: 1, flags: {} },
    { spell: 'Shatter', level: 2, options: ['Distant Spell', 'Careful Spell'], cost: 2, flags: { metamagicDistant: true, metamagicCareful: true } },
    { spell: 'Burning Hands', level: 1, options: ['Heightened Spell'], cost: 3, flags: { metamagicHeighten: true } },
  ];

  for (const tc of popupCases) {
    it(`${tc.spell} lv${tc.level} + [${tc.options.join(', ') || 'none'}]: pay once, log, execute with flags, clear`, async () => {
      const { result, onExecute } = renderFlow();
      const spell = makeSpell({ name: tc.spell, level: tc.level });

      await arm(result, spell);
      expect(result.current.pendingMetamagic).not.toBeNull();

      await act(async () => {
        await result.current.handleConfirm({ totalCost: tc.cost, options: tc.options });
      });

      if (tc.cost > 0) {
        expect(spendSorceryPoints).toHaveBeenCalledTimes(1);
        expect(spendSorceryPoints).toHaveBeenCalledWith(CASTER, tc.cost, CAMPAIGN, 10);
        expect(logMetamagicUse).toHaveBeenCalledWith(CAMPAIGN, CASTER, tc.spell, tc.options, tc.cost);
      } else {
        expect(spendSorceryPoints).not.toHaveBeenCalled();
        expect(logMetamagicUse).not.toHaveBeenCalled();
      }

      // One RAW-level cast entry carrying the popup's options and spCost.
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'spell',
        characterName: CASTER,
        spellName: tc.spell,
        spellLevel: tc.level,
        metamagic: tc.options,
        spCost: tc.cost,
        timestamp: expect.any(Number),
      }));

      // Slot paid once at the RAW level, then executed with the metamagic flags.
      // (Base lane: prepareMetamagicCast forwards pending.spell.isUpcast verbatim —
      // undefined, not false, for a non-upcast spell.)
      expect(prepareSpellCast).toHaveBeenCalledTimes(1);
      expect(prepareSpellCast).toHaveBeenCalledWith(
        expect.objectContaining({ name: tc.spell, level: tc.level }),
        expect.any(Object),
        expect.objectContaining({ playerName: CASTER, campaignName: CAMPAIGN, usePsionicPayment: false })
      );
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(
        expect.objectContaining({ name: tc.spell }),
        expect.objectContaining(tc.flags)
      );
      expect(result.current.pendingMetamagic).toBeNull();
    });
  }

  it('handleSkip casts unmodified: no SP spend, still pays, logs metamagic:[], clears', async () => {
    const { result, onExecute } = renderFlow();
    const spell = makeSpell({ name: 'Fireball', level: 3 });

    await arm(result, spell);
    expect(result.current.pendingMetamagic).not.toBeNull();

    await act(async () => {
      await result.current.handleSkip();
    });

    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      spellName: 'Fireball',
      spellLevel: 3,
      metamagic: [],
      spCost: 0,
    }));
    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fireball' }),
      {},
      expect.objectContaining({ playerName: CASTER, campaignName: CAMPAIGN, isUpcast: false })
    );
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(result.current.pendingMetamagic).toBeNull();
  });
});

// ── Multi-target lane: confirm/skip log the full roster at RAW level ─────────

describe('useSpellMetamagicFlow — multi-target lane confirm/skip authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const multiCases = [
    { label: 'confirm with secondTarget', call: (r) => r.handleMultiTargetConfirm({ secondTarget: 'Goblin B' }), metaCtx: { multiTarget: 'Goblin B' } },
    { label: 'confirm without secondTarget', call: (r) => r.handleMultiTargetConfirm({}), metaCtx: {} },
    { label: 'skip', call: (r) => r.handleMultiTargetSkip(), metaCtx: {} },
  ];

  for (const tc of multiCases) {
    it(`Word of Radiance cantrip — ${tc.label}: executes, logs roster lv0, clears pending`, async () => {
      const { result, onExecute } = renderFlow();
      const spell = makeSpell({ name: 'Word of Radiance', level: 0, range: 'Self' });
      getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });

      await arm(result, spell);
      expect(result.current.pendingMultiTarget).not.toBeNull();

      await act(async () => {
        await tc.call(result.current);
      });

      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(spell, expect.objectContaining(tc.metaCtx));
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'spell',
        characterName: CASTER,
        targetName: 'Goblin A',
        targets: ['Goblin A', 'Goblin B'],
        spellName: 'Word of Radiance',
        spellLevel: 0,
        castingTime: '1 action',
        timestamp: expect.any(Number),
      }));
      expect(result.current.pendingMultiTarget).toBeNull();
    });
  }
});

// ── Remove Curse lv3: chooser-confirm lifecycle (absent from simple-handlers) ──

describe('useSpellMetamagicFlow — Remove Curse confirm lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lv3 confirm dispatches Remove Curse once, logs one lv3 cast, clears pending', async () => {
    const { result } = renderFlow();

    await arm(result, makeSpell({ name: 'Remove Curse', level: 3, range: 'Touch' }));
    expect(result.current.pendingRemoveCurse).not.toBeNull();

    await act(async () => {
      await result.current.handleRemoveCurseConfirm(['Goblin A']);
    });

    expect(confirmRemoveCurse).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      spellName: 'Remove Curse',
      spellLevel: 3,
      targetName: 'Goblin A',
    }));
    expect(result.current.pendingRemoveCurse).toBeNull();
  });
});

// ── Magic Missile lv1 baseline — clear + threading, zero lane-side log ────────
// Upcast payment matrix → .sp075-magicMissile-upcast; skip row → .skip.test.js.

describe('useSpellMetamagicFlow — Magic Missile lv1 confirm lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lv1 confirm pays the slot once, executes distribution at slotLevel 1, clears, logs nothing', async () => {
    const { result, onExecute } = renderFlow();
    const distribution = { 'Goblin A': 2, 'Goblin B': 1 };

    await arm(result, makeSpell({ name: 'Magic Missile', level: 1, range: '120 feet' }));
    expect(result.current.pendingMagicMissile).not.toBeNull();

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution });
    });

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Magic Missile', level: 1 }),
      expect.objectContaining({ magicMissileDistribution: distribution, slotLevel: 1 })
    );
    // The lane logs NOTHING — executeMagicMissile owns the canonical cast entry.
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingMagicMissile).toBeNull();
  });

  it('all-zero distribution is refused: no pay, no execute, no log — pending cleared', async () => {
    const { result, onExecute } = renderFlow();

    await arm(result, makeSpell({ name: 'Magic Missile', level: 1, range: '120 feet' }));
    expect(result.current.pendingMagicMissile).not.toBeNull();

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 0, 'Goblin B': 0 } });
    });

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingMagicMissile).toBeNull();
  });
});

// ── Psionic Sorcery gate→confirm integration (CLA-271) ─────────────────────────
// Handler-unit payment semantics → metamagic-handler.psionic.test.js. These rows own
// what only the full hook can prove: the gate stamps psionicCost from the RAW spell
// level (queueSorceryMetamagic) and confirm folds it into the logged spCost.

describe('useSpellMetamagicFlow — psionic sorcery gate→confirm integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPsionicSpell.mockReturnValue(true);
    hasPsionicSorcery.mockReturnValue(true);
  });

  it('popup psionicActive: SP spent once at options cost, log spCost includes gate psionicCost', async () => {
    const { result, onExecute } = renderFlow();

    await arm(result, makeSpell({ name: 'Suggestion', level: 2, range: '30 feet' }));
    // Gate stamp: psionicCost = RAW spell level (2), owned nowhere else.
    expect(result.current.pendingMetamagic.psionicCost).toBe(2);

    await act(async () => {
      await result.current.handleConfirm({ totalCost: 1, options: ['Empowered Spell'], psionicActive: true });
    });

    expect(spendSorceryPoints).toHaveBeenCalledTimes(1);
    expect(spendSorceryPoints).toHaveBeenCalledWith(CASTER, 1, CAMPAIGN, 10);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      metamagic: ['Empowered Spell', 'Psionic Sorcery'],
      spCost: 3,
    }));
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true })
    );
  });

  it('spell-detail opt-in (usePsionicPayment) forwards through the pending even with checkbox off', async () => {
    const { result, onExecute } = renderFlow();

    await arm(result, makeSpell({ name: 'Suggestion', level: 2, range: '30 feet', usePsionicPayment: true }));

    await act(async () => {
      await result.current.handleConfirm({ totalCost: 0, options: [], psionicActive: false });
    });

    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true }),
      expect.objectContaining({ usePsionicPayment: true })
    );
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      metamagic: ['Psionic Sorcery'],
      spCost: 2,
    }));
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true })
    );
  });

  it('psionic-capable cast without psionic selection: cost and labels stay non-psionic', async () => {
    const { result, onExecute } = renderFlow();

    await arm(result, makeSpell({ name: 'Suggestion', level: 2, range: '30 feet' }));

    await act(async () => {
      await result.current.handleConfirm({ totalCost: 1, options: ['Subtle Spell'] });
    });

    expect(spendSorceryPoints).toHaveBeenCalledWith(CASTER, 1, CAMPAIGN, 10);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      metamagic: ['Subtle Spell'],
      spCost: 1,
    }));
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ psionicSpell: true })
    );
  });
});

// ── Lane guards: metamagic + multi-target no-pending (not in handler-guards) ──

describe('useSpellMetamagicFlow — metamagic/multi-target guards (no pending ⇒ no-op)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const guardRows = [
    { handler: 'handleConfirm', arg: { totalCost: 1, options: ['Empowered Spell'] }, pending: 'pendingMetamagic' },
    { handler: 'handleSkip', arg: undefined, pending: 'pendingMetamagic' },
    { handler: 'handleMultiTargetConfirm', arg: {}, pending: 'pendingMultiTarget' },
    { handler: 'handleMultiTargetSkip', arg: undefined, pending: 'pendingMultiTarget' },
  ];

  for (const row of guardRows) {
    it(`${row.handler} without pending spends nothing, logs nothing, executes nothing`, async () => {
      const { result, onExecute } = renderFlow();

      await act(async () => {
        await result.current[row.handler](row.arg);
      });

      expect(spendSorceryPoints).not.toHaveBeenCalled();
      expect(prepareSpellCast).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
      expect(result.current[row.pending]).toBeNull();
    });
  }
});
