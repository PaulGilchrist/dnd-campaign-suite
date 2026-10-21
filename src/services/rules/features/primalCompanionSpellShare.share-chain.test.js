// @maintained-by-ai
// CLA-311 Share Spells share-chain lane: owns ONLY the service->handler seam bytes — the disk-fronted
// 2024 Ranger/Beast Master Share Spells passive -> service-built action -> real handler propagating the
// caster's self-spell targetEffect onto the companion (exact write order, full envelopes, disk-driven range).
// Trigger gates (self/cantrip/AoE/companion-exists/throw paths) are owned by primalCompanionSpellShareService.test.js;
// handler branches (guard popups, seeded dedupe, applySpellShare modal-confirm) are owned by
// primalCompanionSpellShareHandler.test.js. No dice rolled here; no clocks stored (duration mirrors the
// caster te verbatim). No cycle risk: propagation is one hop caster->companion and the caster-effect filter
// (te.target === playerName) makes companion effects never re-chain.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { triggerPrimalCompanionSpellShare } from './primalCompanionSpellShareService.js';
import { handle } from '../../automation/handlers/class-ranger/primalCompanionSpellShareHandler.js';

// ---- disk fronting (read programmatically, both rulesets) -------------------------------------------
// Sole producer of this lane: public/data/2024/classes.json -> Ranger > majors[0] Beast Master >
// features[3] 'Share Spells' (level 15, passive, 30_ft). 5e public/data/classes.json: zero rows (raw-text pinned below).
function findShareSpellRows(file) {
    const classes = JSON.parse(readFileSync(file, 'utf8'));
    const rows = [];
    for (const cls of classes) {
        for (const major of cls.majors ?? []) {
            for (const feature of major.features ?? []) {
                if (feature.automation?.type === 'primal_companion_spell_share') {
                    rows.push({ className: cls.name, majorName: major.name, feature });
                }
            }
        }
    }
    return rows;
}

const SHARE_ROW = findShareSpellRows('public/data/2024/classes.json')[0];
const SHARE_RANGE = SHARE_ROW.feature.automation.range; // '30_ft'
const SHARE_RANGE_FT = Number.parseInt(SHARE_RANGE, 10); // 30 — disk decides reachability

const CAMPAIGN = 'test-campaign';
const CASTER = 'FeyRanger';
const COMPANION_TYPE = 'Beast of the Land';
const COMPANION = `Primal Companion (${COMPANION_TYPE})`;

// Passive shape as the loader flattens it (service reads range/casting_time/description off the passive).
const SHARE_PASSIVE = {
    type: SHARE_ROW.feature.automation.type,
    name: SHARE_ROW.feature.name,
    description: SHARE_ROW.feature.description,
    level: SHARE_ROW.feature.level,
    range: SHARE_RANGE,
    casting_time: SHARE_ROW.feature.automation.casting_time,
    hasAutomation: true,
};

// Spell verbatim from public/data/spells.json (level 2, Self, concentration; automation.type
// 'pass_without_trace' at disk:7304 is what spellsCastService dispatches before this share trigger fires).
const SPELLS = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const PWT_SPELL = SPELLS.find(s => s.name === 'Pass Without Trace');

// Caster te seeded exactly as passWithoutTraceService.js:44-51 produces it (key order included);
// effect key registered at targetEffectDefinitions.js:1104; handler matches it via
// spellEffectKey('Pass Without Trace') = 'pass_without_trace' prefix.
const CASTER_TE = {
    target: CASTER,
    effect: 'pass_without_trace_bonus',
    source: CASTER,
    slotLevel: 3,
    duration: 'concentration',
    bonusExpression: '+10',
};
const SUMMON_TE = { target: COMPANION, source: CASTER, effect: 'summoned' };
const SHARED_TE = { ...CASTER_TE, target: COMPANION, sharedBy: 'Share Spells' };
const FINAL_TE = [SUMMON_TE, CASTER_TE, SHARED_TE];

