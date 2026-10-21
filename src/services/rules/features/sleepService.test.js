// @maintained-by-ai
// SP-107 Sleep spell face (BASE lane) of the DUAL-FACE sleepService. Per the
// #1414 split recorded in sleepService.staged-breath.test.js:43-48, THIS lane
// owns: triggerSleep, isSleepImmune, spell defaults (WIS/concentration, the
// concentrate-true staging + already-concentrating skip, plain no-te /
// already-unconscious no-ops, skipSync honour, wake reasons). The breath twin
// owns the CON ladder walk, DC 18/21 disk rows, the >= tie, takeover legs,
// the sparse-fallback leak, the PC prompt envelope, and the strict-lowercase
// stage gate byte — NOT re-grown here; coordination cites inline, both ways.
// Live caller evidence (#1370/82): triggerSleep ← SleepModal.jsx:43 (mapName
// null, characters forwarded); isSleepImmune ← sleepHandler.js:144 (sole
// consumer, alive); stageSleepTargets ← sleepHandler.js:191 4-arg — the
// concentrate:true default is the LIVE spell shape; applySleepTurnEnd ←
// navigationHandlers.js:187 WITHOUT options → skipSync false there (audited in
// the breath lane); the skipSync:true capability itself has no production
// caller yet — pinned here as the SSE-echo reservation + rec.
// HP-pool RAW (5e text: ascending-HP aggregate pool): NOT implemented in this
// service — grep-clean; selection census lives in sleepHandler's lane
// (its own header: "No ascending-HP code exists here or in sleepService").
// Three-way case-gate map (#1390 lenient / #1414 strict / BASE=STRICT): the
// stage gate at sleepService.js:197 is shared code — strict stance pinned by
// the breath twin (:461); this lane pins only the spell-shape no-op rows.
// Immunity classification read PROGRAMMATICALLY from both ruleset disks —
// invented nothing (#1362): 2024 Sleep is concentration:true / dc WIS
// (matches the service defaults); 5e text says "Undead and creatures immune
// to being charmed aren't affected" while the service checks undead/construct
// TYPE + exhaustion/magical-sleep immunities; disk census below proves every
// charmed-immune fey is also exhaustion-immune, so the gap is text-only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../effects/tranceRules.js', () => ({
    hasTranceTrait: vi.fn(() => false),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

import storage from '../../ui/storage.js';
import {
    triggerSleep,
    isSleepImmune,
    stageSleepTargets,
    applySleepTurnEnd,
    wakeSleepTarget,
    wakeSleepOnDamage,
    SLEEP_TE_EFFECT,
    sleepStageSpec,
} from './sleepService.js';
import { executeHandler } from '../../automation/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import { addEntry } from '../../ui/logService.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { hasTranceTrait } from '../effects/tranceRules.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

// ── Disk canon, programmatic, both rulesets (canary-tested in lane below) ───
const rosterOf = (p) => {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return Array.isArray(j) ? j : (j.spells || j.monsters || Object.values(j));
};
const diskMonsters = rosterOf('public/data/monsters.json');
const sleep2024 = rosterOf('public/data/2024/spells.json').find(s => s.name === 'Sleep');
const sleep5eText = rosterOf('public/data/spells.json').find(s => s.name === 'Sleep').description.join(' ');
const monsterRow = (name) => diskMonsters.find(m => m.name === name) || null;
const ciHas = (row, cond) => ((row?.condition_immunities || row?.immunities || []).map(s => String(s).toLowerCase()).includes(cond));

