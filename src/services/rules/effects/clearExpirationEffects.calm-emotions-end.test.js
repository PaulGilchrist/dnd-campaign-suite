// @ai-generated
// SP-020 B5: Calm Emotions 1-minute duration clock expiry cleanup.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const logs = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
    setRuntimeObject: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_campaign, entry) => { logs.push(entry); return Promise.resolve(); },
}));

const combatSummaryRef = { cs: null };

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: () => combatSummaryRef.cs,
}));

// Keep the test focused on the expiration handler; restore runs in the real
// path and is pinned separately in the concentration suite.
const { restoreCalls } = vi.hoisted(() => ({ restoreCalls: [] }));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
    breakConcentration: vi.fn(),
    cleanupConcentrationEffects: vi.fn(),
    restoreSuppressedConditions: (effect, campaignName) => {
        restoreCalls.push({ effect, campaignName });
    },
}));

const storageWrites = [];
vi.mock('../../ui/storage.js', () => ({
    __esModule: true,
    default: {
        set: (key, value, campaign) => { storageWrites.push({ key, value, campaign }); },
    },
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'Divine_Cleric';

const calmImmunityTe = {
    target: 'Bandit 1',
    effect: 'calm_emotions',
    mode: 'immunity',
    source: CASTER,
    suppressedConditions: ['frightened'],
    dc: 17,
    duration: 'concentration',
};

const indifferentTe = {
    target: 'Bandit Captain 1',
    effect: 'indifferent',
    source: CASTER,
    dc: 17,
    duration: 'concentration',
};

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
    storageWrites.length = 0;
    runtimeStore['campaign.targetEffects'] = [];
    combatSummaryRef.cs = null;
    restoreCalls.length = 0;
});

describe('SP-020 B5 calm_emotions_end expiration type', () => {
    it('strips calm_emotions + indifferent tes from the caster, restores suppressed conditions, removes buffs', () => {
        runtimeStore['campaign.targetEffects'] = [
            calmImmunityTe,
            indifferentTe,
            { target: 'Other 1', effect: 'calm_emotions', source: 'RivalCaster', duration: 'concentration' },
        ];
        runtimeStore['Bandit 1.activeConditions'] = ['poisoned'];
        runtimeStore['Bandit 1.activeBuffs'] = [
            { name: 'Calm Emotions', effect: 'calm_emotions', sourceCharacter: CASTER },
            { name: 'Bless', sourceCharacter: 'Other' },
        ];
        combatSummaryRef.cs = { creatures: [{ name: CASTER, concentration: { spell: 'Calm Emotions' } }] };

        clearExpirationEffects([{ type: 'calm_emotions_end', source: CASTER }], CASTER, CASTER, CAMPAIGN);

        const tes = runtimeStore['campaign.targetEffects'];
        expect(tes).toEqual([expect.objectContaining({ target: 'Other 1', source: 'RivalCaster' })]);
        expect(restoreCalls.some(c => c.effect.target === 'Bandit 1' && c.effect.effect === 'calm_emotions')).toBe(true);
        expect(runtimeStore['Bandit 1.activeBuffs']).toEqual([expect.objectContaining({ name: 'Bless' })]);
        expect(combatSummaryRef.cs.creatures[0].concentration).toBeNull();
        expect(storageWrites.some(w => w.key === 'combatSummary')).toBe(true);
        expect(logs.some(l => l.automationType === 'calm_emotions_ended' && l.characterName === CASTER)).toBe(true);
    });

    it('is idempotent — no effects and no log when the te was already purged by concentration break', () => {
        runtimeStore['campaign.targetEffects'] = [];
        combatSummaryRef.cs = { creatures: [{ name: CASTER, concentration: null }] };

        clearExpirationEffects([{ type: 'calm_emotions_end', source: CASTER }], CASTER, CASTER, CAMPAIGN);

        expect(runtimeStore['campaign.targetEffects']).toEqual([]);
        expect(logs).toHaveLength(0);
    });

    it('leaves other sources’ calm_emotions untouched', () => {
        runtimeStore['campaign.targetEffects'] = [
            { target: 'Bandit 1', effect: 'calm_emotions', source: 'RivalCaster', duration: 'concentration', suppressedConditions: [] },
        ];

        clearExpirationEffects([{ type: 'calm_emotions_end', source: CASTER }], CASTER, CASTER, CAMPAIGN);

        expect(runtimeStore['campaign.targetEffects']).toHaveLength(1);
        expect(logs).toHaveLength(0);
    });

    it('clears caster concentration even when all targets saved (te already empty)', () => {
        runtimeStore['campaign.targetEffects'] = [];
        combatSummaryRef.cs = { creatures: [{ name: CASTER, concentration: { spell: 'Calm Emotions' } }] };

        clearExpirationEffects([{ type: 'calm_emotions_end', source: CASTER }], CASTER, CASTER, CAMPAIGN);

        expect(combatSummaryRef.cs.creatures[0].concentration).toBeNull();
        expect(storageWrites.some(w => w.key === 'combatSummary')).toBe(true);
    });
});
