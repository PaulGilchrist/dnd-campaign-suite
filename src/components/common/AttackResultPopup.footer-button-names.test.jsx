// @maintained-by-ai 2026-11-18
// RZ 2026-11-18 backlog (popup-footer leading-space family): the staged-HIT
// `.popup-modal` footer leaves must be BYTE-EXACT — the Done button's label is
// ONE expression child after the icon (OA-chip precedent, MonsterCardBody
// `260f26bff`), so raw `JSON.stringify(textContent)` reads '"Done"' — no
// icon-adjacent leading space for strict-text harnesses to trip over — and the
// icon gap stays CSS-owned (.dice-roll-done-btn i margin-right). The Cancel
// attack row was already byte-exact and stays untouched. Pins:
//   • exact accessible names resolve first-try: getByRole('button',
//     { name: 'Done' }) and { name: 'Cancel attack' } — exactly one each;
//   • raw textContent of both leaves is byte-exact (the role matcher trims,
//     so the role pin alone cannot guard this — textContent is the anchor);
//   • behavior byte-identical through the exact-name locators: Done dispatches
//     exactly one dice-roll-done then closes; Cancel logs one attack_cancelled
//     row with zero dispatch;
//   • the non-staged footer Done (popup.jsx, no icon) stays byte-exact too.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';
import { addEntry } from '../../services/ui/logService.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const AUTO_DAMAGE = { name: 'Glaive', formula: '1d10 + 3', damageType: 'Slashing', source: 'EvasiveFighter', targetName: 'War_Cleric' };

function stagedHit(overrides = {}) {
  return {
    name: 'Glaive',
    type: 'd20',
    rollType: 'attack',
    rolls: [18],
    bonus: 9,
    hit: true,
    ...overrides,
  };
}

function renderPopup(popupHtml) {
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={onClose}
      campaignName="test-campaign"
      attackerName="EvasiveFighter"
      setPopupHtml={vi.fn()}
    />
  );
}

let onClose = null;
let captured = [];
let removeCapture = null;

beforeEach(() => {
  vi.clearAllMocks();
  onClose = vi.fn();
  captured = [];
  const handler = (e) => captured.push(e.detail);
  window.addEventListener('dice-roll-done', handler);
  removeCapture = () => window.removeEventListener('dice-roll-done', handler);
});

afterEach(() => {
  removeCapture();
  removeCapture = null;
});

describe('staged-HIT popup footer leaves are byte-exact', () => {
  it('raw textContent: Done is "Done" (no icon-adjacent leading space), Cancel attack is "Cancel attack"', () => {
    renderPopup(stagedHit({ autoDamage: AUTO_DAMAGE }));

    const modal = screen.getByTestId('popup-overlay').querySelector('.popup-modal');
    const labels = [...modal.querySelectorAll('button')].map((b) => JSON.stringify(b.textContent));
    // The whole footer family is byte-exact: no '" Done"'-shaped leaf.
    expect(labels).toContain('"Done"');
    expect(labels).toContain('"Cancel attack"');
    expect(labels.filter((t) => t.includes('Done'))).toEqual(['"Done"']);

    // The icon child is still there (the gap is CSS-owned, not markup text).
    const done = screen.getByRole('button', { name: 'Done', exact: true });
    expect(done).toHaveClass('dice-roll-reroll-btn', 'dice-roll-done-btn');
    expect(done.querySelector('i.fa-solid.fa-check')).not.toBeNull();
  });

  it('exact-name role locators resolve first-try — exactly one Done and one Cancel attack', () => {
    renderPopup(stagedHit({ autoDamage: AUTO_DAMAGE }));

    const modal = screen.getByTestId('popup-overlay').querySelector('.popup-modal');
    expect([...modal.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Done')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Done', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel attack', exact: true })).toBeInTheDocument();
  });

  it('Done pressed via the exact-name locator still commits exactly one dispatch, then closes', () => {
    renderPopup(stagedHit({ autoDamage: AUTO_DAMAGE }));

    fireEvent.click(screen.getByRole('button', { name: 'Done', exact: true }));

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: undefined, hit: true });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('Cancel attack pressed via the exact-name locator still routes the honest cancel — zero roll rows', () => {
    renderPopup(stagedHit({ autoDamage: AUTO_DAMAGE }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel attack', exact: true }));

    expect(captured).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const [, entry] = addEntry.mock.calls[0];
    expect(entry).toMatchObject({
      type: 'automation',
      automationType: 'attack_cancelled',
      reason: 'staged_damage_cancelled',
      characterName: 'EvasiveFighter',
      abilityName: 'Glaive',
    });
  });
});

describe('non-staged footer Done (popup.jsx close row, no icon) stays byte-exact', () => {
  it('plain hit face footer: accessible name and raw textContent are both exactly "Done"', () => {
    renderPopup(stagedHit());

    const done = screen.getByRole('button', { name: 'Done', exact: true });
    expect(done).toHaveClass('popup-close-btn');
    expect(JSON.stringify(done.textContent)).toBe('"Done"');

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(0);
  });
});
