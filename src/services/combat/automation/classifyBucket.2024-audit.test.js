// @maintained-by-ai
/**
 * §18 D3 — 2024 dual-ruleset classifier audit (real-data census lane).
 *
 * Twin split with ./classifyBucket.test.js:
 *   - base lane   = generic classifier decision order (canonical rules).
 *   - this lane   = REAL authored JSON: every casting-time / row-type
 *     dialect that actually exists on disk, /data/2024/ (2024 Essentials)
 *     vs shared /data/ (5e spells are per-ruleset; equipment/monsters
 *     are the only truly shared files).
 *
 * Audit value = DATA regressions: an unauthored dialect silently defaults
 * to the chargeable 'action' bucket, so the censuses below are byte-exact
 * tripwires — new shapes must fail here and force triage. Golden buckets
 * are hand-derived ONCE from the classifier decision order
 * (classifyBucket.js: row lane → automation.action → normalizeCastingTime
 * → safe default 'action'), never recomputed from the implementation.
 *
 * Removed from this lane (forwarding cites, 2026-10-19):
 *   - canTakeAction/turnState gate tests — the gate consumes an already-
 *     resolved bucket string (ruleset-agnostic by signature); exhaustion
 *     denial is covered by canTakeAction.test.js ('denies when the bucket
 *     budget is exhausted') and turnState.test.js ('charges each bucket up
 *     to its cap then refuses').
 *   - isChargeableBucket('passive') and row-lane precedence → base lane.
 *   - fabricated 'Bonus_Action' casing and { rules: … } mirror rows — the
 *     classifier never reads `rules`; the real dialects are covered below.
 */
import { describe, it, expect } from 'vitest';
import { classifyBucket } from './classifyBucket.js';
import spells2024 from '../../../../public/data/2024/spells.json';
import spells5e from '../../../../public/data/spells.json';
import feats2024 from '../../../../public/data/2024/feats.json';
import classes2024 from '../../../../public/data/2024/classes.json';

const sorted = (arr) => [...arr].sort((a, b) => String(a).localeCompare(String(b)));
const distinctSorted = (arr) => sorted([...new Set(arr)]);

/** Every clickable authored row: a named row carrying an automation object. */
function clickedRows(json) {
    const rows = [];
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === 'object') {
            if (typeof node.name === 'string' && node.automation && typeof node.automation === 'object') rows.push(node);
            Object.values(node).forEach(walk);
        }
    };
    walk(json);
    return rows;
}

// ── spell casting-time censuses (title case is the 2024 dialect) ──
const CASTING_GOLDEN_2024 = [
    ['Action', 'action'],
    ['Action or Ritual', 'action'],
    ['Action or 8 hours', 'action'],
    ['Bonus Action', 'bonusAction'],
    ['Reaction', 'reaction'],
    ['1 bonus action', 'bonusAction'],   // legacy survivor in 2024 data
    ['1 minute', 'action'],              // long casts: default action bucket (inert out of combat)
    ['1 minute or Ritual', 'action'],
    ['10 minutes', 'action'],
    ['10 minutes or Ritual', 'action'],
    ['1 hour', 'action'],
    ['1 hour or Ritual', 'action'],
    ['8 hours', 'action'],
    ['12 hours', 'action'],
    ['24 hours', 'action'],
    [null, 'action'],                    // missing casting_time (Aura of Vitality) — authored-data gap, reported 2026-10-19
];
const CASTING_GOLDEN_5E = [
    ['1 action', 'action'],
    ['1 bonus action', 'bonusAction'],
    ['1 reaction', 'reaction'],
    ['1 minute', 'action'],
    ['10 minutes', 'action'],
    ['1 hour', 'action'],
    ['8 hours', 'action'],
    ['12 hours', 'action'],
    ['24 hours', 'action'],
];

