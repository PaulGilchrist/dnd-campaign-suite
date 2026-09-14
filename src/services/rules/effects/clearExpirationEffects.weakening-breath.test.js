// MA-0102: Weakening Breath 1-minute clock expiry — RAW "After 1 minute, it
// succeeds automatically": the weakening_breath_auto_success expiration type
// strips the te from the target and logs the auto-success.
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

import { clearExpirationEffects } from './clearExpirationEffects.js';

const CAMPAIGN = 'test-campaign';
const GOLD = 'Adult Gold Dragon 1';
const TARGET = 'EvasiveFighter';

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
});

describe('MA-0102 weakening_breath_auto_success expiration type', () => {
    it('expiry strips the weakening_breath te and logs the auto-success', () => {
        runtimeStore['campaign.targetEffects'] = [
            { target: TARGET, effect: 'weakening_breath', source: GOLD, dc: 21, damageSubtractDie: '1d6' },
            { target: 'SomeoneElse', effect: 'weakening_breath', source: GOLD },
        ];
        clearExpirationEffects(
            [{ type: 'weakening_breath_auto_success', effectKey: 'weakening_breath' }],
            TARGET, GOLD, CAMPAIGN,
        );
        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes.find(te => te.target === TARGET && te.effect === 'weakening_breath')).toBeFalsy();
        expect(tes.find(te => te.target === 'SomeoneElse')).toBeTruthy();
        const log = logs.find(l => l.automationType === 'weakening_breath_auto_success');
        expect(log).toBeTruthy();
        expect(log.description).toMatch(/succeeds automatically/);
    });

    it('no te present → still logs, never throws', () => {
        runtimeStore['campaign.targetEffects'] = [];
        clearExpirationEffects(
            [{ type: 'weakening_breath_auto_success', effectKey: 'weakening_breath' }],
            TARGET, GOLD, CAMPAIGN,
        );
        expect(logs.some(l => l.automationType === 'weakening_breath_auto_success')).toBe(true);
    });
});
