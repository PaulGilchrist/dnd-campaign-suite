// @maintained-by-ai
// MA-1755 young-blue-dragon Sand Cloud chip — the ONLY young-specific fact at this
// component seam: young-blue's card renders the [2] row as a clickable chip that opens
// the zone+save composite picker carrying the distinct lair_sand_cloud te payload
// (effectKey/radius/blinded-duration bytes differ from MA-0042 insect-cloud, which has
// no zone/effect_key/advisory at all). Row bytes are BY-name locked once by the owner
// service lane (monsterLairActions.test.js MA-1755 :5280, byte-twin-of-adult :5319;
// MA-1753 :5180 / MA-1754 :2283 twins) — young [2] is byte-identical to adult [1], and
// zoneTeForAction is pure (MonsterCardModal.jsx:220-241), so the full picker-prop shape
// is NOT re-pinned here: cite the adult template MonsterCardModal.lair-sand-cloud.test.jsx
// :110-126 (zone-picker payload template) + chip-render owner MonsterCardModal.lair-actions.test.jsx
// (chip-vs-static branches, MonsterCardBody.jsx:384-419) + block-save-never-invoked owner
// MonsterCardModal.lair-darkness.test.jsx:131. We keep only the young-card distinct bytes:
// zoneTe lair_sand_cloud payload + young-specific excludeNames + the never-invoked
// block-save gate at this exact seam.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay young-blue-sand-cloud-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
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
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'ElderPaladin', creatures: [] })),
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

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-1755 young-blue-dragon Sand Cloud lair row → 20-ft radius area picker', () => {
  it('chip press opens the zone picker with the distinct lair_sand_cloud payload; block-save never invoked', async () => {
    const dragon = monstersData.find(m => m.index === 'young-blue-dragon');
    const m = makeMonster({ name: 'Young Blue Dragon', lair_actions: dragon.lair_actions });
    render(<MonsterCardModal {...makeProps(m, {
      creatureName: 'Young Blue Dragon 1',
      creatures: [
        { name: 'Young Blue Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 155, maxHp: 155, ac: 18, conditions: [] },
        { name: 'ElderPaladin', type: 'player', currentHp: 60, maxHp: 60, conditions: [] },
      ],
    })} />);
    const chip = Array.from(document.querySelectorAll('.mc-dice-link-lair')).find(el => el.textContent.includes('DC 15 Constitution'));
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.saveConditions).toEqual(['blinded']);
    expect(p.excludeNames).toEqual(['Young Blue Dragon 1']);
    expect(p.zoneTe).toMatchObject({
      effectKey: 'lair_sand_cloud',
      radiusFt: 20,
      duration: 'blinded 1 minute (repeat save ends early; advisory)',
    });
    expect(p.zoneTe.clause).toMatch(/GM-enforced/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
