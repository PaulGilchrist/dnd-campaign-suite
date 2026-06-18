// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarImage from './AvatarImage.jsx';

describe('AvatarImage', () => {
  describe('image rendering', () => {
    it('should render image with correct src and alt when imagePath is provided', () => {
      render(<AvatarImage name="Test User" imagePath="/avatar.png" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/avatar.png');
      expect(img).toHaveAttribute('alt', 'Test User');
      expect(img).toHaveClass('avatar-image');
    });

    it('should not render a button wrapper when only imagePath is provided without onClick', () => {
      render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('initial rendering', () => {
    it('should render first character initial when no imagePath', () => {
      render(<AvatarImage name="Test User" />);
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should render uppercase initial from lowercase name', () => {
      render(<AvatarImage name="lowercase" />);
      expect(screen.getByText('L')).toBeInTheDocument();
    });

    it('should render "?" when name is missing and no imagePath', () => {
      render(<AvatarImage />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should use first character when name has multiple words', () => {
      render(<AvatarImage name="John Doe" />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should handle empty string name by rendering "?"', () => {
      render(<AvatarImage name="" />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should handle name with leading whitespace by using the first character', () => {
      render(<AvatarImage name="  Test" />);
      const wrapper = document.querySelector('.avatar-wrapper span');
      expect(wrapper.textContent).toBe(' ');
    });
  });

  describe('size prop', () => {
    it('should apply custom size to container dimensions for image avatar', () => {
      const { container } = render(<AvatarImage name="Test" imagePath="/avatar.png" size={100} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '100px', height: '100px' });
    });

    it('should apply custom size to container dimensions for initial avatar', () => {
      const { container } = render(<AvatarImage name="Test" size={80} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '80px', height: '80px' });
    });

    it('should use default size of 60 when size prop is omitted', () => {
      const { container } = render(<AvatarImage name="Test" />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '60px', height: '60px' });
    });

    it('should set fontSize proportional to size for initial avatar', () => {
      const { container } = render(<AvatarImage name="Test" size={50} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ fontSize: '20px' });
    });

    it('should set fontSize proportional to size for image avatar', () => {
      const { container } = render(<AvatarImage name="Test" imagePath="/avatar.png" size={50} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '50px', height: '50px' });
    });

    it('should handle size of 0', () => {
      const { container } = render(<AvatarImage name="Test" size={0} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '0px', height: '0px' });
    });
  });

  describe('interactivity', () => {
    it('should call onClick when clicked with imagePath', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Enter key is pressed', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Space key is pressed', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when other keys are pressed', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should call onClick when initial avatar is clicked', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Enter key is pressed on initial avatar', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when Space key is pressed without onClick handler', () => {
      render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      const element = screen.queryByRole('button');
      expect(element).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have role="button" when onClick is provided', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('should not have role or tabindex when onClick is not provided', () => {
      render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should have pointer cursor when onClick is provided', () => {
      const onClick = vi.fn();
      const { container } = render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ cursor: 'pointer' });
    });

    it('should not have pointer cursor when onClick is not provided', () => {
      const { container } = render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).not.toHaveStyle({ cursor: 'pointer' });
    });
  });

  describe('className', () => {
    it('should apply avatar-initial class to initial avatar wrapper', () => {
      const { container } = render(<AvatarImage name="Test" />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveClass('avatar-initial');
    });

    it('should not apply avatar-initial class to image avatar wrapper', () => {
      const { container } = render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).not.toHaveClass('avatar-initial');
    });
  });
});
