// @maintained-by-ai 2026-11-28
// MA-0963: Half-Dragon "Dragon's Breath" (BY-name disk lock #387 family) — the
// save row was damage-less on BOTH legs: it authored NO damage_dice_primary/
// damage_type_primary, so the save/picker route (saveChipPlan.formula ->
// saveDamageFormula -> SaveAttackAoeModal, MA-0901/§408 cone picker reads
// damage_dice_primary ONLY) got a null pool and paid zero on fail AND success.
// Description "(8d6)" sits behind </strong> so the prose extractor
// (extractDamageDiceFromDescription) never sees it either. DATA fix mirrors the
// MA-0618/0629 Dragon Turtle Steam Breath twin: author the two dice fields; the
// TYPE is dynamic (Draconic Origin DM's choice) so the honest composite label
// "Acid/Cold/Fire/Lightning/Poison (GM-chosen)" rides (§422: unknown labels miss
// the exact-lowercase resistance compare = full-damage cosmetic pass-through).
// dc_success stays UNAUTHORED = half (§63/MA-0618 prose). OWNED ELSEWHERE, not
// re-pinned: secondary-null triple #589 (cultist :36-39)+#673, Cone shape parse
// save-variant-shape:55-57/#640, save math applyDamage.save-full:19 (#597 rec),
// Claw BY-name #674 (ma0962 file), usage #571. The two extractDamageDice branches
// pinned here (authored-field short-circuit + HTML-anchor NO-match) are delegated
// TO this file by MonsterCardModal.extract-damage-dice.test.jsx's ownership note.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractDamageDiceFromDescription, saveChipPlan, buildSaveOptions } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const halfDragon = monsters.find(m => m.index === 'half-dragon');
const breath = halfDragon.actions.find(a => a.name === "Dragon's Breath");

describe('MA-0963 Half-Dragon Dragon\'s Breath disk row (data lock)', () => {
    it('is the exact fixed row: DC 14 Dex 30-ft Cone recharge 5-6, authored 8d6 + honest composite type, full description bytes, dc_success UNAUTHORED (= half-default honest vs prose)', () => {
        expect(breath).toEqual({
            name: "Dragon's Breath",
            description: "Dexterity Saving Throw: DC 14, each creature in a 30-foot <strong>Cone</strong>. <strong>Failure:</strong> 28 (8d6) damage of the type chosen for the Draconic Origin trait. <strong>Success:</strong> Half damage.",
            save_dc: 14,
            save_type: 'Dexterity',
            range: '30-foot Cone',
            save_effect: 'Half damage',
            recharge: '5-6',
            damage_dice_primary: '8d6',
            damage_type_primary: 'Acid/Cold/Fire/Lightning/Poison (GM-chosen)',
        });
    });
});

describe('MA-0963 picker transport feeds the 8d6 dice to both legs', () => {
    it('extractDamageDiceFromDescription short-circuits on the authored field (branch owner: see header)', () => {
        expect(extractDamageDiceFromDescription(breath.description, breath.damage_dice_primary)).toBe('8d6');
    });
    it('description WITHOUT the authored field stays unparseable — </strong> breaks the prose anchor (why the field is required)', () => {
        // eslint-disable-next-line no-unused-vars
        const { damage_dice_primary, ...bare } = breath;
        expect(extractDamageDiceFromDescription(bare.description, bare.damage_dice_primary)).toBeNull();
    });
    it('save chip rolls 8d6 AND picker options arm DC 14 dex + half-on-success default', () => {
        const plan = saveChipPlan(breath, false);
        expect(plan).toMatchObject({ formula: '8d6', rollable: true, clickable: true });
        const opts = buildSaveOptions(breath);
        expect(opts).toMatchObject({ saveDc: 14, saveType: 'dex', dcSuccess: 'half' });
    });
});

describe('MA-0963 sibling Multiattack row byte-inert (actions[0], cited #674)', () => {
    it('Multiattack stays header text with its own primary, no secondary', () => {
        const multi = halfDragon.actions[0];
        expect(multi.name).toBe('Multiattack');
        expect(multi.damage_dice_primary).toBe('1d4 + 4');
        expect(multi.damage_dice_secondary).toBeUndefined();
    });
});
