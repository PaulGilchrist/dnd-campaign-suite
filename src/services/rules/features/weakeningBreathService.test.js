// MA-0102: Adult Gold Dragon Weakening Breath residuals — failed-save grant
// (weakening_breath te + ONE merged 10-round auto-success clock + save_result
// + condition logs), and the turn-END repeat save: success strips the te,
// failure keeps it; the repeat rolls at Disadvantage (STR-based d20 test).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const logs = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_campaign, entry) => { logs.push(entry); return Promise.resolve(); },
}));

let csCreatures = [];
vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: () => ({ creatures: csCreatures }),
}));

let nextSaveSuccess = true;
const listenerOpts = [];
vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: (_campaign, opts) => {
        listenerOpts.push(opts);
        return { promise: Promise.resolve({ roll: 20, saveBonus: 5, total: 25, success: nextSaveSuccess }) };
    },
}));

const expirations = [];
vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: (entry) => { expirations.push(entry); },
}));

const registered = [];
vi.mock('../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: (_campaign, targetName, effectKey, source, extra = {}) => {
        registered.push({ targetName, effectKey, source, ...extra });
    },
    getActiveTargetEffect: () => null,
}));

import { grantWeakeningBreath, applyWeakeningBreathTurnEnd, WEAKENING_BREATH_TE } from './weakeningBreathService.js';

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Adult Gold Dragon 1';
const TARGET = 'EvasiveFighter';

function armWeakeningTe(te) {
    runtimeStore['campaign.targetEffects'] = [{
        target: TARGET, effect: WEAKENING_BREATH_TE, source: ATTACKER,
        saveType: 'Strength', dc: 21, strCheckDisadvantage: true, damageSubtractDie: '1d6', duration: '1_minute', rounds: 10, ...te,
    }];
}

let randomSpy;
beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
    logs.length = 0;
    registered.length = 0;
    expirations.length = 0;
    listenerOpts.length = 0;
    csCreatures = [];
    nextSaveSuccess = true;
    randomSpy?.mockRestore();
});

describe('MA-0102 grantWeakeningBreath', () => {
    it('failed save registers te + ONE merged 10-round clock + save_result + condition logs', async () => {
        await grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveType: 'Strength', saveDc: 21, roll: 4, saveBonus: 1 });
        const te = registered.find(r => r.effectKey === WEAKENING_BREATH_TE && r.targetName === TARGET);
        expect(te).toBeTruthy();
        expect(te.source).toBe(ATTACKER);
        expect(te.dc).toBe(21);
        expect(te.saveType).toBe('Strength');
        expect(te.strCheckDisadvantage).toBe(true);
        expect(te.damageSubtractDie).toBe('1d6');
        expect(te.rounds).toBe(10);
        expect(expirations).toHaveLength(1);
        expect(expirations[0].rounds).toBe(10);
        expect(expirations[0].effects[0].type).toBe('weakening_breath_auto_success');
        expect(logs.find(l => l.type === 'save_result' && l.rollType === 'save-weakening-breath' && l.success === false)).toBeTruthy();
        const cond = logs.find(l => l.type === 'condition' && l.action === 'applied' && l.condition === 'Weakened');
        expect(cond.description).toMatch(/Disadvantage on Strength-based d20 tests and subtracts 1d6/);
        expect(cond.description).toMatch(/auto-succeeds after 1 minute/);
    });

    it('zero inputs are inert (no te, no logs)', async () => {
        await grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveType: 'Strength', saveDc: null });
        expect(registered).toHaveLength(0);
        expect(logs).toHaveLength(0);
    });
});

describe('MA-0102 applyWeakeningBreathTurnEnd', () => {
    it('no te on the outgoing creature — inert', async () => {
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(r).toEqual({ handled: false });
        expect(logs).toHaveLength(0);
    });

    it('PC repeat save queues a DISADVANTAGE STR prompt; success strips the te + logs removal', async () => {
        armWeakeningTe();
        csCreatures = [{ name: TARGET, type: 'player' }];
        nextSaveSuccess = true;
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(listenerOpts).toHaveLength(1);
        expect(listenerOpts[0].saveType).toBe('STR');
        expect(listenerOpts[0].saveDc).toBe(21);
        expect(listenerOpts[0].disadvantage).toBe(true);
        expect(r.handled).toBe(true);
        expect(r.success).toBe(true);
        expect(runtimeStore['campaign.targetEffects'].find(te => te.effect === WEAKENING_BREATH_TE && te.target === TARGET)).toBeFalsy();
        expect(logs.find(l => l.rollType === 'save-weakening-repeat' && l.success === true)).toBeTruthy();
        expect(logs.find(l => l.type === 'condition' && l.action === 'removed' && l.condition === 'Weakened')).toBeTruthy();
    });

    it('NPC repeat save rolls twice keeping low (disadvantage); failure keeps the te', async () => {
        armWeakeningTe();
        csCreatures = [{ name: TARGET, type: 'npc', saveBonuses: { str: 1 } }];
        randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.5);
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(r.handled).toBe(true);
        expect(r.roll).toBe(11); // min(20, 11) + 1 = 12 < 21 → fail
        expect(r.success).toBe(false);
        expect(runtimeStore['campaign.targetEffects'].find(te => te.effect === WEAKENING_BREATH_TE && te.target === TARGET)).toBeTruthy();
        const result = logs.find(l => l.rollType === 'save-weakening-repeat');
        expect(result.success).toBe(false);
        expect(result.mode).toBe('disadvantage');
        expect(logs.find(l => l.type === 'condition' && l.action === 'removed')).toBeFalsy();
    });
});

// MA-0212: die is per-monster parsed — Ancient Gold clause subtracts 1d10.
describe('MA-0212 grantWeakeningBreath per-monster die', () => {
    it('die:"1d10" lands on te and condition log; Adult default stays byte-identical 1d6', async () => {
        await grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveType: 'Strength', saveDc: 24, roll: 2, saveBonus: 1, die: '1d10' });
        const te = registered.find(r => r.effectKey === WEAKENING_BREATH_TE && r.targetName === TARGET);
        expect(te.damageSubtractDie).toBe('1d10');
        const cond = logs.find(l => l.type === 'condition' && l.action === 'applied' && l.condition === 'Weakened');
        expect(cond.description).toMatch(/subtracts 1d10 from damage rolls/);
        // Adult default (no die arg) stays 1d6 (MA-0102 byte-lock)
        await grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: 'Other Target', saveType: 'Strength', saveDc: 21, roll: 4, saveBonus: 1 });
        const adultTe = registered.find(r => r.effectKey === WEAKENING_BREATH_TE && r.targetName === 'Other Target');
        expect(adultTe.damageSubtractDie).toBe('1d6');
    });

    it('ancient-gold-dragon data clause parses 1d10 (data lock)', async () => {
        const monsters = (await import('../../../../public/data/monsters.json')).default;
        const list = Array.isArray(monsters) ? monsters : Object.values(monsters);
        const gold = list.find(x => x.index === 'ancient-gold-dragon');
        expect(gold.actions.some(a => /subtracts 5 \(1d10\)/i.test(a.save_effect || ''))).toBe(true);
    });
});
