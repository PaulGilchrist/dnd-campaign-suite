// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EyebiteEffectModal from './EyebiteEffectModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => 'test-guid-123'),
    },
}));

vi.mock('../../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

vi.mock('../../../services/automation/handlers/spells/eyebiteHandler.js', () => ({
    getEffectOptions: vi.fn(() => [
        { key: 'asleep', label: 'Asleep', condition: 'unconscious' },
        { key: 'panicked', label: 'Panicked', condition: 'frightened' },
        { key: 'sickened', label: 'Sickened', condition: 'poisoned' },
    ]),
}));

// ── Re-import mocked modules ──

import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as logService from '../../../services/ui/logService.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as automationService from '../../../services/combat/automation/automationService.js';
import utils from '../../../services/ui/utils.js';
import * as storage from '../../../services/ui/storage.js';
import * as rangeValidation from '../../../services/rules/combat/rangeValidation.js';

// ── Test fixtures ──

const baseProps = {
    combatSummary: {
        creatures: [
            { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 2 }, conditions: [] },
            { name: 'Orc Warrior', type: 'npc', saveBonuses: { wis: 4 }, conditions: [] },
            { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 }, conditions: [] },
        ],
    },
    attackerName: 'Witch1',
    attackerPos: { gridX: 5, gridY: 5 },
    saveDc: 13,
    campaignName: 'test-campaign',
    mapData: {
        players: [{ name: 'Elf Mage', gridX: 6, gridY: 6 }],
        placedItems: [],
    },
    onClose: vi.fn(),
    characters: [],
    featureName: 'Eyebite',
    rangeFeet: 60,
    durationRounds: 10,
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

// ── Helpers ──

function selectEffectAndTarget(effectLabel, targetName, _props) {
    const p = _props || makeProps();
    render(<EyebiteEffectModal {...p} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(effectLabel, 'i') }));
    const checkbox = [...document.querySelectorAll('input[type="checkbox"]')].find(
        (cb) => cb.closest('.abjure-target-row')?.querySelector('.abjure-target-name')?.textContent === targetName
    );
    fireEvent.click(checkbox);
    return { container: document.querySelector('.sp-body') };
}

function applyEffect(_props) {
    return screen.getByRole('button', {
        name: /(?:Eyebite|Witch Eyebite).*\d+ target[s]?/i,
    });
}

// ── Tests ──

