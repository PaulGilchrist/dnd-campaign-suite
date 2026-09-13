// MA-0043: Adult Black Dragon Shroud of Darkness lair row — formerly a plain
// string (inert, zero affordance, MV-18/MV-21 fingerprint). Now structured
// with a save-less 15-ft zone: chip click routes to the area picker in
// zoneOnly mode (title "15-ft radius (GM positions; selection advisory)",
// NO save DC/type, NO damage, zone payload carries effectKey 'lair_darkness'
// + the GM-enforced light/dispel advisory clause). The single-target
// block-save seam is never invoked; sibling rows (Water Surge save block,
// Insect Cloud zone save) route exactly as before.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay darkness-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
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
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Thug 1', creatures: [] })),
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
  { name: 'Adult Black Dragon 1', type: 'npc', monsterType: 'dragon', targetName: null, currentHp: 195, maxHp: 195, ac: 19, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, ac: 11, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 60, maxHp: 60, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'adult-black-dragon');
  const m = makeMonster({ name: 'Adult Black Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Black Dragon 1', creatures: CREATURES })} />);
}

function lairLinkWithName(name) {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair')).find(el => el.textContent.includes(name)) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0043 Shroud of Darkness lair row → zone-only area picker', () => {
  it('structured save-less zone row renders a clickable Shroud of Darkness chip', () => {
    renderDragon();
    const chip = lairLinkWithName('Shroud of Darkness');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('title')).toMatch(/Lair action — Shroud of Darkness/);
  });

  it('chip click routes to the picker in zoneOnly mode: no save, no damage, radius 15, gate off', async () => {
    renderDragon();
    fireEvent.click(lairLinkWithName('Shroud of Darkness'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.titleOverride).toBe('15-ft radius (GM positions; selection advisory)');
    expect(p.saveDc ?? null).toBeNull();
    expect(p.saveType).toBeNull();
    expect(p.damage).toBeNull();
    expect(p.damageType).toBeNull();
    expect(p.dcSuccess).toBeNull();
    expect(p.range).toBe(15);
    expect(p.rangeGateFt).toBeNull();
    expect(p.zoneOnly).toBe(true);
    expect(p.excludeNames).toEqual(['Adult Black Dragon 1']);
    expect(p.storeLastAttack).toBe(false);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('zone payload carries lair_darkness effectKey + tracking prefix + GM-enforced dispel clause', async () => {
    renderDragon();
    fireEvent.click(lairLinkWithName('Shroud of Darkness'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const zt = aoeProps.current.zoneTe;
    expect(zt.effectKey).toBe('lair_darkness');
    expect(zt.trackingPrefix).toBe('lair_darkness');
    expect(zt.radiusFt).toBe(15);
    expect(zt.repeatTurnEnd).toBe(false);
    expect(zt.damage).toBeNull();
    expect(zt.duration).toBe('until dismissed or used again (advisory)');
    expect(zt.clause).toMatch(/dispel only by 2nd-level\+ light — GM-enforced/);
  });

  it('insect cloud (zone with save) still routes the DC 15 CON picker with byte-identical payload (no clause key)', async () => {
    renderDragon();
    fireEvent.click(lairLinkWithName('DC 15 Constitution'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.zoneOnly).toBe(false);
    expect(aoeProps.current.zoneTe).toEqual({
      effectKey: 'lair_insect_cloud',
      trackingPrefix: 'lair_insect_cloud',
      radiusFt: 20,
      repeatTurnEnd: true,
      damage: '3d6',
      duration: 'until dismissed or used again (advisory)',
    });
  });

  it('Water Surge (no authored zone) keeps the byte-identical single-target block save', async () => {
    renderDragon();
    fireEvent.click(lairLinkWithName('DC 15 Strength'));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(aoeProps.current).toBeNull();
  });
});
