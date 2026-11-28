// @maintained-by-ai 2026-11-27
// Info-display lane of the DiceRollResult family: the breakdown line (formula,
// d20/dice span, modifier text incl. bonusDetail, the bonus+modifier summation
// and the zero-modifier suppression), the Save DC info line and its full
// visibility gate (dc defined, no success outcome, not waiting-for-player-save,
// not save-damage), the resistance / hunter-lore (incl. \n split) /
// potent-cantrip notices with combined positive and absence legs, the
// Indomitable Might str replace (total + breakdown annotation + rollType
// gating + strict-less-than boundary), and the WIS check-replace totals plus
// their false-equation-free breakdown face. This seam is display-only —
// click interactions are exercised elsewhere.
// Owned by sibling lanes (deferred here): hit/miss, auto-miss, waiting-for-save,
// save-result and damage-applied lines → DiceRollResult.combatDisplay.test.jsx;
// header icons, Reliable Talent, GWF, Elemental Adept and heal outcomes →
// DiceRollResult.displayFeatures.test.jsx; Homing Strikes → DiceRollResult.homing.test.jsx
// (whose lane notes recommend shieldOfFaith.test.jsx adopt exact-full-line constants —
// deferred there); mode toggles → DiceRollResult.toggles.test.jsx.
import { render, screen } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

const renderResult = (props = {}) => render(
    <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} {...props} />
);

const queryBreakdown = (container) => container.querySelector('.dice-roll-breakdown');

describe('breakdown line', () => {
    it.each([
        {
            label: 'formula and rolls for a damage roll',
            props: { name: 'Fireball', type: 'damage', rolls: [6, 5, 4], formula: '8d6', total: 15 },
            breakdown: '8d6: 6, 5, 4', total: '15',
        },
        { label: 'positive bonus', props: { bonus: 3 }, breakdown: 'd20 10 +3 → 13', total: '13' },
        { label: 'negative bonus', props: { bonus: -2 }, breakdown: 'd20 10 -2 → 8', total: '8' },
        { label: 'bonus with detail', props: { bonus: 3, bonusDetail: 'proficient' }, breakdown: 'd20 10 +3 proficient → 13', total: '13' },
        { label: 'zero bonus and modifier shows no modifier', props: {}, breakdown: 'd20 10 → 10', total: '10' },
        { label: 'bonus plus modifier with detail', props: { bonus: 2, modifier: 1, bonusDetail: 'proficient' }, breakdown: 'd20 10 +3 proficient → 13', total: '13' },
        { label: 'negative bonus plus modifier', props: { bonus: -1, modifier: -2 }, breakdown: 'd20 10 -3 → 7', total: '7' },
        { label: 'bonus cancels modifier', props: { bonus: 5, modifier: -5 }, breakdown: 'd20 10 → 10', total: '10' },
    ])('$label — breakdown "$breakdown", total $total', ({ props, breakdown, total }) => {
        const { container } = renderResult(props);
        expect(queryBreakdown(container)?.textContent).toBe(breakdown);
        expect(screen.getByText(total, { selector: '.dice-roll-total' })).toBeInTheDocument();
    });
});

describe('Save DC info line', () => {
    it.each([
        { label: 'half damage on save', props: { dcSuccess: 'half' }, line: 'Save DC 16 DEX: half damage on save' },
        { label: 'no damage on save', props: { dcSuccess: 'none' }, line: 'Save DC 16 DEX: no damage on save' },
        { label: 'dc 0 is displayed (0 !== undefined)', props: { dc: 0 }, line: 'Save DC 0 DEX: no damage on save' },
        { label: 'hidden when dc is undefined', props: { dc: undefined }, line: null },
        { label: 'hidden for save-damage rolls', props: { type: 'save-damage', rollType: 'save-damage' }, line: null },
        { label: 'hidden once a success outcome is set', props: { rollType: 'condition-save', success: true, total: 10 }, line: null },
        { label: 'hidden while waiting for the player save', props: { waitingForPlayerSave: true }, line: null },
    ])('$label', ({ props, line }) => {
        renderResult({ name: 'Fireball', type: 'damage', rolls: [6, 5, 4], dc: 16, dcType: 'DEX', ...props });
        if (line) {
            expect(screen.getByText(line)).toBeInTheDocument();
        } else {
            expect(screen.queryByText(/Save DC \d+/)).not.toBeInTheDocument();
        }
    });
});

