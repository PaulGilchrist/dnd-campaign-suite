// MA-0298: Soul Tome trap service — failed-save grant writes the INDEFINITE
// banished_demiplane te (soulTome flag, NO expiry clock) + Incapacitated +
// logs; the turn-END repeat save strips everything on success and keeps the
// trap on a fail (bound-at-3 advisory, GM-enforced — no counter consumer).
// MA-0104 regression: a banished_demiplane te WITHOUT the soulTome flag is
// never touched by this consumer.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = {};

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => store[`${name}.${key}`]),
    setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'Wild_Sage_Druid', type: 'player' }] })),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(() => ({ promptId: 'repeat-p1', promise: Promise.resolve({ roll: 19, saveBonus: -1, success: true }) })),
}));

// Campaign-level tes live under the 'campaign' store key (runtime-store
// convention: getRuntimeValue('campaign', 'targetEffects')) — same as the
// verified paralyzing/frightful service reads.
vi.mock('../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn((_campaignName, targetName, effectKey, source, extra) => {
        const tes = store['campaign.targetEffects'] || [];
        tes.push({ target: targetName, effect: effectKey, source, ...extra });
        store['campaign.targetEffects'] = tes;
    }),
    getActiveTargetEffect: vi.fn((_campaignName, targetName, effectKey) => {
        const tes = store['campaign.targetEffects'] || [];
        return tes.find(te => te.effect === effectKey && te.target === targetName) || null;
    }),
}));

import { addEntry } from '../../ui/logService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { grantSoulTomeTrap, applySoulTomeTrapTurnEnd } from './soulTomeTrapService.js';

const C = 'test-campaign';

function resetStore(conditions = []) {
    Object.keys(store).forEach(k => delete store[k]);
    store['Wild_Sage_Druid.activeConditions'] = [...conditions];
    store['campaign.targetEffects'] = [];
}

describe('MA-0298 grantSoulTomeTrap', () => {
    beforeEach(() => { resetStore(); vi.clearAllMocks(); });

    it('grants indefinite banished_demiplane te (soulTome flag, no clock) + Incapacitated + logs', async () => {
        await grantSoulTomeTrap({ campaignName: C, attackerName: 'Arcanaloth', targetName: 'Wild_Sage_Druid', saveDc: 17, saveType: 'cha', actionName: 'Banishing Claw (Requires Soul Tome)' });

        const te = (store['campaign.targetEffects'] || []).find(t => t.effect === 'banished_demiplane' && t.target === 'Wild_Sage_Druid');
        expect(te).toBeTruthy();
        expect(te.soulTome).toBe(true);
        expect(te.duration).toBe('indefinite_until_repeat_save');
        expect(te.rounds).toBeUndefined(); // INDEFINITE — no expiry clock
        expect(te.dc).toBe(17);
        expect(te.saveType).toBe('CHA');
        expect(store['Wild_Sage_Druid.activeConditions']).toContain('incapacitated');

        const grantedLog = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'banished_demiplane_granted');
        expect(grantedLog).toBeTruthy();
        expect(grantedLog.description).toMatch(/trapped in a demiplane inside the Soul Tome/i);
        expect(grantedLog.description).toMatch(/GM-enforced|no fail-counter consumer/i); // bound-at-3 documented

        const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog).toBeTruthy();
        expect(condLog.condition).toBe('Incapacitated');
    });

    it('does not duplicate the Incapacitated condition', async () => {
        resetStore(['incapacitated']);
        await grantSoulTomeTrap({ campaignName: C, attackerName: 'Arcanaloth', targetName: 'Wild_Sage_Druid', saveDc: 17, saveType: 'cha' });
        expect(store['Wild_Sage_Druid.activeConditions'].filter(c => c === 'incapacitated')).toHaveLength(1);
    });
});

describe('MA-0298 applySoulTomeTrapTurnEnd — MA-0048 repeat-save seam', () => {
    beforeEach(() => { resetStore(); vi.clearAllMocks(); });

    it('no trap te → handled:false (byte-inert)', async () => {
        const res = await applySoulTomeTrapTurnEnd(C, 'Wild_Sage_Druid');
        expect(res).toEqual({ handled: false });
        expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('MA-0104 te WITHOUT soulTome flag is never touched', async () => {
        store['campaign.targetEffects'] = [{ target: 'Wild_Sage_Druid', effect: 'banished_demiplane', source: 'Ancient Gold Dragon', duration: 'until_start_of_attacker_next_turn', rounds: 2 }];
        const res = await applySoulTomeTrapTurnEnd(C, 'Wild_Sage_Druid');
        expect(res.handled).toBe(false);
        expect(store['campaign.targetEffects']).toHaveLength(1);
    });

    it('repeat save SUCCESS strips te + Incapacitated + logs escape (placement GM-enforced)', async () => {
        await grantSoulTomeTrap({ campaignName: C, attackerName: 'Arcanaloth', targetName: 'Wild_Sage_Druid', saveDc: 17, saveType: 'cha' });
        vi.clearAllMocks();
        createSaveListener.mockReturnValue({ promptId: 'r1', promise: Promise.resolve({ roll: 19, saveBonus: -1, success: true }) });

        const res = await applySoulTomeTrapTurnEnd(C, 'Wild_Sage_Druid');
        expect(res.handled).toBe(true);
        expect(res.success).toBe(true);
        expect((store['campaign.targetEffects'] || []).find(t => t.effect === 'banished_demiplane')).toBeFalsy();
        expect(store['Wild_Sage_Druid.activeConditions']).not.toContain('incapacitated');
        const removeLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'removed');
        expect(removeLog?.condition).toBe('Incapacitated');
        const repeat = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-soul-tome-repeat');
        expect(repeat?.description).toMatch(/escapes the Soul Tome/i);
    });

    it('repeat save FAIL keeps te + Incapacitated + logs bound-at-3 advisory (GM-enforced)', async () => {
        await grantSoulTomeTrap({ campaignName: C, attackerName: 'Arcanaloth', targetName: 'Wild_Sage_Druid', saveDc: 17, saveType: 'cha' });
        vi.clearAllMocks();
        createSaveListener.mockReturnValue({ promptId: 'r2', promise: Promise.resolve({ roll: 3, saveBonus: -1, success: false }) });

        const res = await applySoulTomeTrapTurnEnd(C, 'Wild_Sage_Druid');
        expect(res.handled).toBe(true);
        expect(res.success).toBe(false);
        expect((store['campaign.targetEffects'] || []).find(t => t.effect === 'banished_demiplane' && t.soulTome === true)).toBeTruthy();
        expect(store['Wild_Sage_Druid.activeConditions']).toContain('incapacitated');
        const repeat = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-soul-tome-repeat');
        expect(repeat?.description).toMatch(/remains trapped/i);
        expect(repeat?.description).toMatch(/bound to the tome/i);
    });
});
