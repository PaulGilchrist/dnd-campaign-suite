// @maintained-by-ai
// Sole-real-body-owner lane for holyAuraDamageService.js:1-62. Only production
// consumer is applyDamage.js:819 (handleWardedDamageEvents), which runs this
// service REAL (no applyDamage* lane mocks it) — so every branch of the real
// body is pinned HERE with fixed-stub dice: guard gates, the two campaign-scoped
// store READ shapes (:20 two-arg 'campaign' key, :30 three-arg caster read —
// this service performs ZERO direct writes), fiend/undead detection
// normalization (:11-14), the ability_score_modifiers disk-canonical lowercase
// read (:33, #1376 fix: disk ships only 'con' — never uppercase 'CON' and
// never the producer-less 'constitution' long-form), the
// resolved saveResult contract consumed downstream by DiceRollResult.jsx:817-829
// (.roll/.modifier/.total/.dc/.success), delegation to addCondition at :49, and
// both console.error catch branches (:44/:57).
// Owned elsewhere, NOT re-pinned here: Blinded append/dedup/case-insensitivity/
// meta-stamp live in addCondition (conditionSaveService.test.js #1003/#1002
// owns byte shape of that body). The PRODUCER write of holyAuraSaveDc and the
// aura trigger belong to features/holyAuraService.test.js; turn-start radiant
// damage → effects/auraDamageService.test.js (#1284); consumer call shapes →
// effects/applyAuraDamage.test.js (#1282); SP-008 expiry clear →
// hpMaxReduceService.aura-of-life.test.js (#1289).
// No-clock policy: this service stores no duration/countdown — the 'blinded'
// lifetime is stamped by addCondition/its expiry lanes, never here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkHolyAuraDamage } from './holyAuraDamageService.js';
import { rollD20 } from '../../dice/diceRoller.js';
import { addEntry } from '../../ui/logService.js';
import { getHolyAuraTargets } from '../../automation/handlers/buffs/holyAuraHandler.js';
import { addCondition } from '../../combat/conditions/conditionSaveService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../encounters/combatData.js';

