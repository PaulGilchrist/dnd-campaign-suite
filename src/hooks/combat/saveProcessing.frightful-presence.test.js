// @maintained-by-ai: 2026-10-14
// MA-0048 frightful-presence-specific seam ONLY: the Adult Blue Dracolich
// "Frightful Presence" disk row (monsters.json, DC 18 WIS, dc_success none,
// legacy repeat_save with NO `effect` key) byte-builds the save context
// through extractConditionsFromSaveEffect and the FAILED-save player-prompt
// lane routes armRepeatSaveClause down the FP-specific trackFrightfulPresence
// leg — frightful_presence te + ONE merged 10-round clock (1 minute, CLA-334)
// that strips te + Frightened then grants the 24h immunity via the
// frightful_presence_immunity_grant clause, zero damage.
// Generic legs are owned elsewhere: fail/success condition grants —
// saveProcessing.failed-save-conditions.test.js; FP success face + refusal
// gate on disk rows — saveProcessing.ma1997-smaug-frightful-presence.test.js
// (+ ma2026-tiamat twin); immunity_grant expiry —
// services/rules/effects/clearExpirationEffects.frightful-presence.test.js;
// turn-END repeat-save consumer + row shape —
// services/rules/features/frightfulPresenceService.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const conditionLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 17, rolls: [5, 6, 6], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { conditionLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Adult Blue Dracolich 1' }),
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 224 }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const DRACOLICH = 'Adult Blue Dracolich 1';
const TARGET = 'ElderPaladin';
const FP_ROW = monstersData.find(m => m.index === 'adult-blue-dracolich').actions.find(a => a.name === 'Frightful Presence');

// Context byte-built from the DATA row itself — the modal forwards exactly
// these fields (buildAbilitySaveRollContext: save_dc/dc_success/
// success_immunity/repeat_save verbatim, saveConditions via the extractor),
// so the kept test locks row → FP-arm end to end.
const fpContext = () => ({
    saveDc: FP_ROW.save_dc,
    saveType: FP_ROW.save_type,
    attackerName: DRACOLICH,
    actionName: FP_ROW.name,
    dcSuccess: FP_ROW.dc_success,
    autoDamageFormula: null,
    saveConditions: extractConditionsFromSaveEffect(FP_ROW.save_effect),
    successImmunity: FP_ROW.success_immunity,
    repeatSave: FP_ROW.repeat_save,
});

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
});

describe('MA-0048 Frightful Presence adjudication', () => {
    it('failed save vs disk-row context (DC 18 WIS, fail-only fear, legacy repeat_save): grants Frightened, FP te + merged 10-round clock with 24h-immunity-grant leg armed, zero damage, no success-face immunity', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: TARGET, type: 'player' },
            characterName: TARGET,
            campaignName,
            context: fpContext(),
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: false, roll: 4, total: 4, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;

        // Row → context extraction lock (DC 18, fail-only fear, legacy FP
        // fork: repeat_save names NO te `effect` → trackFrightfulPresence).
        expect(fpContext()).toMatchObject({
            saveDc: 18,
            dcSuccess: 'none',
            saveConditions: ['frightened'],
            successImmunity: { effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 },
            repeatSave: { condition: 'frightened', save_type: 'Wisdom' },
        });
        expect(FP_ROW.repeat_save.effect).toBeUndefined();

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['frightened']);
        const applied = conditionLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(applied).toMatchObject({ characterName: TARGET, condition: 'Frightened', sourceName: DRACOLICH });

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toEqual([expect.objectContaining({
            target: TARGET, effect: 'frightful_presence', source: DRACOLICH,
            condition: 'frightened', saveType: 'Wisdom', dc: FP_ROW.save_dc, rounds: 10,
        })]);
        // ONE merged clock (CLA-334 1 minute = 10 rounds): strip te +
        // Frightened, then grant the 24h immunity ("or the effect ends").
        expect(addExpiration).toHaveBeenCalledTimes(1);
        const clock = addExpiration.mock.calls[0][0];
        expect(clock.rounds).toBe(10);
        expect(clock.effects).toEqual(expect.arrayContaining([
            { type: 'remove_target_effect', effectKey: 'frightful_presence', source: DRACOLICH, target: TARGET },
            { type: 'condition', condition: 'frightened' },
            { type: 'frightful_presence_immunity_grant', immunityEffect: 'frightful_presence_immunity' },
        ]));
        expect(conditionLogs.some(e => e.automationType === 'frightful_presence_tracked')).toBe(true);
        // success-immunity must NOT fire on the fail face
        expect(tes.some(te => te.effect === 'frightful_presence_immunity')).toBe(false);
        expect(conditionLogs.some(e => e.automationType === 'frightful_presence_immunity_granted')).toBe(false);

        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