describe('info notices (resistance / hunter lore / potent cantrip)', () => {
    // All three ride the same falsy-short-circuit render branch, so the
    // absence legs are one combined census per falsy shape rather than
    // three per-notice clones.
    it('renders all three notices verbatim when provided', () => {
        renderResult({
            name: 'Ray of Frost',
            type: 'attack',
            rolls: [15],
            bonus: 3,
            resistanceNotice: 'Target resistant to fire damage',
            hunterLoreNotice: 'Favored Enemy: Beast',
            isPotentCantrip: true,
        });
        expect(screen.getByText('Target resistant to fire damage')).toBeInTheDocument();
        expect(screen.getByText('Favored Enemy: Beast')).toBeInTheDocument();
        expect(screen.getByText('Potent Cantrip: half damage on miss')).toBeInTheDocument();
    });

    it('splits a multi-line hunter lore notice onto separate lines', () => {
        renderResult({ name: 'Attack', type: 'attack', rolls: [15], bonus: 3, hunterLoreNotice: 'Favored Enemy: Beast\nSense Motive: +5' });
        expect(screen.getByText('Favored Enemy: Beast')).toBeInTheDocument();
        expect(screen.getByText('Sense Motive: +5')).toBeInTheDocument();
    });

    it.each([
        { label: 'empty strings / false', props: { resistanceNotice: '', hunterLoreNotice: '', isPotentCantrip: false } },
        { label: 'nulls / undefined', props: { resistanceNotice: null, hunterLoreNotice: null, isPotentCantrip: undefined } },
        { label: 'omitted entirely', props: {} },
    ])('hides all three notices when $label', ({ props }) => {
        renderResult({ name: 'Attack', type: 'attack', rolls: [15], bonus: 3, ...props });
        expect(screen.queryByText(/resistant/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Favored Enemy/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Potent Cantrip/)).not.toBeInTheDocument();
    });
});

describe('str check/save replace (Indomitable Might)', () => {
    it.each([
        {
            label: 'save replace lifts a low save to strScore',
            props: { rolls: [3], bonus: 1, rollType: 'save', strSaveReplace: true, strScore: 15 },
            total: '15', breakdown: 'd20 3 → 15 (Indomitable Might)',
        },
        {
            label: 'check replace lifts a low check to strScore',
            props: { rolls: [3], bonus: 1, rollType: 'check', strCheckReplace: true, strScore: 15 },
            total: '15', breakdown: 'd20 3 → 15 (Indomitable Might)',
        },
        {
            label: 'skill replace lifts a low skill to strScore',
            props: { rolls: [5], bonus: 2, modifier: 1, rollType: 'skill', strCheckReplace: true, strScore: 18 },
            total: '18', breakdown: 'd20 5 → 18 (Indomitable Might)',
        },
        {
            label: 'save keeps display total when strScore is lower',
            props: { rolls: [18], bonus: 3, rollType: 'save', strSaveReplace: true, strScore: 12 },
            total: '21', breakdown: 'd20 18 +3 → 21',
        },
        {
            label: 'check keeps display total when strScore is lower',
            props: { rolls: [8], bonus: 4, rollType: 'check', strCheckReplace: true, strScore: 10 },
            total: '12', breakdown: 'd20 8 +4 → 12',
        },
        {
            label: 'boundary display total equal to strScore is not replaced',
            props: { rolls: [12], bonus: 3, rollType: 'save', strSaveReplace: true, strScore: 15 },
            total: '15', breakdown: 'd20 12 +3 → 15',
        },
        {
            label: 'strSaveReplace ignored on a check',
            props: { rolls: [3], bonus: 1, rollType: 'check', strSaveReplace: true, strCheckReplace: false, strScore: 15 },
            total: '4', breakdown: 'd20 3 +1 → 4',
        },
        {
            label: 'strCheckReplace ignored on a save',
            props: { rolls: [3], bonus: 1, rollType: 'save', strSaveReplace: false, strCheckReplace: true, strScore: 15 },
            total: '4', breakdown: 'd20 3 +1 → 4',
        },
    ])('$label', ({ props, total, breakdown }) => {
        const { container } = renderResult({ name: 'Athletics', bonus: 0, ...props });
        expect(screen.getByText(total, { selector: '.dice-roll-total' })).toBeInTheDocument();
        expect(queryBreakdown(container)?.textContent).toBe(breakdown);
    });
});

describe('wis check replace', () => {
    // The floored total (roll + wisCheckMinBonus + modifier) must NOT grow a
    // false `→ total` equation on the breakdown face — the shown die + printed
    // bonus do not sum to it (rollTotalEquation guard). The ignored legs keep
    // the honest equation because their displayed math does sum to the total.
    it.each([
        { label: 'check floors to wis minimum bonus', props: { rolls: [5], bonus: 2, modifier: 1, rollType: 'check', wisCheckReplace: true, wisCheckMinBonus: 4 }, total: '10', breakdown: 'd20 5 +3' },
        { label: 'skill floors to wis minimum bonus', props: { rolls: [3], bonus: 2, modifier: 1, rollType: 'skill', wisCheckReplace: true, wisCheckMinBonus: 5 }, total: '9', breakdown: 'd20 3 +3' },
        { label: 'ignored when rollType is save', props: { rolls: [5], bonus: 4, rollType: 'save', wisCheckReplace: true, wisCheckMinBonus: 6 }, total: '9', breakdown: 'd20 5 +4 → 9' },
        { label: 'ignored when false', props: { rolls: [5], bonus: 2, modifier: 1, rollType: 'check', wisCheckReplace: false, wisCheckMinBonus: 4 }, total: '8', breakdown: 'd20 5 +3 → 8' },
    ])('$label', ({ props, total, breakdown }) => {
        const { container } = renderResult({ name: 'Insight', bonus: 0, ...props });
        expect(screen.getByText(total, { selector: '.dice-roll-total' })).toBeInTheDocument();
        expect(queryBreakdown(container)?.textContent).toBe(breakdown);
    });
});
