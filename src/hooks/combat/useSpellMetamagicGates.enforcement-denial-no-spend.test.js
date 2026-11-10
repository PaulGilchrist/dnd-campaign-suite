// @maintained-by-ai: 2026-11-10
// Owner ruling 2026-11-10 (bug-turnlock-spell-denial-pays-slot-and-material):
// an enforcement turn-lock DENIAL on the sheet spell-cast lane must cost
// NOTHING — the gateMetamagic entry gate (mirroring the attack lane's
// runAttackClick placement) runs BEFORE every payment lane below it:
// prepareSpellCast slot spend, consumeMaterial backpack write, and the
// chooser/metamagic queues that pay on confirm. Denial faces write ONLY the
// enforcement_denied row (FV2 clean-denial witness law, extended to all lanes).
// Harness mirrors the shared no-spend family (sp079-mass-suggestion /
// sp080-maze / sp125-warding-bond): module-mocked siblings, one gate() helper,
// assertCanAct mocked at the seam (its own matrix lives in assertCanAct.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { assertCanAct } from '../../services/combat/assertCanAct.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { consumeMaterial, getConsumedMaterial } from '../../services/rules/spells/materialComponents.js';
import { addEntry } from '../../services/ui/logService.js';
import { tryGateSpell } from './spellGates.js';

vi.mock('../../services/combat/assertCanAct.js', () => ({
  assertCanAct: vi.fn(() => ({ allowed: true, reason: null })),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(),
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
  getCreatureTargets: vi.fn(() => ['Bandit 1', 'Bandit 2']),
}));

const CAMPAIGN = 'test-campaign';

function makeWizard() {
  return {
    name: 'DivinationWizard',
    class: { name: 'Wizard' },
    level: 20,
    spellAbilities: { spell_slots_level_3: 3, saveDc: 19 },
  };
}

// Fixture mirrors the live repro rows: Animate Dead (lv3 Action, consumed
// material reagent) and Dispel Magic (lv3 Action, V/S — no material).
function makeAnimateDead() {
  return {
    name: 'Animate Dead',
    level: 3,
    casting_time: 'Action',
    range: '60 feet',
    concentration: false,
    automation: { type: 'animate_dead' },
  };
}

function makeDispelMagic() {
  return {
    name: 'Dispel Magic',
    level: 3,
    casting_time: 'Action',
    range: '120 feet',
    concentration: false,
    automation: { type: 'dispel_magic' },
  };
}

async function gate(spell, { isSorcerer = false, setPopupHtml = vi.fn() } = {}) {
  const playerStats = makeWizard();
  const onExecute = vi.fn();
  const cfSetPending = vi.fn();
  await gateMetamagic(spell, {}, {
    hasMaterial: () => true,
    setPopupHtml,
    isSorcerer,
    playerStats,
    campaignName: CAMPAIGN,
    cfSetPending,
    setSecondaryTargetModal: vi.fn(),
    characters: [],
    onExecute,
  });
  return { onExecute, cfSetPending, setPopupHtml };
}

function mockDenial(reason) {
  assertCanAct.mockReturnValue({ allowed: false, reason });
}

const TURN_LOCK_REASON = "It is Goblin's turn — DivinationWizard cannot act now.";

describe('enforcement denial on the sheet spell lane pays nothing (owner ruling 2026-11-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertCanAct.mockReturnValue({ allowed: true, reason: null });
    getConsumedMaterial.mockReturnValue(null);
    prepareSpellCast.mockImplementation(async (spell, passedCtx) => ({
      modifiedSpell: { ...spell },
      metaCtx: { ...passedCtx, slotConsumed: true },
      slotConsumed: true,
    }));
  });

  it('gates at the entry with the spell-classified bucket before any payment lane', async () => {
    await gate(makeDispelMagic());

    expect(assertCanAct).toHaveBeenCalledTimes(1);
    expect(assertCanAct).toHaveBeenCalledWith(expect.objectContaining({
      campaignName: CAMPAIGN,
      creatureName: 'DivinationWizard',
      bucket: 'action',
      source: 'useSpellMetamagicGates',
    }));
    // charge stays false at this site — the executor chokepoint owns the economy tap.
    expect(assertCanAct.mock.calls[0][0].charge).toBeUndefined();
  });

  it('denied lv3 Action cast (no material): zero slot spend, zero execution, zero log rows', async () => {
    mockDenial(TURN_LOCK_REASON);
    const { onExecute, cfSetPending } = await gate(makeDispelMagic());

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    // No chooser/metamagic queue either — the denial never opens a paying modal.
    expect(cfSetPending).not.toHaveBeenCalled();
    expect(tryGateSpell).not.toHaveBeenCalled();
  });

  it('denied cast WITH consumed material present: component NOT consumed, disk write skipped', async () => {
    mockDenial(TURN_LOCK_REASON);
    getConsumedMaterial.mockReturnValue({ itemName: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust', required: 'a drop of blood…' });
    const { onExecute } = await gate(makeAnimateDead());

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('denied sorcerer cast queues NO metamagic chooser (SP payment seam stays untouched)', async () => {
    mockDenial(TURN_LOCK_REASON);
    const { onExecute, cfSetPending } = await gate(makeDispelMagic(), { isSorcerer: true });

    expect(cfSetPending).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(prepareSpellCast).not.toHaveBeenCalled();
  });

  it('control: allowed cast still pays slot + consumes material exactly as before', async () => {
    getConsumedMaterial.mockReturnValue({ itemName: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust', required: 'a drop of blood…' });
    const { onExecute } = await gate(makeAnimateDead());

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'DivinationWizard' }),
      'Drop of Blood, Piece of Flesh, Pinch of Bone Dust',
      CAMPAIGN,
    );
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('control: missing-material refusal keeps its precedence — no assertCanAct call, no spend', async () => {
    getConsumedMaterial.mockReturnValue({ itemName: 'Black Onyx (150 gp)', required: 'one 150+ GP black onyx stone' });
    const playerStats = makeWizard();
    const onExecute = vi.fn();
    const setPopupHtml = vi.fn();
    await gateMetamagic({ name: 'Create Undead', level: 3, casting_time: 'Action', range: 'Touch' }, {}, {
      hasMaterial: () => false,
      setPopupHtml,
      isSorcerer: false,
      playerStats,
      campaignName: CAMPAIGN,
      cfSetPending: vi.fn(),
      setSecondaryTargetModal: vi.fn(),
      characters: [],
      onExecute,
    });

    expect(assertCanAct).not.toHaveBeenCalled();
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ automationType: 'material_refused' }));
  });

  it('control: sorcerer allowed cast still queues the metamagic chooser', async () => {
    const { onExecute, cfSetPending } = await gate(makeDispelMagic(), { isSorcerer: true });

    expect(cfSetPending).toHaveBeenCalledWith('metamagic', expect.objectContaining({ spellName: 'Dispel Magic', spellLevel: 3 }));
    expect(onExecute).not.toHaveBeenCalled();
  });
});
