// @maintained-by-ai
// 2026-11-18 sheet-attack no-target refusal: single-owner lane tests. The
// chip-default builder copies stay byte-identical (the monster-side exact
// templates are pinned in MonsterCardHelpers.usage.test.js through the
// re-export — the save-lane copy here guards the move itself). The sheet
// lane adds: attack-noun copy, the initiative-card Target-select hint, the
// `<weapon-slug>_refused` zero-spend log row, and the board predicate —
// refuse ONLY an on-board attacker row with an empty targetName; explicit
// targetNames and board-less presses stay inert.
import { describe, it, expect, vi } from 'vitest';
import {
    buildNoTargetRefusalPopup,
    buildNoTargetRefusalLog,
    isUnarmedAttackPress,
    refuseUnarmedAttackPress,
} from './noTargetRefusal.js';

describe('buildNoTargetRefusalPopup — chip defaults byte-identical', () => {
    it('save default keeps the AoE parenthetical and the modal-header hint', () => {
        expect(buildNoTargetRefusalPopup({ monsterName: 'Hag 1', actionName: 'Frightful Presence' })).toBe(
            '<div class="mc-no-target-refusal"><h3>No Target</h3><p>Hag 1 cannot use Frightful Presence — no target is armed on Hag 1\'s initiative card. Arm a target with the Target select at the top of this card (or on the initiative card) (AoE rows pick their own area targets). No save rolled, nothing spent.</p></div>'
        );
    });

    it('attack default (chip lane) keeps "No attack rolled" without the AoE note', () => {
        expect(buildNoTargetRefusalPopup({ monsterName: 'Goblin 1', actionName: 'Scimitar', rollNoun: 'attack' })).toBe(
            '<div class="mc-no-target-refusal"><h3>No Target</h3><p>Goblin 1 cannot use Scimitar — no target is armed on Goblin 1\'s initiative card. Arm a target with the Target select at the top of this card (or on the initiative card). No attack rolled, nothing spent.</p></div>'
        );
    });

    it('sheet lane (armHint override): names PC + weapon, no modal-header hint, no AoE note', () => {
        let html = null;
        const logs = [];
        const refused = refuseUnarmedAttackPress({
            combatSummary: { creatures: [{ name: 'EvasiveFighter', type: 'player' }, { name: 'Goblin', type: 'npc' }] },
            attackerName: 'EvasiveFighter',
            actionName: 'Glaive',
            setPopupHtml: (h) => { html = h; },
            log: (e) => { logs.push(e); },
        });
        expect(refused).toBe(true);
        expect(html).toContain('mc-no-target-refusal');
        expect(html).toContain('EvasiveFighter cannot use Glaive');
        expect(html).toContain('no target is armed');
        expect(html).toContain('Arm a target with the Target select on the initiative card.');
        expect(html).toContain('No attack rolled, nothing spent.');
        expect(html).not.toContain('at the top of this card');
        expect(html).not.toContain('AoE rows');
        // The refusal rides the caller's log lane with the <weapon>_refused row.
        expect(logs).toHaveLength(1);
        expect(logs[0].automationType).toBe('glaive_refused');
    });
});

describe('buildNoTargetRefusalLog — <slug>_refused shapes', () => {
    it('save default keeps "no save prompt" byte-identical', () => {
        const { timestamp, ...log } = buildNoTargetRefusalLog({ monsterName: 'Hag 1', actionName: 'Frightful Presence' });
        expect(timestamp).toEqual(expect.any(Number));
        expect(log).toEqual({
            type: 'automation',
            automationType: 'frightful_presence_refused',
            characterName: 'Hag 1',
            abilityName: 'Frightful Presence',
            description: 'Hag 1 Frightful Presence refused (no target) — no armed target on the initiative card, no self-resolve. Zero spend, no save prompt.',
        });
    });

    it('attack flavor names the refusal and states the no-roll/zero-spend truth', () => {
        const { timestamp, ...log } = buildNoTargetRefusalLog({ monsterName: 'EvasiveFighter', actionName: 'Glaive', rollNoun: 'attack' });
        expect(timestamp).toEqual(expect.any(Number));
        expect(log).toEqual({
            type: 'automation',
            automationType: 'glaive_refused',
            characterName: 'EvasiveFighter',
            abilityName: 'Glaive',
            description: 'EvasiveFighter Glaive refused (no target) — no armed target on the initiative card, no self-resolve. Zero spend, no attack rolled.',
        });
    });
});

describe('isUnarmedAttackPress — board truth predicate', () => {
    const board = (row) => ({ creatures: [row, { name: 'Goblin', type: 'npc' }] });

    it.each([
        ['no explicit target + on-board row without targetName', board({ name: 'Korgath', type: 'player' }), undefined, true],
        ['armed row (targetName set)', board({ name: 'Korgath', type: 'player', targetName: 'Goblin' }), undefined, false],
        ['press carries an explicit targetName (chip/OA/automation lane)', board({ name: 'Korgath', type: 'player' }), 'Goblin', false],
        ['attacker has no row on the board (out-of-initiative roll)', board({ name: 'Other', type: 'player' }), undefined, false],
        ['no board at all (out-of-combat roll)', null, undefined, false],
        ['empty board', { creatures: [] }, undefined, false],
    ])('%s → refuses=%s', (_label, combatSummary, explicitTargetName, expected) => {
        expect(isUnarmedAttackPress({ combatSummary, attackerName: 'Korgath', explicitTargetName })).toBe(expected);
    });

    it('suffix twin of findCreatureByName: bare-name press matches the "Name 1" row', () => {
        expect(isUnarmedAttackPress({ combatSummary: { creatures: [{ name: 'Goblin 1' }] }, attackerName: 'Goblin' })).toBe(true);
        expect(isUnarmedAttackPress({ combatSummary: { creatures: [{ name: 'Goblin 1', targetName: 'Korgath' }] }, attackerName: 'Goblin' })).toBe(false);
    });

    it('refuseUnarmedAttackPress is inert (no popup, no log) when the press is armed', () => {
        const setPopupHtml = vi.fn();
        const log = vi.fn();
        expect(refuseUnarmedAttackPress({
            combatSummary: { creatures: [{ name: 'Korgath', targetName: 'Goblin' }] },
            attackerName: 'Korgath',
            actionName: 'Greataxe',
            setPopupHtml,
            log,
        })).toBe(false);
        expect(setPopupHtml).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
    });
});
