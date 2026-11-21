// @maintained-by-ai
// HHH 2026-11-21 improve damage-chip-disclosure: the Actions-table DAMAGE-column
// chip is the ungated direct roller (useSimpleDamageRoll) — it rolls freely even
// while the paired HIT chip's shot is refused by the armed-target/LoS gates.
// Owner decision: DISCLOSURE, not gating. This lane owns the disclosure seam:
//   - the direct-roll face (payload carrying note === DIRECT_DAMAGE_ROLL_NOTE)
//     shows the disclosure line, riding the existing .dice-roll-save-info notice;
//   - the gated staged HIT/MISS attack face (handleAttackClick payload) and every
//     other damage popup (different or absent note) never show it.
// The producer-side payload pins (log row + setPopupHtml shape incl. the note)
// live in CharActions.simpleDamageRoll.test.jsx.
import { render, screen } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';
import { DIRECT_DAMAGE_ROLL_NOTE } from '../../hooks/combat/useSimpleDamageRoll.js';

const DISCLOSURE = 'Direct damage roll — ignores your armed target and enforcement gates.';

// Byte-shape of the popup payload useSimpleDamageRoll sets on a damage-chip press.
const directDamagePopup = () => ({
    type: 'damage',
    name: 'Longbow',
    formula: '1d8+2',
    rolls: [6, 2],
    total: 8,
    modifier: 2,
    damageType: 'Piercing',
    note: DIRECT_DAMAGE_ROLL_NOTE,
});

describe('DiceRollResult direct damage-roll disclosure', () => {
    it('direct damage-roll face shows the disclosure line and its note', () => {
        const { container } = render(<DiceRollResult {...directDamagePopup()} />);
        expect(screen.getByText(DISCLOSURE)).toBeInTheDocument();
        expect(container.querySelector('.dice-roll-save-info')).toBeInTheDocument();
    });

    it('note constant is the producer signature from useSimpleDamageRoll', () => {
        // The gate is this exact string — if the producer's note ever drifts,
        // the disclosure silently dies; pin the value.
        expect(DIRECT_DAMAGE_ROLL_NOTE).toBe('Direct damage roll (no target)');
    });

    it.each([
        {
            label: 'gated staged-HIT attack face (handleAttackClick payload)',
            props: {
                name: 'Longbow', type: 'attack', rollType: 'attack',
                rolls: [15], bonus: 8, targetName: 'Goblin', targetAc: 15,
                hit: true, autoDamage: { name: 'Longbow', formula: '1d8+2' },
            },
        },
        {
            label: 'committed damage face with target (damageApplied, no note)',
            props: {
                name: 'Longbow', type: 'damage', rolls: [6, 2], total: 8,
                targetName: 'Goblin', finalDamage: 8, damageApplied: true,
            },
        },
        {
            label: 'damage popup carrying a different producer note',
            props: {
                name: 'Fire Bolt', type: 'damage', rolls: [4], total: 4,
                note: 'combined_damage_roll',
            },
        },
        {
            label: 'plain damage popup with no note',
            props: { name: 'Fireball', type: 'damage', rolls: [6, 4], total: 10 },
        },
    ])('$label never shows the disclosure', ({ props }) => {
        const { container } = render(<DiceRollResult {...props} />);
        expect(screen.queryByText(DISCLOSURE)).not.toBeInTheDocument();
        expect(container.querySelector('.dice-roll-save-info')).not.toBeInTheDocument();
    });

    it('the disclosure never corrupts the fused roll-face textContent tokens', () => {
        // 2026-11-18 readability law: the raw total digit must not abut the
        // disclosure sentence into a bogus token inside the popup root text.
        const { container } = render(<DiceRollResult {...directDamagePopup()} />);
        const text = container.querySelector('.dice-roll-result').textContent;
        expect(text).toContain('8 1d8+2');
        expect(text).toContain(DISCLOSURE);
    });
});
