import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarImage from './AvatarImage';

describe('AvatarImage', () => {
  it('renders image when imagePath is provided', () => {
    render(<AvatarImage name="Test User" imagePath="/avatar.png" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/avatar.png');
    expect(img).toHaveAttribute('alt', 'Test User');
  });

  it('renders initial when no imagePath', () => {
    render(<AvatarImage name="Test User" />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('renders "?" when no name and no imagePath', () => {
    render(<AvatarImage />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders uppercase initial', () => {
    render(<AvatarImage name="lowercase" />);
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('applies size prop to container dimensions', () => {
    const { container } = render(<AvatarImage name="Test" size={100} />);
    const wrapper = container.querySelector('.avatar-wrapper');
    expect(wrapper).toHaveStyle({ width: '100px', height: '100px' });
  });

  it('uses default size of 60', () => {
    const { container } = render(<AvatarImage name="Test" />);
    const wrapper = container.querySelector('.avatar-wrapper');
    expect(wrapper).toHaveStyle({ width: '60px', height: '60px' });
  });

  it('calls onClick when clicked with imagePath', () => {
    const onClick = vi.fn();
    render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Enter key pressed', () => {
    const onClick = vi.fn();
    render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Space key pressed', () => {
    const onClick = vi.fn();
    render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when other key pressed', () => {
    const onClick = vi.fn();
    render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has pointer cursor when onClick is provided', () => {
    const onClick = vi.fn();
    const { container } = render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
    const wrapper = container.querySelector('.avatar-wrapper');
    expect(wrapper).toHaveStyle({ cursor: 'pointer' });
  });

  it('has no cursor when onClick is not provided', () => {
    const { container } = render(<AvatarImage name="Test" imagePath="/avatar.png" />);
    const wrapper = container.querySelector('.avatar-wrapper');
    expect(wrapper).not.toHaveStyle({ cursor: 'pointer' });
  });

  it('has role button when onClick is provided', () => {
    const onClick = vi.fn();
    render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has no role when onClick is not provided', () => {
    render(<AvatarImage name="Test" imagePath="/avatar.png" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom size to initial avatar', () => {
    const { container } = render(<AvatarImage name="Test" size={80} />);
    const wrapper = container.querySelector('.avatar-wrapper');
    expect(wrapper).toHaveStyle({ width: '80px', height: '80px' });
  });
});
