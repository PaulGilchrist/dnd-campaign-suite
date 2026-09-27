// MA-1352: ability-scoped ability_save_disadvantage te on the monster-card
// save-chip seam. processNpcSave is the auto-roll path for GM-pressed DC
// chips against NPC victims (live fingerprint: roll save stamps rolls:[d20],
// mode from context.forcedMode; pre-fix the chip path NEVER consulted te —
// mode pinned 'normal' even with an active rider). The seam must force
// Disadvantage (min(r1, r2) + mode 'disadvantage') ONLY for saves of the
// te's chosen ability; every other save type stays normal, and the te is
// NOT consumed (duration-anchored clock, playbook §38).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: () => ({ total: 5, rolls: [5], modifier: 0 }),
    rollD20: () => 1,
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: () => Promise.resolve(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Psychic Gray Ooze 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: async (_cs, _t, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const ATTACKER = 'Psychic Gray Ooze 1';
const TARGET = 'Bandit 1';

const te = (ability) => ([{
    target: TARGET,
    effect: 'ability_save_disadvantage',
    source: ATTACKER,
    duration: 'until_start_of_next_turn',
    ability,
}]);

// Fixed disk row context (Psychic Crush DC chip: DC 10 Intelligence, 3d8).
const crushContext = (saveType) => ({
    saveDc: 10,
    saveType,
    attackerName: ATTACKER,
    actionName: 'Psychic Crush',
    dcSuccess: 'half',
    autoDamageFormula: '3d8',
    autoDamageDamageType: 'Psychic',
    saveConditions: [],
    effectiveBonus: 0,
});

async function resolveNpcSave(saveType, r1, r2) {
    const logEntry = vi.fn();
    const result = await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: { ...crushContext(saveType), effectiveD20: r1 },
        bonus: 0,
        r1,
        r2,
        logEntry,
        setPopupHtml: vi.fn(),
    });
    return { result, logEntry };
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
});

describe('MA-1352 ability_save_disadvantage on the NPC save-chip seam', () => {
    it('INT save with active INT te: min(r1, r2) + mode disadvantage on the log', async () => {
        runtimeStore['campaign.targetEffects'] = te('int');
        const { result, logEntry } = await resolveNpcSave('INT', 15, 6);

        expect(result.effectiveD20ForSave).toBe(6);
        expect(logEntry.mock.calls[0][0]).toMatchObject({ type: 'roll', rollType: 'save', mode: 'disadvantage' });
        expect(runtimeStore['campaign.targetEffects']).toEqual(te('int'));
    });

    it('INT save where the lower die is first (r1 < r2): effective unchanged, still disadvantage', async () => {
        runtimeStore['campaign.targetEffects'] = te('int');
        const { result } = await resolveNpcSave('INT', 4, 17);

        expect(result.effectiveD20ForSave).toBe(4);
    });

    it('DEX save with active INT te: normal mode, r1 wins (other abilities unaffected)', async () => {
        runtimeStore['campaign.targetEffects'] = te('int');
        const { result, logEntry } = await resolveNpcSave('DEX', 15, 6);

        expect(result.effectiveD20ForSave).toBe(15);
        expect(logEntry.mock.calls[0][0].mode).toBe('normal');
    });

    it('WIS save with active INT te: normal mode', async () => {
        runtimeStore['campaign.targetEffects'] = te('int');
        const { result } = await resolveNpcSave('WIS', 15, 6);

        expect(result.effectiveD20ForSave).toBe(15);
    });

    it('no te in store: byte-inert, normal mode', async () => {
        const { result, logEntry } = await resolveNpcSave('INT', 15, 6);

        expect(result.effectiveD20ForSave).toBe(15);
        expect(logEntry.mock.calls[0][0].mode).toBe('normal');
    });

    it('te on a different creature: normal mode', async () => {
        runtimeStore['campaign.targetEffects'] = [{ ...te('int')[0], target: 'AasimarTest' }];
        const { result } = await resolveNpcSave('INT', 15, 6);

        expect(result.effectiveD20ForSave).toBe(15);
    });
});
