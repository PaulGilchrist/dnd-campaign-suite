// @maintained-by-ai
// MA-0248 / MA-1469: Paralyzing Breath click-path enforcement for the Ancient
// Silver Dragon (DC 24, prose-derived 90-ft Cone) and its byte-twin Silver
// Dragon Wyrmling (actions[3], DC 13, authored 15-ft Cone range).
// Covered here: row data lock (Object.keys exact, incl. absences), press
// arms the SaveAttackAoeModal picker with the exact stagedParalysis contract
// (stagedParalysisForAction combat-scoped until:'combat' verdict + authored
// paralyzedMinutes verbatim — #755 retired the CLA-334 minutes×10 round
// clock, MonsterCardModal.jsx:305) and dc_success 'none' authored byte (its absence = 'half' default at
// resolveBlockSaveDcSuccess, MonsterCardModal.jsx:286 — the half-damage
// leak this row must never inherit), ungated re-arm (no recharge authored),
// zero inline save roll at press.
// Cite-skips (covered elsewhere, never re-anchored here):
// • failed-save ladder grant leg + picker copy (paralyzingBreathService
//   routing, DC-13 twin transport): SaveAttackAoeModal.staged-paralysis.test.jsx
// • extractConditionsFromSaveEffect truth tables (MonsterCardHelpers.js:383):
//   sibling extractor suites — here the flat ['incapacitated','paralyzed']
//   spray rides the props byte and is pinned only as the armed payload shape;
//   with stagedParalysis non-null the picker routes the fail leg to the
//   staged service, so the flat spray never governs the grant.
// • recharge arm/spend/refusal machinery: monsterRecharge.test.js (:41-57
//   arm-only) — this row authors NO recharge, so only the absence is pinned.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null, onClose: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    aoeProps.onClose = props.onClose;
    return (
      <div className="sp-overlay cone-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    getAllStoreKeys: vi.fn(() => Object.keys(store)),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});

// The #755 sweeper-honor pins drive the REAL expirationQueue (canonical
// until:'combat' sentinel); its clear side is recorded, not executed — the
// ladder's te/condition removal bytes belong to the service lanes.
const cleared = vi.hoisted(() => []);

vi.mock('../../services/rules/effects/clearExpirationEffects.js', () => ({
  clearExpirationEffects: (...args) => { cleared.push(args); },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
  getAllStoreKeys: runtime.getAllStoreKeys,
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { processExpirationList, sweepCombatScopedExpirations } from '../../services/rules/effects/expirationQueue.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

const CREATURES = [
  { name: 'Ancient Silver Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 468, maxHp: 468, ac: 22, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

const WYRMLING_CREATURES = [
  { name: 'Silver Dragon Wyrmling 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 45, maxHp: 45, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

function monsterRow(index) {
  return monstersData.find(m => m.index === index);
}

function paralyzingBreathAction(index) {
  return monsterRow(index).actions.find(a => a.name === 'Paralyzing Breath');
}

function renderDragon(index, creatureName, creatures) {
  const m = makeMonster({ name: monsterRow(index).name, actions: monsterRow(index).actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName, creatures })} />);
}

function paralyzingBreathLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Paralyzing Breath')) || null;
}

// Every picker prop the staged-paralysis lane adjudicates, locked in one
// shot BY NAME — riders that must stay inert on this row appear as their
// inert bytes, so a wrongly-armed new rider on these rows fails here.
const PICKER_KEYS = [
  'action', 'playerStats', 'saveDc', 'saveType', 'dcSuccess', 'damage', 'damageType',
  'secondaryDamage', 'secondaryDamageType', 'range', 'rangeGateFt', 'titleOverride',
  'excludeNames', 'saveConditions', 'sleepStaging', 'stagedParalysis', 'stagedPetrify',
  'pushFeet', 'slowedClauses', 'weakeningBreath', 'acPenaltyClause', 'speedZeroClause',
  'speedReduceClause', 'bothOutcomesClause', 'zoneTe', 'zoneOnly', 'storeLastAttack',
];

function pickedPickerProps() {
  return Object.fromEntries(PICKER_KEYS.map(k => [k, aoeProps.current[k]]));
}

const LADDER_PROSE = [
  'First Failure: The target has the Incapacitated condition',
  'Second Failure: The target has the Paralyzed condition',
  'After 1 minute, it succeeds automatically',
];

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  cleared.length = 0;
  aoeProps.current = null;
  aoeProps.onClose = null;
});

const ARMED_RIDERS_INERT = {
  damage: null,
  damageType: '',
  secondaryDamage: null,
  secondaryDamageType: null,
  saveConditions: ['incapacitated', 'paralyzed'],
  sleepStaging: null,
  stagedPetrify: null,
  pushFeet: null,
  slowedClauses: null,
  weakeningBreath: null,
  acPenaltyClause: null,
  speedZeroClause: null,
  speedReduceClause: null,
  bothOutcomesClause: null,
  zoneTe: null,
  zoneOnly: false,
  storeLastAttack: false,
};

const ANCIENT_ARMED = {
  action: paralyzingBreathAction('ancient-silver-dragon'),
  playerStats: { name: 'Ancient Silver Dragon 1' },
  saveDc: 24,
  saveType: 'Constitution',
  dcSuccess: 'none',
  range: 90,
  rangeGateFt: 90,
  titleOverride: '90-ft Cone (GM positions tokens; selection advisory)',
  excludeNames: ['Ancient Silver Dragon 1'],
  // #755 stored-shape pin: combat-scoped verdict, NO numeric round count
  // (the retired CLA-334 paralyzedRounds:10 output must never return).
  stagedParalysis: { until: 'combat', paralyzedMinutes: 1 },
  ...ARMED_RIDERS_INERT,
};

const WYRMLING_ARMED = {
  action: paralyzingBreathAction('silver-dragon-wyrmling'),
  playerStats: { name: 'Silver Dragon Wyrmling 1' },
  saveDc: 13,
  saveType: 'Constitution',
  dcSuccess: 'none',
  range: 15,
  rangeGateFt: 15,
  titleOverride: '15-ft Cone (GM positions tokens; selection advisory)',
  excludeNames: ['Silver Dragon Wyrmling 1'],
  // #755 stored-shape pin (byte-twin): combat-scoped verdict, no numeric 10.
  stagedParalysis: { until: 'combat', paralyzedMinutes: 1 },
  ...ARMED_RIDERS_INERT,
};

describe('MA-0248 Ancient Silver Dragon Paralyzing Breath', () => {
  it('full-row data lock: Object.keys exact by name (no recharge, no damage, no range keys), dc_success none byte, staged_paralysis 1 minute on DC 24 CON, ladder prose', () => {
    const action = paralyzingBreathAction('ancient-silver-dragon');
    expect(Object.keys(action).sort()).toEqual([
      'dc_success', 'description', 'name', 'save_dc', 'save_effect', 'save_type', 'staged_paralysis',
    ]);
    expect(action.save_dc).toBe(24);
    expect(action.save_type).toBe('Constitution');
    // Authored byte — unauthored rows default dc_success to 'half' at
    // resolveBlockSaveDcSuccess (MonsterCardModal.jsx:286); this row must
    // never pay half-damage on a save it has no damage for.
    expect(action.dc_success).toBe('none');
    expect(action.staged_paralysis).toEqual({ paralyzed_minutes: 1 });
    for (const clause of LADDER_PROSE) {
      expect(action.save_effect).toContain(clause);
    }
  });

  it('press arms the exact picker contract without rolling inline; close + refire re-arms ungated with zero recharge writes', async () => {
    renderDragon('ancient-silver-dragon', 'Ancient Silver Dragon 1', CREATURES);
    const link = paralyzingBreathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(pickedPickerProps()).toEqual(ANCIENT_ARMED);

    aoeProps.onClose();
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeNull());

    fireEvent.click(paralyzingBreathLink());
    await waitFor(() => expect(document.querySelectorAll('.cone-picker-stub').length).toBe(1));
    expect(pickedPickerProps()).toEqual(ANCIENT_ARMED);
    // ungated row: nothing ever arms or spends a recharge for it
    expect(runtime.store['Ancient Silver Dragon 1.monsterRecharge'] == null).toBe(true);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });
});

describe('MA-1469 Silver Dragon Wyrmling Paralyzing Breath (byte-twin)', () => {
  it('actions[3] full-row data lock: Object.keys exact by name incl. authored 15-foot Cone range, dc_success none byte, staged_paralysis 1 minute on DC 13 CON, ladder prose', () => {
    const action = paralyzingBreathAction('silver-dragon-wyrmling');
    expect(Object.keys(action).sort()).toEqual([
      'dc_success', 'description', 'name', 'range', 'save_dc', 'save_effect', 'save_type', 'staged_paralysis',
    ]);
    expect(action.save_dc).toBe(13);
    expect(action.save_type).toBe('Constitution');
    expect(action.dc_success).toBe('none');
    expect(action.staged_paralysis).toEqual({ paralyzed_minutes: 1 });
    expect(action.range).toBe('15-foot Cone');
    for (const clause of LADDER_PROSE) {
      expect(action.save_effect).toContain(clause);
    }
  });

  it('press arms the same staged contract at DC 13 / 15 ft — staged service supersedes the flat extractor spray', async () => {
    renderDragon('silver-dragon-wyrmling', 'Silver Dragon Wyrmling 1', WYRMLING_CREATURES);
    const link = paralyzingBreathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(pickedPickerProps()).toEqual(WYRMLING_ARMED);
    // The word-list scan still yields both ladder words inside saveConditions;
    // with stagedParalysis armed the picker routes the fail leg to
    // paralyzingBreathService — pinned in
    // SaveAttackAoeModal.staged-paralysis.test.jsx — so the flat spray never
    // governs the grant.
  });
});

/* ─#755 no-timers duration-owner adjudication (⚠ POLICY fix) ─────────────
 * The disk authors staged_paralysis.paralyzed_minutes:1 on both rows
 * (≥1 minute ⇒ COMBAT-SCOPED). The retired CLA-334 minutes×10 producer
 * output (paralyzedRounds:10) must never reappear; the armed contract is the
 * until:'combat' verdict + authored minutes verbatim, and the REAL
 * expirationQueue sweeper proves that shape honors the policy seams:
 * • processExpirationList (expirationQueue.js:39-63) matures numeric round
 *   clocks ONLY — the canonical rounds:Infinity entry never matures, the
 *   retired rounds:10 clock matures at appliedRound+10 (contrast pin: the
 *   exact fabricated-clock behavior the policy retired);
 * • sweepCombatScopedExpirations (expirationQueue.js:123-138) drains
 *   until:'combat' entries at the combat boundaries (new initiative roll via
 *   initiative's clearAllExpirationEffects/sweepNewCombatClocks lane, short/
 *   long rest via sweepRestClocks — #1348 combat-end clear); entries without
 *   the marker are NEVER touched (expirationQueue.js:118) — legacy pin.
 * Downstream stamping of rounds:Infinity + until:'combat' at the escalation
 * (SaveAttackAoeModal.jsx:816 te default, paralyzingBreathService.js:161
 * addExpiration) is OWNER QUEUED — cited in the producer comment; until it
 * lands the te keeps a vestigial numeric stamp this producer never made.
 */
describe('#755 stagedParalysis duration-owner: combat-scoped shape, no round clock', () => {
  it.each([
    ['ancient-silver-dragon', 'Ancient Silver Dragon 1', CREATURES],
    ['silver-dragon-wyrmling', 'Silver Dragon Wyrmling 1', WYRMLING_CREATURES],
  ])('%s arms the picker with until:combat + paralyzedMinutes — retired x10 output stays dead', async (index, creatureName, creatures) => {
    renderDragon(index, creatureName, creatures);
    fireEvent.click(paralyzingBreathLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const staged = aoeProps.current.stagedParalysis;
    expect(staged).toEqual({ until: 'combat', paralyzedMinutes: 1 });
    // stored-shape pin: the numeric round key is ABSENT at the source — no
    // consumer default can silently resurrect a 10-round clock from a value
    // this producer manufactured (it publishes minutes only).
    expect(Object.keys(staged).sort()).toEqual(['paralyzedMinutes', 'until']);
    expect(staged.paralyzedRounds).toBeUndefined();
  });

  it('mid-combat persistence: canonical rounds:Infinity never matures at the old appliedRound+10 boundary (contrast: the retired rounds:10 clock did)', () => {
    const caster = 'Ancient Silver Dragon 1';
    const effects = [
      { type: 'condition', condition: 'paralyzed' },
      { type: 'remove_target_effect', effectKey: 'paralyzing_staged', source: caster, target: 'ElderPaladin' },
    ];
    // Retired producer/CLA-334 shape for contrast: armed at round 3 with the
    // old paralyzedRounds:10, this DID auto-expire paralyzed at round 13 —
    // the fabricated round countdown the no-timers policy retired.
    const retired = [{ target: 'ElderPaladin', effects, appliedRound: 3, expiryRounds: 10 }];
    expect(processExpirationList(retired, 13, caster, 'test-campaign', 'ElderPaladin').expiredCount).toBe(1);
    // Canonical combat-scoped shape (#755 verdict): no round seam matures it.
    const canonical = [{ target: 'ElderPaladin', effects, appliedRound: 3, expiryRounds: Infinity, until: 'combat' }];
    for (const round of [13, 97, 9999]) {
      const r = processExpirationList(canonical, round, caster, 'test-campaign', 'ElderPaladin');
      expect(r.expiredCount).toBe(0);
      expect(r.changed).toBe(false);
    }
    expect(cleared).toHaveLength(1); // only the retired-clock contrast cleared
  });

  it('combat-end clear (#1348 seams): sweepCombatScopedExpirations drains until:combat entries at a new initiative roll; unmarked legacy clocks are never swept', () => {
    const caster = 'Ancient Silver Dragon 1';
    const effects = [{ type: 'condition', condition: 'paralyzed' }];
    runtime.store[`${caster}.pendingExpirations`] = [
      { target: 'ElderPaladin', effects, appliedRound: 3, expiryRounds: Infinity, until: 'combat' },
    ];
    expect(sweepCombatScopedExpirations({ campaignName: 'test-campaign', ownerName: caster })).toBe(1);
    expect(cleared).toEqual([[effects, 'ElderPaladin', caster, 'test-campaign']]);
    expect(runtime.store[`${caster}.pendingExpirations`]).toEqual([]);
    // Legacy numeric-rounds entry WITHOUT the marker: sweep honors byte-parity
    // and never touches it (expirationQueue.js:118-119).
    runtime.store[`${caster}.pendingExpirations`] = [
      { target: 'Bandit 1', effects, appliedRound: 3, expiryRounds: 2 },
    ];
    cleared.length = 0;
    expect(sweepCombatScopedExpirations({ campaignName: 'test-campaign', ownerName: caster })).toBe(0);
    expect(cleared).toHaveLength(0);
    expect(runtime.store[`${caster}.pendingExpirations`]).toHaveLength(1);
  });
});
