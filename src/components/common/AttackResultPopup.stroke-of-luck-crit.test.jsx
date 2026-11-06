// @maintained-by-ai
// Regression ledger for bug-stroke-of-luck-natural-20-no-crit-damage:
// a 2024 Stroke of Luck press turns the d20 FACE into a 20 — on an attack
// roll that is a natural 20, so the popup must show the crit banner (not the
// plain "Natural 20!" face) and the Done dispatch must arm the SAME isCrit
// channel a genuine natural 20 uses, or the damage lane charges a single
// dice pool while the UI advertises the nat 20.
// Non-crit twins pinned here (must stay byte-unchanged):
//   • Boon of Combat Prowess ("you can hit instead" — never a 20)
//   • 5e Stroke of Luck (canonical wording "turn the miss into a hit" —
//     no face-20, no crit)
//   • Stroke of Luck on a saving throw (D20 Test face keeps "Natural 20!")
// Sibling seams (persisted records): CharSheet.handlers.miss-conversion.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Network/SSE boundaries only (mirror the stroke-of-luck sibling); the real
// DiceRollResult renders so the banner seam is exercised end to end.
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

const CAMPAIGN = 'test-campaign';

const AUTO_DAMAGE = {
  name: 'Shortbow',
  formula: '1d6+1',
  damageType: 'Piercing',
  targetName: 'War_Cleric',
  attackerName: 'EvasiveFighter',
  source: 'char-actions',
  d20Roll: 2,
};

// Failed attack: 2 + 7 = 9 vs AC 12 → MISS, Stroke offer live.
function missAttackPopup(overrides = {}) {
  return {
    name: 'Shortbow',
    type: 'd20',
    rollType: 'attack',
    rolls: [2],
    bonus: 7,
    targetName: 'War_Cleric',
    targetAc: 12,
    hit: false,
    strokeOfLuck: true,
    autoDamage: AUTO_DAMAGE,
    ...overrides,
  };
}

function playerStats(rules) {
  return { name: 'EvasiveFighter', rules };
}

let captured = [];
let removeCapture = null;

function renderPopup(popupHtml, props = {}) {
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={vi.fn()}
      campaignName={CAMPAIGN}
      attackerName="EvasiveFighter"
      setPopupHtml={vi.fn()}
      {...props}
    />
  );
}

const strokeButton = () => screen.queryByRole('button', { name: /^Stroke of Luck$/i });
const boonButton = () => screen.queryByRole('button', { name: /Boon of Combat Prowess/i });
const critBanner = () => screen.queryByText('Critical Hit! — damage dice doubled');
const natural20Banner = () => screen.queryByText('Natural 20!');

describe('Stroke of Luck converts the d20 face into a natural 20 on an attack roll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null); // FT-007 boon latch: unspent
    captured = [];
    const handler = (e) => captured.push(e.detail);
    window.addEventListener('dice-roll-done', handler);
    removeCapture = () => window.removeEventListener('dice-roll-done', handler);
  });

  afterEach(() => {
    removeCapture();
    removeCapture = null;
  });

  it('2024 host: stroke press flips the banner to the crit notice and Done dispatches isCrit:true', () => {
    renderPopup(missAttackPopup(), { playerStats: playerStats('2024') });

    // Pre-click: plain miss face, no banners.
    expect(critBanner()).not.toBeInTheDocument();
    expect(natural20Banner()).not.toBeInTheDocument();

    fireEvent.click(strokeButton());

    // The face shows the rewritten 20 AND the crit banner — never the two
    // banners at once (the old dishonest pair was "Natural 20!" + single pool).
    expect(natural20Banner()).not.toBeInTheDocument();
    expect(critBanner()).toBeInTheDocument();
    expect(screen.getByText('✓ HIT (27 vs AC 12)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: true, hit: true });
  });

  it('5e host: canonical "turn the miss into a hit" stays non-crit — Natural 20! face and isCrit:undefined', () => {
    renderPopup(missAttackPopup(), { playerStats: playerStats('5e') });

    fireEvent.click(strokeButton());

    expect(critBanner()).not.toBeInTheDocument();
    expect(natural20Banner()).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    expect(captured).toHaveLength(1);
    // Byte-identical to a plain non-crit popup (isCrit stays undefined —
    // only the converted 2024 face arms the crit channel).
    expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: undefined, hit: true });
  });

  it('Boon of Combat Prowess twin on a 2024 host stays non-crit: no crit banner, Done dispatches isCrit:undefined', () => {
    renderPopup(missAttackPopup({ strokeOfLuck: false, autoRerollForAttack: true }), { playerStats: playerStats('2024') });

    fireEvent.click(boonButton());

    // The boon hits without becoming a 20: no banners, no die rewrite.
    expect(critBanner()).not.toBeInTheDocument();
    expect(natural20Banner()).not.toBeInTheDocument();
    expect(screen.getByText(/Boon of Combat Prowess: Miss converted to Hit/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: undefined, hit: true });
  });

  it('stroke of luck on a failed save keeps the non-crit "Natural 20!" face byte-unchanged', () => {
    renderPopup({
      name: 'Constitution',
      type: 'd20',
      rollType: 'save',
      rolls: [2],
      bonus: 1,
      strokeOfLuck: true,
      saveResult: { success: false, total: 3, roll: 2, bonus: 1 },
      saveDc: 15,
    }, { playerStats: playerStats('2024') });

    fireEvent.click(strokeButton());

    // D20 Test face, not an attack: Natural 20! only, never the crit banner.
    expect(natural20Banner()).toBeInTheDocument();
    expect(critBanner()).not.toBeInTheDocument();
    // No autoDamage on the save face: nothing dispatched.
    expect(captured).toHaveLength(0);
  });
});
