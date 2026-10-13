import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { chargeSlot, refundSlot, chargeMovement } from './chargeEconomy.js';
import { getTurnState } from './turnState.js';

const ON = { mode: 'on', actionEconomy: true, movementBudget: true };
const OFF = { mode: 'off' };

function store(map) {
    getRuntimeValue.mockImplementation((characterKey, key) => map[`${characterKey}.${key}`] ?? null);
}

beforeEach(() => vi.clearAllMocks());

describe('chargeSlot (L5-002)', () => {
    it('enforcement OFF ⇒ zero write, no-op', () => {
        store({ 'campaign.enforcement': OFF });
        expect(chargeSlot({ creatureName: 'Rakan', bucket: 'action', campaignName: 'test-campaign' })).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('enforcement ON but actionEconomy off ⇒ zero write', () => {
        store({ 'campaign.enforcement': { mode: 'on', actionEconomy: false } });
        expect(chargeSlot({ creatureName: 'Rakan', bucket: 'action', campaignName: 'test-campaign' })).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('charges the slot and persists via the campaign turnState key', () => {
        store({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        expect(chargeSlot({ creatureName: 'Rakan', bucket: 'action', campaignName: 'test-campaign' })).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'turnState', expect.objectContaining({
            Rakan: expect.objectContaining({ actionsUsed: 1 }),
        }), 'test-campaign');
    });

    it('free/special buckets succeed WITHOUT writing (never charge)', () => {
        store({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        expect(chargeSlot({ creatureName: 'Rakan', bucket: 'special', campaignName: 'test-campaign' })).toBe(true);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when the budget is already exhausted (double-click race backstop)', () => {
        store({
            'campaign.enforcement': ON,
            'campaign.turnState': { Rakan: { ...getTurnState({}, 'Rakan'), actionsUsed: 1 } },
        });
        expect(chargeSlot({ creatureName: 'Rakan', bucket: 'action', campaignName: 'test-campaign' })).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('missing campaign/creature ⇒ refusal', () => {
        store({ 'campaign.enforcement': ON });
        expect(chargeSlot({ creatureName: null, bucket: 'action', campaignName: 'test-campaign' })).toBe(false);
        expect(chargeSlot({ creatureName: 'Rakan', bucket: 'action', campaignName: null })).toBe(false);
    });
});

describe('refundSlot (L5-002)', () => {
    it('un-charges a spent slot (floors at zero)', () => {
        store({
            'campaign.enforcement': ON,
            'campaign.turnState': { Rakan: { ...getTurnState({}, 'Rakan'), actionsUsed: 1 } },
        });
        expect(refundSlot({ creatureName: 'Rakan', bucket: 'action', campaignName: 'test-campaign' })).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'turnState', expect.objectContaining({
            Rakan: expect.objectContaining({ actionsUsed: 0 }),
        }), 'test-campaign');
    });

    it('refund with nothing spent ⇒ false (no phantom credit)', () => {
        store({ 'campaign.enforcement': ON, 'campaign.turnState': { Rakan: getTurnState({}, 'Rakan') } });
        expect(refundSlot({ creatureName: 'Rakan', bucket: 'action', campaignName: 'test-campaign' })).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('chargeMovement (L5-002)', () => {
    it('enforcement OFF ⇒ zero feet, no write', () => {
        store({ 'campaign.enforcement': OFF });
        expect(chargeMovement({ creatureName: 'Rakan', feet: 10, campaignName: 'test-campaign' })).toBe(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('charges feet + marks hasMoved when movementBudget is on', () => {
        store({ 'campaign.enforcement': ON, 'campaign.turnState': {} });
        expect(chargeMovement({ creatureName: 'Rakan', feet: 15, campaignName: 'test-campaign' })).toBe(15);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'turnState', expect.objectContaining({
            Rakan: expect.objectContaining({ movementUsedFeet: 15, hasMoved: true }),
        }), 'test-campaign');
    });
});