vi.mock('../../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn() }));
vi.mock('../../automation/handlers/buffs/holyAuraHandler.js', () => ({
    handle: vi.fn(),
    getHolyAuraTargets: vi.fn(),
}));
// addCondition is mocked at the seam: delegation call-shape is pinned here;
// its behavior (merge/dedup/suppression) belongs to conditionSaveService.test.js.
vi.mock('../../combat/conditions/conditionSaveService.js', () => ({ addCondition: vi.fn() }));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../encounters/combatData.js', () => ({ loadCombatSummary: vi.fn() }));

const CAMPAIGN = 'TestCampaign';
const TS = 1700000000000; // fixed Date.now — exact tuples, no expect.any

const CREATURE = { name: 'Goblin' }; // aura-protected ally taking the melee hit
const CASTER = 'Paladin';
const ATTACKER = 'Warlock'; // fiend attacker forced to CON-save

// Disk-canon monsters.json carries LOWERCASE ability_score_modifiers keys
// ('con') — 636/636 rows byte-censused, zero uppercase-abbrev keys in the
// whole file (#1376 RED: the old uppercase :33 read never consulted this
// disk-canonical key and faked every fiend/undead save at +0).
function fiend(extra = {}) {
    return { name: ATTACKER, type: 'npc', monsterType: 'Fiend', template: [], ...extra };
}

function makeSummary(attacker) {
    return {
        creatures: [
            { name: CASTER, type: 'player', template: [] },
            ...(attacker ? [attacker] : []),
        ],
    };
}

// Argument-keyed strict store fake: unknown/wrong-scope reads throw (no silent null).
function seedStore(targetEffects) {
    getRuntimeValue.mockImplementation((name, key, campaign) => {
        if (name === 'campaign' && key === 'targetEffects') return targetEffects;
        if (name === CASTER && key === 'holyAuraSaveDc' && campaign === CAMPAIGN) return store.saveDc;
        throw new Error(`unexpected getRuntimeValue('${name}', '${key}', '${campaign}')`);
    });
}

const store = { saveDc: 15 };
let freshCs; // re-loaded summary returned by loadCombatSummary — distinct ref from the arg summary

const saveTuple = (roll, modifier, total, success, dc) => ({
    type: 'save_result',
    characterName: ATTACKER,
    roll,
    modifier,
    total,
    success,
    description: `Holy Aura CON save vs DC ${dc}`,
    timestamp: TS,
});

const blindedConditionTuple = {
    type: 'condition',
    action: 'added',
    characterName: ATTACKER,
    condition: 'Blinded',
    reason: 'Holy Aura (Fiend/Undead melee hit)',
    timestamp: TS,
};

describe('holyAuraDamageService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        store.saveDc = 15;
        addEntry.mockResolvedValue(undefined);
        addCondition.mockReturnValue({ suppressed: false });
        getHolyAuraTargets.mockReturnValue([CREATURE.name]);
        rollD20.mockReturnValue(7); // fixed stub — never a real roll
        freshCs = makeSummary(fiend());
        loadCombatSummary.mockResolvedValue(freshCs);
        seedStore([{ effect: 'holy_aura', target: CREATURE.name, source: CASTER }]);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(Date, 'now').mockReturnValue(TS);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('guard gates (:19)', () => {
        it.each([
            ['falsy attackerName', null, 5],
            ['self-attack (attackerName === creature.name)', CREATURE.name, 5],
            ['wardDamage 0', ATTACKER, 0],
            ['wardDamage negative', ATTACKER, -1],
        ])('no-op and resolves null on %s', async (_label, attackerName, wardDamage) => {
            const result = await checkHolyAuraDamage(CREATURE, attackerName, makeSummary(fiend()), CAMPAIGN, wardDamage);

            expect(result).toBeNull();
            expect(getRuntimeValue).not.toHaveBeenCalled(); // strict fake: any read would throw
            expect(getHolyAuraTargets).not.toHaveBeenCalled();
            expect(rollD20).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addCondition).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('targetEffects selection + save-success golden path (:20-45)', () => {
        it('reads campaign targetEffects (exact 2-arg shape), filters holy_aura rows to this target, chains caster source to the aura, logs the successful save, and resolves the saveResult contract', async () => {
            rollD20.mockReturnValue(12); // 12 + CON 3 = 15 >= DC 15
            const attacker = fiend({ ability_score_modifiers: { con: 3 } }); // disk-canonical lowercase
            seedStore([
                { effect: 'aura_of_life', target: CREATURE.name, source: 'Cleric' }, // real near-miss effect name
                { effect: 'holy_aura', target: 'Orc', source: 'WrongCaster' },        // wrong target
                { effect: 'holy_aura', target: CREATURE.name, source: CASTER },       // the selected row (:24)
            ]);
            getHolyAuraTargets.mockReturnValue([CREATURE.name, 'Orc']);

            const result = await checkHolyAuraDamage(CREATURE, ATTACKER, makeSummary(attacker), CAMPAIGN, 5);

            expect(getRuntimeValue).toHaveBeenCalledTimes(2);
            expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects'); // :20 — no third arg by design
            expect(getRuntimeValue).toHaveBeenCalledWith(CASTER, 'holyAuraSaveDc', CAMPAIGN); // :30
            expect(getHolyAuraTargets).toHaveBeenCalledTimes(1);
            expect(getHolyAuraTargets).toHaveBeenCalledWith(CASTER, CAMPAIGN); // :25 source is targetEffects[0]
            expect(rollD20).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, saveTuple(12, 3, 15, true, 15));
            expect(addCondition).not.toHaveBeenCalled(); // :46 success seam
            expect(loadCombatSummary).not.toHaveBeenCalled(); // :47 fail-seam only
            expect(setRuntimeValue).not.toHaveBeenCalled(); // this service writes nothing directly
            // resolved contract (DiceRollResult.jsx:817-829 consumer)
            expect(result).toEqual({ roll: 12, modifier: 3, total: 15, success: true, dc: 15 });
        });

        it.each([
            ['no holy_aura row — only near-miss aura_of_life targets the creature', [{ effect: 'aura_of_life', target: CREATURE.name, source: 'Cleric' }]],
            ['holy_aura row targets another creature', [{ effect: 'holy_aura', target: 'Orc', source: CASTER }]],
        ])('resolves null before delegating when filter (:21-23) yields nothing: %s', async (_label, effects) => {
            seedStore(effects);

            await expect(checkHolyAuraDamage(CREATURE, ATTACKER, makeSummary(fiend()), CAMPAIGN, 5)).resolves.toBeNull();

            expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
            expect(getHolyAuraTargets).not.toHaveBeenCalled();
            expect(rollD20).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('aura protection gate (:26-27)', () => {
        it.each([
            ['protected list omits the creature', ['Orc', 'Dragon']],
            ['near-miss case: stored "goblin" does not match "Goblin"', ['goblin']],
        ])('resolves null without rolling when creature is unprotected (%s)', async (_label, auraTargets) => {
            getHolyAuraTargets.mockReturnValue(auraTargets);

            await expect(checkHolyAuraDamage(CREATURE, ATTACKER, makeSummary(fiend()), CAMPAIGN, 5)).resolves.toBeNull();

            expect(getHolyAuraTargets).toHaveBeenCalledTimes(1);
            expect(getHolyAuraTargets).toHaveBeenCalledWith(CASTER, CAMPAIGN);
            expect(rollD20).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addCondition).not.toHaveBeenCalled();
        });
    });

    describe('attacker lookup + fiend/undead detection (:8-16)', () => {
        it('resolves null when attacker is absent from combatSummary', async () => {
            await expect(checkHolyAuraDamage(CREATURE, 'UnknownAttacker', makeSummary(null), CAMPAIGN, 5)).resolves.toBeNull();

            expect(getHolyAuraTargets).toHaveBeenCalledWith(CASTER, CAMPAIGN); // gate reached first
            expect(rollD20).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it.each([
            ['monsterType Fiend (disk-canon capitalization)', 'Fiend', [], true],
            ['monsterType lowercase undead', 'undead', [], true],
            ['template carries Fiend (type Humanoid)', 'Humanoid', ['Fiend'], true],
            ['template carries lowercase undead', 'Humanoid', ['undead'], true],
            ['Humanoid + Dragon template', 'Humanoid', ['Dragon'], false],
            ['missing monsterType and template', undefined, [], false],
        ])('%s detection proceeds: %s', async (_label, monsterType, template, proceeds) => {
            rollD20.mockReturnValue(7); // 7 + 0 (no modifiers) < 15 → fail
            const attacker = fiend({ monsterType, template });

            const result = await checkHolyAuraDamage(CREATURE, ATTACKER, makeSummary(attacker), CAMPAIGN, 5);

            if (proceeds) {
                expect(addEntry).toHaveBeenNthCalledWith(1, CAMPAIGN, saveTuple(7, 0, 7, false, 15));
                expect(addEntry).toHaveBeenNthCalledWith(2, CAMPAIGN, blindedConditionTuple);
                expect(addCondition).toHaveBeenCalledTimes(1);
                expect(result).toEqual({ roll: 7, modifier: 0, total: 7, success: false, dc: 15 });
            } else {
                expect(rollD20).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
                expect(addCondition).not.toHaveBeenCalled();
                expect(result).toBeNull();
            }
        });
    });

    describe('CON save DC gate (:30-31)', () => {
        it.each([
            ['null DC', null],
            ['undefined DC', undefined],
            ['DC 0 (falsy-coercion pin: :0 treated as absent)', 0],
        ])('resolves null before rolling when %s', async (_label, dc) => {
            store.saveDc = dc;

            await expect(checkHolyAuraDamage(CREATURE, ATTACKER, makeSummary(fiend()), CAMPAIGN, 5)).resolves.toBeNull();

            expect(getRuntimeValue).toHaveBeenCalledWith(CASTER, 'holyAuraSaveDc', CAMPAIGN);
            expect(rollD20).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addCondition).not.toHaveBeenCalled();
        });
    });

    describe('ability_score_modifiers lowercase disk-canonical read (:33)', () => {
        // +0-never-lies ledger (#1376): modifier 0 is only ever logged when the
        // disk value IS 0 or the shape is absent. Uppercase 'CON' and long-form
        // 'constitution' have ZERO producers (monsters.json census 636/636 rows
        // lowercase; npcStatBlockUtils ABILITY_KEYS / npcClickFormHandlers
        // ABILITY_ABBRS lowercase) and must NOT resurrect as fallback arms.
        it.each([
            ['lowercase con positive preserved', { con: 5 }, 5, true],        // 10+5 >= 15
            ['lowercase con NEGATIVE preserved — never rounded up to +0', { con: -1 }, -1, false], // 10-1 < 15
            ['lowercase con zero is the honest 0', { con: 0 }, 0, false],     // 10+0 < 15
            ['uppercase CON ignored — no producer ships it', { CON: 5 }, 0, false],
            ['constitution long-form ignored — speculative arm removed', { constitution: 4 }, 0, false],
            ['empty modifiers object → honest absent 0', {}, 0, false],
            ['absent shape (no ability_score_modifiers key) → honest 0', undefined, 0, false],
        ])('%s (roll fixed 10 vs DC 15)', async (_label, mods, mod, success) => {
            rollD20.mockReturnValue(10);

            const result = await checkHolyAuraDamage(CREATURE, ATTACKER, makeSummary(fiend({ ability_score_modifiers: mods })), CAMPAIGN, 5);

            expect(addEntry).toHaveBeenCalledTimes(success ? 1 : 2);
            expect(addEntry).toHaveBeenNthCalledWith(1, CAMPAIGN, saveTuple(10, mod, 10 + mod, success, 15));
            if (!success) expect(addEntry).toHaveBeenNthCalledWith(2, CAMPAIGN, blindedConditionTuple);
            expect(addCondition).toHaveBeenCalledTimes(success ? 0 : 1);
            expect(result).toEqual({ roll: 10, modifier: mod, total: 10 + mod, success, dc: 15 });
        });
    });

    describe('failed-save delegation seam (:46-58)', () => {
        it('re-loads the combat summary and delegates the exact Blinded write to addCondition, logging save then condition entries in order', async () => {
            rollD20.mockReturnValue(5); // 5 + CON -1 = 4 < 15
            const attacker = fiend({ ability_score_modifiers: { con: -1 } }); // negative disk mod rides the live fail seam
            const argSummary = makeSummary(attacker); // stale arg summary — must NOT be forwarded

            const result = await checkHolyAuraDamage(CREATURE, ATTACKER, argSummary, CAMPAIGN, 5);

            expect(loadCombatSummary).toHaveBeenCalledTimes(1);
            expect(loadCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
            expect(addCondition).toHaveBeenCalledTimes(1);
            expect(addCondition).toHaveBeenCalledWith({
                combatSummary: freshCs, // :47 forwarded identity — re-loaded, not argSummary
                creatureName: ATTACKER,
                conditionDef: { key: 'blinded', label: 'Blinded' },
                dc: 15,
                ability: 'CON',
                getRuntimeValue,
                setRuntimeValue,
                campaignName: CAMPAIGN,
                playerStats: attacker, // :49 attackerCreature identity, not the damaged creature
            });
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(1, CAMPAIGN, saveTuple(5, -1, 4, false, 15));
            expect(addEntry).toHaveBeenNthCalledWith(2, CAMPAIGN, blindedConditionTuple);
            expect(setRuntimeValue).not.toHaveBeenCalled(); // write budget delegated wholesale
            expect(result).toEqual({ roll: 5, modifier: -1, total: 4, success: false, dc: 15 });
        });

        it('rejecting save-result log does not break the flow: identical Error + exact prefix to console.error', async () => {
            const err = new Error('log down');
            addEntry.mockRejectedValueOnce(err);

            const result = await checkHolyAuraDamage(CREATURE, ATTACKER, makeSummary(fiend()), CAMPAIGN, 5);

            expect(console.error).toHaveBeenCalledWith('[holyAura] Error logging save:', err);
            expect(result).toEqual({ roll: 7, modifier: 0, total: 7, success: false, dc: 15 });
        });

        it('rejecting condition log does not break the flow: identical Error + exact prefix to console.error', async () => {
            const err = new Error('log down');
            addEntry.mockImplementationOnce(() => Promise.resolve()).mockImplementationOnce(() => Promise.reject(err));

            const result = await checkHolyAuraDamage(CREATURE, ATTACKER, makeSummary(fiend()), CAMPAIGN, 5);

            expect(addCondition).toHaveBeenCalledTimes(1); // delegation precedes the second log
            expect(console.error).toHaveBeenCalledWith('[holyAura] Error:', err);
            expect(result).toEqual({ roll: 7, modifier: 0, total: 7, success: false, dc: 15 });
        });
    });
});
