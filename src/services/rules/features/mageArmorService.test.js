// @maintained-by-ai
// SP-074 donning-strip SERVICE lane (mageArmorService.endMageArmorOnDonning — the ONLY
// export, live at useCharacterWizard.js:76; hook wiring is pinned by
// useCharacterWizard.donning.test.js, which cites this file as strip-logic owner).
// AC-boundary: this service computes NO AC and NO duration — it only strips buffs.
// AC math lives in rules-armorClass.mageArmor.test.js ('// mage_armor runtime-buff
// lane', per rules-armorClass.test.js header) and the armorClass twins; expiry clock
// (§38 hours×600) is owned by mageArmorHandler.test.js. Disk rows read: Mage Armor is
// '8 hours', non-concentration in BOTH rulesets (spells.json + 2024/spells.json) —
// >=1-minute durations are combat-scoped by repo policy and this service stores NO
// clock; its only wall-time touch is the permitted addEntry log timestamp (fake-timer
// pinned below). Catalog rows are disk-read from public/data/equipment.json, never
// transcribed (Shield=Shield excl., Leather=Light, Acid (vial)=no armor_category,
// Longsword=Weapon). The real setRuntimeValue signature is 4-arg
// (characterKey, propertyName, value, campaignName) — no skipSync parameter in this
// lane; write budget audited at every call. automationType 'mage_armor_ends' is
// produced solely here (grep: spellGates emits only 'mage_armor_refused').
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import DISK_EQUIPMENT from '../../../../public/data/equipment.json';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/dataLoader.js', () => ({
    loadEquipment: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

import { endMageArmorOnDonning } from './mageArmorService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { loadEquipment } from '../../ui/dataLoader.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CHARACTER = 'HexWarlock';
const FIXED_MS = 1761033600000;

const BLESS = { name: 'Bless', effect: 'bless' };
const MAGE_ARMOR = { name: 'Mage Armor', effect: 'mage_armor', baseAc: 13, duration: '8 hours' };
const MAGE_ARMOR_2 = { name: 'Mage Armor', effect: 'mage_armor', baseAc: 13, duration: '8 hours', sourceCharacter: 'DivinationWizard' };

function char(equipped) {
    return { name: CHARACTER, inventory: { equipped } };
}

// Argument-keyed stateful store fake (#1372/#1382): any read other than
// (HexWarlock, 'activeBuffs', test-campaign) throws — an unkeyed mock would
// pass even if the service read the wrong key, character, or campaign.
function seedBuffs(buffs) {
    getRuntimeValue.mockImplementation((name, key, campaign) => {
        if (name === CHARACTER && key === 'activeBuffs' && campaign === CAMPAIGN) return buffs;
        throw new Error(`unexpected store read: ${name}.${key}@${campaign}`);
    });
}

