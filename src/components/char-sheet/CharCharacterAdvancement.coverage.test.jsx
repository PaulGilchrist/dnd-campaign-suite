// @maintained-by-ai
// Seam map for CharCharacterAdvancement (three-file split — keep lanes disjoint):
//   .rendering.test.jsx — section header, name/description display, grouping and
//       "* N" count suffix, featuresToIgnore filtering (5e, 2024, rules default),
//       missing-data edge cases. All mocks sanitizeHtml/sanitize off.
//   .options.test.jsx   — automation.options rendering (string/object/mixed),
//       click → setRuntimeValue('_Choose_option') + buffs-updated event,
//       null/undefined automation and campaignName. Gaps for that audit: current
//       option highlight (runtime value → bold/underline), options.length === 1
//       hides the Choice row, multi-word names → "_Name_With_Underscores_option".
//   .coverage.test.jsx  — THIS FILE: the live sanitizeHtml integration. Siblings
//       all mock sanitize as identity, so the dangerouslySetInnerHTML XSS guard
//       wiring is verified here, unmocked. Service internals stay in sanitize.test.js.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

describe('CharCharacterAdvancement - live sanitizeHtml integration', () => {
  afterEach(cleanup);

  it('renders descriptions via dangerouslySetInnerHTML with executable markup stripped and safe markup preserved', () => {
    const playerStats = {
      name: 'Test Character',
      rules: '5e',
      characterAdvancement: [
        {
          name: 'Inscription',
          description:
            'Rune of warding <b>bold survives</b>' +
            '<img src="x" onerror="alert(1)">' +
            '<script>alert(2)</script>' +
            '<a href="javascript:alert(3)">evil link</a>' +
            '<a href="https://dnd.example.com">safe link</a>',
        },
      ],
    };
    const { container } = render(
      <CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />
    );

    // Nothing executable reaches the DOM.
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/onerror|javascript:/i);

    // Allowed formatting and text survive.
    expect(screen.getByText('bold survives').tagName).toBe('B');
    expect(screen.getByText('evil link')).toBeInTheDocument();
    const safeLink = screen.getByText('safe link');
    expect(safeLink.tagName).toBe('A');
    expect(safeLink).toHaveAttribute('href', 'https://dnd.example.com');
    expect(screen.getByText('Inscription:')).toBeInTheDocument();
  });
});
