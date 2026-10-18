// @maintained-by-ai
// MA-0063: Adult Blue Dragon Sand Cloud lair row — CANONICAL zone+save picker
// template (CON DC 15, no damage, blinded 1 min) mirroring MA-0042 Insect Cloud.
// CANONICAL TEMPLATE: young-blue (MonsterCardModal.lair-sand-cloud-young-blue
// .test.jsx:10-13) cites the picker-prop template and zoneTe byte blocks below —
// keep them byte-intact (ranges reported if shifted). Cited owners (do NOT
// re-add here): chip render/title/advisory + static branches →
// MonsterCardModal.lair-actions.test.jsx (#610); parse/grant/census →
// services/encounters/monsterLairActions.test.js; block-save-never-invoked →
// MonsterCardModal.lair-darkness.test.jsx:131 (kept once here inside the cited
// prop block). Fixtures BY-name off disk (#387). No timers.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay sand-cloud-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
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

const CREATURES = [
  { name: 'Adult Blue Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 225, maxHp: 225, ac: 19, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, ac: 11, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 60, maxHp: 60, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'adult-blue-dragon');
  const m = makeMonster({ name: 'Adult Blue Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Blue Dragon 1', creatures: CREATURES })} />);
}

function lairLinkWithName(name) {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair')).find(el => el.textContent.includes(name)) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0063 Sand Cloud lair row → 20-ft radius area picker', () => {
  it('chip click routes to the area picker at CON DC 15, no damage, radius 20, blinded saveConditions', async () => {
    renderDragon();
    fireEvent.click(lairLinkWithName('DC 15 Constitution'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.saveDc).toBe(15);
    expect(p.saveType).toBe('Constitution');
    expect(p.damage).toBeNull();
    expect(p.dcSuccess).toBe('none');
    expect(p.range).toBe(20);
    expect(p.rangeGateFt).toBeNull();
    expect(p.saveConditions).toEqual(['blinded']);
    expect(p.titleOverride).toBe('20-ft Radius (GM positions tokens; selection advisory)');
    expect(p.excludeNames).toEqual(['Adult Blue Dragon 1']);
    // no single-target block-save fires for a zone row
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('zone row carries the persisting-zone payload lair_sand_cloud for the picker-confirm arm', async () => {
    renderDragon();
    fireEvent.click(lairLinkWithName('DC 15 Constitution'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.zoneTe).toEqual({
      effectKey: 'lair_sand_cloud',
      trackingPrefix: 'lair_sand_cloud',
      radiusFt: 20,
      repeatTurnEnd: false,
      damage: null,
      duration: 'blinded 1 minute (repeat save ends early; advisory)',
      clause: expect.stringMatching(/GM-enforced/),
    });
  });
});
