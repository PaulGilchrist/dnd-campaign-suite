import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HpBar from './HpBar.jsx';

describe('HpBar', () => {
    describe('percentage calculation', () => {
        it.each`
            current  | max     | expectedWidth
            ${10}    | ${20}   | ${'50%'}
            ${7}     | ${20}   | ${'35%'}
            ${30}    | ${20}   | ${'100%'}
            ${-5}    | ${20}   | ${'0%'}
            ${10}    | ${0}    | ${'0%'}
            ${999999}| ${1000000}| ${'99.9999%'}
        `(
            'should calculate width as $expectedWidth for current=$current, max=$max',
            ({ current, max, expectedWidth }) => {
                const { container } = render(<HpBar current={current} max={max} />);
                const fill = container.querySelector('.hp-bar-fill');
                expect(fill).toHaveStyle({ width: expectedWidth });
            },
        );
    });

    describe('color thresholds', () => {
        it.each`
            current  | max    | expectedColor
            ${51}    | ${100} | ${'#2ecc71'}
            ${20}    | ${20}  | ${'#2ecc71'}
            ${26}    | ${100} | ${'#f1c40f'}
            ${50}    | ${100} | ${'#f1c40f'}
            ${25}    | ${100} | ${'#e74c3c'}
            ${0}     | ${20}  | ${'#e74c3c'}
            ${1}     | ${100} | ${'#e74c3c'}
        `(
            'should use color $expectedColor for current=$current, max=$max',
            ({ current, max, expectedColor }) => {
                const { container } = render(<HpBar current={current} max={max} />);
                const fill = container.querySelector('.hp-bar-fill');
                expect(fill).toHaveStyle({ backgroundColor: expectedColor });
            },
        );
    });
});
