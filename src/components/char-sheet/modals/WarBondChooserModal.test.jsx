import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WarBondChooserModal from './WarBondChooserModal.jsx';

describe('WarBondChooserModal (CLA-379)', () => {
    it('renders all offered weapons', () => {
        render(
            <WarBondChooserModal
                title="War Bond — Summon Bonded Weapon"
                icon="fa-link"
                options={['Scimitar', 'Longsword']}
                maxChoices={1}
                confirmLabel="Summon"
                onConfirm={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText('Scimitar')).toBeTruthy();
        expect(screen.getByText('Longsword')).toBeTruthy();
    });

    it('single-choice mode keeps exactly one selection', () => {
        render(
            <WarBondChooserModal
                title="War Bond — Summon Bonded Weapon"
                options={['Scimitar', 'Longsword']}
                maxChoices={1}
                confirmLabel="Summon"
                onConfirm={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByLabelText('Longsword'));
        fireEvent.click(screen.getByLabelText('Scimitar'));
        const checked = screen.getAllByRole('checkbox').filter(cb => cb.checked);
        expect(checked).toHaveLength(1);
        expect(checked[0].checked).toBe(true);
    });

    it('bond mode caps selection at maxChoices', () => {
        render(
            <WarBondChooserModal
                title="War Bond — Bond Weapons"
                options={['Scimitar', 'Longsword', 'Mace']}
                maxChoices={2}
                confirmLabel="Bond"
                onConfirm={vi.fn()}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByLabelText('Scimitar'));
        fireEvent.click(screen.getByLabelText('Longsword'));
        fireEvent.click(screen.getByLabelText('Mace'));
        const checked = screen.getAllByRole('checkbox').filter(cb => cb.checked);
        expect(checked).toHaveLength(2);
    });

    it('confirm dispatches the selected weapons to onConfirm', async () => {
        const onConfirm = vi.fn(async () => ({
            type: 'popup',
            payload: { type: 'automation_info', name: 'War Bond', description: 'Bonded Longsword.' },
        }));
        render(
            <WarBondChooserModal
                title="War Bond — Summon Bonded Weapon"
                options={['Scimitar', 'Longsword']}
                maxChoices={1}
                confirmLabel="Summon"
                onConfirm={onConfirm}
                onClose={vi.fn()}
            />
        );
        const summonBtn = screen.getByText('Summon').closest('button');
        expect(summonBtn.disabled).toBe(true);
        fireEvent.click(screen.getByLabelText('Longsword'));
        expect(summonBtn.disabled).toBe(false);
        fireEvent.click(summonBtn);
        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(['Longsword']));
        await waitFor(() => expect(screen.getByText('Bonded Longsword.')).toBeTruthy());
    });

    it('Done closes the modal after a result popup', async () => {
        const onClose = vi.fn();
        render(
            <WarBondChooserModal
                title="War Bond — Summon Bonded Weapon"
                options={['Scimitar']}
                maxChoices={1}
                confirmLabel="Summon"
                onConfirm={vi.fn(async () => ({
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'War Bond', description: 'Summoned.' },
                }))}
                onClose={onClose}
            />
        );
        fireEvent.click(screen.getByLabelText('Scimitar'));
        fireEvent.click(screen.getByText('Summon').closest('button'));
        await waitFor(() => expect(screen.getByText('Summoned.')).toBeTruthy());
        fireEvent.click(screen.getByText('Done'));
        expect(onClose).toHaveBeenCalled();
    });
});