describe('EyebiteEffectModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollD20.mockReturnValue(15);
        automationService.playerIsImmuneToCondition.mockReturnValue(false);
        runtimeState.getRuntimeValue.mockReturnValue(null);
        utils.guid.mockReturnValue('test-guid-123');
    });

    // ── Initial render / display ──

    describe('initial render', () => {
        it('renders the overlay, modal container, and header with feature name', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(screen.getByText('Eyebite')).toBeInTheDocument();
            expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
            expect(document.querySelector('.sp-modal')).toBeInTheDocument();
            expect(document.querySelector('.sp-header')).toBeInTheDocument();
        });

        it('renders a Font Awesome eye icon in the header', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(document.querySelector('.fa-solid.fa-eye, .fa-eye')).toBeInTheDocument();
        });

        it('displays the effect selection prompt', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(screen.getByText('Choose an effect for the target(s):')).toBeInTheDocument();
        });

        it('renders all three effect buttons with descriptions', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Asleep/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Panicked/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Sickened/ })).toBeInTheDocument();
            expect(screen.getByText('Target falls unconscious')).toBeInTheDocument();
            expect(screen.getByText('Target is frightened (must Dash away)')).toBeInTheDocument();
            expect(screen.getByText('Target has disadvantage on attack rolls and ability checks')).toBeInTheDocument();
        });

        it('renders a Cancel button', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('does not show target selection or results screens', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(screen.queryByText(/Select creatures within/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Resolving WIS saving throws/)).not.toBeInTheDocument();
        });

        it('renders with proper CSS structure', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(document.querySelector('.sp-body')).toBeInTheDocument();
            expect(document.querySelector('.sp-actions')).toBeInTheDocument();
            expect(document.querySelector('.eyebite-effects-list')).toBeInTheDocument();
            expect(document.querySelector('.eyebite-effect-btn')).toBeInTheDocument();
        });
    });

    // ── Overlay and dismissal ──

    describe('dismissal', () => {
        it('calls onClose when clicking the overlay background', () => {
            const onClose = vi.fn();
            render(<EyebiteEffectModal {...makeProps({ onClose })} />);
            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not close when clicking inside the modal content', () => {
            const onClose = vi.fn();
            render(<EyebiteEffectModal {...makeProps({ onClose })} />);
            fireEvent.click(document.querySelector('.sp-modal'));
            expect(onClose).not.toHaveBeenCalled();
        });

        it('calls onClose when Cancel button is clicked', () => {
            const onClose = vi.fn();
            render(<EyebiteEffectModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    // ── Effect selection ──

    describe('effect selection', () => {
        it('navigates to target selection after picking an effect', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText(/Effect:/)).toBeInTheDocument();
            expect(screen.getByText(/Select creatures within/)).toBeInTheDocument();
            expect(screen.queryByText('Choose an effect for the target(s):')).not.toBeInTheDocument();
        });

        it('displays WIS save DC info after effect selection', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText(/WIS/)).toBeInTheDocument();
            expect(screen.getByText(/DC 13/)).toBeInTheDocument();
        });

        it('displays the configured range after effect selection', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText(/within 60 feet/)).toBeInTheDocument();
        });

        it('displays a custom range after effect selection', () => {
            render(<EyebiteEffectModal {...makeProps({ rangeFeet: 30 })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText(/within 30 feet/)).toBeInTheDocument();
        });

        it('goes back to effect selection when Back button is clicked', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Back' }));
            expect(screen.getByText('Choose an effect for the target(s):')).toBeInTheDocument();
            expect(screen.queryByText(/Effect:/)).not.toBeInTheDocument();
        });

        it('shows Back and Cancel buttons after effect selection', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });
    });

    // ── Eligible targets ──

    describe('eligible targets', () => {
        it('lists all non-attacker creatures after effect selection', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText('Goblin1')).toBeInTheDocument();
            expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
            expect(screen.getByText('Elf Mage')).toBeInTheDocument();
        });

        it('excludes the attacker from eligible targets', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.queryByText('Witch1')).not.toBeInTheDocument();
        });

        it('displays creature type next to each target name', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const body = document.querySelector('.sp-body');
            expect(body.textContent).toContain('(npc)');
            expect(body.textContent).toContain('(player)');
        });

        it('shows no valid targets message when creatures array is empty', () => {
            render(<EyebiteEffectModal {...makeProps({ combatSummary: { creatures: [] } })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
        });

        it('shows no valid targets message when combatSummary is null', () => {
            render(<EyebiteEffectModal {...makeProps({ combatSummary: null })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
        });

        it('includes targets when mapData is null', () => {
            render(<EyebiteEffectModal {...makeProps({ mapData: null, attackerPos: null })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText('Goblin1')).toBeInTheDocument();
            expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
        });

        it('filters out player targets beyond rangeFeet', () => {
            rangeValidation.getDistanceFeet.mockReturnValue(100);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            // Player targets with map positions are filtered by distance;
            // NPCs without map positions are always included.
            expect(screen.queryByText('Elf Mage')).not.toBeInTheDocument();
            expect(screen.getByText('Goblin1')).toBeInTheDocument();
        });
    });

    // ── Target selection ──

    describe('target selection', () => {
        it('toggles a target checkbox on and off', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            expect(screen.getByText(/Targets selected:\s*1\/\d+/)).toBeInTheDocument();
            fireEvent.click(checkbox);
            expect(screen.getByText(/Targets selected:\s*0\/\d+/)).toBeInTheDocument();
        });

        it('shows the selected count out of total', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const body = document.querySelector('.sp-body');
            expect(body.textContent).toMatch(/Targets selected:\s*0\/\d+/);
        });

        it('applies selected class to the checked target row', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            const row = checkbox.closest('.abjure-target-row');
            expect(row).toHaveClass('abjure-target-selected');
        });

        it('renders the targets list container after effect selection', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(document.querySelector('.abjure-targets-list')).toBeInTheDocument();
        });
    });

    // ── Apply button ──

    describe('apply button', () => {
        it('is disabled when no targets selected', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(applyEffect()).toBeDisabled();
        });

        it('is enabled when at least one target is selected', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            expect(applyEffect()).toBeEnabled();
        });

        it('displays singular "target" for one selection', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            expect(screen.getByRole('button', { name: /Eyebite.*1 target/ })).toBeInTheDocument();
        });

        it('displays plural "targets" for multiple selections', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[1]);
            expect(screen.getByRole('button', { name: /Eyebite.*2 targets/ })).toBeInTheDocument();
        });

        it('uses the custom feature name on the Apply button', () => {
            render(<EyebiteEffectModal {...makeProps({ featureName: 'Witch Eyebite' })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByRole('button', { name: /Witch Eyebite.*0 targets/ })).toBeInTheDocument();
        });
    });

    // ── NPC resolution ──

    describe('NPC resolution', () => {
        it('shows processing state after applying', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(screen.getByText(/Resolving WIS saving throws/)).toBeInTheDocument();
            });
        });

        it('calls rollD20 for each NPC target', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => expect(diceRoller.rollD20).toHaveBeenCalled());
        });

        it('sends save result for NPC targets', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => expect(savePromptService.sendSaveResult).toHaveBeenCalled());
        });

        it('calls addExpiration when NPC fails save', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => expect(expirations.addExpiration).toHaveBeenCalled());
        });

        it('does not call addExpiration when NPC succeeds save', async () => {
            diceRoller.rollD20.mockReturnValue(20);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => expect(expirations.addExpiration).not.toHaveBeenCalled());
        });

        it('adds roll log entry for NPC targets', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(logService.addEntry).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({ type: 'roll' })
                );
            });
        });

        it('logs save type as WIS', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const rollCall = logService.addEntry.mock.calls.find(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCall[1].saveType).toBe('WIS');
            });
        });

        it('logs the feature name in the roll entry', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const rollCall = logService.addEntry.mock.calls.find(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCall[1].name).toBe('Eyebite');
            });
        });

        it('logs the attacker name in the roll entry', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const rollCall = logService.addEntry.mock.calls.find(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCall[1].characterName).toBe('Witch1');
            });
        });

        it('logs the target name in the roll entry', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const rollCall = logService.addEntry.mock.calls.find(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCall[1].targetName).toBe('Goblin1');
            });
        });

        it('logs the correct save DC in the roll entry', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const rollCall = logService.addEntry.mock.calls.find(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCall[1].saveDc).toBe(13);
            });
        });

        it('includes the save bonus in the roll formula when non-zero', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const rollCall = logService.addEntry.mock.calls.find(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCall[1].formula).toBe('1d20+2');
            });
        });

        it('omits the plus sign from formula when save bonus is zero', async () => {
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [{ name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] }],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const rollCall = logService.addEntry.mock.calls.find(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCall[1].formula).toBe('1d20');
            });
        });

        it('displays "Saved" message when NPC succeeds', async () => {
            diceRoller.rollD20.mockReturnValue(20);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => expect(screen.getByText(/Saved/)).toBeInTheDocument());
        });

        it('displays failure label with effect name when NPC fails', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Panicked/ }));
            const checkbox = [...document.querySelectorAll('input[type="checkbox"]')].find(
                (cb) => cb.closest('.abjure-target-row')?.querySelector('.abjure-target-name')?.textContent === 'Goblin1'
            );
            fireEvent.click(checkbox);
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain('Failed — Panicked!');
            });
        });

        it('displays roll details next to NPC result', async () => {
            diceRoller.rollD20.mockReturnValue(8);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain('Roll: 8');
            });
        });

        it('hides Apply, Back, and Cancel buttons while processing', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
            });
        });

        it('renders the results list container after processing', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(document.querySelector('.abjure-results-list')).toBeInTheDocument();
            });
        });
    });

    // ── Multiple NPC targets ──

    describe('multiple NPC targets', () => {
        it('rolls for all selected NPC targets', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[1]);
            fireEvent.click(applyEffect());
            await waitFor(() => expect(diceRoller.rollD20).toHaveBeenCalledTimes(2));
        });

        it('shows results for all NPC targets', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[1]);
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(screen.getByText('Goblin1')).toBeInTheDocument();
                expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
            });
        });
    });

    // ── Player save prompts ──

    describe('player save prompts', () => {
        it('sends a save prompt for player targets instead of resolving immediately', async () => {
            rangeValidation.getDistanceFeet.mockReturnValue(30);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            expect(checkboxes.length).toBeGreaterThanOrEqual(3);
            fireEvent.click(checkboxes[0]); // NPC
            fireEvent.click(checkboxes[2]); // player
            fireEvent.click(applyEffect());
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
        });

        it('shows pending state for player targets', async () => {
            rangeValidation.getDistanceFeet.mockReturnValue(30);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[2]);
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
            });
        });

        it('shows NPC results alongside pending player results', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            rangeValidation.getDistanceFeet.mockReturnValue(30);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[2]);
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(screen.getByText('Goblin1')).toBeInTheDocument();
                expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
            });
        });

        it('adds roll log entries for both NPC and player targets', async () => {
            rangeValidation.getDistanceFeet.mockReturnValue(30);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[2]);
            fireEvent.click(applyEffect());
            await waitFor(() => {
                const rollCalls = logService.addEntry.mock.calls.filter(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCalls.length).toBe(2);
            });
        });
    });

    // ── Save result event handling ──

    describe('save result events', () => {
        it('adds a roll log entry when a player save result event arrives', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            rangeValidation.getDistanceFeet.mockReturnValue(30);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[2]);
            fireEvent.click(applyEffect());

            await act(async () => {
                const saveEvent = new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-123', success: false, total: 10, roll: 8, saveBonus: 2 },
                });
                window.dispatchEvent(saveEvent);
            });

            await waitFor(() => {
                const rollCalls = logService.addEntry.mock.calls.filter(
                    (call) => call[1].type === 'roll'
                );
                expect(rollCalls.length).toBeGreaterThan(2);
            });
        });

        it('removes the pending prompt after a save result event', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            fireEvent.click(applyEffect());

            await act(async () => {
                const saveEvent = new CustomEvent('save-result', {
                    detail: { promptId: 'test-prompt-id', success: true, total: 10, roll: 8, saveBonus: 2 },
                });
                window.dispatchEvent(saveEvent);
            });

            await waitFor(() => {
                expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
            });
        });

        it('ignores save-result events with an unknown promptId', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            fireEvent.click(applyEffect());

            await act(async () => {
                const saveEvent = new CustomEvent('save-result', {
                    detail: { promptId: 'unknown-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
                });
                window.dispatchEvent(saveEvent);
            });

            await waitFor(() => {
                expect(screen.getByText('Goblin1')).toBeInTheDocument();
            });
        });

        it('ignores save-result events with null detail', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            fireEvent.click(applyEffect());

            await act(async () => {
                const saveEvent = new CustomEvent('save-result', { detail: null });
                window.dispatchEvent(saveEvent);
            });

            await waitFor(() => {
                expect(screen.getByText(/Goblin1/)).toBeInTheDocument();
            });
        });
    });

    // ── All resolved state ──

    describe('all resolved state', () => {
        it('shows "All targets resolved" message when processing completes', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(screen.getByText(/All targets resolved/)).toBeInTheDocument();
            });
        });

        it('shows a Done button when all resolved', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
        });

        it('calls onClose when Done button is clicked', async () => {
            const onClose = vi.fn();
            diceRoller.rollD20.mockReturnValue(5);
            selectEffectAndTarget('Asleep', 'Goblin1', makeProps({ onClose }));
            fireEvent.click(applyEffect());
            await waitFor(() => {
                fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            });
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    // ── Immunity handling ──

    describe('immunity handling', () => {
        it('does not apply condition when target is immune', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            automationService.playerIsImmuneToCondition.mockReturnValue(true);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                    'Goblin1',
                    'activeConditions',
                    expect.any(Array),
                    'test-campaign'
                );
            });
        });
    });

    // ── Storage and events ──

    describe('storage and events', () => {
        it('calls storage.set with combatSummary after applying', async () => {
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(storage.default.set).toHaveBeenCalledWith(
                    'combatSummary',
                    expect.any(Object),
                    'test-campaign'
                );
            });
        });

        it('dispatches a combat-summary-updated event after applying', async () => {
            const eventListener = vi.fn();
            window.addEventListener('combat-summary-updated', eventListener);
            selectEffectAndTarget('Asleep', 'Goblin1');
            fireEvent.click(applyEffect());
            expect(eventListener).toHaveBeenCalled();
            window.removeEventListener('combat-summary-updated', eventListener);
        });
    });

    // ── Custom props ──

    describe('custom props', () => {
        it('uses a custom feature name in the header', () => {
            render(<EyebiteEffectModal {...makeProps({ featureName: 'Witch Eyebite' })} />);
            expect(screen.getByText('Witch Eyebite')).toBeInTheDocument();
        });

        it('passes a custom durationRounds to addExpiration', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            render(<EyebiteEffectModal {...makeProps({ durationRounds: 5 })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(expirations.addExpiration).toHaveBeenCalledWith(
                    'Witch1',
                    'Goblin1',
                    expect.any(Array),
                    'test-campaign',
                    5
                );
            });
        });

        it('uses the default durationRounds of 10 when not provided', async () => {
            diceRoller.rollD20.mockReturnValue(5);
            render(<EyebiteEffectModal {...makeProps({ durationRounds: undefined })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const checkbox = document.querySelector('input[type="checkbox"]');
            fireEvent.click(checkbox);
            fireEvent.click(applyEffect());
            await waitFor(() => {
                expect(expirations.addExpiration).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.any(String),
                    expect.any(Array),
                    expect.any(String),
                    10
                );
            });
        });

        it('uses the default featureName "Eyebite" when not provided', () => {
            render(<EyebiteEffectModal {...makeProps({ featureName: undefined })} />);
            expect(screen.getByText('Eyebite')).toBeInTheDocument();
        });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
        it('renders with empty characters array', () => {
            render(<EyebiteEffectModal {...makeProps({ characters: [] })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByText('Goblin1')).toBeInTheDocument();
        });
    });

});
