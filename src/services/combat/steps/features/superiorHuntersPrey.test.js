// @maintained-by-ai
/**
 * Unit lane — superiorHuntersPrey.js decision bytes with MOCKED collaborators.
 *
 * Family map (hunter-prey domain, #1050): hunterPreyHandler.test.js owns the
 * "_Hunter's_Prey_choice" prompt; colossusSlayer.test.js:21 cites THIS lane as
 * the upgrade owner — the 1d6→1d10 Foe-Slayer ladder (source :49-50) lives here,
 * hand-derived once (#815), PRESERVED. Integration sibling (just closed #1059)
 * owns the REAL-module proofs: real-store round-4 selection chain, real grid
 * map-filter, POST persistence, denial/re-fire, exact popup bytes, full offer
 * bytes (title/confirmLabel/description/targets+HP ladder). Per #1038 dup-map,
 * legs byte-matching that lane are CUT here; only mocked-collaborator call
 * bytes the integration lane deliberately doesn't spy stay (getCurrentCombatRound
 * campaignName passthrough, campaign-keyed latch READ/WRITE bytes, characters
 * read byte, exact applyDamage/addEntry call bytes through mock seams, and the
 * no-mapName → rangeCheck-never-consulted gate).
 *
 * Applied-recs verdicts (#1059 ×2):
 *  ✔ condition false-shapes (missing automation, {}, passives null, [], other
 *    types) folded to one table test; round-0 latch folded into the strict-===
 *    suite as the 0-byte falsifier (0===0 blocks; a truthiness guard would
 *    wrongly re-fire — integration cannot run round 0, so this stays unit-owned).
 *  ✔ unit-vs-integration split honored: popup test cut (integration pins
 *    setPopupHtml updater exactly); dedicated offer test cut (integration pins
 *    offer bytes exactly); ladder gains the lvl-19 just-below boundary leg.
 *
 * Old→new: condition ×6→2; early-returns ×8→3 (context-null; attacker/conc
 * gate table — wrong-spell and wrong-target legs carry a Goblin1 mark + Orc1
 * decoy so a dropped guard would OPEN a modal, honest distinguishers #1022;
 * marked/candidate table folds no-target-unrestricted :47 and only-player :54);
 * used-round ×2 + CLA-346 refire ×2→1 latch suite; campaign-thread + stamp ×2
 * folded into chain; modal ×7→ladder ×1 + skip + falsy-select ×2→1; damage ×9
 *→chain ×1 (expect.anything()→exact summary, objectContaining→exact log #829)
 * + roll-null + cs-null. 37→12 tests.
 *
 * Mock hygiene (#1049/#1051/#1057): every import is asserted (isWithinRange as
 * the never-consulted falsifier); faithful campaign-keyed store mock, no
 * call-scanning; rt map + default collaborator answers re-armed each
 * beforeEach for determinism; dice table deterministic (#1026); latch key
 * '_Superior_Hunters_Prey_UsedRound' (no apostrophe — #1050) verbatim;
 * zero-side-effect gates on every denial path (#936); no wall-clock timers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { superiorHuntersPrey } from './superiorHuntersPrey.js';

import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ──────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const LATCH = '_Superior_Hunters_Prey_UsedRound'; // no apostrophe — verbatim (#1050)
const PREV = { formula: '1d8+3', total: 11, rolls: [8, 3] };

// Faithful campaign-keyed store shape — value lookup by key, never call-scanning (#1051).
let rt;

const ranger = (extra = {}) => ({
  name: 'Ranger1',
  concentration: { spell: "Hunter's Mark", target: 'Orc1' },
  ...extra,
});

// Arm the happy-path collaborators; returns the combat summary loadCombatSummary
// will resolve so the chain can pin applyDamage's first-arg identity.
function armOffer({ round = 1, creatures = [ranger(), { name: 'Orc1' }, { name: 'Goblin1', currentHp: 5, maxHp: 10 }] } = {}) {
  const summary = { round, creatures };
  getCombatContext.mockResolvedValue({ creatures });
  getCurrentCombatRound.mockReturnValue(round);
  loadCombatSummary.mockResolvedValue(summary);
  return summary;
}

async function open(overrides = {}) {
  const setSecondaryTargetModal = vi.fn();
  const ctx = {
    campaignName: CAMPAIGN,
    playerStats: { name: 'Ranger1', level: 1, class: { name: 'Ranger' } },
    targetName: 'Orc1',
    setSecondaryTargetModal,
    ...overrides,
  };
  const result = await superiorHuntersPrey.handler(ctx, PREV);
  return { ctx, result, setSecondaryTargetModal };
}

const denied = (result, modal, name) => {
  expect(result, name).toEqual({ data: PREV });
  expect(modal, name).not.toHaveBeenCalled();
};

// ── Tests ────────────────────────────────────────────────────────

describe('superiorHuntersPrey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rt = new Map();
    getRuntimeValue.mockImplementation((name, key) => rt.get(`${name}.${key}`) ?? null);
    // Deterministic dice table (#1026): 1d6→4, 1d10→9.
    rollExpression.mockImplementation((formula) =>
      formula === '1d10' ? { total: 9, rolls: [9], modifier: 0, formula: '1d10' }
        : { total: 4, rolls: [4], modifier: 0, formula: '1d6' });
    applyDamageToTarget.mockImplementation((_cs, _name, amount) => ({ finalDamage: amount, newHp: 1 }));
    addEntry.mockResolvedValue(undefined);
    loadCombatSummary.mockResolvedValue({ creatures: [] });
  });

  describe('condition', () => {
    it('true only for the superior_hunter_prey passive byte', () => {
      expect(superiorHuntersPrey.condition({
        playerStats: { automation: { passives: [{ type: 'superior_hunter_prey' }] } },
      })).toBe(true);
    });

    // #1059 fold: all four false-shapes hit the `(automation?.passives || []).some` byte.
    it.each([
      ['automation missing', {}],
      ['automation empty', { automation: {} }],
      ['passives null', { automation: { passives: null } }],
      ['passives empty', { automation: { passives: [] } }],
      ['other passives only', { automation: { passives: [{ type: 'hex' }, { type: 'divine_favor' }] } }],
    ])('false when %s', (_label, playerStats) => {
      expect(superiorHuntersPrey.condition({ playerStats })).toBe(false);
    });
  });

  describe('handler — gates deny with zero side effects', () => {
    it('null combat context returns prevData before any round or latch read', async () => {
      getCombatContext.mockResolvedValue(null);

      const { result, setSecondaryTargetModal } = await open();

      expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
      denied(result, setSecondaryTargetModal, 'null context');
      expect(getCurrentCombatRound).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    // Attacker/concentration gates (source :25-26). Wrong-spell and wrong-target
    // legs carry a hit-able Goblin1 mark + Orc1 decoy so a dropped guard would
    // OPEN a modal — each leg distinguishes its own byte (#1022).
    it.each([
      ['attacker absent', [{ name: 'SomeoneElse' }, { name: 'Orc1' }]],
      ['creatures undefined', undefined],
      ['creatures null', null],
      ['concentration null', [{ name: 'Ranger1', concentration: null }, { name: 'Orc1' }]],
      ['concentration on another spell', [{ name: 'Ranger1', concentration: { spell: 'Hex', target: 'Orc1' } }, { name: 'Orc1' }]],
      ['mark on a different target', [{ name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Goblin1' } }, { name: 'Orc1' }, { name: 'Goblin1' }]],
    ])('%s returns prevData with no round read, modal, or latch write', async (_label, creatures) => {
      getCombatContext.mockResolvedValue({ creatures });
      getCurrentCombatRound.mockReturnValue(1);

      const { result, setSecondaryTargetModal } = await open();

      denied(result, setSecondaryTargetModal, _label);
      expect(getCurrentCombatRound).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    // Post-gate denials (:47, :54): unresolvable mark OR no valid candidate.
    it.each([
      ['marked target absent from creatures', [{ name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Ghost1' } }, { name: 'Orc1' }]],
      ['concentration with no target (unrestricted)', [{ name: 'Ranger1', concentration: { spell: "Hunter's Mark" } }, { name: 'Orc1' }]],
      ['only attacker and mark remain (no candidate)', [{ name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } }, { name: 'Orc1' }]],
    ])('%s returns prevData with no modal or roll', async (_label, creatures) => {
      armOffer({ creatures });

      const { result, setSecondaryTargetModal } = await open();

      denied(result, setSecondaryTargetModal, _label);
      expect(rollExpression).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  it('once-per-round latch is strict ===: same-round blocks incl the 0-byte, stale latch re-offers without burning', async () => {
    // Round 3 with latch 3 → blocked.
    armOffer({ round: 3 });
    rt.set(`Ranger1.${LATCH}`, 3);
    let opened = await open();
    denied(opened.result, opened.setSecondaryTargetModal, 'same-round 3/3');

    // Round 0 with latch 0 → still blocked: strict === pins the 0-byte; a
    // truthiness guard would wrongly re-fire (integration cannot run round 0).
    armOffer({ round: 0 });
    rt.set(`Ranger1.${LATCH}`, 0);
    opened = await open();
    denied(opened.result, opened.setSecondaryTargetModal, 'round-0 0-byte');

    // Stale latch 4 vs round 5 → offer re-fires, latch burns nothing (#1059 fold).
    armOffer({ round: 5 });
    rt.set(`Ranger1.${LATCH}`, 4);
    opened = await open();
    expect(opened.setSecondaryTargetModal).toHaveBeenCalledTimes(1);
    expect(opened.setSecondaryTargetModal.mock.calls[0][0].title).toBe("Superior Hunter's Prey — Choose Second Target");
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
  });

  // Upgrade ladder — owner of the bytes colossusSlayer.test.js:21 cites (#1050).
  // Hand-derived once (#815): Foe Slayer is the Ranger level-20 capstone
  // (PHB Ranger, Foe Slayer) → 1d10; everything else (incl. level 19 boundary
  // and non-Ranger classes) stays 1d6.
  it.each([
    ['Ranger lvl 1', 1, 'Ranger', '1d6'],
    ['Ranger lvl 19 — just below the ladder', 19, 'Ranger', '1d6'],
    ['Ranger lvl 20 — Foe Slayer', 20, 'Ranger', '1d10'],
    ['Fighter lvl 20 — class gate', 20, 'Fighter', '1d6'],
  ])('%s offers and rolls %s', async (_label, level, className, die) => {
    armOffer();

    const { setSecondaryTargetModal } = await open({
      playerStats: { name: 'Ranger1', level, class: { name: className } },
    });
    expect(setSecondaryTargetModal.mock.calls[0][0].featureDescription).toContain(`${die} Force`);

    await setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('Goblin1');
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith(die);
  });

  describe('handler — selection resolution', () => {
    it('full chain at round 4: campaign-scoped reads, exact damage/log/latch bytes, closes modal', async () => {
      const summary = armOffer({ round: 4 });
      rt.set('characters.characters', [{ name: 'Ranger1' }]);

      const { setSecondaryTargetModal } = await open();
      await setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('Goblin1');

      // Mocked-collaborator call bytes the integration lane never spies.
      expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN); // CLA-346: not pinned to 1
      expect(getRuntimeValue).toHaveBeenCalledWith('Ranger1', LATCH, CAMPAIGN);
      expect(getRuntimeValue).toHaveBeenCalledWith('characters', 'characters', CAMPAIGN);
      expect(loadCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
      expect(applyDamageToTarget).toHaveBeenCalledWith(summary, 'Goblin1', 4, ['Force'], {
        campaignName: CAMPAIGN, characters: [{ name: 'Ranger1' }], ignoreResistance: false, attackerName: 'Ranger1',
      });
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'roll', characterName: 'Ranger1', rollType: 'damage', name: "Superior Hunter's Prey",
        formula: '1d6 [Superior Hunters Prey]', rolls: [4], total: 4, modifier: 0, damageType: 'Force',
        targetName: 'Goblin1', finalDamage: 4,
      });
      expect(setRuntimeValue).toHaveBeenCalledWith('Ranger1', LATCH, 4, CAMPAIGN);
      expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
      // Mapless campaign never consults rangeCheck (:97 branch skipped).
      expect(isWithinRange).not.toHaveBeenCalled();
      // Popup updater bytes are owned verbatim by the integration lane (#1059);
      // this chain runs without setPopupHtml, exercising the guard-false path.
    });

    it.each([[null], ['']])('falsy selection %s is ignored — no roll, no close', async (selection) => {
      armOffer();

      const { setSecondaryTargetModal } = await open();
      await setSecondaryTargetModal.mock.calls[0][0].onTargetSelected(selection);

      expect(rollExpression).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(setSecondaryTargetModal).not.toHaveBeenCalledWith(null); // only the open call
    });

    it('onSkip closes the modal with zero roll, damage, log, or latch write', async () => {
      armOffer();

      const { setSecondaryTargetModal } = await open();
      setSecondaryTargetModal.mock.calls[0][0].onSkip();

      expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
      expect(rollExpression).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('null dice closes the modal and burns nothing', async () => {
      armOffer();
      rollExpression.mockReturnValue(null);

      const { setSecondaryTargetModal } = await open();
      await setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('Goblin1');

      expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('null combat summary skips applyDamage but still logs, stamps the latch, and closes', async () => {
      armOffer({ round: 4 });
      loadCombatSummary.mockResolvedValue(null);

      const { setSecondaryTargetModal } = await open();
      await setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('Goblin1');

      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'roll', characterName: 'Ranger1', rollType: 'damage', name: "Superior Hunter's Prey",
        formula: '1d6 [Superior Hunters Prey]', rolls: [4], total: 4, modifier: 0, damageType: 'Force',
        targetName: 'Goblin1', finalDamage: undefined,
      });
      expect(setRuntimeValue).toHaveBeenCalledWith('Ranger1', LATCH, 4, CAMPAIGN);
      expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    });
  });
});
