import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';
import { renderMarkdown } from '../../services/ui/sanitize.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

const findSelectByLabel = (labelText) => {
  const label = screen.getByText(new RegExp(`^${labelText}:$`));
  return label.nextElementSibling;
};

describe('MagicInitiateModal - SpellDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(renderMarkdown).mockReturnValue('<p>mocked</p>');
  });

  describe('SpellDetails subcomponent', () => {
    it('should not render spell details toggle when no spell is selected', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      expect(screen.queryByText(/details$/)).not.toBeInTheDocument();
    });

    it('should toggle spell details expanded/collapsed with caret icon', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      fireEvent.click(screen.getByText('Add Another Instance'));
      const classSelect = document.querySelectorAll('.mi-selector-select')[0];
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });
      const level1Select = findSelectByLabel('Level 1 Spell');
      fireEvent.change(level1Select, { target: { value: 'Burning Hands' } });

      const toggleBtn = screen.getByText('Burning Hands details');
      // Initially collapsed - right caret visible, content hidden
      expect(toggleBtn.querySelector('.fa-caret-right')).toBeInTheDocument();
      expect(toggleBtn.querySelector('.fa-caret-down')).not.toBeInTheDocument();
      expect(screen.queryByText('School: Evocation')).not.toBeInTheDocument();

      // Expand
      fireEvent.click(toggleBtn);
      expect(toggleBtn.querySelector('.fa-caret-down')).toBeInTheDocument();
      expect(toggleBtn.querySelector('.fa-caret-right')).not.toBeInTheDocument();
      expect(screen.getByText('School: Evocation')).toBeInTheDocument();

      // Collapse
      fireEvent.click(toggleBtn);
      expect(toggleBtn.querySelector('.fa-caret-right')).toBeInTheDocument();
      expect(screen.queryByText('School: Evocation')).not.toBeInTheDocument();
    });

    it('should render spell school, casting time, and duration in details', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      fireEvent.click(screen.getByText('Add Another Instance'));
      const classSelect = document.querySelectorAll('.mi-selector-select')[0];

      // Wizard - Burning Hands: school, casting 1 action, instantaneous duration
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });
      const level1Select = findSelectByLabel('Level 1 Spell');
      fireEvent.change(level1Select, { target: { value: 'Burning Hands' } });
      fireEvent.click(screen.getByText('Burning Hands details'));
      expect(screen.getByText('School: Evocation')).toBeInTheDocument();
      expect(screen.getByText('Casting: 1 action')).toBeInTheDocument();
      expect(screen.getByText('Duration: Instantaneous')).toBeInTheDocument();

      // Cleric - Bless: concentration duration
      fireEvent.change(classSelect, { target: { value: 'Cleric' } });
      fireEvent.change(level1Select, { target: { value: 'Bless' } });
      fireEvent.click(screen.getByText('Bless details'));
      expect(screen.getByText('Duration: Concentration, up to 1 minute')).toBeInTheDocument();

      // Sorcerer - Expeditious Retreat: bonus action
      fireEvent.change(classSelect, { target: { value: 'Sorcerer' } });
      fireEvent.change(level1Select, { target: { value: 'Expeditious Retreat' } });
      fireEvent.click(screen.getByText('Expeditious Retreat details'));
      expect(screen.getByText('Casting: bonus action')).toBeInTheDocument();

      // Sorcerer - Shield: reaction
      fireEvent.change(level1Select, { target: { value: 'Shield' } });
      fireEvent.click(screen.getByText('Shield details'));
      expect(screen.getByText('Casting: reaction')).toBeInTheDocument();
    });

    it('should conditionally render concentration, components, damage, material, and ritual', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      fireEvent.click(screen.getByText('Add Another Instance'));
      const classSelect = document.querySelectorAll('.mi-selector-select')[0];

      // Wizard - Burning Hands: no concentration, has components, has damage, no material, no ritual
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });
      const level1Select = findSelectByLabel('Level 1 Spell');
      fireEvent.change(level1Select, { target: { value: 'Burning Hands' } });
      fireEvent.click(screen.getByText('Burning Hands details'));
      expect(screen.queryByText('Concentration')).not.toBeInTheDocument();
      expect(screen.getByText('Components: V, S')).toBeInTheDocument();
      expect(screen.getByText('Damage: Fire')).toBeInTheDocument();
      expect(screen.queryAllByText(/Material:/).length).toBe(0);
      expect(screen.queryByText('Ritual')).not.toBeInTheDocument();

      // Cleric - Bless: has concentration, has components, no damage, no material, no ritual
      fireEvent.change(classSelect, { target: { value: 'Cleric' } });
      fireEvent.change(level1Select, { target: { value: 'Bless' } });
      fireEvent.click(screen.getByText('Bless details'));
      expect(screen.getByText('Concentration')).toBeInTheDocument();
      expect(screen.getByText('Components: V, S, M')).toBeInTheDocument();
      expect(screen.queryAllByText(/Damage:/).length).toBe(0);
      expect(screen.queryAllByText(/Material:/).length).toBe(0);
      expect(screen.queryByText('Ritual')).not.toBeInTheDocument();

      // Wizard - Alarm: no concentration, has components, no damage, has material, has ritual
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });
      fireEvent.change(level1Select, { target: { value: 'Alarm' } });
      fireEvent.click(screen.getByText('Alarm details'));
      expect(screen.queryByText('Concentration')).not.toBeInTheDocument();
      expect(screen.getByText(/Material.*bell/)).toBeInTheDocument();
      expect(screen.getByText('Ritual')).toBeInTheDocument();

      // Cleric - Command: no concentration, no components, no damage, no material, no ritual
      fireEvent.change(classSelect, { target: { value: 'Cleric' } });
      fireEvent.change(level1Select, { target: { value: 'Command' } });
      fireEvent.click(screen.getByText('Command details'));
      expect(screen.queryByText('Concentration')).not.toBeInTheDocument();
      expect(screen.queryAllByText(/Components/).length).toBe(0);
      expect(screen.queryAllByText(/Damage:/).length).toBe(0);
      expect(screen.queryAllByText(/Material:/).length).toBe(0);
      expect(screen.queryByText('Ritual')).not.toBeInTheDocument();
    });

    it('should render spell description via renderMarkdown', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      fireEvent.click(screen.getByText('Add Another Instance'));
      const classSelect = document.querySelectorAll('.mi-selector-select')[0];
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });
      const level1Select = findSelectByLabel('Level 1 Spell');
      fireEvent.change(level1Select, { target: { value: 'Burning Hands' } });

      fireEvent.click(screen.getByText('Burning Hands details'));
      // Mock returns '<p>mocked</p>' — verify description renders in DOM
      expect(screen.getByText('mocked')).toBeInTheDocument();
    });

    it('should render details for cantrips too', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      fireEvent.click(screen.getByText('Add Another Instance'));
      const classSelect = document.querySelectorAll('.mi-selector-select')[0];
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });

      const cantrip1Select = findSelectByLabel('Cantrip 1');
      fireEvent.change(cantrip1Select, { target: { value: 'Acid Splash' } });

      expect(screen.getByText('Acid Splash details')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Acid Splash details'));
      expect(screen.getByText('School: Conjuration')).toBeInTheDocument();
    });

    it('should only allow one spell details panel to be expanded at a time', () => {
      const props = createProps();
      render(<MagicInitiateModal {...props} />);
      fireEvent.click(screen.getByText('Add Another Instance'));

      const classSelect = document.querySelectorAll('.mi-selector-select')[0];
      fireEvent.change(classSelect, { target: { value: 'Wizard' } });

      // Select cantrip 1
      const cantrip1Select = findSelectByLabel('Cantrip 1');
      fireEvent.change(cantrip1Select, { target: { value: 'Acid Splash' } });

      // Select cantrip 2
      const cantrip2Select = findSelectByLabel('Cantrip 2');
      fireEvent.change(cantrip2Select, { target: { value: 'Chill Touch' } });

      // Select level 1 spell
      const level1Select = findSelectByLabel('Level 1 Spell');
      fireEvent.change(level1Select, { target: { value: 'Burning Hands' } });

      // Expand Acid Splash
      fireEvent.click(screen.getByText('Acid Splash details'));
      expect(screen.getByText('School: Conjuration')).toBeInTheDocument();
      // Other panels are collapsed
      expect(screen.queryByText('School: Necromancy')).not.toBeInTheDocument();
      expect(screen.queryByText('School: Evocation')).not.toBeInTheDocument();

      // Expand Chill Touch — Acid Splash should collapse
      fireEvent.click(screen.getByText('Chill Touch details'));
      expect(screen.getByText('School: Necromancy')).toBeInTheDocument();
      expect(screen.queryByText('School: Conjuration')).not.toBeInTheDocument();
    });
  });
});
