// @maintained-by-ai: 2026-11-15
//
// PX 2026-11-15 improve (gate-revive refusal asymmetry) — gate-precedence face:
// gateMetamagic's material gate runs BEFORE tryGateSpell → gateRevivify, so a
// Revivify caster lacking `Diamond (300 gp)` must refuse with ONLY the
// material_refused row + the "Nothing spent." popup — the revive gate (and its new
// revivify_refused row) is never reached: exactly ONE audit row, never two. With
// the diamond carried, the material gate passes, the spell gate consumes the cast,
// and NO material_refused row lands. Mirrors the material-refused test's partial
// mocking: getConsumedMaterial/hasMaterial run for REAL against MATERIAL_REGISTRY;
// the spellGates module is stubbed to record whether the revive gate was reached
// (its own revivify_refused row bytes are pinned in
// spellGates.revivify-refused-row.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { hasMaterial, consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { addEntry } from '../../services/ui/logService.js';
import { assertCanAct } from '../../services/combat/assertCanAct.js';
import { tryGateSpell } from './spellGates.js';

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

// The revive gate consumed the cast (real gateRevivify returns true on both the
// picker-open and refusal faces); record the reach instead of running its board census.
vi.mock('./spellGates.js', () => ({
  tryGateSpell: vi.fn(() => true),
}));

vi.mock('./useSpellMetamagicHelpers.js', () => ({
  getCreatureTargets: vi.fn(() => []),
}));

const CAMPAIGN = 'test-campaign';
const CASTER = 'War_Cleric';
const revivify = {
  name: 'Revivify',
  level: 3,
  casting_time: 'Action',
  range: 'Touch',
  concentration: false,
  automation: { type: 'revivify' },
};

function makeCleric(backpack = []) {
  return {
    name: CASTER,
    class: { name: 'Cleric' },
    level: 9,
    inventory: { backpack },
    spellAbilities: { spell_slots_level_3: 4 },
  };
}

async function gate({ backpack = [], setPopupHtml = vi.fn() } = {}) {
  const onExecute = vi.fn();
  const cfSetPending = vi.fn();
  await gateMetamagic(revivify, {}, {
    hasMaterial,
    setPopupHtml,
    isSorcerer: false,
    playerStats: makeCleric(backpack),
    campaignName: CAMPAIGN,
    cfSetPending,
    setSecondaryTargetModal: vi.fn(),
    characters: [],
    onExecute,
  });
  return { onExecute, cfSetPending, setPopupHtml };
}

describe('Revivify gate precedence — material gate first, revivify_refused row never doubles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertCanAct.mockReturnValue({ allowed: true, reason: null });
  });

  it('caster lacking Diamond (300 gp): ONE material_refused row only — the revive gate is never reached', async () => {
    const { setPopupHtml, onExecute } = await gate();

    // Exactly one audit row, and it is the material one.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      automationType: 'material_refused',
      reason: 'material_missing',
      material: 'Diamond (300 gp)',
    }));
    // Popup keeps the material refusal framing with the "Nothing spent." tail.
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      automationType: 'material_refused',
      description: expect.stringContaining('Nothing spent.'),
    }));
    // The gate that writes revivify_refused never runs → no second row is possible.
    expect(tryGateSpell).not.toHaveBeenCalled();
    // Zero-cost refusal.
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('control: diamond carried — no material_refused row; the revive gate consumes the cast', async () => {
    const { onExecute } = await gate({ backpack: ['Diamond (300 gp)'] });

    expect(tryGateSpell).toHaveBeenCalledWith('Revivify', CAMPAIGN, expect.any(Function), expect.objectContaining({
      playerStats: expect.objectContaining({ name: CASTER }),
    }));
    const refusalRows = addEntry.mock.calls.filter(([, e]) => e.automationType === 'material_refused');
    expect(refusalRows).toHaveLength(0);
    // The gate handled it: the generic paid lane (slot spend / material consumption) never runs.
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});
