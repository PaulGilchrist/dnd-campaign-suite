// @maintained-by-ai: 2026-10-15
// SP-080 no-spend family (§CLA-208 pay-no-effect) gate lane: Maze has no chooser
// modal, so gateMetamagic resolves the exact same armed initiative target mazeHandler
// will use (getCombatContext + targetResolver.resolveTarget) and refuses UNPAID in
// all three unresolvable branches — no creatures in combat, no armed target, armed
// target no longer in combat — before prepareSpellCast/consumeMaterial/addEntry
// (no slot, no caster concentration, no phantom cast). Refusal face: automation_info
// popup plus one `maze_refused` automation log ending "Nothing spent." An armed
// valid target keeps the paid lane verbatim; unlike sp079's deferred chooser, the
// gate fires before the sorcerer metamagic queue too.
// Shared no-spend family pattern (twin: sp079-mass-suggestion): fixtures mirror
// public/data/2024/spells.json, table-drive cases, one gate() helper, paid-lane
// control (the ordinary-spell control lives in sp079 — not repeated here).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { addEntry } from '../../services/ui/logService.js';
import { resolveTarget } from '../../services/automation/common/targetResolver.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';

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
  getCreatureTargets: vi.fn(() => []),
}));

vi.mock('../../services/automation/common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';

function makeWizard() {
  return {
    name: 'DivinationWizard',
    class: { name: 'Wizard' },
    level: 20,
    spellAbilities: { spell_slots_level_8: 1, saveDc: 19 },
  };
}

// Fixture mirrors public/data/2024/spells.json Maze (lv8, Action, 60 feet,
// concentration, automation { type: 'maze', saveType: 'WIS', range: '60 feet' } —
// no saveDc key in the data). The 5e row carries no automation block; the
// name-side branch of isMazeSpell gates it identically.
function makeMaze(overrides = {}) {
  return {
    name: 'Maze',
    level: 8,
    casting_time: 'Action',
    range: '60 feet',
    concentration: true,
    automation: { type: 'maze', saveType: 'WIS', range: '60 feet' },
    ...overrides,
  };
}

async function gate(spell, { isSorcerer = false } = {}) {
  const playerStats = makeWizard();
  const onExecute = vi.fn();
  const setPopupHtml = vi.fn();
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
  return { onExecute, setPopupHtml, cfSetPending };
}

describe('SP-080 unarmed Maze cast — refused unpaid before any payment lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Snapshot semantics of the real prepareSpellCast (used by the paid-lane control).
    prepareSpellCast.mockImplementation(async (spell, passedCtx) => ({
      modifiedSpell: { ...spell },
      metaCtx: { ...passedCtx, slotConsumed: true },
      slotConsumed: true,
    }));
    consumeMaterial.mockResolvedValue(true);
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'DivinationWizard' }, { name: 'Androsphinx 1' }] });
    resolveTarget.mockResolvedValue(null);
  });

  const REFUSAL_CASES = [
    {
      name: 'no armed initiative target',
      resolved: null,
      head: 'No target selected.',
      reason: 'no_target',
    },
    {
      name: 'no creatures in combat',
      combat: { creatures: [] },
      resolved: null,
      head: 'No creatures in combat.',
      reason: 'no_creatures',
    },
    {
      name: 'armed target no longer in combat',
      resolved: { target: { name: 'Androsphinx 2' } },
      head: 'Target "Androsphinx 2" not found in combat.',
      reason: 'no_target',
    },
  ];

  describe.each(REFUSAL_CASES)('$name — refuse face verbatim, nothing spent', ({ combat, resolved, head, reason }) => {
    it('spends nothing (no slot, no material, no cast log) and emits the handler refusal face', async () => {
      if (combat) getCombatContext.mockResolvedValue(combat);
      resolveTarget.mockResolvedValue(resolved);

      const { onExecute, setPopupHtml } = await gate(makeMaze());

      expect(prepareSpellCast).not.toHaveBeenCalled();
      expect(consumeMaterial).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();

      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Maze',
        automationType: 'maze_refused',
        description: `${head} Maze has no effect.`,
      });
      expect(addEntry).toHaveBeenCalledTimes(1);
      const refused = addEntry.mock.calls[0][1];
      expect(refused).toMatchObject({
        type: 'automation',
        automationType: 'maze_refused',
        reason,
        characterName: 'DivinationWizard',
        abilityName: 'Maze',
      });
      expect(refused.description).toBe(`Maze refused: ${head.charAt(0).toLowerCase()}${head.slice(1)} Nothing spent.`);
    });
  });

  it('control: armed valid target keeps the paid lane verbatim — prepareSpellCast pays once, onExecute runs, zero refusals', async () => {
    resolveTarget.mockResolvedValue({ target: { name: 'Androsphinx 1' } });

    const { onExecute, setPopupHtml } = await gate(makeMaze());

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(addEntry).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('control: sorcerer unarmed Maze is refused before the metamagic queue (unlike sp079 deferred chooser)', async () => {
    const { onExecute, cfSetPending, setPopupHtml } = await gate(makeMaze(), { isSorcerer: true });

    expect(cfSetPending).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ automationType: 'maze_refused' }));
    expect(addEntry.mock.calls[0][1]).toMatchObject({ automationType: 'maze_refused', reason: 'no_target' });
  });
});
