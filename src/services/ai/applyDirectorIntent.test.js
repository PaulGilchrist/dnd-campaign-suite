// @maintained-by-ai
// §9.3 — confirmed director-intent apply: target stamp via existing lane,
// move advisory only, logs, refusals. Pure dispatcher with an injected stamp
// lane and mocked log service — deterministic contract, no app churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));

import { addEntry } from '../ui/logService.js';
import { applyDirectorIntent, isAutoSafeIntent } from './applyDirectorIntent.js';

const CN = 'test-campaign';

beforeEach(() => vi.clearAllMocks());

describe('applyDirectorIntent', () => {
    it('attack confirms by stamping the target anchor on the existing lane', async () => {
        const onStampTarget = vi.fn();
        const r = await applyDirectorIntent({
            campaignName: CN,
            intent: { intent: 'attack', creatureName: 'Goblin 1', actionName: 'Scimitar', targetName: 'Rakan' },
            onStampTarget,
        });
        expect(onStampTarget).toHaveBeenCalledWith('Goblin 1', 'Rakan');
        expect(r.applied).toBe(true);
        expect(r.detail).toMatch(/engine rolls, not the AI/);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'ai_director_applied' }));
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
        expect(onStampTarget).not.toHaveBeenCalled();
    });

    it('pass/talk apply as log entries; needs_human, unknown, and empty intents refused', async () => {
        expect((await applyDirectorIntent({ campaignName: CN, intent: { intent: 'pass', creatureName: 'Goblin 1' } })).applied).toBe(true);
        const talk = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'talk', creatureName: 'Goblin 1', text: 'Die, intruder!' } });
        expect(talk.applied).toBe(true);
        expect(talk.detail).toContain('Die, intruder!');
        const nh = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'needs_human', creatureName: 'Goblin 1', text: 'GM decides' } });
        expect(nh.applied).toBe(false);
        expect((await applyDirectorIntent({ campaignName: CN, intent: { intent: 'mind_blast' } })).applied).toBe(false);
        expect((await applyDirectorIntent({ campaignName: CN, intent: {} })).applied).toBe(false);
        expect((await applyDirectorIntent({ campaignName: CN, intent: null })).applied).toBe(false);
    });

    it('utility without target applies advisory-free; stamp failures caught, never thrown', async () => {
        const self = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'utility', creatureName: 'Goblin 1', actionName: 'Hide' } });
        expect(self.applied).toBe(true);

        const broken = await applyDirectorIntent({
            campaignName: CN,
            intent: { intent: 'attack', creatureName: 'Goblin 1', actionName: 'Scimitar', targetName: 'Rakan' },
            onStampTarget: () => { throw new Error('modal busy'); },
        });
        expect(broken.applied).toBe(false);
        expect(broken.detail).toMatch(/apply failed/);
    });

    it('no target lane ⇒ refused with guidance', async () => {
        const r = await applyDirectorIntent({ campaignName: CN, intent: { intent: 'attack', creatureName: 'Goblin 1', actionName: 'Scimitar', targetName: 'Rakan' } });
        expect(r.applied).toBe(false);
        expect(r.detail).toMatch(/no target lane/);
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
