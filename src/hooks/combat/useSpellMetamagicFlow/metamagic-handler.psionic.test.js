// @maintained-by-ai: 2026-10-15
// Psionic handler UNIT seam (CLA-271): useMetamagicHandler.handleConfirm payment
// arithmetic only — metamagic-options SP spent once, the Psionic Sorcery payment
// forwarded to prepareSpellCast (which owns slot skip), option/label application
// (Psionic Sorcery appended), and logged spCost totals. Gate→confirm wiring and
// gate psionicCost stamping live in useSpellMetamagicFlow.spellConfirm.test.js;
// popup payload breadth in confirm-payloads.test.js.
// Pinned against public/data/2024: Quickened Spell costs 2 SP (classes.json);
// Detect Thoughts is level 2 on the Aberrant Mind psionic list ⇒ psionicCost 2.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMetamagicHandler } from './useMetamagicHandler.js';
import { spendSorceryPoints, logMetamagicUse } from '../useMetamagic.js';
import { addEntry } from '../../../services/ui/logService.js';
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js';

const CASTER = 'AberrantSorcerer';
const CAMPAIGN = 'test-campaign';
const SPELL = 'Detect Thoughts';

vi.mock('../useMetamagic.js', () => ({
  getMaxSorceryPoints: vi.fn(() => 6),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(async (spell, metaCtx) => ({
    modifiedSpell: spell,
    metaCtx: { ...metaCtx },
  })),
  isFreeCastAuthorized: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
}));

function makePending(overrides = {}) {
  return {
    spell: { name: SPELL, level: 2 },
    spellName: SPELL,
    spellLevel: 2,
    castingTime: '1 Action',
    isPsionic: true,
    psionicCost: 2, // RAW: SP cost of Psionic Sorcery = spell level (2)
    _metaCtx: {},
    ...overrides,
  };
}

const playerStats = { name: CASTER, class: { name: 'Sorcerer' }, level: 6 };

function useHandler(pending) {
  const onExecute = vi.fn();
  const cfClearPending = vi.fn();
  const { handleConfirm } = useMetamagicHandler(
    playerStats, CAMPAIGN, cfClearPending, () => pending, onExecute,
  );
  return { handleConfirm, onExecute, cfClearPending };
}

// Each row: popup selection + pending state → expected payment split.
// `spend` = SP spent by the handler (null = never called; psionic SP is
// paid inside prepareSpellCast, so it never appears here);
// `metamagic`/`spCost` = the single canonical log entry payload.
const CASES = [
  {
    name: 'metamagic + psionic: options cost spent once, psionic cost folded into logs',
    pending: {},
    options: ['Quickened Spell'], totalCost: 2, psionicActive: true,
    spend: 2, psionic: true,
    metamagic: ['Quickened Spell', 'Psionic Sorcery'], spCost: 4,
  },
  {
    name: 'psionic-only cast: nothing spent here, prepareSpellCast gets usePsionicPayment (slot skipped)',
    pending: {},
    options: [], totalCost: 0, psionicActive: true,
    spend: null, psionic: true,
    metamagic: ['Psionic Sorcery'], spCost: 2,
  },
  {
    name: 'spell-detail opt-in (spell.usePsionicPayment) forwards even with popup checkbox off',
    pending: { spell: { name: SPELL, level: 2, usePsionicPayment: true } },
    options: [], totalCost: 0, psionicActive: false,
    spend: null, psionic: true,
    metamagic: ['Psionic Sorcery'], spCost: 2,
  },
  {
    name: 'normal cast: metamagic spent at options cost, no psionic flags anywhere',
    pending: { isPsionic: false, psionicCost: 0 },
    options: ['Quickened Spell'], totalCost: 2, psionicActive: false,
    spend: 2, psionic: false,
    metamagic: ['Quickened Spell'], spCost: 2,
  },
  {
    name: 'non-psionic cast with no options: no spend, no log cost, slot path unchanged',
    pending: { isPsionic: false, psionicCost: 0 },
    options: [], totalCost: 0, psionicActive: false,
    spend: null, psionic: false,
    metamagic: [], spCost: 0,
  },
];

describe('useMetamagicHandler — CLA-271 Psionic Sorcery payment (unit seam)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(CASES)('$name', async ({ pending, options, totalCost, psionicActive, spend, psionic, metamagic, spCost }) => {
    const { handleConfirm, onExecute, cfClearPending } = useHandler(makePending(pending));

    await handleConfirm({ options: [...options], totalCost, psionicActive, twinTarget: null });

    expect(cfClearPending).toHaveBeenCalledWith('metamagic');

    if (spend === null) {
      expect(spendSorceryPoints).not.toHaveBeenCalled();
    } else {
      // 6 = mocked getMaxSorceryPoints ceiling for this level-6 sorcerer.
      expect(spendSorceryPoints).toHaveBeenCalledTimes(1);
      expect(spendSorceryPoints).toHaveBeenCalledWith(CASTER, spend, CAMPAIGN, 6);
    }

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: SPELL }),
      psionic ? { psionicSpell: true } : {},
      expect.objectContaining({ usePsionicPayment: psionic }),
    );

    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      spellName: SPELL,
      metamagic,
      spCost,
    }));

    if (spCost > 0) {
      expect(logMetamagicUse).toHaveBeenCalledWith(CAMPAIGN, CASTER, SPELL, metamagic, spCost);
    } else {
      expect(logMetamagicUse).not.toHaveBeenCalled();
    }

    expect(onExecute).toHaveBeenCalledTimes(1);
  });
});
