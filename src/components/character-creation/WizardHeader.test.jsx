// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardHeader from './WizardHeader.jsx';

const createProps = (overrides = {}) => ({
  title: 'Create New Character',
  onClose: vi.fn(),
  ...overrides,
});

describe('WizardHeader', () => {
  it('renders the title prop as the header heading', () => {
    const props = createProps({ title: 'Edit Character' });
    render(<WizardHeader {...props} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Edit Character' })).toBeInTheDocument();
  });

  it('routes the × close button click to onClose exactly once', () => {
    const props = createProps();
    render(<WizardHeader {...props} />);
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
