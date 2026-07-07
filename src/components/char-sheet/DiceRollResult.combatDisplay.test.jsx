// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('hit/miss display', () => {
        it.each`
            hit      | rolls  | bonus | expectedText
            ${true}  | ${[18]}| ${5}  | ${'HIT'}
            ${false} | ${[8]} | ${3}  | ${'MISS'}
        `('shows $expectedText when hit is $hit with rolls: $rolls, bonus: $bonus', ({ hit, rolls, bonus, expectedText }) => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={rolls}
                    bonus={bonus}
                    targetName="Goblin"
                    targetAc={14}
                    hit={hit}
                    rollType="attack"
                />
            );
            const hitMiss = container.querySelector(`.dice-roll-hit-miss.${hit ? 'hit' : 'miss'}`);
            expect(hitMiss.textContent).toContain(expectedText);
        });

        it('shows AC value or em-dash when targetAc is provided or omitted', () => {
            const { container: c1 } = render(
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
            expect(c1.querySelector('.dice-roll-hit-miss.hit').textContent).toContain('AC 16');

            const { container: c2 } = render(
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
            expect(c2.querySelector('.dice-roll-hit-miss.hit').textContent).toContain('—');
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

        it('shows auto-miss with cover reason or default out of range', () => {
            const { container: c1 } = render(
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
            expect(c1.querySelector('.dice-roll-hit-miss.miss').textContent).toContain('AUTO-MISS');
            expect(c1.querySelector('.dice-roll-hit-miss.miss').textContent).toContain('Half cover');

            const { container: c2 } = render(
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
            expect(c2.querySelector('.dice-roll-hit-miss.miss').textContent).toContain('AUTO-MISS');
            expect(c2.querySelector('.dice-roll-hit-miss.miss').textContent).toContain('out of range');
        });
    });

    describe('glorious defense counter-attack', () => {
        it('shows counter-attack button and calls onCounterAttack when clicked', () => {
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
            fireEvent.click(screen.getByText(/Glorious Defense Counter-Attack/));
            expect(onCounter).toHaveBeenCalled();
        });

        it.each`
            hit            | isAutoMiss     | gloriousDefenseBonus | shouldShow
            ${false}       | ${true}        | ${2}                 | ${false}
            ${false}       | ${false}       | ${0}                 | ${false}
        `('does not show counter-attack when hit: $hit, isAutoMiss: $isAutoMiss, gloriousDefenseBonus: $gloriousDefenseBonus', ({ hit, isAutoMiss, gloriousDefenseBonus }) => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[8]}
                    bonus={3}
                    targetName="Goblin"
                    hit={hit}
                    rollType="attack"
                    isAutoMiss={isAutoMiss}
                    gloriousDefenseBonus={gloriousDefenseBonus}
                    onCounterAttack={vi.fn()}
                />
            );
            expect(screen.queryByText(/Glorious Defense/)).not.toBeInTheDocument();
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
    });

    describe('auto damage rolling', () => {
        it.each`
            autoDamage | hit     | showAutoDamage
            ${true}    | ${true} | ${true}
            ${true}    | ${false} | ${false}
        `('shows auto damage indicator when autoDamage: $autoDamage, hit: $hit', ({ autoDamage: _, hit: __, showAutoDamage }) => {
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
                expect(screen.getByText('Done')).toBeInTheDocument();
            } else {
                render(
                    <DiceRollResult
                        name="Longsword"
                        type="attack"
                        rolls={[8]}
                        bonus={3}
                        autoDamage={true}
                        hit={false}
                    />
                );
                expect(screen.queryByText('Done')).not.toBeInTheDocument();
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

        it('does not show save result when saveResult is falsy', () => {
            render(
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
            expect(damageEl.textContent).toContain('HP:');
        });

        it('does not show damage applied when finalDamage is undefined', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    finalDamage={undefined}
                    damageApplied={true}
                    targetName="Goblin"
                />
            );
            expect(screen.queryByText(/damage applied/)).not.toBeInTheDocument();
        });
    });

    describe('target AC and reaction bonus display', () => {
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
