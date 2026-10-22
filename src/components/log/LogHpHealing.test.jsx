// @maintained-by-ai
// Healing lane (LogHpHealingEntry.jsx): owned contract = HEALING-side entry CONTENT bytes
// for both exports — HpChangeEntry player-heal legs ('Healed' label + fa-heart icon,
// positive '+N HP' delta, current/max remaining bytes, source-paren '(<sourceName>)',
// note span, '— Dice maximized by Supreme Healing' suffix, rollInfo/formula/bonusDetails
// detail legs — plus HealingEntry plain and resurrection bytes ('Healed for N HP',
// healingName fallback on falsy sourceName, 'Brought Back to Life', Resurrection badge,
// fa-dove, popupText).
// #880 FIXED 2026-10-22: zero delta no longer mislabeled 'Healed' (old isDamage=delta<0
// fell to the heal arm — 'Healed 0'); it renders the honest neutral arm 'No HP Change'
// (+sourceName) with log-hp-neutral/fa-circle-info. Producers hit zero for real — heal
// clamps to 0 at full HP (healingRoll.js logHealingToSSE, popup 'Already at full HP'
// :94; healService.js:83; spellCast execution/index.js applyMaxHeal/applyRolledHeal,
// delta-0 log STILL emitted per index.genericHealFortified.test.js:487) — legit observable
// events, so rows below claim the zero-arm, source-paren, note and maximize bytes.
// Damage-leg source/note RENDER flip pins live in LogHpChange.test.jsx (damage lane).
// CUT (owners cited): damage legs + breakdown matrix → LogHpChange.test.jsx (breakdown
// bytes, multiTarget source/note render pin, temp/NPC legs); type→component routing and
// healing vs healing_pool icon disambiguation → LogEntryRendering.test.jsx (#879);
// metamagic/healing_pool lanes → LogMetamagicPool.test.jsx; producer payloads →
// healService/healingWordService/healingRoll tests.
// Old->new map: damage-breakdown(old :14-30) → DELETED here, sole owner
// LogHpChange.test.jsx breakdownMatrix (:53-66 pre-fix numbering, REC closed);
// resurrection-badge(old :35-46) + popupText(old :48-55) → consolidated into
// healingEntryMatrix resurrection row; new healing-leg coverage → hpHealMatrix (rows,
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
  // every !isDamage leg must SHOW its byte. Producers: healService.js logHealEntry
  // (sourceName/note/formula/bonusDetails), healingRoll.js logHealingToSSE
  // (rollInfo/maximizeHealingDice/bonusDetails). Zero rows = clamp-at-full-HP
  // producers (#880): honest 'No HP Change' arm, neutral cls/icon — never 'Healed 0'.
  // Name bytes are mutually distinguishable across rows (#1348: exact-textContent pins,
  // zero arm shares no byte with the heal arm).
  it.each([
    ['plain heal, empty sourceName — bare Healed byte survives (#842 falsy leg)',
      { delta: 8 }, 'Healed', 'log-healing', 'fa-heart', '+8 HP 20/25 remaining'],
    ['source paren + note + maximize suffix all render on healing',
      { delta: 8, sourceName: 'Cleric', note: 'Cure Wounds', maximizeHealingDice: true },
      'Healed (Cleric)Cure Wounds — Dice maximized by Supreme Healing', 'log-healing', 'fa-heart', '+8 HP 20/25 remaining'],
    ['rollInfo + formula + bonusDetails detail legs',
      { delta: 11, rollInfo: '2d8+5 (13)', formula: '2d8+5', bonusDetails: [{ amount: 2, name: 'Fortified Health' }] },
      'Healed', 'log-healing', 'fa-heart', '+11 HP 20/25 remaining (2d8+5 (13))2d8+5 plus 2 [Fortified Health]'],
    ['zero delta at full HP — honest neutral arm, bare (#880 fix)',
      { delta: 0, currentHp: 25 }, 'No HP Change', 'log-hp-neutral', 'fa-circle-info', '0 HP 25/25 remaining'],
    ['zero delta at full HP with producer context — source paren + rollInfo render (#880)',
      { delta: 0, currentHp: 25, sourceName: 'Cleric', rollInfo: '2d8+5 (13)' },
      'No HP Change (Cleric)', 'log-hp-neutral', 'fa-circle-info', '0 HP 25/25 remaining (2d8+5 (13))'],
  ])('renders hp_change heal leg: %s', (_label, overrides, name, polarityCls, iconCls, detailsText) => {
    setup(Log, [hp({ timestamp: FIXED_TS, ...overrides })]);
    expect(q('.log-entry')).toHaveClass('log-entry', 'log-hp-change', polarityCls);
    expect(q('.log-entry')).not.toHaveClass(...['log-hp-damage', 'log-temp-hp', 'log-healing'].filter((c) => c !== polarityCls));
    expect(q('.log-icon i')).toHaveClass(iconCls);
    expect(q('.log-character').textContent).toBe('Gimli');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-name').textContent).toBe(name);
    expect(q('.log-hp-details').textContent).toBe(detailsText);
    // Distinguishability (#1348): this lane's labels never bleed into each other.
    expect(name).not.toMatch(/Takes Damage/);
    expect(name.includes('No HP Change')).toBe(overrides.delta === 0);
    expect(name.includes('Healed')).toBe(overrides.delta > 0);
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
