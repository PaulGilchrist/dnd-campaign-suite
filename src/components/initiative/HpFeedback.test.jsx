// @maintained-by-ai 2026-11-19
// Roadmap Item 10 (sensory cues) — HpFeedback is the floaters' render seam AND
// the heal cue's audio twin. playCue is the only seam mocked. Pins the
// floater skin (glyph/class per direction + big-number law), the heal cue on
// a FRESH event id, the no-replay law (the same id re-rendered never re-
// chimes; a new id chimes again), and the intentional damage silence — the
// attack outcome already sounded at the log seam (CombatCues.jsx), so an HP
// loss must never be double-voiced.
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HpFeedback from './HpFeedback.jsx';
import { playCue } from '../../services/ui/audioCues.js';

vi.mock('../../services/ui/audioCues.js', () => ({
    playCue: vi.fn(),
}));

const cues = () => playCue.mock.calls.map(([cue]) => cue);

beforeEach(() => {
    playCue.mockClear();
});

describe('floater skin', () => {
    it('renders nothing for a zero/absent event', () => {
        expect(render(<HpFeedback creatureName='Goblin' hpEvent={null} />).container).toBeEmptyDOMElement();
        expect(render(<HpFeedback creatureName='Goblin' hpEvent={{ delta: 0, id: 1, max: 20 }} />).container).toBeEmptyDOMElement();
        expect(cues()).toEqual([]);
    });

    it('damage glyph + class, big-number law (EITHER ≥10 absolute OR ≥25% of max)', () => {
        const { container } = render(
            <HpFeedback creatureName='Goblin' hpEvent={{ delta: -4, id: 1, max: 40 }} />,
        );
        expect(container.querySelector('.hp-floater-damage')).toHaveTextContent('−4');
        expect(container.querySelector('.hp-floater')).not.toHaveClass('hp-floater-big');

        const big = render(
            <HpFeedback creatureName='Goblin' hpEvent={{ delta: -12, id: 2, max: 40 }} />,
        ).container;
        expect(big.querySelector('.hp-floater-big')).not.toBeNull();
    });

    // JII: the min() threshold lets EITHER leg alone flag a hit big — the old
    // max() form demanded both, so a −30 on a 224-HP giant read as non-big.
    it('big-number law: absolute leg fires regardless of max', () => {
        const { container } = render(
            <HpFeedback creatureName='Giant' hpEvent={{ delta: -30, id: 1, max: 224 }} />,
        );
        expect(container.querySelector('.hp-floater-big')).not.toBeNull();
    });

    it('big-number law: relative-only leg fires below the 10 floor on low-max creatures', () => {
        // floor(12 * 0.25) = 3 < 10, so the 25% bar is the effective threshold.
        const { container } = render(
            <HpFeedback creatureName='Sprite' hpEvent={{ delta: -4, id: 1, max: 12 }} />,
        );
        expect(container.querySelector('.hp-floater-big')).not.toBeNull();
    });

    it('big-number law: sub-threshold control stays non-big', () => {
        // max 89 → min(10, floor(22.25)) = 10; −5 clears neither leg.
        const { container } = render(
            <HpFeedback creatureName='Ogre' hpEvent={{ delta: -5, id: 1, max: 89 }} />,
        );
        expect(container.querySelector('.hp-floater')).not.toHaveClass('hp-floater-big');
    });

    it('big-number law: −10 on max 89 is big (absolute leg, old formula said non-big)', () => {
        const { container } = render(
            <HpFeedback creatureName='Ogre' hpEvent={{ delta: -10, id: 1, max: 89 }} />,
        );
        expect(container.querySelector('.hp-floater-big')).not.toBeNull();
    });

    it('heal glyph + class', () => {
        const { container } = render(
            <HpFeedback creatureName='Alice' hpEvent={{ delta: 7, id: 3, max: 40 }} />,
        );
        expect(container.querySelector('.hp-floater-heal')).toHaveTextContent('+7');
    });
});

describe('heal cue at the floater seam', () => {
    it('a fresh heal event chimes once', () => {
        render(<HpFeedback creatureName='Alice' hpEvent={{ delta: 7, id: 1, max: 40 }} onDone={vi.fn()} />);
        expect(cues()).toEqual(['heal']);
    });

    it('the SAME event id re-rendered never re-chimes (no replay per parent render)', () => {
        const event = { delta: 7, id: 1, max: 40 };
        const view = render(<HpFeedback creatureName='Alice' hpEvent={event} onDone={vi.fn()} />);
        view.rerender(<HpFeedback creatureName='Alice' hpEvent={{ ...event }} onDone={vi.fn()} />);
        view.rerender(<HpFeedback creatureName='Alice' hpEvent={{ ...event }} onDone={vi.fn()} />);
        expect(cues()).toEqual(['heal']);
    });

    it('a new event id chimes again', () => {
        const view = render(<HpFeedback creatureName='Alice' hpEvent={{ delta: 5, id: 1, max: 40 }} onDone={vi.fn()} />);
        view.rerender(<HpFeedback creatureName='Alice' hpEvent={{ delta: 9, id: 2, max: 40 }} onDone={vi.fn()} />);
        expect(cues()).toEqual(['heal', 'heal']);
    });

    it('damage stays SILENT here — the attack cue already fired at the log seam', () => {
        render(<HpFeedback creatureName='Goblin' hpEvent={{ delta: -12, id: 1, max: 40 }} onDone={vi.fn()} />);
        expect(cues()).toEqual([]);
    });
});
