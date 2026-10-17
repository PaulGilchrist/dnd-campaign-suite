// DiceRollResult — interactive click-dispatch seam tests.
//
// Seam ownership map:
//   - THIS file: click-dispatch behaviour of the popup — the damage-type-choice /
//     damage-type-skip window CustomEvents fired by DamageTypeChoiceSection buttons,
//     prop-callback dispatch on click (onDone incl. autoDamage.damageTypeChoices,
//     onTacticalMind declare, onBardicInspirationDefense/Offense,
//     onSuperiorityManeuver), offer-visibility gating, and post-click UI
//     transitions (offer replaced by result row).
//   - DamageTypeChoiceSection rendering contract: DiceRollResult.damageTypeChoice.test.jsx.
//   - createDiceRollHandlers payload contracts: DiceRollResult.handlers.test.js
//     (savageAttacker: handlers.savageAttacker.test.js; superiority die-size
//     selection: superiorityDie.test.jsx).
//   - damage-type event CONSUMERS: CharActions.events.test.jsx.
//   - Psi-Bolstered Knack panel/offer: DiceRollResult.toggles.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

// Deterministic dice: 0.5 → d20=11, d10=6, d8=5, d6=4. Restored in afterEach.
let randomSpy;
beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => {
    randomSpy.mockRestore();
});

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

describe('DiceRollResult — offer visibility', () => {
    it.each([
        ['luckyAdvantage', /Lucky: Advantage \(1 LP\)/],
        ['luckyDisadvantage', /Lucky: Disadvantage \(1 LP\)/],
        ['strokeOfLuck', /Stroke of Luck/],
        ['autoReroll', /Reroll/],
    ])('%s is offered on a d20 roll and hidden on a damage roll', (prop, name) => {
        const view = render(
            <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={3} {...{ [prop]: true }} />
        );
        expect(view.getByRole('button', { name })).toBeInTheDocument();
        view.unmount();

        render(
            <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} {...{ [prop]: true }} />
        );
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    });

    it('renders no feature offers when no offer props are provided', () => {
        render(<DiceRollResult name="Attack" type="d20" rolls={[12]} bonus={3} />);
        for (const pattern of [/Lucky/, /Stroke of Luck/, /Reroll/, /Tactical Mind/]) {
            expect(screen.queryByRole('button', { name: pattern })).not.toBeInTheDocument();
        }
    });

    it.each([
        ['plain reroll', { autoReroll: true }, true, /Reroll/],
        ['reroll with bonus', { autoReroll: true, autoRerollBonus: 2 }, true, /Reroll \(\+2\)/],
        ['auto-conditional reroll (roll_equals_1)', { autoReroll: true, autoRerollCondition: 'roll_equals_1' }, false, /Reroll/],
    ])('reroll button for %s', (_label, overrides, visible, name) => {
        render(<DiceRollResult name="Attack" type="d20" rolls={[12]} bonus={3} {...overrides} />);
        if (visible) {
            expect(screen.getByRole('button', { name })).toBeInTheDocument();
        } else {
            expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
        }
    });

    it.each([
        ['failed check', { rollType: 'check', rolls: [5] }, true],
        ['failed skill', { rollType: 'skill', rolls: [5] }, true],
        ['attack', { rollType: 'attack', rolls: [5] }, false],
        ['save', { rollType: 'save', rolls: [5] }, false],
        ['known successful check (CLA-352)', { rollType: 'check', rolls: [19], success: true }, false],
        ['natural 20 check (CLA-352)', { rollType: 'check', rolls: [20] }, false],
    ])('tactical mind offer on %s', (_label, overrides, visible) => {
        render(
            <DiceRollResult name="Athletics" type="d20" bonus={3} tacticalMind={true} {...overrides} />
        );
        if (visible) {
            expect(screen.getByRole('button', { name: /Tactical Mind/ })).toBeInTheDocument();
        } else {
            expect(screen.queryByRole('button', { name: /Tactical Mind/ })).not.toBeInTheDocument();
        }
    });

    it.each([
        [['Precision Attack', 'Trip Attack'], ['Precision Attack (Superiority Die)', 'Trip Attack (Superiority Die)']],
        [['Precision Attack'], ['Precision Attack (Superiority Die)']],
        [[], []],
        [null, []],
    ])('superiority maneuver buttons when maneuvers is %s', (maneuvers, expectedNames) => {
        render(
            <DiceRollResult
                name="Attack"
                type="d20"
                rolls={[12]}
                bonus={3}
                rollType="attack"
                availableSuperiorityManeuvers={maneuvers?.map((name) => ({ name }))}
            />
        );
        const names = screen.queryAllByRole('button', { name: /Superiority Die/ }).map((b) => b.textContent.trim());
        expect(names).toEqual(expectedNames);
    });

    it.each([true, false])('halfling Lucky reroll message when luckyRerolled is %s', (luckyRerolled) => {
        const { container } = render(
            <DiceRollResult
                name="DEX Save"
                type="d20"
                rolls={[1, 19]}
                bonus={2}
                luckyRerolled={luckyRerolled}
                luckyRerollValue={14}
            />
        );
        if (luckyRerolled) {
            expect(screen.getByText(/Lucky \(Halfling\): rerolled natural 1 → 14/)).toBeInTheDocument();
            expect(normalize(container.querySelector('.dice-rolled').textContent)).toBe('14 (Lucky reroll)');
        } else {
            expect(screen.queryByText(/Lucky \(Halfling\)/)).not.toBeInTheDocument();
        }
    });
});

