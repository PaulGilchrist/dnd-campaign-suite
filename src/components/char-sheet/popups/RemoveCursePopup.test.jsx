import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RemoveCursePopup from './RemoveCursePopup.jsx';

// ── Mocks ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const baseSpell = { name: 'Remove Curse', level: 3 };
const creatureTargets = ['Goblin', 'Orc', 'Troll'];

const baseProps = {
    spell: baseSpell,
    creatureTargets,
    range: '30 ft',
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...overrides };
}

function getEffectsSection(targetName) {
    return screen.getByText(new RegExp(`Effects to remove from ${targetName}`)).parentElement;
}

// ── Tests ──

describe('RemoveCursePopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with spell name and medical icon', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const header = document.querySelector('h3');
        expect(within(header).getByText('Remove Curse')).toBeInTheDocument();
        const icon = document.querySelector('.fa-hand-holding-medical');
        expect(icon).toBeInTheDocument();
    });

    it('displays spell name, level, and school', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const spellNameEl = document.querySelector('.metamagic-spell-name strong');
        expect(spellNameEl.textContent).toBe('Remove Curse');
        expect(screen.getByText(/Level 3 Abjuration/)).toBeInTheDocument();
    });

    it('displays the range in the description', () => {
        render(<RemoveCursePopup {...makeProps({ range: '60 ft' })} />);
        expect(screen.getByText('60 ft')).toBeInTheDocument();
    });

    it('shows the description text about curses and attunement', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        expect(screen.getByText(/This spell ends all curses affecting the target/)).toBeInTheDocument();
        expect(screen.getByText(/breaks the target.*attunement/)).toBeInTheDocument();
    });

    it('renders target selection label', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        expect(screen.getByText(/Target:/)).toBeInTheDocument();
    });

    it('renders all creature targets in the target list', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('Troll')).toBeInTheDocument();
    });

    it('renders Cancel and Cast Remove Curse buttons', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cast Remove Curse' })).toBeInTheDocument();
    });

    // ── Target selection ──

    it('highlights the selected target visually', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(goblinTarget).toHaveStyle('border: 1px solid #4CAF50');
    });

    it('shows checkmark prefix for selected target', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(goblinTarget.textContent).toContain('✓');
    });

    it('loads cursed buffs for the selected target', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Sword' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs');
        expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'attunement');
    });

    it('updates target when clicking a different creature', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Orc' && prop === 'activeBuffs') return [];
            if (key === 'Orc' && prop === 'attunement') return [{ item: 'Orc Armor' }];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const orcTarget = screen.getByText('Orc');
        fireEvent.click(orcTarget);
        expect(orcTarget).toHaveStyle('border: 1px solid #4CAF50');
        expect(goblinTarget).not.toHaveStyle('border: 1px solid #4CAF50');
    });

    // ── Effects to remove section ──

    it('shows effects section when a target is selected', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(screen.getByText(/Effects to remove from Goblin/)).toBeInTheDocument();
    });

    it('shows curse option when target has cursed buffs', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        expect(within(effectsSection).getByText(/Curse/)).toBeInTheDocument();
    });

    it('shows the count of cursed effects', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [
                { type: 'cursed', name: 'Cursed Ring' },
                { type: 'cursed', name: 'Cursed Shield' },
            ];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        expect(within(effectsSection).getByText(/Curse \(2 cursed effect\(s\)\)/)).toBeInTheDocument();
    });

    it('shows attunement option when target has attuned items', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [];
            if (key === 'Goblin' && prop === 'attunement') return [{ item: 'Cursed Armor' }];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        expect(within(effectsSection).getByText(/Attunement/)).toBeInTheDocument();
    });

    it('shows the count of attuned items', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [];
            if (key === 'Goblin' && prop === 'attunement') return [
                { item: 'Cursed Armor' },
                { item: 'Cursed Helm' },
                { item: 'Cursed Ring' },
            ];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        expect(within(effectsSection).getByText(/Attunement \(3 attuned item\(s\)\)/)).toBeInTheDocument();
    });

    it('shows no curses or attunement message when target has neither', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(screen.getByText(/No curses or attunement found on this target/)).toBeInTheDocument();
    });

    // ── Selection toggling ──

    it('toggles curse selection when clicked', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        const curseOption = within(effectsSection).getByText(/Curse/);
        fireEvent.click(curseOption);
        expect(curseOption).toHaveStyle('border: 1px solid #4CAF50');
        expect(curseOption.textContent).toContain('✓');
    });

    it('toggles attunement selection when clicked', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [];
            if (key === 'Goblin' && prop === 'attunement') return [{ item: 'Cursed Armor' }];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        const attunementOption = within(effectsSection).getByText(/Attunement/);
        fireEvent.click(attunementOption);
        expect(attunementOption).toHaveStyle('border: 1px solid #4CAF50');
        expect(attunementOption.textContent).toContain('✓');
    });

    it('deselects curse when clicked again', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        const curseOption = within(effectsSection).getByText(/Curse/);
        fireEvent.click(curseOption);
        fireEvent.click(curseOption);
        expect(curseOption).not.toHaveStyle('border: 1px solid #4CAF50');
        expect(curseOption.textContent).not.toContain('✓');
    });

    it('can select both curse and attunement', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [{ item: 'Cursed Armor' }];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        const curseOption = within(effectsSection).getByText(/Curse/);
        const attunementOption = within(effectsSection).getByText(/Attunement/);
        fireEvent.click(curseOption);
        fireEvent.click(attunementOption);
        expect(curseOption).toHaveStyle('border: 1px solid #4CAF50');
        expect(attunementOption).toHaveStyle('border: 1px solid #4CAF50');
    });

    // ── Buttons and confirmation ──

    it('shows Cancel and Cast Remove Curse buttons when target is selected', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cast Remove Curse' })).toBeInTheDocument();
    });

    it('disables Cast Remove Curse button when no selections are made', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const castButton = screen.getByRole('button', { name: 'Cast Remove Curse' });
        expect(castButton).toBeDisabled();
    });

    it('enables Cast Remove Curse button when at least one selection is made', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        const curseOption = within(effectsSection).getByText(/Curse/);
        fireEvent.click(curseOption);
        const castButton = screen.getByRole('button', { name: 'Cast Remove Curse' });
        expect(castButton).toBeEnabled();
    });

    it('calls onConfirm with target name and selections when Cast is clicked', () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [{ item: 'Cursed Armor' }];
            return null;
        });
        render(<RemoveCursePopup {...makeProps({ onConfirm })} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        const curseOption = within(effectsSection).getByText(/Curse/);
        const attunementOption = within(effectsSection).getByText(/Attunement/);
        fireEvent.click(curseOption);
        fireEvent.click(attunementOption);
        fireEvent.click(screen.getByRole('button', { name: 'Cast Remove Curse' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Goblin',
            selections: [{ type: 'curse' }, { type: 'attunement' }],
        });
    });

    it('does not call onConfirm when Cast is clicked with no selections', () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps({ onConfirm })} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        fireEvent.click(screen.getByRole('button', { name: 'Cast Remove Curse' }));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Cancel / skip ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...makeProps({ onSkip })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay is clicked', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...makeProps({ onSkip })} />);
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...makeProps({ onSkip })} />);
        const modal = document.querySelector('.popup-modal');
        fireEvent.click(modal);
        expect(onSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...makeProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for non-Escape key presses', () => {
        const onSkip = vi.fn();
        render(<RemoveCursePopup {...makeProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── CSS classes ──

    it('renders with popup-overlay class', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        expect(overlay).toBeInTheDocument();
    });

    it('renders with popup-modal class', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const modal = document.querySelector('.popup-modal');
        expect(modal).toBeInTheDocument();
    });

    it('renders with metamagic-popup class', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const popup = document.querySelector('.metamagic-popup');
        expect(popup).toBeInTheDocument();
    });

    it('renders with metamagic-popup-inner class', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const inner = document.querySelector('.metamagic-popup-inner');
        expect(inner).toBeInTheDocument();
    });

    it('renders with metamagic-spell-name class', () => {
        render(<RemoveCursePopup {...makeProps()} />);
        const spellName = document.querySelector('.metamagic-spell-name');
        expect(spellName).toBeInTheDocument();
    });

    it('renders with metamagic-twin-target class', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const twinTargets = document.querySelectorAll('.metamagic-twin-target');
        expect(twinTargets.length).toBeGreaterThanOrEqual(2);
    });

    it('renders with metamagic-actions class', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const actions = document.querySelector('.metamagic-actions');
        expect(actions).toBeInTheDocument();
    });

    // ── Button styles ──

    it('renders Cancel button with btn-secondary class', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const cancelButton = screen.getByRole('button', { name: 'Cancel' });
        expect(cancelButton).toHaveClass('btn-secondary');
    });

    it('renders Cast Remove Curse button with btn class', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Ring' }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const castButton = screen.getByRole('button', { name: 'Cast Remove Curse' });
        expect(castButton).toHaveClass('btn');
    });

    // ── Edge cases ──

    it('handles missing spell name gracefully', () => {
        render(<RemoveCursePopup {...makeProps({ spell: null })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    it('handles spell with missing level', () => {
        render(<RemoveCursePopup {...makeProps({ spell: { name: 'Remove Curse' } })} />);
        expect(screen.getByText(/Level/)).toBeInTheDocument();
    });

    it('handles empty creature targets array', () => {
        render(<RemoveCursePopup {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText(/Target:/)).toBeInTheDocument();
    });

    it('handles target with both cursed and attunement data', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Troll' && prop === 'activeBuffs') return [{ type: 'cursed', name: 'Cursed Blade' }];
            if (key === 'Troll' && prop === 'attunement') return [{ item: 'Cursed Plate' }];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const trollTarget = screen.getByText('Troll');
        fireEvent.click(trollTarget);
        const effectsSection = getEffectsSection('Troll');
        expect(within(effectsSection).getByText(/Curse/)).toBeInTheDocument();
        expect(within(effectsSection).getByText(/Attunement/)).toBeInTheDocument();
    });

    it('handles cursed flag on buff instead of type', () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeBuffs') return [{ name: 'Hex', cursed: true }];
            if (key === 'Goblin' && prop === 'attunement') return [];
            return null;
        });
        render(<RemoveCursePopup {...makeProps()} />);
        const goblinTarget = screen.getByText('Goblin');
        fireEvent.click(goblinTarget);
        const effectsSection = getEffectsSection('Goblin');
        expect(within(effectsSection).getByText(/Curse/)).toBeInTheDocument();
    });
});
