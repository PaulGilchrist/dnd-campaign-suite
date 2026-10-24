// @maintained-by-ai
// blurService lane contract — triggerBlur is an ENVELOPE PRODUCER, not a
// miss-chance calculator: the disadvantage mechanic is consumed elsewhere
// (contextBuilder-sync.js:492 te.effect === 'blur lookup, ConditionEffectBadges.jsx
// badges, restRules-short/longRest clears, useInitiativeEffects.js:35 expiry).
// This file pins the two storage writes, the log row, and the popup the
// service owns — disk-derived fixtures (#1339) against the Blur disk rows
// (no save, concentration: true, 2024 duration literal "Concentration, up to
// 1 minute"). invisibilityService.test.js owns the REMOVE side of the
// invisibility-adjacent family; blur has no removal export, so no overlap.
// spellCastService.noformula-* specs mock triggerBlur away (dispatch only).
// Signatures pinned exactly: both setRuntimeValue writes are 4-arg positional
// (NO skipSync 5th arg — user-initiated cast, not an SSE echo); the campaign
// targetEffects READ omits campaignName (#1340 exact-envelope discipline).
// Metamagic audit (#1340 class): blur has NO useSimpleSpellHandlers confirm
// spec; triggerSpells.js handleBlur (:233-239) forwards the full spell +
// metaCtx. fix#353 (#1341) FIXED both facets at the service: the log row now
// reads the ACTUAL cast level via the canonical bane sibling idiom
// (baneService.js:10 `metaCtx?.slotLevel || spell.level || 1`; blur uses its
// disk base level 2 as the tail) — upcast lv3 casts log lv3, pinned in the
// level ladder below; and disk range 'Self' (BOTH rulesets' Blur rows) is now
// ENFORCED — metaCtx.targetName is clamped to the caster, so the retired
// "honors metaCtx.targetName" lane is flipped to the self-clamp pin.
// te-row slotLevel stamping was NOT ordered by the fix (log-truth scope) and
// stays with the SP-11 family.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';
import { getEffectDefinition } from '../../combat/conditions/targetEffectDefinitions.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { triggerBlur } from './blurService.js';

const CAMPAIGN = 'TestCampaign';
const MAP = 'testMap';
const CASTER = { name: 'Wizard' };

// Disk-derived fixtures — never hand-transcribed (#1339).
const DISK_BLUR = spells5e.find(s => s.name === 'Blur');
const DISK_BLUR_2024 = spells2024.find(s => s.name === 'Blur');
const BLUR_TE = getEffectDefinition('blur');
// Registry-read key: the stamped effect key must come from the registry.
const BLUR_KEY = BLUR_TE.effect;
// The buff duration literal mirrors the 2024 disk row verbatim.
const BUFF_DURATION = DISK_BLUR_2024.duration;

const buffRow = (target, source = CASTER.name) => ({
    name: 'Blur',
    effect: 'blur',
    duration: BUFF_DURATION,
    source,
});
const teRow = (target, source = CASTER.name) => ({
    target,
    source,
    effect: BLUR_KEY,
    duration: 'concentration',
});

const POPUP = (target) => ({
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Blur',
        automationType: 'blur',
        description: `<b>Blur</b><br/>${target} has <b>Disadvantage on attack rolls against them</b> for 1 minute (concentration). Creatures with Blindsight or Truesight are immune to this effect.`,
    },
});

function emptyStores() {
    getRuntimeValue.mockReturnValue([]);
}

async function cast(metaCtx = {}, stats = CASTER, spell = { name: DISK_BLUR.name }) {
    return triggerBlur(spell, metaCtx, stats, CAMPAIGN, MAP);
}

