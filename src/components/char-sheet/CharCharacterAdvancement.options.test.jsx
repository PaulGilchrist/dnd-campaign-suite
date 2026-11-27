// @maintained-by-ai 2026-11-27
// Options lane for CharCharacterAdvancement (siblings: .rendering.test.jsx owns
// grouping/filtering, .coverage.test.jsx owns the live sanitizeHtml wiring —
// seam map in .coverage.test.jsx header):
//   - automation.options rendering: exact ordered census of .clickable rows,
//     string and object shapes (mixed lists share both branches, rows dropped)
//   - current-option highlight: runtime value wins by NAME, fallback to
//     options[0] (string) / options[0].name (object), stale value highlights
//     nothing; read key derived from feature name, campaign passed through
//   - click → setRuntimeValue('_<Name>_option', optionName) exactly once,
//     spaces (incl. runs of whitespace) collapse to one underscore, then a
//     single buffs-updated event
//   - falsy automation/options and lists shorter than 2 hide the Choice row
//     while the feature row still renders (falsy variants collapsed to one
//     null leg; undefined/null options and null automation all resolve to the
//     same `options &&` branch)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const { mockGetRuntimeValue, mockSetRuntimeValue } = vi.hoisted(() => ({
  mockGetRuntimeValue: vi.fn(),
  mockSetRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: mockGetRuntimeValue,
  setRuntimeValue: mockSetRuntimeValue,
}));

function playerStatsWith(name, options) {
  return {
    name: 'Test Character',
    characterAdvancement: [
      { name, description: 'A choice', automation: { options } },
    ],
  };
}

// Ordered census of the Choice row: text of each .clickable and whether it
// carries the current-option highlight (bold + underline). jsdom does not
// expand text-decoration shorthands into longhands reliably, so probe the
// style attribute the component applies rather than computed styles.
function optionCensus(container) {
  return [...container.querySelectorAll('.clickable')].map((el) => ({
    text: el.textContent,
    highlighted:
      /font-weight:\s*bold/.test(el.getAttribute('style') || '') &&
      /text-decoration:\s*underline/.test(el.getAttribute('style') || ''),
  }));
}

describe('CharCharacterAdvancement - Options', () => {
  let dispatchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    cleanup();
  });

  it.each([
    {
      label: 'no runtime value falls back to the first string option',
      options: ['First', 'Second'],
      pinned: null,
      census: [
        { text: 'First', highlighted: true },
        { text: 'Second', highlighted: false },
      ],
    },
    {
      label: 'a runtime value highlights the matching string option by name',
      options: ['First', 'Second'],
      pinned: 'Second',
      census: [
        { text: 'First', highlighted: false },
        { text: 'Second', highlighted: true },
      ],
    },
    {
      label: 'no runtime value falls back to object options[0].name',
      options: [{ name: 'Obj A' }, { name: 'Obj B' }],
      pinned: null,
      census: [
        { text: 'Obj A', highlighted: true },
        { text: 'Obj B', highlighted: false },
      ],
    },
    {
      label: 'a runtime value highlights the matching object option by name',
      options: [{ name: 'Obj A' }, { name: 'Obj B' }],
      pinned: 'Obj B',
      census: [
        { text: 'Obj A', highlighted: false },
        { text: 'Obj B', highlighted: true },
      ],
    },
    {
      label: 'a stale runtime value matching no option highlights nothing',
      options: ['First', 'Second'],
      pinned: 'Stale',
      census: [
        { text: 'First', highlighted: false },
        { text: 'Second', highlighted: false },
      ],
    },
  ])('highlights the current option when %s', ({ options, pinned, census }) => {
    mockGetRuntimeValue.mockReturnValue(pinned);
    const { container } = render(
      <CharCharacterAdvancement
        playerStats={playerStatsWith('Choose Feature', options)}
        campaignName="test-campaign"
      />
    );
    expect(screen.getByText('Choice:')).toBeInTheDocument();
    expect(optionCensus(container)).toEqual(census);
    expect(mockGetRuntimeValue).toHaveBeenCalledWith(
      'Test Character',
      '_Choose_Feature_option',
      'test-campaign'
    );
  });

  it.each([
    {
      label: 'single-word feature names map to _<Name>_option',
      name: 'Choose',
      options: ['First', 'Second'],
      click: 'Second',
      key: '_Choose_option',
    },
    {
      label: 'multi-word feature names map each space to an underscore',
      name: 'Bonus Feats',
      options: ['Sharpshooter', 'Polearm Master'],
      click: 'Polearm Master',
      key: '_Bonus_Feats_option',
    },
    {
      label: 'runs of whitespace collapse to a single underscore',
      name: 'Raging  Edge',
      options: ['First', 'Second'],
      click: 'Second',
      key: '_Raging_Edge_option',
    },
    {
      label: 'object options persist their name, not the object',
      name: 'Choose',
      options: [{ name: 'Obj A' }, { name: 'Obj B' }],
      click: 'Obj B',
      key: '_Choose_option',
    },
  ])(
    'clicking an option (%s) writes the runtime key once and fires buffs-updated',
    async ({ name, options, click, key }) => {
      render(
        <CharCharacterAdvancement
          playerStats={playerStatsWith(name, options)}
          campaignName="test-campaign"
        />
      );
      fireEvent.click(screen.getByText(click));
      // buffs-updated fires only after the awaited write resolves, so wait on
      // both together.
      await waitFor(() => {
        expect(mockSetRuntimeValue).toHaveBeenCalledTimes(1);
        expect(mockSetRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          key,
          click,
          'test-campaign'
        );
        expect(
          dispatchSpy.mock.calls.filter(([ev]) => ev.type === 'buffs-updated')
        ).toHaveLength(1);
      });
    }
  );

  it.each([
    { label: 'automation is null', automation: null },
    { label: 'options is empty', automation: { options: [] } },
    { label: 'options has a single item', automation: { options: ['Solo'] } },
  ])('shows no Choice row when %s, but still renders the feature', ({ automation }) => {
    const { container } = render(
      <CharCharacterAdvancement
        playerStats={{
          name: 'Test Character',
          characterAdvancement: [{ name: 'Feature', description: 'Desc', automation }],
        }}
        campaignName="test-campaign"
      />
    );
    expect(screen.getByText('Feature:')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
    expect(screen.queryByText('Choice:')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.clickable')).toHaveLength(0);
  });
});
