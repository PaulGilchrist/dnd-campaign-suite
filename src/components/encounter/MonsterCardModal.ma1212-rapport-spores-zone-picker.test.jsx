// @maintained-by-ai
// MA-1212/1217/1220: Myconid Adult/Sovereign/Sprout "Rapport Spores" ACTION-row →
// the untouched MA-0043 zoneOnly area picker. The modal's own seam: chip click routes
// handleZonePickerRow → handleLairZone({...action, save_dc:null}) — picker opens with
// NO save DC (MA-1071 DC0 decoy neutralized by the null-normalization), NO damage,
// zoneTe effectKey 'rapport_spores' + duration '1 hour' + GM-enforced clause,
// excludeNames [caster], storeLastAttack false. The roll seams are never invoked —
// the pre-fix fingerprint (bogus "+0" roll/attack vs the armed target) can no longer
// occur. Disk byte-lock + isZonePickerRow + chip render are owned by
// MonsterAction.ma1212-rapport-spores-zone-chip.test.jsx; picker-side confirm/te
// grant by SaveAttackAoeModal.ma1212-rapport-zone-grant.test.jsx; registry entry by
// targetEffectDefinitions.test.js. Byte-twins via describe.each per lair-sand-cloud
// template (#615).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

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

const MYCONIDS = [
  // MA-1212 adult, MA-1217 sovereign, MA-1220 sprout — byte-twin rapport rows.
  { index: 'myconid-adult', caster: 'Myconid Adult 1', ticket: 'MA-1212' },
  { index: 'myconid-sovereign', caster: 'Myconid Sovereign 1', ticket: 'MA-1217' },
  { index: 'myconid-sprout', caster: 'Myconid Sprout 1', ticket: 'MA-1220' },
];

function renderMyconid(index, creatureName) {
  const monster = monstersData.find(m => m.index === index);
  const m = makeMonster({ name: monster.name, actions: monster.actions, traits: monster.traits });
  return render(<MonsterCardModal {...makeProps(m, { creatureName, creatures: CREATURES })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe.each(MYCONIDS)('$ticket myconid rapport row → zoneOnly picker (no save, no roll)', ({ index, caster, ticket }) => {
  it(`${ticket} ${index}: chip click opens the zoneOnly picker — save_dc:0 decoy normalized to null, caster excluded, rapport_spores zoneTe rides, zero rolls`, async () => {
    renderMyconid(index, caster);
    const chip = document.querySelector('.mc-dice-link-zone');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('30-ft Zone');
    fireEvent.click(chip);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    // MA-1071 DC0 decoy neutralized + save-less shape: every save/damage prop null.
    expect(p.zoneOnly).toBe(true);
    expect(p.saveDc ?? null).toBeNull();
    expect(p.saveType ?? null).toBeNull();
    expect(p.damage ?? null).toBeNull();
    expect(p.damageType ?? null).toBeNull();
    expect(p.dcSuccess ?? null).toBeNull();
    expect(p.rangeGateFt ?? null).toBeNull();
    expect(p.range).toBe(30);
    expect(p.excludeNames).toEqual([caster]);
    expect(p.storeLastAttack).toBe(false);
    // zoneTe arm payload pinned against the disk row, not re-derived.
    expect(p.zoneTe).toMatchObject({
      effectKey: 'rapport_spores',
      trackingPrefix: 'rapport_spores',
      radiusFt: 30,
      repeatTurnEnd: false,
      damage: null,
      duration: '1 hour',
      noun: 'rapport spores',
    });
    expect(p.zoneTe.clause).toMatch(/GM-enforced/);
    // Pre-fix fingerprint: the roll seams are never invoked for a save-less zone row.
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
