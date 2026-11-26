// @maintained-by-ai
// Chronicle view faces (backlog Item 2): loading/empty (F14 pattern), the
// session-grouped forward-ordered story, mechanics-noise exclusion, the shared
// markdown sink actually routing through DOMPurify (real sanitize.js — attack
// vectors go inert, formatting survives), and the Markdown export plumbing via
// file-saver. useLog is mocked at the hook boundary (log-test-utils precedent);
// SSE law honored — the view never touches EventSource itself.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { saveAs } from 'file-saver';
import Chronicle from './Chronicle.jsx';

const mockState = vi.hoisted(() => ({ logEntries: [], initialized: true }));

vi.mock('../../hooks/runtime/useLog.js', () => ({
  default: vi.fn(() => mockState),
}));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

const T = (day, minute = 0) => new Date(2026, 10, day, 10, minute).getTime();

const narrative = (o = {}) => ({
  id: 'n1', type: 'narrative', characterName: 'GM', timestamp: T(1, 1),
  description: 'The gate groans open.', session: 'Session 1', ...o,
});

function renderChronicle(entries, initialized = true) {
  mockState.logEntries = entries;
  mockState.initialized = initialized;
  return render(<Chronicle campaignName="test-campaign" />);
}

beforeEach(() => {
  cleanup();
  mockState.logEntries = [];
  mockState.initialized = true;
  saveAs.mockClear();
});

describe('Chronicle faces', () => {
  it('shows a quiet loading face before the log resolves', () => {
    renderChronicle([], false);
    expect(screen.getByText('Reading the campaign log...')).toBeInTheDocument();
    expect(screen.queryByText(/Your story will unfold here/)).not.toBeInTheDocument();
  });

  it('empty log → the F14 centered icon + italic guidance face', () => {
    const { container } = renderChronicle([]);
    const empty = container.querySelector('.chronicle-empty.ct-empty-state');
    expect(empty).toBeInTheDocument();
    expect(empty.querySelector('i')).toHaveClass('fa-feather-pointed');
    expect(empty).toHaveTextContent('Your story will unfold here — post narrative notes in the Log and they’ll appear here.');
  });

  it('a log of pure mechanics noise still reads as empty (noise never counts as story)', () => {
    const { container } = renderChronicle([
      { id: 'r', type: 'roll', message: 'Frodo hits for 12', timestamp: T(1) },
      { id: 'n', type: 'note', noteText: 'I check for traps', timestamp: T(1) },
      { id: 'wr', type: 'write_rejected', message: 'bad row', timestamp: T(1) },
    ]);
    expect(container.querySelector('.chronicle-empty')).toBeInTheDocument();
    expect(container.querySelector('.chronicle-session')).not.toBeInTheDocument();
  });
});

describe('Chronicle story rendering', () => {
  it('renders grouped sections forward in time with the session header + date', () => {
    renderChronicle([
      { id: 'l', type: 'loot', xpPerChar: 1200, lootItems: ['Bag of Holding'], timestamp: T(1, 3), session: 'Session 1' },
      narrative({ id: 'n', timestamp: T(1, 1), description: 'first prose' }),
      { id: 'r', type: 'long_rest', message: 'camp', timestamp: T(1, 2), session: 'Session 1' },
      narrative({ id: 's2', timestamp: T(2, 0), description: 'next session opens', session: 'Session 2' }),
      narrative({ id: 'u', timestamp: T(3, 0), description: 'loose end', session: null }),
    ]);
    const headers = [...document.querySelectorAll('.chronicle-session-header')];
    expect(headers.map(h => h.textContent)).toEqual([
      expect.stringContaining('Session 1'),
      expect.stringContaining('Session 2'),
      expect.stringContaining('Campaign-span'),
    ]);
    expect(headers[0].textContent).toContain('2026');
    // forward order inside the section
    const beats = document.querySelectorAll('.chronicle-session .chronicle-beat');
    expect(beats[0]).toHaveTextContent('first prose');
    expect(beats[1]).toHaveTextContent('Long Rest');
    expect(beats[2]).toHaveTextContent('Bag of Holding');
    // noise exclusions never render
    expect(document.body.textContent).not.toContain('Frodo hits');
  });

  it('recap rows render under a titled recap card, prose beats as markdown', () => {
    renderChronicle([
      narrative({ description: 'Rain on the **road**.' }),
      { id: 'rc', type: 'session_recap', characterName: 'GM', timestamp: T(1, 2), description: 'A **long** night.', recapSession: 'Session 1', session: 'Session 1' },
    ]);
    const prose = document.querySelector('.chronicle-prose strong');
    expect(prose).toHaveTextContent('road');
    const recapCard = document.querySelector('.chronicle-recap');
    expect(recapCard).toBeInTheDocument();
    expect(recapCard.querySelector('.chronicle-recap-title')).toHaveTextContent('Session Recap — Session 1');
  });

  it('prose sinks run the log renderer: evil markdown goes inert, bold survives', () => {
    renderChronicle([
      narrative({ description: '<script>alert(1)</script><img src=x onerror=alert(1)>Rain <b>lashes</b> the road' }),
    ]);
    const sink = document.querySelector('.chronicle-prose-text');
    expect(sink.querySelector('script')).toBeNull();
    expect(sink.querySelector('img')).toBeNull();
    expect(sink.innerHTML).not.toMatch(/onerror/i);
    expect(sink.querySelector('b')).toHaveTextContent('lashes');
  });
});

describe('Chronicle export + print verbs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Export Markdown downloads one .md built from the composed story (noise stays out)', async () => {
    renderChronicle([
      narrative({ description: 'The gate groans **open**.' }),
      { id: 'x', type: 'roll', message: 'SECRET NOISE 123', timestamp: T(1, 9) },
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Export Markdown/ }));
    expect(saveAs).toHaveBeenCalledTimes(1);
    const [blob, fileName] = saveAs.mock.calls[0];
    expect(fileName).toBe('test-campaign-chronicle.md');
    const text = await blob.text();
    expect(text).toContain('# test-campaign — Chronicle');
    expect(text).toContain('The gate groans **open**.');
    expect(text).not.toContain('SECRET NOISE 123');
  });

  it('verbs are disabled while there is no story, and Print routes through window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { rerender } = renderChronicle([]);
    expect(screen.getByRole('button', { name: /Export Markdown/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Print/ })).toBeDisabled();
    rerender(<Chronicle campaignName="test-campaign" />); // same empty state
    fireEvent.click(screen.getByRole('button', { name: /^Print/ }));
    expect(printSpy).not.toHaveBeenCalled(); // disabled button ignores clicks
    // now with story (fresh container so only one Chronicle is mounted)
    cleanup();
    renderChronicle([narrative()]);
    fireEvent.click(screen.getByRole('button', { name: /^Print/ }));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('toolbar verbs never print (no-print chrome)', () => {
    renderChronicle([narrative()]);
    expect(document.querySelector('.chronicle-actions')).toHaveClass('no-print');
  });
});
