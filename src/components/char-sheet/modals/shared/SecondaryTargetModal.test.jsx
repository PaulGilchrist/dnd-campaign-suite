// @maintained-by-ai 2026-11-28
// Component-level lane for SecondaryTargetModal (the ONLY spec that renders the real
// component standalone — all CharActionModals/SecondaryTargetModals lanes mock it; host
// prop mapping, chooser toggles, and the distanceBadgeText COPY are owned elsewhere:
// spellOverlayService.test.js pins the four badge strings, so here only the wiring —
// which targets get a badge and when the lookup fires — is pinned).
// Contract pinned here: map-badge wiring + lookup guards (no ids, option-only roster,
// null resolve), radio/row selection machine (confirm inert before selection, forwards
// selected key, Skip closes, default footer has no Cancel tier), option ({value,label})
// targets rendering label and forwarding value, HP/size row metadata + explicit
// `Select <Name>` aria-labels (EH a11y parity; the inverted-pair honesty lane lives in
// SecondaryTargetModal.inverted-hp.test.jsx), the live hideConfirm guard (ref rec #176
// "dead conditional"), and the selectHint why-disabled affordance. Skip/dismiss LABEL
// defaults are pinned through the live consumer in HandOfHealingModal.picker-dismiss
// .test.jsx; only the per-consumer override wiring is pinned here.
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

    it('looks up map statuses once per mount and badges only the targets it resolved', async () => {
        const targets = [
            { name: 'In', type: 'creature' },
            { name: 'Unresolved', type: 'creature' },
        ];
        mockGetTargetMapStatuses.mockResolvedValue({ In: { status: 'in', distFt: 10 } });

        render(<SecondaryTargetModal {...baseProps} targets={targets} {...mapProps} />);

        await waitFor(() => {
            expect(screen.getByText('In range · 10 ft')).toBeInTheDocument();
        });
        expect(mockGetTargetMapStatuses).toHaveBeenCalledTimes(1);
        expect(mockGetTargetMapStatuses).toHaveBeenCalledWith('test-campaign', 'Wizard', ['In', 'Unresolved'], 30);
        // Badge TEXT is the service unit's copy; this lane owns the wiring: every
        // resolved target gets exactly one badge and an unresolved row renders none.
        expect(document.querySelectorAll('.secondary-target-dist')).toHaveLength(1);
        expect(screen.getByText('Unresolved')).toBeInTheDocument();
    });

    it('never queries when the map lane is unavailable and renders badge-free on a null resolve', async () => {
        // Without campaignName/attackerName the lookup must never fire.
        const unmounted = render(<SecondaryTargetModal {...baseProps} />);
        expect(screen.getByText('Goblin A')).toBeInTheDocument();
        expect(mockGetTargetMapStatuses).not.toHaveBeenCalled();
        unmounted.unmount();

        // Ids present but an option-only roster: nothing name-addressable to look up.
        const options = render(
            <SecondaryTargetModal {...baseProps} {...mapProps} targets={[{ label: 'Switch Places', value: 'switch' }]} />
        );
        expect(mockGetTargetMapStatuses).not.toHaveBeenCalled();
        options.unmount();

        // With ids but no active map (service resolves null), targets still render
        // and no badge lane appears (the null result never enters state).
        render(<SecondaryTargetModal {...baseProps} {...mapProps} />);
        await waitFor(() => {
            expect(mockGetTargetMapStatuses).toHaveBeenCalledTimes(1);
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

        // Default footer face with no skipLabel/onDismiss: Skip only, no Cancel tier.
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

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

    // Backlog 2026-11-15 QY (Revivify chooser why-disabled hint): a consumer that
    // passes selectHint gets visible copy beside the disabled confirm while no
    // radio is checked; checking a radio enables the confirm AND retires the
    // hint in the same render. Gate semantics stay byte-unchanged (disabled
    // confirm still no-ops). Consumers that omit selectHint render the unchanged
    // default face — no hint lane anywhere.
    it('shows the selectHint affordance beside the disabled confirm and retires it on selection', () => {
        const onTargetSelected = vi.fn();
        const { unmount } = render(
            <SecondaryTargetModal
                {...baseProps}
                onTargetSelected={onTargetSelected}
                confirmLabel="Cast Revivify"
                selectHint="Select a creature first."
            />
        );

        const confirm = screen.getByRole('button', { name: /Cast Revivify/ });
        expect(confirm).toBeDisabled();
        const hint = screen.getByText('Select a creature first.');
        // The affordance rides the footer lane beside the confirm button.
        expect(hint.closest('.sp-actions')).not.toBeNull();
        expect(hint).toHaveClass('secondary-target-note');

        fireEvent.click(confirm);
        expect(onTargetSelected).not.toHaveBeenCalled();

        const radios = document.querySelectorAll('input[name="secondaryTarget"]');
        fireEvent.click(radios[0]);
        expect(confirm).not.toBeDisabled();
        expect(screen.queryByText('Select a creature first.')).not.toBeInTheDocument();

        unmount();

        // Default face unchanged (no selectHint): nothing selected, no hint lane.
        const plain = render(<SecondaryTargetModal {...baseProps} />);
        expect(screen.getByRole('button', { name: /Attack/ })).toBeDisabled();
        expect(plain.container.querySelector('.secondary-target-select-hint')).toBeNull();
        plain.unmount();

        // Empty roster with a hint configured: nothing can be selected, so the
        // affordance stays out (the confirm is disabled for the no-targets reason).
        const empty = render(
            <SecondaryTargetModal
                {...baseProps}
                targets={[]}
                selectHint="Select a creature first."
            />
        );
        expect(screen.queryByText('Select a creature first.')).not.toBeInTheDocument();
        empty.unmount();
    });

    it('renders option targets by label with a Select <Name> radio and forwards their value on confirm', () => {
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
        // 2026-11-13 EH a11y parity: option rows carry the explicit accessible
        // name too, with no HP segment (options have no HP).
        expect(screen.getByRole('radio', { name: 'Select Switch Places' })).toBeInTheDocument();

        const confirm = screen.getByRole('button', { name: /Confirm/ });
        expect(confirm).toBeDisabled();
        fireEvent.click(document.querySelectorAll('.secondary-target-row')[0]);
        expect(confirm).not.toBeDisabled();
        fireEvent.click(confirm);
        expect(onTargetSelected).toHaveBeenCalledWith('switch');
    });

    // 2026-11-13 EH: rows carry size/HP metadata chips, and every candidate radio
    // gets an explicit `Select <Name>` aria-label (allies-editor precedent) so AT
    // row nav never announces the mashed label concatenation. The inverted-pair
    // honesty lane (current > max renders NO HP data) lives in the inverted-hp sibling.
    it('renders row metadata chips and exact Select <Name> aria-labels per target kind', () => {
        render(
            <SecondaryTargetModal
                {...baseProps}
                targets={[
                    { name: 'Hero', type: 'pc', size: 'Medium', currentHp: 55, maxHp: 132 },
                    { name: 'Goblin', type: 'npc', size: 'Small', currentHp: 7, maxHp: 35 },
                    { name: 'No Hp', type: 'creature' },
                ]}
                showSize
            />
        );

        const heroRow = screen.getByText('Hero').closest('.secondary-target-row');
        expect(heroRow).toHaveTextContent('(Medium)');
        expect(heroRow).toHaveTextContent('55/132 HP (42%)');

        const npcRow = screen.getByText('Goblin').closest('.secondary-target-row');
        expect(npcRow).toHaveTextContent('(Small)');
        expect(npcRow).toHaveTextContent('20%');
        expect(npcRow).not.toHaveTextContent('7/35 HP');

        expect(screen.getByText('No Hp')).toBeInTheDocument();
        expect(document.querySelectorAll('.secondary-target-row')).toHaveLength(3);

        // Exact-string equality proves the explicit aria-label overrides the
        // implicit label, so the mashed concatenation ("Hero55/132 HP (42%)")
        // never reaches the accessible name.
        const radios = Array.from(document.querySelectorAll('input[type="radio"][name="secondaryTarget"]'));
        expect(radios.map(r => r.getAttribute('aria-label'))).toEqual([
            'Select Hero, 55 of 132 HP',
            'Select Goblin, 20% HP',
            'Select No Hp',
        ]);
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

    // improve hoh-picker-skip-semantics (LC 2026-11-14): per-consumer override wiring.
    // The default-face and consumer-semantic lanes (real `Heal self` commit,
    // zero-spend `Cancel` close) are pinned through the live HoH mount in
    // HandOfHealingModal.picker-dismiss.test.jsx; only the label overrides —
    // including the dismissLabel branch no consumer exercises — ride here.
    it('honors skipLabel/dismissLabel overrides with a separate dismiss handler', () => {
        const onSkip = vi.fn();
        const onDismiss = vi.fn();
        render(
            <SecondaryTargetModal
                {...baseProps}
                onSkip={onSkip}
                skipLabel="Heal self"
                dismissLabel="Back"
                onDismiss={onDismiss}
            />
        );
        // Relabelled footer: neither default label survives.
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Heal self' }));
        expect(onSkip).toHaveBeenCalledTimes(1);
        // Distinct no-spend dismiss rides its own handler, never onSkip.
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });
});
