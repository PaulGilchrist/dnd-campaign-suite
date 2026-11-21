// Roadmap Step 8 — recap context compaction. loadLog is stubbed (the row
// source is routes/log.js's cache); the tests pin the priority law, tier
// clips, section order and the budget.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../routes/log.js', () => ({
    loadLog: vi.fn(() => []),
    activeSessionName: vi.fn(() => null),
}));

import { buildRecapTranscript, gatherSessionRows, RECAP_CHAR_BUDGET } from './recapContext.js';
import { loadLog } from '../../routes/log.js';

const row = (o) => ({ id: 'x', timestamp: Date.now(), session: 'Session 1', ...o });
const SEED = 'Session 1';

beforeEach(() => loadLog.mockReset());

describe('gatherSessionRows', () => {
    it('takes only rows stamped with the session name (null stamps never match)', () => {
        loadLog.mockReturnValue([
            row({ type: 'narrative', description: 'Mine.', session: SEED }),
            row({ type: 'narrative', description: 'Theirs.', session: 'Session 2' }),
            row({ type: 'narrative', description: 'Untracked.', session: null }),
        ]);
        const rows = gatherSessionRows('test-campaign', SEED);
        expect(rows.map(r => r.description)).toEqual(['Mine.']);
    });
});

describe('buildRecapTranscript — priority + compaction', () => {
    it('sections milestones before combat before roll noise, each row compacted', () => {
        loadLog.mockReturnValue([
            row({ type: 'roll', message: 'Goblin attacks', rollType: 'attack', characterName: 'Goblin', targetName: 'Rakan', hit: true, total: 17 }),
            row({ type: 'narrative', description: 'The cave mouth yawned.', characterName: 'GM' }),
            row({ type: 'hp_change', message: 'Rakan takes damage', targetName: 'Rakan', delta: -8 }),
        ]);
        const { totalRows, included, transcript } = buildRecapTranscript('test-campaign', SEED);
        expect({ totalRows, included }).toEqual({ totalRows: 3, included: 3 });
        expect(transcript.indexOf('STORY BEATS')).toBeLessThan(transcript.indexOf('ACTION BEATS'));
        expect(transcript.indexOf('ACTION BEATS')).toBeLessThan(transcript.indexOf('ROLL DETAIL'));
        expect(transcript).toContain('[narrative] The cave mouth yawned.');
        expect(transcript).toMatch(/\[hp_change\] Rakan takes damage — .*8 damage/);
        expect(transcript).toMatch(/\[roll\] Goblin attacks — Goblin → Rakan, hit/);
    });

    it('reads structured outcome fields the raw message lacks (damage/result/condition)', () => {
        loadLog.mockReturnValue([
            row({ type: 'roll', rollType: 'damage', name: 'Scimitar', targetName: 'ElderPaladin', finalDamage: 8 }),
            row({ type: 'death_save', characterName: 'Gimli', result: 'dead' }),
            row({ type: 'condition', action: 'applied', characterName: 'Rakan', condition: 'Prone' }),
        ]);
        const { transcript } = buildRecapTranscript('test-campaign', SEED);
        expect(transcript).toContain('8 damage');
        expect(transcript).toContain('dead');
        expect(transcript).toContain('Prone');
    });

    it('rows with neither text nor structured facts are skipped', () => {
        loadLog.mockReturnValue([row({ type: 'hp_change', currentHp: 12 })]);
        const { totalRows, included, transcript } = buildRecapTranscript('test-campaign', SEED);
        expect({ totalRows, included, transcript }).toEqual({ totalRows: 1, included: 0, transcript: '' });
    });

    it('clips narrative hard but generously and roll noise tightly', () => {
        const long = 'y'.repeat(500);
        loadLog.mockReturnValue([
            row({ type: 'narrative', description: long }),
            row({ type: 'roll', message: long, rollType: 'attack' }),
        ]);
        const { transcript } = buildRecapTranscript('test-campaign', SEED);
        expect(transcript.match(/\[narrative\] y+/)[0].length).toBeLessThanOrEqual('[narrative] '.length + 240);
        expect(transcript.match(/\[roll\] y+/)[0].length).toBeLessThanOrEqual('[roll] '.length + 90);
    });

    it('budget-guarded: when the room runs out the LOWEST tier loses rows first', () => {
        const filler = 'z'.repeat(120);
        const rows = [row({ type: 'narrative', description: 'The one true beat.' })];
        for (let i = 0; i < 200; i++) rows.push(row({ type: 'roll', message: `roll ${i} ${filler}`, rollType: 'attack' }));
        loadLog.mockReturnValue(rows);
        const { totalRows, included, transcript } = buildRecapTranscript('test-campaign', SEED, 600);
        expect(totalRows).toBe(201);
        expect(included).toBeLessThan(totalRows);
        expect(transcript).toContain('The one true beat.'); // milestone survived
        expect(transcript.length).toBeLessThan(750);        // lines ≤ budget, headers are the only overrun
        expect(transcript).toContain('roll 0 ');            // noise rows ride while room lasts
        expect(transcript).not.toContain('roll 199 ');      // the tail ran out of budget
    });

    it('respects the default budget constant', () => {
        expect(RECAP_CHAR_BUDGET).toBeGreaterThan(1000);
    });
});
