// @maintained-by-ai
// invisibilityService lane contract — OWNER of the REMOVE side of the
// invisibility-adjacent family. blurService.test.js #1341 header cites verbatim:
// "invisibilityService.test.js owns the REMOVE side of the invisibility-adjacent
// family; blur has no removal export, so no overlap." Reciprocated: blur triggers
// only; removal bytes (buff/condition/campaign-key/log row) are pinned HERE.
// Entry-point split (#1335 PRODUCER-vs-forwarder): endInvisibilityOnHostileAction
// is a PURE FORWARDER (fixed hostile reason, verbatim from source) and stays the
// Invisibility family's lane entry; endGreaterInvisibilityOnHostileAction was a
// DEAD, anti-RAW forwarder — DELETED #1382 (Greater Invisibility never breaks on
// hostile action). The greater-family lane is now driven through its LIVE direct
// entry endGreaterInvisibility with the real rest-lane reason. Forwarders are
// pinned only via their reason in the golden path; internals are pinned once per
// family via describe.each — no tripled matrix. Base exports are called directly by useInitiativeEffects.js:229
// /:238 ('target rolled initiative') and restRules-shortRest.js:413/:420 +
// restRules-longRest.js:334/:341 ('target finished a rest') — direct-call lane
// pinned in the throw/compose test below.
// Cloak-vs-invisibility split verdict: cloakOfShadowsHandler.js is a SEPARATE
// module (automation/handlers/class-cleric-paladin) that ARMS the shared
// `_activeInvisibility_<name>` key (:89, value = playerStats.name) so hostile
// actions route through THIS module's endInvisibility; its manual deactivation
// inline-strips (cloakOfShadowsHandler.js:9/:29-33) instead of calling our
// export — inline-dup #1357 reported, not fixed here. naturesVeilHandler.js:41
// arms the same key. Cloak/naturesVeil arm condition-only (no 'Invisibility'
// buff), so the buff-absent skip test is the cloak-armed shape.
// Key separation is load-bearing for RAW: Greater Invisibility does NOT break on
// hostile action; consumers call endInvisibilityOnHostileAction liberally
// (handlePlainDamage/handleNpcSaveDamage/concentrationBonusAttackHandler:54 etc.)
// and the separate `_activeGreaterInvisibility_` key + exact buff-name filter make
// the greater-family bytes survive — pinned per family as foreignBuff/foreignKey
// survivor identity (#1327 class), survivor scoping triple own-remove /
// other-keep / other-target-keep (#1340/#1341).
// targetEffects lane: campaign te 'invisible' is armed by invisibilityShared.js:34
// with duration 'concentration' and is REMOVED by the concentration lane
// (concentrationService.js:58/:68/:100/:247) and useInitiativeEffects.js:111 —
// citable elsewhere; THIS module never touches te (strict fake throws on any
// campaign-key read outside the two invisibility latches, proving the lane split).
// NO-CLOCK audit: zero Date.now/setTimeout/rounds/expiry stamps in
// invisibilityService.js (grep clean) — seam clears owned by #1285/#1294 lanes
// (initiative-roll / rest clears, cited above). Disk durations are concentration
// ('Up to 1 hour' / 'Up to 1 minute', both rulesets) — combat-scoped, no clock HERE.
// Dead-export hunt #1370/#1382: endGreaterInvisibilityOnHostileAction had ZERO
// callers and is DELETED at source #1382 — the greater-family removal surface is
// endGreaterInvisibility alone.
// Latch pair #1358: arm byte = caster-name string (invisibilityShared:24,
// cloakOfShadows:89, naturesVeil:41); clear byte = null (this module :33/:76);
// reader guard = truthy `if (!casterName) return` — content of the caster value is
// unused, proven by arming with a foreign caster name in the golden path.
// Standards: argument-keyed strict store fake (#1372) THROWS unknown owner/key/
// campaign reads and is STATEFUL so sequential strips compose (#1307/#1319);
// every write asserted as an exact positional tuple via toEqual — 4 args, no
// skipSync 5th arg (write budgets are full-set, audited per call-site #1341);
// identical-Error + exact-prefix console.error pins (#1360 unguarded-deref class);
// no bare toHaveBeenCalled()/length>0 on mutations; vi.resetAllMocks + explicit
// re-seed each test (#1312); console spy restored in afterEach.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => {
    const CAMPAIGNS = new Set(['test-campaign', 'other-campaign']);
    const TARGETS = new Set(['GnomeWizard', 'Alchemist', 'ElfRanger']);
    const CAMPAIGN_KEY_PREFIXES = ['_activeInvisibility_', '_activeGreaterInvisibility_'];
    const TARGET_KEYS = new Set(['activeBuffs', 'activeConditions']);