describe('D3 audit: spell casting_time census of the REAL spell files', () => {
    it('2024 (/data/2024/spells.json) casting_time set is exactly the audited golden dialects', () => {
        expect(distinctSorted(spells2024.map((s) => s.casting_time ?? null))).toEqual(sorted(CASTING_GOLDEN_2024.map(([ct]) => ct)));
    });

    it('5e (/data/spells.json) casting_time set is exactly the audited golden dialects (no dialect drift)', () => {
        expect(distinctSorted(spells5e.map((s) => s.casting_time))).toEqual(sorted(CASTING_GOLDEN_5E.map(([ct]) => ct)));
    });

    it.each(CASTING_GOLDEN_2024)('2024 verbatim spell row, casting_time %s → %s', (casting_time, bucket) => {
        const row = spells2024.find((s) => (s.casting_time ?? null) === casting_time); // real row, fed as authored
        expect(row).toBeDefined();
        expect(classifyBucket(row)).toBe(bucket);
    });

    it.each(CASTING_GOLDEN_5E)('5e verbatim spell row, casting_time %s → %s', (casting_time, bucket) => {
        const row = spells5e.find((s) => s.casting_time === casting_time);
        expect(row).toBeDefined();
        expect(classifyBucket(row)).toBe(bucket);
    });

    // Compound reaction shapes — the §18 D3 bugfix: leading-form resolution
    // existed for bonus ONLY, so '1 reaction, …' defaulted to an Action charge.
    // Shapes are real authored text (Fighter Telekinetic Thrust automation in
    // 2024 classes.json; the counterspell wording on 5e sheets), fed as the
    // casting-time shapes the classifier documents.
    it.each([
        ['1 reaction, after attack', 'reaction'],
        ['1 reaction, when targeted', 'reaction'],
    ])('compound casting_time %s → %s (leading-form), not a default action charge', (casting_time, bucket) => {
        expect(classifyBucket({ type: 'spell', automation: { casting_time } })).toBe(bucket);
    });
});

// ── 2024 clickable-row dialects (feats benefits + class features) ──
describe('D3 audit: 2024 clicked-row dialects from the REAL feats/classes JSON', () => {
    const rows = [...clickedRows(feats2024), ...clickedRows(classes2024)];

    it('underscored bonus_action rows charge the BONUS bucket (D3 fix: was defaulting to action)', () => {
        const bonus = rows.filter((r) => r.type === 'bonus_action' || r.automation.action === 'bonus_action');
        expect(bonus.length).toBeGreaterThanOrEqual(20); // feats ×9 typed + class/subclass automation rows
        for (const r of bonus) expect(classifyBucket(r)).toBe('bonusAction');
    });

    // The passive family lives in automation.type on rows with NO lane type —
    // exactly where D3 found them defaulting to a chargeable action. These are
    // all four such tokens present in the authored JSON (conditional_advantage
    // only ever arrives under a typed row, so it is not in this census).
    it.each(['passive_rule', 'passive_buff', 'passive_immunity', 'save_proficiency'])(
        'passive family %s (real untyped row) → passive, never a slot charge',
        (autoType) => {
            const family = rows.filter((r) => !r.type && r.automation.type === autoType);
            expect(family.length).toBeGreaterThan(0);
            for (const r of family) expect(classifyBucket(r)).toBe('passive');
        },
    );

    it('row lane beats automation on real feat benefits (passive prose never charges)', () => {
        const passiveRow = rows.find((r) => r.type === 'passive' && String(r.automation.type).includes('reaction'));
        expect(passiveRow).toBeDefined(); // real feats: passive row carrying reaction_bonus
        expect(classifyBucket(passiveRow)).toBe('passive');
        expect(classifyBucket(rows.find((r) => r.type === 'reaction'))).toBe('reaction');
    });

    it('non-lane benefit types follow the documented order: casting_time first, then safe default action', () => {
        // 'special' is NOT a lane token (ROW_BUCKET has 'special action'), but
        // the real special benefit (Bolstering Performance) still lands passive
        // via its automation casting_time — not via the default.
        const special = rows.find((r) => r.type === 'special');
        expect(classifyBucket(special)).toBe('passive');
        // A row with no lane, no action token and no casting_time defaults to
        // the chargeable 'action' bucket (documented safe direction).
        const noCasting = rows.find((r) => r.type === 'damage' && !r.automation.action && !r.automation.casting_time);
        expect(noCasting).toBeDefined();
        expect(classifyBucket(noCasting)).toBe('action');
    });

    it('focus_points is never a classifier input: a Focus cast still costs the Action', () => {
        // Focus Points spend their own latch upstream (resourceCost 'Focus' in
        // the automation-info sorcery lane); the bucket must stay 'action' so
        // no future wiring can make a Focus cast slot-free.
        expect(classifyBucket({ automation: { action: 'cast_spell', casting_time: 'Action', focus_points: 1 } })).toBe('action');
    });
});
