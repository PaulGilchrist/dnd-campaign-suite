// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCListItem from './NPCListItem.jsx';

vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({
  npcHasStatBlock: vi.fn(),
}));

const attitudeStyles = {
  'deep bonds': { backgroundColor: '#1a472a', color: '#90ee90', borderColor: '#2d6a4f' },
  positive: { backgroundColor: '#1b4332', color: '#b7e4c7', borderColor: '#40916c' },
  neutral: { backgroundColor: '#4a4a4a', color: '#e0e0e0', borderColor: '#6b6b6b' },
  negative: { backgroundColor: '#7b241c', color: '#f4a0a0', borderColor: '#a43330' },
  'extreme opposition': { backgroundColor: '#5c030e', color: '#ff6b6b', borderColor: '#8b0000' },
};

vi.mock('../../services/npcs/npcFormUtils.js', () => ({
  getAttitudeStyle: vi.fn((attitude) => {
    const colors = attitudeStyles[attitude] || attitudeStyles.neutral;
    return {
      backgroundColor: colors.backgroundColor,
      color: colors.color,
      borderColor: colors.borderColor,
    };
  }),
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
    const npc = { name: 'Gandalf', race: '', classRole: '', attitude: '', tags: '', armorClass: undefined, ...npcProps };
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

    it('renders as a clickable list item with accessibility attributes', () => {
      renderListItem();
      const listItem = screen.getByRole('button', { name: 'Edit NPC: Gandalf' });
      expect(listItem).toBeInTheDocument();
      expect(listItem).toHaveAttribute('role', 'button');
      expect(listItem).toHaveAttribute('tabindex', '0');
      expect(listItem).toHaveAttribute('aria-label', 'Edit NPC: Gandalf');
      expect(listItem).toHaveClass('ct-list-item');
    });
  });

  // ── Avatar Image ──────────────────────────────────────────────────

  describe('Avatar image', () => {
    it('does not render AvatarImage when no imagePath', () => {
      renderListItem();
      expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
    });

    it('renders AvatarImage when imagePath provided', () => {
      renderListItem({ imagePath: '/images/gandalf.png' });
      const avatar = screen.getByTestId('avatar-image');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('alt', 'Gandalf avatar');
    });

    it('passes NPC name to AvatarImage alt text', () => {
      renderListItem({ name: 'Aragorn', imagePath: '/images/aragorn.png' });
      const avatar = screen.getByTestId('avatar-image');
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

    it('renders badge with shield icon when npc has stat block', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(true);
      renderListItem({ armorClass: 15 });
      const badge = document.querySelector('.npcs-stat-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('title', 'Has stat block');
      expect(badge.querySelector('i.fa-shield')).toBeInTheDocument();
    });
  });

  // ── Attitude Badge ────────────────────────────────────────────────

  describe('Attitude badge', () => {
    it('does not render badge when attitude is empty', () => {
      renderListItem({ attitude: '' });
      expect(document.querySelector('.ct-list-attitude')).not.toBeInTheDocument();
    });

    it('renders badge with text and title when attitude is set', () => {
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
      expect(badge.style.color).toBe('rgb(183, 228, 199)');
      expect(badge.style.borderColor).toBe('rgb(64, 145, 108)');
    });

    it('defaults to neutral styles for unknown attitude', () => {
      renderListItem({ attitude: 'unknown attitude' });
      const badge = document.querySelector('.ct-list-attitude');
      expect(badge.style.backgroundColor).toBe('rgb(74, 74, 74)');
    });
  });

  // ── Subtitle (Race / ClassRole) ──────────────────────────────────

  describe('Subtitle', () => {
    it('does not render subtitle when race and classRole are empty', () => {
      renderListItem({ race: '', classRole: '' });
      expect(document.querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
    });

    it('renders race only', () => {
      renderListItem({ race: 'Human', classRole: '' });
      const subtitle = document.querySelector('.npcs-list-subtitle');
      expect(subtitle).toBeInTheDocument();
      expect(subtitle).toHaveTextContent('Human');
    });

    it('renders classRole only', () => {
      renderListItem({ race: '', classRole: 'Wizard' });
      const subtitle = document.querySelector('.npcs-list-subtitle');
      expect(subtitle).toBeInTheDocument();
      expect(subtitle).toHaveTextContent('Wizard');
    });

    it('renders race and classRole with separator', () => {
      renderListItem({ race: 'Elf', classRole: 'Archer' });
      const subtitle = document.querySelector('.npcs-list-subtitle');
      expect(subtitle).toHaveTextContent('Elf');
      expect(subtitle).toHaveTextContent('Archer');
      expect(document.querySelector('.npcs-list-separator')).toBeInTheDocument();
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
      expect(tagsEl.querySelector('i.fa-tags')).toBeInTheDocument();
    });
  });

  // ── Add to Initiative Button ──────────────────────────────────────

  describe('Add to Initiative button', () => {
    it('does not render button when npc has no stat block', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(false);
      renderListItem();
      expect(document.querySelector('.npcs-init-btn')).not.toBeInTheDocument();
    });

    it('renders button with icon and title when npc has stat block', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(true);
      renderListItem({ armorClass: 15 });
      const btn = document.querySelector('.npcs-init-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent('Add to Initiative');
      expect(btn).toHaveAttribute('title', 'Add to Initiative');
      expect(btn.querySelector('i.fa-shield-alt')).toBeInTheDocument();
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
    it('calls onEdit when list item is clicked', () => {
      renderListItem();
      const listItem = screen.getByRole('button', { name: 'Edit NPC: Gandalf' });
      fireEvent.click(listItem);
      expect(mockOnEdit).toHaveBeenCalledWith(baseNPC);
    });

    it('calls onEdit with the npc object', () => {
      const npc = { ...baseNPC, name: 'Legolas', race: 'Elf' };
      render(
        <NPCListItem npc={npc} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
      );
      const listItem = screen.getByRole('button', { name: 'Edit NPC: Legolas' });
      fireEvent.click(listItem);
      expect(mockOnEdit).toHaveBeenCalledWith(npc);
    });
  });

  // ── Keyboard Accessibility ────────────────────────────────────────

  describe('Keyboard accessibility', () => {
    it('calls onEdit on Enter key press', () => {
      renderListItem();
      const listItem = screen.getByRole('button', { name: 'Edit NPC: Gandalf' });
      fireEvent.keyDown(listItem, { key: 'Enter' });
      expect(mockOnEdit).toHaveBeenCalledWith(baseNPC);
    });

    it('calls onEdit on Space key press', () => {
      renderListItem();
      const listItem = screen.getByRole('button', { name: 'Edit NPC: Gandalf' });
      fireEvent.keyDown(listItem, { key: ' ' });
      expect(mockOnEdit).toHaveBeenCalledWith(baseNPC);
    });
  });

  // ── Combined Features ─────────────────────────────────────────────

  describe('Combined features', () => {
    it('renders full NPC with all fields populated', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(true);
      const fullNPC = {
        name: 'Gandalf',
        race: 'Human',
        classRole: 'Wizard',
        attitude: 'positive',
        tags: 'ally, quest-giver',
        imagePath: '/images/gandalf.png',
        armorClass: 15,
      };
      render(
        <NPCListItem npc={fullNPC} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
      );
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
      expect(screen.getByText('positive')).toBeInTheDocument();
      expect(document.querySelector('.npcs-list-subtitle')).toHaveTextContent('Human');
      expect(document.querySelector('.npcs-list-subtitle')).toHaveTextContent('Wizard');
      expect(document.querySelector('.npcs-list-tags')).toHaveTextContent('ally, quest-giver');
      expect(screen.getByText('Add to Initiative')).toBeInTheDocument();
      expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
    });

    it('renders NPC with stat block but no other optional fields', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(true);
      const minimalStatBlockNPC = {
        name: 'Goblin',
        armorClass: 12,
      };
      render(
        <NPCListItem npc={minimalStatBlockNPC} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
      );
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(document.querySelector('.npcs-stat-badge')).toBeInTheDocument();
      expect(document.querySelector('.npcs-init-btn')).toBeInTheDocument();
      expect(document.querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
      expect(document.querySelector('.npcs-list-tags')).not.toBeInTheDocument();
      expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
    });

    it('renders NPC with attitude but no stat block', () => {
      vi.mocked(npcHasStatBlock).mockReturnValue(false);
      const npc = { ...baseNPC, attitude: 'negative', tags: 'enemy' };
      render(
        <NPCListItem npc={npc} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
      );
      expect(document.querySelector('.ct-list-attitude')).toBeInTheDocument();
      expect(document.querySelector('.npcs-stat-badge')).not.toBeInTheDocument();
      expect(document.querySelector('.npcs-init-btn')).not.toBeInTheDocument();
    });
  });
});
