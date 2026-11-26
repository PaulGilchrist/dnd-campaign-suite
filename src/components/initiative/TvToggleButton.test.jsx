// @maintained-by-ai 2026-11-25
// F7 (visual audit) print-law fix, folded into the Item 4 print pass: the
// header TV chip is screen chrome — the Exit floater already carries
// .no-print, the toggle must not out-print it. The companion light-face law
// for the TV board itself lives in Initiative.css's @media print lane
// (paper verdict proved live with page.pdf() in the Item 4 run report).
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TvToggleButton from './TvToggleButton.jsx';

describe('TvToggleButton', () => {
  it('carries .no-print so the chip never prints (F7)', () => {
    render(<TvToggleButton tvMode={false} onToggle={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'TV' });
    expect(btn.className).toContain('no-print');
    expect(btn.className).toContain('tv-toggle-button');
  });

  it('keeps the pinned tv-toggle-on state class contract', () => {
    render(<TvToggleButton tvMode onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { pressed: true }).className).toContain('tv-toggle-on');
  });
});
