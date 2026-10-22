// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as castingTimeModule from './castingTimeUtils.js';
import { normalizeCastingTime } from './castingTimeUtils.js';

// Module-direct unit-canonical home for the shared casting-time normalizer.
// Consumers delegate canon here (automationRouter.js:306, classifyBucket.js:83,
// featureCategorizationUtils.js:45/54/81, automationInfoBuilder/save.js:14,
// class-feature-handlers.js:20, rules.js:194, spellPreparationService.js:890,
// execution/index.js:67, spellResolution.js:174). Never mocked at this face;
// full-REAL pure string util, exact-of-0 mock census.

const listJsonFiles = (dir) => {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            files.push(...listJsonFiles(full));
        } else if (entry.endsWith('.json')) {
            files.push(full);
        }
    }
    return files;
};

// Every distinct "casting_time":"..." byte-string anywhere in public/data
// (5e + 2024/, spell-level and automation-level), extracted programmatically
// so disk drift fails loudly instead of silently re-baselining memory guesses.
const collectDiskCastingTimes = () => {
    const found = new Set();
    for (const file of listJsonFiles('public/data')) {
        const raw = readFileSync(file, 'utf8');
        const re = /"casting_time"\s*:\s*"([^"]*)"/g;
        let match;
        while ((match = re.exec(raw))) found.add(match[1]);
    }
    return found;
};

describe('normalizeCastingTime', () => {
    it('maps every distinct casting_time byte-string on disk through the pinned contract', () => {
        const diskTimes = [...collectDiskCastingTimes()].sort();
        // Drift-throw guards: the disk census must be non-empty and the pinned
        // table must cover the exact disk key-set (no fabricated keys allowed).
        expect(diskTimes.length).toBeGreaterThan(0);
        const observed = {};
        for (const ct of diskTimes) observed[ct] = normalizeCastingTime(ct);
        expect(observed).toStrictEqual({
            // 2024 Essentials title-case disk bytes normalize to canonical text
            'Action': '1 action',
            'Bonus Action': '1 bonus action',
            'Reaction': '1 reaction',
            // Canonical 5e lowercase and passive rows pass through unchanged
            '1 action': '1 action',
            '1 bonus action': '1 bonus action',
            '1 reaction': '1 reaction',
            'passive': 'passive',
            // Compound / ritual / trigger variants are NEVER split — whole-string passthrough
            'Action or Ritual': 'Action or Ritual',
            'Action or 8 hours': 'Action or 8 hours',
            '1 minute or Ritual': '1 minute or Ritual',
            '10 minutes or Ritual': '10 minutes or Ritual',
            '1 hour or Ritual': '1 hour or Ritual',
            '1 reaction, after attack': '1 reaction, after attack',
            // Duration texts are passthrough (no clock arithmetic — strings only)
            '1 minute': '1 minute',
            '10 minutes': '10 minutes',
            '1 hour': '1 hour',
            '8 hours': '8 hours',
            '12 hours': '12 hours',
            '24 hours': '24 hours',
        });
    });

    it('tolerates case, surrounding and internal whitespace, and underscores (STRUCT inputs; 0 underscores on disk)', () => {
        // STRUCT* provenance: inputs from the module's documented tolerance arms
        // plus consumer-supplied runtime JSON shapes (classifyBucket reads
        // auto.castTime from arbitrary feature data), not disk bytes.
        expect(normalizeCastingTime('action')).toBe('1 action');
        expect(normalizeCastingTime('  1 ACTION  ')).toBe('1 action');
        expect(normalizeCastingTime('bonus_action')).toBe('1 bonus action');
        expect(normalizeCastingTime('1 bonus_action')).toBe('1 bonus action');
        expect(normalizeCastingTime('1   bonus   action')).toBe('1 bonus action');
        expect(normalizeCastingTime('\tREACTION\n')).toBe('1 reaction');
        expect(normalizeCastingTime('PaSsIvE')).toBe('passive');
        // Unknown text (incl. lowercase ritual compound) has no map hit: passthrough
        expect(normalizeCastingTime('action or ritual')).toBe('action or ritual');
        expect(normalizeCastingTime('')).toBe(''); // empty-string falsy arm
    });

    it('is idempotent over the full disk set and the tolerance outputs', () => {
        // Law: normalize(normalize(x)) === normalize(x) for every disk byte-string
        // and every tolerance form, so repeated consumer calls are safe.
        for (const ct of collectDiskCastingTimes()) {
            expect(normalizeCastingTime(normalizeCastingTime(ct))).toBe(normalizeCastingTime(ct));
        }
        for (const raw of ['action', 'BONUS_ACTION', ' 1 Reaction ', 'special', '1 minute or Ritual']) {
            const once = normalizeCastingTime(raw);
            expect(normalizeCastingTime(once)).toBe(once);
        }
    });

    it('passes every non-string typeof through untouched and exposes one arity-1 export', () => {
        // Guard arm quantified across all typeof classes (disk census says text-typed;
        // the typeof guard exists only for off-disk callers). Identity via toBe.
        const obj = { casting_time: 'Action' };
        expect(normalizeCastingTime(undefined)).toBeUndefined();
        expect(normalizeCastingTime(null)).toBeNull();
        expect(normalizeCastingTime(42)).toBe(42); // number
        expect(normalizeCastingTime(false)).toBe(false); // boolean falsy arm
        expect(normalizeCastingTime(obj)).toBe(obj); // object identity preserved
        // Export census: single live export, no dead twins; arity vs REAL.
        expect(Object.keys(castingTimeModule)).toStrictEqual(['normalizeCastingTime']);
        expect(normalizeCastingTime.length).toBe(1);
    });
});
