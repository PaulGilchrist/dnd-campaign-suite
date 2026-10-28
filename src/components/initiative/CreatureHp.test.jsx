// @maintained-by-ai
// CreatureHp leaf contract — HP display bytes + input commit semantics (props-in/callback-out).
// Owned here (input lane):
//   status badge thresholds DEAD/BLOODIED/OK vs effective max (jsx:66-67, 89)
//   lane census: NPC remote badge / summoned numeric / localhost editable / player static (jsx:69-129)
//   current HP commit (NPC lane): onChange(name, clamped 0..effectiveMax) — bug-initiative-hp-input-no-range-clamp
//     (high clamps to effective max, negative clamps to 0, input echoes the stored number) (jsx:24-38)
//   current HP commit (player lane): pass-through — temp-HP overshoot above max is legitimate (jsx:29-36)
//   Enter key blurs → commits once (jsx:25-27)
//   max HP commit: onChange(name, clamped current, base max = value - aid - feast); prop is
//     never mutated — #854 removed direct creature.maxHp/currentHp writes (frozen-pin below) (jsx:40-49)
//   defaults: currentHp ?? 0, maxHp ?? 1 reflected in bytes (jsx:61-62)
//   runtime aid/heroesFeast sum into effective max display + bloodied threshold (jsx:63-67)
// NOT owned here (do not duplicate):
//   card-level HP blur seam → CreatureCard.interactions.test.jsx (#851)
//   TempHpDisplay gate + byte → CreatureCard.rendering.test.jsx (:138-148) (#853)
//   HpBar fill % / color math → HpBar.test.jsx
//   store writes per lane → createCreatureHandlers.test.jsx
// Old → new map:
//   npc badge it.each → kept (test 1); summoned → kept (test 2)
//   npc commit it.each + negative passthrough + player commit it.each → consolidated (test 5);
//     player commit rows dropped — same shared CurrentHpInput component as NPC lane
//   max blur below current → strengthened to clamp/passthrough table + onChange payload + frozen-prop pin (test 7)
//   player span / player static display → consolidated lane census (test 4)
//   missing HP fallback x3 → consolidated (test 9)
//   aid block: player-localhost span cut (same expression as remote byte, test 10);
//     NPC 'OK'-only assert cut (vacuous — badge shows no number); base-max test cut
//     (duplicate of lane census test 4); kept sum (test 10), summoned (test 11), threshold (test 12);
//     added max-input aid subtraction (test 8) — previously untested commit branch
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureHp from './CreatureHp.jsx';

vi.mock('./HpBar.jsx', () => ({
    default: () => <div data-testid="hp-bar" />,
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => null),
}));

import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

