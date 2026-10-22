// @maintained-by-ai
// HpChangeEntry lane (type hp_change): owned contract = DAMAGE-side entry CONTENT bytes —
// delta magnitude byte, knockout prefix (distinct from NPC 'Defeated' overkill leg),
// temp-HP leg (no current/max bytes), damage breakdown modifier legs (resistance/immunity
// badges; any other authored status renders type byte bare — no 'vulnerable' badge exists
// in the renderer), NPC threshold names + delta!==0 falsy guard (#842 sibling survives),
// attacker/source RENDER pin (#880 FIXED 2026-10-22: damage leg now shows the
// sourceName/note bytes multiTargetHandler.js:129-130 authors; the pre-fix swallow is
// captured in git history + the flip rows below), zero-delta neutral arm (#880),
// fixed-timestamp header (#876: never Date.now()).
// CUT (owners cited): type→component routing + placeholders → LogEntryRendering.test.jsx
// (#879 canonical); healing-side legs ('Healed', heal source paren, heal note formula,
// maximize, zero-at-full-HP heal rows) → healing lane LogHpHealing.test.jsx (#880);
// producer payloads → 
// combatLoggingService.test.js and damage-pipeline tests.
// NOTE: breakdown bytes relocated INTO this lane from old LogHpHealing.test.jsx:14-30;
// REC closed — that block is GONE from the healing lane (verified 2026-10-22), this is
// the sole breakdown owner (resistant/immune/normal/vulnerable rows below).
// Old->new map: basic-damage(2) + unconscious(1) → damageMatrix (large-delta folded into
// knockout's 0/max pin); temp-hp(1) → tempHpLeg (+no-current/max pin); thresholds(1) →
// npcThresholdMatrix (+zero-delta falsy + recovering polarity pins); healing(4) → #880
// healing lane hpHealMatrix.
import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { hp, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const FIXED_TS = 1700000000000;

describe('Log > HpChangeEntry (damage lane)', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // Player damage legs: label byte (incl. knockout em-dash prefix), polarity class,
  // icon, exact delta+current/max detail bytes. #880 FIXED: damage now RENDERS the
  // sourceName/note bytes multiTargetHandler.js:124-131 authors (was swallowed by
  // !isDamage guards); zero delta is the honest neutral arm (was mislabeled 'Healed'
  // via isDamage = delta < 0). Producers hit zero for real: full absorption at
  // handlePlainDamage.js:1136 -(totalDamageDealt), delta 0 at multiTargetHandler.js:125.
  it.each([
    ['damage with authored sourceName/note — both bytes render (#880 fix, was swallow)',
      { sourceName: 'Shadow Wizard', note: 'Fire Bolt' },
      'Takes Damage (Shadow Wizard)Fire Bolt', 'log-hp-damage', 'fa-heart-crack', '-5 HP 20/25 remaining'],
    ['multi-target spread — bytes exactly as multiTargetHandler.js:129-130 authors them',
      { delta: -7, sourceName: 'Zar', note: 'Burning Hands (multi-target spread)' },
      'Takes Damage (Zar)Burning Hands (multi-target spread)', 'log-hp-damage', 'fa-heart-crack', '-7 HP 20/25 remaining'],
    ['knockout', { delta: -10, currentHp: 0, isUnconscious: true }, 'Knocked Unconscious — Takes Damage', 'log-hp-damage', 'fa-heart-crack', '-10 HP 0/25 remaining'],
    ['zero delta — honest neutral arm, never \'Healed\' (#880 fix)',
      { delta: 0 }, 'No HP Change', 'log-hp-neutral', 'fa-circle-info', '0 HP 20/25 remaining'],
  ])('renders %s entry bytes', (_label, overrides, name, polarityCls, iconCls, detailsText) => {
    setup(Log, [hp({ timestamp: FIXED_TS, ...overrides })]);
    expect(q('.log-entry')).toHaveClass('log-hp-change', polarityCls);
    expect(q('.log-icon i')).toHaveClass(iconCls);
    expect(q('.log-character').textContent).toBe('Gimli');
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-name').textContent).toBe(name);
    expect(q('.log-hp-details').textContent).toBe(detailsText);
    // Note byte lives in its own formula span inside .log-name — match the authored
    // fixture byte for byte (source/note distinguishability, #1348 family).
    const notes = Array.from(q('.log-name').querySelectorAll('.log-dice-formula')).map((n) => n.textContent);
    expect(notes).toEqual(overrides.note ? [overrides.note] : []);
  });

  // Damage breakdown modifier legs (bytes relocated from LogHpHealing.test.jsx, the
  // damage content lane is here). Unrecognized authored statuses (incl. 'vulnerable')
  // get the type byte bare — honest absence pin.
  it.each([
    ['resistant, immune and normal types', -10,
      [{ damageType: 'fire', status: 'resistant' }, { damageType: 'cold', status: 'immune' }, { damageType: 'bludgeoning', status: 'normal' }],
      '-10 HPfireResistance, coldImmune, bludgeoning', ['fire', 'cold', 'bludgeoning'], 1, 1],
    ['vulnerable with no badge byte', -3, [{ damageType: 'radiant', status: 'vulnerable' }],
      '-3 HPradiant', ['radiant'], 0, 0],
  ])('renders breakdown for %s', (_label, delta, breakdown, breakdownText, types, resBadges, immBadges) => {
    setup(Log, [hp({ delta, damageBreakdown: breakdown, timestamp: FIXED_TS })]);
    expect(q('.log-hp-delta').textContent).toBe(breakdownText);
    expect([...document.querySelectorAll('.log-damage-type')].map((n) => n.textContent)).toEqual(types);
    expect([...document.querySelectorAll('.log-resistance-badge')].map((n) => n.textContent)).toEqual(Array(resBadges).fill('Resistance'));
    expect([...document.querySelectorAll('.log-immunity-badge')].map((n) => n.textContent)).toEqual(Array(immBadges).fill('Immune'));
    expect(q('.log-hp-current').textContent).toBe(' 20/25 remaining');
  });

  // Temp-HP absorption leg: shield+label, and current/max bytes suppressed (!isTemp).
  it('renders temp-HP leg with shield and no current/max bytes', () => {
    setup(Log, [hp({ delta: 12, isTempHp: true, currentHp: 5, timestamp: FIXED_TS })]);
    expect(q('.log-entry')).toHaveClass('log-hp-change', 'log-temp-hp');
    expect(q('.log-icon i')).toHaveClass('fa-shield');
    expect(q('.log-name').textContent).toBe('Temporary Hit Points');
    expect(q('.log-hp-details').textContent).toBe('+12 HP');
    expect(q('.log-hp-current')).toBeNull();
    expect(screen.queryByText(/5\/25/)).not.toBeInTheDocument();
  });

  // NPC lane (threshold set): name byte with signed-delta parentheses, NPC details are
  // delta-only (no current/max), and the delta!==0 guard leaves 'Defeated' bare with
  // zero delta while the entry survives (falsy-leg sibling bytes — #842 class).
  it.each([
    ['dead overkill', { threshold: 'dead', delta: -20 }, 'Defeated (-20)', 'log-hp-damage', 'fa-heart-crack', '-20 HP'],
    ['bloodied', { threshold: 'bloodied', delta: -15 }, 'Bloodied (-15)', 'log-hp-damage', 'fa-heart-crack', '-15 HP'],
    ['recovering heal byte', { threshold: 'recovering', delta: 10 }, 'Recovering (+10)', 'log-healing', 'fa-heart', '+10 HP'],
    ['zero delta drops only the parentheses (neutral polarity, #880 fix)', { threshold: 'dead', delta: 0 }, 'Defeated', 'log-hp-neutral', 'fa-circle-info', '0 HP'],
  ])('renders %s NPC threshold bytes', (_label, overrides, name, polarityCls, iconCls, detailsText) => {
    setup(Log, [hp({ timestamp: FIXED_TS, ...overrides })]);
    expect(q('.log-entry')).toHaveClass('log-hp-change', polarityCls);
    expect(q('.log-icon i')).toHaveClass(iconCls);
    expect(q('.log-name').textContent).toBe(name);
    expect(q('.log-hp-details').textContent).toBe(detailsText);
    expect(q('.log-hp-current')).toBeNull();
  });
});
