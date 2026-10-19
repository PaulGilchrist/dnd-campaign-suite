// @maintained-by-ai
// MA-0084: Adult Bronze Dragon "Thunderclap" (legendary, DC 17 CON, 3d6
// Thunder, dc_success 'none' authored byte) authors a "20-foot-radius
// Sphere … within 90 feet" point-placed area. breathAoeShape (
// MonsterCardModal.jsx:55-59 sphereRadiusFeet) parses the RADIUS token —
// never the 90-ft point-placement text — and routes the press through the
// SAME SaveAttackAoeModal picker as the MA-0031 cones / MA-0042 zones,
// labelled "20-ft Radius", rangeGateFt null (GM positions the point; MA-0042
// advisory shape), NEVER the single-target block-save degrade. Legendary
// economy: spend at picker-open via resolveLegendaryRow → expendLegendaryUse
// (MonsterCardModal.jsx:920, MA-0021 latch); exhausted presses refuse
// upstream — zero spend, picker never arms. Cylinder rows (radius + height
// clause) stay byte-identical single-target — the disk Storm Giant Lightning
// Storm canary guards the sphere-token reroute regression (pure-shape
// guard: whirlwind-zone.test.jsx:50).
// Picker-arm lock is the exact-shape one-shot BY NAME (#770 sleep-breath
// template): LIVE riders saveConditions ['deafened'] + conditionDurationNote
// + radius/rangeGateFt/damage dice/type pinned live; every inert rider in
// the honest-null block fails the arm if wrongly armed. dc_success authored
// byte 'none' overrides the app-wide 'half' default
// (resolveBlockSaveDcSuccess; save-full math → applyDamage.save-full
// .test.js:18-25; half-math dedupe → #779 rec). The exhausted face at the
// test flagged below is CITED canon (terrifying-presence-dracolich.test.jsx
// :18 cites thunderclap-sphere.test.jsx:183) — byte-locked, re-pin there.
// Save-leg transport → secondary-save-transport.test.js :139-151/:297-313;
// failed-save landings → saveProcessing.failed-save-conditions :103-146;
// exhausted legendary gate canonical → legendary-uses.test.jsx:196-211
// (verify map shift before citing); save-number data subset also lives at
// legendary-uses.test.jsx:256 (subsumed by the full-row lock below).
// No diceRoller mock: this lane rolls nothing in the modal. No wall-clock
// timers — deafened duration is rounds at GM seams, never a setTimeout.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return (
      <div className="sp-overlay sphere-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow, _setPopupHtml };
});

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

const THUNDERCLAP_ROW = monstersData.find(m => m.name === 'Adult Bronze Dragon').legendary_actions.find(a => a.name === 'Thunderclap');
const LIGHTNING_STORM_ROW = monstersData.find(m => m.name === 'Storm Giant').actions.find(a => a.name === 'Lightning Storm');

const CREATURES = [
  { name: 'Adult Bronze Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 200, maxHp: 200, ac: 19, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 90, maxHp: 90, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
];

function renderBronze(uses) {
  if (uses !== undefined) runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({
    name: 'Adult Bronze Dragon',
    actions: [{ name: 'Rend', attack_bonus: 12, damage_dice_primary: '2d8 + 7', damage_type_primary: 'Slashing', reach: '10 ft.' }],
    legendary_actions: monstersData.find(m => m.name === 'Adult Bronze Dragon').legendary_actions,
  });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Bronze Dragon 1', creatures: CREATURES })} />);
}

function thunderclapRowLink() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Thunderclap'));
  return row ? row.querySelector('.mc-dice-link-legendary') || row.querySelector('.mc-dice-link') : null;
}

function logEntries(pred) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e && pred(e));
}

// Exact-shape picker arm (#770 template): every semantic prop the sphere row
// hands SaveAttackAoeModal. LIVE riders: range 20 (radius token, never the
// 90-ft point text), rangeGateFt null (point-placed, MA-0042 advisory),
// dc_success 'none' authored byte, deafened fail leg + until-next-turn note.
// Every other rider is inert on this row — honest nulls catch a wrong arm.
const PICKER_KEYS = ['action', 'playerStats', 'range', 'damage', 'damageType', 'secondaryDamage', 'secondaryDamageType', 'saveType', 'saveDc', 'dcSuccess', 'titleOverride', 'excludeNames', 'rangeGateFt', 'zoneTe', 'zoneOnly', 'saveConditions', 'sleepStaging', 'stagedParalysis', 'stagedPetrify', 'pushFeet', 'slowedClauses', 'weakeningBreath', 'acPenaltyClause', 'speedZeroClause', 'speedReduceClause', 'bothOutcomesClause', 'saveVariant', 'conditionDurationNote', 'storeLastAttack'];
const pickerArm = (props) => Object.fromEntries(PICKER_KEYS.map(k => [k, props[k]]));

