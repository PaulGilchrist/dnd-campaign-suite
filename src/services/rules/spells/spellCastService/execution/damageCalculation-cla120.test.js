// CLA-120: computeEmpoweredEvocation is the single owner of the INT fold —
// idempotent on pre-baked formulas, gated on evocation school + spell.damage,
// eligible for cantrip and leveled spells alike.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn().mockReturnValue([]),
  getEmpoweredEvocationIntModifier: vi.fn().mockReturnValue(0),
}));

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

import { computeEmpoweredEvocation } from './damageCalculation.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../postCastRiderService.js';

const HOLDER = { name: 'DivinationWizard', abilities: [{ name: 'Intelligence', bonus: 5 }] };

const FIRE_BOLT = { name: 'Fire Bolt', level: 0, school: 'Evocation', damage: { damage_type: 'Fire', formula: '1d10' } };
const FIREBALL = { name: 'Fireball', level: 3, school: 'Evocation', damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } } };
const POISON_SPRAY = { name: 'Poison Spray', level: 0, school: 'Necromancy', damage: { damage_type: 'Poison', formula: '1d12' } };

describe('computeEmpoweredEvocation — CLA-120 single-fold owner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([{ type: 'empowered_evocation' }]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(5);
  });

  it('folds +INT exactly once onto a cantrip formula', () => {
    const { empEvocFormula, empEvocIntMod } = computeEmpoweredEvocation(HOLDER, FIRE_BOLT, '1d10');
    expect(empEvocFormula).toBe('1d10 + 5 [Empowered Evocation]');
    expect(empEvocIntMod).toBe(5);
  });

  it('folds +INT exactly once onto a leveled spell formula (cantrip+leveled eligibility)', () => {
    const { empEvocFormula } = computeEmpoweredEvocation(HOLDER, FIREBALL, '8d6');
    expect(empEvocFormula).toBe('8d6 + 5 [Empowered Evocation]');
    expect(empEvocFormula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('is idempotent: a formula already carrying [Empowered Evocation] is returned unchanged', () => {
    const preBaked = '4d10 + 5 [Empowered Evocation]';
    const { empEvocFormula } = computeEmpoweredEvocation(HOLDER, FIRE_BOLT, preBaked);
    expect(empEvocFormula).toBe(preBaked);
    expect(empEvocFormula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('non-evocation school gate stays zero (Poison Spray control)', () => {
    const { empEvocFormula, empEvocIntMod } = computeEmpoweredEvocation(HOLDER, POISON_SPRAY, '4d12');
    expect(empEvocFormula).toBe('4d12');
    expect(empEvocFormula).not.toContain('[Empowered Evocation]');
    expect(empEvocIntMod).toBe(0);
  });

  it('zero INT modifier → no term', () => {
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);
    const { empEvocFormula, empEvocIntMod } = computeEmpoweredEvocation(HOLDER, FIRE_BOLT, '1d10');
    expect(empEvocFormula).toBe('1d10');
    expect(empEvocIntMod).toBe(0);
  });
});
