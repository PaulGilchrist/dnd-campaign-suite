// @maintained-by-ai 2026-11-26
// Regression pin — the XP-lane celebration floors at the character's ACTUAL
// roster level (bug-xp-lane-celebration-ignores-actual-level-fake-award).
//
// Live face this pins: War_Cleric (Level 8, milestone) unticks Milestone
// Leveling and applies 26,500 XP. 26,500 implies level 7 (PHB ladder
// L7=23,000 / L8=34,000) — BELOW the real 8 — yet both the awarding client
// and every SSE-echo tab celebrated "LEVEL UP! War_Cleric — Level 1 → 7":
// the absent runtime XP implied Level 1 and the lane never consulted the
// roster `level`. The XP lane must therefore only celebrate an implied level
// that EXCEEDS max(implied-from, roster level), and the banner's starting
// level must be the roster truth, never a fabricated Level-1 origin.
//
// Lane mechanics (writer notify vs SSE full-bucket echo) are pinned by
// LevelUpCelebration.test.jsx; this file only exercises the roster floor on
// both lanes.
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LevelUpCelebration from './LevelUpCelebration.jsx';
import { playCue } from '../../services/ui/audioCues.js';
import {
    clearRuntimeState,
    replaceRuntimeObject,
    setRuntimeValue,
} from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/audioCues.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, playCue: vi.fn() };
});

const CAMPAIGN = 'test-campaign';

// The live fixture: Level 8 milestone char, zero XP on file.
const warCleric = (overrides) => ({
    name: 'War_Cleric', level: 8, xp: 0, xpMode: 'milestone', rules: '2024', ...overrides,
});

function setup(characters, { armed = true, onOpenWizard = vi.fn() } = {}) {
    const view = render(
        <LevelUpCelebration
            campaignName={CAMPAIGN}
            characters={characters}
            armed={armed}
            onOpenWizard={onOpenWizard}
        />,
    );
    return { ...view, onOpenWizard };
}

beforeEach(() => {
    clearRuntimeState('War_Cleric');
    playCue.mockClear();
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
});

describe('XP-lane awards are clamped to the character\'s actual roster level', () => {
    it('writing client: untick Milestone, award 26,500 (implies 7) then 34,000 (implies 8) — catch-up never celebrates', () => {
        setup([warCleric()]);
        // The modal's Milestone toggle: mode flips must not celebrate.
        act(() => { setRuntimeValue('War_Cleric', 'xpMode', 'experience', CAMPAIGN); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        // Implied level BELOW the real 8: silent adopt.
        act(() => { setRuntimeValue('War_Cleric', 'xp', 26500, CAMPAIGN); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        // Implied level EQUAL to the real 8: parity is not a level-up.
        act(() => { setRuntimeValue('War_Cleric', 'xp', 34000, CAMPAIGN); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('SSE-echo client: the same below-parity and parity awards are adopted silently', () => {
        setup([warCleric()]);
        // Echo tab adopts the toggle + awards exactly like App's
        // replaceRuntimeObject lane for `change-<campaign>-<char>`.
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp: 26500 }); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp: 34000 }); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it.each([
        // 48,000 implies level 9 — one ABOVE the real 8.
        [48000, 'Level 8 → 9'],
        // 95,000 implies level 11: an honest multi-level jump from the roster,
        // never a fabricated "1 → 11" origin.
        [95000, 'Level 8 → 11'],
    ])('a genuine award implying %i XP celebrates from the ROSTER level: %s', (xp, range) => {
        setup([warCleric()]);
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience' }); });
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp }); });
        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent('LEVEL UP!');
        expect(banner).toHaveTextContent('War_Cleric');
        expect(banner).toHaveTextContent(range);
    });

    it('when runtime XP already implies a level ABOVE the roster, the floor is that implied level', () => {
        // Roster still says 8 (wizard handoff pending) but stored XP implies 9;
        // an award implying 10 must read "Level 9 → 10", not "8 → 10".
        replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp: 48000 });
        setup([warCleric()]);
        act(() => { setRuntimeValue('War_Cleric', 'xp', 64000, CAMPAIGN); });
        expect(screen.getByRole('status')).toHaveTextContent('Level 9 → 10');
    });
});
