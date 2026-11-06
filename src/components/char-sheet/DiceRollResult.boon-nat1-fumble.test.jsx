// @maintained-by-ai
// Regression ledger for bug-boon-nat1-conversion-keeps-critical-miss-banner:
// Boon of Combat Prowess ("Fearless Aim") legitimately converts a natural-1
// auto-miss (owner ruling 2026-11-06 — authored copy has no nat-1 carve-out),
// but the converted face must show ONE verdict: "✓ HIT" with NO leftover
// "Critical Miss!" fumble notice (mirror of the e923a05ef convertedNat20
// suppression that replaced the "Natural 20!" face on the stroke lane).
// The unconverted natural-1 face must stay byte-unchanged: banner + "✗ MISS".
// Sibling seams: AttackResultPopup.stroke-of-luck-crit.test.jsx (banner-vs-
// outcome contract on the stroke twins), CharSheet.handlers.miss-conversion.
// test.jsx (persisted records). Fix lives in DiceRollResult.computed.js
// (showFumble gated on missToHitApplied || boonUsed).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttackResultPopup from '../common/AttackResultPopup.jsx';
import DiceRollResult from './DiceRollResult.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Network/SSE boundaries only (mirror the stroke-of-luck-crit template); the
// real DiceRollResult renders so the fumble-banner seam is exercised end to end.
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
  name: 'Quarterstaff',
  formula: '1d6+5',
  damageType: 'Bludgeoning',
  targetName: 'ElderPaladin',
  attackerName: 'Disciplined_Monk',
  source: 'char-actions',
  d20Roll: 1,
};

// Natural-1 attack: 1 + 11 = 12 vs AC 19 → auto-miss, fumble banner live,
// Boon of Combat Prowess offered (owner ruling: the offer is correct).
function nat1BoonPopup(overrides = {}) {
  return {
    name: 'Quarterstaff',
    type: 'd20',
    rollType: 'attack',
    rolls: [1],
    bonus: 11,
    isNatural1: true,
    targetName: 'ElderPaladin',
    targetAc: 19,
    hit: false,
    autoRerollForAttack: true,
    autoDamage: AUTO_DAMAGE,
    ...overrides,
  };
}

function playerStats(rules) {
  return { name: 'Disciplined_Monk', rules };
}

function renderPopup(popupHtml, props = {}) {
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={vi.fn()}
      campaignName={CAMPAIGN}
      attackerName="Disciplined_Monk"
      setPopupHtml={vi.fn()}
      {...props}
    />
  );
}

const boonButton = () => screen.queryByRole('button', { name: /Boon of Combat Prowess/i });
const fumbleBanner = () => screen.queryByText('Critical Miss!');
const critBanner = () => screen.queryByText('Critical Hit! — damage dice doubled');

let captured = [];
let removeCapture = null;

describe('Boon of Combat Prowess on a natural 1 suppresses the fumble banner on the converted face', () => {
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

  it('unconverted nat-1 face keeps CRITICAL MISS! + ✗ MISS while the boon offer stands', () => {
    renderPopup(nat1BoonPopup(), { playerStats: playerStats('2024') });

    // The fumble verdict on the un-converted face is honest — must stay
    // byte-unchanged (rendering.test.jsx pins the no-offer twin too).
    expect(fumbleBanner()).toBeInTheDocument();
    expect(screen.getByText('✗ MISS (12 vs AC 19)')).toBeInTheDocument();
    expect(screen.queryByText(/✓ HIT/)).not.toBeInTheDocument();
    expect(boonButton()).toBeInTheDocument();
  });

  it('2024 host: boon press keeps HIT with the conversion note and NO leftover Critical Miss! banner', () => {
    renderPopup(nat1BoonPopup(), { playerStats: playerStats('2024') });

    fireEvent.click(boonButton());

    // One consistent verdict: the miss is gone, so the fumble banner is gone.
    expect(fumbleBanner()).not.toBeInTheDocument();
    expect(screen.getByText('✓ HIT (12 vs AC 19)')).toBeInTheDocument();
    expect(screen.getByText(/Boon of Combat Prowess: Miss converted to Hit/)).toBeInTheDocument();
    // The boon hits without becoming a 20: still no crit banner either.
    expect(critBanner()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    // Conversion stays non-crit on the Done dispatch (stroke-crit twin owns
    // the isCrit:true channel — this twin must dispatch isCrit:undefined).
    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: undefined, hit: true });
  });

  it('5e host twin gets the same suppression (boon exists in both rulesets)', () => {
    renderPopup(nat1BoonPopup(), { playerStats: playerStats('5e') });

    expect(fumbleBanner()).toBeInTheDocument();
    fireEvent.click(boonButton());

    expect(fumbleBanner()).not.toBeInTheDocument();
    expect(screen.getByText('✓ HIT (12 vs AC 19)')).toBeInTheDocument();
  });

  it('post-consume nat-1 roll (boon locked: flag already off at roll time) keeps CRITICAL MISS!', () => {
    // boonOfCombatProwessAvailable folds the FT-007 round latch into the roll
    // context, so a spent boon ships popupHtml WITHOUT autoRerollForAttack —
    // the honest no-boon face must keep the fumble banner.
    getRuntimeValue.mockReturnValue(1); // latch stamped on the current round
    renderPopup(nat1BoonPopup({ autoRerollForAttack: false }), { playerStats: playerStats('2024') });

    expect(boonButton()).not.toBeInTheDocument();
    expect(fumbleBanner()).toBeInTheDocument();
    expect(screen.getByText('✗ MISS (12 vs AC 19)')).toBeInTheDocument();
  });

  it('non-nat-1 miss boon face is byte-unchanged: no banners before or after the press', () => {
    renderPopup(nat1BoonPopup({ rolls: [2], isNatural1: false }), { playerStats: playerStats('2024') });

    // 2 + 11 = 13 vs AC 19 → plain miss: never a fumble banner.
    expect(fumbleBanner()).not.toBeInTheDocument();
    fireEvent.click(boonButton());
    expect(fumbleBanner()).not.toBeInTheDocument();
    expect(screen.getByText('✓ HIT (13 vs AC 19)')).toBeInTheDocument();
    expect(screen.getByText(/Boon of Combat Prowess: Miss converted to Hit/)).toBeInTheDocument();
  });
});

describe('standalone DiceRollResult boonUsed channel suppresses the fumble banner too', () => {
  it('offer click flips nat-1 face from Critical Miss! + MISS to HIT + note', () => {
    render(
      <DiceRollResult
        name="Quarterstaff"
        type="d20"
        rollType="attack"
        rolls={[1]}
        bonus={11}
        isNatural1={true}
        autoRerollForAttack={true}
        targetName="ElderPaladin"
        targetAc={19}
        hit={false}
        autoDamage={AUTO_DAMAGE}
      />
    );

    expect(fumbleBanner()).toBeInTheDocument();
    expect(screen.getByText('✗ MISS (12 vs AC 19)')).toBeInTheDocument();

    fireEvent.click(boonButton());

    expect(fumbleBanner()).not.toBeInTheDocument();
    expect(screen.getByText('✓ HIT (12 vs AC 19)')).toBeInTheDocument();
    expect(screen.getByText(/Boon of Combat Prowess: Miss converted to Hit/)).toBeInTheDocument();
  });
});
