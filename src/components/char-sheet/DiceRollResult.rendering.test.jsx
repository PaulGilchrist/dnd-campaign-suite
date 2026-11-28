// @maintained-by-ai 2026-11-27
// Rendering lane of the DiceRollResult family — CANONICAL OWNERSHIP MAP for
// the family (verified against current sibling headers, 2026-11-27).
// THIS FILE owns the top-level face gating: the authoritative .dice-roll-total
// slot (d20 arithmetic, the damage `total` prop verbatim, null/undefined/empty
// roll fallbacks), crit / Natural 20 / Critical Miss notice gating, the
// forced-mode chip attribution matrix (buildForcedModeChips: which reason
// prints under which prefix, how many chips), and the Starry Form (Dragon)
// floor seam (floored total via computeFloorTotals/computeBaseTotal + verbatim
// floor notice).
// Deferred to sibling lanes (do not re-add here):
//   breakdown line CONTENT (formula, dice span, modifier text incl.
//     bonusDetail, bonus+modifier summation, zero-modifier suppression), Save
//     DC line + full visibility gate, resistance/hunter-lore/potent-cantrip
//     notices, Indomitable Might str replace ladder, WIS check-replace totals
//     → DiceRollResult.infoDisplay.test.jsx.
//   hit/miss, auto-miss, waiting-for-player-save (+ Quick Roll), save-result
//     and damage-applied lines → DiceRollResult.combatDisplay.test.jsx.
//   adv/dis checkbox mount/click/mutual-exclusivity/total recompute,
//     forcedMode initial marking with click-override, non-d20 toggle
//     suppression, saveResult mode suffix, Psi-Bolstered Knack panel,
//     console.error paths → DiceRollResult.toggles.test.jsx.
//   header dice-type icons, Reliable Talent indicator, GWF/Elemental Adept
//     notices, heal outcomes → DiceRollResult.displayFeatures.test.jsx.
//   Trance of Order (d20Floor10) floor → DiceRollResult.flooring.test.jsx.
//   total↔breakdown fusion detector (space text nodes, `→ total` equation-tail
//     gating on floor/homing faces; defers breakdown byte CONTENT to
//     infoDisplay) → DiceRollResult.roll-line-separation.test.jsx.
//   interaction faces: click-dispatch (damage-type window CustomEvents, prop-
//     callback dispatch, offer visibility, Done auto-damage incl.
//     damageTypeChoices, post-click transitions; its isCrit/isAutoCrit notice
//     leg is the click-face side of this lane's gating matrix) →
//     DiceRollResult.interactive.test.jsx.
//   createDiceRollHandlers payload contracts → DiceRollResult.handlers.test.js
//     (savage reroll/keep payloads, group-aware scoping, inertness →
//     zero-mock DiceRollResult.handlers.savageAttacker.test.js).
//   post-trigger reroll result-row copy + declined guard → rerollResults;
//     savage chooser UI → savageAttackerChoice; savage chip raw byte-exactness
//     → savageChipByteExact; die-size selection + evaluate-throw →
//     superiorityDie; onStrokeOfLuck identity + failure-only gate →
//     stroke-of-luck; boon miss→hit flip sequence → boon-of-combat-prowess;
//     fumble-banner suppression on converted faces → boon-nat1-fumble.
//   monster GM-adjudication offers → charge-bonus / two-handed /
//     ranged-variant / hit-choice; DamageTypeChoiceSection rendering →
//     damageTypeChoice; Homing Strikes fold → homing; effective-AC recompute +
//     boundary Done gate → shieldOfFaith; true-pre-hit HP transition →
//     hpTransition; secondary-damage tree → secondaryDamage; awayNote →
//     away-note; direct-roll disclosure → directDamageDisclosure; "Swing N of
//     N" ordinal → extraAttackSwing.
// This seam is pure display: no interaction, no randomness, no spies, no
// vi.mock — real renders only.
import { render, screen } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

const renderRoll = (props = {}) => render(
    <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} {...props} />
);

// The popup's authoritative total lives in the .dice-roll-total slot; feature
// rows repeat numbers elsewhere, so target the slot directly.
const totalText = (container) => container.querySelector('.dice-roll-total').textContent;

