// MA-0039 regression: Adult Black Dragon Frightful Presence legendary row.
// DATA fix (monsters.json): FP gains save_dc 17 / save_type Wisdom /
// save_effect frightened — the row rides the landed seams: MA-0021 gated
// legendary spend (round+turn latch = once-per-turn gate), MA-0035 DC-chip
// affordance, MA-0017 damageless failed-save condition application
// (saveProcessing.applyDamagelessSaveConditions), MA-0019 condition
// provenance. 60-ft multi-target selection stays advisory (MV-21 model).
//
// Trimmed: chip-render folded into the click test; pure-data mirror of
// save_dc/save_type/save_effect is re-asserted by the click ctx below
// (extractConditionsFromSaveEffect parse proven by saveConditions:['frightened']).
// Once-per-turn latch + exhausted refusal generically pinned in
// MonsterCardModal.legendary-uses.test.jsx (:297 exhausted, :310 MA-0021 latch).
// Adult White / Ancient Black / Dracolich FP rows homed in their own
// *-fp.test.jsx siblings; FP service arm/repeat owned by
// frightfulPresenceService.test.js. This file's unique lane: the unpinned
// Adult Black DC-17 WIS row — chip detection + click resolution.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
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

const ABD = monstersData.find(m => m.name === 'Adult Black Dragon');

const CREATURES = [
  { name: 'Adult Black Dragon 1', type: 'npc', targetName: 'TestPC', currentHp: 195, maxHp: 195, ac: 19, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function fpSaveChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.closest('div')?.textContent.includes('Frightful Presence')) || null;
}

describe('MA-0039 Adult Black Dragon Frightful Presence legendary row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
    runtime.store['Adult Black Dragon 1.monsterLegendaryUses'] = { max: 3, used: 0 };
    render(<MonsterCardModal {...makeProps(makeMonster({ ...ABD, name: 'Adult Black Dragon' }), { creatureName: 'Adult Black Dragon 1', creatures: CREATURES })} />);
  });

  it('renders DC 17 Wisdom chip; click expends 1 use, opens WIS save at DC 17 with frightened context, no damage, logs spend', async () => {
    const chip = fpSaveChip();
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('DC 17 Wisdom');

    fireEvent.click(chip);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(runtime.store['Adult Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(String(call[0]).toLowerCase()).toBe('wis');
    expect(call[2]).toMatchObject({
      saveDc: 17,
      saveType: 'Wisdom',
      saveConditions: ['frightened'],
      autoDamageFormula: null,
      attackerName: 'Adult Black Dragon 1',
      actionName: 'Frightful Presence',
    });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Frightful Presence/.test(e.description));
    expect(spend).toBeTruthy();
  });
});

// @maintained-by-ai
