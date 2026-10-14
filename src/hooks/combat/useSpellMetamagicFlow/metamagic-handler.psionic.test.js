import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMetamagicHandler } from './useMetamagicHandler.js';
import { spendSorceryPoints, getMaxSorceryPoints, logMetamagicUse } from '../useMetamagic.js';
import { addEntry } from '../../../services/ui/logService.js';
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js';

vi.mock('../useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 6),
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
    slotConsumed: false,
    freeCastUsed: false,
  })),
  isFreeCastAuthorized: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
}));

function makePlayerStats(overrides = {}) {
  return {
    name: 'AberrantSorcerer',
    class: { name: 'Sorcerer' },
    level: 6,
    ...overrides,
  };
}

function usePsionicHandler(pending, playerStats = makePlayerStats()) {
  const onExecute = vi.fn();
  const getPending = vi.fn(() => pending);
  const cfClearPending = vi.fn();
  const { handleConfirm } = useMetamagicHandler(playerStats, 'test-campaign', cfClearPending, getPending, onExecute);
  return { handleConfirm, onExecute, getPending, cfClearPending };
}

function makePending(overrides = {}) {
  return {
    spell: { name: 'Detect Thoughts', level: 2 },
    spellName: 'Detect Thoughts',
    spellLevel: 2,
    castingTime: '1 Action',
    _currentSP: 6,
    isPsionic: true,
    psionicCost: 2,
    _metaCtx: {},
    ...overrides,
  };
}

describe('useMetamagicHandler — CLA-271 Psionic Sorcery payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts SP cost once: spends metamagic-options cost only, forwards psionic payment', async () => {
    const { handleConfirm, onExecute } = usePsionicHandler(makePending());

    await handleConfirm({ options: ['Quickened Spell'], totalCost: 2, psionicActive: true, twinTarget: null });

    // Quickened = 2 SP paid here; the 2 SP psionic cost is paid by prepareSpellCast — once.
    expect(spendSorceryPoints).toHaveBeenCalledTimes(1);
    expect(spendSorceryPoints).toHaveBeenCalledWith('AberrantSorcerer', 2, 'test-campaign', getMaxSorceryPoints(makePlayerStats()));
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true }),
      expect.objectContaining({ usePsionicPayment: true })
    );
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      metamagic: expect.arrayContaining(['Quickened Spell', 'Psionic Sorcery']),
      spCost: 4,
    }));
    expect(logMetamagicUse).toHaveBeenCalledWith('test-campaign', 'AberrantSorcerer', 'Detect Thoughts', expect.arrayContaining(['Quickened Spell']), 4);
    expect(onExecute).toHaveBeenCalled();
  });

  it('psionic-only cast: no spendSorceryPoints call, prepareSpellCast receives usePsionicPayment (slot skipped)', async () => {
    const { handleConfirm } = usePsionicHandler(makePending());

    await handleConfirm({ options: [], totalCost: 0, psionicActive: true, twinTarget: null });

    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ usePsionicPayment: true })
    );
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      metamagic: ['Psionic Sorcery'],
      spCost: 2,
    }));
  });

  it('forwards usePsionicPayment from the spell-detail opt-in when popup checkbox untouched', async () => {
    const { handleConfirm } = usePsionicHandler(makePending({ spell: { name: 'Detect Thoughts', level: 2, usePsionicPayment: true } }));

    await handleConfirm({ options: [], totalCost: 0, psionicActive: false, twinTarget: null });

    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true }),
      expect.objectContaining({ usePsionicPayment: true })
    );
  });

  it('normal cast unchanged: no psionic selection, metamagic spent, usePsionicPayment false', async () => {
    const { handleConfirm } = usePsionicHandler(makePending({ isPsionic: false, psionicCost: 0 }));

    await handleConfirm({ options: ['Quickened Spell'], totalCost: 2, psionicActive: false, twinTarget: null });

    expect(spendSorceryPoints).toHaveBeenCalledWith('AberrantSorcerer', 2, 'test-campaign', getMaxSorceryPoints(makePlayerStats()));
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ psionicSpell: true }),
      expect.objectContaining({ usePsionicPayment: false })
    );
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      metamagic: ['Quickened Spell'],
      spCost: 2,
    }));
  });

  it('non-psionic spell checkbox-off control: no Psionic Sorcery option, slot path unchanged', async () => {
    const { handleConfirm } = usePsionicHandler(makePending({ isPsionic: false, psionicCost: 0 }));

    await handleConfirm({ options: [], totalCost: 0, psionicActive: false, twinTarget: null });

    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ psionicSpell: true }),
      expect.objectContaining({ usePsionicPayment: false })
    );
  });
});
