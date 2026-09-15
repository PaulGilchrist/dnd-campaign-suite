import { describe, it, expect, vi, beforeEach } from 'vitest';

// MA-0048: Adult Blue Dracolich Frightful Presence residuals —
// turn-end repeat save (success ends + 24h immunity) and the failure leg
// (remains Frightened, 10-round clock ends effect + grants immunity).

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

import { applyFrightfulPresenceTurnEnd, trackFrightfulPresence, grantFrightfulPresenceImmunity, FP_TE_EFFECT, FP_IMMUNITY_TE_EFFECT } from './frightfulPresenceService.js';

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Adult Blue Dracolich 1';
const TARGET = 'ElderPaladin';

function armFpTe(te) {
    runtimeStore[`campaign.targetEffects`] = [{
        target: TARGET, effect: FP_TE_EFFECT, source: ATTACKER,
        condition: 'frightened', saveType: 'Wisdom', dc: 18, duration: '1_minute', ...te,
    }];
}

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
    logs.length = 0;
    expirations.length = 0;
    registered.length = 0;
    listenerOpts.length = 0;
    csCreatures = [];
    nextSaveSuccess = true;
});

describe('trackFrightfulPresence (MA-0048)', () => {
    it('writes te marker with dc + merged 10-round clock stripping condition + te + granting immunity', async () => {
        await trackFrightfulPresence({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveType: 'Wisdom', saveDc: 18 });
        expect(registered).toEqual([expect.objectContaining({
            targetName: TARGET, effectKey: FP_TE_EFFECT, source: ATTACKER, dc: 18, saveType: 'Wisdom',
        })]);
        expect(expirations).toHaveLength(1);
        expect(expirations[0].rounds).toBe(10);
        const types = expirations[0].effects.map(e => e.type);
        expect(types).toEqual(expect.arrayContaining(['remove_target_effect', 'condition', 'frightful_presence_immunity_grant']));
        expect(logs.some(l => l.automationType === 'frightful_presence_tracked')).toBe(true);
    });
});

describe('applyFrightfulPresenceTurnEnd (MA-0048)', () => {
    it('no te → unhandled, zero writes/logs', async () => {
        const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET);
        expect(res).toEqual({ handled: false });
        expect(logs).toHaveLength(0);
    });

    it('PC repeat save: success sheds Frightened, strips te, grants 24h immunity te (14400 rounds)', async () => {
        csCreatures = [{ name: TARGET, type: 'player' }];
        armFpTe();
        runtimeStore[`${TARGET}.activeConditions`] = ['frightened'];
        nextSaveSuccess = true;

        const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET);
        expect(res.handled).toBe(true);
        expect(res.success).toBe(true);
        expect(listenerOpts[0]).toMatchObject({ targetName: TARGET, saveType: 'WIS', saveDc: 18, dcSuccess: 'none' });
        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual([]);
        expect(runtimeStore['campaign.targetEffects']).toEqual([]);
        expect(registered).toEqual([expect.objectContaining({
            targetName: TARGET, effectKey: FP_IMMUNITY_TE_EFFECT, source: ATTACKER, duration: '24_hours', rounds: 14400,
        })]);
        expect(expirations).toEqual([expect.objectContaining({ rounds: 14400 })]);
        expect(logs.some(l => l.rollType === 'save-fp-repeat' && l.success === true)).toBe(true);
        expect(logs.some(l => l.action === 'removed' && l.condition === 'Frightened')).toBe(true);
        expect(logs.some(l => l.automationType === 'frightful_presence_immunity_granted')).toBe(true);
    });

    it('failed repeat save: Frightened stays, te stays, no immunity', async () => {
        csCreatures = [{ name: TARGET, type: 'npc', saveBonuses: { wis: 0 } }];
        armFpTe();
        runtimeStore[`${TARGET}.activeConditions`] = ['frightened'];
        vi.spyOn(Math, 'random').mockReturnValue(0); // roll 1 → fail DC 18

        const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET);
        expect(res.handled).toBe(true);
        expect(res.success).toBe(false);
        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['frightened']);
        expect(runtimeStore['campaign.targetEffects']).toHaveLength(1);
        expect(registered).toHaveLength(0);
        expect(expirations).toHaveLength(0);
        expect(logs.some(l => l.rollType === 'save-fp-repeat' && l.success === false)).toBe(true);
        vi.restoreAllMocks();
    });

    it('NPC repeat save auto-rolls with cs saveBonuses (success ends effect)', async () => {
        csCreatures = [{ name: 'Thug 1', type: 'npc', saveBonuses: { wis: 5 } }];
        runtimeStore['campaign.targetEffects'] = [{ target: 'Thug 1', effect: FP_TE_EFFECT, source: ATTACKER, dc: 18, saveType: 'Wisdom' }];
        runtimeStore['Thug 1.activeConditions'] = ['frightened'];
        vi.spyOn(Math, 'random').mockReturnValue(0.99); // roll 20 → 25 ≥ 18

        const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, 'Thug 1');
        expect(res.success).toBe(true);
        expect(res.total).toBe(25);
        expect(runtimeStore['Thug 1.activeConditions']).toEqual([]);
        expect(registered[0]).toMatchObject({ targetName: 'Thug 1', effectKey: FP_IMMUNITY_TE_EFFECT, rounds: 14400 });
        vi.restoreAllMocks();
    });
});