describe('CreatureHp', () => {
    let props;

    const player = { name: 'Alice', type: 'player', currentHp: 15, maxHp: 20 };
    const npc = { name: 'Goblin', type: 'npc', currentHp: 7, maxHp: 7 };

    const currentInput = (name) => screen.getByRole('spinbutton', { name: `${name} current HP` });
    const maxInput = (name) => screen.getByRole('spinbutton', { name: `${name} max HP` });

    beforeEach(() => {
        props = {
            creature: npc,
            isLocalhost: true,
            onChange: vi.fn(),
        };
        useRuntimeValue.mockReturnValue(null);
    });

    it.each`
        currentHp | maxHp | expectedStatus
        ${0}      | ${7}  | ${'DEAD'}
        ${3}      | ${7}  | ${'BLOODIED'}
        ${11}     | ${20} | ${'OK'}
    `('NPC non-localhost shows $expectedStatus badge at $currentHp/$maxHp', ({ currentHp, maxHp, expectedStatus }) => {
        render(<CreatureHp {...props} creature={{ ...npc, currentHp, maxHp }} isLocalhost={false} />);
        expect(screen.getByText(expectedStatus)).toBeInTheDocument();
    });

    it('summoned NPC on non-localhost shows numeric HP without status badge', () => {
        render(<CreatureHp {...props} creature={{ ...npc, currentHp: 3 }} isLocalhost={false} isPlayerSummoned />);
        expect(screen.getByText('3/7')).toBeInTheDocument();
        expect(screen.queryByText('BLOODIED')).not.toBeInTheDocument();
    });

    it('NPC localhost shows editable current and max inputs with exact bytes', () => {
        render(<CreatureHp {...props} creature={{ ...npc, currentHp: 5, maxHp: 12 }} />);
        expect(screen.getByText('HP')).toBeInTheDocument();
        expect(currentInput('Goblin').value).toBe('5');
        expect(maxInput('Goblin').value).toBe('12');
    });

    it('player localhost edits current only; non-localhost is fully static', () => {
        const { unmount } = render(<CreatureHp {...props} creature={player} />);
        expect(currentInput('Alice').value).toBe('15');
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.queryByRole('spinbutton', { name: 'Alice max HP' })).not.toBeInTheDocument();
        unmount();

        render(<CreatureHp {...props} creature={player} isLocalhost={false} />);
        expect(screen.getByText('15/20')).toBeInTheDocument();
        expect(document.querySelector('.hp-inline-input')).not.toBeInTheDocument();
    });

    it.each`
        inputValue | expectedHp | echoValue | label
        ${'5'}     | ${5}       | ${'5'}    | ${'in-range value passes through'}
        ${'abc'}   | ${0}       | ${'0'}    | ${'non-numeric commits 0'}
        ${'-5'}    | ${0}       | ${'0'}    | ${'negative clamps to 0'}
        ${'99'}    | ${7}       | ${'7'}    | ${'overshoot clamps to max'}
    `('NPC current HP blur of "$inputValue" — $label — commits onChange(name, $expectedHp) and echoes $echoValue', ({ inputValue, expectedHp, echoValue }) => {
        render(<CreatureHp {...props} />);
        const input = currentInput('Goblin');
        input.value = inputValue;
        fireEvent.blur(input);
        expect(props.onChange).toHaveBeenCalledWith('Goblin', expectedHp);
        expect(input.value).toBe(echoValue);
    });

    it('player current HP blur passes overshoot/negative through unclamped (temp-HP lane)', () => {
        render(<CreatureHp {...props} creature={player} />);
        const input = currentInput('Alice');
        input.value = '99';
        fireEvent.blur(input);
        expect(props.onChange).toHaveBeenCalledWith('Alice', 99);
        expect(input.value).toBe('99');
        input.value = '-5';
        fireEvent.blur(input);
        expect(props.onChange).toHaveBeenCalledWith('Alice', -5);
    });

    it('NPC clamp ceiling is the effective max (base + aid increase)', () => {
        useRuntimeValue.mockImplementation((_, prop) => (prop === 'aidHpMaxIncrease' ? 5 : null));
        render(<CreatureHp {...props} creature={{ ...npc, currentHp: 1, maxHp: 7 }} />);
        const input = currentInput('Goblin');
        input.value = '99';
        fireEvent.blur(input);
        expect(props.onChange).toHaveBeenCalledWith('Goblin', 12);
    });

    it('Enter in current HP input commits once; other keys do not', () => {
        render(<CreatureHp {...props} />);
        const input = currentInput('Goblin');
        input.value = '4';
        input.focus();
        fireEvent.keyDown(input, { key: 'a' });
        expect(props.onChange).not.toHaveBeenCalled();
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(props.onChange).toHaveBeenCalledTimes(1);
        expect(props.onChange).toHaveBeenCalledWith('Goblin', 4);
    });

    it.each`
        currentHp | expectedOnChange | label
        ${8}      | ${5}             | ${'clamps current down to new max'}
        ${3}      | ${3}             | ${'passes current through when still under new max'}
    `('max HP blur commits $label via onChange(name, currentHp, baseMax) — never mutates the prop', ({ currentHp, expectedOnChange }) => {
        const creature = { ...npc, currentHp, maxHp: 10 };
        render(<CreatureHp {...props} creature={creature} />);
        const input = maxInput('Goblin');
        input.value = '5';
        fireEvent.blur(input);
        expect(props.onChange).toHaveBeenCalledWith('Goblin', expectedOnChange, 5);
        expect(creature.maxHp).toBe(10);
        expect(creature.currentHp).toBe(currentHp);
    });

    it('#854 mutation-proof: max HP blur on a frozen creature prop does not throw and reports full payload', () => {
        const frozen = Object.freeze({ ...npc, currentHp: 8, maxHp: 10 });
        render(<CreatureHp {...props} creature={frozen} />);
        const input = maxInput('Goblin');
        input.value = '5';
        expect(() => fireEvent.blur(input)).not.toThrow();
        expect(props.onChange).toHaveBeenCalledTimes(1);
        expect(props.onChange).toHaveBeenCalledWith('Goblin', 5, 5);
        expect(frozen.currentHp).toBe(8);
        expect(frozen.maxHp).toBe(10);
    });

    it('max HP commit subtracts runtime aid increases from base max', () => {
        useRuntimeValue.mockImplementation((_, prop) => (prop === 'aidHpMaxIncrease' ? 5 : null));
        const creature = { ...npc, currentHp: 7, maxHp: 7 };
        render(<CreatureHp {...props} creature={creature} />);
        const input = maxInput('Goblin');
        expect(input.value).toBe('12');
        input.value = '10';
        fireEvent.blur(input);
        expect(props.onChange).toHaveBeenCalledWith('Goblin', 7, 5);
        expect(creature.maxHp).toBe(7);
    });

    it('undefined HP defaults to 0 current / 1 max across lanes', () => {
        const broken = { ...npc, currentHp: undefined, maxHp: undefined };
        const { unmount } = render(<CreatureHp {...props} creature={broken} />);
        expect(currentInput('Goblin').value).toBe('0');
        expect(maxInput('Goblin').value).toBe('1');
        unmount();

        render(<CreatureHp {...props} creature={broken} isLocalhost={false} />);
        expect(screen.getByText('DEAD')).toBeInTheDocument();
    });

    it('sums aid and heroesFeast runtime increases into effective max', () => {
        useRuntimeValue.mockImplementation((_, prop) => {
            if (prop === 'aidHpMaxIncrease') return 5;
            if (prop === 'heroesFeastHpMaxIncrease') return 3;
            return null;
        });
        render(<CreatureHp {...props} creature={player} isLocalhost={false} />);
        expect(screen.getByText('15/28')).toBeInTheDocument();
    });

    it('summoned NPC shows effective max with aid increase', () => {
        useRuntimeValue.mockImplementation((_, prop) => (prop === 'aidHpMaxIncrease' ? 5 : null));
        render(<CreatureHp {...props} creature={npc} isLocalhost={false} isPlayerSummoned />);
        expect(screen.getByText('7/12')).toBeInTheDocument();
    });

    it('bloodied threshold uses effective max', () => {
        useRuntimeValue.mockImplementation((_, prop) => (prop === 'aidHpMaxIncrease' ? 10 : null));
        render(<CreatureHp {...props} creature={{ ...npc, currentHp: 8, maxHp: 7 }} isLocalhost={false} />);
        expect(screen.getByText('BLOODIED')).toBeInTheDocument();
    });
});
