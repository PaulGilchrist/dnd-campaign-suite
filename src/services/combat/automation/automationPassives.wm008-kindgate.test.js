// @maintained-by-ai
// Lane: automationPassives WM-008 — the kind-bucket gate × replaceMastery
// precedence matrix of collectWeaponMastery. The WM-008 bug: the gate
// (passives.some type === 'weapon_kind_mastery' && !kindMatch ⇒ baseMastery
// null) runs BEFORE the replace branch; a non-chosen weapon (Shortbow with
// chosenWeapons=['Shortsword']) must never keep raw Vex nor get Tactical
// Master options resurrected through the replace branch.
// Family map (cited, never duplicated): base automationPassives.test.js #969
// EXPLICITLY cites this file for "kind-gate × replaceMastery precedence" and
// owns generic aggregation, the meleeOnly range table, null-shape fallthroughs,
// and mastery-less+replace null. elementalAdept #965, fortifiedHealth #966,
// landResistance #967, stormbornResistance #968 own their resistances lanes.
// Cited face (#969): the "non-chosen + replace" leg below — strengthened to
// exact envelope bytes (gate-nulls base, suppresses options AND attribution).
// Falsifiable legs (#842): all three envelopes are byte-distinct — match
// offers with attribution, mismatch nulls despite attribution, gate-off
// control (#934) survives unattributed. Store mocks are name+key-routed with
// explicit nulls (#908/#940); branch unmocked (#791). Pure predicate: no
// logging, no timers, zero network, no wall-clock.
// Old -> new: 3 standalone its -> one 3-leg it.each matrix with exact-byte
// envelopes. Old it@34 (non-chosen+replace, #969-cited) -> leg 2 (below);
// old it@46 (chosen+replace) -> leg 1; old it@57 (gate-off control) -> leg 3.
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

// Name+key-routed store mock: only the kind-mastery chosenWeapons bucket
// answers; every other read is explicitly null (#940).
const kindRoute = (chosenWeapons) => (name, key) =>
  name === 'EvasiveFighter' && key === '_Weapon_Kind_Mastery_chosenWeapons' ? chosenWeapons : null;

const kindPassive = { type: 'weapon_kind_mastery', meleeOnly: false };
const tacticalPassive = { name: 'Tactical Master', replaceMastery: ['Push', 'Sap', 'Slow'] };

describe('WM-008 collectWeaponMastery kind-gate × replaceMastery precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(kindRoute(['Shortsword']));
  });

  it.each([
    {
      label: 'kind-match + replace offers replacement, base survives, attributed',
      weapon: 'Shortsword',
      passives: [kindPassive, tacticalPassive],
      expected: {
        baseMastery: 'Vex',
        extraMasteries: [],
        replaceMasteryOptions: ['Push', 'Sap', 'Slow'],
        choiceMasteries: null,
        featureName: 'Tactical Master',
      },
    },
    {
      // #969-cited face — preserve. The gate nulls baseMastery before the
      // replace branch, so Tactical Master offers nothing (and claims
      // nothing) for this weapon.
      label: 'non-chosen + replace gates base out, suppresses options and attribution',
      weapon: 'Shortbow',
      passives: [kindPassive, tacticalPassive],
      expected: {
        baseMastery: null,
        extraMasteries: [],
        replaceMasteryOptions: null,
        choiceMasteries: null,
        featureName: null,
      },
    },
    {
      // Gate-off control (#934): same weapon + same replace list WITHOUT the
      // kind passive survives — proving leg 2's nulls come from the gate, not
      // from replace. Unnamed passive ⇒ featureName attribution is null here,
      // keeping this envelope byte-distinct from leg 1 (#842).
      label: 'gate-off control + replace survives unchanged (unattributed)',
      weapon: 'Shortbow',
      passives: [{ replaceMastery: ['Push', 'Sap', 'Slow'] }],
      expected: {
        baseMastery: 'Vex',
        extraMasteries: [],
        replaceMasteryOptions: ['Push', 'Sap', 'Slow'],
        choiceMasteries: null,
        featureName: null,
      },
    },
  ])('$label', ({ weapon, passives, expected }) => {
    const stats = { name: 'EvasiveFighter', equipment, automation: { passives } };
    expect(collectWeaponMastery(weapon, stats)).toEqual(expected);
  });
});
