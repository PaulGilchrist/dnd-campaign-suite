// WM-008: kind-bucket gate leak. When a player has a weapon_kind_mastery passive AND a
// replaceMastery (Tactical Master) passive, the kind-bucket nulling must still run —
// otherwise a non-chosen weapon (e.g. Shortbow with chosenWeapons=['Shortsword']) kept
// its raw base mastery (Vex) and auto-applied it via the tacticalMaster step.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectWeaponMastery } from './automationPassives.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));
vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => null),
}));

const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

const equipment = [
  { name: 'Shortsword', mastery: 'Vex', weapon_range: 'Melee' },
  { name: 'Shortbow', mastery: 'Vex', weapon_range: 'Ranged' },
];

function makeStats(passives) {
  return { name: 'EvasiveFighter', equipment, automation: { passives } };
}

describe('WM-008 collectWeaponMastery kind-bucket gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const kindPassive = { type: 'weapon_kind_mastery', meleeOnly: false };
  const tacticalPassive = { replaceMastery: ['Push', 'Sap', 'Slow'] };

  it('nulls baseMastery for a non-chosen weapon even when Tactical Master replaceMastery exists', () => {
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'EvasiveFighter' && prop === '_Weapon_Kind_Mastery_chosenWeapons') return ['Shortsword'];
      return undefined;
    });
    const stats = makeStats([kindPassive, tacticalPassive]);
    const result = collectWeaponMastery('Shortbow', stats);
    expect(result.baseMastery).toBeNull();
    // No usable base mastery → Tactical Master offers nothing for it.
    expect(result.replaceMasteryOptions).toBeNull();
  });

  it('keeps baseMastery + offers replacement for the CHOSEN weapon', () => {
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'EvasiveFighter' && prop === '_Weapon_Kind_Mastery_chosenWeapons') return ['Shortsword'];
      return undefined;
    });
    const stats = makeStats([kindPassive, tacticalPassive]);
    const result = collectWeaponMastery('Shortsword', stats);
    expect(result.baseMastery).toBe('Vex');
    expect(result.replaceMasteryOptions).toEqual(['Push', 'Sap', 'Slow']);
  });

  it('leaves baseMastery intact for weapons when the player has no kind-mastery passive', () => {
    const stats = makeStats([tacticalPassive]);
    const result = collectWeaponMastery('Shortbow', stats);
    expect(result.baseMastery).toBe('Vex');
  });
});
