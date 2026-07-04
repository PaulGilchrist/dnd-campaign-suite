// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('hit/miss display', () => {
        it('shows hit when hit is true with target info', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    targetName="Goblin"
                    targetAc={14}
                    hit={true}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            expect(hitMiss.textContent).toContain('HIT');
            expect(hitMiss.textContent).toContain('23 vs AC 14');
        });

        it('shows miss when hit is false with target info', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Orc"
                    targetAc={15}
                    hit={false}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.miss');
            expect(hitMiss.textContent).toContain('MISS');
            expect(hitMiss.textContent).toContain('11 vs AC 15');
        });

        it('does not show hit/miss when hit is undefined', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    targetName="Goblin"
                    targetAc={14}
                    rollType="attack"
                />
            );
            expect(screen.queryByText(/HIT/)).not.toBeInTheDocument();
            expect(screen.queryByText(/MISS/)).not.toBeInTheDocument();
        });

        it.each`
            type           | rollType
            ${'damage'}    | ${undefined}
            ${'save-damage'} | ${'attack'}
        `('does not show hit/miss for type: $type, rollType: $rollType', ({ type, rollType }) => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type={type}
                    rolls={[6]}
                    bonus={0}
                    targetName="Goblin"
                    hit={true}
                    rollType={rollType}
                />
            );
            expect(screen.queryByText(/HIT/)).not.toBeInTheDocument();
        });

        it('shows auto-miss with cover reason', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    targetName="Goblin"
                    targetAc={14}
                    hit={false}
                    rollType="attack"
                    isAutoMiss={true}
                    coverReason="Half cover"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.miss');
            expect(hitMiss.textContent).toContain('AUTO-MISS');
            expect(hitMiss.textContent).toContain('Half cover');
        });

        it('shows auto-miss with default out of range when no reason', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    isAutoMiss={true}
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.miss');
            expect(hitMiss.textContent).toContain('AUTO-MISS');
            expect(hitMiss.textContent).toContain('out of range');
        });
    });

    describe('glorious defense counter-attack', () => {
        it('shows counter-attack button when conditions met', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    gloriousDefenseBonus={2}
                    onCounterAttack={onCounter}
                />
            );
            expect(screen.getByText(/Glorious Defense Counter-Attack/)).toBeInTheDocument();
        });

        it('does not show counter-attack button when hit is true', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    hit={true}
                    rollType="attack"
                    gloriousDefenseBonus={2}
                    onCounterAttack={onCounter}
                />
            );
            expect(screen.queryByText(/Glorious Defense/)).not.toBeInTheDocument();
        });

        it('does not show counter-attack button when isAutoMiss is true', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    isAutoMiss={true}
                    gloriousDefenseBonus={2}
                    onCounterAttack={onCounter}
                />
            );
            expect(screen.queryByText(/Glorious Defense/)).not.toBeInTheDocument();
        });

        it('does not show counter-attack button when gloriousDefenseBonus is 0', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    gloriousDefenseBonus={0}
                    onCounterAttack={onCounter}
                />
            );
            expect(screen.queryByText(/Glorious Defense/)).not.toBeInTheDocument();
        });

        it('calls onCounterAttack when counter-attack button is clicked', () => {
            const onCounter = vi.fn();
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={false}
                    rollType="attack"
                    gloriousDefenseBonus={2}
                    onCounterAttack={onCounter}
                />
            );
            fireEvent.click(screen.getByText(/Glorious Defense Counter-Attack/));
            expect(onCounter).toHaveBeenCalled();
        });
    });

    describe('cover display', () => {
        it.each`
            coverLevel      | expectedText
            ${'threeQuarter'} | ${'3/4 Cover (+2 AC)'}
            ${'half'}         | ${'1/2 Cover (+2 AC)'}
        `('shows cover text for level: $coverLevel', ({ coverLevel, expectedText }) => {
            render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    coverLevel={coverLevel}
                    coverAcBonus={2}
                />
            );
            expect(screen.getByText(expectedText)).toBeInTheDocument();
        });

        it('does not show cover when coverAcBonus is 0', () => {
            render(
                <DiceRollResult
                    name="Longbow"
                    type="attack"
                    rolls={[12]}
                    bonus={4}
                    coverLevel="threeQuarter"
                    coverAcBonus={0}
                />
            );
            expect(screen.queryByText(/Cover/)).not.toBeInTheDocument();
        });
    });

    describe('auto damage rolling', () => {
        it.each`
            autoDamage | hit     | showAutoDamage
            ${true}    | ${true} | ${true}
            ${true}    | ${false} | ${false}
            ${false}   | ${true} | ${false}
        `('shows auto damage indicator when autoDamage: $autoDamage, hit: $hit', ({ autoDamage, hit, showAutoDamage }) => {
            if (showAutoDamage) {
                render(
                    <DiceRollResult
                        name="Longsword"
                        type="attack"
                        rolls={[18]}
                        bonus={5}
                        autoDamage={true}
                        hit={true}
                    />
                );
                expect(screen.getByText(/Rolling damage/)).toBeInTheDocument();
            } else {
                render(
                    <DiceRollResult
                        name="Longsword"
                        type="attack"
                        rolls={[8]}
                        bonus={3}
                        autoDamage={autoDamage}
                        hit={hit}
                    />
                );
                expect(screen.queryByText(/Rolling damage/)).not.toBeInTheDocument();
            }
        });
    });

    describe('waiting for player save', () => {
        it('shows waiting message with target name and save type', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    waitingForPlayerSave={true}
                    targetName="Goblin"
                    saveDc={14}
                    saveType="DEX"
                />
            );
            const waiting = container.querySelector('.dice-roll-save-waiting');
            expect(waiting.textContent).toContain('Goblin');
            expect(waiting.textContent).toContain('DEX');
            expect(waiting.textContent).toContain('DC 14');
        });

        it('shows quick roll button and calls onQuickRoll when clicked', () => {
            const onQuickRoll = vi.fn();
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    waitingForPlayerSave={true}
                    targetName="Goblin"
                    saveDc={14}
                    saveType="DEX"
                    onQuickRoll={onQuickRoll}
                />
            );
            expect(screen.getByText(/Quick Roll/)).toBeInTheDocument();
            fireEvent.click(screen.getByText(/Quick Roll/));
            expect(onQuickRoll).toHaveBeenCalled();
        });

        it('does not show waiting message when waitingForPlayerSave is false', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    waitingForPlayerSave={false}
                    targetName="Goblin"
                    saveDc={14}
                    saveType="DEX"
                />
            );
            expect(screen.queryByText(/Waiting for/)).not.toBeInTheDocument();
        });
    });

    describe('save result display', () => {
        it('shows save success with roll detail when saveResult.success is true', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: true, total: 18, roll: 14, bonus: 4 }}
                    saveDc={15}
                />
            );
            expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
            expect(screen.getByText(/18 vs DC 15/)).toBeInTheDocument();
            expect(screen.getByText(/d20 14 \+ 4/)).toBeInTheDocument();
        });

        it('shows save failure when saveResult.success is false', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: false, total: 12, roll: 8, bonus: 4 }}
                    saveDc={15}
                />
            );
            expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
        });

        it('shows save roll detail with zero bonus', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={{ success: true, total: 14, roll: 14, bonus: 0 }}
                    saveDc={15}
                />
            );
            expect(screen.getByText(/d20 14 \+ 0/)).toBeInTheDocument();
        });

        it('does not show save result when saveResult is null or undefined', () => {
            const { rerender } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveResult={null}
                    saveDc={15}
                />
            );
            expect(screen.queryByText(/SAVE SUCCESS/)).not.toBeInTheDocument();
            expect(screen.queryByText(/SAVE FAILURE/)).not.toBeInTheDocument();

            rerender(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    saveDc={15}
                />
            );
            expect(screen.queryByText(/SAVE SUCCESS/)).not.toBeInTheDocument();
        });
    });

    describe('damage applied display', () => {
        it('shows damage applied without reduction', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    finalDamage={15}
                    damageApplied={true}
                    targetName="Goblin"
                    originalTotal={15}
                />
            );
            const damageEl = container.querySelector('.dice-roll-damage-applied');
            expect(damageEl.textContent).toContain('15');
            expect(damageEl.textContent).toContain('damage applied');
            expect(damageEl.textContent).toContain('Goblin');
        });

        it('shows damage applied with reduction and HP change', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    total={15}
                    finalDamage={8}
                    damageApplied={true}
                    damageReduced={true}
                    targetName="Orc"
                    targetCurrentHp={5}
                />
            );
            const damageEl = container.querySelector('.dice-roll-damage-applied');
            expect(damageEl.textContent).toContain('8');
            expect(damageEl.textContent).toContain('damage applied');
            expect(damageEl.textContent).toContain('Orc');
            expect(damageEl.textContent).toContain('reduced from 15');
            expect(damageEl.textContent).toContain('HP: 13 → 5');
        });

        it('does not show damage applied when damageApplied is false or finalDamage is undefined', () => {
            const { rerender } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    finalDamage={15}
                    damageApplied={false}
                    targetName="Goblin"
                />
            );
            expect(screen.queryByText(/damage applied/)).not.toBeInTheDocument();

            rerender(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    damageApplied={true}
                    targetName="Goblin"
                />
            );
            expect(screen.queryByText(/damage applied/)).not.toBeInTheDocument();
        });
    });

    describe('target AC and reaction bonus display', () => {
        it('shows "—" when targetAc is undefined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    hit={true}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            expect(hitMiss.textContent).toContain('—');
        });

        it('shows numeric AC when provided', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    targetAc={16}
                    hit={true}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            expect(hitMiss.textContent).toContain('AC 16');
        });

        it.each`
            baitAndSwitch | gloriousDefense | defensiveDuelist | expectedReaction
            ${3}          | ${0}            | ${0}             | ${'3 reaction'}
            ${0}          | ${0}            | ${0}             | ${null}
            ${3}          | ${2}            | ${0}             | ${'5 reaction'}
        `('shows reaction bonus $expectedReaction when baitAndSwitch: $baitAndSwitch, gloriousDefense: $gloriousDefense, defensiveDuelist: $defensiveDuelist', ({ baitAndSwitch, gloriousDefense, defensiveDuelist, expectedReaction }) => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    targetName="Goblin"
                    targetAc={14}
                    hit={true}
                    rollType="attack"
                    baitAndSwitchBonus={baitAndSwitch}
                    gloriousDefenseBonus={gloriousDefense}
                    defensiveDuelistBonus={defensiveDuelist}
                />
            );
            const hitMiss = container.querySelector('.dice-roll-hit-miss.hit');
            if (expectedReaction) {
                expect(hitMiss.textContent).toContain(expectedReaction);
            } else {
                expect(hitMiss.textContent).not.toContain('reaction');
            }
        });
    });
});
