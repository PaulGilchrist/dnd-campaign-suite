// @maintained-by-ai
// Healing lane (LogHpHealingEntry.jsx): owned contract = HEALING-side entry CONTENT bytes
// for both exports — HpChangeEntry player-heal legs ('Healed' label + fa-heart icon,
// positive '+N HP' delta, current/max remaining bytes, source-paren '(<sourceName>)'
// which #880 proved is SWALLOWED on damage, note span, '— Dice maximized by Supreme
// Healing' suffix, rollInfo/formula/bonusDetails detail legs — plus HealingEntry plain
// and resurrection bytes ('Healed for N HP', healingName fallback on falsy sourceName,
// 'Brought Back to Life', Resurrection badge, fa-dove, popupText).
// Zero-delta mislabel pinned honestly (SOURCE BUG: isDamage = delta < 0 labels 0 as
// 'Healed'); producers hit it for real — healAtFull HP logs delta 0 ('Already at full
// HP', healingRoll.js:94), so the full-HP byte 25/25 rides with it. Ledger: #880 owns
// this known bug; this row is the heal-lane witness, not a re-prove.
// CUT (owners cited): damage legs + breakdown matrix → LogHpChange.test.jsx (#880 owns
// breakdown bytes, source-swallow pin, temp/NPC legs); type→component routing and
// healing vs healing_pool icon disambiguation → LogEntryRendering.test.jsx (#879);
// metamagic/healing_pool lanes → LogMetamagicPool.test.jsx; producer payloads →
// healService/healingWordService/healingRoll tests.
// Old->new map: damage-breakdown(old :14-30) → DELETED (relocated into #880 :53-66);
// resurrection-badge(old :35-46) + popupText(old :48-55) → consolidated into
// healingEntryMatrix resurrection row; new healing-leg coverage → hpHealMatrix (4 rows,
// fill flagged gap: no prior test proved any non-resurrection healing byte).
import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { hp, heal, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const FIXED_TS = 1700000000000;

describe('Log > healing lane (LogHpHealingEntry)', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // HpChangeEntry player-heal leg (type hp_change, delta >= 0, no threshold/isTemp):
  // every !isDamage leg must SHOW its byte (the mirror of #880's damage-swallow pin).
  // Producers: healService.js logHealEntry (sourceName/note/formula/bonusDetails),
  // healingRoll.js logHealingToSSE (rollInfo/maximizeHealingDice/bonusDetails).
  it.each([
    ['plain heal, empty sourceName — bare Healed byte survives (#842 falsy leg)',
      { delta: 8 }, 'Healed', '+8 HP 20/25 remaining'],
    ['source paren + note + maximize suffix all render on healing',
      { delta: 8, sourceName: 'Cleric', note: 'Cure Wounds', maximizeHealingDice: true },
      'Healed (Cleric)Cure Wounds — Dice maximized by Supreme Healing', '+8 HP 20/25 remaining'],
    ['rollInfo + formula + bonusDetails detail legs',
      { delta: 11, rollInfo: '2d8+5 (13)', formula: '2d8+5', bonusDetails: [{ amount: 2, name: 'Fortified Health' }] },
      'Healed', '+11 HP 20/25 remaining (2d8+5 (13))2d8+5 plus 2 [Fortified Health]'],
    ['zero delta at full HP — honest 0 byte, mislabeled Healed (SOURCE BUG, ledger #880)',
      { delta: 0, currentHp: 25 }, 'Healed', '0 HP 25/25 remaining'],
  ])('renders hp_change heal leg: %s', (_label, overrides, name, detailsText) => {
    setup(Log, [hp({ timestamp: FIXED_TS, ...overrides })]);
    expect(q('.log-entry')).toHaveClass('log-entry', 'log-hp-change', 'log-healing');
    expect(q('.log-entry')).not.toHaveClass('log-hp-damage', 'log-temp-hp');
    expect(q('.log-icon i')).toHaveClass('fa-heart');
    expect(q('.log-character').textContent).toBe('Gimli');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-name').textContent).toBe(name);
    expect(q('.log-hp-details').textContent).toBe(detailsText);
  });

  // HealingEntry (type healing): plain-heal bytes, healingName fallback when
  // sourceName is falsy, and the resurrection variant (Hand of Ultimate Mercy
  // produces resurrection+popupText) folded into one row.
  it.each([
    ['plain heal', {}, 'fa-heart', 'Healed (Cleric)', 'Healed for 10 HP', 0],
    ['falsy sourceName falls back to healingName',
      { sourceName: '', healingName: 'Healing Word' }, 'fa-heart', 'Healed (Healing Word)', 'Healed for 10 HP', 0],
    ['resurrection with popupText',
      { resurrection: true, amount: 25, popupText: 'You feel the warmth of life returning.' },
      'fa-dove', 'Brought Back to Life', 'You feel the warmth of life returning.Returns to life with 25 HP', 1],
  ])('renders HealingEntry: %s', (_label, overrides, iconCls, name, detailsText, badges) => {
    setup(Log, [heal({ timestamp: FIXED_TS, ...overrides })]);
    const isRes = overrides.resurrection === true;
    expect(q('.log-entry')).toHaveClass('log-entry', 'log-healing');
    if (isRes) {
      expect(q('.log-entry')).toHaveClass('log-resurrection');
    } else {
      expect(q('.log-entry')).not.toHaveClass('log-resurrection');
    }
    expect(q('.log-icon i')).toHaveClass(iconCls);
    expect(q('.log-character').textContent).toBe('Frodo');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-name').textContent).toBe(name);
    expect([...document.querySelectorAll('.log-resurrection-badge')].map((n) => n.textContent))
      .toEqual(Array(badges).fill('Resurrection'));
    expect(q('.log-hp-details').textContent).toBe(detailsText);
  });

  // Negative guard: amount byte is authored-free only via popupText-only entries;
  // with amount absent the popup byte must still render (falsy-leg survivor, #842).
  it('renders popupText alone when amount is absent', () => {
    setup(Log, [heal({ timestamp: FIXED_TS, amount: undefined, popupText: 'Warmth returns.' })]);
    expect(q('.log-hp-details').textContent).toBe('Warmth returns.');
    expect(screen.queryByText(/Healed for/)).not.toBeInTheDocument();
  });
});
