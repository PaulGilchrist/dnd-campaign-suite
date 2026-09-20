// MA-0610: repeatSaveService — the GENERIC turn-END repeat-save roller.
// Consumes a te descriptor `te.repeatSave = { saveType, dc, condition }`:
// at the end of the holder's turn (navigationHandlers turn-END seam) the
// Restrained whirlwind victim repeats the STR DC 17 save (NPC inline / PC
// prompt); success strips te + Restrained on itself, a fail keeps both.
// Frightful Presence / legacy repeat_save (no descriptor object, no `effect`)
// never route here — FP stays on its own trackFrightfulPresence leg.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];
const prompts = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`] ?? null,
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_c, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: () => runtimeStore.__cs__ || { creatures: [] },
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: (_c, cfg) => {
        prompts.push(cfg);
        const success = runtimeStore.__pcSaveSuccess__ === true;
        return { promise: Promise.resolve({ roll: success ? 20 : 1, saveBonus: 0, success }) };
    },
}));

import { applyRepeatSaveTurnEnd, grantRepeatSaveEffect } from './repeatSaveService.js';

const CAMPAIGN = 'test-campaign';
const DJINNI = 'Djinni 1';
const BANDIT = 'Bandit 1';

function whirlwindTe(descriptor = {}) {
    runtimeStore['campaign.targetEffects'] = [{
        target: BANDIT,
        effect: 'whirlwind',
        source: DJINNI,
        duration: 'until_end_of_zone',
        dc: 17,
        repeatSave: { saveType: 'Strength', dc: 17, condition: 'restrained' },
        ...descriptor,
    }];
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    prompts.length = 0;
});

describe('applyRepeatSaveTurnEnd', () => {
    it('rolls the inline STR save for an NPC Restrained holder (deterministic high roll)', async () => {
        whirlwindTe();
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        runtimeStore.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 20 } }] };
        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);
        expect(out.handled).toBe(true);
        expect(out.results[0].success).toBe(true);
        const save = addEntryLogs.find(e => e.type === 'save_result');
        expect(save).toBeTruthy();
        expect(save.rollType).toBe('save-repeat');
        expect(save.saveDc).toBe(17);
        expect(save.success).toBe(true);
    });

    it('success strips the te + Restrained condition (ends the effect on itself)', async () => {
        whirlwindTe();
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        runtimeStore.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 20 } }] };
        await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);
        expect((runtimeStore['campaign.targetEffects'] || []).some(te => te.effect === 'whirlwind' && te.target === BANDIT)).toBe(false);
        expect(runtimeStore[`${BANDIT}.activeConditions`]).toEqual([]);
        const cond = addEntryLogs.find(e => e.type === 'condition' && e.action === 'removed');
        expect(cond).toBeTruthy();
        expect(cond.condition).toBe('Restrained');
    });

    it('failure keeps te + Restrained (repeat save still owed next turn)', async () => {
        whirlwindTe();
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        runtimeStore.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 0 } }] };
        const rnd = vi.spyOn(Math, 'random').mockReturnValue(0); // nat 1 → total 1 < DC 17
        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);
        rnd.mockRestore();
        expect(out.handled).toBe(true);
        expect(out.results[0].success).toBe(false);
        expect((runtimeStore['campaign.targetEffects'] || []).some(te => te.effect === 'whirlwind' && te.target === BANDIT)).toBe(true);
        expect(runtimeStore[`${BANDIT}.activeConditions`]).toEqual(['restrained']);
    });

    it('skips a zone holder WITHOUT the gated condition (saved inside the whirlwind)', async () => {
        whirlwindTe();
        runtimeStore[`${BANDIT}.activeConditions`] = [];
        runtimeStore.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 0 } }] };
        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);
        expect(out.handled).toBe(true);
        expect(out.results.length).toBe(0);
        expect(prompts.length).toBe(0);
    });

    it('is inert for te without a repeat_save descriptor (MA-0042 zone rows byte-unchanged)', async () => {
        runtimeStore['campaign.targetEffects'] = [{ target: BANDIT, effect: 'lair_insect_cloud', source: DJINNI, repeatTurnEnd: true }];
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);
        expect(out.handled).toBe(false);
        expect(addEntryLogs.length).toBe(0);
    });

    it('is inert when the te repeat_save is a boolean flag (legacy FP/soul-tome shape)', async () => {
        runtimeStore['campaign.targetEffects'] = [{ target: BANDIT, effect: 'lair_sand_cloud', source: DJINNI, repeatSave: true, dc: 15 }];
        runtimeStore[`${BANDIT}.activeConditions`] = ['blinded'];
        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);
        expect(out.handled).toBe(false);
    });

    it('PC holder gets a queued save-listener prompt (dc_success none — never damage)', async () => {
        const PC = 'AasimarTest';
        runtimeStore['campaign.targetEffects'] = [{ target: PC, effect: 'whirlwind', source: DJINNI, dc: 17, repeatSave: { saveType: 'Strength', dc: 17, condition: 'restrained' } }];
        runtimeStore[`${PC}.activeConditions`] = ['restrained'];
        runtimeStore.__cs__ = { creatures: [{ name: PC, type: 'player' }] };
        runtimeStore.__pcSaveSuccess__ = true;
        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, PC);
        expect(prompts.length).toBe(1);
        expect(prompts[0].saveDc).toBe(17);
        expect(prompts[0].dcSuccess).toBe('none');
        expect(out.results[0].success).toBe(true);
        expect((runtimeStore['campaign.targetEffects'] || []).some(te => te.target === PC)).toBe(false);
    });

    it('logs zero-damage on a successful repeat save (dc_success:none pays nothing)', async () => {
        whirlwindTe();
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        runtimeStore.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 20 }, currentHp: 500, maxHp: 500 }] };
        await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);
        expect(addEntryLogs.some(e => e.type === 'hp_change')).toBe(false);
        expect(addEntryLogs.some(e => /damage/i.test(String(e.rollType || '')))).toBe(false);
    });
});

describe('grantRepeatSaveEffect (generic MA-0048 arm)', () => {
    it('arms a te with the repeat_save descriptor + logs when the row names an effect', async () => {
        await grantRepeatSaveEffect({
            campaignName: CAMPAIGN,
            attackerName: DJINNI,
            targetName: BANDIT,
            repeatSave: { effect: 'whirlwind', save_type: 'Strength', dc: 17, condition: 'Restrained' },
            saveDc: 17,
            saveType: 'str',
        });
        const te = (runtimeStore['campaign.targetEffects'] || []).find(t => t.effect === 'whirlwind' && t.target === BANDIT);
        expect(te).toBeTruthy();
        expect(te.repeatSave).toEqual({ saveType: 'Strength', dc: 17, condition: 'restrained' });
        expect(addEntryLogs.some(e => e.automationType === 'whirlwind_repeat_save_armed')).toBe(true);
    });

    it('no-ops without an effect key (legacy FP descriptor never arms a generic te)', async () => {
        await grantRepeatSaveEffect({
            campaignName: CAMPAIGN,
            attackerName: DJINNI,
            targetName: BANDIT,
            repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 },
            saveDc: 18,
            saveType: 'wis',
        });
        expect(runtimeStore['campaign.targetEffects']).toBeFalsy();
    });
});
