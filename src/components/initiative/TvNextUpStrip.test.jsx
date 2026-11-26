// @maintained-by-ai 2026-11-23
// Per-item contract for the up-next strip (QA backlog ZA 2026-11-23): every
// creature row carries a stable `tv-next-up-item` class token alongside the
// legacy `tv-next-chip`/type tokens, plus `data-name` verbatim, so tests and
// automation can census the wrap list per creature. The icon convention
// (fa-user for player, fa-dragon otherwise) and the container laws
// (.tv-next-up / aria-label / label span) are pinned here too — the filtering
// laws (active exclusion, wraparound, second-turn skips, max-4 cap) live
// upstream in useTvPresentation and are pinned in useTvPresentation.test.js.
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TvNextUpStrip from './TvNextUpStrip.jsx';

const CREATURES = [
    { name: 'Alice', type: 'player' },
    { name: 'Goblin', type: 'npc' },
    { name: 'Bob', type: 'player' },
    { name: "Omin's Shade", type: 'monster' },
];

describe('TvNextUpStrip', () => {
    it('every item carries tv-next-up-item + tv-next-chip/type tokens and data-name verbatim, in order', () => {
        const { container } = render(<TvNextUpStrip creatures={CREATURES} />);
        const items = [...container.querySelectorAll('.tv-next-up-item')];
        expect(items.map(el => el.getAttribute('data-name')))
            .toEqual(['Alice', 'Goblin', 'Bob', "Omin's Shade"]);
        for (const [i, el] of items.entries()) {
            expect(el.className).toContain('tv-next-up-item');
            expect(el.className).toContain('tv-next-chip');
            expect(el.className).toContain(CREATURES[i].type);
            expect(el.textContent).toContain(CREATURES[i].name);
        }
    });

    it('keeps the icon convention: fa-user for players, fa-dragon otherwise', () => {
        const { container } = render(<TvNextUpStrip creatures={CREATURES} />);
        const icons = [...container.querySelectorAll('.tv-next-up-item i')];
        expect(icons.map(i => i.className)).toEqual([
            'fa-solid fa-user',
            'fa-solid fa-dragon',
            'fa-solid fa-user',
            'fa-solid fa-dragon',
        ]);
    });

    it('renders the container laws unchanged and nothing for an empty list', () => {
        const { container } = render(<TvNextUpStrip creatures={CREATURES} />);
        const strip = container.querySelector('.tv-next-up');
        expect(strip).toHaveAttribute('aria-label', 'Up next');
        expect(strip.querySelector('.tv-next-up-label').textContent).toBe('Up next');

        expect(render(<TvNextUpStrip creatures={[]} />).container.firstChild).toBeNull();
        expect(render(<TvNextUpStrip creatures={undefined} />).container.firstChild).toBeNull();
    });
});