// pass-through store (no cloning): the fake mirrors the runtime store's reference
// semantics so captured setRuntimeValue tuples keep identity and deep-equal the
// seed snapshots, exactly like the real objects flowing through the service
    const data = new Map();
    const path = (campaign, owner, key) => `${campaign}::${owner}::${key}`;
    const validate = (owner, key, campaign, verb) => {
        if (!CAMPAIGNS.has(campaign)) {
            throw new Error(`[fake-store] ${verb} on unknown campaign: ${campaign}`);
        }
        if (owner === 'campaign') {
            if (!CAMPAIGN_KEY_PREFIXES.some(p => typeof key === 'string' && key.startsWith(p))) {
                throw new Error(`[fake-store] ${verb} on unknown campaign key: ${key}`);
            }
        } else if (!TARGETS.has(owner) || !TARGET_KEYS.has(key)) {
            throw new Error(`[fake-store] ${verb} on unknown target/key: ${owner}.${key}`);
        }
    };
    return {
        CAMPAIGNS,
        TARGETS,
        reset: () => data.clear(),
        arm: (campaign, owner, key, value) => data.set(path(campaign, owner, key), value),
        peek: (campaign, owner, key) => data.get(path(campaign, owner, key)),
        get: (owner, key, campaign) => {
            validate(owner, key, campaign, 'read');
            return data.get(path(campaign, owner, key));
        },
        set: (owner, key, value, campaign) => {
            validate(owner, key, campaign, 'write');
            data.set(path(campaign, owner, key), value);
        },
        // mirrors buffToggle.getActiveBuffs exactly: runtime read + Array.isArray guard
        getBuffs: (owner, campaign) => {
            const buffs = data.get(path(campaign, owner, 'activeBuffs'));
            return Array.isArray(buffs) ? buffs : [];
        },
    };
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((owner, key, campaign) => state.get(owner, key, campaign)),
    setRuntimeValue: vi.fn((owner, key, value, campaign) => state.set(owner, key, value, campaign)),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn((owner, campaign) => state.getBuffs(owner, campaign)),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';
import { addEntry } from '../../ui/logService.js';
import {
    endInvisibility,
    endInvisibilityOnHostileAction,
    endGreaterInvisibility,
} from './invisibilityService.js';

const CAMPAIGN = 'test-campaign';
const TARGET = 'GnomeWizard';
const HOSTILE_REASON = 'target made a hostile action (attack roll, dealt damage, or cast a spell)';
// Real direct-call reason of the LIVE greater lane (restRules-shortRest.js:420,
// restRules-longRest.js; initiative twin useInitiativeEffects.js).
const REST_REASON = 'target finished a rest';