describe('triggerBlur — gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Real-disk near-misses (invisibility-adjacent self-buffs) + substring
    // and nameless spells: nothing is read, written, or logged.
    it.each([
        ['Fire Bolt', { name: 'Fire Bolt' }],
        ['Mirror Image', { name: spells5e.find(s => s.name === 'Mirror Image').name }],
        ['Sanctuary', { name: spells5e.find(s => s.name === 'Sanctuary').name }],
        ['Blur Edge (substring, not equal)', { name: 'Blur Edge' }],
        ['empty name', { name: '' }],
        ['nameless spell', {}],
    ])('returns null with zero side effects for "%s"', async (_label, spell) => {
        const result = await cast({}, CASTER, spell);

        expect(result).toBeNull();
        expect(getRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each(['blur', 'BLUR', 'BlUr'])('matches "%s" case-insensitively and stamps canonical rows', async (name) => {
        emptyStores();

        const result = await cast({}, CASTER, { name });

        expect(result).toEqual(POPUP(CASTER.name));
        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, CASTER.name, 'activeBuffs', [buffRow(CASTER.name)], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects', [teRow(CASTER.name)], CAMPAIGN);
    });
});

describe('triggerBlur — self cast pins the full write/log/popup envelopes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads both stores, writes buff + targetEffect positionally, logs, returns popup', async () => {
        emptyStores();

        const result = await cast();

        // READ signatures: buff read is target-scoped with campaign; the
        // campaign targetEffects read omits campaignName (exact arity pin).
        expect(getRuntimeValue).toHaveBeenNthCalledWith(1, CASTER.name, 'activeBuffs', CAMPAIGN);
        expect(getRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects');

        // WRITE signatures: 4-arg positional, no skipSync 5th arg.
        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, CASTER.name, 'activeBuffs', [buffRow(CASTER.name)], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects', [teRow(CASTER.name)], CAMPAIGN);

        // Disk justifies the literals: level 2, concentration, 2024 duration.
        expect(DISK_BLUR.level).toBe(2);
        expect(DISK_BLUR.concentration).toBe(true);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'spell',
            characterName: CASTER.name,
            targetName: CASTER.name,
            spellName: 'Blur',
            spellLevel: DISK_BLUR.level,
            description: 'Wizard casts Blur on themself. Creatures without Blindsight or Truesight have Disadvantage on attack rolls against them for 1 minute.',
            timestamp: expect.any(Number),
        });

        expect(result).toEqual(POPUP(CASTER.name));
    });

    // fix#353 PIN FLIP (#1348 pin family): the OLD pin "casts on another
    // target: both writes and log resolve metaCtx.targetName" pinned the
    // reported defect (non-caster landing despite disk range 'Self'). RETIRED
    // and flipped to the self-clamp law below.
    it('fix#353 self-clamp: metaCtx.targetName is IGNORED — writes, log and popup all resolve the caster (disk range Self)', async () => {
        emptyStores();

        const result = await cast({ targetName: 'Fighter' });

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, CASTER.name, 'activeBuffs', [buffRow(CASTER.name)], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects', [teRow(CASTER.name)], CAMPAIGN);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'spell',
            characterName: CASTER.name,
            targetName: CASTER.name,
            spellName: 'Blur',
            spellLevel: DISK_BLUR.level,
            description: 'Wizard casts Blur on themself. Creatures without Blindsight or Truesight have Disadvantage on attack rolls against them for 1 minute.',
            timestamp: expect.any(Number),
        });

        expect(result).toEqual(POPUP(CASTER.name));
    });

    it.each([
        ['null metaCtx', null],
        ['undefined metaCtx', undefined],
    ])('defaults target to playerStats.name when %s', async (_label, metaCtx) => {
        emptyStores();

        await cast(metaCtx);

        expect(getRuntimeValue).toHaveBeenNthCalledWith(1, CASTER.name, 'activeBuffs', CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, CASTER.name, 'activeBuffs', [buffRow(CASTER.name)], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects', [teRow(CASTER.name)], CAMPAIGN);
    });
});

