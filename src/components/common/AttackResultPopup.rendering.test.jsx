// @maintained-by-ai
// @improved-by-ai
// Rendering seam: AttackResultPopup owns WHICH content branch renders (raw
// sanitized-HTML string vs live DiceRollResult), threads the popup roll data
// into that branch, owns the miss→hit conversion override
// (hit={missToHitApplied || popupHtml.hit}), and consults the FT-007 round
// latch before wiring the Boon converter. Sibling files own their narrower
// seams and their behaviors are deliberately NOT repeated here:
//   • stroke-of-luck  — offer button visibility + click routing
//   • bi-defense      — inspiration-pool bookkeeping / auto-miss rewrite
//   • close-behavior  — close paths + dice-roll-done dispatch (object popups)
//   • ma1363-...      — quaggoth charge-offer data lock
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setCombatSummaryCache } from '../../services/encounters/combatData.js';
import { BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY } from '../../services/rules/features/boonOfCombatProwess.js';

// ── Mock dependencies ──
// Network/SSE boundaries only (sanitizer is pinned as an observable call, store
// + log are recorded). DiceRollResult renders for real so the popup seam is
// exercised end to end.

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

// ── Fixtures ──
// A d20 attack with a target so the ✓/✗ line is the visible proof that the
// popup's props reached DiceRollResult: rolls 18 + 3 = 21 vs AC 15 → HIT.

const CAMPAIGN = 'test-campaign';

function attackPopup(overrides = {}) {
  return {
    name: 'Test Attack',
    type: 'd20',
    rollType: 'attack',
    rolls: [18],
    bonus: 3,
    targetName: 'Goblin',
    targetAc: 15,
    hit: true,
    ...overrides,
  };
}

const missPopup = (overrides = {}) =>
  attackPopup({ rolls: [8], hit: false, ...overrides }); // 11 vs AC 15 → MISS

function renderPopup(popupHtml = attackPopup(), props = {}) {
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={vi.fn()}
      campaignName={CAMPAIGN}
      attackerName="PlayerOne"
      setPopupHtml={vi.fn()}
      {...props}
    />
  );
}

const boonButton = () => screen.queryByRole('button', { name: /Boon of Combat Prowess/i });

// Seed the combat summary cache so getCurrentCombatRound agrees on the round
// source (FT-007), then stamp the attacker's boon as spent on `usedRound`.
function seedBoonRound({ currentRound, usedRound }) {
  setCombatSummaryCache({ round: currentRound }, CAMPAIGN);
  getRuntimeValue.mockImplementation((_name, prop) =>
    prop === BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY ? usedRound : null
  );
}

// ── Tests ──

describe('AttackResultPopup rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(() => null);
  });

  afterEach(() => {
    setCombatSummaryCache(null, CAMPAIGN);
  });

  // ── Branch selection: string popupHtml ──

  describe('string popupHtml branch', () => {
    it('renders the string as live HTML through the sanitizer boundary, closable via Done', () => {
      const html = '<p>Hit with <b>+5</b> bonus</p><ul><li>Critical</li></ul>';
      const onClose = vi.fn();
      const { container } = renderPopup(html, { onClose });

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      // sanitizeHtml is the security boundary — the raw string must reach it verbatim.
      expect(sanitizeHtml).toHaveBeenCalledWith(html);
      // Markup survives as live HTML, not escaped text.
      expect(container.querySelector('b')).toHaveTextContent('+5');
      expect(container.querySelector('li')).toHaveTextContent('Critical');

      fireEvent.click(screen.getByRole('button', { name: /Done/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders no dice-roll result content for a string popup', () => {
      const { container } = renderPopup('<p>Flavour text</p>');

      expect(screen.getByText('Flavour text')).toBeInTheDocument();
      // The string branch must not instantiate the DiceRollResult pipeline UI.
      expect(container.querySelector('.dice-roll-total')).toBeNull();
      expect(screen.queryByRole('button', { name: /Stroke of Luck/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Boon of Combat Prowess/i })).not.toBeInTheDocument();
    });
  });

  // ── Branch selection: object popupHtml (DiceRollResult) ──

  describe('object popupHtml branch', () => {
    it('renders the roll data threaded into DiceRollResult — name, total, and hit line', () => {
      const { container } = renderPopup();

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      expect(screen.getByText('Test Attack')).toBeInTheDocument();
      // 18 + 3 = 21 vs AC 15 — proves popupHtml data survived the popup wrapper.
      expect(container.querySelector('.dice-roll-total')).toHaveTextContent('21');
      expect(screen.getByText('✓ HIT (21 vs AC 15)')).toBeInTheDocument();
    });

    it('renders a failing attack as a miss and offers no feature buttons by default', () => {
      const { container } = renderPopup(missPopup());

      expect(container.querySelector('.dice-roll-total')).toHaveTextContent('11');
      expect(screen.getByText('✗ MISS (11 vs AC 15)')).toBeInTheDocument();
      expect(boonButton()).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Stroke of Luck/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Bardic Inspiration - Defense/i })).not.toBeInTheDocument();
    });
  });

  // ── Miss→hit conversion override (popup-owned) ──

  describe('miss-to-hit conversion override', () => {
    it('clicking Boon of Combat Prowess re-renders the miss line as a converted hit without closing', () => {
      const onClose = vi.fn();
      renderPopup(missPopup({ autoRerollForAttack: true }), { onClose });

      fireEvent.click(boonButton());

      // The popup forces hit=true into DiceRollResult even though the roll
      // (11) is still below AC (15): the outcome line flips and is annotated.
      expect(screen.getByText('✓ HIT (11 vs AC 15)')).toBeInTheDocument();
      expect(screen.getByText(/Miss converted to Hit/)).toBeInTheDocument();
      expect(boonButton()).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── FT-007 round-latch consult (popup-owned) ──

  describe('FT-007 round-latch consult', () => {
    it('consults the latch for the named attacker and never wires the converter when the boon is spent this round', () => {
      const onStrokeOfLuck = vi.fn();
      seedBoonRound({ currentRound: 7, usedRound: 7 });

      renderPopup(missPopup({ autoRerollForAttack: true }), { onStrokeOfLuck });

      expect(getRuntimeValue).toHaveBeenCalledWith('PlayerOne', BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY, CAMPAIGN);

      fireEvent.click(boonButton());
      // Locked boon: the popup refuses to attach its converter, so the host
      // is never notified and no conversion is booked at the popup seam.
      expect(onStrokeOfLuck).not.toHaveBeenCalled();
    });

    it('re-arms the converter when the boon was spent on an earlier round', () => {
      const onStrokeOfLuck = vi.fn();
      seedBoonRound({ currentRound: 7, usedRound: 6 }); // spent last round

      renderPopup(missPopup({ autoRerollForAttack: true }), { onStrokeOfLuck });

      fireEvent.click(boonButton());
      expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
      expect(onStrokeOfLuck).toHaveBeenCalledWith('boonOfCombatProwess');
    });
  });
});
