// @maintained-by-ai
// SP-074 mage_armor RUNTIME-BUFF AC-MATH OWNER: rules-armorClass.js computeBaseArmorClass
// buff branch (rules-armorClass.js:60-65) — 13 + Dex UNCAPPED (RAW) + precedence over the
// base armor/unarmored lanes. This is the AC face every twin header points at:
//  - core/rules-armorClass.test.js (5e twin, answers its standing rec): owns disk-read AC
//    formula rows + quirks/MAM :94/shield-drop trio — disk BASE formula tables are NOT
//    re-run here; only the buff-active branch and stale-buff precedence arithmetic.
//  - core/rules-armorClass-2024.test.js (2024 twin): owns Defense-feat ac_bonus matrix +
//    Draconic/Dance it.each — addedBonus passives stacking is theirs, not re-run here.
//  - features/mageArmorService.test.js: owns DONNING-STRIP enforcement (its own header
//    cites THIS file as AC-math owner). Test 3 here is desync insurance: if a buff
//    survives in the store while armor is worn, the computation still prefers 13 + Dex.
//  - automation/handlers/buffs/mageArmorHandler.test.js: owns the expiry clock (§38
//    hours×600) and the exact activeBuffs stamp (producer: mageArmorHandler.js:81-82
//    stamps effect 'mage_armor', baseAc 13). NO CLOCK here: grep of rules-armorClass.js
//    shows zero setTimeout/setInterval/Date.now — AC computation is instantaneous.
//    Disk spell row (public/data/spells.json, read): 'Mage Armor' duration '8 hours',
//    non-concentration — >=1 min is combat-scoped by repo policy.
//  - hooks/combat/spellGates.mageArmor.test.js: owns the CAST gate (unarmored targets
//    only, 'mage_armor_refused'); the armored-coexistence precedence row below is
//    arithmetic desync insurance, not gate duplication.
// Registry check: effect keys 'mage_armor'/'mage_armor_apply' live in
// automation/index.js:568-569 as activeBuffs effects — targetEffectDefinitions.js has NO
// mage_armor row (not a targetEffect); no duplication needed there.
// Purity: ZERO mocks — the buff store is the REAL in-memory runtime store
// (useRuntimeState.js getRuntimeValue is a pure Map read; 'activeBuffs' is not a
// CAMPAIGN_KEYS member so the store's campaign-key console.error never fires).
// Rows seed via getStore('HexWarlock'); vi.mock scaffolding purged (it previously
// stubbed the real 2-arg read contract away). Buff arrays are Object.freeze'd:
// input purity fails loudly on mutation.
// Uncapped-Dex proof (#1348 discriminator): with Dex +5 the buff row gives 18 where a
// medium-armor lane would cap at +2 (Breastplate 14+2=16 in test 3 proves the two lanes
// are mutually distinguishable). Zero-dice lane: AC is math, no rolls. Golden unguarded
// deref pinned (test 7): missing Dexterity ability throws TypeError, console untouched.
import { describe, it, expect, beforeEach } from 'vitest';

import { getArmorClass } from './rules-armorClass.js';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import DISK_EQUIPMENT from '../../../public/data/equipment.json';

const CHAR = 'HexWarlock';

function stats({ dex = -1, rules = '5e', equipped = [] } = {}) {
    return {
        name: CHAR,
        rules,
        class: { name: 'Warlock' },
        abilities: [
            { name: 'Constitution', bonus: 0 },
            { name: 'Dexterity', bonus: dex },
            { name: 'Charisma', bonus: 5 },
        ],
        inventory: { equipped },
        automation: { passives: [] },
    };
}

function seed(buffs) {
    getStore(CHAR).set('activeBuffs', Object.freeze(buffs));
}

beforeEach(() => {
    getStore(CHAR).clear();
});

