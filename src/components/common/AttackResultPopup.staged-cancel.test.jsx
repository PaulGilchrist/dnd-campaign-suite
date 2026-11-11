// @maintained-by-ai
// @improved-by-ai
// Staged-damage guard seam (hit-popup-backdrop-void-guard, 2026-11-11): while a
// HIT popup stages Done-gated damage, the backdrop must never dismiss it and the
// staged damage must never void silently. Pins:
//   • backdrop click with staged damage → popup stays open, onClose NOT called,
//     zero dice-roll-done dispatches; a later Done applies normally.
//   • the explicit "Cancel attack" row logs an honest attack_cancelled row
//     (naming the attack) and closes with ZERO dice-roll-done dispatches.
//   • nothing staged → today's chrome unchanged: footer Done, no Cancel row,
//     backdrop still inert (shared Popup default), "click to dismiss" hint stays.
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

const AUTO_DAMAGE = { name: 'Scimitar', formula: '1d6 + 2', damageType: 'Slashing', source: 'Goblin 1', targetName: 'Wild_Sage_Druid' };

function attackPopup(overrides = {}) {
  return {
    name: 'Scimitar',
    type: 'd20',
    rollType: 'attack',
    rolls: [18],
    bonus: 3,
    hit: true,
    ...overrides,
  };
}

let onClose = null;

function renderPopup(popupHtml, props = {}) {
  onClose = vi.fn();
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={onClose}
      campaignName="test-campaign"
      attackerName="Goblin 1"
      setPopupHtml={vi.fn()}
      {...props}
    />
  );
}

let captured = [];
let removeCapture = null;

beforeEach(() => {
  vi.clearAllMocks();
  captured = [];
  const handler = (e) => captured.push(e.detail);
  window.addEventListener('dice-roll-done', handler);
  removeCapture = () => window.removeEventListener('dice-roll-done', handler);
});

afterEach(() => {
  removeCapture();
  removeCapture = null;
});

describe('AttackResultPopup staged-damage guard', () => {
  describe('backdrop with staged damage', () => {
    it('does NOT dismiss: backdrop click leaves the popup open, closes nothing, dispatches nothing', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      fireEvent.click(screen.getByTestId('popup-overlay'));

      expect(onClose).not.toHaveBeenCalled();
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
      // The staged popup is still fully mounted with both exits.
      expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel attack/i })).toBeInTheDocument();
    });

    it('pressing Done after a backdrop click still applies the damage (one dispatch, then close)', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      fireEvent.click(screen.getByTestId('popup-overlay'));
      fireEvent.click(screen.getByRole('button', { name: /Done/i }));

      expect(captured).toHaveLength(1);
      expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: undefined, hit: true });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows no "click to dismiss" hint on the staged face (the hint would lie)', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));
      expect(screen.queryByText('click to dismiss')).not.toBeInTheDocument();
    });
  });

  describe('explicit Cancel attack', () => {
    it('logs an honest attack_cancelled row naming the attack and closes with zero damage dispatch', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      fireEvent.click(screen.getByRole('button', { name: /Cancel attack/i }));

      expect(addEntry).toHaveBeenCalledTimes(1);
      const [campaign, entry] = addEntry.mock.calls[0];
      expect(campaign).toBe('test-campaign');
      expect(entry).toMatchObject({
        type: 'automation',
        automationType: 'attack_cancelled',
        reason: 'staged_damage_cancelled',
        characterName: 'Goblin 1',
        abilityName: 'Scimitar',
      });
      expect(entry.description).toContain('Scimitar');
      expect(entry.description).toContain('Wild_Sage_Druid');
      // Zero damage applied — nothing rides the dice-roll-done lane.
      expect(captured).toHaveLength(0);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('nothing staged (default chrome unchanged)', () => {
    it('plain hit popup: no Cancel row, footer Done present, backdrop inert, dismiss hint stays', () => {
      renderPopup(attackPopup());

      expect(screen.queryByRole('button', { name: /Cancel attack/i })).not.toBeInTheDocument();
      expect(screen.getByText('click to dismiss')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('popup-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();

      // Footer Done closes without dispatch or a cancel row.
      fireEvent.click(screen.getByRole('button', { name: /Done/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('auto-miss carrying autoDamage stages nothing: no Cancel row', () => {
      renderPopup(attackPopup({ rolls: [1], hit: false, isAutoMiss: true, autoDamage: AUTO_DAMAGE }));
      expect(screen.queryByRole('button', { name: /Cancel attack/i })).not.toBeInTheDocument();
    });
  });
});
