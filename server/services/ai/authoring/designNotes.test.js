// @maintained-by-ai
// designer-plan-state-volatile (backlog 2026-10-31) — the design-notes lanes
// that keep the PlanEditor lossless across view switches: pending-plan
// write/clear and last-error record/clear semantics (fs is stubbed in-memory).
import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ stored: null, writes: 0 }));

vi.mock('../../../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, file) => `${campaign}/${file}`,
    ensureDataDir: vi.fn(),
}));
vi.mock('./referential.js', () => ({ readJson: () => state.stored }));
vi.mock('fs', () => ({
    default: {
        writeFileSync: (_path, data) => {
            state.stored = JSON.parse(data);
            state.writes++;
        },
    },
}));

import { loadNotes, savePendingPlan, setDesignerError } from './designNotes.js';

beforeEach(() => { state.stored = null; state.writes = 0; });

describe('loadNotes', () => {
    it('returns the blank shape (incl. pendingPlan/lastError) for a campaign with no notes', () => {
        expect(loadNotes('fresh')).toEqual({
            storySummary: null, messages: [], plans: [], pendingPlan: null, lastError: null,
        });
    });
});

describe('savePendingPlan', () => {
    it('stores the GM-edited scope with a savedAt stamp', () => {
        const notes = savePendingPlan('c', { scope: 'one_shot', entityPlan: [{ kind: 'npc', count: 3 }] });
        expect(notes.pendingPlan).toMatchObject({ scope: 'one_shot', entityPlan: [{ kind: 'npc', count: 3 }] });
        expect(typeof notes.pendingPlan.savedAt).toBe('number');
    });

    it('null (or junk) clears the pending entry — the consumed/reset story', () => {
        savePendingPlan('c', { scope: 'arc' });
        expect(savePendingPlan('c', null).pendingPlan).toBeNull();
        savePendingPlan('c', { scope: 'arc' });
        expect(savePendingPlan('c', ['not', 'an', 'object']).pendingPlan).toBeNull();
    });

    it('leaves the message thread and plans[] untouched', () => {
        state.stored = { storySummary: 'spine', messages: [{ role: 'gm', content: 'hi', at: 1 }], plans: [{ scope: 'arc', proposedAt: 2 }] };
        const notes = savePendingPlan('c', { scope: 'session' });
        expect(notes.messages).toHaveLength(1);
        expect(notes.plans).toHaveLength(1);
        expect(notes.storySummary).toBe('spine');
    });
});

describe('setDesignerError', () => {
    it('records stage + bounded error text', () => {
        const notes = setDesignerError('c', 'generate', 'x'.repeat(3000));
        expect(notes.lastError.stage).toBe('generate');
        expect(notes.lastError.error).toHaveLength(2000);
        expect(typeof notes.lastError.at).toBe('number');
    });

    it('clears a stored error on success, and stays write-silent when there is nothing to clear', () => {
        setDesignerError('c', 'plan', 'boom');
        expect(setDesignerError('c', 'plan', null).lastError).toBeNull();
        const writesAfterClear = state.writes;
        setDesignerError('c', 'plan', null); // already clean → no disk churn
        expect(state.writes).toBe(writesAfterClear);
    });
});
