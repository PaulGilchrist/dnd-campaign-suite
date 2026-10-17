// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

// Display-lane owner of the DiceRollResult family: the hit/miss line,
// auto-miss line, waiting-for-player-save prompt (+ Quick Roll interaction),
// save-result line, and damage-applied line. Boon / choice / reroll lanes
// are owned by the sibling DiceRollResult.*.test.jsx files.

const renderAttack = (props = {}) => render(
    <DiceRollResult
        name="Longsword"
        type="attack"
        rolls={[18]}
        bonus={5}
        targetName="Goblin"
        targetAc={14}
        rollType="attack"
        {...props}
    />
);

const renderFireball = (props = {}) => render(
    <DiceRollResult
        name="Fireball"
        type="damage"
        rolls={[6]}
        bonus={0}
        {...props}
    />
);

const queryOutcomeLine = () => screen.queryByText(/✓ HIT|✗ MISS|AUTO-MISS/);

describe('hit/miss line', () => {
    it.each([
        { rolls: [18], bonus: 5, hit: true, line: '✓ HIT (23 vs AC 14)' },
        { rolls: [8], bonus: 3, hit: false, line: '✗ MISS (11 vs AC 14)' },
    ])('renders the full outcome line "$line" for rolls $rolls + $bonus', ({ rolls, bonus, hit, line }) => {
        renderAttack({ rolls, bonus, hit });
        expect(screen.getByText(line)).toBeInTheDocument();
    });

    it('recomputes the outcome from total vs AC when the hit prop disagrees', () => {
        renderAttack({ hit: false });
        expect(screen.getByText('✓ HIT (23 vs AC 14)')).toBeInTheDocument();
    });

    it.each([
        { type: 'damage', rollType: undefined },
        { type: 'save-damage', rollType: 'attack' },
    ])('shows no hit/miss line for type $type / rollType $rollType even when hit is true', ({ type, rollType }) => {
        renderFireball({ type, rollType, targetName: 'Goblin', hit: true });
        expect(queryOutcomeLine()).not.toBeInTheDocument();
    });

    it.each([
        { extraProps: { coverReason: 'Half cover' }, line: '✗ AUTO-MISS (Half cover)' },
        { extraProps: { rangeReason: 'Beyond long range' }, line: '✗ AUTO-MISS (Beyond long range)' },
        { extraProps: {}, line: '✗ AUTO-MISS (out of range)' },
    ])('renders $line when isAutoMiss overrides the rolled result', ({ extraProps, line }) => {
        renderAttack({ hit: true, isAutoMiss: true, ...extraProps });
        expect(screen.getByText(line)).toBeInTheDocument();
    });
});

describe('waiting for player save', () => {
    const waitingProps = { waitingForPlayerSave: true, targetName: 'Goblin', saveDc: 14, saveType: 'DEX' };

    it('names the target, save type and DC while waiting', () => {
        renderFireball(waitingProps);
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText(/to roll DEX save \(DC 14\)/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Quick Roll/ })).not.toBeInTheDocument();
    });

    it('offers a Quick Roll button that calls onQuickRoll with no arguments', () => {
        const onQuickRoll = vi.fn();
        renderFireball({ ...waitingProps, onQuickRoll });
        fireEvent.click(screen.getByRole('button', { name: /Quick Roll/ }));
        expect(onQuickRoll).toHaveBeenCalledTimes(1);
        expect(onQuickRoll).toHaveBeenCalledWith();
    });

    it('shows no waiting prompt when waitingForPlayerSave is false', () => {
        renderFireball({ ...waitingProps, waitingForPlayerSave: false });
        expect(screen.queryByText(/Waiting for/)).not.toBeInTheDocument();
    });
});

describe('save result line', () => {
    it.each([
        { label: 'success', saveResult: { success: true, total: 18, roll: 14, bonus: 4 }, line: '✓ SAVE SUCCESS (18 vs DC 15)', detail: '(d20 14 + 4)' },
        { label: 'failure', saveResult: { success: false, total: 12, roll: 8, bonus: 4 }, line: '✗ SAVE FAILURE (12 vs DC 15)', detail: '(d20 8 + 4)' },
        { label: 'zero bonus', saveResult: { success: true, total: 14, roll: 14, bonus: 0 }, line: '✓ SAVE SUCCESS (14 vs DC 15)', detail: '(d20 14 + 0)' },
    ])('renders the $label line with exact roll detail', ({ saveResult, line, detail }) => {
        renderFireball({ saveResult, saveDc: 15 });
        expect(screen.getByText(line)).toBeInTheDocument();
        expect(screen.getByText(detail)).toBeInTheDocument();
    });

    it.each([null, undefined])('shows no save result line for saveResult %s', (saveResult) => {
        renderFireball({ saveResult, saveDc: 15 });
        expect(screen.queryByText(/SAVE (SUCCESS|FAILURE)/)).not.toBeInTheDocument();
    });
});

describe('damage applied line', () => {
    it.each([
        {
            label: 'flat damage',
            props: { finalDamage: 15, damageApplied: true, targetName: 'Goblin' },
            sentence: '15 damage applied to Goblin',
        },
        {
            label: 'reduced damage with HP change',
            props: { total: 15, finalDamage: 8, damageApplied: true, damageReduced: true, targetName: 'Orc', targetCurrentHp: 5 },
            sentence: '8 damage applied to Orc (reduced from 15) — HP: 13 → 5',
        },
    ])('renders $label verbatim', ({ props, sentence }) => {
        renderFireball(props);
        expect(screen.getByText(/damage applied to/, { selector: 'span' })).toHaveTextContent(sentence);
    });

    it.each([
        { label: 'finalDamage is undefined', props: { damageApplied: true, targetName: 'Goblin' } },
        { label: 'damageApplied is false', props: { finalDamage: 15, damageApplied: false, targetName: 'Goblin' } },
    ])('shows no damage-applied line when $label', ({ props }) => {
        renderFireball(props);
        expect(screen.queryByText(/damage applied/)).not.toBeInTheDocument();
    });
});
