// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElementalAffinityModal from './ElementalAffinityModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  setChosenRuntimeValue: vi.fn(),
  getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as elementalAffinityHandler from '../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js';

// ── Test fixtures ──

const DEFAULT_DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];

const baseAction = {
  name: 'Elemental Affinity',
  automation: {
    type: 'class_feature',
    damageTypes: DEFAULT_DAMAGE_TYPES,
  },
};

const basePlayerStats = { name: 'Sorcerer1', level: 1, charismaModifier: 3 };

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

describe('ElementalAffinityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders modal overlay and modal structure with all CSS classes', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the bolt icon in the header', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      const icon = document.querySelector('.sp-header .fa-solid.fa-bolt');
      expect(icon).toBeInTheDocument();
    });

    it('renders the action name in the header', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
    });

    it('renders default name when action name is missing', () => {
      render(<ElementalAffinityModal {...makeProps({ action: { automation: baseAction.automation } })} />);
      expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
    });

    it('renders default name when action is null', () => {
      render(<ElementalAffinityModal {...makeProps({ action: null })} />);
      expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
    });

    it('renders default name when action is undefined', () => {
      render(<ElementalAffinityModal {...makeProps({ action: undefined })} />);
      expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
    });

    it('renders description text for new selection', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByText(/Choose one damage type/)).toBeInTheDocument();
    });

    it('renders description text for changing existing type', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByText(/Change damage type \(currently Fire\)/)).toBeInTheDocument();
    });

    it('renders all five default damage type options', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('renders radio inputs with the correct name attribute', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      const radios = document.querySelectorAll('input[name="elementalAffinityOption"]');
      expect(radios).toHaveLength(5);
    });

    it('marks existing type with (current) label', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByText('(current)')).toBeInTheDocument();
    });

    it('does not show (current) label when no existing type', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.queryByText('(current)')).not.toBeInTheDocument();
    });

    it('hides (current) label after user selects a different type', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(screen.queryByText('(current)')).not.toBeInTheDocument();
    });

    it('renders apply button with "Choose Damage Type" text for new selection', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
    });

    it('renders apply button with "Change Damage Type" text for existing type', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByRole('button', { name: 'Change Damage Type' })).toBeInTheDocument();
    });

    it('renders the bolt icon inside the apply button', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      const applyBtn = screen.getByRole('button', { name: /Damage Type/ });
      expect(applyBtn.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('disables apply button when no type is selected', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeDisabled();
    });

    it('has no radio button checked on initial render', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => expect(radio.checked).toBe(false));
    });
  });

  // ── Radio button selection ──

  describe('radio selection', () => {
    it('selects a damage type when its radio is clicked', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Fire')).toBeChecked();
    });

    it('deselects previous selection when a different radio is clicked', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      expect(screen.getByLabelText('Fire')).not.toBeChecked();
      expect(screen.getByLabelText('Cold')).toBeChecked();
    });

    it('enables apply button after selecting a type', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeEnabled();
    });

    it('allows selecting the same type that is marked as (current)', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      const fireRadio = document.querySelectorAll('input[name="elementalAffinityOption"]')[2];
      fireEvent.click(fireRadio);
      expect(fireRadio).toBeChecked();
    });
  });

  // ── Apply flow ──

  describe('apply flow', () => {
    beforeEach(() => {
      elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elemental Affinity',
          description: 'Elemental Affinity: Fire selected. You gain resistance to Fire damage. When you cast a spell that deals Fire damage, add your Charisma modifier to one damage roll.',
        },
      });
    });

    it('calls applyTypeChoice with correct arguments when apply is clicked', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      expect(elementalAffinityHandler.applyTypeChoice).toHaveBeenCalledWith(
        baseAction,
        basePlayerStats,
        'test-campaign',
        'Fire'
      );
    });

    it('does not call applyTypeChoice when apply is clicked without a selection', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      expect(elementalAffinityHandler.applyTypeChoice).not.toHaveBeenCalled();
    });

    it('calls applyTypeChoice only once on apply', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      expect(elementalAffinityHandler.applyTypeChoice).toHaveBeenCalledTimes(1);
    });

    it('shows result view after successful apply', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Fire selected/)).toBeInTheDocument();
      });
    });

    it('renders the bolt icon in the result view header', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(document.querySelector('.sp-header .fa-solid.fa-bolt')).toBeInTheDocument();
      });
    });

    it('renders the action name in the result view header', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
      });
    });

    it('renders result description from payload in the sp-body', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Fire selected');
        expect(body.textContent).toContain('resistance to Fire damage');
      });
    });

    it('renders result with proper CSS classes', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
      });
    });

    it('renders Done button in result view', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides radio buttons after apply', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.queryByLabelText('Fire')).not.toBeInTheDocument();
      });
    });

    it('hides Cancel button after apply', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('hides the selection prompt after apply', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose one damage type/)).not.toBeInTheDocument();
      });
    });

    it('hides the choose/change button after apply', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Damage Type/ })).not.toBeInTheDocument();
      });
    });

    it('renders result with custom action name', async () => {
      const customAction = makeAction({ name: 'Custom Affinity' });
      render(<ElementalAffinityModal {...makeProps({ action: customAction })} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Custom Affinity')).toBeInTheDocument();
      });
    });
  });

  // ── Result view close behavior ──

  describe('result view close behavior', () => {
    beforeEach(() => {
      elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elemental Affinity',
          description: 'Elemental Affinity: Fire selected.',
        },
      });
    });

    it('calls onClose when Done button is clicked in result view', async () => {
      const onClose = vi.fn();
      render(<ElementalAffinityModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked in result view', async () => {
      const onClose = vi.fn();
      render(<ElementalAffinityModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking modal content in result view', async () => {
      const onClose = vi.fn();
      render(<ElementalAffinityModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Result view with null result ──

  describe('null result handling', () => {
    it('does not show result view when applyTypeChoice returns null', async () => {
      elementalAffinityHandler.applyTypeChoice.mockResolvedValue(null);
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Damage Type/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });

  // ── Custom damage types ──

  describe('custom damage types', () => {
    it('renders custom damage types from action automation', () => {
      const customAction = makeAction({
        automation: { type: 'class_feature', damageTypes: ['Fire', 'Cold'] },
      });
      render(<ElementalAffinityModal {...makeProps({ action: customAction })} />);
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
      expect(screen.getByLabelText('Cold')).toBeInTheDocument();
      expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Lightning')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Poison')).not.toBeInTheDocument();
    });

    it('defaults to all five types when damageTypes is not provided', () => {
      const noTypesAction = makeAction({ automation: { type: 'class_feature' } });
      render(<ElementalAffinityModal {...makeProps({ action: noTypesAction })} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('renders no options when damageTypes is an empty array', () => {
      const emptyTypesAction = makeAction({ automation: { type: 'class_feature', damageTypes: [] } });
      render(<ElementalAffinityModal {...makeProps({ action: emptyTypesAction })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(0);
    });

    it('disables apply button when damageTypes is empty', () => {
      const emptyTypesAction = makeAction({ automation: { type: 'class_feature', damageTypes: [] } });
      render(<ElementalAffinityModal {...makeProps({ action: emptyTypesAction })} />);
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeDisabled();
    });
  });

  // ── Existing type visual indicators ──

  describe('existing type indicators', () => {
    it('shows (current) label next to the existing type', () => {
      const actionWithExisting = makeAction({ existingType: 'Lightning' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      const labels = document.querySelectorAll('label');
      const lightningLabel = Array.from(labels).find(l => l.textContent.includes('Lightning') && l.textContent.includes('(current)'));
      expect(lightningLabel).toBeInTheDocument();
    });

    it('shows (current) next to existing type but not when user has selected something else', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      let fireLabel = null;
      document.querySelectorAll('label').forEach(l => {
        if (l.textContent.includes('Fire')) fireLabel = l;
      });
      expect(fireLabel.textContent).toContain('(current)');
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(fireLabel.textContent).not.toContain('(current)');
    });
  });

  // ── HTML rendering in result view ──

  describe('HTML rendering in result view', () => {
    it('renders result description as HTML via dangerouslySetInnerHTML', async () => {
      elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elemental Affinity',
          description: '<strong>Elemental Affinity:</strong> Fire selected. You gain resistance to <em>Fire</em> damage.',
        },
      });
      render(<ElementalAffinityModal {...baseProps} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.querySelector('strong')).toBeInTheDocument();
        expect(body.querySelector('em')).toBeInTheDocument();
      });
    });
  });

  // ── Edge cases: null/undefined action ──

  describe('null/undefined action handling', () => {
    it('renders with default damage types when action is null', () => {
      render(<ElementalAffinityModal {...makeProps({ action: null })} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('renders with default damage types when action is undefined', () => {
      render(<ElementalAffinityModal {...makeProps({ action: undefined })} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('renders apply button when action is null', () => {
      render(<ElementalAffinityModal {...makeProps({ action: null })} />);
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeInTheDocument();
    });

    it('shows Cancel button when action is null', () => {
      render(<ElementalAffinityModal {...makeProps({ action: null })} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });
});
