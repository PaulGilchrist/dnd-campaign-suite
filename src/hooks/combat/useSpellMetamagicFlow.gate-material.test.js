// @maintained-by-ai: 2026-10-15
// Material-component / reagent gate seam of the useSpellMetamagicFlow lane.
// gateMetamagic (useSpellMetamagicGates.js) checks consumed materials BEFORE
// spellGates, multi-target, maze/warding-bond refusals, and the sorcerer
// metamagic queue. This file owns that seam only: block-when-missing, pass-
// when-carried, popup-without-setPopupHtml, and gate ordering. The Wild
// Companion waiver is owned by useSpellMetamagicGates.wildCompanionMaterials.
//
// The material service is ONLY partially mocked: getConsumedMaterial,
// hasMaterial, and getMaterialRequirementMessage run for REAL against the
// current MATERIAL_REGISTRY (kept in sync with spells.json), so these tests
// validate actual gate data. Only consumeMaterial is stubbed (it PATCHes the
// character file; the sorcerer gate lane never reaches it).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/rules/spells/materialComponents.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, consumeMaterial: vi.fn(async () => true) };
});

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSorcerer(backpack = []) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    inventory: { backpack },
  };
}

function renderFlow({ backpack = [], setPopupHtml = vi.fn(), onExecute = vi.fn() } = {}) {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: makeSorcerer(backpack),
      campaignName: 'TestCampaign',
      onExecute,
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml,
    })
  );
  return { result, setPopupHtml, onExecute };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — material component gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({ creatures: [] });
  });

  it('passes a spell with no consumed-material registry entry through unmolested', async () => {
    // Fireball has a free material in spells.json but no costly/consumed
    // MATERIAL_REGISTRY row — the gate must not fire, and the sorcerer cast
    // queues for metamagic selection without popup or consumption.
    const { result, setPopupHtml, onExecute } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic({ name: 'Fireball', level: 3, casting_time: '1 Action', range: '150 ft.' });
    });

    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellName).toBe('Fireball');
    expect(onExecute).not.toHaveBeenCalled();
  });

  describe.each([
    {
      spell: { name: 'Greater Restoration', level: 5 },
      itemName: 'Diamond Dust (100 gp)',
      description: 'Greater Restoration requires diamond dust worth 100+ GP, which the spell consumes.',
    },
    {
      spell: { name: 'Forcecage', level: 7 },
      itemName: 'Ruby Dust (1,500 gp)',
      description: 'Forcecage requires ruby dust worth 1,500+ GP, which the spell consumes.',
    },
    {
      spell: { name: 'Revivify', level: 3 },
      itemName: 'Diamond (300 gp)',
      description: 'Revivify requires a diamond worth 300+ GP, which the spell consumes.',
    },
  ])('$name without $itemName in backpack', ({ spell, description }) => {
    it('shows the material_required popup and blocks the cast', async () => {
      const { result, setPopupHtml, onExecute } = renderFlow();

      await act(async () => {
        await result.current.gateMetamagic(spell);
      });

      expect(setPopupHtml).toHaveBeenCalledTimes(1);
      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: spell.name,
        automationType: 'material_required',
        description,
      });
      expect(consumeMaterial).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
      expect(result.current.pendingMetamagic).toBeNull();
    });
  });

  it('proceeds to metamagic pending when the consumed material is carried', async () => {
    // Exact-name backpack match (hasMaterial) unlocks the gate; consumption
    // is deferred — the sorcerer lane only queues the metamagic chooser here.
    const { result, setPopupHtml, onExecute } = renderFlow({
      backpack: ['Diamond Dust (100 gp)'],
    });

    await act(async () => {
      await result.current.gateMetamagic({ name: 'Greater Restoration', level: 5 });
    });

    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellName).toBe('Greater Restoration');
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('still blocks the cast when setPopupHtml is missing', async () => {
    const onExecute = vi.fn();
    const { result } = renderFlow({ setPopupHtml: undefined, onExecute });

    await act(async () => {
      await result.current.gateMetamagic({ name: 'Greater Restoration', level: 5 });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).toBeNull();
  });

  it('checks materials before the target chooser gate', async () => {
    // With combat targets available, gateGreaterRestoration (spellGates) would
    // claim this cast — a missing consumed material must short-circuit FIRST,
    // so no greaterRestoration pending chooser is ever queued.
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'AllyOne' }] });
    const { result, setPopupHtml, onExecute } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic({ name: 'Greater Restoration', level: 5 });
    });

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      automationType: 'material_required',
    }));
    expect(result.current.pendingGreaterRestoration).toBeNull();
    expect(result.current.pendingMetamagic).toBeNull();
    expect(onExecute).not.toHaveBeenCalled();
  });
});