describe('triggerBlur — fix#353 upcast level ladder (log reads the ACTUAL cast level)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Canonical idiom BY-cite baneService.js:10: `metaCtx?.slotLevel ||
    // spell.level || 1`; blur's tail is its disk base level (2, both rulesets).
    const loggedLevel = async (metaCtx, spell) => {
        emptyStores();
        await cast(metaCtx, CASTER, spell);
        const entry = addEntry.mock.calls[addEntry.mock.calls.length - 1][1];
        return entry.spellLevel;
    };

    it('upcast lv3: metaCtx.slotLevel:3 logs spellLevel:3 (the retired hardcoded 2 is structurally impossible)', async () => {
        expect(await loggedLevel({ slotLevel: 3 }, { name: DISK_BLUR.name })).toBe(3);
    });

    it('precedence: metaCtx.slotLevel wins over an envelope spell.level', async () => {
        expect(await loggedLevel({ slotLevel: 4 }, { name: DISK_BLUR.name, level: 6 })).toBe(4);
    });

    it('spell.level envelope passes through when metaCtx carries no slotLevel', async () => {
        expect(await loggedLevel({}, { name: DISK_BLUR.name, level: 5 })).toBe(5);
        expect(await loggedLevel(null, { name: DISK_BLUR.name, level: 5 })).toBe(5);
    });

    it('base fallback: level-less lightweight envelope still logs the disk base level', async () => {
        expect(DISK_BLUR.level).toBe(2);
        expect(await loggedLevel({}, { name: DISK_BLUR.name })).toBe(2);
    });
});

describe('triggerBlur — replace semantics (one Blur row per spell)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('drops every prior Blur buff (any caster) and own-targetEffect rows (any target), preserving all other rows by identity; fix#353: the new row lands on the CASTER even when the pipeline carries metaCtx.targetName', async () => {
        const mageArmor = { name: 'Mage Armor', effect: 'mage_armor', duration: '8 hours', source: CASTER.name };
        const otherCasterBlur = { name: 'Blur', effect: 'blur', duration: BUFF_DURATION, source: 'Sorcerer' };
        getRuntimeValue.mockImplementationOnce(() => [otherCasterBlur, mageArmor]);

        const otherBlur = teRow('OtherTarget', 'Sorcerer');
        const unrelated = { target: 'Fighter', source: 'Druid', effect: 'some_other_effect', duration: '1_hour' };
        // Own stale row on a DIFFERENT target: re-casting moves the caster's Blur —
        // onto the caster (self-clamp), never onto the pipeline targetName.
        getRuntimeValue.mockImplementationOnce(() => [teRow('OldTarget'), otherBlur, unrelated]);

        await cast({ targetName: 'Fighter' });

        const buffs = setRuntimeValue.mock.calls[0][2];
        expect(buffs).toHaveLength(2);
        expect(buffs[0]).toBe(mageArmor); // unrelated buff preserved by identity
        expect(buffs[1]).toEqual(buffRow(CASTER.name)); // other caster's Blur dropped by name

        const tes = setRuntimeValue.mock.calls[1][2];
        expect(tes).toHaveLength(3);
        expect(tes[0]).toBe(otherBlur); // other caster's blur preserved by identity
        expect(tes[1]).toBe(unrelated); // unrelated effect preserved by identity
        expect(tes[2]).toEqual(teRow(CASTER.name)); // own stale OldTarget row replaced, self-clamped
    });
});

describe('triggerBlur — non-array storage is treated as empty', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // SP-019 (clean change-data nulls) included as the null row.
    it.each([
        ['null', null],
        ['undefined', undefined],
        ['string', 'oops'],
        ['object', { not: 'an-array' }],
    ])('writes exactly one buff and one targetEffect when both stores hold %s', async (_label, stored) => {
        getRuntimeValue.mockReturnValue(stored);

        const result = await cast();

        expect(result).toEqual(POPUP(CASTER.name));
        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, CASTER.name, 'activeBuffs', [buffRow(CASTER.name)], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects', [teRow(CASTER.name)], CAMPAIGN);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ spellName: 'Blur' }));
    });
});

describe('triggerBlur — log failure is swallowed, not propagated', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('still writes state and returns popup when addEntry rejects, logging the exact console.error', async () => {
        emptyStores();
        const err = new Error('log down');
        addEntry.mockRejectedValueOnce(err);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await cast();

        expect(result).toEqual(POPUP(CASTER.name));
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenCalledWith('[blur] Error logging:', err);
        spy.mockRestore();
    });
});
