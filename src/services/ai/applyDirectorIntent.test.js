// @maintained-by-ai 2026-11-26
// §9.3 — confirmed director-intent apply: target stamp via existing lane,
// move advisory only, audit log shape, refusals. Pure dispatcher with an
// injected stamp lane and mocked log service — deterministic contract.
// AiDirectorPanel.test.jsx owns the UI seam; this file owns the apply bytes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));

import { addEntry } from '../ui/logService.js';
import { applyDirectorIntent, isAutoSafeIntent } from './applyDirectorIntent.js';

const CN = 'test-campaign';

// The audit row written for the (0-based) apply call made in this test.
const auditRow = (index = 0) => addEntry.mock.calls[index][1];

beforeEach(() => vi.clearAllMocks());

describe('applyDirectorIntent', () => {
    it('attack and cast stamp the target anchor on the existing lane; audit row is shaped', async () => {
        const onStampTarget = vi.fn();
        const r = await applyDirectorIntent({
            campaignName: CN,
            intent: { intent: 'attack', creatureName: 'Goblin 1', actionName: 'Scimitar', targetName: 'Rakan' },
            onStampTarget,
        });
        expect(onStampTarget).toHaveBeenCalledWith('Goblin 1', 'Rakan');
        expect(r.applied).toBe(true);
        expect(r.detail).toMatch(/engine rolls, not the AI/);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
            type: 'ai_director_applied',
            characterName: 'Goblin 1', // sole author field (MMM 2026-11-21)
        }));
        expect(auditRow()).not.toHaveProperty('name');
        expect(auditRow().description).toContain('AI director confirmed: attack');

        // cast routes through the same stamp lane
        const cast = await applyDirectorIntent({
            campaignName: CN,
            intent: { intent: 'cast', creatureName: 'Goblin 1', actionName: 'Hex', targetName: 'Rakan' },
            onStampTarget,
        });
        expect(cast.applied).toBe(true);
        expect(onStampTarget).toHaveBeenLastCalledWith('Goblin 1', 'Rakan');
    });

    it('move is ADVISORY — the drag lane owns token movement (no silent writes)', async () => {
        const onStampTarget = vi.fn();
        const r = await applyDirectorIntent({
            campaignName: CN,
            intent: { intent: 'move', creatureName: 'Goblin 1', feet: 30, direction: 'toward Rakan' },
            onStampTarget,
        });
        expect(r.applied).toBe(false);
        expect(r.advisory).toBe(true);
        expect(r.detail).toMatch(/drag the token/);
        expect(r.detail).toContain('30 ft.');
        expect(r.detail).toContain('toward Rakan');
        expect(onStampTarget).not.toHaveBeenCalled();
        expect(auditRow().description).toContain('AI director advisory: move');
    });

    it('pass/talk/log-only and utility (with and without target) apply without refusing', async () => {
        expect((await applyDirectorIntent({ campaignName: CN, intent: { intent: 'pass', creatureName: 'Goblin 1' } })).applied).toBe(true);
        const talk = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'talk', creatureName: 'Goblin 1', text: 'Die, intruder!' } });
        expect(talk.applied).toBe(true);
        expect(talk.detail).toContain('Die, intruder!');

        // utility without a target runs on the card lane, no stamp needed
        const self = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'utility', creatureName: 'Goblin 1', actionName: 'Hide' } });
        expect(self.applied).toBe(true);
        expect(self.detail).toContain('Hide');

        // utility WITH a target routes through the stamp lane like attack/cast
        const onStampTarget = vi.fn();
        const targeted = await applyDirectorIntent({
            campaignName: CN,
            intent: { intent: 'utility', creatureName: 'Goblin 1', actionName: 'Help', targetName: 'Rakan' },
            onStampTarget,
        });
        expect(targeted.applied).toBe(true);
        expect(onStampTarget).toHaveBeenCalledWith('Goblin 1', 'Rakan');
    });

    it('needs_human, unknown and empty intents are refused; refused outcomes still audit', async () => {
        const nh = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'needs_human', creatureName: 'Goblin 1', text: 'GM decides' } });
        expect(nh.applied).toBe(false);
        expect((await applyDirectorIntent({ campaignName: CN, intent: {} })).applied).toBe(false);
        expect((await applyDirectorIntent({ campaignName: CN, intent: null })).applied).toBe(false);

        const unknown = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'mind_blast' } });
        expect(unknown.applied).toBe(false);
        expect(unknown.detail).toContain('mind_blast');
        expect(auditRow().description).toContain('AI director refused: mind_blast');
    });

    it('stamp-lane failures refuse with guidance and never throw', async () => {
        // no lane wired at all
        const missing = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'attack', creatureName: 'Goblin 1', actionName: 'Scimitar', targetName: 'Rakan' } });
        expect(missing.applied).toBe(false);
        expect(missing.detail).toMatch(/no target lane/);

        // lane throws — the throw becomes a plain-English refusal (copy law owned
        // by applyFailureCopy.test.js); here only the routed raw tail is pinned
        const broken = await applyDirectorIntent({
            campaignName: CN,
            intent: { intent: 'attack', creatureName: 'Goblin 1', actionName: 'Scimitar', targetName: 'Rakan' },
            onStampTarget: () => { throw new Error('modal busy'); },
        });
        expect(broken.applied).toBe(false);
        expect(broken.detail).toContain('modal busy');
    });
});

describe('isAutoSafeIntent (autopilot auto-apply boundary)', () => {
    it('stamp/log/advisory intents are auto-safe; needs_human and null wait for the human', () => {
        for (const intent of ['attack', 'cast', 'utility', 'pass', 'talk', 'move']) {
            expect(isAutoSafeIntent({ intent })).toBe(true);
        }
        expect(isAutoSafeIntent({ intent: 'needs_human' })).toBe(false);
        expect(isAutoSafeIntent(null)).toBe(false);
    });
});
