// @maintained-by-ai
// attackRiderHandler.buildRiderEffect REPEAT-SAVE DESCRIPTOR lane
// (bug-devious-strikes-poison-repeat-save-never-fires): options authored
// `repeatingSave: true` (Devious Strikes Poison/Knock Out, Cunning Strike
// Poison, Soulknife Rend Mind) advertise "repeats save at end of each turn"
// but previously stamped only the BOOLEAN — the generic turn-END roller
// (repeatSaveService.applyRepeatSaveTurnEnd) filters `te.repeatSave` OBJECTS,
// so the advertised repeat save never fired and the condition never ended on
// a success. This file pins (1) the exact descriptor bytes buildRiderEffect
// now emits, (2) eviction on save success, (3) inertness for non-repeating
// options, and (4) the live integration: the rider-shaped te, walked through
// the REAL applyRepeatSaveTurnEnd, rolls the repeat save at the holder's turn
// end and evicts te + condition on success. Mocking mirrors the sibling
// daze-expiry / repeatSaveService ledgers. Deterministic, no RNG.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { applyRiderOption } from './attackRiderHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

const CAMPAIGN = 'campaign';
const SAVE_DC = 15; // canonical live Devious Strikes DC (8 + DEX mod + PB)
const STAMP_MS = 1761000000000;

const store = {};
const logs = [];
const prompts = [];
const pcQueue = [];
const diceQueue = [];

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((owner, key) => {
        const k = `${owner}.${key}`;
        if (k in store) return store[k];
        if (key === 'targetEffects') return [];
        if (key === 'activeConditions') return [];
        return null;
    }),
    setRuntimeValue: vi.fn(async (owner, key, value) => {
        store[`${owner}.${key}`] = value;
    }),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn((campaignName, entry) => {
        logs.push(entry);
        return Promise.resolve();
    }),
}));

// buildSaveDc's real math is owned by savePrompt tests; here it stands in for
// the live-resolved ability DC the primary save already used.
vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => SAVE_DC),
    createSaveListener: vi.fn((campaignName, cfg) => {
        prompts.push(cfg);
        const next = pcQueue.shift();
        if (!next) throw new Error('repeat-save descriptor test: unstubbed save prompt resolution');
        return { promise: Promise.resolve(next) };
    }),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } }],
        round: 1,
        activeCreatureName: 'TestHero',
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/oncePerTurn.js', () => ({
    checkOncePerTurn: vi.fn().mockResolvedValue(null),
    checkOncePerTurnWithSkip: vi.fn().mockResolvedValue(null),
    markOncePerTurn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// repeatSaveService's cs read (integration leg only).
vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => store.__cs__),
}));

vi.mock('./massFearHandler.js', () => ({
    resolveMassFear: vi.fn(async () => ({ type: 'popup', payload: {} })),
}));

// ── Re-import after mocking ────────────────────────────────────

import { applyRepeatSaveTurnEnd } from '../../../rules/features/repeatSaveService.js';

// ── Fixtures (exact canonical 2024 Devious Strikes options) ────

const POISON_OPTION = {
    name: 'Poison',
    cost: '1d6',
    effect: 'poisoned',
    saveType: 'CON',
    saveDc: 'ability',
    saveAbility: 'DEX',
    condition: 'poisoned',
    duration: '1_minute',
    repeatingSave: true,
    requires: "Poisoner's Kit",
};

const KNOCK_OUT_OPTION = {
    name: 'Knock Out',
    cost: '6d6',
    effect: 'unconscious',
    saveType: 'CON',
    saveDc: 'ability',
    saveAbility: 'DEX',
    condition: 'unconscious',
    duration: '1_minute',
    repeatingSave: true,
};

const TRIP_OPTION = {
    name: 'Trip',
    cost: '1d6',
    effect: 'prone',
    saveType: 'DEX',
    saveDc: 'ability',
    saveAbility: 'DEX',
    condition: 'prone',
    sizeLimit: 'large_or_smaller',
};

function makeAction(option) {
    return {
        name: 'Devious Strikes',
        description: 'Apply a rider effect on a hit.',
        automation: { type: 'attack_rider', options: [option] },
    };
}

function makePlayerStats() {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Dexterity', bonus: 2 },
            { name: 'Constitution', bonus: 2 },
        ],
        toolProficiencies: [],
        inventory: { backpack: ["Poisoner's Kit"], equipped: [] },
        automation: { passives: [] },
    };
}

function installStore() {
    store['campaign.targetEffects'] = [];
    store['Goblin.activeConditions'] = [];
}

const FAILED = { success: false, roll: 5, total: 7, saveBonus: 2 };
const SUCCEEDED = { success: true, roll: 18, total: 20, saveBonus: 2 };

function poisonTe() {
    return store['campaign.targetEffects'].find(te => te.option === 'Poison');
}

let dice;
let nowSpy;
let consoleSpy;

beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    logs.length = 0;
    prompts.length = 0;
    pcQueue.length = 0;
    diceQueue.length = 0;
    installStore();
    dice = vi.spyOn(Math, 'random').mockImplementation(() => {
        const n = diceQueue.shift();
        if (n == null) throw new Error('repeat-save descriptor test: unstubbed d20 roll');
        return (n - 1) / 20;
    });
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(STAMP_MS);
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    dice.mockRestore();
    nowSpy.mockRestore();
    consoleSpy.mockRestore();
});

describe('attackRiderHandler — repeatingSave options stamp the turn-END consumer descriptor', () => {
    beforeEach(() => {
        pcQueue.push(FAILED); // rider's primary save FAILS (canonical -19 dial face)
    });

    it('Poison failed save stamps repeatSave OBJECT (saveType CON, resolved DC, lowercase condition) beside the authored boolean', async () => {
        await applyRiderOption(makeAction(POISON_OPTION), makePlayerStats(), CAMPAIGN, 'Goblin', ['Poison']);

        expect(store['Goblin.activeConditions']).toEqual(['poisoned']);
        expect(poisonTe().repeatingSave).toBe(true); // authored boolean kept
        expect(poisonTe().repeatSave).toEqual({ saveType: 'CON', dc: SAVE_DC, condition: 'poisoned' });
    });

    it('Knock Out failed save stamps the repeatSave OBJECT for unconscious (its copy says "repeats save at end of each turn")', async () => {
        pcQueue[0] = FAILED;
        await applyRiderOption(makeAction(KNOCK_OUT_OPTION), makePlayerStats(), CAMPAIGN, 'Goblin', ['Knock Out']);

        expect(store['Goblin.activeConditions']).toEqual(['unconscious']);
        const te = store['campaign.targetEffects'].find(t => t.option === 'Knock Out');
        expect(te.repeatSave).toEqual({ saveType: 'CON', dc: SAVE_DC, condition: 'unconscious' });
    });

    it('Trip (no repeatingSave) stamps no repeatSave key at all', async () => {
        pcQueue[0] = FAILED;
        await applyRiderOption(makeAction(TRIP_OPTION), makePlayerStats(), CAMPAIGN, 'Goblin', ['Trip']);

        const te = store['campaign.targetEffects'].find(t => t.option === 'Trip');
        expect(te.repeatingSave).toBe(false);
        expect('repeatSave' in te).toBe(false);
    });

    it('Poison save SUCCESS evicts the row — no descriptor residue to re-roll', async () => {
        pcQueue[0] = SUCCEEDED;
        await applyRiderOption(makeAction(POISON_OPTION), makePlayerStats(), CAMPAIGN, 'Goblin', ['Poison']);

        expect(store['campaign.targetEffects']).toEqual([]);
        expect(store['Goblin.activeConditions']).toEqual([]);
    });
});

describe('integration — rider-shaped te consumed by applyRepeatSaveTurnEnd at the holder turn-END', () => {
    it('repeat CON save success strips te + poisoned and logs the eviction', async () => {
        pcQueue.push(FAILED); // primary rider save fails → grant stands
        await applyRiderOption(makeAction(POISON_OPTION), makePlayerStats(), CAMPAIGN, 'Goblin', ['Poison']);
        expect(poisonTe().repeatSave).toBeTruthy();

        // Holder repeats the save on its own turn-END (NPC inline lane).
        store.__cs__ = { creatures: [{ name: 'Goblin', type: 'npc', saveBonuses: { con: 3 } }] };
        diceQueue.push(14); // 14 + 3 = 17 ≥ DC 15 → success

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, 'Goblin');

        expect(out).toEqual({ handled: true, results: [{ effect: 'poisoned', success: true, roll: 14, total: 17 }] });
        expect(store['campaign.targetEffects']).toEqual([]);
        expect(store['Goblin.activeConditions']).toEqual([]);
        const saveRow = logs.find(l => l.rollType === 'save-repeat');
        expect(saveRow).toMatchObject({ type: 'save_result', targetName: 'Goblin', saveDc: SAVE_DC, success: true });
        expect(saveRow.description).toContain('Goblin succeeded its repeat CON save (DC 15, rolled 14 + 3 = 17)');
        expect(logs.some(l => l.type === 'condition' && l.action === 'removed' && l.condition === 'Poisoned')).toBe(true);
    });

    it('repeat save FAIL keeps te + condition byte-identical (save still owed next turn)', async () => {
        pcQueue.push(FAILED);
        await applyRiderOption(makeAction(POISON_OPTION), makePlayerStats(), CAMPAIGN, 'Goblin', ['Poison']);
        const armedTe = poisonTe();
        logs.length = 0;

        store.__cs__ = { creatures: [{ name: 'Goblin', type: 'npc', saveBonuses: { con: 3 } }] };
        diceQueue.push(5); // 5 + 3 = 8 < DC 15 → fail

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, 'Goblin');

        expect(out).toEqual({ handled: true, results: [{ effect: 'poisoned', success: false, roll: 5, total: 8 }] });
        expect(store['campaign.targetEffects'][0]).toBe(armedTe); // survivor te identity untouched
        expect(store['Goblin.activeConditions']).toEqual(['poisoned']);
        expect(logs.length).toBe(1);
        expect(logs[0].description).toContain('failed its repeat CON save (DC 15');
    });
});
