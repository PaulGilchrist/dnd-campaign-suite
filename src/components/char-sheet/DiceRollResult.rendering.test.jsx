// @maintained-by-ai
// Rendering lane of the DiceRollResult family. Ownership map (per
// displayFeatures' ownership notes):
//   THIS FILE owns the Starry Form (Dragon) floor seam — the floored total
//   (10 + bonus + modifier via computeFloorTotals/computeBaseTotal) and the
//   verbatim floor notice — plus crit / Natural 20 / crit-miss notice gating,
//   the forced-mode badge, and baseline totals (d20 arithmetic, the damage
//   `total` prop verbatim, and missing/empty rolls fallbacks).
// Deferred to sibling lanes (do not re-add here):
//   hit/miss, auto-miss, save-result, damage-applied lines →
//     DiceRollResult.combatDisplay.test.jsx
//   breakdown line (formula, dice span, modifier text incl. comma-separated
//     non-d20 rolls) → DiceRollResult.infoDisplay.test.jsx
//   advantage/disadvantage toggles and their non-d20 suppression →
//     DiceRollResult.toggles.test.jsx
//   header icons, Reliable Talent, GWF, Elemental Adept, heal outcomes →
//     DiceRollResult.displayFeatures.test.jsx
//   Trance of Order floor → DiceRollResult.flooring.test.jsx
//   crit-damage auto-damage notices → DiceRollResult.interactive.test.jsx
// This seam is pure display: no interaction, no randomness, no spies needed.
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

    describe('forced-mode badge', () => {
        it.each([
            {
                label: 'advantage with only a range reason present — range copy never rides the Adv prefix',
                props: { name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'advantage', rangeReason: 'Ranged disadvantage' },
                badgeText: 'Adv (conditions)',
                title: 'Automatically set by active conditions',
            },
            {
                label: 'disadvantage forced with no explicit reason',
                props: { name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'disadvantage', rangeReason: null },
                badgeText: 'Disadv (conditions)',
                title: 'Automatically set by active conditions',
            },
        ])('$label — badge "$badgeText" carries title "$title"', ({ props, badgeText, title }) => {
            renderRoll(props);
            const badge = screen.getByText(badgeText);
            expect(badge).toHaveAttribute('title', title);
        });

        // bug-adv-chip-borrows-range-reason: an aura advantage without a threaded
        // reason + a range miss/band reason on the same press used to print
        // "Adv (Target out of melee range (…))" — a disadvantage-family range fact
        // attributed as the advantage reason. The Adv chip now prints the
        // advantage's OWN threaded reason when present, and rangeReason stays on
        // the Disadv chip / AUTO-MISS banner only.
        it('advantage prefers its own threaded reason over any range reason', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'advantage',
                advantageReason: 'Wolf rage aura — enemy of raging DraconicDragon within 5 ft',
                rangeReason: 'Target out of melee range (21 ft > 8 ft)',
            });
            const badges = document.querySelectorAll('.forced-mode-badge');
            expect(badges).toHaveLength(1);
            expect(badges[0]).toHaveTextContent('Adv (Wolf rage aura — enemy of raging DraconicDragon within 5 ft)');
            expect(badges[0]).toHaveAttribute('title', 'Wolf rage aura — enemy of raging DraconicDragon within 5 ft');
        });

        it('disadvantage still borrows the range reason under its own prefix (byte-identical legacy face)', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'disadvantage',
                rangeReason: 'Beyond normal range (40 ft > 30 ft)',
            });
            expect(screen.getByText('Disadv (Beyond normal range (40 ft > 30 ft))')).toHaveAttribute('title', 'Beyond normal range (40 ft > 30 ft)');
        });

        // 2026-11-03 QA backlog (attribution parity): the PC sync-lane lion and
        // corona aura resolvers now thread their own reason (contextBuilder-sync
        // resolveLionAura/resolveCoronaAura). It rides the advantageReason
        // channel and must print under the DISADV prefix — measured face names
        // proximity, lenient face admits GM-enforcement instead of claiming
        // "within 5 ft" (3db9da635 honesty precedent).
        it('disadvantage prints a threaded aura reason under the Disadv prefix', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'disadvantage',
                advantageReason: 'Lion rage aura — enemy of raging ElderPaladin within 5 ft',
            });
            const badge = document.querySelector('.forced-mode-badge');
            expect(badge).toHaveTextContent('Disadv (Lion rage aura — enemy of raging ElderPaladin within 5 ft)');
            expect(screen.queryByText('Disadv (conditions)')).toBeNull();
        });

        it('corona lenient reason prints its GM-enforced tail verbatim', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'disadvantage',
                advantageReason: 'Corona of Light — sunlight aura of TestCleric — proximity unmeasured (gridless) — GM-enforced',
            });
            const badge = document.querySelector('.forced-mode-badge');
            expect(badge).toHaveTextContent('Disadv (Corona of Light — sunlight aura of TestCleric — proximity unmeasured (gridless) — GM-enforced)');
            expect(badge).toHaveAttribute('title', 'Corona of Light — sunlight aura of TestCleric — proximity unmeasured (gridless) — GM-enforced');
        });

        // bug-wolf-gridless-chip-claims-within-5ft-unmeasured: the gridless wolf
        // lenient face (resolveWolfAura fork, lion twin 2cd75b9de) must print its
        // honest GM-enforced tail under the Adv prefix — no "within 5 ft" claim.
        it('wolf lenient reason prints its GM-enforced tail under the Adv prefix', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'advantage',
                advantageReason: 'Wolf rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced',
            });
            const badge = document.querySelector('.forced-mode-badge');
            expect(badge).toHaveTextContent('Adv (Wolf rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced)');
            expect(badge).toHaveAttribute('title', 'Wolf rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced');
        });

        it('disadvantage prefers a threaded aura reason over a co-occurring range reason', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'disadvantage',
                advantageReason: 'Lion rage aura — enemy of raging ElderPaladin within 5 ft',
                rangeReason: 'Beyond normal range (40 ft > 30 ft)',
            });
            const badges = document.querySelectorAll('.forced-mode-badge');
            expect(badges).toHaveLength(1);
            expect(badges[0]).toHaveTextContent('Disadv (Lion rage aura — enemy of raging ElderPaladin within 5 ft)');
        });

        // 2026-11-03 QA backlog (multi-source disadvantage attribution): when
        // the roll seam carries 2+ reasons (range band + Lion rage aura), the
        // popup stacks one chip per source; ≤1 reason keeps the legacy single
        // chip copy byte-identical (no phantom second chip).
        it('stacks one chip per reason when multiple disadvantage sources apply', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'disadvantage',
                rangeReason: 'Target out of melee range (25 ft > 8 ft)',
                disadvantageReasons: ['Target out of melee range (25 ft > 8 ft)', 'Lion rage aura — within 5 ft of raging ElderPaladin'],
            });
            const badges = document.querySelectorAll('.forced-mode-badge');
            expect(badges).toHaveLength(2);
            expect(badges[0]).toHaveTextContent('Disadv (Target out of melee range (25 ft > 8 ft))');
            expect(badges[0]).toHaveAttribute('title', 'Target out of melee range (25 ft > 8 ft)');
            expect(badges[1]).toHaveTextContent('Disadv (Lion rage aura — within 5 ft of raging ElderPaladin)');
            expect(badges[1]).toHaveAttribute('title', 'Lion rage aura — within 5 ft of raging ElderPaladin');
            expect(screen.queryByText('Disadv (conditions)')).toBeNull();
        });

        it('single-reason list keeps the legacy single chip (no second chip)', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'disadvantage',
                rangeReason: 'Beyond normal range (15 ft > 8 ft)',
                disadvantageReasons: ['Beyond normal range (15 ft > 8 ft)'],
            });
            expect(document.querySelectorAll('.forced-mode-badge')).toHaveLength(1);
            expect(screen.getByText('Disadv (Beyond normal range (15 ft > 8 ft))')).toBeInTheDocument();
        });

        it('empty/null reason list falls back to the conditions copy', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'disadvantage',
                disadvantageReasons: [],
            });
            expect(document.querySelectorAll('.forced-mode-badge')).toHaveLength(1);
            expect(screen.getByText('Disadv (conditions)')).toHaveAttribute('title', 'Automatically set by active conditions');
        });

        it('advantage mode never stacks the disadvantage reason list', () => {
            renderRoll({
                name: 'Attack', rollType: 'attack', rolls: [8, 15], bonus: 2, forcedMode: 'advantage',
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
