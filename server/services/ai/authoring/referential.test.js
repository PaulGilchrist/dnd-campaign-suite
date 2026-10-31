import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCampaignContext, validateBlueprintReferences } from './referential.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEST_CAMPAIGN_ROOT = path.resolve(here, '..', '..', '..', '..', 'public', 'campaigns', 'test-campaign');

let ctx;
beforeAll(() => {
    ctx = buildCampaignContext('test-campaign', { root: TEST_CAMPAIGN_ROOT });
});

describe('buildCampaignContext', () => {
    it('sees the live test-campaign rows and both maps', () => {
        expect(ctx.npcs.has('marta copperkettle')).toBe(true);
        expect(ctx.quests.has('the lost artifact')).toBe(true);
        expect(ctx.factions.has('the iron consortium')).toBe(true);
        expect(ctx.settlements.has('ironhaven')).toBe(true);
        expect(ctx.maps.has('test-map')).toBe(true);
        expect(ctx.encounters.has('test-encounter')).toBe(true);
    });

    it('indexes the real bestiary', () => {
        expect(ctx.monsters.get('goblin')).toBe('Goblin');
        expect(ctx.monsterNames.has('adult black dragon')).toBe(true);
    });
});

describe('validateBlueprintReferences — inward face', () => {
    it('accepts batch-internal tie-ins (settlement NPC, session links, POI targets)', () => {
        const bp = {
            scope: { scope: 'session', sessionNumber: 4 },
            npcs: [{ name: 'Oldhem the Ferryman' }],
            settlements: [{ name: 'Mudport', notableNPCs: ['Oldhem the Ferryman', 'Marta Copperkettle'] }],
            encounters: [{ name: 'Ferry Ambush', selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }] }],
            sessions: [{ name: 'Session 4', links: { encounters: ['Ferry Ambush'], npcs: ['Oldhem the Ferryman'], maps: ['test-map'], settlements: ['Mudport'] } }],
            mapPlans: [{ name: 'ferry-cave', displayName: 'Ferry Cave', generator: 'dungeon', dressing: {
                pois: [{ name: 'Door', gridX: 1, gridY: 1, targetMap: 'test-map' }],
                tokens: [{ encounterName: 'Ferry Ambush', creatureName: 'Goblin', gridX: 2, gridY: 2 }],
            } }],
        };
        const res = validateBlueprintReferences(bp, ctx);
        expect(res.errors).toEqual([]);
    });

    it('rejects fabricated references and batch duplicates', () => {
        const bp = {
            scope: { scope: 'campaign' },
            npcs: [{ name: 'Redundant' }, { name: 'redundant' }],
            settlements: [{ name: 'Mudport', notableNPCs: ['Nobody At All'] }],
            sessions: [{ name: 'S', links: { quests: ['The Fake Quest'] } }],
        };
        const res = validateBlueprintReferences(bp, ctx);
        const all = res.errors.join('\n');
        expect(res.ok).toBe(false);
        expect(all).toMatch(/npcs: A npc with that name already exists/);
        expect(all).toMatch(/notableNPCs references unknown NPC "Nobody At All"/);
        expect(all).toMatch(/links\.quests references unknown quest "The Fake Quest"/);
    });
});

describe('validateBlueprintReferences — outward face', () => {
    it('name collisions with live rows surface as rename prompts (no shadow rows)', () => {
        const bp = {
            scope: { scope: 'arc' },
            npcs: [{ name: 'MARTA copperkettle ' }], // normalization-tolerant collision
            quests: [{ name: 'The Lost Artifact' }],
        };
        const res = validateBlueprintReferences(bp, ctx);
        expect(res.ok).toBe(false);
        expect(res.renameConflicts).toEqual([
            { kind: 'npcs', name: 'MARTA copperkettle ' },
            { kind: 'quests', name: 'The Lost Artifact' },
        ]);
        expect(res.errors.join('\n')).toMatch(/collides with an existing npc/);
    });

    it('existing entities are legal reference targets (extension tie-ins)', () => {
        const bp = {
            scope: { scope: 'arc' },
            settlements: [{ name: 'Newhaven', notableNPCs: ['Marta Copperkettle'] }],
            sessions: [{ name: 'Session 5', links: { quests: ['The Lost Artifact'], maps: ['battle-arena'] } }],
        };
        expect(validateBlueprintReferences(bp, ctx).ok).toBe(true);
    });

    it('bestiary guard: pre-made monsters never land as NPCs', () => {
        const bp = { scope: { scope: 'bespoke' }, npcs: [{ name: 'Ogre' }] };
        const res = validateBlueprintReferences(bp, ctx);
        expect(res.ok).toBe(false);
        expect(res.errors.join('\n')).toMatch(/pre-made monsters join through the Encounter Builder/);
    });

    it('encounter monster pairs must match the real bestiary exactly', () => {
        const bp = { scope: { scope: 'bespoke' }, encounters: [{ name: 'E', selectedMonsters: [
            { index: 'no-such-monster', name: 'Ghost', qty: 1 },
            { index: 'ogre', name: 'Ogre King', qty: 1 },
        ] }] };
        const res = validateBlueprintReferences(bp, ctx);
        const all = res.errors.join('\n');
        expect(all).toMatch(/index "no-such-monster" is not a bestiary monster index/);
        expect(all).toMatch(/name "Ogre King" does not match bestiary index "ogre" \(real name: "Ogre"\)/);
    });

    it('map plans collide with existing map files', () => {
        const bp = { scope: { scope: 'bespoke' }, mapPlans: [{ name: 'test-map', displayName: 'Copy' }] };
        expect(validateBlueprintReferences(bp, ctx).errors.join('\n'))
            .toMatch(/map file "test-map" already exists/);
    });
});