// Real disk/code names (#1352 near-misses): Invisibility lv2 / Greater
// Invisibility lv4, both concentration; buff names are the exact filter tokens
// from invisibilityShared.js (INVISIBILITY_BUFF_NAME / GREATER_INVISIBILITY_BUFF_NAME).
const FAMILIES = [
    {
        label: 'Invisibility',
        invoke: (target, campaign) => endInvisibilityOnHostileAction(target, campaign),
        reason: HOSTILE_REASON,
        remove: endInvisibility,
        buff: { name: 'Invisibility', effect: 'invisible', duration: 'Concentration, up to 1 hour' },
        buffName: 'Invisibility',
        foreignBuff: { name: 'GreaterInvisibility', effect: 'invisible', duration: 'Concentration, up to 1 minute' },
        foreignBuffName: 'GreaterInvisibility',
        latchKey: name => `_activeInvisibility_${name}`,
        foreignLatchKey: name => `_activeGreaterInvisibility_${name}`,
        abilityName: 'Invisibility',
    },
    {
        label: 'GreaterInvisibility',
        // #1382: hostile-action forwarder deleted (anti-RAW); lane drives the
        // LIVE direct entry with its real rest-lane reason.
        invoke: (target, campaign) => endGreaterInvisibility(target, campaign, REST_REASON),
        reason: REST_REASON,
        remove: endGreaterInvisibility,
        buff: { name: 'GreaterInvisibility', effect: 'invisible', duration: 'Concentration, up to 1 minute' },
        buffName: 'GreaterInvisibility',
        foreignBuff: { name: 'Invisibility', effect: 'invisible', duration: 'Concentration, up to 1 hour' },
        foreignBuffName: 'Invisibility',
        latchKey: name => `_activeGreaterInvisibility_${name}`,
        foreignLatchKey: name => `_activeInvisibility_${name}`,
        abilityName: 'Greater Invisibility',
    },
];

const SURVIVING_BUFF = { name: 'Bless', effect: 'bless' };

let consoleSpy;

