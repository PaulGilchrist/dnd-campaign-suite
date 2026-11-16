// @maintained-by-ai: 2026-11-16
// Pure-lane pins for the client bestiary-name gate service: the predicate
// mirrors server/routes/npcs.js `isBestiaryMonsterName` semantics EXACTLY
// (trim + lowercase, exact match against the monsters.json name-set), the
// hint copy is byte-identical to the server's `bestiaryNameError()`, the
// name-set is fetched ONCE via the cached dataLoader, and a failed load
// fails OPEN (null set → gate inert → server 400 stays the backstop).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoadMonsters = vi.fn();
vi.mock('../ui/dataLoader.js', () => ({
  loadMonsters: (...args) => mockLoadMonsters(...args),
}));

// Fresh module instance per test: the memoized name-set promise is
// module-level by design (fetch once app-wide).
let guard;
beforeEach(async () => {
  vi.resetModules();
  mockLoadMonsters.mockReset();
  guard = await import('./bestiaryNameGuard.js');
});

describe('bestiaryNameGuard — server-guard mirror', () => {
  it('builds the lower-cased name-set from a bare array, once (module memo)', async () => {
    mockLoadMonsters.mockResolvedValue([{ name: 'Goblin' }, { name: 'Ogre' }, { nope: 1 }]);
    const first = await guard.loadBestiaryMonsterNames();
    const second = await guard.loadBestiaryMonsterNames();

    expect(mockLoadMonsters).toHaveBeenCalledTimes(1); // fetched ONCE
    expect(second).toBe(first);
    expect([...first].sort()).toEqual(['goblin', 'ogre']); // nameless rows dropped
  });

  it('accepts the { monsters: [...] } shape too (mirrors the server reader)', async () => {
    mockLoadMonsters.mockResolvedValue({ monsters: [{ name: 'Goblin' }] });
    const nameSet = await guard.loadBestiaryMonsterNames();
    expect(guard.isBestiaryMonsterName('Goblin', nameSet)).toBe(true);
  });

  it('predicate mirrors the server: trim + case-fold, exact match only, inert while unset', async () => {
    const nameSet = new Set(['goblin']);
    expect(guard.isBestiaryMonsterName('Goblin', nameSet)).toBe(true);
    expect(guard.isBestiaryMonsterName('  GOBLIN  ', nameSet)).toBe(true); // PUT-lane trim
    expect(guard.isBestiaryMonsterName('Goblins', nameSet)).toBe(false); // never substring
    expect(guard.isBestiaryMonsterName('', nameSet)).toBe(false);
    expect(guard.isBestiaryMonsterName('Goblin', null)).toBe(false); // loading/failed
  });

  it('fails OPEN when the data cannot load — null set, gate inert', async () => {
    mockLoadMonsters.mockRejectedValue(new Error('monsters.json unavailable'));
    const nameSet = await guard.loadBestiaryMonsterNames();
    expect(nameSet).toBeNull();
    expect(guard.isBestiaryMonsterName('Goblin', nameSet)).toBe(false);
  });

  it('hint copy is byte-identical to the server bestiaryNameError() (no invented vocabulary)', () => {
    // Pinned verbatim from server/routes/npcs.js:43 — change BOTH lanes together.
    expect(guard.bestiaryNameError('Goblin')).toBe(
      '"Goblin" is a published monster — monsters join through the Encounter Builder ' +
      'with their real stat block. NPCs are for custom characters with their own name.'
    );
    // The server PUT lane quotes the TRIMMED name.
    expect(guard.bestiaryNameError('  goblin ')).toBe(guard.bestiaryNameError('goblin'));
  });
});
