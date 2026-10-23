// @maintained-by-ai
/**
 * friendsService lane — the PRE-CAST GATE + TRIGGER-STAMP OWNER (friendsService.js)
 * and the early-end READER of the Friends latch (endFriendsOnHostileAction L199-221).
 *
 * Disk determination (read 2026-10-20, both rulesets): the service fronts the 2024
 * Friends CANTRIP row (public/data/2024/spells.json: level 0, Concentration up to
 * 1 minute, WIS save dc_success 'none', status_effects ['Charmed']; text clauses
 * 'Humanoid', 'past 24 hours', 'ends early', 'knows it was Charmed' map 1:1 onto
 * triggerFriends Checks 1-2 + the three pre-cast no-effect paths and the ender log).
 * The 5e row DIVERGES (level 1; this dataset's 5e text omits the Humanoid/24h
 * clauses entirely) yet the name gate is lowercase-exact 'friends' for EVERY
 * ruleset — so a 5e Bard casting the lv1 disk version gets the 2024 immunity
 * checks. QUIRK reported upstream; tests pin current bytes.
 *
 * Latch pair (#1363 class): writer is friendsHandler.js:23
 * `setRuntimeValue('campaign', '_activeFriends_' + playerStats.name, targetName)`;
 * this lane owns ONLY the reader — the exact round-key `_activeFriends_${caster}`
 * and the case-insensitive 'charmed' strip are pinned here against that verbatim
 * writer format. Cooldown store '_friendsCastTargets' has no timestamps — the
 * '24 hours' is a LABEL enforced by rest purges (restRules-constants.js:93,:152);
 * campaignKeys.js:64 registers the dynamic campaign-key prefix. NO CLOCKS in this
 * lane: zero timers, duration is store-content cleared at rest seams.
 * skipSync: N/A — standalone setRuntimeValue POST lane, not setRuntimeObject SSE echo.
 *
 * Callers (evidence): triggerSpells.js:245 handleFriends re-gates the same name
 * upstream and spreads { ...metaCtx, spellSaveDc, targetName } — caller envelopes
 * are that lane's; ender is invoked from useCharActionsAttackHandlers.js:113,
 * spellResolution.js:170 caller gone with the barrel's fix#301 retirement; hub
 * ender now at execution/index.js:71 (execution lanes already pin
 * the non-Friends gating — cited, not re-pinned). Nothing else exercises these
 * internals: every other test file vi.mock's this module.
 * Downstream owned by friendsHandler.test.js (save prompt, Charmed apply, latch
 * write) — NOT re-pinned here.
 *
 * Family-class scan, honest: | prof||0 (triggerFriends success uses
 * `8 + (proficiency || 2)` twice — saveDc fallback L127 AND concentrationDc L109;
 * the prof:0 row pins both leaks at once). :0-chains — `metaCtx?.slotLevel ||
 * spell.level || 0` leaks a falsy slotLevel 0 to spell.level (harmless for the lv0
 * cantrip both are 0; pinned honestly). Unguarded deref outside try — only
 * executeHandler is wrapped (runFriendsHandler); playerStats.name deref and the
 * three getCombatContext fetches (resolve L64 + isTargetHumanoid L15 + check 3
 * L159, identical-arg dupes = gate chokepoint) run unguarded. addEntry rejections
 * are caught by both services — the '[friendsService:log-error]' console.error
 * prefix is pinned. resolvePlayerHealth reads the canonical store keys
 * 'currentHitPoints'/'hitPoints' (same pair as MassHealModal.jsx:54-55), NOT the
 * combat-summary entry.
 * addConcentration is MOCKED here: this lane owns the call-site stamp (target
 * identity + composed DC); concentration semantics belong to concentrationService.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerFriends, endFriendsOnHostileAction } from './friendsService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import storage from '../../ui/storage.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../automation/index.js', () => ({ executeHandler: vi.fn() }));
vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../npcs/monsterUtils.js', () => ({ getMonsterData: vi.fn() }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn() }));
vi.mock('../../combat/concentration/concentrationService.js', () => ({ addConcentration: vi.fn() }));
vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn() } }));
vi.mock('../../encounters/combatData.js', () => ({ getCombatSummary: vi.fn() }));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const CASTER = 'Wizard';
const casterStats = {
    name: CASTER,
    proficiency: 4,
    abilities: { CON: { bonus: 2 } },
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
};

// Exact popup envelope builder — every early-return in the service is this shape.
const infoPopup = (description) => ({
    type: 'popup',
    payload: { type: 'automation_info', name: 'Friends', description },
});
const NO_TARGET = 'No target selected for Friends.';

const casterRow = { name: CASTER, type: 'player' };
const npcRow = (name, currentHp = 5, maxHp = 5) => ({ name, type: 'npc', currentHp, maxHp });

// Argument-keyed strict store fake (determinism bar of #1365/#1366): any read
// outside the seeded set, wrong arity, or wrong campaign is a test failure.
function seedReads(reads) {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
        if (campaign !== campaignName) throw new Error(`read with wrong campaign: ${campaign}`);
        const k = `${key}::${prop}`;
        if (k in reads) return reads[k];
        throw new Error(`unexpected getRuntimeValue("${key}", "${prop}")`);
    });
}

// Full success-path seed: explicit-target cast on a full-health humanoid NPC.
function seedCast({ castTargets = null, cs = { creatures: [casterRow, npcRow('Goblin')] } } = {}) {
    seedReads({ [`${CASTER}::_friendsCastTargets`]: castTargets });
    getCombatContext.mockResolvedValue(cs);
    getMonsterData.mockResolvedValue({ type: 'Humanoid' });
    getCombatSummary.mockReturnValue(cs);
    executeHandler.mockResolvedValue(infoPopup('ok'));
}

function spellSaved(caster, castTargets, target) {
    expect(setRuntimeValue).toHaveBeenCalledWith(
        caster, '_friendsCastTargets', [...castTargets, target], campaignName,
    );
}

describe('friendsService', () => {
    let errorSpy, warnSpy, dispatchSpy;
    beforeEach(() => {
        vi.resetAllMocks();
        addEntry.mockResolvedValue({});
        errorSpy = vi.spyOn(console, 'error');
        warnSpy = vi.spyOn(console, 'warn');
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        // Unseeded reads must throw — no silent null defaults through the lane.
        getRuntimeValue.mockImplementation(() => { throw new Error('unseeded store read'); });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('disk canon (both rulesets) — why the literals', () => {
        it.each([
            ['2024', spells2024, 0, true, 'Charmed'],
            ['5e', spells5e, 1, true, 'charmed'],
        ])('%s row: name-gate hits, level/range/save match lane posture', (_label, data, level, concentration, _se) => {
            const disk = data.find(s => s.name === 'Friends');
            expect(disk.level).toBe(level);
            expect(disk.concentration).toBe(concentration);
            expect(disk.dc).toEqual({ dc_type: 'WIS', dc_success: 'none' });
            expect(disk.casting_time.toLowerCase().endsWith('action')).toBe(true);
            // near-miss REAL disk names backing the negative-gate rows below
            expect(data.some(s => s.name === 'Animal Friendship')).toBe(true);
        });

        it('stamped literals match the 2024 disk row (and the 5e divergence is real)', () => {
            const d2024 = spells2024.find(s => s.name === 'Friends');
            const d5e = spells5e.find(s => s.name === 'Friends');
            // Service's three pre-cast checks mirror 2024 text clauses verbatim.
            const text = d2024.description.join(' ');
            expect(text).toContain('Humanoid');                 // Check 1 literal
            expect(text).toContain('past 24 hours');            // Check 2 / '_friendsCastTargets'
            expect(text).toContain('ends early');               // ender log literal
            expect(text).toContain('knows it was Charmed');     // ender log literal
            expect(d2024.status_effects).toEqual(['Charmed']);   // case-insensitive strip matches
            // Honest divergence: the disk 5e row trimmed those clauses and is lv1 —
            // the name-only gate routes both rulesets here anyway (quirk reported).
            expect(d5e.level).toBe(1);
            expect(d5e.description.join(' ')).not.toContain('24 hours');
        });
    });

    describe('triggerFriends — name gate (lowercase-exact \'friends\')', () => {
        it.each([
            ['Friends', true],
            ['friends', true],
            ['FRIENDS', true],
            ['Animal Friendship', false],
            ['Fire Bolt', false],
            ['', false],
            [undefined, false],
        ])('spell name %s → %s', async (name, expectHit) => {
            const spell = name === undefined ? {} : { name, level: 0 };
            if (expectHit) seedCast();

            const result = await triggerFriends(spell, { targetName: 'Goblin' }, casterStats, campaignName, mapName);

            if (expectHit) {
                expect(result).toEqual(infoPopup('ok'));
                expect(executeHandler).toHaveBeenCalledTimes(1);
            } else {
                expect(result).toBeNull();
                expect(getCombatContext).not.toHaveBeenCalled();
                expect(getRuntimeValue).not.toHaveBeenCalled();
                expect(executeHandler).not.toHaveBeenCalled();
            }
        });
    });

    describe('triggerFriends — target resolution (metaCtx wins, else initiative view)', () => {
        it.each([
            ['empty metaCtx, no creatures', {}, { creatures: [] }],
            ['null metaCtx, no creatures', null, { creatures: [] }],
            ['falsy targetName triple', { targetName: '' }, { creatures: [] }],
            ['combat context unavailable', {}, null],
            ['caster-only combat, no attacker target', {}, { creatures: [casterRow] }],
        ])('%s → no-target popup with logged error', async (_label, metaCtx, cs) => {
            getCombatContext.mockResolvedValue(cs);
            getTargetFromAttacker.mockReturnValue(null);
            seedReads({});

            const result = await triggerFriends({ name: 'Friends', level: 0 }, metaCtx, casterStats, campaignName, mapName);

            expect(result).toEqual(infoPopup(NO_TARGET));
            expect(errorSpy).toHaveBeenCalledWith(
                `[friendsService] No target selected for Friends by ${CASTER}. Caster has no target in initiative view.`,
            );
            expect(executeHandler).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            // attacker lookup only runs when the summary actually has creatures
            expect(getTargetFromAttacker).toHaveBeenCalledTimes(cs?.creatures?.length ? 1 : 0);
            if (cs?.creatures?.length) expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, CASTER);
        });

        it('no explicit target: initiative-view attacker target flows into the envelope', async () => {
            const cs = { creatures: [casterRow, npcRow('Goblin')] };
            getCombatContext.mockResolvedValue(cs);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            seedCast({ cs });

            await triggerFriends({ name: 'Friends', level: 0 }, {}, casterStats, campaignName, mapName);

            expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, CASTER);
            expect(executeHandler.mock.calls[0][0].automation.targetName).toBe('Goblin');
        });
    });

    describe('triggerFriends — Check 1: not a Humanoid', () => {
        it.each([
            ['Beast', 'Beast'],
            ['beast (disk type casing tolerated)', 'beast'],
        ])('%s → no-effect popup, monster table queried with (name, null)', async (_label, type) => {
            const cs = { creatures: [casterRow, npcRow('Wolf')] };
            getCombatContext.mockResolvedValue(cs);
            getMonsterData.mockResolvedValue({ type });
            seedReads({});

            const result = await triggerFriends({ name: 'Friends', level: 0 }, { targetName: 'Wolf' }, casterStats, campaignName, mapName);

            expect(getMonsterData).toHaveBeenCalledWith('Wolf', null);
            expect(result).toEqual(infoPopup('No effect. Wolf is not a Humanoid.'));
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: CASTER,
                abilityName: 'Friends',
                description: `${CASTER} casts Friends on Wolf but it has no effect — Wolf is not a Humanoid..`, // verbatim double-dot: reason ends in '.' and template adds another
            });
            expect(executeHandler).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('monster data unavailable → warn and default to Humanoid, cast proceeds', async () => {
            seedCast();
            getMonsterData.mockRejectedValue(new Error('no stat block'));

            const result = await triggerFriends({ name: 'Friends', level: 0 }, { targetName: 'Goblin' }, casterStats, campaignName, mapName);

            expect(warnSpy).toHaveBeenCalledWith(
                '[friendsService] Monster data unavailable, defaulting to Humanoid:',
                expect.any(Error),
            );
            expect(result).toEqual(infoPopup('ok'));
        });
    });

    describe('triggerFriends — Check 2: cooldown store hit', () => {
        it('_friendsCastTargets already contains target → popup, no writes', async () => {
            seedCast({ castTargets: ['Goblin'] });

            const result = await triggerFriends({ name: 'Friends', level: 0 }, { targetName: 'Goblin' }, casterStats, campaignName, mapName);

            expect(result).toEqual(infoPopup('No effect. You have already cast Friends on Goblin within the past 24 hours.'));
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: `${CASTER} casts Friends on Goblin but it has no effect — already cast within the past 24 hours..`, // verbatim double-dot (reason ends in '.')
            }));
            expect(executeHandler).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addConcentration).not.toHaveBeenCalled();
        });
    });

    describe('triggerFriends — Check 3: full-health immunity (fail-closed)', () => {
        it.each([
            ['npc 3/7 damaged', { creatures: [casterRow, npcRow('Goblin', 3, 7)] }, 'Goblin', 'No effect. Goblin is not at full health and is immunized to the effect.'],
            ['npc 0/0 fail-closed', { creatures: [casterRow, npcRow('Goblin', 0, 0)] }, 'Goblin', 'No effect. Goblin is not at full health and is immunized to the effect.'],
            ['target absent from summary (no monster lookup)', { creatures: [casterRow] }, 'Ghost', 'No effect. Ghost is not at full health and is immunized to the effect.'],
            ['player target reads store keys 3/7 (store null → ?? computedStats)', { creatures: [casterRow, { name: 'Shopkeeper', type: 'player', currentHp: 99, maxHp: 99 }] }, 'Shopkeeper', 'No effect. Shopkeeper is not at full health and is immunized to the effect.'],
        ])('%s → immunized popup, nothing executed or stamped', async (_label, cs, target, description) => {
            getCombatContext.mockResolvedValue(cs);
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            const playerKeys = target === 'Shopkeeper'
                ? { 'Shopkeeper::currentHitPoints': null, 'Shopkeeper::hitPoints': null }
                : {};
            seedReads({ [`${CASTER}::_friendsCastTargets`]: null, ...playerKeys });
            const stats = target === 'Shopkeeper'
                ? { ...casterStats, computedStats: { currentHp: 3, maxHp: 7 } }
                : casterStats;

            const result = await triggerFriends({ name: 'Friends', level: 0 }, { targetName: target }, stats, campaignName, mapName);

            expect(result).toEqual(infoPopup(description));
            if (target === 'Ghost') expect(getMonsterData).not.toHaveBeenCalled();
            expect(executeHandler).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addConcentration).not.toHaveBeenCalled();
        });

        it('player target at full store health proceeds (canonical currentHitPoints/hitPoints keys)', async () => {
            const cs = { creatures: [casterRow, { name: 'Shopkeeper', type: 'player' }] };
            getCombatContext.mockResolvedValue(cs);
            seedReads({
                [`${CASTER}::_friendsCastTargets`]: null,
                'Shopkeeper::currentHitPoints': 7,
                'Shopkeeper::hitPoints': 7,
            });
            getCombatSummary.mockReturnValue(cs);
            executeHandler.mockResolvedValue(infoPopup('ok'));

            await triggerFriends({ name: 'Friends', level: 0 }, { targetName: 'Shopkeeper' }, casterStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(addConcentration).not.toHaveBeenCalledWith(cs, 'Shopkeeper', expect.anything(), expect.anything());
        });
    });

    describe('triggerFriends — golden success: exact envelope + every stamp', () => {
        it('casts: append-cast record, concentration badge DC, storage, dispatch, handler identity', async () => {
            seedCast({ castTargets: ['Shopkeeper'] });
            const spell = { name: 'Friends', level: 0 };
            const handlerResult = infoPopup('save prompt opened');
            executeHandler.mockResolvedValue(handlerResult);

            const result = await triggerFriends(spell, { targetName: 'Goblin' }, casterStats, campaignName, mapName);

            expect(result).toBe(handlerResult);
            const action = executeHandler.mock.calls[0][0];
            expect(action).toEqual({
                name: 'Friends',
                automation: { type: 'friends', saveDc: 15, targetName: 'Goblin' },
                spell,
                spellSlotLevel: 0,
            });
            expect(action.spell).toBe(spell);
            expect(executeHandler).toHaveBeenCalledWith(action, casterStats, campaignName, mapName);
            // cooldown store APPENDS (24h label — cleared by rest lanes, no clock here)
            spellSaved(CASTER, ['Shopkeeper'], 'Goblin');
            // concentration stamp: caster-scoped, DC = 8 + (proficiency || 2) + CON bonus
            const cs = getCombatSummary.mock.results[0].value;
            expect(addConcentration).toHaveBeenCalledTimes(1);
            expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, 'Friends', 14);
            expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            const evt = dispatchSpy.mock.calls[0][0];
            expect(evt).toBeInstanceOf(CustomEvent);
            expect(evt.type).toBe('combat-summary-updated');
        });

        it('no combat summary → badge lane skipped, cast still executes', async () => {
            seedCast();
            getCombatSummary.mockReturnValue(null);

            await triggerFriends({ name: 'Friends', level: 0 }, { targetName: 'Goblin' }, casterStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(dispatchSpy).not.toHaveBeenCalled();
            spellSaved(CASTER, [], 'Goblin');
        });
    });

    describe('triggerFriends — save DC / slot level / concentration DC composition', () => {
        it.each([
            ['metaCtx spellSaveDc+slotLevel win over stats and spell.level',
                { spellSaveDc: 18, slotLevel: 2 }, { level: 0 }, casterStats, 18, 2, 14],
            ['no spellAbilities → 8 + proficiency',
                {}, { level: 0 }, { name: CASTER, proficiency: 3, abilities: { CON: { bonus: 2 } } }, 11, 0, 13],
            ['prof 0 AND no abilities → ||2 / ??0 leaks (saveDc 10, concDc 10)',
                {}, { level: 0 }, { name: CASTER }, 10, 0, 10],
            ['slotLevel falsy :0-chain leaks to spell.level 3',
                { slotLevel: 0 }, { level: 3 }, casterStats, 15, 3, 14],
        ])('%s', async (_label, metaCtx, spellLevel, stats, saveDc, slotLevel, concDc) => {
            seedCast();

            await triggerFriends({ name: 'Friends', ...spellLevel }, { targetName: 'Goblin', ...metaCtx }, stats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc }),
                    spellSlotLevel: slotLevel,
                }),
                stats, campaignName, mapName,
            );
            expect(addConcentration).toHaveBeenCalledWith(getCombatSummary.mock.results[0].value, CASTER, 'Friends', concDc);
        });

        it('executeHandler throws → exact error popup + logged identical error; cast and badge already recorded', async () => {
            seedCast();
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);

            const result = await triggerFriends({ name: 'Friends', level: 0 }, { targetName: 'Goblin' }, casterStats, campaignName, mapName);

            expect(result).toEqual(infoPopup('Failed to execute Friends.'));
            expect(errorSpy).toHaveBeenCalledWith('[friendsService] Failed to execute Friends handler:', err);
            // quirk pinned honestly: the 24h cooldown burns even on failed execution
            spellSaved(CASTER, [], 'Goblin');
            expect(addConcentration).toHaveBeenCalledTimes(1);
        });
    });

    describe('endFriendsOnHostileAction — latch reader', () => {
        const activeKey = '_activeFriends_Wizard'; // round-key vs friendsHandler.js:23 writer
        const readerReads = (conditions) => seedReads({
            [`campaign::${activeKey}`]: 'Shopkeeper',
            ...(conditions === undefined ? {} : { 'Shopkeeper::activeConditions': conditions }),
        });

        it('no active latch → single strict read, zero writes, zero logs', () => {
            seedReads({ [`campaign::${activeKey}`]: null });

            endFriendsOnHostileAction(CASTER, campaignName);

            expect(getRuntimeValue).toHaveBeenCalledTimes(1);
            expect(getRuntimeValue).toHaveBeenCalledWith('campaign', activeKey, campaignName);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it.each([
            ['Charmed stripped, other conditions preserved', ['Charmed', 'Invisible'], true],
            ['lowercase charmed stripped too (case-insensitive match)', ['charmed'], true],
            ['null conditions → no condition write', null, false],
            ['no Charmed → pointer cleared, spell still ends early', ['Invisible', 'Poisoned'], false],
        ])('%s', (_label, conditions, expectsStrip) => {
            readerReads(conditions);

            endFriendsOnHostileAction(CASTER, campaignName);

            const writes = [
                ...(expectsStrip ? [['Shopkeeper', 'activeConditions', conditions.filter(c => c.toLowerCase() !== 'charmed'), campaignName]] : []),
                ['campaign', activeKey, null, campaignName],
            ];
            expect(setRuntimeValue.mock.calls).toEqual(writes);
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: CASTER,
                abilityName: 'Friends',
                description: 'Shopkeeper knows it was Charmed by Wizard as the Friends spell ends early.',
            });
        });

        it('addEntry rejects → swallowed with exact log-error prefix, never throws', async () => {
            readerReads(['Charmed']);
            addEntry.mockRejectedValue(new Error('Log error'));

            expect(() => endFriendsOnHostileAction(CASTER, campaignName)).not.toThrow();
            await Promise.resolve(); // flush the .catch microtask
            expect(errorSpy).toHaveBeenCalledWith('[friendsService:log-error]', expect.any(Error));
        });
    });
});