describe('DiceRollResult rendering', () => {
    describe('totals', () => {
        it.each([
            { label: 'd20 roll + bonus', props: { rolls: [10], bonus: 5 }, total: '15' },
            { label: 'd20 roll + bonus + modifier', props: { rolls: [12], bonus: 2, modifier: 3 }, total: '17' },
            { label: 'negative modifier subtracts', props: { rolls: [10], bonus: 0, modifier: -3 }, total: '7' },
            { label: 'negative bonus subtracts', props: { rolls: [10], bonus: -2, modifier: 0 }, total: '8' },
            { label: 'damage uses total prop verbatim, ignoring modifier', props: { name: 'Fireball', type: 'damage', rolls: [6, 4], bonus: 0, total: 10, modifier: 3 }, total: '10' },
            { label: 'null rolls fall back to 0', props: { rolls: null, bonus: 0 }, total: '0' },
            { label: 'undefined rolls keep the bonus', props: { rolls: undefined, bonus: 5 }, total: '5' },
            { label: 'empty rolls keep the bonus', props: { rolls: [], bonus: 3 }, total: '3' },
            { label: 'damage with empty rolls uses total prop', props: { type: 'damage', rolls: [], bonus: 0, total: 5 }, total: '5' },
        ])('$label — total slot shows $total', ({ props, total }) => {
            const { container } = renderRoll(props);
            expect(totalText(container)).toBe(total);
        });
    });

    describe('forced-mode chip attribution (buildForcedModeChips)', () => {
        // bug-adv-chip-borrows-range-reason: rangeReason is ALWAYS
        // disadvantage-family prose, so it must never ride the Adv prefix.
        // Aura reason strings (measured / lenient "GM-enforced" faces) are
        // produced and pinned by the resolver lanes (contextBuilder-sync,
        // lion/wolfAuraUtils); this lane pins only WHICH slot the threaded
        // string interpolates into — measured and gridless-lenient copy both
        // ride the same interpolation, so one representative string per slot
        // suffices (the old per-aura verbatim cases were content duplicates).
        // .forced-mode-badge class probe is load-bearing: only a count of the
        // rendered chips proves "one chip per source / no phantom second
        // chip", and the title attribute needs the element handle.
        const chipCount = () => document.querySelectorAll('.forced-mode-badge');

        it.each([
            {
                label: 'advantage with only a range reason present — range copy never rides the Adv prefix',
                props: { forcedMode: 'advantage', rangeReason: 'Ranged disadvantage' },
                chip: 'Adv (conditions)', title: 'Automatically set by active conditions',
            },
            {
                // The threaded advantage reason wins over any co-occurring
                // range reason; rangeReason stays on the Disadv side /
                // AUTO-MISS banner only.
                label: 'advantage prefers its own threaded reason over a co-occurring range reason',
                props: { forcedMode: 'advantage', advantageReason: 'Wolf rage aura — enemy of raging DraconicDragon within 5 ft', rangeReason: 'Target out of melee range (21 ft > 8 ft)' },
                chip: 'Adv (Wolf rage aura — enemy of raging DraconicDragon within 5 ft)', title: 'Wolf rage aura — enemy of raging DraconicDragon within 5 ft',
            },
            {
                label: 'disadvantage with no explicit reason — generic conditions copy',
                props: { forcedMode: 'disadvantage' },
                chip: 'Disadv (conditions)', title: 'Automatically set by active conditions',
            },
            {
                label: 'empty reason list falls back to the conditions copy',
                props: { forcedMode: 'disadvantage', disadvantageReasons: [] },
                chip: 'Disadv (conditions)', title: 'Automatically set by active conditions',
            },
            {
                label: 'disadvantage borrows the range reason under its own prefix (byte-identical legacy face)',
                props: { forcedMode: 'disadvantage', rangeReason: 'Beyond normal range (40 ft > 30 ft)' },
                chip: 'Disadv (Beyond normal range (40 ft > 30 ft))', title: 'Beyond normal range (40 ft > 30 ft)',
            },
            {
                // 2026-11-03 attribution parity: PC sync-lane aura resolvers
                // thread their reason via the advantageReason channel; on a
                // disadvantage press it must print under the DISADV prefix.
                label: 'disadvantage prints a threaded aura reason under the Disadv prefix',
                props: { forcedMode: 'disadvantage', advantageReason: 'Lion rage aura — enemy of raging ElderPaladin within 5 ft' },
                chip: 'Disadv (Lion rage aura — enemy of raging ElderPaladin within 5 ft)', title: 'Lion rage aura — enemy of raging ElderPaladin within 5 ft',
            },
            {
                label: 'a threaded aura reason beats a co-occurring range reason',
                props: { forcedMode: 'disadvantage', advantageReason: 'Lion rage aura — enemy of raging ElderPaladin within 5 ft', rangeReason: 'Beyond normal range (40 ft > 30 ft)' },
                chip: 'Disadv (Lion rage aura — enemy of raging ElderPaladin within 5 ft)', title: 'Lion rage aura — enemy of raging ElderPaladin within 5 ft',
            },
            {
                // 2026-11-04 backlog parity: a ONE-reason aura list feeds the
                // single-chip slot instead of falling through to the generic
                // conditions copy; ≤1 reason keeps the legacy single chip.
                label: 'single-source reason list prints on the chip (no generic copy, no second chip)',
                props: { forcedMode: 'disadvantage', disadvantageReasons: ['Lion rage aura — within 5 ft of raging ElderPaladin'] },
                chip: 'Disadv (Lion rage aura — within 5 ft of raging ElderPaladin)', title: 'Lion rage aura — within 5 ft of raging ElderPaladin',
            },
            {
                label: 'a single-reason list beats a different co-occurring range reason',
                props: { forcedMode: 'disadvantage', disadvantageReasons: ['Beyond normal range (15 ft > 8 ft)'], rangeReason: 'Target out of melee range (25 ft > 8 ft)' },
                chip: 'Disadv (Beyond normal range (15 ft > 8 ft))', title: 'Beyond normal range (15 ft > 8 ft)',
            },
            {
                label: 'lenient single-source aura reason carries its GM-enforced tail verbatim',
                props: { forcedMode: 'disadvantage', disadvantageReasons: ['Lion rage aura — raging ElderPaladin — proximity unmeasured (no token) — GM-enforced'] },
                chip: 'Disadv (Lion rage aura — raging ElderPaladin — proximity unmeasured (no token) — GM-enforced)', title: 'Lion rage aura — raging ElderPaladin — proximity unmeasured (no token) — GM-enforced',
            },
        ])('$label — one chip "$chip" titled "$title"', ({ props, chip, title }) => {
            renderRoll(props);
            expect(chipCount()).toHaveLength(1);
            expect(document.querySelector('.forced-mode-badge')).toHaveTextContent(chip);
            expect(document.querySelector('.forced-mode-badge')).toHaveAttribute('title', title);
        });

        // 2026-11-03 QA backlog (multi-source disadvantage attribution): with
        // 2+ threaded reasons (range band + aura), the popup stacks one chip
        // per source so neither "why" is silently dropped.
        it('stacks one chip per reason when multiple disadvantage sources apply', () => {
            renderRoll({
                forcedMode: 'disadvantage',
                rangeReason: 'Target out of melee range (25 ft > 8 ft)',
                disadvantageReasons: ['Target out of melee range (25 ft > 8 ft)', 'Lion rage aura — within 5 ft of raging ElderPaladin'],
            });
            const badges = document.querySelectorAll('.forced-mode-badge');
            expect(badges).toHaveLength(2);
            expect(badges[0]).toHaveTextContent('Disadv (Target out of melee range (25 ft > 8 ft))');
            expect(badges[0]).toHaveAttribute('title', 'Target out of melee range (25 ft > 8 ft)');
            expect(badges[1]).toHaveTextContent('Disadv (Lion rage aura — within 5 ft of raging ElderPaladin)');
            expect(badges[1]).toHaveAttribute('title', 'Lion rage aura — within 5 ft of raging ElderPaladin');
        });

        it('advantage mode never stacks the disadvantage reason list', () => {
            renderRoll({
                forcedMode: 'advantage',
                advantageReason: 'Precise Hunter (Hunter\'s Mark)',
                disadvantageReasons: ['Target out of melee range (25 ft > 8 ft)', 'Lion rage aura — within 5 ft of raging ElderPaladin'],
            });
            const badges = document.querySelectorAll('.forced-mode-badge');
            expect(badges).toHaveLength(1);
            expect(badges[0]).toHaveTextContent('Adv (Precise Hunter (Hunter\'s Mark))');
        });
    });

    describe('crit / Natural 20 / crit-miss notices', () => {
        it.each([
            { label: 'isCrit attack d20', props: { name: 'Attack', rollType: 'attack', rolls: [20, 5], bonus: 3, isCrit: true }, crit: true, natural20: false, miss: false },
            { label: 'isAutoCrit attack d20', props: { name: 'Attack', rollType: 'attack', rolls: [5, 3], bonus: 3, isAutoCrit: true }, crit: true, natural20: false, miss: false },
            { label: 'Natural 20 on a check', props: { name: 'Athletics', rollType: 'check', rolls: [20], bonus: 5 }, crit: false, natural20: true, miss: false },
            { label: 'Natural 20 on a save', props: { name: 'Constitution', rollType: 'save', rolls: [20], bonus: 2 }, crit: false, natural20: true, miss: false },
            { label: 'near-miss 19 on an attack', props: { name: 'Attack', rollType: 'attack', rolls: [19, 5], bonus: 3 }, crit: false, natural20: false, miss: false },
            { label: 'nat 20 die face on a damage roll', props: { name: 'Damage', type: 'damage', rolls: [20], total: 20 }, crit: false, natural20: false, miss: false },
            { label: 'nat 20 die face on a save-type roll', props: { name: 'DEX Save', type: 'save', rolls: [20], bonus: 3 }, crit: false, natural20: false, miss: false },
            { label: 'isNatural1 on an attack', props: { name: 'Attack', rollType: 'attack', rolls: [1, 15], bonus: 3, isNatural1: true }, crit: false, natural20: false, miss: true },
            ...['initiative', 'check', 'skill', 'save'].map((rollType) => ({
                label: `isNatural1 on a ${rollType} roll`,
                props: { name: 'Roll', rollType, rolls: [1, 10], bonus: 2, isNatural1: true },
                crit: false, natural20: false, miss: false,
            })),
        ])('$label', ({ props, crit, natural20, miss }) => {
            renderRoll(props);
            expect(Boolean(screen.queryByText('Critical Hit! — damage dice doubled'))).toBe(crit);
            expect(Boolean(screen.queryByText('Natural 20!'))).toBe(natural20);
            expect(Boolean(screen.queryByText('Critical Miss!'))).toBe(miss);
        });
    });

    describe('Starry Form (Dragon) floor (owned seam)', () => {
        const floorCases = [
            { label: 'floors a d20 save of 8', props: { name: 'Constitution', rollType: 'save', rolls: [8], bonus: 3 }, total: '13', notice: 'Starry Form (Dragon): d20 8 → 10' },
            { label: 'floors at the boundary roll of 9', props: { name: 'Constitution', rollType: 'check', rolls: [9], bonus: 4 }, total: '14', notice: 'Starry Form (Dragon): d20 9 → 10' },
            { label: 'floors attacks too (rollType-agnostic, unlike Reliable Talent)', props: { name: 'Attack', rollType: 'attack', rolls: [4], bonus: 5 }, total: '15', notice: 'Starry Form (Dragon): d20 4 → 10' },
            { label: 'leaves a natural 10 alone', props: { name: 'Constitution', rollType: 'save', rolls: [10], bonus: 3 }, total: '13', notice: null },
            { label: 'leaves rolls above the threshold alone', props: { name: 'Constitution', rollType: 'save', rolls: [11], bonus: 3 }, total: '14', notice: null },
            { label: 'never floors when the flag is false', props: { name: 'Constitution', rollType: 'save', rolls: [8], bonus: 3, starryDragonFloor: false }, total: '11', notice: null },
        ];
        const floorRows = floorCases.map(({ label, props, total, notice }) => ({
            label, total, notice, starryDragonFloor: true, ...props,
        }));
        it.each(floorRows)('$label — total $total', ({ rolls, bonus, rollType, starryDragonFloor, total, notice }) => {
            const { container } = renderRoll({ rolls, bonus, rollType, starryDragonFloor });
            expect(totalText(container)).toBe(total);
            if (notice) {
                expect(screen.getByText(notice)).toBeInTheDocument();
            } else {
                expect(screen.queryByText(/Starry Form \(Dragon\)/)).not.toBeInTheDocument();
            }
        });
    });
});
