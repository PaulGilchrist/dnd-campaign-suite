import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getStore: vi.fn(() => ({ get: () => null })),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import { assertCanAct } from './assertCanAct.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getTurnState } from './turnState.js';

const ECONOMY_ON = { mode: 'on', turnLock: false, actionEconomy: true };

function store(map) {
    getRuntimeValue.mockImplementation((characterKey, key) => map[`${characterKey}.${key}`] ?? null);
}

beforeEach(() => vi.clearAllMocks());

describe('assertCanAct charge-on-allow (L5-002 §7.2)', () => {
    it('off ⇒ charge:true still writes nothing (L1–4 guarantee)', () => {
        store({ 'campaign.enforcement': { mode: 'off' } });
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action', charge: true });
        expect(r.allowed).toBe(true);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('on + actionEconomy + charge ⇒ allows AND charges the slot', () => {
        store({ 'campaign.enforcement': ECONOMY_ON, 'campaign.turnState': {} });
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action', charge: true });
        expect(r.allowed).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'turnState', expect.objectContaining({
            Rakan: expect.objectContaining({ actionsUsed: 1 }),
        }), 'test-campaign');
    });

    it('on + actionEconomy WITHOUT charge ⇒ allows but defers (no charge)', () => {
        store({ 'campaign.enforcement': ECONOMY_ON, 'campaign.turnState': {} });
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action' });
        expect(r.allowed).toBe(true);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('exhausted slot ⇒ denies even when the race let the gate read budget', () => {
        // turnState shows the slot already spent — the charge fails, so the
        // gate denies rather than overspending.
        store({
            'campaign.enforcement': ECONOMY_ON,
            'campaign.turnState': { Rakan: { ...getTurnState({}, 'Rakan'), actionsUsed: 1 } },
        });
        const popup = vi.fn();
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'action', charge: true, setPopupHtml: popup });
        expect(r.allowed).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('free bucket + charge ⇒ allowed, never charges', () => {
        store({ 'campaign.enforcement': ECONOMY_ON, 'campaign.turnState': {} });
        const r = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Rakan', bucket: 'free', charge: true });
        expect(r.allowed).toBe(true);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('bucketForAction → classifyBucket delegation (single taxonomy)', () => {
    it('recognises bonus/reaction/special lanes', async () => {
        const { bucketForAction } = await import('./assertCanAct.js');
        expect(bucketForAction({ automation: { action: 'bonus_action' } })).toBe('bonusAction');
        expect(bucketForAction({ automation: { casting_time: '1 reaction' } })).toBe('reaction');
        expect(bucketForAction({ type: 'Bonus Action' })).toBe('bonusAction');
        expect(bucketForAction({ name: 'Plain' })).toBe('action');
    });
});
