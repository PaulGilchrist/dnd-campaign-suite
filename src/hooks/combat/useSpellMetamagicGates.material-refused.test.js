// @maintained-by-ai: 2026-11-10
// Missing-material cast refusal on the gateMetamagic lane (useSpellMetamagicGates.js):
// refuse-must-log-and-popup law (2026-11-10 improve). A registry-gated spell whose
// exact MATERIAL_REGISTRY itemName is NOT in the caster's backpack must (a) popup with
// explicit REFUSAL framing naming the spell + item + backpack — not merely the spell's
// verbatim material sentence with a lone Done — and (b) write a material_refused audit
// row to the campaign log (mirrors the maze_refused / warding_bond_refused /
// enforcement_denied refusal-row conventions; same automation/addEntry channel).
// Zero-cost refusal: no slot spend, no consumeMaterial backpack write, no chooser
// queue, and the material gate keeps precedence over the enforcement gate (the
// enforcement-denial matrix is owned by
// useSpellMetamagicGates.enforcement-denial-no-spend.test.js).
// Like the wildCompanion/gate-material siblings, the material service is ONLY partially
// mocked — getConsumedMaterial, hasMaterial, and getMaterialRequirementMessage run for
// REAL against MATERIAL_REGISTRY, so these tests validate actual gate data. Only
// consumeMaterial is stubbed (it PATCHes the character file).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { hasMaterial, consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { addEntry } from '../../services/ui/logService.js';
import { assertCanAct } from '../../services/combat/assertCanAct.js';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/assertCanAct.js', () => ({
  assertCanAct: vi.fn(() => ({ allowed: true, reason: null })),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/materialComponents.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, consumeMaterial: vi.fn(() => Promise.resolve(true)) };
});

// Real MATERIAL_REGISTRY loads the module's runtime-store import — stub it (PATCH side effects).
vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {}, slotConsumed: false })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 0),
  getMaxSorceryPoints: vi.fn(() => 0),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('./spellGates.js', () => ({
  tryGateSpell: vi.fn(() => false),
}));

vi.mock('./useSpellMetamagicHelpers.js', () => ({
  getCreatureTargets: vi.fn(() => []),
}));

const CAMPAIGN = 'test-campaign';
const CASTER = 'DivinationWizard';

// Disk-shaped fixtures: Animate Dead (success face opens the .sp-overlay confirm modal)
// and Divination (no confirm modal — casts straight through) — both registry-gated.
const animateDead = {
  name: 'Animate Dead',
  level: 3,
  casting_time: 'Action',
  range: '60 feet',
  concentration: false,
  automation: { type: 'animate_dead' },
};
const divination = {
  name: 'Divination',
  level: 4,
  casting_time: 'Action',
  range: 'Self',
  concentration: false,
};
// 5e disk-canonical spelling — resolves the shared 'Stone Skin' registry row via the
// exact-match alias edge (dual-ruleset coverage: both rows gate through this one lane).
const stoneskin5e = { name: 'Stoneskin', level: 4, casting_time: 'Action', range: 'Touch' };

function makeWizard(backpack = []) {
  return {
    name: CASTER,
    class: { name: 'Wizard' },
    level: 20,
    inventory: { backpack },
    spellAbilities: { spell_slots_level_3: 3, spell_slots_level_4: 3 },
  };
}

async function gate(spell, { backpack = [], isSorcerer = false, setPopupHtml = vi.fn() } = {}) {
  const onExecute = vi.fn();
  const cfSetPending = vi.fn();
  const setSecondaryTargetModal = vi.fn();
  await gateMetamagic(spell, {}, {
    hasMaterial,
    setPopupHtml,
    isSorcerer,
    playerStats: makeWizard(backpack),
    campaignName: CAMPAIGN,
    cfSetPending,
    setSecondaryTargetModal,
    characters: [],
    onExecute,
  });
  return { onExecute, cfSetPending, setPopupHtml };
}

const expectedRefusal = (spell, itemName) =>
  `${spell.name} refused: material component ${itemName} is not in ${CASTER}'s backpack. Nothing spent.`;

