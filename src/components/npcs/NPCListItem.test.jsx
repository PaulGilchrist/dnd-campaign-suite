import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCListItem from './NPCListItem.jsx';

// Simplified mock - verifies presence/absence only, not internal implementation
vi.mock('../common/AvatarImage.jsx', () => ({
  default: vi.fn(({ name }) => (
    <div data-testid="avatar-image">
      <img alt={`${name} avatar`} />
    </div>
  )),
}));

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

  const renderListItem = (npcProps = {}, extraProps = {}) => {
    const npc = { ...baseNPC, ...npcProps };
    return render(
      <NPCListItem
        npc={npc}
        onEdit={mockOnEdit}
        onAddToInitiative={mockOnAddToInitiative}
        campaignName="test-campaign"
        {...extraProps}
      />
    );
  };

  const listItemFor = (name = 'Gandalf') =>
    screen.getByRole('button', { name: `Edit NPC: ${name}` });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── List Element Attributes ───────────────────────────────────────

  describe('List element attributes', () => {
    it('renders with correct role, tabIndex, and aria-label', () => {
      renderListItem();
      const button = listItemFor();
      expect(button).toHaveAttribute('aria-label', 'Edit NPC: Gandalf');
      expect(button).toHaveAttribute('tabIndex', '0');
      expect(button.className).toContain('ct-list-item');
    });

    it('updates aria-label when NPC name changes', () => {
      renderListItem({ name: 'Aragorn' });
      expect(listItemFor('Aragorn')).toHaveAttribute('aria-label', 'Edit NPC: Aragorn');
    });
  });

  // ── Avatar Image ──────────────────────────────────────────────────

  describe('Avatar image', () => {
    it('does not render an avatar when no imagePath is provided', () => {
      renderListItem();
      expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
    });

    it('renders avatar with correct alt text when imagePath is provided', () => {
      renderListItem({ name: 'Aragorn', imagePath: '/images/aragorn.png' });
      const avatar = screen.getByTestId('avatar-image');
      expect(avatar).toBeInTheDocument();
      expect(avatar.querySelector('img')).toHaveAttribute('alt', 'Aragorn avatar');
    });
  });

  // ── Stat Block Badge, Attack Warning, and Initiative Button ──────
  // The badge and the button's enabled state are both controlled by
  // the same npcHasStatBlock(npc) guard (numeric AC + positive HP).

  describe('Stat block badge and initiative button', () => {
    const ready = { armorClass: 15, hitPoints: '30', actions: [{ name: 'Mace', attack_bonus: '+4' }] };

    it('renders the button disabled with a hint when the NPC lacks combat stats', () => {
      renderListItem();
      expect(screen.queryByTitle('Has stat block')).not.toBeInTheDocument();
      const button = screen.getByRole('button', { name: /Add.*to Initiative/ });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', expect.stringContaining('Fill in Gandalf'));
      expect(button.getAttribute('title')).toMatch(/AC and HP/);
    });

    it('renders badge and enabled button when AC and HP are filled in', () => {
      renderListItem(ready);
      expect(screen.getByTitle('Has stat block')).toBeInTheDocument();
      expect(screen.getByTitle('Add Gandalf to Initiative')).toBeEnabled();
    });

    it('does not enable the button for non-numeric armorClass', () => {
      renderListItem({ armorClass: '15', hitPoints: '30' });
      expect(screen.queryByTitle('Has stat block')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add.*to Initiative/ })).toBeDisabled();
    });

    it('does not enable the button when HP is missing or zero', () => {
      for (const hp of [null, '', 0]) {
        const { unmount } = renderListItem({ armorClass: 15, hitPoints: hp });
        expect(screen.getByRole('button', { name: /Add.*to Initiative/ })).toBeDisabled();
        unmount();
      }
    });

    it('warns with a no-attacks badge when stats are ready but no usable attack exists', () => {
      const { unmount } = renderListItem({ armorClass: 15, hitPoints: '30', actions: [] });
      expect(screen.getByTitle(/Unarmed Strike/)).toHaveTextContent('No attacks');

      unmount();
      renderListItem(ready);
      expect(screen.queryByText('No attacks')).not.toBeInTheDocument();
    });

    it('calls onAddToInitiative with the npc when clicked', () => {
      renderListItem(ready);
      fireEvent.click(screen.getByTitle('Add Gandalf to Initiative'));
      expect(mockOnAddToInitiative).toHaveBeenCalledWith({ ...baseNPC, ...ready });
    });
  });

  // ── Attitude Badge ────────────────────────────────────────────────

  describe('Attitude badge', () => {
    it('does not render badge when attitude is empty', () => {
      renderListItem({ attitude: '' });
      expect(listItemFor().querySelector('.ct-list-attitude')).not.toBeInTheDocument();
    });

    it('renders badge with attitude text and title when set', () => {
      renderListItem({ attitude: 'positive' });
      const badge = listItemFor().querySelector('.ct-list-attitude');
      expect(badge).toHaveTextContent('positive');
      expect(badge).toHaveAttribute('title', 'positive');
    });
  });

  // ── Subtitle (Race / ClassRole) ──────────────────────────────────

  describe('Subtitle', () => {
    it('does not render subtitle when race and classRole are empty', () => {
      renderListItem({ race: '', classRole: '' });
      expect(listItemFor().querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
    });

    it('renders race and classRole with separator when both are provided', () => {
      renderListItem({ race: 'Elf', classRole: 'Archer' });
      const subtitle = listItemFor().querySelector('.npcs-list-subtitle');
      expect(subtitle).toHaveTextContent('Elf');
      expect(subtitle).toHaveTextContent('Archer');
      expect(subtitle.querySelector('.npcs-list-separator')).toBeInTheDocument();
    });

    it.each([
      ['race only', { race: 'Human', classRole: '' }, 'Human'],
      ['classRole only', { race: '', classRole: 'Wizard' }, 'Wizard'],
    ])('renders %s without a separator', (_, subProps, expectedText) => {
      renderListItem(subProps);
      const subtitle = listItemFor().querySelector('.npcs-list-subtitle');
      expect(subtitle).toHaveTextContent(expectedText);
      expect(subtitle.querySelector('.npcs-list-separator')).not.toBeInTheDocument();
    });
  });

  // ── Tags ──────────────────────────────────────────────────────────

  describe('Tags', () => {
    it('does not render tags when tags is empty', () => {
      renderListItem({ tags: '' });
      expect(listItemFor().querySelector('.npcs-list-tags')).not.toBeInTheDocument();
    });

    it('renders tags with icon when tags provided', () => {
      renderListItem({ tags: 'ally, quest-giver' });
      const tagsEl = listItemFor().querySelector('.npcs-list-tags');
      expect(tagsEl).toHaveTextContent('ally, quest-giver');
      expect(tagsEl.querySelector('i.fa-solid.fa-tags')).toBeInTheDocument();
    });
  });

  // ── Edit Callback ─────────────────────────────────────────────────

  describe('Edit callback', () => {
    it('calls onEdit with the npc object when clicked', () => {
      renderListItem();
      fireEvent.click(listItemFor());
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Gandalf', race: '', classRole: '', attitude: '', tags: '', armorClass: undefined })
      );
    });
  });

  // ── Keyboard Accessibility ────────────────────────────────────────

  describe('Keyboard accessibility', () => {
    it.each(['Enter', ' '])('calls onEdit on %s key press', (key) => {
      renderListItem();
      fireEvent.keyDown(listItemFor(), { key });
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Gandalf' })
      );
    });

    it('does not call onEdit for other keys', () => {
      renderListItem();
      fireEvent.keyDown(listItemFor(), { key: 'Escape' });
      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });
});
