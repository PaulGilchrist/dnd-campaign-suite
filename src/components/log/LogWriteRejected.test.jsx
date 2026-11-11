// @maintained-by-ai
// WRITE_REJECTED lane (GC improve 2026-11-10, audit legibility split): the
// server's key-validator refusals (server/routes/campaigns-changedata.js) log
// their own row type so the gameplay-lane enforcement_denied filter never
// mixes in API-validation noise. Row shape is copied from the producer:
// {type:'write_rejected', origin:'server-validator', key, reason, description}.
// Leaf bytes + registry routing + type-filter separation (LogAiAudit.test.jsx
// style); the gameplay enforcement_denied generic row stays pinned by
// LogGeneric.test.jsx.

import { screen, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, note, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed epoch — deterministic timestamps

const rejected = (o = {}) => ({
  id: 'wr', type: 'write_rejected', origin: 'server-validator', key: 'sessionState',
  reason: 'phase must be one of exploration, encounter, travel, roleplay',
  description: 'Server rejected write to sessionState: phase must be one of exploration, encounter, travel, roleplay',
  timestamp: TS, ...o,
});

const laneDenied = (o = {}) => ({
  id: 'ed', type: 'enforcement_denied', creature: 'FeyRanger', bucket: 'bonusAction',
  source: 'useCharActionsAutomation', reason: 'No bonus action left this turn.',
  description: 'No bonus action left this turn.', timestamp: TS, ...o,
});

describe('write_rejected rows (server-validator refusals)', () => {
  beforeEach(beforeEachSetup);

  it('routes to the dedicated row, never the generic fallback', () => {
    setup(Log, [rejected()]);
    expect(q('.log-entry.log-write-rejected')).toBeInTheDocument();
    expect(q('.log-entry.log-generic')).toBeNull();
    expect(q('.log-write-rejected .log-icon i.fa-ban')).toBeInTheDocument();
    expect(q('.log-write-rejected .log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('renders a readable label + rejected key chip + refusal sentence', () => {
    setup(Log, [rejected()]);
    expect(q('.log-write-rejected-type').textContent).toBe('Write Rejected');
    expect(q('.log-write-rejected-key').textContent).toBe('sessionState');
    expect(q('.log-write-rejected-text').textContent)
      .toBe('Server rejected write to sessionState: phase must be one of exploration, encounter, travel, roleplay');
  });

  it('degrades honestly without description or key', () => {
    setup(Log, [rejected({ description: undefined, key: undefined })]);
    const row = q('.log-write-rejected');
    // Falls back to the bare reason sentence — never JSON, never "undefined".
    expect(row.textContent).toContain('phase must be one of');
    expect(row.querySelector('.log-write-rejected-key')).toBeNull();
    expect(row.textContent).not.toMatch(/[{}]/);
    expect(row.textContent).not.toContain('undefined');
  });

  it('markup in the reason renders as inert escaped text', () => {
    setup(Log, [rejected({
      reason: '<script>alert(1)</script>',
      description: 'Server rejected write to enforcement: <script>alert(1)</script>',
    })]);
    const row = q('.log-write-rejected');
    expect(row.querySelector('script')).toBeNull();
    expect(row.innerHTML).not.toMatch(/<script/);
  });

  it('Type dropdown offers Write Rejected and Enforcement Denied separately; each filter shows only its family', () => {
    setup(Log, [
      note({ id: 'n', noteText: 'a plain note' }),
      rejected(),
      laneDenied(),
    ]);
    const typeSelect = screen.getByLabelText('Type');
    const labels = [...typeSelect.querySelectorAll('option')].map(o => o.textContent);
    expect(labels).toContain('Write Rejected');
    expect(labels).toContain('Enforcement Denied');

    fireEvent.change(typeSelect, { target: { value: 'write_rejected' } });
    let rows = document.querySelectorAll('.log-entries .log-entry');
    expect(rows).toHaveLength(1);
    expect(rows[0].className).toContain('log-write-rejected');

    fireEvent.change(typeSelect, { target: { value: 'enforcement_denied' } });
    rows = document.querySelectorAll('.log-entries .log-entry');
    expect(rows).toHaveLength(1);
    expect(rows[0].className).toContain('log-generic');
    expect(rows[0].textContent).toContain('No bonus action left this turn.');
    expect(rows[0].textContent).not.toContain('Server rejected write');
  });
});
