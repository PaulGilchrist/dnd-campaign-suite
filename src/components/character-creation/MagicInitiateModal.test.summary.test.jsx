import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';
import { renderMarkdown } from '../../services/ui/sanitize.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

describe('MagicInitiateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(renderMarkdown).mockReturnValue('<p>mocked</p>');
  });

  describe('summary rendering', () => {
    it('should render an empty instances list when there are no instances', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);

      expect(screen.queryByText(/Instance \d+/)).not.toBeInTheDocument();
      expect(screen.queryByText('Save All')).not.toBeInTheDocument();
    });

    it('should show instance numbers and class names in summary', () => {
      const existingInstances = [
        { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' },
        { class: 'Bard', cantrips: ['Dancing Lights', 'Guidance'], level1Spell: 'Bless' },
      ];
      const props = createProps({
        formData: { magicInitiateInstances: existingInstances, spells: [] },
      });
      render(<MagicInitiateModal {...props} />);

      expect(screen.getByText('Instance 1: Wizard')).toBeInTheDocument();
      expect(screen.getByText('Instance 2: Bard')).toBeInTheDocument();
    });

    it('should handle null/empty values in summary with "—" and "No class"', () => {
      const props1 = createProps({
        formData: { magicInitiateInstances: [{ class: 'Wizard', cantrips: ['Acid Splash', null], level1Spell: null }], spells: [] },
      });
      render(<MagicInitiateModal {...props1} />);
      expect(screen.getAllByText('—').length).toBe(2);

      const props2 = createProps({
        formData: { magicInitiateInstances: [{ class: '', cantrips: [null, null], level1Spell: null }], spells: [] },
      });
      render(<MagicInitiateModal {...props2} />);
      expect(screen.getByText('Instance 1: No class')).toBeInTheDocument();
    });

    it('should show Edit button but hide Remove when there is only one instance, and show both when there are multiple', () => {
      const singleContainer = document.createElement('div');
      document.body.appendChild(singleContainer);
      const singleProps = createProps({
        formData: { magicInitiateInstances: [{ class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' }], spells: [] },
      });
      render(<MagicInitiateModal {...singleProps} />, { container: singleContainer });
      const singleEditBtn = Array.from(singleContainer.querySelectorAll('button.mi-edit-btn')).find(b => b.textContent === 'Edit');
      expect(singleEditBtn).toBeInTheDocument();
      expect(singleContainer.querySelector('button.mi-remove-btn')).toBeNull();

      const multiContainer = document.createElement('div');
      document.body.appendChild(multiContainer);
      const multiProps = createProps({
        formData: { magicInitiateInstances: [
          { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' },
          { class: 'Bard', cantrips: ['Dancing Lights', 'Guidance'], level1Spell: 'Bless' },
        ], spells: [] },
      });
      render(<MagicInitiateModal {...multiProps} />, { container: multiContainer });
      expect(multiContainer.querySelectorAll('button.mi-edit-btn').length).toBe(2);
      expect(multiContainer.querySelectorAll('button.mi-remove-btn').length).toBe(2);
    });

    it('should show the selected spells in the summary', () => {
      const existingInstances = [
        { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' },
      ];
      const props = createProps({
        formData: { magicInitiateInstances: existingInstances, spells: [] },
      });
      render(<MagicInitiateModal {...props} />);

      expect(screen.getByText('Acid Splash')).toBeInTheDocument();
      expect(screen.getByText('Chill Touch')).toBeInTheDocument();
      expect(screen.getByText('Burning Hands')).toBeInTheDocument();
    });

    it('should show "Save All" button when there are instances in summary view', () => {
      const existingInstances = [
        { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' },
      ];
      const props = createProps({
        formData: { magicInitiateInstances: existingInstances, spells: [] },
      });
      render(<MagicInitiateModal {...props} />);

      expect(screen.getByRole('button', { name: /Save All/ })).toBeInTheDocument();
      expect(screen.getByText('Add Another Instance')).toBeInTheDocument();
    });
  });
});
