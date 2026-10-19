// @maintained-by-ai
/**
 * Base lane — classifyBucket generic decision-order rules, authoritative single
 * taxonomy (L5-002 §7.2). Synthetic fixtures only; zero mocks (classifier is
 * pure); golden buckets hand-derived from the documented order, never
 * recomputed from the implementation (#815); exact bytes (#829).
 *
 * Twin split (#983):
 *   - this lane    = generic rules: every branch once, precedence edges,
 *                    honest default (#945). Gate consumption lives in
 *                    canTakeAction.test.js / turnState.test.js — never
 *                    re-driven here (gates take a resolved bucket string).
 *   - audit lane (./classifyBucket.2024-audit.test.js) owns dialects on disk:
 *                    real-file / dual-dataset censuses, real passive family,
 *                    compound REACTION shapes, the non-lane 'special' gap, and
 *                    the focus_points guard. Underscore row dialects
 *                    ('bonus_action') are real-data faces → audit lane.
 *
 * Branch census (classifyBucket.js; order: row lane → action lane → casting
 * lane → safe default):
 *   1. row lane    — typeKey from subject.type || automation.type → ROW_BUCKET (10 tokens)
 *   2. action lane — automation.action → ACTION_BUCKET (5 tokens)
 *   3. casting lane— normalizeCastingTime(casting_time | castTime) → CASTING_BUCKET
 *                    (3) + bare-form normalizer + leading-form regex (bonus leg here)
 *   4. default     — unmatched / non-object → chargeable 'action' (#945)
 *   plus accepted subject shapes and the isChargeableBucket / BUCKETS partition (#800).
 *
 * Old→new map: 'row type' → row-lane table (+free-interaction, +passive
 * family); 'action field' → action-lane table (+passive, +free);
 * 'casting_time' → casting-lane table (+exact-table keys, +'1 action' default
 * leg); 'row beats casting_time' → precedence chain (+two new edges);
 * 'defaults', 'multi-attack', 'isChargeableBucket' → kept.
 */
import { describe, it, expect } from 'vitest';
import { classifyBucket, isChargeableBucket, FREE_BUCKETS, BUCKETS } from './classifyBucket.js';

describe('classifyBucket row lane (typeKey → ROW_BUCKET)', () => {
    // Every ROW_BUCKET token once, canonical sheet dialect.
    it.each([
        ['Bonus Action', 'bonusAction'],
        ['Reaction', 'reaction'],
        ['Free Interaction', 'free'],
        ['Special Action', 'special'],
        ['Passive', 'passive'],
        // Passive family (§18 D3): prose rows never charge a slot.
        ['Passive Rule', 'passive'],
        ['Passive Buff', 'passive'],
        ['Passive Immunity', 'passive'],
        ['Save Proficiency', 'passive'],
        ['Conditional Advantage', 'passive'],
    ])('row type %s → %s', (type, bucket) => {
        expect(classifyBucket({ type })).toBe(bucket);
    });
});

describe('classifyBucket action lane (automation.action → ACTION_BUCKET)', () => {
    // Every ACTION_BUCKET token once; row lane kept silent.
    it.each([
        ['bonus_action', 'bonusAction'],
        ['reaction', 'reaction'],
        ['passive', 'passive'],
        ['none', 'free'],
        ['free', 'free'],
    ])('automation.action %s → %s', (action, bucket) => {
        expect(classifyBucket({ automation: { action } })).toBe(bucket);
    });
});

describe('classifyBucket casting lane (normalizer → CASTING_BUCKET → leading form)', () => {
    it.each([
        ['1 bonus action', 'bonusAction'],   // CASTING_BUCKET exact key
        ['1 reaction', 'reaction'],          // CASTING_BUCKET exact key
        ['passive', 'passive'],              // CASTING_BUCKET exact key
        ['bonus action', 'bonusAction'],     // bare form via normalizer → '1 bonus action'
        ['1 action', 'action'],              // no CASTING_BUCKET key: arrives via safe default leg
        ['1 bonus action (ritual)', 'bonusAction'], // compound leading form (reaction compound leg → audit lane)
    ])('casting_time %s → %s', (casting_time, bucket) => {
        expect(classifyBucket({ casting_time })).toBe(bucket);
    });
});

describe('classifyBucket accepted subject shapes', () => {
    it.each([
        ['bare automation-info object', { action: 'bonus_action' }, 'bonusAction'],
        ['camelCase castTime key', { automation: { castTime: '1 reaction' } }, 'reaction'],
    ])('%s is read directly', (_label, subject, bucket) => {
        expect(classifyBucket(subject)).toBe(bucket);
    });
});

describe('classifyBucket precedence chain (#842: one falsifiable leg per edge)', () => {
    it.each([
        ['row lane beats action lane', { type: 'Reaction', automation: { action: 'bonus_action' } }, 'reaction'],
        ['row lane beats casting lane', { type: 'Bonus Action', casting_time: '1 action' }, 'bonusAction'],
        ['automation.type beats automation.action', { automation: { type: 'Reaction', action: 'bonus_action' } }, 'reaction'],
        ['action lane beats casting lane', { automation: { action: 'none', casting_time: '1 bonus action' } }, 'free'],
    ])('%s', (_label, subject, bucket) => {
        expect(classifyBucket(subject)).toBe(bucket);
    });
});

describe('classifyBucket honest default (#945)', () => {
    // All signals absent, or unknown tokens → the documented chargeable 'action'.
    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'nope'],
        ['named row, no signals', { name: 'Mystery' }],
        ['unknown casting_time', { casting_time: '1 minute' }],
    ])('%s → action (safe chargeable direction)', (_label, subject) => {
        expect(classifyBucket(subject)).toBe('action');
    });
});

it('multi-attack is still one action (charges the slot, not attack count)', () => {
    // Extra Attack style: one action row, many attacks attached.
    expect(classifyBucket({ type: 'Action', automation: { action: 'attack', attacks: 3 } })).toBe('action');
});

describe('isChargeableBucket / FREE_BUCKETS partition', () => {
    const CHARGEABLE_GOLDEN = [
        ['action', true],
        ['bonusAction', true],
        ['reaction', true],
        ['free', false],
        ['special', false],
        ['passive', false],
    ];

    it('the golden table covers the whole BUCKETS taxonomy (tripwire for new buckets)', () => {
        expect(CHARGEABLE_GOLDEN.map(([b]) => b).sort()).toEqual([...BUCKETS].sort());
    });

    it.each(CHARGEABLE_GOLDEN)('charges %s → %s', (bucket, chargeable) => {
        expect(isChargeableBucket(bucket)).toBe(chargeable);
    });

    it("'none' is free, an unknown bucket charges (safe direction)", () => {
        expect(FREE_BUCKETS).toContain('none');
        expect(isChargeableBucket('none')).toBe(false);
        expect(isChargeableBucket('not-a-bucket')).toBe(true);
    });
});
