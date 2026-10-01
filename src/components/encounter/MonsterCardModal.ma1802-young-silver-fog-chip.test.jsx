// MA-1802: Young Silver Dragon lair_actions[0] was a BARE STRING (inert
// static span, zero affordance — MonsterCardBody.jsx:358 first disjunct
// typeof==='string', MA-1747/1753/1760/1766 bare-string young-dragon
// streak). DATA fix promotes it to the byte-proven adult-silver MA-0140
// ADVISORY dict {name:"Fog Cloud", advisory:"fog_cloud", description} —
// SILVER fog carries NO zone block (bronze MA-1766 zone lane does NOT
// apply): chip renders named "Fog Cloud" (.mc-dice-link-lair) and clicks
// route to the CLA-325 advisory record — ability_use "casts fog cloud" +
// initiative-20 GM-enforced popup — NO picker, NO save, NO damage, NO
// zone te. Sibling [1] (MA-1803) stays the nameless description-only
// dict: row renders static, zero affordance (FALSE-pin).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay young-silver-fog-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
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
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null, setPopupHtml: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  ROLLERS.setPopupHtml = _setPopupHtml;
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

import { addEntry } from '../../services/ui/logService.js';

const CREATURES = [
  { name: 'Young Silver Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 168, maxHp: 168, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 733, maxHp: 733, ac: 12, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'young-silver-dragon');
  const m = makeMonster({ name: 'Young Silver Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Young Silver Dragon 1', creatures: CREATURES })} />);
}

function lairChips() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-1802 young-silver-dragon fog cloud lair chip lock', () => {
  it('lair block renders EXACTLY one named chip "Fog Cloud" (was zero — bare string inert)', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips.map(c => c.textContent.trim())).toEqual(['Fog Cloud']);
    expect(chips[0].getAttribute('role')).toBe('button');
    expect(chips[0].getAttribute('tabindex')).toBe('0');
    expect(chips[0].getAttribute('title')).toMatch(/Lair action — Fog Cloud/);
    expect(chips[0].textContent).not.toMatch(/DC/);
  });

  it('sibling [1] MA-1803 FALSE-pin: row renders static, zero affordance', () => {
    renderDragon();
    const title = Array.from(document.querySelectorAll('h5.mc-section-title')).find(h => h.textContent.includes('Lair Actions'));
    const rows = Array.from(title.nextElementSibling.querySelectorAll('.mc-action'));
    expect(rows).toHaveLength(2);
    const sib = rows[1];
    expect(sib.querySelectorAll('.mc-dice-link-lair, .mc-dice-link, [role=button], button, i')).toHaveLength(0);
    expect(sib.querySelector('strong')).toBeNull();
    fireEvent.click(sib.querySelector('span'));
    expect(addEntry).not.toHaveBeenCalled();
    expect(ROLLERS.setPopupHtml).not.toHaveBeenCalled();
  });

  it('chip click routes advisory record: ability_use fog log + GM-enforced popup, NO picker/save/damage', async () => {
    renderDragon();
    fireEvent.click(lairChips()[0]);
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Young Silver Dragon 1');
    expect(entry.abilityName).toBe('Fog Cloud');
    expect(entry.description).toMatch(/casts fog cloud/i);
    expect(entry.description).toMatch(/initiative 20 \(GM-enforced/i);
    expect(entry.description).not.toMatch(/save DC/i);
    expect(ROLLERS.setPopupHtml).toHaveBeenCalled();
    const html = ROLLERS.setPopupHtml.mock.calls[ROLLERS.setPopupHtml.mock.calls.length - 1][0];
    expect(html).toMatch(/Lair Action — Fog Cloud/);
    expect(html).toMatch(/casts fog cloud/i);
    expect(html).toMatch(/initiative 20/i);
    expect(aoeProps.current).toBeNull();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