describe('MA-0147 Adult White Dragon FP — CHA row engages the MA-0048 service', () => {
    const WHITE = 'Adult White Dragon 1';

    it('authored row shape arms trackFrightfulPresence with Charisma te + 10-round clock', async () => {
        const monsters = (await import('../../../../public/data/monsters.json')).default;
        const row = monsters.find(m => m.name === 'Adult White Dragon').legendary_actions.find(a => a.name === 'Frightful Presence');
        expect(row.repeat_save).toBeTruthy();
        expect(row.success_immunity?.effect).toBe(FP_IMMUNITY_TE_EFFECT);
        // saveProcessing:387 arms on context.repeatSave truthy (row.repeat_save forwarded)
        await trackFrightfulPresence({ campaignName: CAMPAIGN, attackerName: WHITE, targetName: TARGET, saveType: row.repeat_save.save_type, saveDc: row.save_dc });
        expect(registered[0]).toMatchObject({ targetName: TARGET, effectKey: FP_TE_EFFECT, source: WHITE, dc: 14, saveType: 'Charisma' });
        expect(expirations[0].rounds).toBe(10);
    });

    it('turn-END repeat save with Charisma te: success strips te + grants 24h immunity sourced from the dragon', async () => {
        csCreatures = [{ name: TARGET, type: 'player' }];
        armFpTe({ saveType: 'Charisma', dc: 14, source: WHITE });
        runtimeStore[`${TARGET}.activeConditions`] = ['frightened'];
        nextSaveSuccess = true;

        const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET);
        expect(res.handled).toBe(true);
        expect(res.success).toBe(true);
        expect(runtimeStore['campaign.targetEffects']).toEqual([]);
        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual([]);
        expect(registered).toEqual([expect.objectContaining({ targetName: TARGET, effectKey: FP_IMMUNITY_TE_EFFECT, source: WHITE, rounds: 14400 })]);
        expect(logs.some(l => l.rollType === 'save-fp-repeat' && l.success === true)).toBe(true);
    });
});

describe('grantFrightfulPresenceImmunity (MA-0048)', () => {
    it('writes 24h te (14400 rounds, CLA-334 minutes×10) + clock + granted log', async () => {
        await grantFrightfulPresenceImmunity({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, reason: 'test' });
        expect(registered).toEqual([expect.objectContaining({ effectKey: FP_IMMUNITY_TE_EFFECT, rounds: 14400, duration: '24_hours' })]);
        expect(expirations).toEqual([expect.objectContaining({ rounds: 14400 })]);
        expect(logs.some(l => l.automationType === 'frightful_presence_immunity_granted' && l.description.includes('14400'))).toBe(true);
    });
});
