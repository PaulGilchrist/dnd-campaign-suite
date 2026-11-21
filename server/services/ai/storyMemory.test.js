// Roadmap Step 9 — "Story so far" memory slice from the campaign log.
// buildStoryFromRows is pure (rows in, block out); buildStorySoFar's read
// seam (routes/log.js loadLog/activeSessionName) is stubbed so the test
// never touches disk.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../routes/log.js', () => ({
    loadLog: vi.fn(() => []),
    activeSessionName: vi.fn(() => null),
}));

import { buildStoryFromRows, buildStorySoFar, STORY_MAX_ROWS, STORY_CHAR_BUDGET } from './storyMemory.js';
import { loadLog, activeSessionName } from '../../routes/log.js';

const narrative = (text, extra = {}) => ({ type: 'narrative', description: text, characterName: 'GM', ...extra });

describe('buildStoryFromRows — row selection', () => {
    it('null for empty/missing input (fresh campaigns stay byte-identical)', () => {
        expect(buildStoryFromRows([], 'S1')).toBeNull();
        expect(buildStoryFromRows(undefined, null)).toBeNull();
        expect(buildStoryFromRows('not rows', null)).toBeNull();
    });

    it('takes narrative/note/encounter through getEntryText — all three text fields', () => {
        const story = buildStoryFromRows([
            narrative('The moon over Bravor bled red.'),
            { type: 'note', noteText: 'GM note: the lighthouse keeper lies' },
            { type: 'encounter', message: 'Ambush at the crossroads!' },
        ], null);
        expect(story).toContain('The moon over Bravor bled red.');
        expect(story).toContain('the lighthouse keeper lies');
        expect(story).toContain('Ambush at the crossroads!');
    });

    it('ignores combat/chrome rows and rows with no readable text', () => {
        const story = buildStoryFromRows([
            { type: 'roll', message: 'Attack roll 17', rollType: 'attack' },
            { type: 'hp_change', targetName: 'Rakan', delta: -8 },
            { type: 'session_active', description: 'active session set' },
            { type: 'narrative', characterName: 'GM' }, // no text at all
        ], null);
        expect(story).toBeNull();
    });

    it('keeps input order (oldest-first in, newest-last out)', () => {
        const story = buildStoryFromRows([
            narrative('First beat.'),
            narrative('Second beat.'),
        ], null);
        expect(story.indexOf('First beat.')).toBeLessThan(story.indexOf('Second beat.'));
    });
});

describe('buildStoryFromRows — hierarchical memory (recap-compressed past)', () => {
    const recap = (about, text) => ({ type: 'session_recap', description: text, recapSession: about, characterName: 'GM' });

    it('a prior-session recap REPLACES that session\'s raw rows but live rows stay raw', () => {
        const story = buildStoryFromRows([
            narrative('S1 raw beat.', { session: 'Session 1' }),
            { type: 'narrative', description: 'S2 live beat.', session: 'Session 2' },
            recap('Session 1', 'The party fled the smugglers\' cave.'),
        ], 'Session 2');
        expect(story).toContain('recap of “Session 1”');
        expect(story).toContain('The party fled');
        expect(story).toContain('S2 live beat.');
        expect(story).not.toContain('S1 raw beat.');
    });

    it('no recaps yet ⇒ the raw narrative history is the memory', () => {
        const story = buildStoryFromRows([
            narrative('Old beat.', { session: 'Session 1' }),
            narrative('Live beat.', { session: 'Session 2' }),
        ], 'Session 2');
        expect(story).toContain('Old beat.');
        expect(story).toContain('Live beat.');
    });

    it('unrecapped sessions and session:null rows stay raw alongside recaps', () => {
        const story = buildStoryFromRows([
            narrative('S1 raw (covered).', { session: 'Session 1' }),
            narrative('S0 untracked.', { session: null }),
            narrative('S1.5 unrecapped.', { session: 'Session 1.5' }),
            recap('Session 1', 'Compressed S1.'),
        ], 'Session 2');
        expect(story).toContain('Compressed S1.');
        expect(story).not.toContain('S1 raw (covered).');
        expect(story).toContain('S0 untracked.');
        expect(story).toContain('S1.5 unrecapped.');
    });

    it('a recap OF the live session never shadows the live raw rows', () => {
        const story = buildStoryFromRows([
            narrative('Live beat.', { session: 'Session 2' }),
            recap('Session 2', 'Premature recap.'),
        ], 'Session 2');
        expect(story).toContain('Live beat.');
        expect(story).not.toContain('Premature recap.');
    });
});

describe('buildStoryFromRows — line format (JII: recaps drop the author token)', () => {
    it('renders a recap line exactly as `- recap of “X”: <prose>` — no author token even when the row carries characterName', () => {
        const story = buildStoryFromRows([
            { type: 'session_recap', description: 'The party fled the cave.', recapSession: 'Session 1', characterName: 'GM' },
        ], 'Session 2');
        expect(story).toBe('- recap of “Session 1”: The party fled the cave.');
        expect(story).not.toContain('GM:');
    });

    it('clips the recap session name at 60 chars (clamp preserved)', () => {
        const long = 'S'.repeat(80);
        const story = buildStoryFromRows([
            { type: 'session_recap', description: 'Prose.', recapSession: long, characterName: 'GM' },
        ], 'Session 2');
        expect(story).toBe(`- recap of “${'S'.repeat(60)}”: Prose.`);
    });

    it('raw note/narrative rows keep their author label verbatim', () => {
        const story = buildStoryFromRows([
            { type: 'note', noteText: 'the keeper lies', characterName: 'GM' },
            { type: 'narrative', description: 'Rakan strikes.', characterName: 'Rakan' },
        ], null);
        const lines = story.split('\n');
        expect(lines[0]).toBe('- note: GM: the keeper lies');
        expect(lines[1]).toBe('- narrative: Rakan: Rakan strikes.');
    });
});

describe('buildStoryFromRows — budgets', () => {
    it('caps at STORY_MAX_ROWS keeping the freshest tail', () => {
        const rows = Array.from({ length: STORY_MAX_ROWS + 10 }, (_, i) => narrative(`beat ${i}.`));
        const story = buildStoryFromRows(rows, null);
        expect(story.split('\n')).toHaveLength(STORY_MAX_ROWS);
        expect(story).not.toContain('beat 0.');
        expect(story).toContain(`beat ${STORY_MAX_ROWS + 9}.`);
    });

    it('drops oldest lines until the block fits the character budget', () => {
        const filler = 'x'.repeat(150);
        const rows = Array.from({ length: 30 }, (_, i) => narrative(`beat ${i} ${filler}`));
        const story = buildStoryFromRows(rows, null);
        expect(story.length).toBeLessThanOrEqual(STORY_CHAR_BUDGET);
        expect(story).toContain('beat 29');
        expect(story).not.toContain('beat 0 ');
    });
});

describe('buildStorySoFar — server-side read seam', () => {
    it('composes from loadLog(campaign) + activeSessionName(campaign)', () => {
        loadLog.mockReturnValueOnce([narrative('Live beat.', { session: 'Session 3' })]);
        activeSessionName.mockReturnValueOnce('Session 3');
        const story = buildStorySoFar('test-campaign');
        expect(loadLog).toHaveBeenCalledWith('test-campaign');
        expect(story).toContain('Live beat.');
    });

    it('empty log ⇒ null (no story section)', () => {
        loadLog.mockReturnValueOnce([]);
        expect(buildStorySoFar('test-campaign')).toBeNull();
    });
});
