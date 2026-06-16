import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GreaterRestorationPopup from './GreaterRestorationPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ── Mocks ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

// ── Test fixtures ──

const baseSpell = { name: 'Greater Restoration', level: 5 };
const creatureTargets = ['Goblin', 'Orc', 'Troll'];

function makeProps(overrides = {}) {
    return {
        spell: baseSpell,
        _playerStats: {},
        _campaignName: 'test-campaign',
        creatureTargets,
        range: '60 ft',
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
}

// ── Tests ──

describe('GreaterRestorationPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default render ──

    it('renders the popup overlay and modal', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByRole('heading', { name: /greater restoration/i })).toBeInTheDocument();
    });

    it('displays the spell name and level in the spell name section', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByRole('heading', { name: /greater restoration/i })).toBeInTheDocument();
        const spellName = document.querySelector('.metamagic-spell-name');
        expect(spellName.textContent).toContain('Greater Restoration');
        expect(spellName.textContent).toContain('Level 5');
        expect(spellName.textContent).toContain('Abjuration');
    });

    it('shows the spell description text', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByText(/Choose a creature within/)).toBeInTheDocument();
        expect(screen.getByText(/60 ft/)).toBeInTheDocument();
    });

    it('displays all creature targets in the target list', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        creatureTargets.forEach(name => {
            expect(screen.getByText(name)).toBeInTheDocument();
        });
    });

    it('renders Cancel button', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Cast Greater Restoration button', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByText('Cast Greater Restoration')).toBeInTheDocument();
    });

    it('disables Cast button when no target is selected', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();
    });

    // ── Target selection ──

    it('selects a target when clicking on it', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 1;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.getByText(/Effects to remove from Goblin/)).toBeInTheDocument();
    });

    it('highlights the selected target visually', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        // Check that the checkmark prefix is shown for the selected target
        expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
    });

    it('changes selection when clicking a different target', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Orc'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from Orc/)).toBeInTheDocument();
        });
        expect(screen.queryByText('✓ Goblin')).not.toBeInTheDocument();
        expect(screen.getByText('✓ Orc')).toBeInTheDocument();
    });

    // ── Conditions from runtime state ──

    it('shows charmed condition when target has it in runtime state', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
    });

    it('shows petrified condition when target has it in runtime state', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['petrified'];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Petrified condition/)).toBeInTheDocument();
        });
    });

    it('does not show conditions that the target does not have', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
        // Check that only one "Petrified condition" option exists (not in description)
        const petrifiedElements = document.querySelectorAll('[style*="padding: 6px 10px"]');
        const petrifiedOptions = Array.from(petrifiedElements).filter(el =>
            el.textContent.includes('Petrified') && el.textContent.includes('condition')
        );
        expect(petrifiedOptions.length).toBe(0);
    });

    // ── Conditions from combat summary ──

    it('shows conditions from combat summary when not in runtime state', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'charmed' }] }],
        });

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
    });

    it('merges conditions from runtime state and combat summary', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Goblin', conditions: [{ key: 'petrified' }] }],
        });

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
        // Check that Petrified condition option exists in the effects section
        const petrifiedElements = document.querySelectorAll('[style*="padding: 6px 10px"]');
        const petrifiedOptions = Array.from(petrifiedElements).filter(el =>
            el.textContent.includes('Petrified') && el.textContent.includes('condition')
        );
        expect(petrifiedOptions.length).toBe(1);
    });

    // ── Exhaustion ──

    it('shows exhaustion option when target has exhaustion level > 0', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 2;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level \(current: 2\)/)).toBeInTheDocument();
        });
    });

    it('does not show exhaustion option when target has no exhaustion', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Exhaustion level/)).not.toBeInTheDocument();
    });

    // ── Curse ──

    it('shows curse option when target has cursed active buff', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [{ type: 'cursed' }];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse/)).toBeInTheDocument();
        });
    });

    it('shows curse option when active buff has cursed property', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [{ cursed: true }];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse/)).toBeInTheDocument();
        });
    });

    it('does not show curse option when target has no cursed buffs', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [{ type: 'buff' }];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Curse/)).not.toBeInTheDocument();
    });

    // ── Ability reduction ──

    it('shows ability score reduction option when target has ability reductions', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') { return { STR: -2 }; }
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Ability score reduction/)).toBeInTheDocument();
        });
    });

    it('does not show ability score reduction when target has no reductions', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Ability score reduction/)).not.toBeInTheDocument();
    });

    // ── HP max reduction ──

    it('shows HP max reduction option when target has hpMaxReduction > 0', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 5;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Hit Point maximum reduction/)).toBeInTheDocument();
        });
    });

    it('does not show HP max reduction when target has no hpMaxReduction', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Effects to remove from/)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Hit Point maximum reduction/)).not.toBeInTheDocument();
    });

    // ── No removable effects ──

    it('shows "no removable effects" message when target has no effects', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found on this target/)).toBeInTheDocument();
        });
    });

    // ── Selection toggling ──

    it('toggles exhaustion selection when clicked', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 1;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Exhaustion level \(current: 1\)/));
        expect(screen.getByText('✓ Exhaustion level (current: 1)')).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Exhaustion level \(current: 1\)/));
        expect(screen.queryByText('✓ Exhaustion level (current: 1)')).not.toBeInTheDocument();
    });

    it('toggles condition selection when clicked', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Charmed condition/));
        expect(screen.getByText('✓ Charmed condition')).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Charmed condition/));
        expect(screen.queryByText('✓ Charmed condition')).not.toBeInTheDocument();
    });

    it('toggles curse selection when clicked', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [{ type: 'cursed' }];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Curse/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Curse/));
        expect(screen.getByText(text => text.includes('✓') && text.includes('Curse'))).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Curse/));
        expect(screen.queryByText(text => text.includes('✓') && text.includes('Curse'))).not.toBeInTheDocument();
    });

    it('toggles ability score reduction selection when clicked', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return { STR: -2 };
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Ability score reduction/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Ability score reduction/));
        expect(screen.getByText('✓ Ability score reduction')).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Ability score reduction/));
        expect(screen.queryByText('✓ Ability score reduction')).not.toBeInTheDocument();
    });

    it('toggles HP max reduction selection when clicked', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 3;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Hit Point maximum reduction/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Hit Point maximum reduction/));
        expect(screen.getByText('✓ Hit Point maximum reduction')).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Hit Point maximum reduction/));
        expect(screen.queryByText('✓ Hit Point maximum reduction')).not.toBeInTheDocument();
    });

    // ── Multiple selections ──

    it('allows selecting multiple effects at once', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 1;
            if (prop === 'activeBuffs') return [{ type: 'cursed' }];
            if (prop === 'abilityReductions') return { STR: -2 };
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level/)).toBeInTheDocument();
        });

        // Select exhaustion
        fireEvent.click(screen.getByText(/Exhaustion level \(current: 1\)/));
        // Select charmed
        fireEvent.click(screen.getByText(/Charmed condition/));
        // Select curse
        fireEvent.click(screen.getByText(/Curse/));
        // Select ability reduction
        fireEvent.click(screen.getByText(/Ability score reduction/));

        expect(screen.getByText('✓ Exhaustion level (current: 1)')).toBeInTheDocument();
        expect(screen.getByText('✓ Charmed condition')).toBeInTheDocument();
        expect(screen.getByText(text => text.includes('✓') && text.includes('Curse'))).toBeInTheDocument();
        expect(screen.getByText('✓ Ability score reduction')).toBeInTheDocument();
    });

    // ── Confirm button state ──

    it('enables Cast button when target is selected and at least one effect is selected', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });

        // Still disabled because no selections yet
        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();

        // Select the charmed condition
        fireEvent.click(screen.getByText(/Charmed condition/));
        expect(screen.getByText('Cast Greater Restoration')).toBeEnabled();
    });

    it('keeps Cast button disabled when target is selected but no effects are selected', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found/)).toBeInTheDocument();
        });
        expect(screen.getByText('Cast Greater Restoration')).toBeDisabled();
    });

    // ── Confirm action ──

    it('calls onConfirm with target name and selections when Cast button is clicked', async () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['charmed'];
            if (prop === 'exhaustionLevel') return 2;
            if (prop === 'activeBuffs') return [{ type: 'cursed' }];
            if (prop === 'abilityReductions') return { STR: -2 };
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Exhaustion level/)).toBeInTheDocument();
        });

        // Select exhaustion and charmed
        fireEvent.click(screen.getByText(/Exhaustion level \(current: 2\)/));
        fireEvent.click(screen.getByText(/Charmed condition/));

        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Goblin',
            selections: [
                { type: 'exhaustion' },
                { type: 'condition', condition: 'charmed' },
            ],
        });
    });

    it('does not call onConfirm when no target is selected', () => {
        const onConfirm = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when target is selected but no effects are selected', async () => {
        const onConfirm = vi.fn();
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/No removable effects found/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cast Greater Restoration'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Cancel/Skip ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay background is clicked', () => {
        const onSkip = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.click(document.querySelector('.popup-overlay'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return [];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.click(screen.getByText('Goblin'));
        // Click somewhere inside the modal content (the description text)
        fireEvent.click(screen.getByText(/Choose a creature within/));
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard handler ──

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for non-Escape key press', () => {
        const onSkip = vi.fn();
        render(<GreaterRestorationPopup {...makeProps({ onSkip })} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Fallback values ──

    it('shows fallback spell name when spell prop is undefined', () => {
        render(<GreaterRestorationPopup {...makeProps({ spell: undefined })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
    });

    it('shows fallback level when spell.level is undefined', () => {
        render(<GreaterRestorationPopup {...makeProps({ spell: { name: 'Test Spell' } })} />);
        expect(screen.getByText(/Level 5/)).toBeInTheDocument();
    });

    // ── CSS classes ──

    it('renders with popup-overlay class', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    });

    it('renders with popup-modal class', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders with metamagic-popup class', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
    });

    it('renders with metamagic-popup-inner class', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
    });

    it('renders with metamagic-actions class', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
    });

    // ── Health icon ──

    it('renders health icon in heading', () => {
        render(<GreaterRestorationPopup {...makeProps()} />);
        const icon = document.querySelector('.fa-hand-holding-medical');
        expect(icon).toBeInTheDocument();
    });

    // ── Case-insensitive condition matching ──

    it('matches conditions case-insensitively', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'activeConditions') return ['CHARMED'];
            if (prop === 'exhaustionLevel') return 0;
            if (prop === 'activeBuffs') return [];
            if (prop === 'abilityReductions') return {};
            if (prop === 'hpMaxReduction') return 0;
            return null;
        });
        getCombatSummary.mockReturnValue(null);

        render(<GreaterRestorationPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        await waitFor(() => {
            expect(screen.getByText(/Charmed condition/)).toBeInTheDocument();
        });
    });
});
