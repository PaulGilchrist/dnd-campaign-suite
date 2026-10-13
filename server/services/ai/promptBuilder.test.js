// L5 Phase 3 — prompt builder + answer parsing tests.
import { describe, it, expect } from 'vitest';
import { buildRefereeMessages, compactContext, parseRulingAnswer } from './promptBuilder.js';

describe('compactContext', () => {
    it('compacts combat state to scalars with caps', () => {
        const ctx = compactContext({
            combatSummary: {
                round: 3,
                activeCreatureName: 'Dragon',
                creatures: Array.from({ length: 40 }, (_, i) => ({
                    name: `C${i}`, type: 'npc', ac: 12, currentHp: 5, maxHp: 10,
                    conditions: ['prone'], targetName: null,
                })),
            },
            turnState: { Dragon: { actionsUsed: 1, bonusActionsUsed: 0, reactionsUsed: 1, movementUsedFeet: 20 } },
            enforcement: { mode: 'on', turnLock: true, zones: false },
        });
        expect(ctx.round).toBe(3);
        expect(ctx.activeCreature).toBe('Dragon');
        expect(ctx.creatures.length).toBe(30);            // capped
        expect(ctx.enforcementFlags).toEqual(['turnLock']); // only TRUE flags
        expect(ctx.creatures[0].economy).toBeNull();
    });

    it('survives empty/missing state', () => {
        expect(compactContext()).toMatchObject({ round: null, activeCreature: null, creatures: [] });
    });
});

describe('buildRefereeMessages', () => {
    it('carries system contract + action + compact state, never full secrets', () => {
        const msgs = buildRefereeMessages({
            action: 'I cast fire bolt at the goblin',
            characterName: 'HexWarlock',
            state: { combatSummary: { round: 1, creatures: [{ name: 'Goblin', currentHp: 7 }] } },
        });
        expect(msgs[0].role).toBe('system');
        expect(msgs[0].content).toContain('NEVER state dice results');
        expect(msgs[1].content).toContain('fire bolt');
        expect(msgs[1].content).toContain('HexWarlock');
        expect(msgs[1].content).toContain('"round":1');
    });
});

describe('parseRulingAnswer', () => {
    it('accepts raw JSON and fenced JSON (small models love fences)', () => {
        const ok = JSON.stringify({ type: 'narrative', text: 'ok' });
        expect(parseRulingAnswer(ok)).toMatchObject({ ok: true, ruling: { type: 'narrative' } });
        expect(parseRulingAnswer('```json\n' + ok + '\n```')).toMatchObject({ ok: true });
        expect(parseRulingAnswer('Sure! Here you go:\n```json\n' + ok + '\n```\nEnjoy!')).toMatchObject({ ok: true });
    });

    it('rejects prose, malformed JSON, and invalid schemas — fails closed', () => {
        expect(parseRulingAnswer('The goblin dies.').ok).toBe(false);
        expect(parseRulingAnswer('{"type": ').ok).toBe(false);
        expect(parseRulingAnswer('{"type":"save_roll"}').ok).toBe(false);
        expect(parseRulingAnswer('').ok).toBe(false);
    });
});
