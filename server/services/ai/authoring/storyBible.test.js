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
        expect(bible.partyLevels.size).toBe(15); // party baseline (see party.test.js): 15 since the permanent FixtureLandDruid fixture landed
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

    it('reads recentLog through the canonical getEntryText accessor (both text fields)', () => {
        // Backlog 2026-11-20 AAA: chip-commit rows carry the stamped `message`,
        // join initiative/automation rows carry `description`, info rows ride
        // the lane-local `text` field — a single-field grep misses families, so
        // the forensic reader must surface all three shapes.
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-log-'));
        try {
            fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
            fs.writeFileSync(path.join(tmp, 'data', 'campaign-log.json'), JSON.stringify([
                { type: 'hp_change', delta: -5, message: 'ElderPaladin takes 5 damage (219/224 HP)' },
                { type: 'roll', rollType: 'initiative', description: 'Goblin rolls initiative: 15 (+2)' },
                { type: 'info', text: 'Composer info line' },
            ]));
            const bible = buildStoryBible('fixture', { root: tmp });
            expect(bible.recentLog.map(l => l.text)).toEqual([
                'ElderPaladin takes 5 damage (219/224 HP)',
                'Goblin rolls initiative: 15 (+2)',
                'Composer info line',
            ]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
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