describe('DiceRollResult — click dispatch and result rows', () => {
    function renderResultRow(overrides) {
        const { container } = render(
            <DiceRollResult name="Attack" type="d20" rolls={[12]} bonus={3} {...overrides} />
        );
        return () => normalize(container.querySelector('.dice-roll-reroll-result').textContent);
    }

    it('reroll click replaces the offer with the exact rerolled total', () => {
        const rowText = renderResultRow({ autoReroll: true });
        fireEvent.click(screen.getByRole('button', { name: /Reroll/ }));
        expect(screen.queryByRole('button', { name: /Reroll/ })).not.toBeInTheDocument();
        expect(rowText()).toBe('Rerolled: 11 + 3 = 14');
    });

    it('stroke of luck click replaces the offer with a natural 20 total', () => {
        const rowText = renderResultRow({ strokeOfLuck: true });
        fireEvent.click(screen.getByRole('button', { name: /Stroke of Luck/ }));
        expect(screen.queryByRole('button', { name: /Stroke of Luck/ })).not.toBeInTheDocument();
        expect(rowText()).toBe('Stroke of Luck: d20 → 20 + 3 = 23');
        expect(screen.getByText('20 (Stroke of Luck)')).toBeInTheDocument();
    });

    it.each([
        ['Still Failed', /Still Failed/, false, /not expended/],
        ['Succeeded', /Succeeded/, true, /Second Wind use expended\./],
    ])('CLA-352: %s click defers then reports the Second Wind spend', (_label, declareName, success, expectedNotice) => {
        const onTacticalMind = vi.fn();
        const { container } = render(
            <DiceRollResult
                name="Athletics"
                type="d20"
                rolls={[5]}
                bonus={3}
                rollType="check"
                tacticalMind={true}
                onTacticalMind={onTacticalMind}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Tactical Mind/ }));
        // Spend is deferred: rolling the d10 alone must not report anything.
        expect(onTacticalMind).not.toHaveBeenCalled();
        // Deterministic d10 = 6 → 5 + 3 + 6 = 14 (numeric — no NaN path).
        expect(container.querySelector('.dice-roll-reroll-result').textContent).toMatch(/Tactical Mind: \+6 → 14/);

        fireEvent.click(screen.getByRole('button', { name: declareName }));
        expect(onTacticalMind).toHaveBeenCalledWith({ dieValue: 6, success });
        expect(screen.getByText(expectedNotice)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Still Failed/ })).not.toBeInTheDocument();
    });

    it('superiority maneuver click dispatches the maneuver with its rolled die', () => {
        const onSuperiorityManeuver = vi.fn();
        const rowText = renderResultRow({
            rollType: 'attack',
            availableSuperiorityManeuvers: [{ name: 'Precision Attack' }],
            playerStats: { level: 3 },
            onSuperiorityManeuver,
        });
        fireEvent.click(screen.getByRole('button', { name: /Precision Attack/ }));
        // Level-3 superiority die is a d8 → deterministic roll of 5.
        expect(onSuperiorityManeuver).toHaveBeenCalledWith('Precision Attack', 5);
        expect(screen.queryByRole('button', { name: /Precision Attack/ })).not.toBeInTheDocument();
        expect(rowText()).toContain('Precision Attack');
        expect(rowText()).toMatch(/→ 20 \(\+5\)/);
    });

    it('bardic inspiration defense click dispatches the new AC without a miss', () => {
        const onBardicInspirationDefense = vi.fn();
        const { container } = render(
            <DiceRollResult
                name="Longsword"
                type="attack"
                rolls={[18]}
                bonus={5}
                targetName="Goblin"
                targetAc={16}
                hit={true}
                bardicInspirationDefense={true}
                bardicInspirationDefenseDieSize={6}
                onBardicInspirationDefense={onBardicInspirationDefense}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/ }));
        // d6 = 4 → AC 16 + 4 = 20; attack total 23 still hits.
        expect(onBardicInspirationDefense).toHaveBeenCalledWith(4, 6, 20, false);
        expect(screen.queryByRole('button', { name: /Bardic Inspiration - Defense/ })).not.toBeInTheDocument();
        expect(normalize(container.querySelector('.dice-roll-reroll-result').textContent))
            .toBe('Bardic Inspiration - Defense: 1d6 → 4 → AC 20 (Attack still hits)');
    });

    it('bardic inspiration offense click dispatches the bonus damage', () => {
        const onBardicInspirationOffense = vi.fn();
        const { container } = render(
            <DiceRollResult
                name="Fireball"
                type="damage"
                rolls={[6, 5, 4]}
                bonus={0}
                total={15}
                bardicInspirationOffense={true}
                bardicInspirationOffenseDieSize={6}
                onBardicInspirationOffense={onBardicInspirationOffense}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Offense/ }));
        expect(onBardicInspirationOffense).toHaveBeenCalledWith(4, 6);
        expect(screen.queryByRole('button', { name: /Bardic Inspiration - Offense/ })).not.toBeInTheDocument();
        expect(normalize(container.querySelector('.dice-roll-reroll-result').textContent))
            .toBe('Bardic Inspiration - Offense: 1d6 → +4 → 19');
    });

    it('Done click on an auto-damage hit reports the computed hit', () => {
        const onDone = vi.fn();
        render(
            <DiceRollResult
                name="Longsword"
                type="attack"
                rolls={[18]}
                bonus={5}
                targetName="Goblin"
                targetAc={14}
                hit={true}
                rollType="attack"
                autoDamage={true}
                onDone={onDone}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Done/ }));
        expect(onDone).toHaveBeenCalledWith(true);
    });

    it('offers no Done button on an auto-damage miss', () => {
        const onDone = vi.fn();
        render(
            <DiceRollResult
                name="Longsword"
                type="attack"
                rolls={[8]}
                bonus={5}
                targetName="Goblin"
                targetAc={14}
                hit={false}
                rollType="attack"
                autoDamage={true}
                onDone={onDone}
            />
        );
        expect(screen.queryByRole('button', { name: /Done/ })).not.toBeInTheDocument();
        expect(onDone).not.toHaveBeenCalled();
    });

    it('auto-damage type choices dispatch Done with the chosen type instead of plain Done', () => {
        const onDone = vi.fn();
        render(
            <DiceRollResult
                name="Maul"
                type="attack"
                rolls={[18]}
                bonus={5}
                targetName="Goblin"
                targetAc={14}
                hit={true}
                rollType="attack"
                autoDamage={{ damageTypeChoices: ['Radiant', 'Necrotic'] }}
                onDone={onDone}
            />
        );
        expect(screen.queryByRole('button', { name: /Done/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Radiant' }));
        expect(onDone).toHaveBeenCalledWith(true, 'Radiant');
    });
});

describe('DiceRollResult — damage type choice dispatch (owned seam)', () => {
    const choiceProps = {
        name: 'Flame Blade',
        type: 'damage_type_choice',
        rolls: [18],
        bonus: 5,
        baseFormula: '1d8',
        baseRolls: [5],
        baseTotal: 5,
        bonusFormula: '1d8',
        bonusRolls: [3],
        bonusTotal: 3,
        types: ['Fire', 'Cold'],
    };

    let choiceSpy;
    let skipSpy;
    beforeEach(() => {
        choiceSpy = vi.fn();
        skipSpy = vi.fn();
        window.addEventListener('damage-type-choice', choiceSpy);
        window.addEventListener('damage-type-skip', skipSpy);
        render(<DiceRollResult {...choiceProps} />);
    });
    afterEach(() => {
        window.removeEventListener('damage-type-choice', choiceSpy);
        window.removeEventListener('damage-type-skip', skipSpy);
    });

    it.each(['Fire', 'Cold'])('%s button dispatches damage-type-choice with exactly that type', (chosenType) => {
        fireEvent.click(screen.getByRole('button', { name: chosenType }));
        expect(choiceSpy).toHaveBeenCalledTimes(1);
        expect(choiceSpy.mock.calls[0][0].detail).toEqual({ chosenType });
        expect(skipSpy).not.toHaveBeenCalled();
    });

    it('Skip button dispatches damage-type-skip with no payload', () => {
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(skipSpy).toHaveBeenCalledTimes(1);
        expect(skipSpy.mock.calls[0][0].detail).toBeNull();
        expect(choiceSpy).not.toHaveBeenCalled();
    });
});

describe('DiceRollResult — hit/save info and totals', () => {
    it('shows exact hit and save-DC lines together on one damage roll', () => {
        render(
            <DiceRollResult
                name="Fireball"
                type="damage"
                rolls={[6, 5, 4]}
                bonus={0}
                total={15}
                targetName="Goblin"
                hit={true}
                rollType="attack"
                dc={16}
                dcType="DEX"
                dcSuccess="half"
            />
        );
        expect(screen.getByText(/HIT/)).toHaveTextContent('✓ HIT (15 vs AC —)');
        expect(screen.getByText(/Save DC 16 DEX/)).toHaveTextContent('Save DC 16 DEX: half damage on save');
    });

    it('adds the summed reaction bonus to the AC in the hit/miss line', () => {
        render(
            <DiceRollResult
                name="Longsword"
                type="attack"
                rolls={[18]}
                bonus={3}
                targetName="Goblin"
                targetAc={14}
                hit={true}
                rollType="attack"
                defensiveDuelistBonus={1}
                baitAndSwitchBonus={2}
            />
        );
        expect(screen.getByText(/HIT|MISS/)).toHaveTextContent('✓ HIT (21 vs AC 17 + 3 reaction)');
    });

    it.each([
        ['type is save-damage', { type: 'save-damage' }, false],
        ['rollType is save-damage', { type: 'damage', rollType: 'save-damage' }, false],
        ['save-damage has finalDamage > 0', { type: 'save-damage', finalDamage: 5 }, true],
    ])('hides the total when %s', (_label, overrides, visible) => {
        const { container } = render(
            <DiceRollResult name="Fireball" rolls={[6]} bonus={0} finalDamage={0} damageApplied={true} {...overrides} />
        );
        expect(Boolean(container.querySelector('.dice-roll-total'))).toBe(visible);
    });

    it.each(['isCrit', 'isAutoCrit'])('shows the critical-hit notice for %s', (critProp) => {
        render(
            <DiceRollResult
                name="Fireball"
                type="damage"
                rolls={[6, 5, 4]}
                bonus={0}
                total={15}
                {...{ [critProp]: true }}
            />
        );
        expect(screen.getByText('Critical Hit! — damage dice doubled')).toBeInTheDocument();
    });
});
