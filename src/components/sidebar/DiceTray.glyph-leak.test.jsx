// @maintained-by-ai: 2026-11-12
/* Lane: dice-tray decorative-glyph textContent leak (backlog 2026-11-12 QR).
 * The SVG <text> digit glyphs concatenated into every .dice-btn textContent
 * ("4d4", "8d8", "10d10", "12d12", "%d100"), polluting body-text dumps.
 * Fix: digits moved out of the DOM entirely into CSS generated content on a
 * positioned .dice-glyph wrapper, and every decorative svg is
 * aria-hidden="true" focusable="false". Accessible names stay "Roll dN" via
 * the aria-labels. Locks all four invariants below. */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DiceTray, { DicePopup } from './DiceTray.jsx';

const LABELS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

describe('DiceTray glyph leak', () => {
  it('each .dice-btn textContent is EXACTLY its die label (no digit/% glyph leak)', () => {
    const { container } = render(<DiceTray />);
    const buttons = [...container.querySelectorAll('.dice-btn')];
    expect(buttons).toHaveLength(LABELS.length);
    buttons.forEach((button, i) => {
      expect(button.textContent.trim(), `button ${i} textContent`).toBe(LABELS[i]);
    });
  });

  it('accessible names remain "Roll dN" via the aria-labels', () => {
    render(<DiceTray />);
    for (const label of LABELS) {
      expect(screen.getByRole('button', { name: `Roll ${label}` })).toBeInTheDocument();
    }
  });

  it('every decorative tray svg is aria-hidden and unfocusable, with no <text> glyphs left', () => {
    const { container } = render(<DiceTray />);
    const svgs = [...container.querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
    }
    // The glyph source (<text> nodes) is gone: nothing can leak into text
    // even if aria conventions are later stripped.
    expect(container.querySelectorAll('svg text')).toHaveLength(0);
    // fa-solid die icons keep the repo aria-hidden convention.
    for (const icon of container.querySelectorAll('i.fa-solid')) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('the d100 glyph renders via a positioned wrapper (CSS ::after), not text nodes', () => {
    render(<DiceTray />);
    const d100 = screen.getByRole('button', { name: 'Roll d100' });
    const glyph = d100.querySelector('.dice-glyph.dice-glyph-d100');
    expect(glyph).not.toBeNull();
    expect(glyph.querySelector('svg')).not.toBeNull();
  });

  it('popup d100 face renders its glyph without polluting the result icon text', () => {
    render(<DicePopup result={{ label: 'd100', value: 17 }} onClose={() => {}} />);
    const icon = document.querySelector('.dice-tray-result-icon');
    // No text nodes at all in the icon: the % is CSS generated content.
    expect(icon.textContent.trim()).toBe('');
    const glyph = icon.querySelector('.dice-glyph.dice-glyph-d100-result');
    expect(glyph).not.toBeNull();
    const svg = glyph.querySelector('svg.dice-result-svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    // Value/label rows still carry the roll result.
    expect(document.querySelector('.dice-tray-result-value').textContent).toBe('17');
    expect(document.querySelector('.dice-tray-result-label').textContent).toBe('d100');
  });

  it('popup icons for every die stay text-free and <text>-free', () => {
    const { rerender } = render(<DicePopup result={{ label: 'd4', value: 1 }} onClose={() => {}} />);
    for (const label of LABELS) {
      rerender(<DicePopup result={{ label, value: 1 }} onClose={() => {}} />);
      const icon = document.querySelector('.dice-tray-result-icon');
      expect(icon.querySelector('svg text'), `${label} icon`).toBeNull();
      expect(icon.textContent.trim(), `${label} icon text`).toBe('');
    }
  });
});
