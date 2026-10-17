// SP-105: popup must show the effective AC (+2 Shield of Faith) and its
// recomputed computedHit must agree with the authoritative hit on boundary
// rolls — a resolved MISS never renders Done, so Done cannot apply damage.
//
// Seam ownership: THIS file owns only the AC-buff recomputation seam of the
// DiceRollResult family — Shield of Faith / Shield label rendering on the
// "vs AC" line, the forwarded authoritative effectiveAc, cover fallback, and
// Done gating on the recomputed boundary — plus the SoF × Homing Strikes
// cross-seam (base homing lives in homing.test.jsx). Deferred to siblings:
//   - base hit/miss, auto-miss, save-result, damage-applied lines → combatDisplay.test.jsx
//   - breakdown/info lines and unbuffed notice gates → infoDisplay.test.jsx
//   - click-dispatch payload contracts (onDone events, offers) → interactive.test.jsx
//   - base Homing Strikes seam at unbuffed AC → homing.test.jsx
// No dice randomness is exercised here (Done applies autoDamage upstream via
// the host), so no Math.random spy is stubbed — nothing to restore in afterEach.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiceRollResult from './DiceRollResult.jsx';

// Exact full-line constants (homing lane recommendation).
const SOF_MISS_LINE = '✗ MISS (12 vs AC 14 (+2 Shield of Faith))';
const SOF_HIT_LINE = '✓ HIT (14 vs AC 14 (+2 Shield of Faith))';
const MISS_AC14_LINE = '✗ MISS (12 vs AC 14)';
const SHIELD_MISS_LINE = '✗ MISS (12 vs AC 17 (+5 Shield))';
const BASE_HIT_LINE = '✓ HIT (12 vs AC 12)';
const HOMING_SOF_LINE = 'Soul Blades (Homing Strikes): psionic die +5 → 21 vs AC 18 (+2 Shield of Faith) — miss converted into a hit, 1 Psionic Energy expended';

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
            {...props}
        />
    );
}

function findDone(container) {
    return [...container.querySelectorAll('.dice-roll-reroll-btn')].find(b => b.textContent.includes('Done'));
}

describe('DiceRollResult — Shield of Faith popup (SP-105)', () => {
    // Consolidated AC-boundary table: exact outcome line + Done gating per buff config.
    const AC_BOUNDARY_CASES = [
        {
            name: 'boundary total 12 vs recomputed effective AC 14 shows MISS, no Done (miss cannot apply damage)',
            props: { shieldOfFaithAcBonus: 2, hit: false },
            line: SOF_MISS_LINE,
            done: false,
        },
        {
            name: 'honors the forwarded authoritative effectiveAc even without per-bonus fields',
            props: { effectiveAc: 14, hit: false },
            line: MISS_AC14_LINE,
            done: false,
        },
        {
            name: 'labels the Shield spell +5 source line too',
            props: { shieldAcBonus: 5, effectiveAc: 17, hit: false },
            line: SHIELD_MISS_LINE,
            done: false,
        },
        {
            name: 'boundary total 14 vs effective AC 14 shows HIT with Done that applies damage',
            props: { rolls: [11], shieldOfFaithAcBonus: 2, effectiveAc: 14, hit: true },
            line: SOF_HIT_LINE,
            done: true,
        },
        {
            name: 'control: no buffs → base AC display unchanged, boundary total 12 hits',
            props: { hit: true },
            line: BASE_HIT_LINE,
            done: true,
            buffFree: true,
        },
    ];

    it.each(AC_BOUNDARY_CASES)('$name', ({ props, line, done, buffFree }) => {
        const onDone = vi.fn();
        const { container } = renderSoFPopup({ ...props, onDone });
        const outcome = container.querySelector('.dice-roll-hit-miss');
        expect(outcome.textContent.trim()).toBe(line);
        if (buffFree) expect(container.textContent).not.toContain('Shield of Faith');
        const doneBtn = findDone(container);
        if (done) {
            expect(doneBtn).toBeTruthy();
            fireEvent.click(doneBtn);
            expect(onDone).toHaveBeenCalledWith(true);
        } else {
            expect(doneBtn).toBeFalsy();
            expect(onDone).not.toHaveBeenCalled();
        }
    });

    it('cover fallback unregressed: effectiveAc recomputed to 14, cover line intact', () => {
        const { container } = renderSoFPopup({
            coverAcBonus: 2,
            coverLevel: 'half',
            hit: false,
        });
        expect(container.querySelector('.dice-roll-hit-miss.miss').textContent.trim()).toBe(MISS_AC14_LINE);
        expect(container.querySelector('.dice-roll-cover').textContent.trim()).toBe('1/2 Cover (+2 AC)');
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
        expect(container.querySelector('.dice-roll-hit-miss.hit').textContent.trim()).toBe('✓ HIT (21 vs AC 18 (+2 Shield of Faith))');
        expect(container.querySelector('.dice-roll-reroll-result').textContent.trim()).toBe(HOMING_SOF_LINE);
    });
});
