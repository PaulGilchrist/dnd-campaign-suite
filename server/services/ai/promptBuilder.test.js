// L5 Phase 3 — prompt builder + answer parsing tests.
import { describe, it, expect, vi } from 'vitest';
import { buildRefereeMessages, buildDirectorMessages, buildWorldMessages, buildRecapMessages, parseRecapAnswer, compactContext, compactActorStats, parseRulingAnswer } from './promptBuilder.js';

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

// Backlog 2026-10-31 — referee dice rulings were stat-blind: the ask prompt
// must bake the actor's REAL modifiers in so checks aren't bare rolls.
describe('buildRefereeMessages — ACTOR STATS projection', () => {
    const STATS = {
        name: 'DivinationWizard',
        abilityMods: { str: -1, dex: -1, con: 0, int: 5, wis: 0, cha: -1 },
        proficiencyBonus: 6,
        skillProficiencies: ['Arcana', 'History'],
        expertSkills: ['Arcana'],
    };

    it('carries the modifiers and the check-composition instruction', () => {
        const u = buildRefereeMessages({ action: 'I study the rune', characterName: 'DivinationWizard', state: {}, actorStats: STATS })[1].content;
        expect(u).toContain('ACTOR STATS');
        expect(u).toContain('"int":5');
        expect(u).toContain('"proficiencyBonus":6');
        expect(u).toContain('Arcana');
        expect(u).toMatch(/never claim a modifier is unavailable/i);
        expect(u).toMatch(/1d20\+mod/);
    });

    it('stats-less asks keep the pre-projection prompt byte-identical', () => {
        const withNull = buildRefereeMessages({ action: 'x', characterName: 'Rakan', state: {}, actorStats: null })[1].content;
        const legacy = buildRefereeMessages({ action: 'x', characterName: 'Rakan', state: {} })[1].content;
        expect(withNull).toBe(legacy);
        expect(withNull).not.toContain('ACTOR STATS');
    });

    it('compactActorStats sanitizes untrusted payloads — clamps, drops junk, null when unusable', () => {
        expect(compactActorStats({ abilityMods: { int: 999, dex: -50 }, proficiencyBonus: 42 }))
            .toMatchObject({ abilityMods: { int: 15, dex: -5 }, proficiencyBonus: 8 });
        expect(compactActorStats({ name: 'n'.repeat(500), abilityMods: { int: '5', bogus: 1 } }).abilityMods).toEqual({ int: 5 });
        expect(compactActorStats(null)).toBeNull();
        expect(compactActorStats('stats')).toBeNull();
        expect(compactActorStats({ name: 'no mods here' })).toBeNull();
        const u = buildRefereeMessages({ action: 'x', characterName: null, state: {}, actorStats: { junk: true } })[1].content;
        expect(u).not.toContain('ACTOR STATS');
    });
});

// Roadmap Step 9 — the "STORY SO FAR" memory block. Every AI role receives
// the storyMemory slice; campaigns with an empty log keep prompts byte-
// identical (the section is absent, not blank).
describe('STORY SO FAR memory block — all three roles', () => {
    const STORY = '- narrative: The party fled the smugglers\' cave.\n- recap of “Session 1”: Mira struck a bargain.';
    const MONSTER = { speedFeet: 30, actions: [{ name: 'Scimitar', attack_bonus: 4, description: 'Melee.' }] };
    const ALLOW = { npcNames: [], settlementNames: [], factionNames: [], questNames: [] };

    const refereeUser = (story) => buildRefereeMessages({ action: 'I follow the blood trail', characterName: 'Rakan', state: {}, story })[1].content;
    const directorUser = (story) => buildDirectorMessages({ creatureName: 'Goblin', monster: MONSTER, targets: [], self: {}, economy: {}, allowedIntents: null, round: 1, story })[1].content;
    const worldUser = (story) => buildWorldMessages({ kind: 'rumor', focus: 'the docks', world: {}, allow: ALLOW, story })[1].content;

    it('referee prompt carries the story + the never-contradict law', () => {
        const u = refereeUser(STORY);
        expect(u).toContain('STORY SO FAR');
        expect(u).toContain('fled the smugglers');
        expect(u).toMatch(/never contradict it/i);
    });

    it('director prompt carries the story FIRST (continuity before tactics)', () => {
        const u = directorUser(STORY);
        expect(u.indexOf('STORY SO FAR')).toBe(0);
        expect(u).toContain('Mira struck a bargain');
    });

    it('world-keeper prompt carries the story between focus and ledger', () => {
        const u = worldUser(STORY);
        expect(u).toContain('STORY SO FAR');
        expect(u).toContain('fled the smugglers');
        expect(u.indexOf('STORY SO FAR')).toBeLessThan(u.indexOf('CAMPAIGN LEDGER'));
    });

    it.each([
        ['referee', refereeUser],
        ['director', directorUser],
        ['world-keeper', worldUser],
    ])('%s stays byte-identical with no story — null/blank and absent never mention it', async (_role, build) => {
        const absent = build(undefined);
        expect(absent).not.toContain('STORY SO FAR');
        expect(build(null)).toBe(absent);
        expect(build('   ')).toBe(absent);
    });
});

describe('parseRulingAnswer — hp_change provenance gate', () => {    it('bare-amount hp_change is rejected; amount + dice expression parses', () => {
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

// Roadmap Step 8 — the recap chronicler prompt + answer contract.
describe('buildRecapMessages / parseRecapAnswer — the chronicler lane', () => {
    const TRANSCRIPT = 'STORY BEATS (narrative, encounters, milestones):\n[narrative] The cave mouth yawned.';

    it('system carries the grounding law, the narrator-not-referee law, and the JSON contract', () => {
        const [system, user] = buildRecapMessages({ session: 'Session 1: The Long Dark', transcript: TRANSCRIPT });
        expect(system.content).toMatch(/ground EVERY event/i);
        expect(system.content).toMatch(/never invent/i);
        expect(system.content).toMatch(/narrate them/i);
        expect(system.content).toMatch(/\{"text":"\.\.\."\}/);
        expect(user.content).toContain('Session 1: The Long Dark');
        expect(user.content).toContain('your ONLY source of truth');
        expect(user.content).toContain('The cave mouth yawned.');
    });

    it('parses a clean {"text":...} answer (fences tolerated like every other lane)', () => {
        expect(parseRecapAnswer('{"text":"The party delved deep."}')).toMatchObject({ ok: true, text: 'The party delved deep.' });
        expect(parseRecapAnswer('```json\n{"text":"Done."}\n```')).toMatchObject({ ok: true, text: 'Done.' });
    });

    it('fails closed on prose, empty text, non-string text, and oversize answers', () => {
        expect(parseRecapAnswer('Once upon a time…').ok).toBe(false);
        expect(parseRecapAnswer('{"text":"   "}').ok).toBe(false);
        expect(parseRecapAnswer('{"text":42}').ok).toBe(false);
        expect(parseRecapAnswer(JSON.stringify({ text: 'x'.repeat(2001) })).ok).toBe(false);
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
