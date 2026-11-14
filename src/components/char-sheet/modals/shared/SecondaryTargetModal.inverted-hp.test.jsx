// @maintained-by-ai
//
// Never-render-current>max honesty guard (backlog 2026-11-14 MM HoH
// mount-snapshot improve). The chooser's row resolves `N` bucket-first
// (currentHitPoints) while `M` may still fall back to a stale combatSummary
// max: the campaign-select re-seed (App.jsx) bakes 1/1 player placeholder
// rows, and a third-party currentHitPoints write from a tab whose mirror
// hydrated before party stats settle creates a thin bucket {currentHitPoints}
// with no hitPoints — live-pinned first paint read `Select EvasiveFighter,
// 60 of 1 HP (6000%)`. Such a pair means the two halves came from different
// truths, so hasHpValues now treats it as NO HP DATA: no visible chip, no
// percent lane, no aria HP segment. Honest pairs — including the shipped
// bucket-max-first 60-of-112 face (7dca2c6d3) and the full-HP boundary —
// render byte-identically to before.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTargetMapStatuses = vi.fn();

vi.mock('../../../../services/maps/spellOverlayService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getTargetMapStatuses: (...args) => mockGetTargetMapStatuses(...args),
    };
});

import SecondaryTargetModal from './SecondaryTargetModal.jsx';

const baseProps = {
    title: 'Choose target for Hand of Healing',
    onTargetSelected: vi.fn(),
    onSkip: vi.fn(),
};

const ariaOf = (name) =>
    screen.getByRole('radio', { name }).getAttribute('aria-label');

describe('SecondaryTargetModal — inverted HP pair renders no HP data', () => {
    beforeEach(() => {
        mockGetTargetMapStatuses.mockReset().mockResolvedValue(null);
    });

    it('bucket-current over placeholder-row-max (60 of 1): chip, percent and aria segment all hidden', () => {
        render(<SecondaryTargetModal
            {...baseProps}
            showHp={true}
            targets={[{ name: 'EvasiveFighter', type: 'player', currentHp: 60, maxHp: 1 }]}
        />);
        const radio = screen.getByRole('radio', { name: 'Select EvasiveFighter' });
        expect(radio.getAttribute('aria-label')).toBe('Select EvasiveFighter');
        expect(radio.getAttribute('aria-label')).not.toMatch(/HP/);
        expect(document.querySelector('.secondary-target-hp')).toBeNull();
        expect(screen.queryByText(/6000%/)).not.toBeInTheDocument();
        expect(screen.getByText('EvasiveFighter')).toBeInTheDocument();
    });

    it('percent lane (showHp=false) also skips an inverted pair', () => {
        render(<SecondaryTargetModal
            {...baseProps}
            showHp={false}
            targets={[{ name: 'WoundedAlly', type: 'player', currentHp: 60, maxHp: 1 }]}
        />);
        expect(ariaOf('Select WoundedAlly')).toBe('Select WoundedAlly');
        expect(document.querySelector('.secondary-target-hp')).toBeNull();
    });

    it('monster lane percent display skips an inverted row pair too', () => {
        render(<SecondaryTargetModal
            {...baseProps}
            showHp={true}
            targets={[{ name: 'Bandit 1', type: 'monster', currentHp: 12, maxHp: 11 }]}
        />);
        expect(ariaOf('Select Bandit 1')).toBe('Select Bandit 1');
        expect(document.querySelector('.secondary-target-hp')).toBeNull();
    });

    it('honest pair renders the shipped bucket-first fraction byte-identically (60 of 112)', () => {
        render(<SecondaryTargetModal
            {...baseProps}
            showHp={true}
            targets={[{ name: 'EvasiveFighter', type: 'player', currentHp: 60, maxHp: 112 }]}
        />);
        expect(screen.getByRole('radio', { name: 'Select EvasiveFighter, 60 of 112 HP' })
            .getAttribute('aria-label')).toBe('Select EvasiveFighter, 60 of 112 HP');
        expect(document.querySelector('.secondary-target-hp').textContent).toContain('60/112 HP');
    });

    it('full-HP boundary (current === max) still renders — the guard only drops current > max', () => {
        render(<SecondaryTargetModal
            {...baseProps}
            showHp={true}
            targets={[{ name: 'EvasiveFighter', type: 'player', currentHp: 112, maxHp: 112 }]}
        />);
        expect(screen.getByRole('radio', { name: 'Select EvasiveFighter, 112 of 112 HP' })
            .getAttribute('aria-label')).toBe('Select EvasiveFighter, 112 of 112 HP');
        expect(document.querySelector('.secondary-target-hp')).not.toBeNull();
    });

    it('rows with no HP data at all (missing keys) keep their plain aria name', () => {
        render(<SecondaryTargetModal
            {...baseProps}
            showHp={true}
            targets={[{ name: 'FreshAlly', type: 'player' }]}
        />);
        expect(ariaOf('Select FreshAlly')).toBe('Select FreshAlly');
        expect(document.querySelector('.secondary-target-hp')).toBeNull();
    });
});
