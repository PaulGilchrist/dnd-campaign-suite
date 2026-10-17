// @maintained-by-ai
// Options lane for CharCharacterAdvancement (siblings: .rendering.test.jsx owns
// grouping/filtering, .coverage.test.jsx owns the live sanitizeHtml wiring):
//   - automation.options rendering (string/object/mixed)
//   - current-option highlight: runtime value wins, fallback to options[0]
//   - click → setRuntimeValue('_<Name>_option') with campaign + buffs-updated event
//   - missing/empty/short options lists and null-ish automation hide the Choice row
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
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: mockGetRuntimeValue,
  setRuntimeValue: mockSetRuntimeValue,
}));

function featureWith(options) {
  return {
    name: 'Test Character',
    characterAdvancement: [
      { name: 'Choose Feature', description: 'A choice', automation: { options } },
    ],
  };
}

describe('CharCharacterAdvancement - Options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  afterEach(cleanup);

  it.each([
    { options: ['Option A', 'Option B', 'Option C'], label: 'string' },
    { options: [{ name: 'Opt Alpha' }, { name: 'Opt Beta' }], label: 'object' },
    { options: ['String Option', { name: 'Object Option' }], label: 'mixed' },
  ])('renders all %s options in a Choice row', ({ options }) => {
    render(
      <CharCharacterAdvancement
        playerStats={featureWith(options)}
        campaignName="test-campaign"
      />
    );
    expect(screen.getByText('Choice:')).toBeInTheDocument();
    for (const opt of options) {
      const text = typeof opt === 'object' ? opt.name : opt;
      expect(screen.getByText(text).closest('.clickable')).toBeInTheDocument();
    }
  });

  it.each([
    { pinned: 'Second', highlighted: 'Second', other: 'First', label: 'runtime value' },
    { pinned: null, highlighted: 'First', other: 'Second', label: 'no runtime value (first option)' },
  ])('highlights the current option resolved from %s', ({ pinned, highlighted, other }) => {
    mockGetRuntimeValue.mockReturnValue(pinned);
    render(
      <CharCharacterAdvancement
        playerStats={featureWith(['First', 'Second'])}
        campaignName="test-campaign"
      />
    );
    if (pinned) {
      expect(mockGetRuntimeValue).toHaveBeenCalledWith('Test Character', '_Choose_Feature_option', 'test-campaign');
    }
    // jsdom does not expand the text-decoration shorthand into longhands,
    // so assert the inline styles the component applies for the highlight.
    const highlightedStyle = screen.getByText(highlighted).getAttribute('style');
    expect(highlightedStyle).toMatch(/font-weight:\s*bold/);
    expect(highlightedStyle).toMatch(/text-decoration:\s*underline/);
    expect(screen.getByText(other).getAttribute('style')).not.toMatch(/font-weight/);
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
      label: 'multi-word feature names map spaces to underscores',
      name: 'Bonus Feats',
      options: ['Sharpshooter', 'Polearm Master'],
      click: 'Polearm Master',
      key: '_Bonus_Feats_option',
    },
    {
      label: 'object options write their name',
      name: 'Choose',
      options: [{ name: 'Obj A' }, { name: 'Obj B' }],
      click: 'Obj B',
      key: '_Choose_option',
    },
  ])('clicking an option: %s — persists to runtime and fires buffs-updated', async ({ name, options, click, key }) => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(
      <CharCharacterAdvancement
        playerStats={{
          name: 'Test Character',
          characterAdvancement: [{ name, description: 'Pick', automation: { options } }],
        }}
        campaignName="test-campaign"
      />
    );
    fireEvent.click(screen.getByText(click));
    await waitFor(() => {
      expect(mockSetRuntimeValue).toHaveBeenCalledWith('Test Character', key, click, 'test-campaign');
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'buffs-updated' }));
    dispatchSpy.mockRestore();
  });

  it.each([
    { label: 'automation is undefined', automation: undefined },
    { label: 'automation is null', automation: null },
    { label: 'options is null', automation: { options: null } },
    { label: 'options is undefined', automation: { options: undefined } },
    { label: 'options is empty', automation: { options: [] } },
    { label: 'options has a single item', automation: { options: ['Solo'] } },
  ])('shows no Choice row when %s, but still renders the feature', ({ automation }) => {
    render(
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
  });
});
