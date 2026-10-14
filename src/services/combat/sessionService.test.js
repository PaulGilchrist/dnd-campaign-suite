// P4-a (§10.1): session state machine — action-driven phase moves, same-phase
// silence, invalid-phase refusal, unset ⇒ exploration default (byte parity).
import { readSessionPhase, setSessionPhase } from './sessionService.js';

const store = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((who, key) => store[`${who}::${key}`] ?? null),
    setRuntimeValue: vi.fn(async (who, key, value) => { store[`${who}::${key}`] = value; }),
}));
const logs = [];
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async (c, e) => { logs.push(e); }) }));

import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    logs.length = 0;
    vi.mocked(setRuntimeValue).mockClear();
});

describe('readSessionPhase (unset ⇒ today\'s truth)', () => {
    it('no sessionState key ⇒ exploration, zero writes', () => {
        expect(readSessionPhase('test-campaign')).toBe('exploration');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('garbage phase falls back to exploration (never trusts shape)', () => {
        store['campaign::sessionState'] = { phase: 'dnd-movie' };
        expect(readSessionPhase('test-campaign')).toBe('exploration');
    });
});

describe('setSessionPhase', () => {
    it('moves exploration → encounter with an audit entry naming the mover', async () => {
        const r = await setSessionPhase({ campaignName: 'test-campaign', phase: 'encounter', changedBy: 'initiative tracker', reason: 'initiative recorded for Goblin 1' });
        expect(r).toMatchObject({ moved: true, phase: 'encounter' });
        expect(store['campaign::sessionState']).toMatchObject({ phase: 'encounter', changedBy: 'initiative tracker' });
        expect(logs[0]).toMatchObject({ type: 'session_phase', phase: 'encounter', previousPhase: 'exploration' });
        expect(logs[0].description).toContain('initiative tracker');
    });

    it('same phase ⇒ zero writes, zero logs (no spam on repeat seams)', async () => {
        await setSessionPhase({ campaignName: 'test-campaign', phase: 'encounter', changedBy: 'initiative tracker' });
        vi.mocked(setRuntimeValue).mockClear();
        logs.length = 0;
        const r = await setSessionPhase({ campaignName: 'test-campaign', phase: 'encounter', changedBy: 'initiative tracker' });
        expect(r.moved).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logs).toHaveLength(0);
    });

    it('unknown phase refused loudly, store untouched', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = await setSessionPhase({ campaignName: 'test-campaign', phase: 'ruling-by-vibes' });
        expect(r.moved).toBe(false);
        expect(err).toHaveBeenCalled();
        expect(store['campaign::sessionState']).toBeUndefined();
        err.mockRestore();
    });

    it('no campaign ⇒ no write', async () => {
        const r = await setSessionPhase({ campaignName: null, phase: 'travel' });
        expect(r.moved).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('phases round-trip (each move differs from the current phase)', async () => {
        for (const phase of ['encounter', 'travel', 'roleplay', 'exploration']) {
            const r = await setSessionPhase({ campaignName: 'test-campaign', phase });
            expect(r.moved).toBe(true);
            expect(readSessionPhase('test-campaign')).toBe(phase);
        }
    });
});
