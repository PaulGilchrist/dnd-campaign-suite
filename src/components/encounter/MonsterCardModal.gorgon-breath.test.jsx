// @maintained-by-ai
// MA-0904: Gorgon Petrifying Breath cone-picker threading — the row now
// authors the MA-0501 structured staged_petrify key (petrified_hours 24),
// so every fresh click arms SaveAttackAoeModal with stagedPetrify
// { petrifiedRounds: 14400 } (24h×600, CLA-334). The extractor prose
// word-scan still yields Petrified+Restrained (byte-unchanged) — the picker
// SUPPRESSES that flat grant while the ladder is armed (the picker route
// itself is exercised in SaveAttackAoeModal.staged-petrify.test.jsx).
// Trimmed: excludeNames/storeLastAttack cite-skipped to cone/aoe shape owners
// (recharge-cone :148-149, line-breath :148-149, paralyzing-breath, sleep-breath);
// te ladder legs pinned by cockatricePetrifyService.test.js (dc15 'Petrifying
// Breath' label, petrifiedRounds 14400); pro+lowercase case-insensitivity owner
// #586 keeps the capitalized-prose legs (report ranges) and the saveConditions
// arm leg. diceRoller + _rollSavingThrow/_setPopupHtml mock internals purged
// (empirical: handleSaveRoll arms the stubbed picker, never rolls here).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return (
      <div className="sp-overlay cone-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

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
  { name: 'Gorgon 1', type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', currentHp: 50, maxHp: 50, ac: 19, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, conditions: [] },
];

function gorgonActions() {
  return monstersData.find(m => m.name === 'Gorgon').actions;
}

function gorgonBreathAction() {
  return gorgonActions().find(a => a.name === 'Petrifying Breath');
}

function renderGorgon() {
  const m = makeMonster({ name: 'Gorgon', actions: gorgonActions() });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Gorgon 1', creatures: CREATURES })} />);
}

function breathLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes('Petrifying Breath')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0904 Gorgon Petrifying Breath data lock', () => {
  it('row authors staged_petrify{petrified_hours:24} on DC 15 CON 30-ft Cone, no damage dice, recharge 5-6 kept', () => {
    const action = gorgonBreathAction();
    expect(action).toBeTruthy();
    expect(action.save_dc).toBe(15);
    expect(action.save_type).toBe('Constitution');
    expect(action.range).toBe('30-foot Cone');
    expect(action.staged_petrify).toEqual({ petrified_hours: 24 });
    expect(action.recharge).toBe('5-6');
    expect(action.damage_dice_primary == null).toBe(true);
    expect(action.attack_bonus == null).toBe(true);
  });

  it('save_effect keeps canonical two-stage ladder prose (byte-preserve)', () => {
    const action = gorgonBreathAction();
    expect(action.save_effect).toContain('First Failure: The target has the Restrained condition');
    expect(action.save_effect).toContain('repeats the save at the end of its next turn if it is still Restrained');
    expect(action.save_effect).toContain('Second Failure: The target has the Petrified condition');
  });
});

describe('MA-0904 Petrifying Breath cone picker staged transport', () => {
  it('click arms SaveAttackAoeModal with stagedPetrify{petrifiedRounds:14400}, dc 15 CON, no damage; extractor saveConditions ride unsuppressed upstream', async () => {
    renderGorgon();
    const link = breathLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.saveDc).toBe(15);
    expect(aoeProps.current.saveType).toBe('Constitution');
    expect(aoeProps.current.damage).toBe(null);
    expect(aoeProps.current.stagedPetrify).toEqual({ petrifiedRounds: 14400 });
    // Extractor stays byte-unchanged: its word-scan output still rides the
    // picker as saveConditions (double-grant suppression happens INSIDE the
    // picker when the ladder is armed — see SaveAttackAoeModal.staged-petrify).
    expect(aoeProps.current.saveConditions).toEqual(expect.arrayContaining(['petrified', 'restrained']));
  });
});
