import { render, screen } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

// Display-FEATURES lane of the DiceRollResult family: header dice-type icons,
// d20 Reliable Talent indicator, roll-adjustment notices (Elemental Adept,
// Great Weapon Fighting), and the heal-outcome lines. The hit/miss, save, and
// damage-applied exact-line text and Quick Roll gating are owned by
// DiceRollResult.combatDisplay.test.jsx; damage_type_choice rendering is owned
// by DiceRollResult.damageTypeChoice.test.jsx; Trance of Order flooring is
// owned by DiceRollResult.flooring.test.jsx; Starry Form flooring by
// DiceRollResult.rendering.test.jsx.

const renderResult = (props = {}) => render(
    <DiceRollResult name="Roll" type="d20" rolls={[10]} bonus={0} {...props} />
);

describe('header dice-type icons', () => {
    it.each`
        type                   | expectedIcon
        ${'d20'}               | ${'fa-dice-d20'}
        ${'attack'}            | ${'fa-crosshairs'}
        ${'save'}              | ${'fa-shield-halved'}
        ${'save-damage'}       | ${'fa-shield-halved'}
        ${'initiative'}        | ${'fa-gavel'}
        ${'heal'}              | ${'fa-heart'}
        ${'damage'}            | ${'fa-bolt'}
        ${'aoe-damage'}        | ${'fa-bolt'}
        ${'graze-damage'}      | ${'fa-bolt'}
        ${'overchannel-damage'}| ${'fa-bolt'}
    `('headers type $type with icon $expectedIcon', ({ type, expectedIcon }) => {
        renderResult({ type });
        const header = screen.getByText('Roll');
        const icon = header.querySelector('.fa-solid');
        expect(icon).toHaveClass(expectedIcon);
    });
});

describe('Reliable Talent indicator', () => {
    it.each([
        { label: 'floors skill check of 3', rollType: 'skill', roll: 3, line: 'Reliable Talent: d20 3 → 10' },
        { label: 'floors skill check at boundary 9', rollType: 'skill', roll: 9, line: 'Reliable Talent: d20 9 → 10' },
        { label: 'floors ability check of 3', rollType: 'check', roll: 3, line: 'Reliable Talent: d20 3 → 10' },
        { label: 'hidden at boundary 10', rollType: 'skill', roll: 10, line: null },
        { label: 'hidden for attacks', rollType: 'attack', roll: 3, line: null },
        { label: 'hidden for saves', rollType: 'save', roll: 3, line: null },
    ])('$label', ({ rollType, roll, line }) => {
        renderResult({
            name: 'Athletics',
            rolls: [roll],
            bonus: 5,
            rollType,
            reliableTalent: true,
        });
        if (line) {
            expect(screen.getByText(line)).toBeInTheDocument();
            // floored d20 feeds the displayed total: 10 + 5
            expect(screen.getByText('15')).toBeInTheDocument();
        } else {
            expect(screen.queryByText(/Reliable Talent/)).not.toBeInTheDocument();
        }
    });
});

describe('Great Weapon Fighting notice', () => {
    it.each([
        {
            label: 'shows original → displayed rolls',
            props: { gwfApplied: true, gwfOriginalRolls: [1, 4], gwfDisplayRolls: [2, 4] },
            line: 'Great Weapon Fighting: 1, 4 → 2, 4',
        },
        {
            label: 'falls back to final rolls when gwfDisplayRolls is missing',
            props: { gwfApplied: true, gwfOriginalRolls: [1, 4] },
            line: 'Great Weapon Fighting: 1, 4 → 2, 4',
        },
        {
            label: 'hidden when gwfApplied is false',
            props: { gwfApplied: false, gwfOriginalRolls: [1, 4] },
            line: null,
        },
        {
            label: 'hidden when gwfOriginalRolls is missing',
            props: { gwfApplied: true },
            line: null,
        },
    ])('$label', ({ props, line }) => {
        renderResult({ name: 'Longsword', type: 'damage', rolls: [2, 4], ...props });
        if (line) {
            expect(screen.getByText(line)).toBeInTheDocument();
        } else {
            expect(screen.queryByText(/Great Weapon Fighting/)).not.toBeInTheDocument();
        }
    });
});

describe('Elemental Adept notice', () => {
    it.each([
        { label: 'counts no ones', rolls: [3, 6, 4], line: 'Elemental Adept: 0× 1 → 2 (+1)' },
        { label: 'counts each natural 1', rolls: [1, 5, 1], line: 'Elemental Adept: 2× 1 → 2 (+1)' },
    ])('$label', ({ rolls, line }) => {
        renderResult({ name: 'Fire Bolt', type: 'damage', rolls, elementalAdeptBonus: 1 });
        expect(screen.getByText(line)).toBeInTheDocument();
    });

    it('hidden without an elemental adept bonus', () => {
        renderResult({ name: 'Fire Bolt', type: 'damage', rolls: [1, 3], elementalAdeptBonus: 0 });
        expect(screen.queryByText(/Elemental Adept/)).not.toBeInTheDocument();
    });
});

describe('heal outcome lines', () => {
    const renderHeal = (props = {}) => renderResult({
        name: 'Cure Wounds',
        type: 'heal',
        rolls: [5, 3],
        total: 8,
        targetName: 'Ally',
        ...props,
    });

    it.each([
        {
            label: 'full heal applied',
            props: { finalHeal: 8 },
            sentence: '8 healing applied to Ally',
            bonusLine: null,
        },
        {
            label: 'reduced heal with HP change',
            props: { total: 10, finalHeal: 6, healReduced: true, targetCurrentHp: 2 },
            sentence: '6 healing applied to Ally (reduced from 10) — HP: 8 → 2',
            bonusLine: null,
        },
        {
            label: 'bonus heal detail',
            props: { finalHeal: 8, bonusHeal: 3, bonusHealDetail: 'Divine Spark' },
            sentence: '8 healing applied to Ally',
            bonusLine: 'Bonus: +3 (Divine Spark)',
        },
        {
            label: 'no bonus line when bonusHeal is 0',
            props: { finalHeal: 8, bonusHeal: 0 },
            sentence: '8 healing applied to Ally',
            bonusLine: null,
        },
        {
            label: 'no bonus line when bonusHeal is undefined',
            props: { finalHeal: 8 },
            sentence: '8 healing applied to Ally',
            bonusLine: null,
        },
        {
            label: 'already at full HP when finalHeal is 0',
            props: { finalHeal: 0 },
            sentence: 'Ally is already at full HP',
            bonusLine: null,
        },
        {
            label: 'already at full HP when finalHeal is negative',
            props: { finalHeal: -3 },
            sentence: 'Ally is already at full HP',
            bonusLine: null,
        },
    ])('$label', ({ props, sentence, bonusLine }) => {
        renderHeal(props);
        expect(screen.getByText(/healing applied|already at full HP/, { selector: 'span' }))
            .toHaveTextContent(sentence);
        if (bonusLine) {
            expect(screen.getByText(bonusLine)).toBeInTheDocument();
        } else {
            expect(screen.queryByText(/Bonus: \+/)).not.toBeInTheDocument();
        }
    });
});
