import { describe, it, expect, vi, beforeEach } from 'vitest';

// MA-0048: Frightful Presence effect-end (1-minute clock expiry) grants the
// 24h immunity te (14400 rounds, CLA-334 minutes×10 — no nested clock).

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
const DRACOLICH = 'Adult Blue Dracolich 1';
const TARGET = 'ElderPaladin';

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
    runtimeStore['campaign.targetEffects'] = [];
});

describe('MA-0048 frightful_presence_immunity_grant expiration type', () => {
    it('expiry grants 24h immunity te sourced from the dracolich + logs', () => {
        clearExpirationEffects(
            [{ type: 'frightful_presence_immunity_grant', immunityEffect: 'frightful_presence_immunity' }],
            TARGET, DRACOLICH, CAMPAIGN,
        );
        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toEqual([expect.objectContaining({
            target: TARGET, effect: 'frightful_presence_immunity', source: DRACOLICH, duration: '24_hours', rounds: 14400,
        })]);
        expect(logs.some(l => l.automationType === 'frightful_presence_immunity_granted' && l.description.includes('14400'))).toBe(true);
    });

    it('grants once per fire (merged same-day te, no dupe)', () => {
        clearExpirationEffects([{ type: 'frightful_presence_immunity_grant', immunityEffect: 'frightful_presence_immunity' }], TARGET, DRACOLICH, CAMPAIGN);
        clearExpirationEffects([{ type: 'frightful_presence_immunity_grant', immunityEffect: 'frightful_presence_immunity' }], TARGET, DRACOLICH, CAMPAIGN);
        const tes = (runtimeStore['campaign.targetEffects'] || []).filter(te => te.effect === 'frightful_presence_immunity');
        expect(tes).toHaveLength(1);
    });
});
