import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SacredWeaponModal from './SacredWeaponModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-cleric-paladin/sacredWeaponHandler.js', () => ({
    applyDamageTypeChoice: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as sacredWeaponHandler from '../../../services/automation/handlers/class-cleric-paladin/sacredWeaponHandler.js';

// ── Test fixtures ──

const baseAction = {
    name: 'Sacred Weapon',
    automation: {
        type: 'sacred_weapon',
        options: [
            { name: 'Radiant', damageType: 'Radiant' },
            { name: 'Fire', damageType: 'Fire' },
            { name: 'Cold', damageType: 'Cold' },
        ],
    },
};

const basePlayerStats = {
    name: 'Paladin1',
    level: 5,
    hitPoints: 40,
};

const baseProps = {
    action: baseAction,
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

function makeAction(overrides) {
    return { ...baseAction, ...(overrides || {}) };
}

// ── Tests ──

describe('SacredWeaponModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Initial render / display ──

    it('renders modal overlay', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('renders modal header', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
    });

    it('renders modal body', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
    });

    it('renders modal actions', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders action name in header', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
    });

    it('renders Font Awesome icon in header', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        const icon = document.querySelector('.sp-header .fa-solid');
        expect(icon).toBeInTheDocument();
    });

    it('displays the choice prompt text', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByText('Choose the damage type for Sacred Weapon:')).toBeInTheDocument();
    });

    it('renders all damage type options as radio buttons', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByLabelText('Radiant')).toBeInTheDocument();
        expect(screen.getByLabelText('Fire')).toBeInTheDocument();
        expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    });

    it('renders option names as labels next to radio inputs', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        const labels = document.querySelectorAll('label');
        expect(labels.length).toBe(3);
    });

    it('does not have any option selected initially', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByLabelText('Radiant')).not.toBeChecked();
        expect(screen.getByLabelText('Fire')).not.toBeChecked();
        expect(screen.getByLabelText('Cold')).not.toBeChecked();
    });

    it('renders Activate Sacred Weapon button', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByRole('button', { name: 'Activate Sacred Weapon' })).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('has Activate button disabled when no option selected', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByRole('button', { name: 'Activate Sacred Weapon' })).toBeDisabled();
    });

    // ── Overlay click behavior ──

    it('calls onClose when clicking the overlay background', () => {
        const onClose = vi.fn();
        render(<SacredWeaponModal {...makeProps({ onClose })} />);
        fireEvent.click(document.querySelector('.sp-overlay'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
        const onClose = vi.fn();
        render(<SacredWeaponModal {...makeProps({ onClose })} />);
        fireEvent.click(document.querySelector('.sp-modal'));
        expect(onClose).not.toHaveBeenCalled();
    });

    // ── Cancel button ──

    it('calls onClose when Cancel button is clicked', () => {
        const onClose = vi.fn();
        render(<SacredWeaponModal {...makeProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // ── Option selection ──

    it('selects an option when its radio button is clicked', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Fire'));
        expect(screen.getByLabelText('Fire')).toBeChecked();
    });

    it('deselects previous selection when a different option is clicked', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Radiant'));
        expect(screen.getByLabelText('Radiant')).toBeChecked();
        fireEvent.click(screen.getByLabelText('Cold'));
        expect(screen.getByLabelText('Radiant')).not.toBeChecked();
        expect(screen.getByLabelText('Cold')).toBeChecked();
    });

    it('enables Activate button after selecting an option', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByRole('button', { name: 'Activate Sacred Weapon' })).toBeDisabled();
        fireEvent.click(screen.getByLabelText('Fire'));
        expect(screen.getByRole('button', { name: 'Activate Sacred Weapon' })).toBeEnabled();
    });

    // ── Apply flow ──

    it('calls applyDamageTypeChoice with correct parameters when activating', async () => {
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description: 'Sacred Weapon activated.',
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Radiant'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        expect(sacredWeaponHandler.applyDamageTypeChoice).toHaveBeenCalledWith(
            baseAction,
            basePlayerStats,
            'test-campaign',
            'Radiant'
        );
    });

    it('does not call applyDamageTypeChoice when no option is selected', async () => {
        render(<SacredWeaponModal {...makeProps()} />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
    });

    it('shows result after successful activation', async () => {
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description: 'Sacred Weapon activated. Your melee weapon glows with bright light.',
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Fire'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        await waitFor(() => {
            expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
        });
    });

    it('renders Done button after activation', async () => {
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description: 'Sacred Weapon activated.',
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Cold'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });
    });

    it('hides option selection after activation', async () => {
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description: 'Sacred Weapon activated.',
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Radiant'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        await waitFor(() => {
            expect(screen.queryByText('Choose the damage type for Sacred Weapon:')).not.toBeInTheDocument();
        });
    });

    it('hides Activate button after activation', async () => {
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description: 'Sacred Weapon activated.',
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Fire'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Activate Sacred Weapon' })).not.toBeInTheDocument();
        });
    });

    it('hides Cancel button after activation', async () => {
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description: 'Sacred Weapon activated.',
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Cold'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        });
    });

    it('calls onClose when Done button is clicked after activation', async () => {
        const onClose = vi.fn();
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description: 'Sacred Weapon activated.',
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps({ onClose })} />);
        fireEvent.click(screen.getByLabelText('Radiant'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        await waitFor(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders description from result payload', async () => {
        const description = 'Sacred Weapon activated. Your melee weapon glows with bright light in a 20-foot radius.';
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description,
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Fire'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        await waitFor(() => {
            const body = document.querySelector('.sp-body');
            expect(body.innerHTML).toContain(description);
        });
    });

    // ── Options with no choices ──

    it('renders with no options when action has no automation options', () => {
        const actionNoOptions = {
            name: 'Sacred Weapon',
            automation: {
                type: 'sacred_weapon',
            },
        };
        render(<SacredWeaponModal {...makeProps({ action: actionNoOptions })} />);
        expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
        expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
    });

    it('shows Activate button but no radio options when no options available', () => {
        const actionNoOptions = {
            name: 'Sacred Weapon',
            automation: {
                type: 'sacred_weapon',
            },
        };
        render(<SacredWeaponModal {...makeProps({ action: actionNoOptions })} />);
        expect(screen.getByRole('button', { name: 'Activate Sacred Weapon' })).toBeInTheDocument();
        expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
    });

    it('does not call applyDamageTypeChoice when no options and nothing selected', async () => {
        const actionNoOptions = {
            name: 'Sacred Weapon',
            automation: {
                type: 'sacred_weapon',
            },
        };
        render(<SacredWeaponModal {...makeProps({ action: actionNoOptions })} />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
    });

    // ── Options with single choice ──

    it('renders single option when only one option available', () => {
        const actionSingleOption = {
            name: 'Sacred Weapon',
            automation: {
                type: 'sacred_weapon',
                options: [{ name: 'Radiant', damageType: 'Radiant' }],
            },
        };
        render(<SacredWeaponModal {...makeProps({ action: actionSingleOption })} />);
        expect(screen.getByLabelText('Radiant')).toBeInTheDocument();
        expect(screen.queryByLabelText('Fire')).not.toBeInTheDocument();
    });

    // ── Selected option visual feedback ──

    it('applies selected styling to chosen option', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        const radiantLabel = document.querySelector('label');
        expect(radiantLabel.style.border).toBe('1px solid transparent');
        fireEvent.click(screen.getByLabelText('Fire'));
        const labels = document.querySelectorAll('label');
        const fireLabel = Array.from(labels).find(l => l.textContent.includes('Fire'));
        expect(fireLabel.style.border).toBe('1px solid var(--color-link)');
    });

    // ── Multiple activation cycles (re-mount behavior) ──

    it('resets state on each mount (no stale state)', () => {
        const { unmount } = render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Radiant'));
        expect(screen.getByLabelText('Radiant')).toBeChecked();

        unmount();
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.getByLabelText('Radiant')).not.toBeChecked();
    });

    // ── Custom action name ──

    it('renders custom action name', () => {
        const customAction = makeAction({ name: 'Divine Smite' });
        render(<SacredWeaponModal {...makeProps({ action: customAction })} />);
        expect(screen.getByText('Divine Smite')).toBeInTheDocument();
    });

    it('does not render Done button on initial render', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    // ── Edge cases ──

    it('handles undefined options gracefully', () => {
        const action = {
            name: 'Sacred Weapon',
            automation: {},
        };
        // Should not throw
        expect(() => render(<SacredWeaponModal {...makeProps({ action })} />)).not.toThrow();
    });

    it('throws when action is undefined', () => {
        // Component accesses action.automation without null check
        expect(() => render(<SacredWeaponModal {...makeProps({ action: undefined })} />)).toThrow();
    });

    it('does not render Font Awesome icon on Done button', async () => {
        const result = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sacred Weapon',
                description: 'Sacred Weapon activated.',
            },
        };
        sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(result);

        render(<SacredWeaponModal {...makeProps()} />);
        fireEvent.click(screen.getByLabelText('Radiant'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Activate Sacred Weapon' }));
        });

        await waitFor(() => {
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            expect(doneBtn.querySelector('.fa-solid')).not.toBeInTheDocument();
        });
    });

    it('renders Font Awesome icon on Activate button', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        const activateBtn = screen.getByRole('button', { name: 'Activate Sacred Weapon' });
        expect(activateBtn.querySelector('.fa-solid')).toBeInTheDocument();
    });

    it('uses correct radio button group name', () => {
        render(<SacredWeaponModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[name="sacredWeaponOption"]');
        expect(radios.length).toBe(3);
    });
});
