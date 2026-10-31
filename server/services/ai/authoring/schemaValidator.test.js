import { describe, it, expect } from 'vitest';
import { validateAgainstSchema } from './schemaValidator.js';

describe('authoring schemaValidator (JSON Schema subset)', () => {
    it('accepts a fully valid nested object', () => {
        const schema = {
            type: 'object',
            required: ['name'],
            additionalProperties: false,
            properties: {
                name: { type: 'string', minLength: 1, maxLength: 10 },
                size: { type: 'string', enum: ['village', 'town'] },
                influence: { type: 'integer', minimum: 1, maximum: 10 },
                tags: { type: 'array', items: { type: 'string' } },
                links: {
                    type: 'object',
                    properties: { npcs: { type: 'array', items: { type: 'string' } } },
                    additionalProperties: false,
                },
            },
        };
        const res = validateAgainstSchema(
            { name: 'Ironhaven', size: 'town', influence: 3, tags: ['mining'], links: { npcs: ['Marta'] } },
            schema
        );
        expect(res).toEqual({ ok: true, errors: [] });
    });

    it('reports missing required fields and unknown fields (fail closed)', () => {
        const schema = {
            type: 'object',
            required: ['name'],
            additionalProperties: false,
            properties: { name: { type: 'string' } },
        };
        const res = validateAgainstSchema({ id: 'nope', extra: 1 }, schema);
        expect(res.ok).toBe(false);
        expect(res.errors.join('\n')).toMatch(/name is required/);
        expect(res.errors.join('\n')).toMatch(/unknown field 'id'/);
        expect(res.errors.join('\n')).toMatch(/unknown field 'extra'/);
    });

    it('supports union types incl. null', () => {
        const schema = { type: ['integer', 'null'], minimum: 1 };
        expect(validateAgainstSchema(null, schema).ok).toBe(true);
        expect(validateAgainstSchema(7, schema).ok).toBe(true);
        expect(validateAgainstSchema(0, schema).ok).toBe(false);
        expect(validateAgainstSchema('7', schema).ok).toBe(false);
    });

    it('validates enum, const, pattern, and length/bound keywords', () => {
        expect(validateAgainstSchema('x', { enum: ['a', 'b'] }).ok).toBe(false);
        expect(validateAgainstSchema('a', { const: 'a' }).ok).toBe(true);
        expect(validateAgainstSchema('b', { const: 'a' }).ok).toBe(false);
        expect(validateAgainstSchema('Bad Name!', { pattern: '^[a-z0-9-]+$' }).ok).toBe(false);
        expect(validateAgainstSchema('abcdefghijk', { type: 'string', maxLength: 10 }).ok).toBe(false);
        expect(validateAgainstSchema([], { type: 'array', minItems: 1 }).ok).toBe(false);
    });

    it('indexes into arrays and nests dotted paths in error copy', () => {
        const schema = {
            type: 'object',
            properties: { list: { type: 'array', items: { type: 'object', required: ['q'], properties: { q: { type: 'integer' } } } } },
        };
        const res = validateAgainstSchema({ list: [{ q: 1 }, {}] }, schema);
        expect(res.ok).toBe(false);
        expect(res.errors.join('\n')).toMatch(/list\[1\]\.q is required/);
    });

    it('resolves $ref against the supplied root map', () => {
        const schemas = { thing: { type: 'object', required: ['a'], properties: { a: { type: 'string' } }, additionalProperties: false } };
        const res = validateAgainstSchema({ items: [{ a: 'x' }, { b: 'y' }] },
            { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/thing' } } } },
            { schemas });
        expect(res.ok).toBe(false);
        expect(res.errors.join('\n')).toMatch(/unknown field 'b'/);
    });

    it('throws loudly on unsupported keywords (authoring bugs, not silent accepts)', () => {
        expect(() => validateAgainstSchema(1, { type: 'integer', exclusiveMinimum: 0 })).toThrow(/unsupported keyword/);
    });
});
