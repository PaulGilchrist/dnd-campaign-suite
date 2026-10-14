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
            bonus    | modifier | bonusDetail      | expected
            ${3}     | ${0}     | ${undefined}     | ${'+3'}
            ${-2}    | ${0}     | ${undefined}     | ${'-2'}
            ${3}     | ${0}     | ${'proficient'}  | ${'+3 proficient'}
            ${0}     | ${0}     | ${undefined}     | ${''}
            ${2}     | ${1}     | ${'proficient'}  | ${'+3 proficient'}
            ${-1}    | ${-2}    | ${undefined}     | ${'-3'}
        `('shows bonus "$expected" in breakdown when bonus=$bonus modifier=$modifier bonusDetail=$bonusDetail', ({ bonus, modifier, bonusDetail, expected }) => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={bonus} modifier={modifier} bonusDetail={bonusDetail} />
            );
            if (expected === '') {
                expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
            } else {
                expect(screen.getByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
            }
        });

        it('does not show bonus text when bonus plus modifier equals zero', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={5} modifier={-5} />
            );
            expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
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

        it('renders save info when dc is zero (0 !== undefined)', () => {
            render(
                <DiceRollResult
                    name="Test"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    dc={0}
                    dcType="DEX"
                />
            );
            expect(screen.getByText(/Save DC 0 DEX/)).toBeInTheDocument();
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

        it.each`
            resistanceNotice
            ${null}
            ${undefined}
        `('does not show resistance notice when falsy ($resistanceNotice)', ({ resistanceNotice }) => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    resistanceNotice={resistanceNotice}
                />
            );
            expect(screen.queryByText(/resistant/)).not.toBeInTheDocument();
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

        it('does not show hunter lore notice when null', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    hunterLoreNotice={null}
                />
            );
            expect(screen.queryByText(/Favored Enemy/)).not.toBeInTheDocument();
        });

        it('does not show hunter lore notice when empty string', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    hunterLoreNotice=""
                />
            );
            expect(screen.queryByText(/Favored Enemy/)).not.toBeInTheDocument();
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

        it.each`
            isPotentCantrip
            ${false}
            ${undefined}
        `('does not show potent cantrip notice when falsy ($isPotentCantrip)', ({ isPotentCantrip }) => {
            render(
                <DiceRollResult
                    name="Ray of Frost"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    isPotentCantrip={isPotentCantrip}
                />
            );
            expect(screen.queryByText(/Potent Cantrip/)).not.toBeInTheDocument();
        });
    });

    describe('str check/save replace', () => {
        it.each`
            strSaveReplace | strCheckReplace | rollType | rolls | bonus | modifier | strScore | expected | description
            ${true}        | ${false}        | ${'save'}| ${[3]}| ${1}  | ${0}     | ${15}    | ${'15'}  | ${'strSaveReplace on save uses strScore when higher'}
            ${false}       | ${true}         | ${'check'}| ${[3]}| ${1}  | ${0}     | ${15}    | ${'15'}  | ${'strCheckReplace on check uses strScore when higher'}
            ${false}       | ${true}         | ${'check'}| ${[8]}| ${4}  | ${0}     | ${10}    | ${'12'}  | ${'strCheckReplace uses display total when strScore is lower'}
            ${false}       | ${true}         | ${'skill'}| ${[5]}| ${2}  | ${1}     | ${18}    | ${'18'}  | ${'strCheckReplace on skill uses strScore when higher'}
            ${true}        | ${false}        | ${'save'}| ${[18]}| ${3}  | ${0}     | ${12}    | ${'21'}  | ${'strSaveReplace uses display total when strScore is lower'}
        `('$description', ({ strSaveReplace, strCheckReplace, rollType, rolls, bonus, modifier, strScore, expected }) => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={rolls}
                    bonus={bonus}
                    modifier={modifier}
                    rollType={rollType}
                    strSaveReplace={strSaveReplace}
                    strCheckReplace={strCheckReplace}
                    strScore={strScore}
                />
            );
            expect(screen.getByText(expected)).toBeInTheDocument();
        });

        it('shows Indomitable Might indicator in breakdown when replacement is applied', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[8]}
                    bonus={11}
                    rollType="check"
                    strCheckReplace={true}
                    strScore={21}
                />
            );
            expect(screen.getByText(/Indomitable Might/)).toBeInTheDocument();
        });

        it('does not show Indomitable Might indicator when replacement is not applied', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[18]}
                    bonus={5}
                    rollType="check"
                    strCheckReplace={true}
                    strScore={14}
                />
            );
            expect(screen.queryByText(/Indomitable Might/)).not.toBeInTheDocument();
        });

        it('does not apply strSaveReplace when rollType is not save', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[3]}
                    bonus={1}
                    rollType="check"
                    strSaveReplace={true}
                    strCheckReplace={false}
                    strScore={15}
                />
            );
            expect(screen.getByText('4')).toBeInTheDocument();
            expect(screen.queryByText(/Indomitable Might/)).not.toBeInTheDocument();
        });

        it('does not apply strCheckReplace when rollType is save', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[3]}
                    bonus={1}
                    rollType="save"
                    strSaveReplace={false}
                    strCheckReplace={true}
                    strScore={15}
                />
            );
            expect(screen.getByText('4')).toBeInTheDocument();
            expect(screen.queryByText(/Indomitable Might/)).not.toBeInTheDocument();
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

        it('uses wis bonus for skill rollType', () => {
            render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[3]}
                    bonus={2}
                    modifier={1}
                    rollType="skill"
                    wisCheckReplace={true}
                    wisCheckMinBonus={5}
                />
            );
            expect(screen.getByText('9')).toBeInTheDocument();
        });

        it('does not apply wisCheckReplace when rollType is not check or skill', () => {
            render(
                <DiceRollResult
                    name="DEX Save"
                    type="d20"
                    rolls={[5]}
                    bonus={4}
                    rollType="save"
                    wisCheckReplace={true}
                    wisCheckMinBonus={6}
                />
            );
            expect(screen.getByText('9')).toBeInTheDocument();
        });

        it('does not apply wisCheckReplace when false', () => {
            render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={2}
                    modifier={1}
                    rollType="check"
                    wisCheckReplace={false}
                    wisCheckMinBonus={4}
                />
            );
            expect(screen.getByText('8')).toBeInTheDocument();
        });
    });
});
