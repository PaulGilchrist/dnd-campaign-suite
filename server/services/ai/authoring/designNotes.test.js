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

import { loadNotes, clearNotes, savePendingPlan, setDesignerError } from './designNotes.js';

beforeEach(() => { state.stored = null; state.writes = 0; });

describe('loadNotes', () => {
    it('returns the blank shape (incl. pendingPlan/lastError) for a campaign with no notes', () => {
        expect(loadNotes('fresh')).toEqual({
            storySummary: null, messages: [], plans: [], pendingPlan: null, lastError: null,
        });
    });
});

describe('clearNotes', () => {
    it('blanks the whole ledger — the conversation reset lane (2026-11-07 DJ)', () => {
        state.stored = {
            storySummary: 'spine',
            messages: [{ role: 'gm', content: 'hi', at: 1 }],
            plans: [{ scope: 'arc', proposedAt: 2 }],
            pendingPlan: { scope: 'arc', savedAt: 3 },
            lastError: { stage: 'chat', error: 'boom', at: 4 },
        };
        const notes = clearNotes('c');
        const BLANK = { storySummary: null, messages: [], plans: [], pendingPlan: null, lastError: null };
        expect(notes).toEqual(BLANK);
        expect(state.stored).toEqual(BLANK); // the blank shape actually hit disk
        expect(state.writes).toBe(1);
        expect(loadNotes('c')).toEqual(BLANK); // and a re-read sees it
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

    // Freshness contract (backlog 2026-11-22, mirrors the NPC updatedAt
    // tripwire): an echoed savedAt must match the stored stamp or the write
    // is refused with a conflict and NOTHING hits disk.
    it('refuses with conflict and writes NOTHING when the echoed stamp differs from the stored stamp', () => {
        const first = savePendingPlan('c', { scope: 'arc', entityPlan: [{ kind: 'npc', count: 2 }] });
        const result = savePendingPlan(
            'c', { scope: 'arc', entityPlan: [{ kind: 'npc', count: 9 }] },
            { baseSavedAt: first.pendingPlan.savedAt - 1 });
        expect(result.conflict).toBe(true);
        expect(state.writes).toBe(1); // only the first save ever touched disk
        expect(loadNotes('c').pendingPlan.entityPlan[0].count).toBe(2); // newer bytes intact
    });

    it('accepts an echo matching the stored stamp and re-stamps the save', () => {
        const first = savePendingPlan('c', { scope: 'arc' });
        const second = savePendingPlan('c', { scope: 'session' }, { baseSavedAt: first.pendingPlan.savedAt });
        expect(second.conflict).toBeUndefined();
        expect(second.pendingPlan.scope).toBe('session');
        expect(state.writes).toBe(2);
    });

    it('no stored plan, or no echoed stamp, always succeeds (fresh editor + server-side lanes)', () => {
        // nothing stored yet — there is no newer save to be stale against
        const fresh = savePendingPlan('c', { scope: 'one_shot' }, { baseSavedAt: 123 });
        expect(fresh.conflict).toBeUndefined();
        // no echo at all: fresh never-loaded editor, or the /plan + generate
        // server lanes writing unconditionally
        const noEcho = savePendingPlan('c', { scope: 'arc' });
        expect(noEcho.conflict).toBeUndefined();
        expect(noEcho.pendingPlan.scope).toBe('arc');
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
