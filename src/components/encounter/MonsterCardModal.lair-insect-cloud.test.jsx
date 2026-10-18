// @maintained-by-ai
// MA-0042 + MA-1749: black-dragon Insect Cloud lair row — structured zone row
// with an authored 20-ft zone (adult lair_actions[1]; young lair_actions[2]
// byte-mirrors it via the MA-1749 data fix, so both dragons ride the same
// legs below via it.each). Chip click routes through the MA-0031/MA-0035 area
// picker (title "20-ft Radius … selection advisory", CON DC 15, 3d6 Piercing,
// half-on-success, coverage gate off since the cloud is centered on a
// GM-chosen point) and carries the persisting-zone payload { effectKey:
// 'lair_insect_cloud', radiusFt: 20, repeatTurnEnd: true }. The single-target
// block-save seam is never invoked for a zone row.
// Cited owners (do NOT re-add here): chip render/role/title/advisory and the
// prose-render static branches → MonsterCardModal.lair-actions.test.jsx (#610);
// no-zone single-target block-save rows (Water Surge / Surging Pools /
// Grasping Tide) → MonsterCardModal.lair-darkness.test.jsx (#611);
// parse/grant/census → services/encounters/monsterLairActions.test.js.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay insect-cloud-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
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

const CLOUD_DRAGONS = [
  { index: 'adult-black-dragon', label: 'adult (MA-0042)', name: 'Adult Black Dragon', creatureName: 'Adult Black Dragon 1', currentHp: 195, ac: 19 },
  { index: 'young-black-dragon', label: 'young (MA-1749)', name: 'Young Black Dragon', creatureName: 'Young Black Dragon 1', currentHp: 127, ac: 18 },
];

function renderCloud(dragon) {
  const source = monstersData.find(m => m.index === dragon.index);
  const m = makeMonster({ name: dragon.name, lair_actions: source.lair_actions });
  const creatures = [
    { name: dragon.creatureName, type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: dragon.currentHp, maxHp: dragon.currentHp, ac: dragon.ac, conditions: [] },
    { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, ac: 11, conditions: [] },
    { name: 'ElderPaladin', type: 'player', currentHp: 60, maxHp: 60, ac: 12, conditions: [] },
  ];
  return render(<MonsterCardModal {...makeProps(m, { creatureName: dragon.creatureName, creatures })} />);
}

function lairLinkWithName(name) {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair')).find(el => el.textContent.includes(name)) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe.each(CLOUD_DRAGONS)('insect cloud lair row — $label → 20-ft radius area picker', (dragon) => {
  it('chip click routes to the area picker at CON DC 15, 3d6 Piercing half, radius 20, coverage gate off', async () => {
    renderCloud(dragon);
    fireEvent.click(lairLinkWithName('DC 15 Constitution'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.saveDc).toBe(15);
    expect(p.saveType).toBe('Constitution');
    expect(p.damage).toBe('3d6');
    expect(p.damageType).toBe('Piercing');
    expect(p.dcSuccess).toBe('half');
    expect(p.range).toBe(20);
    expect(p.rangeGateFt).toBeNull();
    expect(p.titleOverride).toBe('20-ft Radius (GM positions tokens; selection advisory)');
    expect(p.excludeNames).toEqual([dragon.creatureName]);
    expect(p.storeLastAttack).toBe(false);
    // no single-target block-save fires for a zone row
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('zone row carries the byte-identical persisting-zone payload for the picker-confirm arm', async () => {
    renderCloud(dragon);
    fireEvent.click(lairLinkWithName('DC 15 Constitution'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.zoneTe).toEqual({
      effectKey: 'lair_insect_cloud',
      trackingPrefix: 'lair_insect_cloud',
      radiusFt: 20,
      repeatTurnEnd: true,
      damage: '3d6',
      duration: 'until dismissed or used again (advisory)',
    });
  });
});
