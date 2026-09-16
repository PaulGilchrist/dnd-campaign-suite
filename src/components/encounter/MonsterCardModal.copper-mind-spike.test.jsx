// MA-0087: Adult Copper Spellcasting — Mind Spike (level 4 version) is a
// save-leg spell (2024 WIS save, no attack_type). Clicking its per-spell link
// must route a spell-attributed WIS DC 17 save with the AUTHORED upcast level
// damage (5d8 Psychic, not the base lv2 3d8 — the MA-0112 save-leg residual),
// half-on-success. Byte-inert for clauseless/base rows.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells2024 from '../../../public/data/2024/spells.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 22, rolls: [5, 5, 5, 4, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 44, rolls: [5, 5, 5, 4, 3], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? spells2024 : [])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow, _setPopupHtml };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
vi.mock('../../services/rules/combat/damageUtils.js', async (importActual) => ({
  ...(await importActual()),
  extractDamageTypes: vi.fn(() => []),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));
vi.mock('../../services/shared/abilityLookup.js', () => ({ getAbilitySaveModifier: vi.fn(() => 0) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: runtime.getRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  useRuntimeValue: runtime.useRuntimeValue,
}));

import { loadSpells } from '../../services/ui/dataLoader.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

const SPELLCASTING = monstersData.find(m => m.index === 'adult-copper-dragon').actions.find(a => a.name === 'Spellcasting');

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell')).find(el => el.textContent.trim().startsWith(text)) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  loadSpells.mockImplementation((version) => Promise.resolve(version === '2024' ? spells2024 : []));
});

describe('MA-0087 Adult Copper Spellcasting Mind Spike cast level', () => {
  it('renders the Mind Spike per-spell link (MA-0091 seam, not a block-save-only row)', () => {
    const m = makeMonster({ name: 'Adult Copper Dragon', actions: [SPELLCASTING] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Copper Dragon 1' })} />);
    expect(linkByText('Mind Spike')).toBeTruthy();
  });

  it('clicking Mind Spike routes a WIS DC 17 save-leg with lv4 5d8 Psychic (not base 3d8), half-on-success', async () => {
    const m = makeMonster({ name: 'Adult Copper Dragon', actions: [SPELLCASTING] });
    const creatures = [
      { name: 'Adult Copper Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 184, maxHp: 184, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 30, maxHp: 30, conditions: [], computedStats: {} },
    ];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Copper Dragon 1', creatures })} />);
    const spike = linkByText('Mind Spike');
    fireEvent.click(spike);
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Mind Spike');
    expect(context.saveType).toBe('WIS');
    expect(context.saveDc).toBe(17);
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('5d8');
    expect(context.autoDamageDamageType).toBe('Psychic');
    expect(context.isSpellDamage).toBe(true);
  });
});
