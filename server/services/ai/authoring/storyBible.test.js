// @maintained-by-ai
// Campaign-authoring Phase 4 — story bible over the REAL test-campaign
// fixtures (read-only): canon view excludes drafts, party comes from
// character files, and the bestiary menu bands to the target levels.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildStoryBible, monsterMenu } from './storyBible.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEST_CAMPAIGN_ROOT = path.resolve(here, '..', '..', '..', '..', 'public', 'campaigns', 'test-campaign');

describe('buildStoryBible', () => {
    const bible = buildStoryBible('test-campaign', { root: TEST_CAMPAIGN_ROOT });

    it('knows the party from the character files', () => {
        expect(bible.partyLevels.size).toBe(13);
        expect(bible.party.every(p => p.class)).toBe(true);
    });

    it('buckets quests by lifecycle and lists maps', () => {
        expect(bible.quests.active.map(q => q.name)).toContain('The Lost Artifact');
        expect(bible.maps).toEqual(expect.arrayContaining(['test-map', 'battle-arena']));
    });

    it('excludes drafts — canon is what was APPROVED', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-'));
        try {
            fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
            fs.writeFileSync(path.join(tmp, 'data', 'factions.json'), JSON.stringify([
                { name: 'Canon Guild' },
                { name: 'Pending Draft Cult', draft: true },
            ]));
            const withDraft = buildStoryBible('fixture', { root: tmp });
            expect(withDraft.factions.map(f => f.name)).toEqual(['Canon Guild']);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('folds design intent from notes into the bible', () => {
        const bibleWith = buildStoryBible('test-campaign', {
            root: TEST_CAMPAIGN_ROOT,
            notes: { storySummary: 'The ward-sacrifice thread', plans: [{ scope: 'arc' }] },
        });
        expect(bibleWith.designIntent.storySummary).toContain('ward-sacrifice');
        expect(bibleWith.designIntent.lastPlans).toHaveLength(1);
    });
});

describe('monsterMenu', () => {
    it('bands by CR and emits real index/name pairs', () => {
        const menu = monsterMenu({ minCr: 0, maxCr: 1 });
        expect(menu.length).toBeGreaterThan(5);
        const goblin = menu.find(m => m.index === 'goblin');
        expect(goblin).toMatchObject({ name: 'Goblin', cr: 0.25 });
        expect(menu.every(m => m.cr <= 1)).toBe(true);
    });
});
