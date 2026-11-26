// Toolbelt dialog (Item 1): checkbox-per-view list seeded from the stored
// hidden set; optimistic draft behind a benign 600ms network debounce (a
// click burst coalesces to ONE save carrying the final set; unmount flushes,
// never drops); starting-point pills batch-set the checkboxes and their
// ACTIVE state is derived (a manual checkbox move reads Custom the instant
// it happens); a pill click on the already-active preset is a true no-op
// (zero save churn — batch-set idempotency); honest success/failure line
// after the flush; × / Done / Escape / pure-backdrop-close per the kit law.
import { render, fireEvent, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TOOLBELT_VIEWS, TOOLBELT_PRESETS } from '../../services/ui/sidebarNav.js';
import { ToolbeltSettings } from './ToolbeltSettings.jsx';

const PILL_CLICK_WAIT = 650; // > TOOLBELT_PERSIST_DEBOUNCE_MS

const preset = (id) => TOOLBELT_PRESETS.find((p) => p.id === id);
const checkbox = (label) => screen.getByLabelText(new RegExp(`^${label}$`));

let onSave;
function open(props = {}) {
  onSave = props.onSave ?? vi.fn().mockResolvedValue({});
  const onClose = props.onClose ?? vi.fn();
  const utils = render(
    <ToolbeltSettings
      hiddenViews={props.hiddenViews ?? []}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { ...utils, onSave, onClose };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ToolbeltSettings — the checkbox list', () => {
  it('renders exactly one checkbox per sidebar view; a TICK means SHOWN, so stored-hidden boxes start unticked', () => {
    open({ hiddenViews: ['music', 'initiative'] });
    const boxes = document.querySelectorAll('.toolbelt-views input[type="checkbox"]');
    expect(boxes.length).toBe(TOOLBELT_VIEWS.length);
    expect(checkbox('Music')).not.toBeChecked();
    expect(checkbox('Initiative')).not.toBeChecked();
    expect(checkbox('Log')).toBeChecked();
    expect(checkbox('Admin')).toBeChecked();
  });

  it('un-ticking a view saves the grown hidden set once the debounce lands, with plain-English success copy', async () => {
    open({ hiddenViews: [] });
    fireEvent.click(checkbox('Music'));
    expect(onSave).not.toHaveBeenCalled(); // optimistic draft first
    await act(async () => { vi.advanceTimersByTime(PILL_CLICK_WAIT); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['music']);
    expect(document.querySelector('.toolbelt-status--success')).toHaveTextContent('everyone at this table');
  });

  it('a click BURST coalesces into ONE save carrying the FINAL set', async () => {
    open({ hiddenViews: [] });
    fireEvent.click(checkbox('Music'));
    fireEvent.click(checkbox('Log'));
    fireEvent.click(checkbox('Music')); // re-show Music → only Log left hidden
    await act(async () => { vi.advanceTimersByTime(PILL_CLICK_WAIT); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['campaignLog']);
  });

  it('closing mid-burst FLUSHES the pending write (clicks are deferred, never dropped)', async () => {
    const utils = open({ hiddenViews: [] });
    fireEvent.click(checkbox('Maps'));
    // The sidebar unmounts the dialog when the GM closes it — the unmount
    // cleanup is what must fire the stranded write.
    utils.unmount();
    expect(onSave).toHaveBeenCalledWith(['mapsManager']);
  });

  it('a failed save names the problem honestly and does not claim success', async () => {
    open({
      hiddenViews: [],
      onSave: vi.fn().mockRejectedValue(new Error('Only the GM (localhost) can set the campaign meta')),
    });
    fireEvent.click(checkbox('Music'));
    await act(async () => { vi.advanceTimersByTime(PILL_CLICK_WAIT); });
    expect(document.querySelector('.toolbelt-status--error')).toHaveTextContent(
      'Save failed: Only the GM (localhost) can set the campaign meta',
    );
    expect(document.querySelector('.toolbelt-status--success')).toBeNull();
  });

  it('opening and touching NOTHING writes NOTHING (an absent field stays an absent field)', async () => {
    open({ hiddenViews: ['music'] });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await act(async () => { vi.advanceTimersByTime(PILL_CLICK_WAIT); });
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('ToolbeltSettings — starting-point pills (batch-set, never a mode)', () => {
  it('a pill click batch-sets every checkbox and saves the preset hidden set', async () => {
    open({ hiddenViews: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Theater of the mind' }));
    expect(checkbox('Maps')).not.toBeChecked();
    expect(checkbox('Initiative')).toBeChecked();
    await act(async () => { vi.advanceTimersByTime(PILL_CLICK_WAIT); });
    expect(onSave).toHaveBeenCalledWith(preset('theater').hidden);
  });

  it('presets are conveniences: after a pill, one checkbox move DERIVES Custom and keeps every box editable', async () => {
    open({ hiddenViews: [] });
    const theaterBtn = screen.getByRole('button', { name: 'Theater of the mind' });
    fireEvent.click(theaterBtn);
    expect(theaterBtn).toHaveAttribute('aria-pressed', 'true');
    // Manual move off the preset batch-set → Custom chip appears, pill dims.
    fireEvent.click(checkbox('Music'));
    expect(theaterBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(checkbox('Music')).not.toBeChecked();
    expect(checkbox('Maps')).not.toBeChecked();
  });

  it('batch-set idempotency: re-clicking the ACTIVE preset is a no-op — zero extra saves', async () => {
    open({ hiddenViews: preset('print-dice').hidden });
    const pill = screen.getByRole('button', { name: 'Print & real dice' });
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(pill); // already applied
    await act(async () => { vi.advanceTimersByTime(PILL_CLICK_WAIT); });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('the "Everything" pill resets a hidden campaign back to all-visible', async () => {
    open({ hiddenViews: preset('full-digital').hidden });
    const everything = TOOLBELT_VIEWS.every(() => true); // list sanity
    expect(everything).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Everything' }));
    for (const { label } of TOOLBELT_VIEWS) expect(checkbox(label)).toBeChecked();
    await act(async () => { vi.advanceTimersByTime(PILL_CLICK_WAIT); });
    expect(onSave).toHaveBeenCalledWith([]);
  });
});

describe('ToolbeltSettings — kit dialog behaviour', () => {
  it.each([['close button', () => fireEvent.click(document.querySelector('.ct-modal-close'))],
    ['Done', () => fireEvent.click(screen.getByRole('button', { name: 'Done' }))],
    ['Escape', () => fireEvent.keyDown(document.querySelector('.ct-modal'), { key: 'Escape' })],
    ['pure backdrop click', () => {
      const overlay = document.querySelector('.ct-modal-overlay');
      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);
    }]])(
    'closes via the %s lane with no extra write',
    async (_label, actClose) => {
      const utils = open({ hiddenViews: [] });
      actClose(utils);
      expect(utils.onClose).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('a click INSIDE the panel never dismisses', () => {
    const utils = open({ hiddenViews: [] });
    const overlay = document.querySelector('.ct-modal-overlay');
    fireEvent.mouseDown(overlay);
    fireEvent.click(document.querySelector('.toolbelt-intro'));
    expect(utils.onClose).not.toHaveBeenCalled();
  });

  it('is a labelled modal the whole table can trust: dialog role + campaign-wide copy', () => {
    open({ hiddenViews: [] });
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName('Sidebar toolbelt');
    expect(dialog.textContent).toContain('not fixed modes');
    expect(dialog.textContent.toLowerCase()).not.toMatch(/\bmode\b|\blevel\b/);
  });
});
