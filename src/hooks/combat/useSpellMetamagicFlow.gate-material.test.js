// @maintained-by-ai 2026-11-26
// Material-component gate wiring at the HOOK seam: useSpellMetamagicFlow must
// thread the real hasMaterial/consumeMaterial service, its own setPopupHtml
// sink, and the campaignName into gateMetamagic (useSpellMetamagicGates.js),
// where the consumed-material check runs BEFORE spellGates, the sorcerer
// metamagic queue, and every payment lane. This file owns only that wiring:
// pass-when-carried / pass-when-no-registry-entry (queues the metamagic
// chooser), refuse-with-popup-and-audit-row-through-the-hook-sink, and gate
// ordering against the REAL spellGates module.
// Deferred to stronger siblings: full refusal bytes + material_refused audit
// row shape (useSpellMetamagicGates.material-refused), Revivify material
// precedence + row census (useSpellMetamagicGates.revivify-material-precedence),
// refusal with an absent popup sink (same material-refused lane), and the
// Wild Companion waiver (useSpellMetamagicGates.wildCompanionMaterials).
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
import { addEntry } from '../../services/ui/logService.js';

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

describe('useSpellMetamagicFlow — material component gating (hook wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({ creatures: [] });
  });

  describe.each([
    {
      label: 'no consumed-material registry entry (Fireball)',
      spell: { name: 'Fireball', level: 3, casting_time: '1 Action', range: '150 ft.' },
      backpack: [],
    },
    {
      label: 'exact-name reagent carried (Greater Restoration + Diamond Dust)',
      spell: { name: 'Greater Restoration', level: 5 },
      backpack: ['Diamond Dust (100 gp)'],
    },
  ])('gate passes — $label', ({ spell, backpack }) => {
    it('queues the sorcerer metamagic chooser unmolested: no popup, no consumption', async () => {
      // Fireball carries a free material in spells.json but no costly/consumed
      // MATERIAL_REGISTRY row (gate must not fire); the carried-leg proves the
      // real hasMaterial match unlocks the gate. Consumption is deferred — this
      // lane only queues the chooser.
      const { result, setPopupHtml, onExecute } = renderFlow({ backpack });

      await act(async () => {
        await result.current.gateMetamagic(spell);
      });

      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(consumeMaterial).not.toHaveBeenCalled();
      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spellName).toBe(spell.name);
      expect(onExecute).not.toHaveBeenCalled();
    });
  });

  it('refuses a missing reagent through the hook sink: material_refused popup + audit row, nothing spent', async () => {
    // Full refusal bytes and the audit-row shape are pinned stronger by
    // useSpellMetamagicGates.material-refused; this pins the HOOK wiring: the
    // refusal reaches the caller's setPopupHtml, is logged under the hook's
    // campaignName, blocks the cast, and never arms the metamagic queue.
    const { result, setPopupHtml, onExecute } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic({ name: 'Greater Restoration', level: 5 });
    });

    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      name: 'Greater Restoration',
      automationType: 'material_refused',
      description: expect.stringMatching(
        /^Greater Restoration refused: material component Diamond Dust \(100 gp\) is not in TestSorcerer's backpack\. Nothing spent\./
      ),
    }));
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      automationType: 'material_refused',
      material: 'Diamond Dust (100 gp)',
    }));
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
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
      automationType: 'material_refused',
    }));
    expect(result.current.pendingGreaterRestoration).toBeNull();
    expect(result.current.pendingMetamagic).toBeNull();
    expect(onExecute).not.toHaveBeenCalled();
  });
});
