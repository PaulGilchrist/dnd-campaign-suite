// @maintained-by-ai
// bug-monster-ranged-attack-wrong-range-bands: the monster-card press lane's
// resolveAttackRange fell back to a hard-coded 30 ft when an action JSON
// carried no structured `range` field (42 ranged actions, incl. Goblin
// Shortbow / Hobgoblin Longbow — their prose says "range 80/320 ft." /
// "range 150/600 ft."), so a 35-ft Shortbow shot was forced disadvantaged and
// a 65-ft shot auto-missed. The token is now derived reach → range → authored
// prose, returned RAW (dual notation preserved for rangePairToFeet), and stays
// null (LENIENT — no fabricated band) when nothing is derivable.
import { describe, it, expect } from 'vitest';
import { resolveAttackRange } from './MonsterCardHelpers.js';

describe('resolveAttackRange — structured fields win, prose is the fallback', () => {
  // Verbatim bestiary bytes (public/data/monsters.json).
  const GOB_SCIMITAR = { name: 'Scimitar', reach: '5 ft.', description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.' };
  const GOB_SHORTBOW = { name: 'Shortbow', description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.' };
  const HOB_LONGBOW = { name: 'Longbow', description: 'Ranged Weapon Attack: +3 to hit, range 150/600 ft., one target. Hit: 5 (1d8 + 1) piercing damage.' };

  it('structured reach beats everything', () => {
    expect(resolveAttackRange(GOB_SCIMITAR)).toBe('5 ft.');
  });

  it('structured range wins over prose', () => {
    expect(resolveAttackRange({ range: '20/60 ft.', description: '… range 80/320 ft. …' })).toBe('20/60 ft.');
  });

  it('prose dual notation is derived RAW (never a fabricated 30)', () => {
    expect(resolveAttackRange(GOB_SHORTBOW)).toBe('80/320 ft.');
    expect(resolveAttackRange(HOB_LONGBOW)).toBe('150/600 ft.');
  });

  it('prose single range and reach tokens carry through with a unit suffix', () => {
    expect(resolveAttackRange({ description: 'Ranged Spell Attack: +7 to hit, range 60 ft., one target.' })).toBe('60 ft.');
    expect(resolveAttackRange({ description: 'Melee Weapon Attack: +5 to hit, reach 10 feet, one target.' })).toBe('10 ft.');
  });

  it('whitespace inside the dual token is normalized for rangePairToFeet', () => {
    expect(resolveAttackRange({ description: 'Ranged Weapon Attack: +6 to hit, range 30 / 120 ft., one target.' })).toBe('30/120 ft.');
  });

  it('nothing derivable → null (lenient — the band is never invented)', () => {
    expect(resolveAttackRange({ description: 'Melee Spell Attack: +5 to hit, one target. Hit: 10 necrotic damage.' })).toBeNull();
    expect(resolveAttackRange({})).toBeNull();
    expect(resolveAttackRange(null)).toBeNull();
    // Prose naming the word without a numeric feet token is not a range.
    expect(resolveAttackRange({ description: 'The target must move within range or fall.' })).toBeNull();
  });
});
