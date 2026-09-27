// @improved-by-ai
// MA-1363: Quaggoth Claw Bloodied variant — unpicked-Done leg at the REAL popup
// seam (AttackResultPopup → dice-roll-done event). The HIT popup shows BOTH the
// Bloodied offer buttons (MA-0007 seam) and the auto-damage Done; pressing Done
// without adjudicating dispatches ONLY the base "1d6 + 3" formula — the 2d6
// Bloodied bonus leg is a separate modal-resolved roll (conditional_damage_granted),
// so unpicked Done is base-only by construction (additive seam, MA-1160 frame).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import AttackResultPopup from './AttackResultPopup.jsx';
import { buildChargeBonusOffer } from '../encounter/MonsterCardHelpers.js';

vi.mock('../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CLAW = monsters.find((m) => m.index === 'quaggoth').actions.find((a) => a.name === 'Claw');
const OFFER = buildChargeBonusOffer(CLAW, 'Claw');

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
    autoDamage: { name: 'Claw', formula: '1d6 + 3', damageType: 'Slashing', source: 'Quaggoth 1' },
    chargeBonusOffer: OFFER,
    ...overrides,
  };
}

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

let captured = null;
function captureDiceRollDone() {
  captured = null;
  const handler = (e) => { captured = e.detail; };
  window.addEventListener('dice-roll-done', handler);
  return () => window.removeEventListener('dice-roll-done', handler);
}

let cleanup = null;

beforeEach(() => {
  vi.clearAllMocks();
  cleanup = captureDiceRollDone();
});

afterEach(() => {
  if (cleanup) cleanup();
  captured = null;
});

describe('MA-1363 Quaggoth Claw popup: Bloodied offer coexists with Done', () => {
  it('HIT popup offers the Bloodied clause and Done together', () => {
    renderPopup(clawPopupHtml());
    expect(screen.getByRole('button', { name: /Bloodied: \+2d6 Slashing\?/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No charge \(base damage only\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
  });

  it('unpicked Done dispatches ONLY the base 1d6 + 3 formula (bonus leg untouched)', () => {
    renderPopup(clawPopupHtml());
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(captured).toBeTruthy();
    expect(captured.autoDamage.formula).toBe('1d6 + 3');
    expect(captured.autoDamage.damageType).toBe('Slashing');
    expect(JSON.stringify(captured)).not.toMatch(/2d6/);
  });

  it('Bloodied accept routes through onChargeBonus (modal pays the separate 2d6 leg)', () => {
    const onChargeBonus = vi.fn();
    renderPopup(clawPopupHtml(), { onChargeBonus });
    fireEvent.click(screen.getByRole('button', { name: /Bloodied: \+2d6 Slashing\?/ }));
    expect(onChargeBonus).toHaveBeenCalledTimes(1);
  });

  it('decline routes through onChargeBonusDecline (base damage only)', () => {
    const onChargeBonusDecline = vi.fn();
    renderPopup(clawPopupHtml(), { onChargeBonusDecline });
    fireEvent.click(screen.getByRole('button', { name: /No charge/i }));
    expect(onChargeBonusDecline).toHaveBeenCalledTimes(1);
  });

  it('MISS never offers the Bloodied clause', () => {
    renderPopup(clawPopupHtml({ hit: false, rolls: [4] }));
    expect(screen.queryByRole('button', { name: /Bloodied/i })).not.toBeInTheDocument();
  });
});
