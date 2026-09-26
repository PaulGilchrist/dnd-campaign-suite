// MA-1212: Myconid Adult "Rapport Spores" ACTION-category zone row → the
// untouched MA-0043 zoneOnly area picker. Chip click routes handleZonePickerRow
// → handleLairZone({...action, save_dc:null}) — picker opens with NO save DC
// (MA-1071 DC0 decoy neutralized by the null-normalization), NO damage,
// zoneTe effectKey 'rapport_spores' + duration '1 hour' + GM-enforced clause,
// excludeNames [caster], storeLastAttack false. The roll seams are never
// invoked — the pre-fix fingerprint (bogus "+0" roll/attack vs the armed
// target) can no longer occur: the to-hit chip is gone from the data itself.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { zoneTeForAction } from './MonsterCardModal.jsx';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay rapport-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null, rollAttack: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  const rollAttack = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  ROLLERS.rollAttack = rollAttack;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
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
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Bandit', creatures: [] })),
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
  { name: 'Myconid Adult 1', type: 'npc', monsterType: 'plant', targetName: 'Bandit', currentHp: 16, maxHp: 16, ac: 12, conditions: [] },
  { name: 'Myconid Sovereign 1', type: 'npc', monsterType: 'plant', targetName: 'Bandit', currentHp: 45, maxHp: 45, ac: 13, conditions: [] },
  { name: 'Myconid Sprout 1', type: 'npc', monsterType: 'plant', targetName: 'Bandit', currentHp: 3, maxHp: 3, ac: 10, conditions: [] },
  { name: 'Bandit', type: 'npc', currentHp: 999, maxHp: 11, ac: 12, conditions: [] },
];

function renderMyconid(index = 'myconid-adult', creatureName = 'Myconid Adult 1') {
  const monster = monstersData.find(m => m.index === index);
  const m = makeMonster({ name: monster.name, actions: monster.actions, traits: monster.traits });
  return render(<MonsterCardModal {...makeProps(m, { creatureName, creatures: CREATURES })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-1212 rapport spores ACTION row → zoneOnly picker (no save, no roll)', () => {
  it('the disk row drives the picker: 30-ft zoneOnly, save_dc normalized null, caster excluded', async () => {
    renderMyconid();
    const chip = document.querySelector('.mc-dice-link-zone');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('30-ft Zone');
    fireEvent.click(chip);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.zoneOnly).toBe(true);
    expect(p.saveDc ?? null).toBeNull();
    expect(p.saveType ?? null).toBeNull();
    expect(p.damage ?? null).toBeNull();
    expect(p.damageType ?? null).toBeNull();
    expect(p.dcSuccess ?? null).toBeNull();
    expect(p.range).toBe(30);
    expect(p.rangeGateFt).toBeNull();
    expect(p.excludeNames).toEqual(['Myconid Adult 1']);
    expect(p.storeLastAttack).toBe(false);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('zoneTe payload: rapport_spores effectKey/tracking, duration 1 hour, advisory clause rides the arm log', async () => {
    const rapport = monstersData.find(m => m.index === 'myconid-adult').actions[2];
    const zt = zoneTeForAction(rapport);
    expect(zt.effectKey).toBe('rapport_spores');
    expect(zt.trackingPrefix).toBe('rapport_spores');
    expect(zt.radiusFt).toBe(30);
    expect(zt.repeatTurnEnd).toBe(false);
    expect(zt.damage).toBeNull();
    expect(zt.duration).toBe('1 hour');
    expect(zt.noun).toBe('rapport spores');
    expect(zt.clause).toMatch(/GM-enforced/);
    renderMyconid();
    fireEvent.click(document.querySelector('.mc-dice-link-zone'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.zoneTe).toEqual(zt);
  });

  // MA-1217: sovereign byte-twin drives the SAME untouched picker seam.
  it('MA-1217 sovereign disk row drives the picker: 30-ft zoneOnly, save_dc normalized null, sovereign caster excluded', async () => {
    renderMyconid('myconid-sovereign', 'Myconid Sovereign 1');
    const chip = document.querySelector('.mc-dice-link-zone');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('30-ft Zone');
    const rapportRow = [...document.querySelectorAll('.mc-overlay *')].find(e => e.querySelector(':scope > strong')?.textContent.includes('Rapport Spores'));
    const attackChips = [...rapportRow.querySelectorAll('.mc-dice-link:not(.mc-dice-link-zone)')].map(c => c.textContent.trim());
    expect(attackChips).toEqual([]);
    fireEvent.click(chip);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.zoneOnly).toBe(true);
    expect(p.saveDc ?? null).toBeNull();
    expect(p.saveType ?? null).toBeNull();
    expect(p.damage ?? null).toBeNull();
    expect(p.range).toBe(30);
    expect(p.excludeNames).toEqual(['Myconid Sovereign 1']);
    expect(p.storeLastAttack).toBe(false);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  // MA-1220: sprout byte-twin drives the SAME untouched picker seam.
  it('MA-1220 sprout disk row drives the picker: 30-ft zoneOnly, save_dc normalized null, sprout caster excluded', async () => {
    renderMyconid('myconid-sprout', 'Myconid Sprout 1');
    const chip = document.querySelector('.mc-dice-link-zone');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('30-ft Zone');
    const rapportRow = [...document.querySelectorAll('.mc-overlay *')].find(e => e.querySelector(':scope > strong')?.textContent.includes('Rapport Spores'));
    const attackChips = [...rapportRow.querySelectorAll('.mc-dice-link:not(.mc-dice-link-zone)')].map(c => c.textContent.trim());
    expect(attackChips).toEqual([]);
    fireEvent.click(chip);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.zoneOnly).toBe(true);
    expect(p.saveDc ?? null).toBeNull();
    expect(p.saveType ?? null).toBeNull();
    expect(p.damage ?? null).toBeNull();
    expect(p.range).toBe(30);
    expect(p.excludeNames).toEqual(['Myconid Sprout 1']);
    expect(p.storeLastAttack).toBe(false);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('MA-1217 sovereign zoneTe payload: rapport_spores, duration 1 hour, advisory clause rides the arm log', async () => {
    const sovRapport = monstersData.find(m => m.index === 'myconid-sovereign').actions[4];
    const zt = zoneTeForAction(sovRapport);
    expect(zt.effectKey).toBe('rapport_spores');
    expect(zt.radiusFt).toBe(30);
    expect(zt.damage).toBeNull();
    expect(zt.duration).toBe('1 hour');
    expect(zt.clause).toMatch(/GM-enforced/);
    renderMyconid('myconid-sovereign', 'Myconid Sovereign 1');
    fireEvent.click(document.querySelector('.mc-dice-link-zone'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.zoneTe).toEqual(zt);
  });
});
