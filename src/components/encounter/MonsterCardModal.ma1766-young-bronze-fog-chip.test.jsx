// MA-1766: Young Bronze Dragon lair_actions[0] was a BARE STRING (inert
// static span, zero affordance — MonsterCardBody.jsx:357 first disjunct).
// DATA fix promotes it to the byte-proven adult-bronze MA-0085 "Fog Cloud"
// save-less zone dict: chip renders named "Fog Cloud" (.mc-dice-link-lair)
// and clicks route to the area picker in zoneOnly mode (MA-0043 lane — title
// "20-ft radius (GM positions; selection advisory)", NO save DC/type, NO
// damage, zone payload carries effectKey 'lair_fog_cloud' + radiusFt 20).
// Sibling [1] (MA-1767) since fixed: nameless dict promoted to the same
// adult-bronze zone shape with DISTINCT name "Rolling Fog" — FALSE-lock
// inverted, census widened to TWO named fog chips, both zoneOnly pickers.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay young-bronze-fog-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
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
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Bandit 1', creatures: [] })),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

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

const CREATURES = [
  { name: 'Young Bronze Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 142, maxHp: 142, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'young-bronze-dragon');
  const m = makeMonster({ name: 'Young Bronze Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Young Bronze Dragon 1', creatures: CREATURES })} />);
}

function lairChips() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-1766 young-bronze-dragon fog cloud lair chip census', () => {
  it('lair block renders EXACTLY two named chips — "Fog Cloud" + MA-1767 "Rolling Fog"', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips.map(c => c.textContent.trim())).toEqual(['Fog Cloud', 'Rolling Fog']);
    expect(chips[0].getAttribute('title')).toMatch(/Lair action — Fog Cloud/);
    expect(chips[1].getAttribute('title')).toMatch(/Lair action — Rolling Fog/);
    chips.forEach(c => expect(c.textContent).not.toMatch(/DC/));
  });

  it('chip click routes to the picker zoneOnly: no save, no damage, radius 20, gate off', async () => {
    renderDragon();
    fireEvent.click(lairChips()[0]);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.titleOverride).toBe('20-ft radius (GM positions; selection advisory)');
    expect(p.saveDc ?? null).toBeNull();
    expect(p.saveType).toBeNull();
    expect(p.damage).toBeNull();
    expect(p.damageType).toBeNull();
    expect(p.dcSuccess ?? null).toBeNull();
    expect(p.range).toBe(20);
    expect(p.rangeGateFt).toBeNull();
    expect(p.zoneOnly).toBe(true);
    expect(p.excludeNames).toEqual(['Young Bronze Dragon 1']);
    expect(p.storeLastAttack).toBe(false);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('zone payload carries lair_fog_cloud effectKey, radius 20, no repeat, advisory clause', async () => {
    renderDragon();
    fireEvent.click(lairChips()[0]);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const zt = aoeProps.current.zoneTe;
    expect(zt.effectKey).toBe('lair_fog_cloud');
    expect(zt.radiusFt).toBe(20);
    expect(zt.repeatTurnEnd).toBe(false);
    expect(zt.damage).toBeNull();
  });

  // MA-1767: second chip — "Rolling Fog" — clickable zoneOnly twin of [0].
  it('MA-1767 "Rolling Fog" chip click routes to the picker zoneOnly: no save, no damage, radius 20', async () => {
    renderDragon();
    fireEvent.click(lairChips()[1]);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.titleOverride).toBe('20-ft radius (GM positions; selection advisory)');
    expect(p.saveDc ?? null).toBeNull();
    expect(p.saveType).toBeNull();
    expect(p.damage).toBeNull();
    expect(p.damageType).toBeNull();
    expect(p.dcSuccess ?? null).toBeNull();
    expect(p.range).toBe(20);
    expect(p.rangeGateFt).toBeNull();
    expect(p.zoneOnly).toBe(true);
    expect(p.excludeNames).toEqual(['Young Bronze Dragon 1']);
    expect(p.storeLastAttack).toBe(false);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(p.zoneTe.effectKey).toBe('lair_fog_cloud');
    expect(p.zoneTe.radiusFt).toBe(20);
    expect(p.zoneTe.damage).toBeNull();
  });
});
