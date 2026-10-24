// @maintained-by-ai
// Component-level lane for SecondaryTargetModal (the ONLY spec that renders the real
// component — all CharActionModals/SecondaryTargetModals lanes mock it; host prop
// mapping, chooser toggles, and distanceBadgeText copy are owned elsewhere).
// Contract pinned here: map-badge rendering + lookup guard, radio/row selection
// machine (confirm inert before selection, forwards selected key, Skip closes),
// option ({value,label}) targets forwarding their value, HP/size row metadata,
// and the live hideConfirm guard (ref rec #176 "dead conditional"): empty targets
// with hideConfirm falsy still render a disabled confirm, empty targets with
// hideConfirm=true suppress it entirely.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const creatureTargets = [
    { name: 'Goblin A', type: 'creature' },
    { name: 'Goblin B', type: 'creature' },
];

const mapProps = { campaignName: 'test-campaign', attackerName: 'Wizard', rangeFt: 30 };

describe('SecondaryTargetModal', () => {
    beforeEach(() => {
        mockGetTargetMapStatuses.mockReset().mockResolvedValue(null);
    });

    const baseProps = {
        title: 'Pick a Target',
        targets: creatureTargets,
        onTargetSelected: vi.fn(),
        onSkip: vi.fn(),
    };

    it('queries map statuses once per mount and renders the badge for every status', async () => {
        const targets = [
            { name: 'In', type: 'creature' },
            { name: 'Out', type: 'creature' },
            { name: 'Blocked', type: 'creature' },
            { name: 'Missing', type: 'creature' },
        ];
        mockGetTargetMapStatuses.mockResolvedValue({
            'In': { status: 'in', distFt: 10 },
            'Out': { status: 'out', distFt: 90 },
            'Blocked': { status: 'blocked', distFt: 20 },
            'Missing': { status: 'off-map', distFt: null },
        });

        render(<SecondaryTargetModal {...baseProps} targets={targets} {...mapProps} />);

        await waitFor(() => {
            expect(screen.getByText('In range · 10 ft')).toBeInTheDocument();
            expect(screen.getByText('Out of range · 90 ft')).toBeInTheDocument();
            expect(screen.getByText('Blocked · 20 ft')).toBeInTheDocument();
            expect(screen.getByText('Off map')).toBeInTheDocument();
        });
        expect(mockGetTargetMapStatuses).toHaveBeenCalledTimes(1);
        expect(mockGetTargetMapStatuses).toHaveBeenCalledWith('test-campaign', 'Wizard', ['In', 'Out', 'Blocked', 'Missing'], 30);
    });

    it('renders no badges and skips or null-guards the lookup when the map lane is unavailable', async () => {
        // Without campaignName/attackerName the lookup must never fire.
        const unmounted = render(<SecondaryTargetModal {...baseProps} />);
        expect(screen.getByText('Goblin A')).toBeInTheDocument();
        expect(mockGetTargetMapStatuses).not.toHaveBeenCalled();
        unmounted.unmount();

        // With ids but no active map (service resolves null), targets still render.
        render(<SecondaryTargetModal {...baseProps} campaignName="test-campaign" attackerName="Wizard" />);
        await waitFor(() => {
            expect(mockGetTargetMapStatuses).toHaveBeenCalled();
        });
        expect(screen.queryByText(/In range|Out of range|Off map|Blocked/)).not.toBeInTheDocument();
        expect(screen.getByText('Goblin A')).toBeInTheDocument();
    });

    // SP-052: radio selection must persist across repeat clicks — the bug
    // claim was "clicking ElfTest radio twice snaps back to Bandit 1".
    it('keeps confirm inert until a selection, forwards it once, and closes on skip', () => {
        const onTargetSelected = vi.fn();
        const onSkip = vi.fn();
        render(<SecondaryTargetModal {...baseProps} onTargetSelected={onTargetSelected} onSkip={onSkip} />);

        const confirm = screen.getByRole('button', { name: /Attack/ });
        expect(confirm).toBeDisabled();
        fireEvent.click(confirm);
        expect(onTargetSelected).not.toHaveBeenCalled();

        const radios = document.querySelectorAll('input[name="secondaryTarget"]');
        fireEvent.click(radios[1]);
        fireEvent.click(radios[1]);
        let checked = Array.from(document.querySelectorAll('input[name="secondaryTarget"]')).filter(r => r.checked);
        expect(checked).toHaveLength(1);
        expect(checked[0].closest('.secondary-target-row').textContent).toContain('Goblin B');

        // Row label click is a first-class selection affordance too.
        fireEvent.click(document.querySelectorAll('.secondary-target-row')[0]);
        checked = Array.from(document.querySelectorAll('input[name="secondaryTarget"]')).filter(r => r.checked);
        expect(checked).toHaveLength(1);
        expect(checked[0].closest('.secondary-target-row').textContent).toContain('Goblin A');

        expect(confirm).not.toBeDisabled();
        fireEvent.click(confirm);
        expect(onTargetSelected).toHaveBeenCalledTimes(1);
        expect(onTargetSelected).toHaveBeenCalledWith('Goblin A');

        fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
        expect(onSkip).toHaveBeenCalledTimes(1);
        expect(onTargetSelected).toHaveBeenCalledTimes(1);
    });

    it('renders option targets by label and forwards their value on confirm', () => {
        const onTargetSelected = vi.fn();
        render(
            <SecondaryTargetModal
                title="Bait and Switch"
                targets={[{ label: 'Switch Places', value: 'switch' }, { label: 'Stay Put', value: 'stay' }]}
                onTargetSelected={onTargetSelected}
                onSkip={vi.fn()}
                confirmLabel="Confirm"
            />
        );

        expect(screen.getByText('Switch Places')).toBeInTheDocument();
        expect(screen.queryByText('switch')).not.toBeInTheDocument();

        const confirm = screen.getByRole('button', { name: /Confirm/ });
        expect(confirm).toBeDisabled();
        fireEvent.click(document.querySelectorAll('.secondary-target-row')[0]);
        expect(confirm).not.toBeDisabled();
        fireEvent.click(confirm);
        expect(onTargetSelected).toHaveBeenCalledWith('switch');
    });

    it('shows full HP and size for creatures but percent-only HP for NPCs', () => {
        render(
            <SecondaryTargetModal
                {...baseProps}
                targets={[
                    { name: 'Hero', type: 'pc', size: 'Medium', currentHp: 20, maxHp: 50 },
                    { name: 'Goblin', type: 'npc', size: 'Small', currentHp: 7, maxHp: 35 },
                ]}
                showSize
            />
        );

        const heroRow = screen.getByText('Hero').closest('.secondary-target-row');
        expect(heroRow).toHaveTextContent('(Medium)');
        expect(heroRow).toHaveTextContent('20/50 HP (40%)');

        const npcRow = screen.getByText('Goblin').closest('.secondary-target-row');
        expect(npcRow).toHaveTextContent('(Small)');
        expect(npcRow).toHaveTextContent('20%');
        expect(npcRow).not.toHaveTextContent('7/35 HP');
    });

    // ref #176 adjudication: the `!hideConfirm || targets.length > 0` guard's false
    // face (confirm suppressed) is REachable — restoration effect-step producers pass
    // hideConfirm={!hasEffects} with targets derived from the same empty array.
    it('suppresses the confirm button only when hideConfirm is set and targets are empty', () => {
        // False-face row: hideConfirm=true, targets=[] -> no confirm, Skip remains to dismiss.
        const hidden = render(
            <SecondaryTargetModal
                title="Greater Restoration"
                targets={[]}
                hideConfirm
                onTargetSelected={vi.fn()}
                onSkip={vi.fn()}
                confirmLabel="Remove Effect"
            />
        );
        expect(screen.queryByRole('button', { name: /Remove Effect/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Skip/ })).toBeInTheDocument();
        hidden.unmount();

        // Contrast row: hideConfirm falsy, targets=[] -> confirm renders (disabled),
        // so the guard — not just the disabled attr — is what hides the button above.
        render(
            <SecondaryTargetModal
                title="Cure Wounds"
                targets={[]}
                onTargetSelected={vi.fn()}
                onSkip={vi.fn()}
                confirmLabel="Cast Cure Wounds"
            />
        );
        const visibleConfirm = screen.getByRole('button', { name: /Cast Cure Wounds/ });
        expect(visibleConfirm).toBeDisabled();
    });
});
