// @maintained-by-ai
// MA-1502 regression: Sphinx of Valor Roar launcher click path. The disk row
// is MA-0268 byte-shape staged (staged_roar:true, numeric uses/maxUses:3,
// DC 20, 500-foot Emanation) with a ROW-AUTHORED roar_stages[] payload —
// click N arms ONLY stage N's Valor legs through SaveAttackAoeModal (pre-fix
// the row was prose-only, uses:"3/Day" NaN → zero affordance, zero delta).
// Owned elsewhere, not re-pinned here: stage leg bytes + passthrough and the
// exhausted→null return (roarService.ma1502-sphinx-of-valor.test.js); spend
// log description wording (monsterAbilityUses.test.js:83); Uses Exhausted
// popup face + roar_refused log copy (MonsterCardModal.staged-roar.test.jsx
// click 4, MA-0268 lane); chip counter rendering (MonsterAction.jsx usesGate
// chip, pinned there too); inline rollSavingThrow roar lane (MA-0268 file).
// Unique payload pinned here: the picker-open threading — per-stage save_type
// /dc_success/damage/conditions/label + 500-ft title reach the AoE picker,
// the spend record carries the stage label, and an exhausted press never
// opens the picker.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay cone-picker-stub"><div className="sp-body">{props.title}</div></div>;
  },
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

import { addEntry } from '../../services/ui/logService.js';

const CREATURES = [
  { name: 'Sphinx of Valor 1', type: 'npc', monsterType: 'celestial', targetName: 'Bandit 1', currentHp: 235, maxHp: 235, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, conditions: [] },
];

function renderValor(uses) {
  if (uses !== undefined) runtime.store['Sphinx of Valor 1.monsterSpellUses'] = uses;
  const roar = monstersData.find(m => m.index === 'sphinx-of-valor').actions.find(a => a.name === 'Roar');
  const m = makeMonster({ name: 'Sphinx of Valor', type: 'celestial', actions: [roar] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Sphinx of Valor 1', creatures: CREATURES })} />);
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('.mc-action')?.querySelector('strong')?.textContent.trim().startsWith('Roar.')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-1502 Valor staged roar launcher click path', () => {
  it.each([
    { spent: 0, saveType: 'Wisdom', dcSuccess: 'none', damage: null, saveConditions: ['frightened'], label: 'First Roar (1 of 3)' },
    { spent: 1, saveType: 'Wisdom', dcSuccess: 'none', damage: null, saveConditions: ['paralyzed'], label: 'Second Roar (2 of 3)' },
    { spent: 2, saveType: 'Constitution', dcSuccess: 'half', damage: '8d10', saveConditions: ['prone'], label: 'Third Roar (3 of 3)' },
  ])('click with $spent spent arms ONLY stage $spent: $saveType DC 20, damage $damage, $saveConditions, honest label, spend logged with stage label', async ({ spent, saveType, dcSuccess, damage, saveConditions, label }) => {
    const link = renderValor(spent ? { Roar: spent } : undefined);
    expect(link).toBeTruthy();
    fireEvent.click(link);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.saveType).toBe(saveType);
    expect(aoeProps.current.action.save_dc).toBe(20);
    expect(aoeProps.current.dcSuccess).toBe(dcSuccess);
    expect(aoeProps.current.damage).toBe(damage);
    expect(aoeProps.current.saveConditions).toEqual(saveConditions);
    expect(aoeProps.current.action.name).toBe(label);
    expect(aoeProps.current.titleOverride).toContain('500-ft Radius');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe(label);
  });

  it('4th click (3 spent): gate refuses — honest 0-left chip, AoE picker never opens', () => {
    const link = renderValor({ Roar: 3 });
    expect(link.textContent).toMatch(/\(3\/Day · 0 left\)/);
    fireEvent.click(link);
    expect(aoeProps.current).toBeNull();
  });
});