beforeEach(() => {
    vi.resetAllMocks();
    state.reset();
    // explicit re-seed after resetAllMocks (#1312) — fake impls restored
    getRuntimeValue.mockImplementation((owner, key, campaign) => state.get(owner, key, campaign));
    setRuntimeValue.mockImplementation((owner, key, value, campaign) => state.set(owner, key, value, campaign));
    getActiveBuffs.mockImplementation((owner, campaign) => state.getBuffs(owner, campaign));
    addEntry.mockImplementation(() => Promise.resolve());
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe.each(FAMILIES)('$label removal ($buffName)', ({
    invoke,
    reason,
    remove,
    buff,
    buffName,
    foreignBuff,
    latchKey,
    foreignLatchKey,
    abilityName,
}) => {
    const seedFull = () => {
        state.arm(CAMPAIGN, 'campaign', latchKey(TARGET), 'Alchemist'); // truthy latch, content unused (#1358)
        state.arm(CAMPAIGN, 'campaign', foreignLatchKey(TARGET), 'Alchemist');
        state.arm(CAMPAIGN, TARGET, 'activeBuffs', [buff, foreignBuff, SURVIVING_BUFF]);
        state.arm(CAMPAIGN, TARGET, 'activeConditions', ['invisible', 'blinded']);
    };

    it.each([null, undefined, ''])('latch read of %s short-circuits: no buff read, no writes, no log', (latchValue) => {
        state.arm(CAMPAIGN, 'campaign', latchKey(TARGET), latchValue);
        state.arm(CAMPAIGN, TARGET, 'activeBuffs', [buff, SURVIVING_BUFF]);
        state.arm(CAMPAIGN, TARGET, 'activeConditions', ['invisible', 'blinded']);
        const before = JSON.parse(JSON.stringify(state.peek(CAMPAIGN, TARGET, 'activeBuffs')));

        expect(invoke(TARGET, CAMPAIGN)).toBeUndefined();

        expect(getActiveBuffs).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(state.peek(CAMPAIGN, TARGET, 'activeBuffs')).toEqual(before);
        expect(state.peek(CAMPAIGN, TARGET, 'activeConditions')).toEqual(['invisible', 'blinded']);
    });

    it('lane entry strips buff + condition + latch in one exact write budget; foreign family and foreign target survive byte-identical', () => {
        seedFull();
        state.arm(CAMPAIGN, 'ElfRanger', 'activeBuffs', [buff, foreignBuff]);
        state.arm(CAMPAIGN, 'ElfRanger', 'activeConditions', ['invisible']);
        state.arm(CAMPAIGN, 'campaign', latchKey('ElfRanger'), 'Alchemist');

        invoke(TARGET, CAMPAIGN);

        // exact read sequence through the service (peek bypasses the spies)
        expect(getRuntimeValue.mock.calls).toEqual([
            ['campaign', latchKey(TARGET), CAMPAIGN],
            [TARGET, 'activeConditions', CAMPAIGN],
        ]);
        // full-set write budget: exactly 3 tuples, order pinned, each 4-arg positional
        // (no skipSync 5th arg — asserted by toEqual length), foreign keys untouched
        expect(setRuntimeValue.mock.calls).toEqual([
            [TARGET, 'activeBuffs', [foreignBuff, SURVIVING_BUFF], CAMPAIGN],
            [TARGET, 'activeConditions', ['blinded'], CAMPAIGN],
            ['campaign', latchKey(TARGET), null, CAMPAIGN],
        ]);
        expect(state.peek(CAMPAIGN, TARGET, 'activeBuffs')).toEqual([foreignBuff, SURVIVING_BUFF]);
        expect(state.peek(CAMPAIGN, TARGET, 'activeConditions')).toEqual(['blinded']);
        expect(state.peek(CAMPAIGN, 'campaign', latchKey(TARGET))).toBeNull();
        // other-target-keep: ElfRanger bytes byte-identical survivors (#1340 triple)
        expect(state.peek(CAMPAIGN, 'ElfRanger', 'activeBuffs')).toEqual([buff, foreignBuff]);
        expect(state.peek(CAMPAIGN, 'ElfRanger', 'activeConditions')).toEqual(['invisible']);
        expect(state.peek(CAMPAIGN, 'campaign', latchKey('ElfRanger'))).toBe('Alchemist');
        // foreign-family latch survives (RAW: greater never breaks on invis remove)
        expect(state.peek(CAMPAIGN, 'campaign', foreignLatchKey(TARGET))).toBe('Alchemist');
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: TARGET,
            abilityName,
            description: `${abilityName} ends for ${TARGET}: ${reason}.`,
        });
    });

    it('buff-absent (cloak/naturesVeil armed shape): no activeBuffs write, condition + latch still stripped', () => {
        state.arm(CAMPAIGN, 'campaign', latchKey(TARGET), TARGET);
        state.arm(CAMPAIGN, TARGET, 'activeBuffs', [SURVIVING_BUFF]);
        state.arm(CAMPAIGN, TARGET, 'activeConditions', ['invisible', 'blinded']);

        invoke(TARGET, CAMPAIGN);

        expect(setRuntimeValue.mock.calls).toEqual([
            [TARGET, 'activeConditions', ['blinded'], CAMPAIGN],
            ['campaign', latchKey(TARGET), null, CAMPAIGN],
        ]);
        expect(state.peek(CAMPAIGN, TARGET, 'activeBuffs')).toEqual([SURVIVING_BUFF]);
    });

    it('condition-absent: no activeConditions write; buff + latch stripped', () => {
        state.arm(CAMPAIGN, 'campaign', latchKey(TARGET), TARGET);
        state.arm(CAMPAIGN, TARGET, 'activeBuffs', [buff, SURVIVING_BUFF]);
        state.arm(CAMPAIGN, TARGET, 'activeConditions', ['blinded']);

        invoke(TARGET, CAMPAIGN);

        expect(setRuntimeValue.mock.calls).toEqual([
            [TARGET, 'activeBuffs', [SURVIVING_BUFF], CAMPAIGN],
            ['campaign', latchKey(TARGET), null, CAMPAIGN],
        ]);
    });

    it('conditions strip case-insensitively while buffs match exactly (lowercase buff near-miss survives)', () => {
        state.arm(CAMPAIGN, 'campaign', latchKey(TARGET), TARGET);
        state.arm(CAMPAIGN, TARGET, 'activeBuffs', [
            buff,
            { name: buffName.toLowerCase(), effect: 'invisible' }, // exact-match filter must keep it
        ]);
        state.arm(CAMPAIGN, TARGET, 'activeConditions', ['INVISIBLE', 'Invisible', 'blinded']);

        invoke(TARGET, CAMPAIGN);

        expect(setRuntimeValue.mock.calls).toEqual([
            [TARGET, 'activeBuffs', [{ name: buffName.toLowerCase(), effect: 'invisible' }], CAMPAIGN],
            [TARGET, 'activeConditions', ['blinded'], CAMPAIGN],
            ['campaign', latchKey(TARGET), null, CAMPAIGN],
        ]);
    });

    it.each([null, undefined])(
        'missing activeConditions (%s): logged TypeError aborts before latch clear; restRules-lane retry composes',
        (badValue) => {
            state.arm(CAMPAIGN, 'campaign', latchKey(TARGET), TARGET);
            state.arm(CAMPAIGN, TARGET, 'activeBuffs', [buff, SURVIVING_BUFF]);
            if (badValue === null) state.arm(CAMPAIGN, TARGET, 'activeConditions', null);
            // undefined case: key simply unset in the strict stateful store

            expect(() => invoke(TARGET, CAMPAIGN)).toThrow(new Error(`Expected array, got ${badValue}`));
            expect(consoleSpy).toHaveBeenCalledWith('[invisibilityService] Missing array:', badValue);
            // partial-write byte pin (#1360 class): buff strip already landed, latch STILL armed
            expect(setRuntimeValue.mock.calls).toEqual([
                [TARGET, 'activeBuffs', [SURVIVING_BUFF], CAMPAIGN],
            ]);
            expect(state.peek(CAMPAIGN, 'campaign', latchKey(TARGET))).toBe(TARGET);
            expect(addEntry).not.toHaveBeenCalled();

            // sequential strip composes (#1307/#1319): repair the store, retry via the
            // direct-call lane restRules-shortRest.js:413 / longRest.js:334 use
            state.arm(CAMPAIGN, TARGET, 'activeConditions', ['invisible', 'blinded']);
            remove(TARGET, CAMPAIGN, 'target finished a rest');

            expect(setRuntimeValue.mock.calls).toEqual([
                [TARGET, 'activeBuffs', [SURVIVING_BUFF], CAMPAIGN],
                [TARGET, 'activeConditions', ['blinded'], CAMPAIGN],
                ['campaign', latchKey(TARGET), null, CAMPAIGN],
            ]);
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
                type: 'ability_use',
                characterName: TARGET,
                abilityName,
                description: `${abilityName} ends for ${TARGET}: target finished a rest.`,
            });

            // latch truthy reader: second call is inert (null is falsy, zero new writes)
            const budgetAfter = setRuntimeValue.mock.calls.length;
            invoke(TARGET, CAMPAIGN);
            expect(setRuntimeValue.mock.calls).toHaveLength(budgetAfter);
            expect(getActiveBuffs).toHaveBeenCalledTimes(2); // failed attempt + composed retry only
        },
    );

    it('addEntry rejection is swallowed with exact console.error identity; removal bytes still committed', async () => {
        state.arm(CAMPAIGN, 'campaign', latchKey(TARGET), TARGET);
        state.arm(CAMPAIGN, TARGET, 'activeBuffs', [buff]);
        state.arm(CAMPAIGN, TARGET, 'activeConditions', ['invisible']);
        const logError = new Error('log write failed');
        addEntry.mockRejectedValueOnce(logError);

        expect(invoke(TARGET, CAMPAIGN)).toBeUndefined();
        await Promise.resolve(); // flush the service's .catch microtask

        expect(consoleSpy).toHaveBeenCalledWith('[invisibilityService:log-error]', logError);
        expect(state.peek(CAMPAIGN, 'campaign', latchKey(TARGET))).toBeNull();
        expect(state.peek(CAMPAIGN, TARGET, 'activeConditions')).toEqual([]);
    });
});

describe('campaign isolation', () => {
    it('wrong-campaign call reads its own empty latch and never writes or mutates the armed campaign', () => {
        state.arm(CAMPAIGN, 'campaign', `_activeInvisibility_${TARGET}`, 'Alchemist');
        state.arm(CAMPAIGN, TARGET, 'activeBuffs', [{ name: 'Invisibility', effect: 'invisible' }]);
        state.arm(CAMPAIGN, TARGET, 'activeConditions', ['invisible']);

        expect(endInvisibilityOnHostileAction(TARGET, 'other-campaign')).toBeUndefined();

        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', `_activeInvisibility_${TARGET}`, 'other-campaign');
        expect(getActiveBuffs).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(state.peek(CAMPAIGN, TARGET, 'activeBuffs')).toEqual([{ name: 'Invisibility', effect: 'invisible' }]);
        expect(state.peek(CAMPAIGN, 'campaign', `_activeInvisibility_${TARGET}`)).toBe('Alchemist');
    });
});
