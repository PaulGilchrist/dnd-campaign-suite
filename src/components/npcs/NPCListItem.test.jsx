// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCListItem from './NPCListItem.jsx';

// Row contract only: the npcHasStatBlock/npcHasAttacks guard matrix is
// covered in src/services/encounters/npcStatBlockUtils.test.js.
describe('NPCListItem', () => {
  const mockOnEdit = vi.fn();
  const mockOnAddToInitiative = vi.fn();

  const baseNPC = {
    name: 'Gandalf',
    race: '',
    classRole: '',
    attitude: '',
    tags: '',
    armorClass: undefined,
    hitPoints: null,
    actions: [],
  };

  const combatReady = {
    armorClass: 15,
    hitPoints: '30',
    actions: [{ name: 'Mace', attack_bonus: '+4' }],
  };

  const renderListItem = (npcProps = {}, extraProps = {}) => {
    const npc = { ...baseNPC, ...npcProps };
    return {
      npc,
      ...render(
        <NPCListItem
          npc={npc}
          onEdit={mockOnEdit}
          onAddToInitiative={mockOnAddToInitiative}
          campaignName="test-campaign"
          {...extraProps}
        />
      ),
    };
  };

  const listItemFor = (name = 'Gandalf') =>
    screen.getByRole('button', { name: `Edit NPC: ${name}` });

  const enabledChip = (name = 'Gandalf') =>
    screen.getByRole('button', { name: `Add ${name} to Initiative` });

  const gatedChip = (name = 'Gandalf') =>
    screen.getByRole('button', {
      name: `Fill in ${name}'s AC and HP (Stats tab) before adding to Initiative`,
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a focusable row button labelled with the NPC name', () => {
    const { container } = renderListItem({ name: 'Aragorn' });
    const button = listItemFor('Aragorn');
    expect(button).toHaveAttribute('aria-label', 'Edit NPC: Aragorn');
    expect(button).toHaveAttribute('tabIndex', '0');
    expect(button.className).toContain('ct-list-item');
    expect(container.querySelector('.ct-list-name')).toHaveTextContent('Aragorn');
  });

  it('renders no avatar element when imagePath is absent', () => {
    const { container } = renderListItem();
    expect(container.querySelector('.avatar-wrapper')).not.toBeInTheDocument();
  });

  it('renders the avatar image with campaign-scoped src and name as alt', () => {
    const { container } = renderListItem({ name: 'Aragorn', imagePath: 'images/aragorn.png' });
    const img = container.querySelector('.avatar-wrapper img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Aragorn');
    expect(img).toHaveAttribute('src', 'campaigns/test-campaign/images/aragorn.png');
  });

  describe('stat block badge and initiative button', () => {
    it('disables the button with a hint and shows no badge while combat stats are missing', () => {
      renderListItem();
      expect(screen.queryByTitle('Has stat block')).not.toBeInTheDocument();
      const button = gatedChip();
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label',
        "Fill in Gandalf's AC and HP (Stats tab) before adding to Initiative");
      expect(button.title).toMatch(/Fill in Gandalf.*AC and HP/);
      expect(screen.queryByText('No attacks')).not.toBeInTheDocument();
    });

    it('shows the stat badge and enables the button once AC and HP are set', () => {
      renderListItem(combatReady);
      expect(screen.getByTitle('Has stat block')).toBeInTheDocument();
      expect(screen.getByTitle('Add Gandalf to Initiative')).toBeEnabled();
      expect(screen.queryByText('No attacks')).not.toBeInTheDocument();
    });

    it('pins the init chip accessible name to its title, dynamically per NPC name', () => {
      const { unmount } = renderListItem(combatReady);
      const chip = enabledChip();
      expect(chip).toHaveAttribute('aria-label', 'Add Gandalf to Initiative');
      expect(chip.getAttribute('aria-label')).toBe(chip.getAttribute('title'));
      expect(screen.getAllByRole('button', { name: 'Add Gandalf to Initiative' })).toHaveLength(1);

      unmount();
      renderListItem({ ...combatReady, name: 'Marta Copperkettle' });
      const marta = enabledChip('Marta Copperkettle');
      expect(marta).toHaveAttribute('aria-label', 'Add Marta Copperkettle to Initiative');
      expect(marta).toBeEnabled();
    });

    it('warns with a no-attacks badge when stats are ready but no usable attack exists', () => {
      renderListItem({ ...combatReady, actions: [] });
      const badge = screen.getByTitle(/Unarmed Strike/);
      expect(badge).toHaveTextContent('No attacks');
    });

    it('calls onAddToInitiative with the npc without triggering onEdit', () => {
      const { npc } = renderListItem(combatReady);
      fireEvent.click(screen.getByTitle('Add Gandalf to Initiative'));
      expect(mockOnAddToInitiative).toHaveBeenCalledWith(npc);
      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });

  it('omits attitude, subtitle, and tags when they are empty', () => {
    const { container } = renderListItem();
    expect(container.querySelector('.ct-list-attitude')).not.toBeInTheDocument();
    expect(container.querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
    expect(container.querySelector('.npcs-list-tags')).not.toBeInTheDocument();
  });

  it('renders the attitude badge with its text as title', () => {
    const { container } = renderListItem({ attitude: 'positive' });
    const badge = container.querySelector('.ct-list-attitude');
    expect(badge).toHaveTextContent('positive');
    expect(badge).toHaveAttribute('title', 'positive');
  });

  it('renders race and classRole in the subtitle, separated only when both are set', () => {
    const { container, unmount } = renderListItem({ race: 'Elf', classRole: 'Archer' });
    const subtitle = container.querySelector('.npcs-list-subtitle');
    expect(subtitle).toHaveTextContent('Elf');
    expect(subtitle).toHaveTextContent('Archer');
    expect(subtitle.querySelector('.npcs-list-separator')).toBeInTheDocument();

    unmount();
    for (const [partial, expected] of [
      [{ race: 'Human', classRole: '' }, 'Human'],
      [{ race: '', classRole: 'Wizard' }, 'Wizard'],
    ]) {
      const { container: singleContainer } = renderListItem(partial);
      const single = singleContainer.querySelector('.npcs-list-subtitle');
      expect(single).toHaveTextContent(expected);
      expect(single.querySelector('.npcs-list-separator')).not.toBeInTheDocument();
    }
  });

  it('renders tags with a tags icon', () => {
    const { container } = renderListItem({ tags: 'ally, quest-giver' });
    const tagsEl = container.querySelector('.npcs-list-tags');
    expect(tagsEl).toHaveTextContent('ally, quest-giver');
    expect(tagsEl.querySelector('i.fa-tags')).toBeInTheDocument();
  });

  describe('edit interaction', () => {
    it('calls onEdit with the npc when the row is clicked', () => {
      const { npc } = renderListItem();
      fireEvent.click(listItemFor());
      expect(mockOnEdit).toHaveBeenCalledWith(npc);
    });

    it.each(['Enter', ' '])('calls onEdit on %s key press', (key) => {
      const { npc } = renderListItem();
      fireEvent.keyDown(listItemFor(), { key });
      expect(mockOnEdit).toHaveBeenCalledWith(npc);
    });

    it('does not call onEdit for other keys', () => {
      renderListItem();
      fireEvent.keyDown(listItemFor(), { key: 'Escape' });
      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });
});
