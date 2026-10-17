// @maintained-by-ai
// @improved-by-ai
// MA-1363: Quaggoth Claw Bloodied variant — unpicked-Done leg at the REAL popup
// seam (AttackResultPopup → dice-roll-done event). The HIT popup shows BOTH the
// Bloodied offer buttons (MA-0007 seam) and the auto-damage Done; pressing Done
// without adjudicating dispatches ONLY the base "1d6 + 3" formula — the 2d6
// Bloodied bonus leg is a separate modal-resolved roll (conditional_damage_granted),
// so every Done is base-only by construction (additive seam, MA-1160 frame).
// Fixtures are built from the REAL public/data/monsters.json quaggoth row so a
// data edit that drops or reshapes the Bloodied clause breaks here, not in play.
// Close-path bookkeeping for plain auto-damage lives in the close-behavior sibling;
// this file pins only the charge-offer coexistence and its dispatch semantics.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import AttackResultPopup from './AttackResultPopup.jsx';
import { buildChargeBonusOffer } from '../encounter/MonsterCardHelpers.js';

// ── Mock dependencies ──
// Network/SSE boundaries only (store + log), at the paths the component itself
// imports (../../ from src/components/common — ../ mocks nothing and silently
// loads the real store/log). DiceRollResult and the offer render stay real.

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

// ── Fixtures (real quaggoth Claw data) ──

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CLAW = monsters.find((m) => m.index === 'quaggoth').actions.find((a) => a.name === 'Claw');
const OFFER = buildChargeBonusOffer(CLAW, 'Claw');

const AUTO_DAMAGE = { name: 'Claw', formula: '1d6 + 3', damageType: 'Slashing', source: 'Quaggoth 1' };

function clawPopupHtml(overrides = {}) {
  return {
    name: 'Claw',
    type: 'd20',
    rollType: 'attack',
    rolls: [16],
    bonus: 5,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: AUTO_DAMAGE,
    chargeBonusOffer: OFFER,
    ...overrides,
  };
}

// ── Helpers ──

function renderPopup(popupHtml, callbacks = {}) {
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={vi.fn()}
      campaignName="test-campaign"
      attackerName="Quaggoth 1"
      setPopupHtml={vi.fn()}
      {...callbacks}
    />
  );
}

const acceptOffer = () => fireEvent.click(screen.getByRole('button', { name: /Bloodied: \+2d6 Slashing\?/ }));
const declineOffer = () => fireEvent.click(screen.getByRole('button', { name: /No charge \(base damage only\)/ }));
const clickDone = () => fireEvent.click(screen.getByRole('button', { name: /Done/i }));

const queryAccept = () => screen.queryByRole('button', { name: /Bloodied: \+2d6 Slashing\?/ });
const queryDecline = () => screen.queryByRole('button', { name: /No charge \(base damage only\)/ });

// Every dice-roll-done detail captured during the test; pinned to length so a
// double-dispatch or an early auto-dispatch fails loudly, not silently.
let dispatches = [];
let removeCapture = null;

beforeEach(() => {
  vi.clearAllMocks();
  dispatches = [];
  const handler = (e) => dispatches.push(e.detail);
  window.addEventListener('dice-roll-done', handler);
  removeCapture = () => window.removeEventListener('dice-roll-done', handler);
});

afterEach(() => {
  removeCapture();
  removeCapture = null;
});

// ── Tests ──

describe('MA-1363 Quaggoth Claw popup: Bloodied offer coexists with Done', () => {
  describe('offer display', () => {
    it('builds the Bloodied offer from the real quaggoth row: +2d6 Slashing bonus leg', () => {
      // Data lock — the regression is the 2d6 conditional leg on Claw.
      expect(CLAW.conditional_damage).toEqual({ dice: '2d6', damage_type: 'Slashing', condition: 'bloodied' });
      expect(OFFER).toMatchObject({ dice: '2d6', damageType: 'Slashing', condition: 'bloodied' });
      expect(OFFER.label).toBe('Bloodied: +2d6 Slashing?');
    });

    it('HIT renders accept, decline, and exactly one Done — and dispatches nothing until acted on', () => {
      renderPopup(clawPopupHtml());

      expect(queryAccept()).toBeInTheDocument();
      expect(queryDecline()).toBeInTheDocument();
      // Exactly one Done: the offer must not steal or duplicate the auto-damage close.
      expect(screen.getAllByRole('button', { name: /Done/i })).toHaveLength(1);
      expect(dispatches).toHaveLength(0);
    });

    it('MISS offers neither accept nor decline, and Done closes without dispatching', () => {
      const onClose = vi.fn();
      renderPopup(clawPopupHtml({ hit: false, rolls: [4] }), { onClose });

      expect(queryAccept()).not.toBeInTheDocument();
      expect(queryDecline()).not.toBeInTheDocument();

      clickDone();
      expect(dispatches).toHaveLength(0);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('unpicked Done: base-only by construction', () => {
    it('Done without adjudicating dispatches exactly one base 1d6 + 3 payload, never the 2d6 leg, then closes', () => {
      const onClose = vi.fn();
      renderPopup(clawPopupHtml(), { onClose });

      clickDone();

      expect(dispatches).toHaveLength(1);
      expect(dispatches[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: undefined, hit: true });
      expect(JSON.stringify(dispatches[0])).not.toMatch(/2d6/);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('accepting first still makes Done base-only — the 2d6 bonus rides the separate modal roll', () => {
      const onChargeBonus = vi.fn();
      renderPopup(clawPopupHtml(), { onChargeBonus });

      acceptOffer();
      // Accept routes out; the popup itself pays and closes nothing.
      expect(onChargeBonus).toHaveBeenCalledTimes(1);
      expect(dispatches).toHaveLength(0);

      clickDone();
      expect(dispatches).toHaveLength(1);
      expect(dispatches[0].autoDamage).toEqual(AUTO_DAMAGE);
      expect(JSON.stringify(dispatches[0])).not.toMatch(/2d6/);
    });
  });

  describe('adjudication routing', () => {
    it('accept routes through onChargeBonus once and never dispatches or closes at the popup', () => {
      const onChargeBonus = vi.fn();
      const onClose = vi.fn();
      renderPopup(clawPopupHtml(), { onChargeBonus, onClose });

      acceptOffer();

      expect(onChargeBonus).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      expect(dispatches).toHaveLength(0);
    });

    it('decline routes through onChargeBonusDecline once and never dispatches or closes', () => {
      const onChargeBonusDecline = vi.fn();
      const onClose = vi.fn();
      renderPopup(clawPopupHtml(), { onChargeBonusDecline, onClose });

      declineOffer();

      expect(onChargeBonusDecline).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      expect(dispatches).toHaveLength(0);
    });

    it('a resolved offer collapses to its receipt; Done still pays base damage only', () => {
      renderPopup(clawPopupHtml({ chargeBonusResolved: 'granted' }));

      // Post-adjudication state: offer buttons gone, receipt shown, base Done intact.
      expect(queryAccept()).not.toBeInTheDocument();
      expect(queryDecline()).not.toBeInTheDocument();
      expect(screen.getByText(/Charge bonus applied \(\+2d6 Slashing\)/)).toBeInTheDocument();

      clickDone();
      expect(dispatches).toHaveLength(1);
      expect(dispatches[0].autoDamage).toEqual(AUTO_DAMAGE);
    });
  });
});
