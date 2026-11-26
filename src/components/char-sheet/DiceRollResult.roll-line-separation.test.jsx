// @maintained-by-ai 2026-11-18
// 2026-11-18 QA readability law (roll-face fused token): the total digit and the
// breakdown's `d20 …` token must never read as one dice-notation fusion
// (`Glaive17d20 8 +9`). Every face this builder feeds (sheet CharActions lane,
// AttackResultPopup host, monster-chip MonsterCardModal) is covered here at the
// single owner: the d20-test line ends with the equation `→ total`, a real
// space text node separates the total div from the breakdown div in
// concatenated textContent, and faces whose shown dice + shown modifier do NOT
// sum to the shown total (d20 floors, Homing Strikes) keep their own
// resolution line and never get a false equation appended. HIT/MISS verdict
// copy is pinned unchanged — this change must not touch it.
import { render, screen } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

const renderAttack = (props = {}) => render(
    <DiceRollResult
        name="Glaive"
        type="d20"
        rollType="attack"
        rolls={[8]}
        bonus={9}
        bonusDetail="(+9 to hit)"
        {...props}
    />
);

const breakdownText = (container) => container.querySelector('.dice-roll-breakdown').textContent;

describe('roll-line separation — total and d20 never fuse', () => {
    it('staged HIT face: equation `d20 8 +9 (+9 to hit) → 17`, no `17d20` token anywhere in the face text', () => {
        const { container } = renderAttack({ targetName: 'Goblin 1', targetAc: 15, hit: true });
        expect(breakdownText(container)).toBe('d20 8 +9 (+9 to hit) → 17');
        expect(container.querySelector('.dice-roll-total').textContent).toBe('17');
        // Verdict copy untouched.
        expect(screen.getByText('✓ HIT (17 vs AC 15)')).toBeInTheDocument();
        // The fused reading (total digit abutting `d20`) must be gone from the
        // concatenated face text, not just visually stacked.
        expect(container.textContent).not.toMatch(/\dd20/);
        expect(container.textContent).toContain('17 d20 8 +9 (+9 to hit) → 17');
    });

    it('MISS pre-face: same separation convention (`d20 5 +9 → 14`)', () => {
        const { container } = renderAttack({ rolls: [5], targetName: 'Goblin 1', targetAc: 19, hit: false });
        expect(breakdownText(container)).toBe('d20 5 +9 (+9 to hit) → 14');
        expect(screen.getByText('✗ MISS (14 vs AC 19)')).toBeInTheDocument();
        expect(container.textContent).not.toMatch(/\dd20/);
    });

    it('zero-modifier d20 test still self-contains the total (`d20 10 → 10`)', () => {
        const { container } = renderAttack({ bonus: 0, bonusDetail: undefined });
        expect(breakdownText(container)).toBe('d20 8 → 8');
        expect(container.textContent).not.toMatch(/\dd20/);
    });

    it('damage face keeps its formula copy byte-identical; space nodes still separate total from formula and formula tail from the damage-applied row', () => {
        const { container } = renderAttack({
            name: 'Fireball', type: 'damage', rolls: [6, 5, 4], formula: '8d6', total: 15, bonus: 0, bonusDetail: undefined,
            damageApplied: true, finalDamage: 15, targetName: 'Goblin 1',
        });
        expect(breakdownText(container)).toBe('8d6: 6, 5, 4');
        expect(container.querySelector('.dice-roll-total').textContent).toBe('15');
        expect(container.textContent).not.toMatch(/\d{3,}/); // no `158d6` / `415 damage`-style digit fusion
        expect(container.textContent).toContain('15 8d6: 6, 5, 4 15 damage applied');
    });

    it('d20-floor face: shown dice do not sum to the floored total — no false equation, resolution line stands', () => {
        const { container } = renderAttack({ rolls: [4], bonus: 5, rollType: 'save', bonusDetail: undefined, starryDragonFloor: true, name: 'Constitution' });
        expect(breakdownText(container)).toBe('d20 4 +5');
        expect(screen.getByText('Starry Form (Dragon): d20 4 → 10')).toBeInTheDocument();
        expect(container.querySelector('.dice-roll-total').textContent).toBe('15');
    });

    it('Homing Strikes face: psionic fold changes the total — equation suppressed, notice row carries it', () => {
        const { container } = renderAttack({ bonus: 8, bonusDetail: undefined, homingStrikesBonus: 5, targetName: 'Goblin 1', targetAc: 18, hit: true });
        expect(breakdownText(container)).toBe('d20 8 +8');
        expect(container.querySelector('.dice-roll-total').textContent).toBe('21');
    });
});