// Strictly turn-based: no wall-clock in this service — seams only (#1285/1332/1405).
const src = readFileSync('src/services/rules/features/sleepService.js', 'utf8');
expect(src).not.toMatch(/Date\.now\(|setTimeout\(|setInterval\(/);

const campaignName = 'test-campaign';
const CASTER = 'Wizard';
const T1 = 'Thug 1';
const T2 = 'Bandit 2';
const PC = 'ElfWizard';
const DC = 16; // this lane's spell DC — distinct from the breath twin's 18/21

const SPI = { saveDc: DC, modifier: 3, spellCastingAbility: 'Intelligence', toHit: 8 };
const PS_FULL = { name: CASTER, spellAbilities: SPI, proficiency: 2 };
const CHARS = [{ name: PC, computedStats: { name: PC } }];

function spellTe(overrides = {}) {
    return {
        target: T1,
        effect: SLEEP_TE_EFFECT,
        source: CASTER,
        condition: 'incapacitated',
        stage: 'incapacitated',
        dc: DC,
        saveType: 'WIS',
        duration: 'concentration',
        label: 'Sleep',
        logLabel: 'Sleep spell',
        unconsciousRounds: 10,
        ...overrides,
    };
}

// Bystander from the OTHER producer on the SAME te key (registry :513 fronts
// both by design, discriminator saveType+duration #1378). Fixed fixture — the
// breath twin's disk-driven breathTe mirror is theirs, not re-derived here.
const BREATH_BST = {
    target: T1,
    effect: SLEEP_TE_EFFECT,
    source: 'Adult Brass Dragon 1',
    condition: 'incapacitated',
    stage: 'incapacitated',
    dc: 18,
    saveType: 'CON',
    duration: 'staged_until_repeat_save',
    label: 'Sleep Breath',
    logLabel: 'Sleep Breath',
    unconsciousRounds: 100,
};
const HEX = { target: T2, effect: 'hex', source: 'Someone' };

// ── Strict argument-keyed STATEFUL runtime store fake (#1372/84/93/1400) ───
let store, cs, writes, reads, logs, expirations, rolls, consulted, executeCalls, storageCalls, consoleSpy;

const jclone = (v) => JSON.parse(JSON.stringify(v));

function assertScope(owner, key, campaign, op) {
    if (campaign !== campaignName) throw new Error(`[test-fake] unexpected campaign "${campaign}" on ${op}`);
    const ok = owner === 'campaign' ? key === 'targetEffects' : key === 'activeConditions';
    if (!ok) throw new Error(`[test-fake] unexpected ${op} ${owner}.${key} (no concentration/damage reads in this lane)`);
}

beforeEach(() => {
    vi.resetAllMocks(); // explicit re-seed below (#1312)
    store = { campaign: { targetEffects: [] } };
    cs = { creatures: [] };
    writes = [];
    reads = [];
    logs = [];
    expirations = [];
    rolls = [];
    consulted = [];
    executeCalls = [];
    storageCalls = [];

    getRuntimeValue.mockImplementation((owner, key, campaign) => {
        assertScope(owner, key, campaign, 'read');
        reads.push([owner, key]);
        const bucket = store[owner];
        return bucket && bucket[key] !== undefined ? jclone(bucket[key]) : null;
    });
    setRuntimeValue.mockImplementation((owner, key, value, campaign, skipSync) => {
        assertScope(owner, key, campaign, 'write');
        if (!Array.isArray(value)) throw new Error(`[test-fake] write ${owner}.${key} must be an array, got ${typeof value}`);
        if (!store[owner]) store[owner] = {};
        store[owner][key] = jclone(value);
        writes.push({ owner, key, value: jclone(value), skipSync });
        return Promise.resolve();
    });
    addEntry.mockImplementation((campaign, entry) => {
        if (campaign !== campaignName) throw new Error(`[test-fake] unexpected campaign "${campaign}" on addEntry`);
        logs.push(jclone(entry));
        return Promise.resolve();
    });
    getCombatSummary.mockImplementation((campaign) => {
        if (campaign !== campaignName) throw new Error(`[test-fake] unexpected campaign "${campaign}" on getCombatSummary`);
        return cs;
    });
    // monsters.json consults are recorded against the REAL disk rows — any
    // unrecorded path is a test bug (no silent undefined branch).
    getMonsterData.mockImplementation((name) => {
        consulted.push(name);
        return Promise.resolve(monsterRow(name));
    });
    addConcentration.mockImplementation((summary) => {
        if (summary !== cs) throw new Error('[test-fake] addConcentration must receive the getCombatSummary object');
    });
    storage.set.mockImplementation((key, value, campaign) => {
        if (campaign !== campaignName) throw new Error(`[test-fake] unexpected campaign "${campaign}" on storage.set`);
        storageCalls.push([key, value]);
    });
    // The BASE lane never prompts a player — the breath twin owns the PC leg.
    // An unexpected prompt THROWS instead of hanging.
    createSaveListener.mockImplementation(() => {
        throw new Error('[test-fake] unexpected save prompt — the PC-prompt face lives in the breath twin');
    });
    addExpiration.mockImplementation((entry) => { expirations.push(jclone(entry)); });
    executeHandler.mockImplementation((action, playerStats, campaign, mapName, characters) => {
        if (campaign !== campaignName) throw new Error(`[test-fake] unexpected campaign "${campaign}" on executeHandler`);
        executeCalls.push([action, playerStats, campaign, mapName, characters]);
        return Promise.resolve({ type: 'popup' });
    });
    hasTranceTrait.mockImplementation(() => false);
    // Fixed-natural d20 queue; an unstubbed roll is a test bug — THROW (#1380).
    vi.spyOn(Math, 'random').mockImplementation(() => {
        if (!rolls.length) throw new Error('[test-fake] unstubbed d20 roll — seed dice(n) first');
        return (rolls.shift() - 1) / 20;
    });
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks(); // release Math.random + console spies
});

const dice = (...naturals) => rolls.push(...naturals);
const tuples = (from = 0) => writes.slice(from).map(w => [w.owner, w.key, w.value, w.skipSync]);

describe('sleepService — SP-107 Sleep spell face (base lane)', () => {
    it('triggerSleep is a pure forwarder: builds the byte-exact action envelope across the full saveDc/slot coercion spectrum (metaCtx.spellSaveDc wins; spellAbilities.saveDc, then 8+proficiency fallbacks; spellSlotLevel metaCtx-then-spell precedence; live-SleepModal mapName-null + characters forward), broadcasts, writes nothing, logs nothing', async () => {
        const spell = { index: 'sleep', name: 'Sleep', level: 1, school: 'Enchantment' };

        // A — LIVE SleepModal.jsx:43 shape (mapName null, characters identity,
        // selectedTargets ride the metaCtx spread untouched).
        const ctxA = { spellSaveDc: 19, selectedTargets: [T1] };
        await expect(triggerSleep({ spell, metaCtx: ctxA, playerStats: PS_FULL, campaignName, mapName: null, characters: CHARS })).resolves.toEqual({ type: 'popup' });

        // B — empty metaCtx → spellAbilities.saveDc 16; slot from spell.level.
        await triggerSleep({ spell, metaCtx: {}, playerStats: PS_FULL, campaignName, mapName: 'm', characters: undefined });

        // C — no spellAbilities → 8 + proficiency(2) = 10.
        await triggerSleep({ spell, metaCtx: {}, playerStats: { name: CASTER, proficiency: 2 }, campaignName, mapName: 'm' });

        // D — slot precedence + input purity: injected spellSaveDc lands on the
        // COPY; the caller's ctx is never mutated (#1395).
        const ctxD = { slotLevel: 5 };
        await triggerSleep({ spell, metaCtx: ctxD, playerStats: PS_FULL, campaignName, mapName: 'm' });

        // E — :0-swallow both sides (#1345): slotLevel 0 is eaten by `||`
        // (spell.level survives at :321) while spellSaveDc 0 is PRESERVED by
        // the ==null guard at :293 — zero is a legitimate DC, zero is not a slot.
        await triggerSleep({ spell, metaCtx: { spellSaveDc: 0, slotLevel: 0 }, playerStats: PS_FULL, campaignName, mapName: 'm' });

        // E2 — both-zero: slotLevel 0 || no spell.level → undefined written.
        await triggerSleep({ spell: { name: 'Sleep' }, metaCtx: { slotLevel: 0 }, playerStats: PS_FULL, campaignName, mapName: 'm' });

        // F — metaCtx.slotLevel 3 over spell.level 1.
        await triggerSleep({ spell, metaCtx: { slotLevel: 3 }, playerStats: PS_FULL, campaignName, mapName: 'm' });

        const envs = executeCalls.map(([a]) => ({
            name: a.name, saveDc: a.automation.saveDc, saveType: a.automation.saveType,
            slot: a.spellSlotLevel, meta: a.metaCtx,
        }));
        expect(envs).toEqual([
            { name: 'Sleep', saveDc: 19, saveType: 'WIS', slot: 1, meta: { spellSaveDc: 19, selectedTargets: [T1] } },
            { name: 'Sleep', saveDc: 16, saveType: 'WIS', slot: 1, meta: { spellSaveDc: 16 } },
            { name: 'Sleep', saveDc: 10, saveType: 'WIS', slot: 1, meta: { spellSaveDc: 10 } },
            { name: 'Sleep', saveDc: 16, saveType: 'WIS', slot: 5, meta: { slotLevel: 5, spellSaveDc: 16 } },
            { name: 'Sleep', saveDc: 0, saveType: 'WIS', slot: 1, meta: { spellSaveDc: 0, slotLevel: 0 } },
            { name: 'Sleep', saveDc: 16, saveType: 'WIS', slot: undefined, meta: { spellSaveDc: 16, slotLevel: 0 } },
            { name: 'Sleep', saveDc: 16, saveType: 'WIS', slot: 3, meta: { slotLevel: 3, spellSaveDc: 16 } },
        ]);
        expect(Object.keys(executeCalls[0][0])).toEqual(['name', 'automation', 'spell', 'metaCtx', 'spellSlotLevel']);
        expect(executeCalls[0][0].spell).toBe(spell); // identity forwarded, never cloned
        expect(executeCalls[0][0].metaCtx).not.toBe(ctxA); // spread makes a fresh envelope
        expect(ctxA).toEqual({ spellSaveDc: 19, selectedTargets: [T1] }); // caller ctx pure
        expect(executeCalls.map(c => [c[1], c[2], c[3], c[4]])).toEqual([
            [PS_FULL, campaignName, null, CHARS],
            [PS_FULL, campaignName, 'm', undefined],
            [{ name: CASTER, proficiency: 2 }, campaignName, 'm', undefined],
            [PS_FULL, campaignName, 'm', undefined],
            [PS_FULL, campaignName, 'm', undefined],
            [PS_FULL, campaignName, 'm', undefined],
            [PS_FULL, campaignName, 'm', undefined],
        ]);
        expect(executeCalls[3][4]).toBeUndefined();
        expect(executeCalls[0][4]).toBe(CHARS);
        expect(writes).toHaveLength(0); // forwarder: zero production store writes (#1357 class)
        expect(logs).toHaveLength(0);
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('triggerSleep guard rails throw with exact console bytes before any dispatch (missing proficiency, slot missing BOTH sides) and the playerStats undefined golden TypeError stays console-untouched (#1360); a rejecting handler swallows to null with the exact-prefix identical Error (#1385)', async () => {
        const spell = { name: 'Sleep', level: 1 };

        await expect(triggerSleep({ spell, metaCtx: {}, playerStats: { name: CASTER }, campaignName, mapName: 'm' }))
            .rejects.toThrow('playerStats.proficiency is required for sleep spell');
        expect(consoleSpy.mock.calls).toEqual([['[sleepService] triggerSleep: playerStats.proficiency is missing']]);

        consoleSpy.mockClear();
        await expect(triggerSleep({ spell: { name: 'Sleep' }, metaCtx: {}, playerStats: PS_FULL, campaignName, mapName: 'm' }))
            .rejects.toThrow('slot level is required for sleep spell');
        expect(consoleSpy.mock.calls).toEqual([['[sleepService] triggerSleep: slot level is missing (metaCtx.slotLevel and spell.level)']]);

        consoleSpy.mockClear();
        const err = await triggerSleep({ spell, metaCtx: {}, campaignName, mapName: 'm' })
            .catch(e => e); // playerStats undefined → unguarded :294 deref
        expect(err).toBeInstanceOf(TypeError);
        expect(err.message).toContain("'spellAbilities'");
        expect(consoleSpy).not.toHaveBeenCalled(); // golden: dies before any console line

        consoleSpy.mockClear();
        const boom = new Error('log-boom');
        executeHandler.mockRejectedValueOnce(boom);
        await expect(triggerSleep({ spell, metaCtx: {}, playerStats: PS_FULL, campaignName, mapName: 'm' })).resolves.toBeNull();
        expect(consoleSpy.mock.calls).toEqual([['[sleepService] Failed to execute Sleep handler:', boom]]);
        expect(consoleSpy.mock.calls[0][1]).toBe(boom); // identical instance, not re-wrapped
        expect(writes).toHaveLength(0);
    });

    it('isSleepImmune consults NOTHING that a short-circuit can answer: disk-driven type gate (real mixed-case rows Zombie "Undead"/Dracolich "undead"/Iron Golem "Construct" — all WITHOUT condition_immunities on disk, so the TYPE gate is what implements the 5e text), cs-level Exhaustion/Magical-Sleep immunity pre-gate, exact-match monsterType (the real "humanoid (any race)" variant is NOT gated), and the exhaustion oracle answered from disk in BOTH key shapes (condition_immunities AND the live immunities-fallback)', async () => {
        // Disk canaries — invented nothing (#1362).
        const zombieRow = monsterRow('Zombie');
        expect(zombieRow.type).toBe('Undead');
        expect(monsterRow('Zombie').condition_immunities).toBeUndefined();
        expect(monsterRow('Iron Golem').type).toBe('Construct');
        expect(monsterRow('Adult Blue Dracolich').type).toBe('undead');
        expect(ciHas(monsterRow('Adult Blue Dracolich'), 'exhaustion')).toBe(true);
        expect(monsterRow('Thug').type).toBe('humanoid');
        expect(ciHas(monsterRow('Thug'), 'exhaustion')).toBe(false);
        expect(sleep5eText).toContain('Undead and creatures immune to being charmed');
        // 5e charm-clause vs the service's exhaustion check: no disk collision —
        // every charmed-immune fey here is ALSO exhaustion-immune (census).
        const charmedFey = diskMonsters.filter(m => /fey/i.test(m.type || '') && ciHas(m, 'charmed'));
        expect(charmedFey.length).toBeGreaterThan(0);
        expect(charmedFey.every(m => ciHas(m, 'exhaustion'))).toBe(true);

        expect(await isSleepImmune(campaignName, { name: 'Zombie 1', type: 'npc', monsterType: monsterRow('Zombie').type })).toBe(true);
        expect(await isSleepImmune(campaignName, { name: 'Adult Blue Dracolich 1', type: 'npc', monsterType: monsterRow('Adult Blue Dracolich').type })).toBe(true);
        expect(await isSleepImmune(campaignName, { name: 'Iron Golem 1', type: 'npc', monsterType: monsterRow('Iron Golem').type })).toBe(true);
        expect(await isSleepImmune(campaignName, { name: 'Custom Bot', type: 'npc', monsterType: 'CONSTRUCT' })).toBe(true); // lower() gate
        expect(await isSleepImmune(campaignName, { name: 'Guard', type: 'npc', immunities: ['Exhaustion'] })).toBe(true); // cs pre-gate, capital matches
        expect(await isSleepImmune(campaignName, { name: 'Guard', type: 'npc', immunities: ['Magical Sleep'] })).toBe(true);
        expect(consulted).toEqual([]); // six rows short-circuit before any lookup

        // Exact-match gate: real disk type "humanoid (any race)" (the Bard row)
        // is NOT in ['undead','construct'] → falls through to the consult.
        expect(monsterRow('Bard').type).toBe('humanoid (any race)');
        expect(await isSleepImmune(campaignName, { name: 'Bard', type: 'npc', monsterType: 'humanoid (any race)' })).toBe(ciHas(monsterRow('Bard'), 'exhaustion'));

        // Consult path answers from disk: exhaustion-immune true, Thug false,
        // unknown name null-row false.
        expect(await isSleepImmune(campaignName, { name: 'Adult Blue Dracolich', type: 'npc' })).toBe(true);
        expect(await isSleepImmune(campaignName, { name: 'Thug 1', type: 'npc' })).toBe(false);
        expect(await isSleepImmune(campaignName, { name: 'Not A Monster', type: 'npc' })).toBe(false);

        // Disk carries TWO immunity key shapes: Dracolich uses condition_immunities,
        // Zombie/Iron Golem use a plain `immunities` key — the monster.immunities
        // fallback (:42) is the LIVE disk path, not dead code (no text divergence).
        expect(zombieRow.immunities.map(s => s.toLowerCase())).toContain('exhaustion');
        expect(await isSleepImmune(campaignName, { name: 'Zombie', type: 'npc' })).toBe(true);
        expect(await isSleepImmune(campaignName, null)).toBe(false);
        expect(consulted).toEqual(['Bard', 'Adult Blue Dracolich', 'Thug 1', 'Not A Monster', 'Zombie']);
        expect(reads).toHaveLength(0); // immunity gate is pure cs + disk, store-inert
    });

    it('isSleepImmune player face: Trance trait rides the EXACT computedStats identity into hasTranceTrait; computedStats/character-fallback immunities match case-insensitively; plain players and characters-list misses fall through false without ever consulting monsters.json (players never hit the bestiary lane)', async () => {
        const tranceStats = { name: PC, race: { traits: [{ name: 'Trance' }] } };
        hasTranceTrait.mockImplementation((stats) => stats === tranceStats);
        expect(await isSleepImmune(campaignName, { name: PC, type: 'player', immunities: [] }, [{ name: PC, computedStats: tranceStats }])).toBe(true);
        expect(hasTranceTrait.mock.calls).toEqual([[tranceStats]]); // identity arg

        hasTranceTrait.mockImplementation(() => false);
        expect(await isSleepImmune(campaignName, { name: PC, type: 'player', immunities: [] }, [{ name: PC, computedStats: { immunities: ['Magical Sleep'] } }])).toBe(true);
        expect(await isSleepImmune(campaignName, { name: PC, type: 'player', immunities: [] }, [{ name: PC, computedStats: { immunities: ['Exhaustion'] } }])).toBe(true);
        expect(await isSleepImmune(campaignName, { name: 'Hill', type: 'player', immunities: [] }, [{ name: 'Hill', immunities: ['exhaustion'] }])).toBe(true); // computedStats-less fallback identity

        expect(await isSleepImmune(campaignName, { name: PC, type: 'player', immunities: [] }, CHARS)).toBe(false);
        expect(await isSleepImmune(campaignName, { name: 'Ghost', type: 'player', immunities: [] }, [])).toBe(false); // name miss → not found → false
        expect(consulted).toEqual([]); // the player branch returns before getMonsterData
    });

    it('stageSleepTargets with NO options (live sleepHandler.js:191 shape) writes the byte-exact SPELL te disk-canonical to the 2024 row (WIS + concentration-derived duration, MA-0068 rounds default 10) per target in order, appends Incapacitated without clobbering pre-existing conditions, registers caster concentration at the real DC, and its single te write is the 4-arg broadcast (#1341)', async () => {
        // 2024 disk canaries: concentration:true, dc WIS — the shape service defaults mirror.
        expect(sleep2024.level).toBe(1);
        expect(sleep2024.school).toBe('Enchantment');
        expect(sleep2024.concentration).toBe(true);
        expect(sleep2024.duration).toBe('Concentration, up to 1 minute');
        expect(sleep2024.dc.dc_type).toBe('WIS');
        expect(sleep2024.automation.type).toBe('sleep');

        cs.creatures = [{ name: CASTER, type: 'player', concentration: null }]; // fresh caster, nothing concentrating
        store.campaign.targetEffects = [HEX]; // bystander ladder on T2 survives untouched
        store[T2] = { activeConditions: ['poisoned'] }; // survives the append
        const staged = await stageSleepTargets(campaignName, CASTER, [T1, T2], DC);

        expect(staged).toEqual([T1, T2]);
        expect(store[T1].activeConditions).toEqual(['incapacitated']);
        expect(store[T2].activeConditions).toEqual(['poisoned', 'incapacitated']);
        expect(store.campaign.targetEffects).toEqual([HEX, spellTe(), spellTe({ target: T2 })]);
        expect(Object.keys(store.campaign.targetEffects[1])).toEqual([
            'target', 'effect', 'source', 'condition', 'stage', 'dc', 'saveType', 'duration', 'label', 'logLabel', 'unconsciousRounds',
        ]);
        expect(tuples()).toEqual([
            [T1, 'activeConditions', ['incapacitated'], false], // applyCondition's explicit false (:126)
            [T2, 'activeConditions', ['poisoned', 'incapacitated'], false],
            ['campaign', 'targetEffects', [HEX, spellTe(), spellTe({ target: T2 })], undefined], // 4-arg → broadcasts
        ]);
        expect(reads).toEqual([
            ['campaign', 'targetEffects'],
            [T1, 'activeConditions'],
            [T2, 'activeConditions'],
        ]);
        expect(getCombatSummary).toHaveBeenCalledTimes(1);
        expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
        expect(addConcentration).toHaveBeenCalledTimes(1);
        expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, 'Sleep', DC); // same-object identity enforced by the fake
        expect(addConcentration.mock.calls[0][0]).toBe(cs);
        expect(storageCalls).toEqual([['combatSummary', cs]]);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
        expect(storage.set.mock.calls[0][1]).toBe(cs);
        expect(expirations).toHaveLength(0); // clocks register only at the escalation seam (breath lane pins both)
        expect(logs).toHaveLength(0); // staging itself is silent
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('concentration block is name-keyed on the literal "Sleep" only: already-concentrating-on-Sleep skips addConcentration + storage.set entirely (te write still commits, replacing the same-target BREATH te — the spell silently clobbers the dragon ladder, same effect+target takeover mechanism pinned by the breath twin at staged-breath.test.js:223/#1295); concentrating on anything else still registers; a cs without the caster is inert', async () => {
        store.campaign.targetEffects = [BREATH_BST, HEX];
        store[T2] = { activeConditions: ['slowed'] };
        cs.creatures = [{ name: CASTER, concentration: { spell: 'Sleep', dc: DC } }];

        const staged = await stageSleepTargets(campaignName, CASTER, [T1, T2], DC);

        expect(staged).toEqual([T1, T2]);
        expect(store.campaign.targetEffects).toEqual([spellTe(), HEX, spellTe({ target: T2 })]); // in-place replace at idx 0; CON/100-round shape gone, saveType+duration are the only discriminators (#1378)
        expect(addConcentration).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(tuples()).toEqual([
            [T1, 'activeConditions', ['incapacitated'], false],
            [T2, 'activeConditions', ['slowed', 'incapacitated'], false],
            ['campaign', 'targetEffects', [spellTe(), HEX, spellTe({ target: T2 })], undefined],
        ]);

        cs.creatures = [{ name: CASTER, concentration: { spell: 'Invisibility', dc: DC } }];
        const w0 = writes.length;
        await stageSleepTargets(campaignName, CASTER, [T1], DC);
        expect(addConcentration).toHaveBeenCalledTimes(1); // 'Sleep' literal check (:144) — rename-drift detector
        expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, 'Sleep', DC);
        expect(storageCalls).toEqual([['combatSummary', cs]]);
        expect(tuples(w0)).toEqual([
            [T1, 'activeConditions', ['incapacitated'], false],
            ['campaign', 'targetEffects', [spellTe(), HEX, spellTe({ target: T2 })], undefined],
        ]);

        cs.creatures = [];
        await stageSleepTargets(campaignName, CASTER, [T1], DC);
        expect(addConcentration).toHaveBeenCalledTimes(1); // cs-miss caster lookup is inert
        expect(storage.set).toHaveBeenCalledTimes(1);
    });

    it('applySleepTurnEnd sheds BEFORE it touches combat: no-te, already-unconscious, and second-element array-target te all return handled:false with zero writes/logs/prompts/clocks — exactly ONE store read each, no getCombatSummary consult, empty dice queue would THROW on any roll (#1345: te.target arrays are addressed only at [0])', async () => {
        const readCount = () => reads.length;
        const inert = () => {
            expect(writes).toHaveLength(0);
            expect(logs).toHaveLength(0);
            expect(expirations).toHaveLength(0);
            expect(getCombatSummary).not.toHaveBeenCalled();
        };

        expect(await applySleepTurnEnd(campaignName, T1)).toEqual({ handled: false });
        inert();
        expect(readCount()).toBe(1); // exactly one pool read per shed

        store.campaign.targetEffects = [spellTe({ stage: 'unconscious', condition: 'unconscious' })];
        expect(await applySleepTurnEnd(campaignName, T1)).toEqual({ handled: false });
        inert();
        expect(readCount()).toBe(2);

        store.campaign.targetEffects = [spellTe({ target: [T2, T1] }), HEX];
        expect(await applySleepTurnEnd(campaignName, T1)).toEqual({ handled: false });
        inert();
        expect(readCount()).toBe(3); // the strict lowercase stage gate itself (#197) is pinned by the breath twin :461 — byte not re-grown here; targetOf returns te.target[0] — element [1] is invisible to the ladder
        expect(reads).toEqual([
            ['campaign', 'targetEffects'],
            ['campaign', 'targetEffects'],
            ['campaign', 'targetEffects'],
        ]);
        expect(rolls).toEqual([]); // queue never consumed
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('NPC repeat-save success consumes saveBonuses.WIS (abbrev key, live cross-cite test-maintain-bugs.md:222 — a CON-consuming bug compiles 15 + (-2) = 13 < 16 and would falsely escalate), splices ONLY the spell te past bystanders, logs the exact em-dash success bytes with NO sourceName (asymmetry cited to the breath twin :395), never registers a clock, and propagates skipSync:true through the 5-arg write positions (dormant SSE-echo reservation — the live navigationHandlers caller omits options → false, audited in the breath lane)', async () => {
        cs.creatures = [
            { name: CASTER, type: 'player', concentration: { spell: 'Sleep', dc: DC } },
            { name: T1, type: 'npc', saveBonuses: { wis: 3, con: -2 } }, // distinct from the twin's {con:1, wis:9} (#1348)
        ];
        store.campaign.targetEffects = [spellTe(), HEX];
        store[T1] = { activeConditions: ['incapacitated'] };

        dice(15); // 15 + 3 = 18 ≥ DC 16 (a >-bug is the breath twin's tie leg)
        const result = await applySleepTurnEnd(campaignName, T1, { skipSync: true });

        expect(result).toEqual({ handled: true, success: true, roll: 15, total: 18 });
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [HEX], true],
            [T1, 'activeConditions', [], true], // ONE condition write — both shed
        ]);
        expect(reads).toEqual([
            ['campaign', 'targetEffects'],
            ['campaign', 'targetEffects'],
            [T1, 'activeConditions'],
        ]);
        expect(expirations).toHaveLength(0);
        expect(createSaveListener).not.toHaveBeenCalled(); // NPC auto-roll leg
        expect(rolls).toEqual([]);
        expect(logs).toEqual([
            {
                type: 'save_result', characterName: CASTER, rollType: 'save-sleep-repeat', targetName: T1,
                saveDc: DC, saveType: 'WIS', success: true, roll: 15, total: 18, saveBonus: 3,
                description: `${T1} succeeded on its repeat Wisdom save (DC ${DC}, rolled 15 + 3 = 18) — Sleep ends.`,
            },
            {
                type: 'condition', action: 'removed', characterName: T1, condition: 'Incapacitated',
                reason: 'Sleep spell ends (repeat save succeeded)', // no sourceName — :186-192 (cited breath :395)
            },
        ]);
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('wake face: damage 0 is read-INERT (:287 gate precedes the store); damage 3 wakes a stage-1 sleeper on the ternary FALSE branch (condition byte "Incapacitated" — the breath twin wakes only escalated "Unconscious" te); array te wakes ONLY its [0] element; post-wake re-hits are false; the dormant direct wakeSleepTarget ("shaken awake" reason — production shake strips te in sleepShakeHandler, kept as drift detector #1413) sheds a stage-2 te with zero condition writes; and the wake log catch fires the exact prefix with the identical Error while the strip commits', async () => {
        store.campaign.targetEffects = [spellTe(), HEX];
        store[T1] = { activeConditions: ['incapacitated'] };

        expect(wakeSleepOnDamage(campaignName, T1, 0)).toBe(false);
        expect(reads).toHaveLength(0); // zero-damage never reaches the pool
        expect(writes).toHaveLength(0);

        expect(wakeSleepOnDamage(campaignName, T1, 3)).toBe(true);
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [HEX], false],
            [T1, 'activeConditions', [], false], // unconscious removal is inert — ONE condition write
        ]);
        expect(logs.at(-1)).toEqual({
            type: 'condition', action: 'removed', characterName: T1, condition: 'Incapacitated',
            reason: 'Sleep ends (target took damage)', sourceName: CASTER, // hardcoded reason: te.label never appears here (mirrors breath :354)
        });
        expect(wakeSleepOnDamage(campaignName, T1, 1)).toBe(false); // already shed

        store.campaign.targetEffects = [spellTe({ target: [T2, T1], stage: 'unconscious', condition: 'unconscious' })];
        store[T2] = { activeConditions: ['unconscious'] };
        const w0 = writes.length, r0 = reads.length;
        expect(wakeSleepOnDamage(campaignName, T1, 9)).toBe(false); // element [1] invisible to targetOf
        expect(reads.length).toBe(r0 + 1);
        expect(writes.length).toBe(w0);
        expect(wakeSleepTarget(campaignName, T2, 'shaken awake')).toBe(true);
        expect(store.campaign.targetEffects).toEqual([]);
        expect(tuples(w0)).toEqual([
            ['campaign', 'targetEffects', [], false],
            [T2, 'activeConditions', [], false],
        ]);
        expect(logs.at(-1)).toEqual({
            type: 'condition', action: 'removed', characterName: T2, condition: 'Unconscious',
            reason: 'Sleep ends (shaken awake)', sourceName: CASTER,
        });

        // Log-failure leg: the wake-path catch (:281) is pinned nowhere else.
        store.campaign.targetEffects = [spellTe()];
        store[T1] = { activeConditions: ['incapacitated'] };
        const err = new Error('log-boom');
        addEntry.mockRejectedValueOnce(err);
        expect(wakeSleepOnDamage(campaignName, T1, 2)).toBe(true);
        await Promise.resolve(); // flush the settled-rejection .catch microtask (#1401 catches are async)
        expect(store.campaign.targetEffects).toEqual([]);
        expect(consoleSpy.mock.calls).toEqual([['[sleepService] Error logging sleep wake:', err]]);
        expect(consoleSpy.mock.calls[0][1]).toBe(err); // identical instance (#1385)
    });

    it('sleepStageSpec() (ZERO external importers — internal default producer kept as drift detector, rec #1413) returns the exact SP-107 spell default envelope in key order, and saveType coercion walks word→abbrev→WIS with garbage falling back to WIS while concentrate:false only ever rides the breath face (cited)', () => {
        expect(sleepStageSpec()).toEqual({
            concentrate: true, label: 'Sleep', logLabel: 'Sleep spell',
            unconsciousRounds: 10, saveType: 'WIS', duration: 'concentration',
        });
        expect(Object.keys(sleepStageSpec())).toEqual(['concentrate', 'label', 'logLabel', 'unconsciousRounds', 'saveType', 'duration']);
        expect(sleepStageSpec({ saveType: 'Wisdom' }).saveType).toBe('WIS'); // word→abbrev→upper live branch
        expect(sleepStageSpec({ saveType: 'garbage' }).saveType).toBe('WIS'); // :82 silent-default, both sides
        expect(sleepStageSpec({ saveType: 'WIS' })).toEqual(sleepStageSpec());
    });
});
