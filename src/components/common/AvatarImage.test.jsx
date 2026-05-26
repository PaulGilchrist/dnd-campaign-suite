import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AvatarImage from './AvatarImage.jsx';

describe('AvatarImage', () => {
    describe('with imagePath', () => {
        it('should render an img element with correct src', () => {
            render(<AvatarImage name="Gandalf" imagePath="/images/gandalf.png" />);
            const img = screen.getByRole('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', '/images/gandalf.png');
        });

        it('should render an img element with correct alt text', () => {
            render(<AvatarImage name="Gandalf" imagePath="/images/gandalf.png" />);
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('alt', 'Gandalf');
        });

        it('should render a div with class "avatar-wrapper" around the image', () => {
            const { container } = render(<AvatarImage name="Gandalf" imagePath="/images/gandalf.png" />);
            const wrapper = container.querySelector('.avatar-wrapper');
            expect(wrapper).toBeInTheDocument();
            expect(wrapper.querySelector('img')).toBeInTheDocument();
        });
    });

    describe('without imagePath (initial fallback)', () => {
        it('should render a div with class "avatar-initial" when no imagePath', () => {
            const { container } = render(<AvatarImage name="Gandalf" />);
            const wrapper = container.querySelector('.avatar-wrapper');
            expect(wrapper).toHaveClass('avatar-initial');
        });

        it('should render the first letter of the name as initial', () => {
            render(<AvatarImage name="Gandalf" />);
            expect(screen.getByText('G')).toBeInTheDocument();
        });

        it('should render "G" for name "Gandalf"', () => {
            render(<AvatarImage name="Gandalf" />);
            const initialSpan = screen.getByText('G');
            expect(initialSpan).toBeInTheDocument();
        });

        it('should render "?" for empty name', () => {
            render(<AvatarImage name="" />);
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should render "?" for null name', () => {
            render(<AvatarImage name={null} />);
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should render "?" for undefined name', () => {
            render(<AvatarImage name={undefined} />);
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should uppercase the initial', () => {
            render(<AvatarImage name="gandalf" />);
            expect(screen.getByText('G')).toBeInTheDocument();
        });
    });

    describe('size prop', () => {
        it('should apply default size of 60 when not specified', () => {
            const { container } = render(<AvatarImage name="Gandalf" />);
            const wrapper = container.querySelector('.avatar-wrapper');
            expect(wrapper).toHaveStyle({ width: '60px', height: '60px' });
        });

        it('should apply custom size for width and height', () => {
            const { container } = render(<AvatarImage name="Gandalf" size={100} />);
            const wrapper = container.querySelector('.avatar-wrapper');
            expect(wrapper).toHaveStyle({ width: '100px', height: '100px' });
        });

        it('should set fontSize to size * 0.4 for initial avatar', () => {
            const { container } = render(<AvatarImage name="Gandalf" size={100} />);
            const wrapper = container.querySelector('.avatar-wrapper');
            expect(wrapper).toHaveStyle({ fontSize: '40px' });
        });

        it('should set fontSize to 24px when default size is used', () => {
            const { container } = render(<AvatarImage name="Gandalf" />);
            const wrapper = container.querySelector('.avatar-wrapper');
            expect(wrapper).toHaveStyle({ fontSize: '24px' });
        });

        it('should apply size to image wrapper as well', () => {
            const { container } = render(<AvatarImage name="Gandalf" imagePath="/img.png" size={80} />);
            const wrapper = container.querySelector('.avatar-wrapper');
            expect(wrapper).toHaveStyle({ width: '80px', height: '80px' });
        });
    });
});
