// @maintained-by-ai
// WM-003/WM-008 seam owner: canonical weapon→mastery recognition at row level through
// the REAL collectWeaponMastery kind gate (unmocked) inside getAttacks'
// resolveOffHandActionType. Two one-call faces:
// - Full chosen bucket + latch armed: Nick off-hand rows promote to 'Action'; the
//   non-Nick Light (Vex Shortsword) row stays 'Bonus Action'.
// - Bucket excluding the Nick weapon: WM-008 nulls baseMastery, so the Dagger row
//   stays 'Bonus Action' even though its raw equipment row says Nick and the latch
//   is armed — the bucket, not the latch, is what refuses.
// Lane splits (cited verbatim, never duplicated here):
// - _Nick_UsedRound latch EXECUTION faces (promoted / stale-round / no-campaignName
//   falsifiers, canonical builder byte rows) → attackCalc2024-nick-dual-wielder.test.js:169-196.
//   This file's former pre-latch and promoted-to-Action latch faces are deleted citing
//   that range (#1233/#1235 rec, consumed by #1240).
// - Sheet recompute subscription on the latch → CharSheet.wm003-nick-recompute.test.jsx
// - collectWeaponMastery return envelopes → automationPassives.wm008-kindgate.test.js
// - Pure no-campaign light-melee seam → attackCalc2024-light-melee.test.js (#1236)
// Fixtures transcribed from public/data/equipment.json (verified 2026-10-20): Scimitar
// and Dagger Nick, Shortsword Vex; all Light Melee. The 1d6 main-hand tie resolves to
// Scimitar (pickHighestDamageWeapon strict >, first name wins), leaving both the Nick
// Dagger and the Vex Shortsword as off-hand rows. Only combatData and the runtime store
// are mocked (family canon #1235); current round is fixed at 1 and every runtime read
// is key-routed with explicit nulls — no self-compare, no probabilistic sweep.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
    getCurrentCombatRound: vi.fn(() => 1),
}));

const EQUIPMENT = [
    { name: 'Scimitar', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', damage: { damage_dice: '1d6', damage_type: 'Slashing' }, range: { normal: 5 }, properties: ['Finesse', 'Light'], mastery: 'Nick' },
    { name: 'Shortsword', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 5 }, properties: ['Finesse', 'Light', 'Monk'], mastery: 'Vex' },
    { name: 'Dagger', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', damage: { damage_dice: '1d4', damage_type: 'Piercing' }, range: { normal: 5 }, properties: ['Finesse', 'Light', 'Thrown', 'Monk'], mastery: 'Nick' },
];

const playerStats = () => ({
    name: 'EvasiveFighter',
    campaignName: 'test-campaign',
    rules: '2024',
    level: 5,
    abilities: [
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 2 },
    ],
    inventory: { equipped: ['Scimitar', 'Shortsword', 'Dagger'] },
    equipment: EQUIPMENT,
    automation: { passives: [{ type: 'weapon_kind_mastery', name: 'Weapon Mastery', meleeOnly: false }], bonusActions: [] },
});

// Key-routed runtime store: only the WM-008 kind bucket and the Nick latch answer;
// every other read is explicitly null.
const storeRoute = (chosenWeapons, nickUsedRound) => (name, key) => {
    if (key === '_Weapon_Kind_Mastery_chosenWeapons') return chosenWeapons;
    if (key === '_Nick_UsedRound') return nickUsedRound;
    return null;
};

// The two off-hand rows as readable "name: type (mastery)" triples — the display
// mastery stays raw on the row, so promotion is decided solely by gate + latch.
const offHandRows = attacks =>
    attacks
        .filter(a => ['Shortsword', 'Dagger'].includes(a.name))
        .map(a => `${a.name}: ${a.type} (${a.mastery})`);

describe('attackCalc2024 WM-003 — kind-gate mastery recognition for off-hand rows', () => {
    let getRuntimeValue;

    beforeEach(async () => {
        vi.clearAllMocks();
        getRuntimeValue = (await import('../../../hooks/runtime/useRuntimeState.js')).getRuntimeValue;
        getRuntimeValue.mockImplementation(storeRoute(null, null));
    });

    it('full chosen bucket with latch armed: Nick off-hand row promotes, Vex off-hand row does not', () => {
        getRuntimeValue.mockImplementation(storeRoute(['Scimitar', 'Shortsword', 'Dagger'], 1));

        expect(offHandRows(getAttacks(EQUIPMENT, [], playerStats()))).toEqual([
            'Shortsword: Bonus Action (Vex)',
            'Dagger: Action (Nick)',
        ]);
    });

    it('WM-008 gate falsifier: Nick weapon outside the chosen bucket stays Bonus Action even with the latch armed', () => {
        getRuntimeValue.mockImplementation(storeRoute(['Shortsword'], 1));

        expect(offHandRows(getAttacks(EQUIPMENT, [], playerStats()))).toEqual([
            'Shortsword: Bonus Action (Vex)',
            'Dagger: Bonus Action (Nick)',
        ]);
    });
});