// ---- strict fakes (argument-keyed, throw on anything unexpected) ---------------------------------
const store = {};
let reads = [];
let writes = [];
let rangeGateOpen = true;

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    // real signature is 2-arg; the 3rd campaignName callers pass is ignored by production code
    getRuntimeValue: vi.fn((name, key) => {
        if (typeof name !== 'string' || typeof key !== 'string') {
            throw new Error(`store fake: bad read args (${String(name)}, ${String(key)})`);
        }
        const ck = `${name}.${key}`;
        reads.push(ck);
        if (!(ck in store)) {
            throw new Error(`store fake: unknown read ${ck}`);
        }
        return store[ck];
    }),
    setRuntimeValue: vi.fn((name, key, value, campaignName) => {
        if (typeof name !== 'string' || typeof key !== 'string' || value === undefined) {
            throw new Error(`store fake: bad write ${String(name)}.${String(key)} (arity 4 required)`);
        }
        if (campaignName !== CAMPAIGN) {
            throw new Error(`store fake: write ${name}.${key} for off-target campaign ${String(campaignName)}`);
        }
        writes.push([name, key]);
        store[`${name}.${key}`] = value;
        return Promise.resolve();
    }),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn((campaignName, entry) => {
        if (campaignName !== CAMPAIGN || !entry || entry.type !== 'automation') {
            throw new Error(`log fake: unexpected addEntry(${String(campaignName)})`);
        }
        return Promise.resolve();
    }),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn((player, target, feet) => {
        if (typeof player !== 'string' || typeof target !== 'string' || typeof feet !== 'number') {
            throw new Error('rangeCheck fake: expected (player, target, feet:number)');
        }
        return Promise.resolve(rangeGateOpen);
    }),
}));

// Dispatch fake mirrors automation/index.js:426 registration; unknown types THROW so any drift in the
// service-built automation.type is loud, never silently swallowed.
vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn((action, playerStats, campaignName) => {
        if (campaignName !== CAMPAIGN) {
            throw new Error(`dispatch fake: off-target campaign ${String(campaignName)}`);
        }
        if (action?.automation?.type !== 'primal_companion_spell_share') {
            throw new Error(`dispatch fake: unregistered automation type ${String(action?.automation?.type)}`);
        }
        return Promise.resolve(handle(action, playerStats, campaignName));
    }),
}));

const { setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../ui/logService.js');
const { isWithinRange } = await import('../../rules/combat/rangeCheck.js');
const { executeHandler } = await import('../../automation/index.js');

function makePlayerStats() {
    return { name: CASTER, automation: { passives: [SHARE_PASSIVE] } };
}

function trigger() {
    return triggerPrimalCompanionSpellShare(PWT_SPELL, { slotLevel: CASTER_TE.slotLevel }, makePlayerStats(), CAMPAIGN, null);
}

describe('CLA-311 Share Spells dispatch chain (self-spell cast -> companion effect)', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // keeps factory-supplied implementations; call records cleared
        reads = [];
        writes = [];
        rangeGateOpen = true;
        for (const k of Object.keys(store)) delete store[k];
        store[`${CASTER}.primalCompanionType`] = COMPANION_TYPE;
        store[`${CASTER}.primalCompanionAlive`] = true;
        store['campaign.targetEffects'] = [{ ...SUMMON_TE }, { ...CASTER_TE }];
    });

    it('disk fronting: 2024 Ranger/Beast Master level 15 is the sole Share Spells producer; 5e disk has zero rows', () => {
        expect(readFileSync('public/data/classes.json', 'utf8')).not.toContain('primal_companion_spell_share');
        const rows = findShareSpellRows('public/data/2024/classes.json');
        expect(rows).toHaveLength(1);
        expect(rows[0].className).toBe('Ranger');
        expect(rows[0].majorName).toBe('Beast Master');
        expect(rows[0].feature.name).toBe('Share Spells');
        expect(rows[0].feature.level).toBe(15);
        expect(rows[0].feature.automation).toEqual({
            type: 'primal_companion_spell_share',
            range: '30_ft',
            casting_time: 'passive',
        });
        // tier is reachable only via this disk row; spell side of the seam is disk level 2 / Self / concentration
        expect(PWT_SPELL.level).toBe(2);
        expect(PWT_SPELL.range).toBe('Self');
        expect(PWT_SPELL.concentration).toBe(true);
    });

    it('a confirmed self-spell cast mirrors the caster te onto the companion: exact action, read/write census, full envelopes', async () => {
        const spellBefore = JSON.stringify(PWT_SPELL);
        const result = await trigger();

        // service->handler seam: exact action bytes (description/range/casting_time from disk, slot from metaCtx, spell passed by identity)
        expect(executeHandler).toHaveBeenCalledTimes(1);
        const action = executeHandler.mock.calls[0][0];
        expect(action.spell).toBe(PWT_SPELL);
        expect(action).toEqual({
            name: 'Share Spells',
            description: SHARE_ROW.feature.description,
            automation: {
                type: 'primal_companion_spell_share',
                range: SHARE_RANGE,
                casting_time: 'passive',
                companionType: COMPANION_TYPE,
            },
            spell: PWT_SPELL,
            spellSlotLevel: 3,
        });

        // disk range -> real rangeToFeet -> gate: (caster, companion, 30)
        expect(isWithinRange).toHaveBeenCalledWith(CASTER, COMPANION, SHARE_RANGE_FT);

        // read-order census: service gates, handle gates, re-read inside apply, then the propagation source
        expect(reads).toEqual([
            `${CASTER}.primalCompanionType`,
            `${CASTER}.primalCompanionAlive`,
            `${CASTER}.primalCompanionType`,
            `${CASTER}.primalCompanionAlive`,
            `${CASTER}.primalCompanionType`,
            'campaign.targetEffects',
        ]);

        // write census: campaign te first, then lastSpellShare stamp; 4-arg writes (no skipSync), CAMPAIGN in position 4
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue.mock.calls).toEqual([
            ['campaign', 'targetEffects', FINAL_TE, CAMPAIGN],
            [CASTER, 'lastSpellShare', 'Pass Without Trace', CAMPAIGN],
        ]);
        expect(writes).toEqual([
            ['campaign', 'targetEffects'],
            [CASTER, 'lastSpellShare'],
        ]);

        // full-set store envelope: shared te appended (order-preserving) with the caster key order + sharedBy last
        expect(store['campaign.targetEffects']).toEqual(FINAL_TE);
        expect(Object.keys(store['campaign.targetEffects'][2])).toEqual([
            'target', 'effect', 'source', 'slotLevel', 'duration', 'bonusExpression', 'sharedBy',
        ]);
        expect(store[`${CASTER}.lastSpellShare`]).toBe('Pass Without Trace');

        // log envelope: everything except the wall-clock timestamp is exact (timestamp is log payload only, never game state)
        expect(addEntry).toHaveBeenCalledTimes(1);
        const [logCampaign, logEntry] = addEntry.mock.calls[0];
        expect(logCampaign).toBe(CAMPAIGN);
        expect(typeof logEntry.timestamp).toBe('number');
        expect(logEntry).toEqual({
            type: 'automation',
            characterName: CASTER,
            automationType: 'primal_companion_spell_share',
            name: 'Share Spells',
            spellName: 'Pass Without Trace',
            spellLevel: 3,
            targetName: COMPANION,
            description: `Share Spells: ${CASTER} shares Pass Without Trace with ${COMPANION}.`,
            timestamp: logEntry.timestamp,
        });

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Share Spells',
                automationType: 'primal_companion_spell_share',
                description: `Pass Without Trace shared with ${COMPANION}.`,
                automation: {
                    type: 'primal_companion_spell_share',
                    range: SHARE_RANGE,
                    casting_time: 'passive',
                    companionType: COMPANION_TYPE,
                },
            },
        });

        // inputs never mutated across the chain
        expect(JSON.stringify(PWT_SPELL)).toBe(spellBefore);
    });

    it('range gate closed: the denial popup flows back through the service intact and nothing is written or logged', async () => {
        rangeGateOpen = false;

        const result = await trigger();

        expect(isWithinRange).toHaveBeenCalledWith(CASTER, COMPANION, SHARE_RANGE_FT);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Share Spells',
                automationType: 'primal_companion_spell_share',
                description: `${COMPANION} is more than ${SHARE_RANGE_FT} feet away. Spell not shared.`,
                automation: {
                    type: 'primal_companion_spell_share',
                    range: SHARE_RANGE,
                    casting_time: 'passive',
                    companionType: COMPANION_TYPE,
                },
            },
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(writes).toEqual([]);
        expect(addEntry).not.toHaveBeenCalled();
        expect(store['campaign.targetEffects']).toEqual([{ ...SUMMON_TE }, { ...CASTER_TE }]);
        expect(store[`${CASTER}.lastSpellShare`]).toBeUndefined();
    });

    it('re-sharing the same spell replaces the chain-produced te instead of duplicating it', async () => {
        await trigger();
        const firstStore = JSON.parse(JSON.stringify(store['campaign.targetEffects']));
        vi.clearAllMocks(); // clear dispatch/log call records for the second hop; store and range gate persist
        reads = [];
        writes = [];

        const secondResult = await trigger();

        // chain-produced te (target=companion, source=caster) is found and replaced in place — never re-appended
        expect(store['campaign.targetEffects']).toEqual(firstStore);
        expect(store['campaign.targetEffects']).toHaveLength(3);
        expect(secondResult.payload.description).toBe(`Pass Without Trace shared with ${COMPANION}.`);
        expect(reads).toEqual([
            `${CASTER}.primalCompanionType`,
            `${CASTER}.primalCompanionAlive`,
            `${CASTER}.primalCompanionType`,
            `${CASTER}.primalCompanionAlive`,
            `${CASTER}.primalCompanionType`,
            'campaign.targetEffects',
        ]);
        expect(writes).toEqual([
            ['campaign', 'targetEffects'],
            [CASTER, 'lastSpellShare'],
        ]);
        // lastSpellShare overwritten with the same spell name (idempotent stamp, not a list append)
        expect(store[`${CASTER}.lastSpellShare`]).toBe('Pass Without Trace');
    });
});
