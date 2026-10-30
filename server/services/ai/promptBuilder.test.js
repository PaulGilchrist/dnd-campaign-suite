// L5 Phase 3 — prompt builder + answer parsing tests.
import { describe, it, expect, vi } from 'vitest';
import { buildRefereeMessages, compactContext, parseRulingAnswer } from './promptBuilder.js';

// Drift pin: REFEREE_SYSTEM must enumerate the REAL registry keys. The
// registry imports client runtime hooks — stub that boundary so the server
// test can read the definitions the prompt is required to mirror.
vi.mock('../../../src/hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
import { TARGET_EFFECT_DEFINITIONS } from '../../../src/services/combat/conditions/targetEffectDefinitions.js';

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

    it('hp_change schema line carries the required expression (matches the enforced check)', () => {
        const s = buildRefereeMessages({ action: 'x', characterName: null, state: {} })[0].content;
        expect(s).toContain('{"type":"hp_change","targetName":"...","expression":"2d6+3","amount":-7');
        expect(s).toMatch(/for type "hp_change", "expression" is REQUIRED/i);
        expect(s).toMatch(/never a bare number/i);
    });
});

describe('parseRulingAnswer — hp_change provenance gate', () => {
    it('bare-amount hp_change is rejected; amount + dice expression parses', () => {
        expect(parseRulingAnswer('{"type":"hp_change","targetName":"X","amount":-6,"explanation":"claws"}').ok).toBe(false);
        expect(parseRulingAnswer('{"type":"hp_change","targetName":"X","expression":"2d6","amount":-6,"explanation":"claws"}'))
            .toMatchObject({ ok: true, ruling: { type: 'hp_change', expression: '2d6', amount: -6 } });
    });
});

describe('REFEREE_SYSTEM — target_effect key allowlist', () => {
    const system = () => buildRefereeMessages({ action: 'x', characterName: null, state: {} })[0].content;

    it('enumerates known registry keys and forbids inventing them', () => {
        const s = system();
        expect(s).toContain('speed_half');
        expect(s).toContain('redirect_attack');
        expect(s).toContain('VALID_EFFECT_KEYS');
        expect(s).toMatch(/never invent one/i);
        expect(s).toMatch(/conditions like "poisoned" are NOT effect keys/i);
        // the old vague placeholder must be gone from the schema line
        expect(s).not.toContain('snake_case_key');
    });

    it('is derived from the registry — every real key appears (no hand-copied subset)', () => {
        const s = system();
        const missing = TARGET_EFFECT_DEFINITIONS.filter(d => !s.includes(d.effect));
        expect(missing.map(d => d.effect)).toEqual([]); // 100% coverage = single source of truth
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

    it('reasoning-model output survives: think out loud (with braces), answer last', () => {
        const reasoning = 'Let me reason: the player attacks. I could use {"type":"automation"} for a named action, or {"type":"narrative"} if no roll. AC matters here.';
        const answer = '{"type":"dice","expression":"1d20+5","targetName":"Goblin","explanation":"attack roll","confidence":0.9}';
        expect(parseRulingAnswer(`${reasoning}\n\n${answer}`)).toMatchObject({ ok: true, ruling: { type: 'dice', expression: '1d20+5' } });
        // fenced answer after reasoning
        expect(parseRulingAnswer(`${reasoning}\n\`\`\`json\n${answer}\n\`\`\``)).toMatchObject({ ok: true, ruling: { type: 'dice' } });
        // answer FIRST, reasoning tail (balanced scan tolerates prose after too)
        expect(parseRulingAnswer(`${answer}\nI hope that helps the referee!`)).toMatchObject({ ok: true, ruling: { type: 'dice' } });
        // last object invalid but first valid — fallback picks it up
        expect(parseRulingAnswer('{"type":"narrative","text":"ok"} trailing {"broken').ok).toBe(true);
    });
});
