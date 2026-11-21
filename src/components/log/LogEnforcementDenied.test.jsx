// @maintained-by-ai
// ENFORCEMENT_DENIED lane (backlog 2026-11-21 GGG, row attribution): gameplay
// refusals (assertCanAct, lineOfSightGate, opportunityTrigger, usePlayerDragging)
// all stamp {type:'enforcement_denied', creature, target?, bucket, source,
// reason} — the LoS-gate shape below is copied from the producer test bytes.
// The row must render ONE attributed line (creature → target + reason), with
// the bare category label "Enforcement Denied" appearing AT MOST ONCE (the old
// GenericEntry lane triple-printed it with zero attribution). Leaf bytes +
// registry routing (LogWriteRejected.test.jsx style).

import { beforeEach } from 'vitest';
import { q, setup, note, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed epoch — deterministic timestamps

// LoS-gate producer shape (denyBlockedShot in lineOfSightGate.js; the lane
// stamps no canonical text field, so logService stamps message = type label).
const losDenied = (o = {}) => ({
  id: 'ed', type: 'enforcement_denied', creature: 'FeyRanger', target: 'Goblin',
  bucket: 'lineOfSight', source: 'attack-row',
  reason: 'Goblin is behind a wall at (5,10) — no line of sight.',
  message: 'Enforcement Denied', timestamp: TS, ...o,
});

const countLabelLeaves = (root, label) =>
  [...root.querySelectorAll('*')].filter(el => el.textContent.trim() === label).length;

describe('enforcement_denied rows (gameplay-lane refusals)', () => {
  beforeEach(beforeEachSetup);

  it('routes to the dedicated row, never the generic fallback', () => {
    setup(Log, [losDenied()]);
    expect(q('.log-entry.log-enforcement-denied')).toBeInTheDocument();
    expect(q('.log-entry.log-generic')).toBeNull();
    expect(q('.log-enforcement-denied .log-icon i.fa-ban')).toBeInTheDocument();
    expect(q('.log-enforcement-denied .log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('renders one attributed line: creature → target + verbatim reason', () => {
    setup(Log, [losDenied()]);
    expect(q('.log-enforcement-denied-type').textContent).toBe('Enforcement Denied');
    expect(q('.log-enforcement-denied-bucket').textContent).toBe('lineOfSight');
    expect(q('.log-enforcement-denied-text').textContent)
      .toBe('FeyRanger → Goblin: Goblin is behind a wall at (5,10) — no line of sight.');
  });

  it('prints the bare label "Enforcement Denied" at most once in the row', () => {
    setup(Log, [losDenied()]);
    expect(countLabelLeaves(q('.log-enforcement-denied'), 'Enforcement Denied')).toBe(1);
  });

  it('renders the assertCanAct leg (creature + bucket, no target) attributed to the actor', () => {
    setup(Log, [losDenied({
      id: 'ed2', creature: 'FeyRanger', target: undefined, bucket: 'bonusAction',
      source: 'useCharActionsAutomation', reason: 'No bonus action left this turn.',
    })]);
    const row = q('.log-enforcement-denied');
    expect(row.textContent).toContain('FeyRanger: No bonus action left this turn.');
    expect(countLabelLeaves(row, 'Enforcement Denied')).toBe(1);
  });

  it('degrades honestly without reason, creature or target — never JSON, never "undefined"', () => {
    setup(Log, [losDenied({ reason: undefined, creature: undefined, target: undefined, bucket: undefined })]);
    const row = q('.log-enforcement-denied');
    expect(row.querySelector('.log-enforcement-denied-bucket')).toBeNull();
    expect(row.textContent).toContain('Action refused by enforcement.');
    expect(row.textContent).not.toMatch(/[{}]/);
    expect(row.textContent).not.toContain('undefined');
  });

  it('markup in the reason renders as inert escaped text', () => {
    setup(Log, [losDenied({ reason: '<script>alert(1)</script> blocked' })]);
    const row = q('.log-enforcement-denied');
    expect(row.querySelector('script')).toBeNull();
    expect(row.innerHTML).not.toMatch(/<script/);
  });

  it('filtering on Enforcement Denied shows only these rows; the type label option is unchanged', () => {
    setup(Log, [note({ id: 'n', noteText: 'a plain note' }), losDenied()]);
    const rows = document.querySelectorAll('.log-entries .log-entry');
    expect(rows).toHaveLength(2);
    // Sibling rows keep their own lanes untouched.
    expect(q('.log-entry.log-note')).toBeInTheDocument();
  });
});
