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
// Same two-lane rig as LevelUpCelebration.test.jsx: real runtime-state
// module, setRuntimeValue = writing client, replaceRuntimeObject = the
// `change-<campaign>-<char>` full-bucket SSE echo other clients adopt.
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
    it('level-8 milestone char, untick Milestone + first award 26,500 XP (implies 7) → zero celebration', () => {
        setup([warCleric()]);
        // The modal's Milestone toggle: setRuntimeValue(name, 'xpMode',
        // 'experience') — the writing-client notify lane. The mode flip itself
        // must not celebrate either.
        act(() => { setRuntimeValue('War_Cleric', 'xpMode', 'experience', CAMPAIGN); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        // Apply 26,500 XP on the awarding tab.
        act(() => { setRuntimeValue('War_Cleric', 'xp', 26500, CAMPAIGN); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('the same award as an SSE full-bucket echo on another client → zero celebration', () => {
        setup([warCleric()]);
        // Echo tab adopts the toggle, then the award, exactly like App's
        // replaceRuntimeObject lane for `change-<campaign>-<char>`.
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience' }); });
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp: 26500 }); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('XP merely CATCHING UP to the roster level never celebrates (sync import adopts silently)', () => {
        setup([warCleric()]);
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp: 34000 }); });
        // 34,000 implies exactly level 8 — parity with reality is not a level-up.
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('a genuine award above the actual level celebrates from the ROSTER level, never Level 1', () => {
        setup([warCleric()]);
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience' }); });
        // 48,000 implies level 9 — one ABOVE the real 8.
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp: 48000 }); });
        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent('LEVEL UP!');
        expect(banner).toHaveTextContent('War_Cleric');
        expect(banner).toHaveTextContent('Level 8 → 9');
        expect(banner.textContent).not.toMatch(/Level 1 →/);
    });

    it('a multi-level award above the actual level spans from the roster level', () => {
        setup([warCleric()]);
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience' }); });
        // 95,000 implies level 11: an honest "Level 8 → 11" jump, not "1 → 11".
        act(() => { replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp: 95000 }); });
        expect(screen.getByRole('status')).toHaveTextContent('Level 8 → 11');
    });

    it('a true XP-lane crossing above the roster floor still floors the banner at the implied level when it is higher', () => {
        // Runtime XP already implies 9 (roster still says 8 — wizard handoff
        // pending); an award implying 10 must read "Level 9 → 10".
        replaceRuntimeObject('War_Cleric', { xpMode: 'experience', xp: 48000 });
        setup([warCleric()]);
        act(() => { setRuntimeValue('War_Cleric', 'xp', 64000, CAMPAIGN); });
        expect(screen.getByRole('status')).toHaveTextContent('Level 9 → 10');
    });
});
