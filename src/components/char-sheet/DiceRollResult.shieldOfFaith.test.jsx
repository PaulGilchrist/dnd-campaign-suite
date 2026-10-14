// SP-105: popup must show the effective AC (+2 Shield of Faith) and its
// recomputed computedHit must agree with the authoritative hit on boundary
// rolls — a resolved MISS never renders Done, so Done cannot apply damage.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

function renderSoFPopup(props = {}) {
    return render(
        <DiceRollResult
            name="Slam"
            type="d20"
            rollType="attack"
            rolls={[9]}
            bonus={3}
            targetName="Divine_Cleric"
            targetAc={12}
            autoDamage={{ name: 'Slam', formula: '1d8+1', damageType: 'Bludgeoning', targetName: 'Divine_Cleric', attackerName: 'Zombie 1', sneakAttackDice: 0, d20Roll: 9 }}
            onDone={vi.fn()}
            {...props}
        />
    );
}

function findDone(container) {
    return [...container.querySelectorAll('.dice-roll-reroll-btn')].find(b => b.textContent.includes('Done'));
}

describe('DiceRollResult — Shield of Faith popup (SP-105)', () => {
    it('boundary total 12 vs effective AC 14 shows MISS with the +2 Shield of Faith line', () => {
        const { container } = renderSoFPopup({
            shieldOfFaithAcBonus: 2,
            hit: false,
        });
        const miss = container.querySelector('.dice-roll-hit-miss.miss');
        expect(miss).not.toBeNull();
        expect(miss.textContent).toContain('✗ MISS (12 vs AC 14 (+2 Shield of Faith))');
    });

    it('resolved MISS popup renders no Done button (miss cannot apply damage)', () => {
        const onDone = vi.fn();
        const { container } = renderSoFPopup({
            shieldOfFaithAcBonus: 2,
            hit: false,
            onDone,
        });
        expect(findDone(container)).toBeFalsy();
        expect(screen.queryByText(/✓ HIT/)).not.toBeInTheDocument();
    });

    it('honors the forwarded authoritative effectiveAc even without per-bonus fields', () => {
        const { container } = renderSoFPopup({
            effectiveAc: 14,
            hit: false,
        });
        const miss = container.querySelector('.dice-roll-hit-miss.miss');
        expect(miss).not.toBeNull();
        expect(miss.textContent).toContain('vs AC 14');
    });

    it('boundary total 14 vs effective AC 14 shows HIT with Done that applies damage', () => {
        const onDone = vi.fn();
        const { container } = renderSoFPopup({
            rolls: [11],
            shieldOfFaithAcBonus: 2,
            effectiveAc: 14,
            hit: true,
            onDone,
        });
        const hit = container.querySelector('.dice-roll-hit-miss.hit');
        expect(hit).not.toBeNull();
        expect(hit.textContent).toContain('✓ HIT (14 vs AC 14 (+2 Shield of Faith))');
        const done = findDone(container);
        expect(done).toBeTruthy();
        fireEvent.click(done);
        expect(onDone).toHaveBeenCalledWith(true);
    });

    it('displays the Shield spell +5 source line too', () => {
        const { container } = renderSoFPopup({
            shieldAcBonus: 5,
            effectiveAc: 17,
            hit: false,
        });
        expect(container.querySelector('.dice-roll-hit-miss').textContent).toContain('vs AC 17 (+5 Shield)');
    });

    it('control: no buffs → base AC display unchanged, boundary total 12 hits', () => {
        const { container } = renderSoFPopup({ hit: true });
        const hit = container.querySelector('.dice-roll-hit-miss.hit');
        expect(hit.textContent).toContain('✓ HIT (12 vs AC 12)');
        expect(hit.textContent).not.toContain('Shield of Faith');
    });

    it('cover fallback unregressed: effectiveAc recomputed to 14, cover line intact', () => {
        const { container } = renderSoFPopup({
            coverAcBonus: 2,
            coverLevel: 'half',
            hit: false,
        });
        const miss = container.querySelector('.dice-roll-hit-miss.miss');
        expect(miss.textContent).toContain('✗ MISS (12 vs AC 14)');
        expect(container.querySelector('.dice-roll-cover').textContent).toContain('1/2 Cover (+2 AC)');
    });

    it('homing converted hit vs buffed AC unregressed (CLA-320)', () => {
        const { container } = renderSoFPopup({
            rolls: [8],
            bonus: 8,
            targetAc: 18,
            shieldOfFaithAcBonus: 2,
            effectiveAc: 18,
            hit: true,
            homingStrikesUsed: true,
            homingStrikesBonus: 5,
        });
        const hit = container.querySelector('.dice-roll-hit-miss.hit');
        expect(hit.textContent).toContain('✓ HIT (21 vs AC 18 (+2 Shield of Faith))');
        expect(container.textContent).toContain('Soul Blades (Homing Strikes): psionic die +5');
    });
});
