// @maintained-by-ai
// Shared refine echo-detection (backlog echo-no-op-audit): the client's
// no-change notice and the server's no-op audit row must agree — this
// predicate is their single source of truth. Shapes mirror the AiRefineButton
// tests (which pin the component-level UX over the same function).
import { describe, it, expect } from 'vitest';
import { proposedNoChange, SERVER_OWNED_KEYS } from './proposedNoChange.js';

describe('proposedNoChange — refine echo predicate (shared client/server)', () => {
  it('a verbatim echo of the input is no change', () => {
    expect(proposedNoChange(
      { name: 'Marta', description: 'Innkeeper' },
      { name: 'Marta', description: 'Innkeeper' },
    )).toBe(true);
  });

  it('ignores server-owned stamps on the current row (never round-trip)', () => {
    expect(SERVER_OWNED_KEYS).toEqual(['id', 'updatedAt', 'savedAt', 'draft']);
    expect(proposedNoChange(
      { id: 'n1', updatedAt: 7, savedAt: 8, draft: true, name: 'Marta' },
      { name: 'Marta' },
    )).toBe(true);
  });

  it('deep-equals nested structures', () => {
    const links = { encounters: ['e1'], notes: ['a'] };
    expect(proposedNoChange({ name: 'S', links }, { name: 'S', links: { encounters: ['e1'], notes: ['a'] } })).toBe(true);
    expect(proposedNoChange({ name: 'S', links }, { name: 'S', links: { encounters: ['e2'], notes: ['a'] } })).toBe(false);
  });

  it('a real edit is a change', () => {
    expect(proposedNoChange(
      { name: 'Marta', description: 'Innkeeper' },
      { name: 'Marta', description: 'Retired cult spy' },
    )).toBe(false);
  });

  it('dropping a field the GM filled in is a change (would alter the form)', () => {
    expect(proposedNoChange(
      { name: 'Marta', description: 'Innkeeper' },
      { name: 'Marta' },
    )).toBe(false);
  });

  it('dropping an empty field is still no change', () => {
    expect(proposedNoChange(
      { name: 'Marta', description: '', secret: null, mood: undefined },
      { name: 'Marta' },
    )).toBe(true);
  });

  it('garbage replacements are never no-change', () => {
    expect(proposedNoChange({ name: 'Marta' }, null)).toBe(false);
    expect(proposedNoChange({ name: 'Marta' }, 'Marta')).toBe(false);
  });
});
