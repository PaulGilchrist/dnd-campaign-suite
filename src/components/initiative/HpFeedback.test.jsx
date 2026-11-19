// @maintained-by-ai
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

    it('damage glyph + class, big-number law (≥10 or ≥25% of max)', () => {
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
