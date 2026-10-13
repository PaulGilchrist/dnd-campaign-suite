/**
 * §18 D3 — 2024 dual-ruleset enforcement audit (characterization).
 *
 * Deterministic sweep of classifyBucket + the canTakeAction gates against
 * the action shapes BOTH rulesets' data actually produces (extracted from
 * public/data/*.json and public/data/2024/*.json on 2026-10-13):
 *   - 2024 spells: 'Action' / 'Bonus Action' / 'Reaction' / 'Action or Ritual'
 *     (+ one legacy '1 bonus action' survivor)
 *   - 2024 feats/classes: underscored row types ('bonus_action') and the
 *     passive family ('passive_rule', 'passive_buff', …)
 *   - 5e sheets: 'Bonus Action', automation.action 'bonus_action',
 *     casting_time '1 reaction, when targeted' compounds
 *
 * Audit outcome (owner-approved to build): the row-type lookup now
 * normalizes underscores and maps the passive family — the ONLY divergences
 * found. The gate itself (canTakeAction/turnState) charges generic slots
 * and is structurally ruleset-agnostic; FOCUS POINTS and Superiority Dice
 * stay class-resource latches, never slot charges (asserted below).
 */
import { classifyBucket, isChargeableBucket } from './classifyBucket.js';
import { canTakeAction } from '../canTakeAction.js';
import { hasBudget, spend, emptyTurnEntry } from '../turnState.js';

// ── 2024 spell casting-time shapes (title case is the 2024 dialect) ──
describe('D3 audit: 2024 spell shapes classify identically to 5e', () => {
    const cases = [
        // [casting_time (2024 dialect), expected bucket]
        ['Action', 'action'],
        ['Bonus Action', 'bonusAction'],
        ['Reaction', 'reaction'],
        ['Action or Ritual', 'action'],
        ['1 bonus action', 'bonusAction'],          // legacy survivor in 2024 data
        ['1 minute', 'action'],                      // long casts: out of combat, default action is inert
        ['1 hour or Ritual', 'action'],
        // 5e dialects must NOT regress:
        ['1 action', 'action'],
        ['1 reaction, when targeted', 'reaction'],
        ['1 bonus action (ritual)', 'bonusAction'],
    ];
    it.each(cases)('casting_time %s → %s', (casting_time, expected) => {
        expect(classifyBucket({ type: 'spell', automation: { casting_time } })).toBe(expected);
    });
});

// ── 2024 row-type dialects (underscored) and the passive family ──
describe('D3 audit: 2024 row types (the divergences found + fixed)', () => {
    it('underscored bonus_action rows charge the BONUS slot (was defaulting to action)', () => {
        expect(classifyBucket({ type: 'bonus_action' })).toBe('bonusAction');           // 2024 feats ×11
        expect(classifyBucket({ type: 'Bonus_Action' })).toBe('bonusAction');           // any casing
        expect(classifyBucket({ type: 'class_feature', automation: { action: 'bonus_action' } })).toBe('bonusAction');
    });

    it.each([
        'passive_rule', 'passive_buff', 'passive_immunity', 'save_proficiency', 'conditional_advantage', 'passive',
    ])('%s → passive, never chargeable', (type) => {
        expect(classifyBucket({ type })).toBe('passive');
        expect(isChargeableBucket('passive')).toBe(false);
    });

    it('the OTHER ruleset is structurally agnostic — same rows, same buckets both ways', () => {
        const r5e = { rules: '5e', type: 'Bonus Action' };
        const r2024 = { rules: '2024', type: 'bonus_action' };
        expect(classifyBucket(r5e)).toBe(classifyBucket(r2024));
    });
});

// ── gate-level: enforcement charges the same slots for both rulesets ──
describe('D3 audit: the gate charges generic slots (ruleset-agnostic by design)', () => {
    const ON = { mode: 'on', turnLock: true, actionEconomy: true };
    const ctx = (over = {}) => ({
        enforcement: ON, creatureName: 'Rakan', activeCreatureName: 'Rakan',
        turnState: null, cannotAct: false, cannotActActions: false, cannotActReason: null, hasBudget, ...over,
    });

    it('2024 bonus-action feat and 5e bonus-action spell land on the SAME bucket', () => {
        const turnState = { Rakan: { ...emptyTurnEntry(), bonusActionsUsed: 1 } };
        for (const subject of [{ rules: '2024', type: 'bonus_action' }, { rules: '5e', automation: { casting_time: '1 bonus action' } }]) {
            const bucket = classifyBucket(subject);
            expect(bucket).toBe('bonusAction');
            const r = canTakeAction(ctx({ bucket, turnState }));
            expect(r.allowed).toBe(false); // same denial, both rulesets
            expect(spend(turnState, 'Rakan', bucket).ok).toBe(false);
        }
    });

    it('class resources never touch the slot economy: a Focus Point cast still costs the Action', () => {
        // 2024 Focus Points spend their OWN latch upstream; by the time the
        // cast reaches the gate it is an Action-bucket attempt — asserted here
        // so no future wiring can silently make it 'free'.
        const focusCast = { rules: '2024', name: 'Magic Missile (Focus)', automation: { action: 'cast_spell', casting_time: 'Action', focus_points: 1 } };
        expect(classifyBucket(focusCast)).toBe('action');
        const turnState = { Rakan: { ...emptyTurnEntry(), actionsUsed: 1 } };
        expect(canTakeAction(ctx({ bucket: classifyBucket(focusCast), turnState })).allowed).toBe(false);
    });
});