describe('missing-material cast refusal — refusal copy + audit row (gate lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertCanAct.mockReturnValue({ allowed: true, reason: null });
  });

  describe.each([
    {
      label: 'modal-confirm spell (Animate Dead)',
      spell: animateDead,
      itemName: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust',
      requirement: 'Animate Dead requires a drop of blood, a piece of flesh, and a pinch of bone dust, which the spell consumes.',
    },
    {
      label: 'non-modal spell (Divination)',
      spell: divination,
      itemName: 'Incense (25 gp)',
      requirement: 'Divination requires incense worth 25+ GP, which the spell consumes.',
    },
  ])('$spell.name — $label, reagent absent', ({ spell, itemName, requirement }) => {
    it('popups with explicit REFUSAL framing, not the bare verbatim material sentence', async () => {
      const { setPopupHtml } = await gate(spell);

      expect(setPopupHtml).toHaveBeenCalledTimes(1);
      const popup = setPopupHtml.mock.calls[0][0];
      expect(popup).toEqual({
        type: 'automation_info',
        name: spell.name,
        automationType: 'material_refused',
        description: `${expectedRefusal(spell, itemName)} ${requirement}`,
      });
      // Defensive copy pins: the framing survives even if the sentence is re-worded.
      expect(popup.description).toContain('refused');
      expect(popup.description).toContain(itemName);
      expect(popup.description).toContain('backpack');
      expect(popup.automationType).not.toBe('material_required');
    });

    it('writes a material_refused automation audit row naming the spell and the reason', async () => {
      const { setPopupHtml } = await gate(spell);
      expect(setPopupHtml).toHaveBeenCalledTimes(1); // popup AND row, never either alone
      expect(addEntry).toHaveBeenCalledTimes(1);
      const [campaign, entry] = addEntry.mock.calls[0];
      expect(campaign).toBe(CAMPAIGN);
      expect(entry).toEqual({
        type: 'automation',
        automationType: 'material_refused',
        reason: 'material_missing',
        characterName: CASTER,
        abilityName: spell.name,
        spellName: spell.name,
        material: itemName,
        description: expectedRefusal(spell, itemName),
        timestamp: expect.any(Number),
      });
    });

    it('still logs the refusal row when the popup sink is absent', async () => {
      const { onExecute } = await gate(spell, { setPopupHtml: undefined });

      expect(onExecute).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledTimes(1); // refusal does not depend on the UI sink
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        automationType: 'material_refused',
        description: expectedRefusal(spell, itemName),
      }));
    });

    it('costs nothing: no slot, no material write, no roll/exec, no chooser queue, and preempts the enforcement gate', async () => {
      const { onExecute, cfSetPending } = await gate(spell, { isSorcerer: true });

      expect(prepareSpellCast).not.toHaveBeenCalled();
      expect(consumeMaterial).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
      expect(cfSetPending).not.toHaveBeenCalled();
      // Material gate precedence: refusal never reaches the enforcement gate.
      expect(assertCanAct).not.toHaveBeenCalled();
    });
  });

  it('refuses the 5e Stoneskin spelling through the shared Stone Skin registry row', async () => {
    const { setPopupHtml } = await gate(stoneskin5e);

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      automationType: 'material_refused',
      description: `${expectedRefusal(stoneskin5e, 'Diamond Dust (100 gp)')} Stoneskin requires diamond dust worth 100+ GP, which the spell consumes.`,
    }));
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      automationType: 'material_refused',
      abilityName: 'Stoneskin',
      material: 'Diamond Dust (100 gp)',
    }));
  });

  it('control: carried reagent — no refusal popup or row, the paid lane pays slot + consumes as before', async () => {
    const { onExecute, setPopupHtml } = await gate(animateDead, {
      backpack: ['Drop of Blood, Piece of Flesh, Pinch of Bone Dust'],
    });

    expect(setPopupHtml).not.toHaveBeenCalled();
    const refusalRows = addEntry.mock.calls.filter(([, e]) => e.automationType === 'material_refused');
    expect(refusalRows).toHaveLength(0);
    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ name: CASTER }),
      'Drop of Blood, Piece of Flesh, Pinch of Bone Dust',
      CAMPAIGN,
    );
    expect(onExecute).toHaveBeenCalledTimes(1);
  });
});
