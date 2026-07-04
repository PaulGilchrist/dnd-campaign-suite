// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('breakdown display', () => {
        it('shows formula in breakdown when provided', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} formula="8d6" />
            );
            expect(screen.getByText(/8d6/)).toBeInTheDocument();
        });

        it.each`
            bonus    | bonusDetail      | expected
            ${3}     | ${undefined}     | ${'+3'}
            ${-2}    | ${undefined}     | ${'-2'}
            ${3}     | ${'proficient'}  | ${'+3 proficient'}
        `('shows bonus $expected in breakdown when bonus is $bonus (bonusDetail: $bonusDetail)', ({ bonus, bonusDetail, expected }) => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={bonus} bonusDetail={bonusDetail} />
            );
            expect(screen.getByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
        });
    });

    describe('save info display', () => {
        it.each`
            dcSuccess | expectedText
            ${'half'} | ${/half damage on save/}
            ${'none'} | ${/no damage on save/}
        `('shows save info with dcSuccess "$dcSuccess" ($expectedText)', ({ dcSuccess, expectedText }) => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    dc={16}
                    dcType="DEX"
                    dcSuccess={dcSuccess}
                />
            );
            expect(screen.getByText(/Save DC 16 DEX/)).toBeInTheDocument();
            expect(screen.getByText(expectedText)).toBeInTheDocument();
        });

        it('does not show save info when dc is undefined', () => {
            render(
                <DiceRollResult
                    name="Fire Bolt"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                />
            );
            expect(screen.queryByText(/Save DC/)).not.toBeInTheDocument();
        });
    });

    describe('resistance notice', () => {
        it('shows resistance notice when provided', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    resistanceNotice="Target resistant to fire damage"
                />
            );
            expect(screen.getByText(/Target resistant to fire damage/)).toBeInTheDocument();
        });
    });

    describe('hunter lore notice', () => {
        it.each`
            hunterLoreNotice
            ${'Favored Enemy: Beast'}
            ${'Favored Enemy: Beast\nSense Motive: +5'}
        `('shows hunter lore notice: "$hunterLoreNotice"', ({ hunterLoreNotice }) => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    hunterLoreNotice={hunterLoreNotice}
                />
            );
            const lines = hunterLoreNotice.split('\n');
            lines.forEach(line => expect(screen.getByText(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument());
        });
    });

    describe('potent cantrip', () => {
        it('shows potent cantrip notice when isPotentCantrip is true', () => {
            render(
                <DiceRollResult
                    name="Ray of Frost"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    isPotentCantrip={true}
                />
            );
            expect(screen.getByText(/Potent Cantrip/)).toBeInTheDocument();
            expect(screen.getByText(/half damage on miss/)).toBeInTheDocument();
        });
    });

    describe('str check/save replace', () => {
        it.each`
            strSaveReplace | strCheckReplace | rollType | rolls | bonus | strScore | expected | description
            ${true}        | ${false}        | ${'save'}| ${[3]}| ${1}  | ${15}    | ${'15'}  | ${'strSaveReplace on save uses strScore when higher'}
            ${false}       | ${true}         | ${'check'}| ${[3]}| ${1}  | ${15}    | ${'15'}  | ${'strCheckReplace on check uses strScore when higher'}
            ${false}       | ${true}         | ${'check'}| ${[8]}| ${4}  | ${10}    | ${'12'}  | ${'strCheckReplace uses display total when strScore is lower'}
        `('$description', ({ strSaveReplace, strCheckReplace, rollType, rolls, bonus, strScore, expected }) => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={rolls}
                    bonus={bonus}
                    rollType={rollType}
                    strSaveReplace={strSaveReplace}
                    strCheckReplace={strCheckReplace}
                    strScore={strScore}
                />
            );
            expect(screen.getByText(expected)).toBeInTheDocument();
        });
    });

    describe('wis check replace', () => {
        it('uses wis bonus when wisCheckReplace is true for check', () => {
            render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={2}
                    modifier={1}
                    rollType="check"
                    wisCheckReplace={true}
                    wisCheckMinBonus={4}
                />
            );
            expect(screen.getByText('10')).toBeInTheDocument();
        });
    });
});
