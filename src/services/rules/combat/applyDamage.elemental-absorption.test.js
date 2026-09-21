// MA-0681 consumer seam: Elemental Absorption (Elemental Cultist, 1/Day).
// The press-at-pending-hit resolver stamps a one-shot elemental_absorption
// resistance activeBuffs entry on the NPC cultist; applyDamageToTarget folds
// ONLY that buff's resistanceTypes into the NPC's live resistances → halves
// THAT instance, grants-through THP absorbs the halved damage (tempHp), logs
// the raw→halved detail, and consumes the stamp (one-shot, parry_consumed
// lineage). Non-elemental and no-buff damage stay byte-identical.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

const store = {};
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[`${name}.${key}`]),
  setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; }),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));
vi.mock('../../combat/concentration/concentrationRules.js', () => ({ rollConcentrationSave: vi.fn() }));
vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'g-1') } }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

import { applyDamageToTarget } from './applyDamage.js';
import { addEntry } from '../../ui/logService.js';

const CULTIST = 'Elemental Cultist 1';

function cultist(over = {}) {
  return { name: CULTIST, type: 'npc', maxHp: 78, currentHp: 78, resistances: [], immunities: [], conditions: [], template: [], concentration: null, saveBonuses: {}, ...over };
}

function armedFire(tempHp = 0) {
  store[`${CULTIST}.activeBuffs`] = [{ effect: 'elemental_absorption', resistanceTypes: ['Fire'] }];
  store[`${CULTIST}.tempHp`] = tempHp;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(store)) delete store[k];
});

describe('MA-0681 applyDamage — elemental absorption halves THAT instance', () => {
  it('halves an armed Fire hit to the cultist, one-shot consumes the stamp', async () => {
    armedFire(0);
    const cs = { round: 1, creatures: [cultist({ currentHp: 78 })] };
    const result = await applyDamageToTarget(cs, CULTIST, 22, ['Fire'], { campaignName: 'test-campaign', characters: [] });
    expect(result.finalDamage).toBe(11);
    expect(result.damageReduced).toBe(true);
    expect(result.resistanceDetails.some(rd => rd.status === 'resistant' && rd.damageType === 'Fire')).toBe(true);
    // one-shot consume: the armed resistance buff is stripped so a later hit never re-halves.
    expect((store[`${CULTIST}.activeBuffs`] || []).some(b => b.effect === 'elemental_absorption')).toBe(false);
    const detail = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'elemental_absorption_applied');
    expect(detail).toBeTruthy();
    expect(detail.description).toMatch(/22 halved to 11/);
    expect(detail.rawDamage).toBe(22);
    expect(detail.appliedDamage).toBe(11);
  });

  it('THP absorbs the halved instance before HP', async () => {
    armedFire(10);
    const cs = { round: 1, creatures: [cultist({ currentHp: 78 })] };
    const result = await applyDamageToTarget(cs, CULTIST, 22, ['Fire'], { campaignName: 'test-campaign', characters: [] });
    expect(result.finalDamage).toBe(11);
    expect(store[`${CULTIST}.tempHp`]).toBe(0);
    expect(result.newHp).toBe(77);
  });

  it('non-elemental damage is byte-inert (no halving, stamp untouched)', async () => {
    store[`${CULTIST}.activeBuffs`] = [{ effect: 'elemental_absorption', resistanceTypes: ['Fire'] }];
    const cs = { round: 1, creatures: [cultist({ currentHp: 78 })] };
    const result = await applyDamageToTarget(cs, CULTIST, 22, ['Poison'], { campaignName: 'test-campaign', characters: [] });
    expect(result.finalDamage).toBe(22);
    expect(store[`${CULTIST}.activeBuffs`].some(b => b.effect === 'elemental_absorption')).toBe(true);
  });

  it('no armed buff: plain full damage, no absorption log', async () => {
    const cs = { round: 1, creatures: [cultist({ currentHp: 78 })] };
    const result = await applyDamageToTarget(cs, CULTIST, 22, ['Fire'], { campaignName: 'test-campaign', characters: [] });
    expect(result.finalDamage).toBe(22);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'elemental_absorption_applied')).toBe(false);
  });
});
