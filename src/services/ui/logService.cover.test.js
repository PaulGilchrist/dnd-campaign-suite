// @maintained-by-ai
// Cover-aspect home for the attack-row audit message in src/services/ui/logService.js
// (REAL module, never mocked here — logService.test.js is the canonical whole-file
// home; this file locks the 2026-11-21 DDD backlog fix only). Bug: a covered attack
// row logged `…: 8 +4 (+4 to hit) vs AC 12 — MISS` while the very dice (12) WOULD
// hit raw 12 — the cover truth lived only in structured fields the Log view renders
// as a badge, so getEntryText/log-search/AI consumers saw a self-contradicting
// sentence. Law: when coverAcBonus > 0 the AC named in the message is the EFFECTIVE
// AC (targetAc + coverAcBonus) annotated with the LogRollEntry/DiceRollResult chip
// vocabulary ('1/2 Cover' / '3/4' via the same threeQuarter ternary). No-cover rows
// (coverAcBonus absent/0/null) keep byte-identical legacy text.
import { describe, it, expect } from 'vitest';
import { deriveAuditText, stampAuditText } from './logService.js';

// Real Bulwark-of-Force cover row bytes (DDD rig: monster-chip lane, pinned d20 8,
// +4 to hit, raw AC 12, +2 half cover — verdict flipped to MISS).
const COVERED_ATTACK_ROW = {
    type: 'roll', characterName: 'Goblin', rollType: 'attack', name: 'Longbow',
    rolls: [8], mode: 'normal', total: 8, bonus: 4, bonusDetail: '(+4 to hit)',
    isNatural20: false, isNatural1: false, targetName: 'FeyRanger', targetAc: 12,
    effectiveAc: 14, hit: false, isAutoMiss: false, isCrit: false,
    damageType: 'Piercing', rangeReason: null, resistanceNotice: null,
    coverLevel: 'half', coverAcBonus: 2, coverReason: 'Bulwark of Force',
    advantageReason: null,
};

describe('logService attack message — cover in effect', () => {
    it('names the EFFECTIVE AC with a chip-vocabulary annotation so the verdict reads consistently', () => {
        expect(deriveAuditText(COVERED_ATTACK_ROW)).toBe(
            'Goblin attacks FeyRanger with Longbow: 8 +4 (+4 to hit) vs AC 14 (1/2 Cover +2 AC) — MISS'
        );
    });

    it('renders 3/4 cover via the same threeQuarter ternary as the LogRollEntry badge', () => {
        // d20 16 + 4 = 20 vs raw 12 WOULD HIT; 3/4 cover (+5) → effective 17
        // is still stated and the row's own hit:false reads consistently.
        expect(deriveAuditText({ ...COVERED_ATTACK_ROW, coverLevel: 'threeQuarter', coverAcBonus: 5, total: 16 }))
            .toBe('Goblin attacks FeyRanger with Longbow: 16 +4 (+4 to hit) vs AC 17 (3/4 Cover +5 AC) — MISS');
    });

    it('a cover-flipped HIT on raw AC still reads consistently against the stated AC', () => {
        // d20 10 + 6 = 16 vs raw 14 would HIT; 3/4 cover (+5) → effective 19 → MISS.
        expect(deriveAuditText({ ...COVERED_ATTACK_ROW, total: 10, bonus: 6, bonusDetail: '(+6 to hit)', hit: false, coverAcBonus: 5, coverLevel: 'threeQuarter' }))
            .toBe('Goblin attacks FeyRanger with Longbow: 10 +6 (+6 to hit) vs AC 17 (3/4 Cover +5 AC) — MISS');
    });

    it('stampAuditText adds only the message key — structured cover fields ride untouched', () => {
        const stamped = stampAuditText(COVERED_ATTACK_ROW);
        expect(stamped).toEqual({ ...COVERED_ATTACK_ROW, message: deriveAuditText(COVERED_ATTACK_ROW) });
        expect(stamped.coverAcBonus).toBe(2);
        expect(stamped.coverLevel).toBe('half');
        expect(stamped.coverReason).toBe('Bulwark of Force');
        expect(stamped.targetAc).toBe(12);
        expect(COVERED_ATTACK_ROW).not.toHaveProperty('message');
    });

    it('leaves the AC clause alone when there is no AC to name', () => {
        expect(deriveAuditText({ ...COVERED_ATTACK_ROW, targetAc: null }))
            .toBe('Goblin attacks FeyRanger with Longbow: 8 +4 (+4 to hit) — MISS');
    });
});

describe('logService attack message — no cover (byte-identity regression pins)', () => {
    const NO_COVER = 'Goblin attacks ElderPaladin with Scimitar: 15 +4 (+4 to hit) vs AC 19 — HIT';

    it('covers coverAcBonus 0 with explicit coverLevel/coverReason null (real captured producer body shape)', () => {
        expect(deriveAuditText({ ...COVERED_ATTACK_ROW, targetName: 'ElderPaladin', name: 'Scimitar', total: 15, targetAc: 19, effectiveAc: 19, hit: true, coverLevel: null, coverAcBonus: 0, coverReason: null }))
            .toBe(NO_COVER);
    });

    it.each([
        ['coverAcBonus absent', {}],
        ['coverAcBonus 0', { coverAcBonus: 0 }],
        ['coverAcBonus null', { coverAcBonus: null }],
    ])('keeps the legacy sentence byte-identical when %s', (_label, coverFields) => {
        expect(deriveAuditText({
            type: 'roll', characterName: 'Goblin', rollType: 'attack', name: 'Scimitar',
            total: 15, bonus: 4, bonusDetail: '(+4 to hit)', targetName: 'ElderPaladin',
            targetAc: 19, hit: true, ...coverFields,
        })).toBe(NO_COVER);
    });
});