describe('rules.getArmorClass — SP-074 mage_armor runtime-buff lane (buff-active AC math + precedence owner)', () => {
    // RAW core: mage armor = 13 + Dex modifier, UNCAPPED, both signs of Dex.
    // +5/+4 rows are the no-cap proof (medium armor caps at +2); the 0 row is the
    // :0-swallow census — Dex 0 renders 'Dexterity Bonus (0)' and AC is 13+0=13.
    it.each([
        [5, 18],
        [4, 17],
        [0, 13],
        [-1, 12],
        [-3, 10],
        [-5, 8],
    ])('buff active, Dex %+i (5e): AC %i, exact contribution string', (dex, ac) => {
        seed([{ name: 'Mage Armor', effect: 'mage_armor', baseAc: 13, duration: '8 hours' }]);

        const [gotAc, formula] = getArmorClass(DISK_EQUIPMENT, stats({ dex }), {});

        expect(gotAc).toBe(ac);
        expect(formula).toBe(`Mage Armor (13) + Dexterity Bonus (${dex})`);
    });

    it('buff branch is ruleset-agnostic: 2024 dispatch computes the same 13 + Dex row', () => {
        seed([{ name: 'Mage Armor', effect: 'mage_armor', baseAc: 13 }]);

        const [ac, formula] = getArmorClass(DISK_EQUIPMENT, stats({ dex: 3, rules: '2024' }), {});

        expect(ac).toBe(16);
        expect(formula).toBe('Mage Armor (13) + Dexterity Bonus (3)');
    });

    // Desync insurance vs mageArmorService lane (donning-strip OWNER): if the buff
    // survives in the store while armor is worn, the buff branch returns BEFORE the
    // armorName branch — 13 + 5 beats disk Breastplate 14 + capped +2 = 16.
    it('stale-buff precedence: mage armor outranks worn Breastplate (disk 14, Dex cap 2)', () => {
        seed([{ name: 'Mage Armor', effect: 'mage_armor', baseAc: 13 }]);

        const [ac, formula] = getArmorClass(DISK_EQUIPMENT, stats({ dex: 5, equipped: ['Breastplate'] }), {});

        expect(ac).toBe(18);
        expect(formula).toBe('Mage Armor (13) + Dexterity Bonus (5)');
        expect(formula).not.toContain('Armor (14)');
    });

    it('shield stacks on the mage armor base: 13 + Dex -1 + Shield 2, exact contribution set', () => {
        seed([{ name: 'Mage Armor', effect: 'mage_armor', baseAc: 13 }]);

        const [ac, formula] = getArmorClass(DISK_EQUIPMENT, stats({ equipped: ['Shield'] }), {});

        expect(ac).toBe(14);
        expect(formula).toBe('Mage Armor (13) + Dexterity Bonus (-1) + Shield (2) + Shield Magic Bonus (0)');
    });

    // Buff-shape quirks (single producer mageArmorHandler.js stamps baseAc 13):
    // `mageArmor.baseAc || 13` swallows BOTH undefined and 0; the lane matches the
    // snake_case effect key, never the display name. No disk armor is named 'Mage
    // Armor' (equipment.json scan: zero name matches on 'mage'/'magic'), so there is
    // no catalog near-miss to confuse the effect key with.
    it('effect key is the gate, not the label: baseAc undefined/0 fall back to 13; hyphenated effect misses', () => {
        seed([{ effect: 'mage_armor' }]);
        expect(getArmorClass(DISK_EQUIPMENT, stats({}), {})).toEqual([12, 'Mage Armor (13) + Dexterity Bonus (-1)']);

        seed([{ name: 'mage armor', effect: 'mage_armor', baseAc: 0 }]);
        expect(getArmorClass(DISK_EQUIPMENT, stats({}), {})).toEqual([12, 'Mage Armor (13) + Dexterity Bonus (-1)']);

        seed([{ name: 'Mage Armor', effect: 'mage-armor' }]);
        expect(getArmorClass(DISK_EQUIPMENT, stats({}), {})).toEqual([9, 'Unarmored AC (10) + Dexterity Bonus (-1)']);
    });

    it('negative controls fall through to the legacy unarmored lane: empty store, unrelated buff, non-array sentinel', () => {
        const unarmored = [9, 'Unarmored AC (10) + Dexterity Bonus (-1)'];

        // key absent (beforeEach cleared the store)
        expect(getArmorClass(DISK_EQUIPMENT, stats({}), {})).toEqual(unarmored);

        seed([]);
        expect(getArmorClass(DISK_EQUIPMENT, stats({}), {})).toEqual(unarmored);

        seed([{ name: 'Bless', effect: 'bless' }]);
        expect(getArmorClass(DISK_EQUIPMENT, stats({}), {})).toEqual(unarmored);

        seed('not-an-array'); // Array.isArray guard returns null, no crash
        expect(getArmorClass(DISK_EQUIPMENT, stats({}), {})).toEqual(unarmored);
    });

    it('golden unguarded deref: buff active but no Dexterity ability throws TypeError, console untouched', () => {
        seed([{ effect: 'mage_armor', baseAc: 13 }]);
        const noDex = stats({});
        noDex.abilities = noDex.abilities.filter(a => a.name !== 'Dexterity');

        expect(() => getArmorClass(DISK_EQUIPMENT, noDex, {})).toThrow(TypeError);
    });
});