describe('endMageArmorOnDonning — SP-074 donning strip service internals', () => {
    beforeEach(() => {
        vi.resetAllMocks(); // vitest-4 retains impls through clearAllMocks — re-seed explicitly
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_MS);
        loadEquipment.mockResolvedValue(DISK_EQUIPMENT);
        addEntry.mockResolvedValue(undefined);
        setRuntimeValue.mockImplementation((name, key, value, campaign) => {
            if (!(name === CHARACTER && key === 'activeBuffs' && campaign === CAMPAIGN)) {
                throw new Error(`unexpected store write: ${name}.${key}@${campaign}`);
            }
        });
        getRuntimeValue.mockImplementation((name, key, campaign) => {
            throw new Error(`unexpected store read: ${name}.${key}@${campaign}`);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('fresh armor don strips EVERY mage_armor buff in ONE new-array write and logs the exact envelope', async () => {
        const stored = [MAGE_ARMOR, BLESS, MAGE_ARMOR_2];
        seedBuffs(stored);

        const ended = await endMageArmorOnDonning(char([]), char(['Leather']), CAMPAIGN);

        expect(ended).toBe(true);
        // full-set write budget: exactly one store write, exactly one log
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledTimes(1);
        // exact 4-tuple (real setRuntimeValue has no skipSync param in this lane)
        expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'activeBuffs', [BLESS], CAMPAIGN);
        // §39 spread new array: fresh container, survivors carried by identity
        const written = setRuntimeValue.mock.calls[0][2];
        expect(written).not.toBe(stored);
        expect(written[0]).toBe(BLESS);
        // byte-exact log envelope, timestamp pinned to the fake clock
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'automation',
            automationType: 'mage_armor_ends',
            characterName: CHARACTER,
            abilityName: 'Mage Armor',
            description: `${CHARACTER} dons Leather — Mage Armor ends early (armor donned).`,
            timestamp: FIXED_MS,
        });
    });

    it('shield and non-armor adds never end the buff and never reach the buff store', async () => {
        // disk near-misses: Shield excluded by armor_category !== 'Shield';
        // Longsword matches the catalog but ships no armor_category;
        // 'Acid (vial)' paren-strips to 'Acid' which matches no catalog row.
        const ended = await endMageArmorOnDonning(char([]), char(['Shield', 'Longsword', 'Acid (vial)']), CAMPAIGN);

        expect(ended).toBe(false);
        expect(loadEquipment).toHaveBeenCalledTimes(1);
        expect(getRuntimeValue).not.toHaveBeenCalled(); // short-circuit BEFORE buff read
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('nothing newly equipped (identical, case-variant, unequipping all) never ends and never restocks', async () => {
        // byte: added diff is toLowerCase()-keyed, so 'Leather'→'leather' is not a don;
        // unequipping-all is RAW never-restores, and every path short-circuits before
        // the catalog fetch and store read.
        for (const [before, after] of [
            [['Leather'], ['Leather']],
            [['Leather'], ['leather']],
            [['Leather'], []],
        ]) {
            const ended = await endMageArmorOnDonning(char(before), char(after), CAMPAIGN);
            expect(ended).toBe(false);
        }
        expect(loadEquipment).not.toHaveBeenCalled();
        expect(getRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('armor don with no mage_armor in store reads the store but writes and logs nothing', async () => {
        seedBuffs([BLESS]);

        const ended = await endMageArmorOnDonning(char([]), char(['Scale Mail']), CAMPAIGN);

        expect(ended).toBe(false);
        expect(getRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'activeBuffs', CAMPAIGN);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('CLA-225: magic-suffix parenthesized name resolves through the catalog and only armor appears in the log', async () => {
        seedBuffs([MAGE_ARMOR]);

        const ended = await endMageArmorOnDonning(char([]), char(['+1 Leather (Rare)', 'Longsword']), CAMPAIGN);

        expect(ended).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'activeBuffs', [], CAMPAIGN);
        // log lists the RAW donned name, not the catalog base name, and never the weapon
        const logged = addEntry.mock.calls[0][1];
        expect(logged.description).toBe(`${CHARACTER} dons +1 Leather (Rare) — Mage Armor ends early (armor donned).`);
        expect(logged.automationType).toBe('mage_armor_ends');
    });

    it('falsy guard triple (missing characterData, empty name, missing campaign) returns false with zero touch', async () => {
        const cases = [
            [char([]), undefined, CAMPAIGN],
            [char([]), { inventory: { equipped: ['Leather'] } }, CAMPAIGN],
            [char([]), char(['Leather']), undefined],
        ];
        for (const args of cases) {
            await expect(endMageArmorOnDonning(...args)).resolves.toBe(false);
        }
        expect(loadEquipment).not.toHaveBeenCalled();
        expect(getRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('golden TypeErrors: null buff in store and non-Promise addEntry both escape unguarded', async () => {
        // #1360 class — both derefs sit OUTSIDE any try; pins document the real contract:
        // store entries must be objects and logService.addEntry must return a Promise.
        seedBuffs([null]);
        await expect(endMageArmorOnDonning(char([]), char(['Leather']), CAMPAIGN))
            .rejects.toThrow("Cannot read properties of null (reading 'effect')");

        vi.resetAllMocks();
        loadEquipment.mockResolvedValue(DISK_EQUIPMENT);
        addEntry.mockReturnValue(undefined); // sync void — the .catch deref must throw
        seedBuffs([MAGE_ARMOR]);
        await expect(endMageArmorOnDonning(char([]), char(['Leather']), CAMPAIGN))
            .rejects.toThrow("Cannot read properties of undefined (reading 'catch')");
        // strip write happens BEFORE the log call, so the strip survives the broken logger
        expect(setRuntimeValue).toHaveBeenCalledWith(CHARACTER, 'activeBuffs', [], CAMPAIGN);
    });
});
