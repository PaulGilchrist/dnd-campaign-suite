// @maintained-by-ai
// MA-0064: Adult Blue Dragon lair_actions[2] "Lightning Arcs" — the ONLY
// authored lair row whose prose line LEADS WITH ITS WIDTH ("5-foot-wide
// line … within 120 feet") and the sole max≠first feet-token row in the
// census. This lane pins the one branch no sibling reaches: the MA-0064
// Math.max coverage gate (MonsterCardModal.jsx breathAoeShape Line leg) —
// 120-ft endpoint picker (range/rangeGateFt/titleOverride bytes), NOT the
// leading 5-ft width token. Reverting the gate to tokens[0] would gate at 5
// and only this test catches it; verified breath lines (first === max) stay
// byte-identical and need no re-pin here.
// Cited owners (do NOT re-add here): chip render/role/initiative-20 title
// and static branches → MonsterCardModal.lair-actions.test.jsx (#610);
// 60-ft Acid Breath line gate + 60-ft title bytes → line-breath.test.jsx
// (:147/:150); zone picker template (excludeNames/storeLastAttack) and
// zoneTe payload → lair-insect-cloud.test.jsx (:111/:132); block-save ctx
// → lair-actions it.each / lair-darkness.test.jsx; row parse/data locks →
// services/encounters/monsterLairActions.test.js.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay lightning-arcs-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
}));

vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
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

const CREATURES = [
  { name: 'Adult Blue Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 212, maxHp: 212, ac: 19, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 60, maxHp: 60, ac: 12, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'adult-blue-dragon');
  const m = makeMonster({ name: 'Adult Blue Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Blue Dragon 1', creatures: CREATURES })} />);
}

// The blue dragon ALSO authors a DC 15 Dexterity Falling Ceiling lair row —
// disambiguate by owning action so the click hits the Lightning Arcs chip.
function arcsChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'))
    .find(el => el.closest('.mc-action')?.textContent.includes('Lightning Arcs')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0064 Lightning Arcs lair row → 120-ft LINE area picker', () => {
  it('chip click gates the picker at the 120-ft endpoint (max token, NOT the leading 5-ft width): DEX DC 15, 3d6 Lightning half-on-success, no zone payload, no inline save/log at click', async () => {
    renderDragon();
    fireEvent.click(arcsChip());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    // MA-0064 distinct leg: Math.max over [5, 120, 120] — the ONLY lair row
    // where first ≠ max; tokens[0] would pin the picker at 5 ft.
    expect(p.range).toBe(120);
    expect(p.rangeGateFt).toBe(120);
    expect(p.titleOverride).toBe('120-ft Line (GM positions tokens; selection advisory)');
    expect(p.saveDc).toBe(15);
    expect(p.saveType).toBe('Dexterity');
    expect(p.damage).toBe('3d6');
    expect(p.damageType).toBe('Lightning');
    expect(p.dcSuccess).toBe('half');
    expect(p.saveConditions).toEqual([]);
    // a line is a swept area, not a persisting zone (zoneTe is owned non-null
    // by the insect-cloud lane, :132) and never fires the block-save seam.
    expect(p.zoneTe).toBeNull();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    // the picker owns save/damage logging at confirm — zero at click.
    expect(addEntry).not.toHaveBeenCalled();
  });
});
