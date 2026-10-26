// @maintained-by-ai
// Encounter battle-map display-name seam (backlog 2026-10-25 pm): the label
// built here is what BOTH the Maps list (via the map document's displayName)
// and the auto_encounter_started audit show — one source of truth so the log
// names exactly what the GM sees in the list. Exact bytes pinned: parent map
// slug is title-cased, event title (or "Encounter") and hex coords follow.
// When the caller knows the parent's AUTHORED displayName (backlog
// 2026-10-25 eve) it wins verbatim — no casing coercion.
import { describe, it, expect } from 'vitest';
import { buildEncounterMapDisplayName } from './encounterMapNaming.js';

describe('buildEncounterMapDisplayName', () => {
    it('names an event-driven spawn after the parent map, the event title, and the hex', () => {
        expect(
            buildEncounterMapDisplayName({ parentMapName: 'test-map.json', q: 5, r: 5, eventTitle: 'Ambush from the Brush' })
        ).toBe('Test Map - Ambush from the Brush at (5,5)');
    });

    it('names an event-less (manual/context-menu) spawn with the generic Encounter wording', () => {
        expect(
            buildEncounterMapDisplayName({ parentMapName: 'test-map', q: 15, r: -8 })
        ).toBe('Test Map - Encounter at (15,-8)');
    });

    it('treats blank/whitespace event titles as no title', () => {
        expect(
            buildEncounterMapDisplayName({ parentMapName: 'test-map', q: 0, r: 0, eventTitle: '   ' })
        ).toBe('Test Map - Encounter at (0,0)');
    });

    it('falls back to "Battle Map" when the parent name is empty', () => {
        expect(
            buildEncounterMapDisplayName({ parentMapName: '', q: 2, r: 3, eventTitle: 'Dire Bear' })
        ).toBe('Battle Map - Dire Bear at (2,3)');
    });

    it('never emits the raw kebab slug or the legacy ---encounter-at-<q><r> string as the label', () => {
        const label = buildEncounterMapDisplayName({ parentMapName: 'test-map.json', q: 15, r: 8, eventTitle: 'Wolves on the Hunt' });
        expect(label).toBe('Test Map - Wolves on the Hunt at (15,8)');
        expect(label).not.toContain('---encounter-at-');
        expect(label).not.toContain('test-map');
    });

    describe('authored parent displayName precedence (backlog 2026-10-25 eve)', () => {
        it('uses the parent displayName VERBATIM — no title-case coercion', () => {
            expect(
                buildEncounterMapDisplayName({
                    parentMapName: 'qa-hex-2.json',
                    q: 25,
                    r: 10,
                    eventTitle: 'Giant Eagle',
                    parentDisplayName: 'QA Hex 2',
                })
            ).toBe('QA Hex 2 - Giant Eagle at (25,10)');
        });

        it('honours the authored bytes even with irregular whitespace/padding', () => {
            expect(
                buildEncounterMapDisplayName({
                    parentMapName: 'qa-hex-2',
                    q: 1,
                    r: -2,
                    eventTitle: 'Giant Eagle',
                    parentDisplayName: '  QA Hex 2 ',
                })
            ).toBe('QA Hex 2 - Giant Eagle at (1,-2)');
        });

        it.each([undefined, null, '', '   '])(
            'falls back to the title-cased slug when parentDisplayName is %s (legacy bytes)',
            (parentDisplayName) => {
                expect(
                    buildEncounterMapDisplayName({
                        parentMapName: 'qa-hex-2.json',
                        q: 25,
                        r: 10,
                        eventTitle: 'Giant Eagle',
                        parentDisplayName,
                    })
                ).toBe('Qa Hex 2 - Giant Eagle at (25,10)');
            }
        );

        it('names an event-less spawn with the authored parent + Encounter wording', () => {
            expect(
                buildEncounterMapDisplayName({
                    parentMapName: 'qa-hex-2',
                    q: 3,
                    r: 4,
                    parentDisplayName: 'QA Hex 2',
                })
            ).toBe('QA Hex 2 - Encounter at (3,4)');
        });
    });
});
