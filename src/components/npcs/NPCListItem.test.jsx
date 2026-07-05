// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCListItem from './NPCListItem.jsx';

vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({
  npcHasStatBlock: vi.fn(),
}));

vi.mock('../../services/npcs/npcFormUtils.js', () => ({
  getAttitudeStyle: vi.fn((_attitude) => ({
    backgroundColor: '#1b4332',
    color: '#b7e4c7',
    borderColor: '#40916c',
  })),
}));

vi.mock('../common/AvatarImage.jsx', () => ({
  default: ({ name }) => (
    <img
      data-testid="avatar-image"
      alt={`${name} avatar`}
    />
  ),
}));

import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js';

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
  };

  const renderListItem = (npcProps = {}) => {
    const npc = { ...baseNPC, ...npcProps };
    return render(
      <NPCListItem
        npc={npc}
        onEdit={mockOnEdit}
        onAddToInitiative={mockOnAddToInitiative}
      />
    );
  };

  // ── Basic Rendering ───────────────────────────────────────────────

  describe('Basic rendering', () => {
    it('renders NPC name', () => {
      renderListItem();
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    it('renders as a clickable element with accessibility attributes', () => {
      renderListItem();
      const listItem = screen.getByRole('button', { name: 'Edit NPC: Gandalf' });
      expect(listItem).toBeInTheDocument();
      expect(listItem).toHaveClass('ct-list-item');
    });
  });

  // ── Avatar Image ──────────────────────────────────────────────────

  describe('Avatar image', () => {
    it('does not render AvatarImage when no imagePath', () => {
      renderListItem();
      expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
    });

    it('renders AvatarImage with correct alt text when imagePath provided', () => {
      renderListItem({ name: 'Aragorn', imagePath: '/images/aragorn.png' });
      const avatar = screen.getByTestId('avatar-image');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('alt', 'Aragorn avatar');
    });
  });

  // ── Stat Block Badge ──────────────────────────────────────────────

  describe('Stat block badge', () => {
    it('does not render badge when npc has no stat block', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(false);
      renderListItem();
      expect(document.querySelector('.npcs-stat-badge')).not.toBeInTheDocument();
    });

    it('renders badge when npc has stat block', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(true);
      renderListItem({ armorClass: 15 });
      expect(document.querySelector('.npcs-stat-badge')).toBeInTheDocument();
    });
  });

  // ── Attitude Badge ────────────────────────────────────────────────

  describe('Attitude badge', () => {
    it('does not render badge when attitude is empty', () => {
      renderListItem({ attitude: '' });
      expect(document.querySelector('.ct-list-attitude')).not.toBeInTheDocument();
    });

    it('renders badge with attitude text and title when set', () => {
      renderListItem({ attitude: 'positive' });
      const badge = document.querySelector('.ct-list-attitude');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('positive');
      expect(badge).toHaveAttribute('title', 'positive');
    });

    it('applies attitude styles from getAttitudeStyle', () => {
      renderListItem({ attitude: 'positive' });
      const badge = document.querySelector('.ct-list-attitude');
      expect(badge.style.backgroundColor).toBe('rgb(27, 67, 50)');
    });
  });

  // ── Subtitle (Race / ClassRole) ──────────────────────────────────

  describe('Subtitle', () => {
    it('does not render subtitle when race and classRole are empty', () => {
      renderListItem({ race: '', classRole: '' });
      expect(document.querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
    });

    it('renders race and classRole with separator when both are provided', () => {
      renderListItem({ race: 'Elf', classRole: 'Archer' });
      const subtitle = document.querySelector('.npcs-list-subtitle');
      expect(subtitle).toHaveTextContent('Elf');
      expect(subtitle).toHaveTextContent('Archer');
      expect(document.querySelector('.npcs-list-separator')).toBeInTheDocument();
    });

    it.each([
      ['race only', { race: 'Human', classRole: '' }, 'Human'],
      ['classRole only', { race: '', classRole: 'Wizard' }, 'Wizard'],
    ])('renders %s', (_, subProps, expectedText) => {
      renderListItem(subProps);
      const subtitle = document.querySelector('.npcs-list-subtitle');
      expect(subtitle).toBeInTheDocument();
      expect(subtitle).toHaveTextContent(expectedText);
    });
  });

  // ── Tags ──────────────────────────────────────────────────────────

  describe('Tags', () => {
    it('does not render tags when tags is empty', () => {
      renderListItem({ tags: '' });
      expect(document.querySelector('.npcs-list-tags')).not.toBeInTheDocument();
    });

    it('renders tags with icon when tags provided', () => {
      renderListItem({ tags: 'ally, quest-giver' });
      const tagsEl = document.querySelector('.npcs-list-tags');
      expect(tagsEl).toBeInTheDocument();
      expect(tagsEl).toHaveTextContent('ally, quest-giver');
    });
  });

  // ── Add to Initiative Button ──────────────────────────────────────

  describe('Add to Initiative button', () => {
    it('does not render button when npc has no stat block', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(false);
      renderListItem();
      expect(document.querySelector('.npcs-init-btn')).not.toBeInTheDocument();
    });

    it('renders button when npc has stat block', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(true);
      renderListItem({ armorClass: 15 });
      expect(document.querySelector('.npcs-init-btn')).toBeInTheDocument();
    });

    it('calls onAddToInitiative when clicked', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(true);
      renderListItem({ armorClass: 15 });
      const btn = document.querySelector('.npcs-init-btn');
      fireEvent.click(btn);
      expect(mockOnAddToInitiative).toHaveBeenCalledWith({ ...baseNPC, armorClass: 15 });
    });
  });

  // ── Edit Callback ─────────────────────────────────────────────────

  describe('Edit callback', () => {
    it('calls onEdit with the npc object when clicked', () => {
      renderListItem();
      const listItem = screen.getByRole('button', { name: 'Edit NPC: Gandalf' });
      fireEvent.click(listItem);
      expect(mockOnEdit).toHaveBeenCalledWith(baseNPC);
    });
  });

  // ── Keyboard Accessibility ────────────────────────────────────────

  describe('Keyboard accessibility', () => {
    it.each(['Enter', ' '])('calls onEdit on %s key press', (key) => {
      renderListItem();
      const listItem = screen.getByRole('button', { name: 'Edit NPC: Gandalf' });
      fireEvent.keyDown(listItem, { key });
      expect(mockOnEdit).toHaveBeenCalledWith(baseNPC);
    });
  });
});
