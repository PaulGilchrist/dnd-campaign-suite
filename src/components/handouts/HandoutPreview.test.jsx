// @maintained-by-ai 2026-11-25
// Item 4 print-handout shell contract: the preview portals to document.body
// (so its print isolation lane — body > :not(.handout-preview-portal) — sees
// it as a sibling of the app root no matter which host button opened it), the
// screen chrome is .no-print so ONLY the sheet hits paper, Escape/Close are
// zero-state dismissals, and Print calls window.print() without touching any
// store lane. Pure presentation: this file census-fetches and finds zero.
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HandoutPreview from './HandoutPreview.jsx';

describe('HandoutPreview', () => {
  beforeEach(() => {
    window.print = vi.fn();
    global.fetch = vi.fn(() => Promise.reject(new Error('fetch must not be called by a handout preview')));
  });
  afterEach(cleanup);

  const renderPreview = (props = {}) => render(
    <HandoutPreview
      label="NPC Card — Marta"
      campaignName="test-campaign"
      onClose={vi.fn()}
      {...props}
    >
      <p>paper content</p>
    </HandoutPreview>
  );

  it('portals the sheet to document.body outside the rendered container', () => {
    const { container } = renderPreview();
    expect(container.querySelector('.handout-preview-portal')).toBeNull();
    const portal = document.body.querySelector('.handout-preview-portal');
    expect(portal).not.toBeNull();
    expect(portal.querySelector('.handout-page').textContent).toContain('paper content');
  });

  it('the portal carries the ct-container kit class so the .ct-modal kit and print trick apply', () => {
    renderPreview();
    const portal = document.body.querySelector('.handout-preview-portal');
    expect(portal.classList.contains('ct-container')).toBe(true);
    expect(portal.querySelector('.ct-modal-overlay')).not.toBeNull();
  });

  it('header and footer chrome are .no-print; the sheet is not', () => {
    renderPreview();
    const portal = document.body.querySelector('.handout-preview-portal');
    expect(portal.querySelector('.ct-modal-header').classList.contains('no-print')).toBe(true);
    expect(portal.querySelector('.ct-modal-footer').classList.contains('no-print')).toBe(true);
    expect(portal.querySelector('.handout-page').classList.contains('no-print')).toBe(false);
  });

  it('footer carries the named Print verb and Print runs window.print with zero writes', () => {
    renderPreview();
    fireEvent.click(screen.getByRole('button', { name: /^print$/i }));
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('the footer credits the campaign on paper', () => {
    renderPreview();
    expect(document.body.querySelector('.handout-footer').textContent)
      .toContain('test-campaign · NPC Card — Marta');
  });

  it('Close dismisses with the onClose handler', () => {
    const onClose = vi.fn();
    renderPreview({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes the preview and is consumed (capture) — hosts never see it', async () => {
    const onClose = vi.fn();
    const hostListener = vi.fn();
    document.addEventListener('keydown', hostListener);
    renderPreview({ onClose });
    // Dispatch from BODY so the event travels the real path: document-capture
    // (preview, consumed) → body → document-bubble (host, never reached).
    fireEvent.keyDown(document.body, { key: 'Escape', bubbles: true });
    expect(onClose).toHaveBeenCalledTimes(1);
    // The host's own Escape listener (bubbling) must not actuate for a
    // keystroke that only answers the preview.
    await waitFor(() => expect(hostListener).not.toHaveBeenCalled());
    document.removeEventListener('keydown', hostListener);
  });

  it('a pure backdrop click closes, an in-sheet click never does', () => {
    const onClose = vi.fn();
    renderPreview({ onClose });
    const sheet = document.body.querySelector('.handout-page');
    fireEvent.click(sheet);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.body.querySelector('.ct-modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
