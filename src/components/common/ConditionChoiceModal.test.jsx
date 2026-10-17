// @maintained-by-ai
// @improved-by-ai
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import ConditionChoiceModal from './ConditionChoiceModal.jsx';

describe('ConditionChoiceModal', () => {
    // Records every response event so tests can assert both that the right
    // event fired exactly once AND that no wrong event fired at all.
    let dispatchRecord;
    let handlers;

    function showModal(detail) {
        act(() => {
            window.dispatchEvent(new CustomEvent('condition-choice-show', { detail }));
        });
    }

    function clickButton(name) {
        fireEvent.click(screen.getByRole('button', { name }));
    }

    function expectModalDismissed() {
        expect(screen.queryByText(/failed the saving throw/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    }

    beforeEach(() => {
        dispatchRecord = { selected: [], skipped: [] };
        handlers = {
            selected: (event) => dispatchRecord.selected.push(event.detail),
            skipped: (event) => dispatchRecord.skipped.push(event.detail),
        };
        window.addEventListener('condition-choice-selected', handlers.selected);
        window.addEventListener('condition-choice-skipped', handlers.skipped);
    });

    afterEach(() => {
        window.removeEventListener('condition-choice-selected', handlers.selected);
        window.removeEventListener('condition-choice-skipped', handlers.skipped);
    });

    it('renders nothing until a condition-choice-show event arrives', () => {
        const { container } = render(<ConditionChoiceModal />);

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows the prompt for the event target when the show event arrives', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: ['charmed', 'frightened'],
        });

        expect(screen.getByText('Choose Condition')).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText(/failed the saving throw/)).toBeInTheDocument();
    });

    it('renders one choice button per distinct condition, ignoring duplicates', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: ['charmed', 'charmed', 'frightened', 'frightened'],
        });

        expect(screen.getAllByRole('button', { name: 'Charmed' })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'Frightened' })).toHaveLength(1);
        // two choices plus the skip button, nothing else
        expect(screen.getAllByRole('button')).toHaveLength(3);
    });

    it('shows human-readable condition labels regardless of input casing', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: ['charmed', 'Poisoned'],
        });

        expect(screen.getByRole('button', { name: 'Charmed' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Poisoned' })).toBeInTheDocument();
        expect(screen.queryByText('charmed')).not.toBeInTheDocument();
    });

    it('choosing a condition reports it once for the current prompt and dismisses the modal', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'prompt-abc',
            targetName: 'Goblin',
            conditions: ['charmed', 'frightened'],
        });
        clickButton('Frightened');

        expect(dispatchRecord.selected).toEqual([
            { promptId: 'prompt-abc', condition: 'frightened' },
        ]);
        expect(dispatchRecord.skipped).toHaveLength(0);
        expectModalDismissed();
    });

    it('skipping reports the prompt once with no condition and dismisses the modal', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'prompt-xyz',
            targetName: 'Goblin',
            conditions: ['charmed', 'frightened'],
        });
        clickButton('Skip (No Effect)');

        expect(dispatchRecord.skipped).toEqual([{ promptId: 'prompt-xyz' }]);
        expect(dispatchRecord.selected).toHaveLength(0);
        expectModalDismissed();
    });

    it('with no conditions offered, still shows a prompt the player can escape via skip', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'empty-prompt',
            targetName: 'Goblin',
            conditions: [],
        });

        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(1); // skip only
        clickButton('Skip (No Effect)');

        expect(dispatchRecord.skipped).toEqual([{ promptId: 'empty-prompt' }]);
        expectModalDismissed();
    });

    it('replaces a pending prompt with the latest one, so stale targets cannot be chosen', () => {
        render(<ConditionChoiceModal />);

        showModal({ promptId: 'stale-prompt', targetName: 'Goblin', conditions: ['charmed'] });
        showModal({ promptId: 'fresh-prompt', targetName: 'Orc', conditions: ['frightened'] });

        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Charmed' })).not.toBeInTheDocument();

        clickButton('Frightened');

        expect(dispatchRecord.selected).toEqual([
            { promptId: 'fresh-prompt', condition: 'frightened' },
        ]);
    });

    it('tracks the correct promptId across sequential prompt/answer pairs', () => {
        render(<ConditionChoiceModal />);

        showModal({ promptId: 'first-prompt', targetName: 'Goblin', conditions: ['charmed'] });
        clickButton('Charmed');
        expectModalDismissed();

        showModal({ promptId: 'second-prompt', targetName: 'Orc', conditions: ['frightened'] });
        clickButton('Frightened');
        expectModalDismissed();

        expect(dispatchRecord.selected).toEqual([
            { promptId: 'first-prompt', condition: 'charmed' },
            { promptId: 'second-prompt', condition: 'frightened' },
        ]);
        expect(dispatchRecord.skipped).toHaveLength(0);
    });
});
