// spellPreparationService.arity-unify.test.js — STRUCTURAL family-consistency lock
// (owner unify call, ledger test-maintain-bugs.md batch #217 ⚠ entry #1512/#1513/#1514).
//
// The confirmed defect family: seven-plus 2-arg default-tier READ sites (arcanum/
// favored/NR/Bewitching/WGB/recast/Mantle) coexisted with 3-arg peers inside this
// one file. Under today's arity-2 store law (useRuntimeState.js:63 declares only
// (characterKey, propertyName) — the 3rd arg is discarded, fix#26 canon) the two
// shapes are byte-identical in OUTPUT, so the asymmetry is invisible at runtime;
// when the #1520 campaign-scoped store lands it would silently split the family —
// 3-arg peers read the right tier, 2-arg reads the wrong one. The whole family was
// therefore unified to the file's own explicit vocabulary: EVERY getRuntimeValue
// call carries campaignName.
//
// This lane locks that shape at the SOURCE level (fix#211 disk-alignment census
// idiom): any new 2-arg read added to spellPreparationService.js goes RED here,
// in any environment, with zero runtime needed. It is a pure static scan — no
// store, no mocks, no timers (NO-CLOCK).
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'spellPreparationService.js');

// Extract every `name(...)` invocation body with paren depth-tracking so nested
// calls (featureFreeCastKey(entry)) and template literals (mysticArcanumLevel${x})
// are captured whole. Skips the import statement (no paren) and comment mentions
// are harmless — both sides of every comment reference already carry campaignName.
function callBodies(src, name) {
  const bodies = [];
  const needle = `${name}(`;
  let idx = 0;
  while ((idx = src.indexOf(needle, idx)) !== -1) {
    if (src.slice(Math.max(0, idx - 7), idx).includes('import')) { idx += needle.length; continue; }
    let depth = 1;
    let i = idx + needle.length;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
    }
    bodies.push(src.slice(idx + needle.length, i - 1));
    idx = i;
  }
  return bodies;
}

// The seven flagged helper carriers plus the direct-call tier argument rule.
const THREADED_HELPERS = [
  'featureFreeCastCount',
  'rechargeEntryGrantsCast',
  'runtimeSelectionFreeCast',
  'arcanumFreeCast',
  'activeBuffFreeCast',
  'getWarlockSlotLevel',
  'isWarGodsBlessingSpell',
];

describe('spellPreparationService — family arity-consistency lock (reads carry campaignName, #1520 forward-lock)', () => {
  const src = readFileSync(SRC, 'utf8');

  it('EVERY getRuntimeValue( call in the source passes campaignName as its 3rd argument — zero default-tier reads survive', () => {
    const bodies = callBodies(src, 'getRuntimeValue');
    // Census count pin (#1521 idiom): a new read forces this table to be re-audited.
    expect(bodies.length).toBeGreaterThanOrEqual(46);
    const offenders = bodies.filter(b => !b.trimEnd().endsWith('campaignName'));
    expect(offenders, `2-arg default-tier reads reintroduced: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it('EVERY threaded-helper call site forwards campaignName (the seven-family plumbing stays wired)', () => {
    for (const helper of THREADED_HELPERS) {
      const bodies = callBodies(src, helper); // includes the `function helper(...)` declaration — its last param is campaignName at every threaded helper
      expect(bodies.length, `${helper}: no call sites found`).toBeGreaterThan(0);
      for (const body of bodies) {
        expect(body.trimEnd().endsWith('campaignName'),
          `${helper} dropped campaignName: ${body.trim()}`).toBe(true);
      }
    }
  });

  it('READ-then-WRITE pairs are arity-symmetric on the flagged carriers (write 4-arg => read 3-arg)', () => {
    // The asymmetry pairs the ledger cited: writes at these carriers always carried
    // campaignName; the reads did not. Static pairing: every setRuntimeValue call
    // naming a flagged carrier key must have a getRuntimeValue sibling carrying the
    // same tier argument on BOTH sides of the lane.
    const carriers = ['naturalRecoveryFreeCast', '_Bewitching_Magic_freeCast', '_Favored_Enemy_freeCastCount', 'sorceryPoints', '_War_Gods_Blessing_active'];
    for (const carrier of carriers) {
      const reads = callBodies(src, 'getRuntimeValue').filter(b => b.includes(`'${carrier}'`));
      const writes = callBodies(src, 'setRuntimeValue').filter(b => b.includes(`'${carrier}'`));
      if (writes.length > 0) {
        expect(reads.length, `carrier ${carrier} has writers but no reader sibling to compare tiers with`).toBeGreaterThan(0);
      }
      for (const r of reads) expect(r.trimEnd().endsWith('campaignName'), `read of ${carrier} dropped campaignName`).toBe(true);
      for (const w of writes) expect(w.trimEnd().endsWith('campaignName'), `write of ${carrier} dropped campaignName`).toBe(true);
    }
  });
});