const THUNDERCLAP_ARMED = {
  action: THUNDERCLAP_ROW,
  playerStats: { name: 'Adult Bronze Dragon 1' },
  range: 20,
  damage: '3d6',
  damageType: 'Thunder',
  secondaryDamage: null,
  secondaryDamageType: null,
  saveType: 'Constitution',
  saveDc: 17,
  dcSuccess: 'none',
  titleOverride: '20-ft Radius (GM positions tokens; selection advisory)',
  excludeNames: ['Adult Bronze Dragon 1'],
  rangeGateFt: null,
  saveConditions: ['deafened'],
  conditionDurationNote: 'until the end of its next turn (GM-enforced)',
  zoneTe: null,
  zoneOnly: false,
  sleepStaging: null,
  stagedParalysis: null,
  stagedPetrify: null,
  pushFeet: null,
  slowedClauses: null,
  weakeningBreath: null,
  acPenaltyClause: null,
  speedZeroClause: null,
  speedReduceClause: null,
  bothOutcomesClause: null,
  saveVariant: null,
  storeLastAttack: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0084 Thunderclap sphere lane', () => {
  it('disk row locked by full key set: DC 17 CON, 3d6 Thunder, dc_success none authored byte, Deafened until-next-turn save_effect, 20-foot-radius Sphere prose — no recharge/zone keys, no cone/line/cylinder token', () => {
    expect(THUNDERCLAP_ROW).toEqual({
      name: 'Thunderclap',
      description: 'Constitution Saving Throw: DC 17, each creature in a 20-foot-radius <strong>Sphere</strong> centered on a point the dragon can see within 90 feet (sphere selection advisory — GM positions the point; no range-gate consumer). <strong>Failure:</strong> 10 (3d6) Thunder damage, and the target has the <strong>Deafened</strong> condition until the end of its next turn.',
      save_dc: 17,
      save_type: 'Constitution',
      dc_success: 'none',
      damage_dice_primary: '3d6',
      damage_type_primary: 'Thunder',
      save_effect: '10 (3d6) Thunder damage, and the target has the Deafened condition until the end of its next turn.',
    });
    expect(THUNDERCLAP_ROW.description).not.toMatch(/\bcone\b|\bline\b|\bcylinder\b/i);
  });

  it('press spends 1 legendary use and arms the exact 20-ft Radius picker contract — CON DC 17 3d6 Thunder deafened, rangeGateFt null, all inert riders honest null, zero inline save', async () => {
    renderBronze({ max: 3, used: 0 });
    fireEvent.click(thunderclapRowLink());
    await waitFor(() => expect(document.querySelector('.sphere-picker-stub')).toBeTruthy());
    // the picker IS target selection — never the single-target block save
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(pickerArm(aoeProps.current)).toEqual(THUNDERCLAP_ARMED);
    // spend stamped at picker-open (MA-0021 latch) and logged, exactly once
    expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const spends = logEntries(e => e.type === 'ability_use');
    expect(spends).toHaveLength(1);
    expect(spends[0].description).toMatch(/expends a legendary use for Thunderclap/);
  });

  it('exhausted (3/3): click refuses with popup + legendary_use_refused, zero spend, NO picker', async () => {
    renderBronze({ max: 3, used: 3 });
    fireEvent.click(thunderclapRowLink());
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(aoeProps.current).toBeNull();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
  });

  it('cylinder guard on disk data: Storm Giant Lightning Storm (10-foot-radius, 40-foot-high Cylinder prose) press stays byte-identical single-target — block save fires, picker never opens', async () => {
    // Why this canary: sphereRadiusFeet's cylinder exclusion is the only
    // thing keeping this disk row off the new RADIUS picker (MA-0084
    // boundary; pure-shape arm owned by whirlwind-zone.test.jsx:50).
    expect(LIGHTNING_STORM_ROW.range).toBe('10-foot-radius, 40-foot-high Cylinder');
    const creatures = [{ name: 'Storm Giant 1', type: 'npc', targetName: 'ElderPaladin', currentHp: 230, maxHp: 230, ac: 17, conditions: [] }, ...CREATURES.slice(1)];
    const m = makeMonster({ name: 'Storm Giant', actions: [LIGHTNING_STORM_ROW] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Storm Giant 1', creatures })} />);
    const row = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Lightning Storm'));
    fireEvent.click(row.querySelector('.mc-dice-link'));
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    expect(aoeProps.current).toBeNull();
  });
});
