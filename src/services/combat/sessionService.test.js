// @maintained-by-ai
// sessionService contract owner: session phase state machine over the campaign
// runtime key `sessionState` (exploration | encounter | travel | roleplay).
// Phases move ONLY on action — never wall-clock. Consumers (initiative tracker,
// travel management, auto-encounter, referee console) assert their own wiring in
// their own lanes; this file pins the service contract itself:
//   - read: unset/garbage ⇒ 'exploration', readers never write, campaign pinned
//   - move: exact stored bytes + one session_phase audit entry, campaign pinned
//   - same phase ⇒ zero writes/logs (idempotent); guards ⇒ full-zero, exact refusal
//   - audit-log failure never aborts the phase move
import { readSessionPhase, setSessionPhase } from './sessionService.js';

// Faithful keyed mock: campaign is part of the key, so a dropped campaignName
// argument fails loudly instead of silently sharing state.
const store = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((who, key, campaign) => store[`${campaign}::${who}::${key}`] ?? null),
    setRuntimeValue: vi.fn(async (who, key, value, campaign) => { store[`${campaign}::${who}::${key}`] = value; }),
}));
const logs = [];
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async (c, e) => { logs.push(e); }) }));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const KEY = 'test-campaign::campaign::sessionState';

beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    logs.length = 0;
    vi.mocked(getRuntimeValue).mockClear();
    vi.mocked(setRuntimeValue).mockClear();
    vi.mocked(addEntry).mockClear();
});

describe('readSessionPhase', () => {
    it('unset or garbage phase ⇒ exploration, campaign pinned, readers write nothing', () => {
        expect(readSessionPhase('test-campaign')).toBe('exploration');
        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'sessionState', 'test-campaign');

        store[KEY] = { phase: 'dnd-movie' };
        expect(readSessionPhase('test-campaign')).toBe('exploration');

        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('setSessionPhase', () => {
    it('moves exploration → encounter: exact stored bytes, campaign pinned, one audit entry with exact description', async () => {
        const r = await setSessionPhase({ campaignName: 'test-campaign', phase: 'encounter', changedBy: 'initiative tracker', reason: 'initiative recorded for Goblin 1' });

        expect(r).toEqual({ moved: true, phase: 'encounter' });
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'sessionState', {
            phase: 'encounter',
            changedBy: 'initiative tracker',
            changedAt: expect.any(Number),
        }, 'test-campaign');
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject({
            type: 'session_phase',
            phase: 'encounter',
            previousPhase: 'exploration',
            changedBy: 'initiative tracker',
            description: 'Session phase: exploration → encounter (initiative recorded for Goblin 1) — initiative tracker.',
        });
    });

    it('same phase ⇒ not moved, zero writes, zero logs', async () => {
        await setSessionPhase({ campaignName: 'test-campaign', phase: 'encounter', changedBy: 'initiative tracker' });
        vi.mocked(setRuntimeValue).mockClear();

        const r = await setSessionPhase({ campaignName: 'test-campaign', phase: 'encounter', changedBy: 'initiative tracker' });

        expect(r).toEqual({ moved: false, phase: 'encounter' });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logs).toHaveLength(1); // still only the first move's entry
    });

    it('guards refuse with exact reason and full-zero side effects', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});

        // no campaign ⇒ default phase, nothing consulted for writes
        const noCampaign = await setSessionPhase({ campaignName: null, phase: 'travel' });
        expect(noCampaign).toEqual({ moved: false, phase: 'exploration', reason: 'no campaign' });

        // invalid phase echoes the CURRENT phase (not the default), errors loudly
        store[KEY] = { phase: 'encounter', changedBy: 'referee', changedAt: 1 };
        const invalid = await setSessionPhase({ campaignName: 'test-campaign', phase: 'ruling-by-vibes' });
        expect(invalid).toEqual({ moved: false, phase: 'encounter', reason: 'invalid phase' });
        expect(err).toHaveBeenCalledTimes(1);
        expect(err).toHaveBeenCalledWith(expect.stringContaining('"ruling-by-vibes"'));

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logs).toHaveLength(0);
        expect(store[KEY]).toEqual({ phase: 'encounter', changedBy: 'referee', changedAt: 1 });
        err.mockRestore();
    });

    it('audit-log failure never aborts the move: phase still stored, failure logged', async () => {
        vi.mocked(addEntry).mockRejectedValueOnce(new Error('log down'));
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});

        const r = await setSessionPhase({ campaignName: 'test-campaign', phase: 'travel', changedBy: 'travel management' });

        expect(r).toEqual({ moved: true, phase: 'travel' });
        expect(store[KEY]).toMatchObject({ phase: 'travel', changedBy: 'travel management' });
        expect(err).toHaveBeenCalledWith('[sessionService] phase log failed:', expect.any(Error));
        err.mockRestore();
    });

    it('all four phases round-trip through the store with default changedBy referee', async () => {
        for (const phase of ['encounter', 'travel', 'roleplay', 'exploration']) {
            const r = await setSessionPhase({ campaignName: 'test-campaign', phase });
            expect(r).toEqual({ moved: true, phase });
            expect(readSessionPhase('test-campaign')).toBe(phase);
            expect(store[KEY].changedBy).toBe('referee');
        }
    });
});
