/**
 * AI Campaign Authoring (plan .opencode/plans/ai-campaign-authoring.md, Phase 1)
 * — minimal JSON Schema validator for the authoring entity schemas.
 *
 * Why hand-rolled: the AI service convention (see ../schemas.js) is fail-closed
 * `{ ok, errors }` validators with plain-English errors a model can act on,
 * with no new dependencies. The entity schemas in ./entitySchemas.js are
 * written as real JSON Schema DATA (subset below) so the exact same object can
 * later drive constrained decoding (json_schema sampling on llama.cpp-family
 * backends) — one source of truth for validation AND generation.
 *
 * Supported keywords (everything the entity schemas use — anything else on a
 * schema node is an AUTHORING BUG and throws loudly at validation time):
 *   type (string or array incl. 'null') · enum · const · pattern
 *   minLength · maxLength · minimum · maximum · minItems · maxItems
 *   properties · required · additionalProperties (false | schema) · items
 *   $ref (sibling-schema substitution — see resolveRef)
 */

const SUPPORTED = new Set([
    'type', 'enum', 'const', 'pattern', 'minLength', 'maxLength',
    'minimum', 'maximum', 'minItems', 'maxItems',
    'properties', 'required', 'additionalProperties', 'items',
    'description', 'default', '$ref',
]);

const TYPE_CHECKS = {
    object: v => v !== null && typeof v === 'object' && !Array.isArray(v),
    array: v => Array.isArray(v),
    string: v => typeof v === 'string',
    integer: v => Number.isInteger(v),
    number: v => typeof v === 'number' && Number.isFinite(v),
    boolean: v => typeof v === 'boolean',
    null: v => v === null,
};

function label(path) {
    return path === '$' ? 'value' : path.replace(/^\$\./, '');
}

/** Resolve '#/name' refs against the root schema map the caller passes down. */
function resolveRef(ref, rootSchemas) {
    const name = ref.replace(/^#\//, '');
    const target = rootSchemas?.[name];
    if (!target) throw new Error(`schema authoring bug: unresolvable $ref '${ref}'`);
    return target;
}

function checkType(value, type, at, errors) {
    const types = Array.isArray(type) ? type : [type];
    if (!types.some(t => (TYPE_CHECKS[t] || (() => false))(value))) {
        errors.push(`${at} must be ${types.map(t => `a ${t}`).join(' or ')}`);
        return false;
    }
    return true;
}

function walk(value, schema, path, errors, ctx) {
    assertSupported(schema, path);
    if (schema.$ref) {
        walk(value, resolveRef(schema.$ref, ctx.schemas), path, errors, ctx);
        return;
    }
    if (schema.type !== undefined && !checkType(value, schema.type, path, errors)) return;
    if (value === null || value === undefined) return;

    checkEnumConst(value, schema, path, errors);
    if (typeof value === 'string') checkString(value, schema, path, errors);
    else if (typeof value === 'number') checkNumber(value, schema, path, errors);
    else if (Array.isArray(value)) checkArray(value, schema, path, errors, ctx);
    else checkObject(value, schema, path, errors, ctx);
}

function assertSupported(schema, path) {
    for (const key of Object.keys(schema)) {
        if (!SUPPORTED.has(key)) {
            throw new Error(`schema authoring bug: unsupported keyword '${key}' at ${path}`);
        }
    }
}

function checkEnumConst(value, schema, path, errors) {
    if (schema.enum !== undefined && !schema.enum.includes(value)) {
        errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
    }
    if (schema.const !== undefined && value !== schema.const) {
        errors.push(`${path} must be ${JSON.stringify(schema.const)}`);
    }
}

function checkString(value, schema, path, errors) {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path} must be ≥${schema.minLength} chars`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${path} must be ≤${schema.maxLength} chars`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match ${schema.pattern}`);
}

function checkNumber(value, schema, path, errors) {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${path} must be ≥${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${path} must be ≤${schema.maximum}`);
}

function checkArray(value, schema, path, errors, ctx) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path} must hold ≥${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path} must hold ≤${schema.maxItems} items`);
    if (schema.items) {
        value.forEach((item, i) => walk(item, schema.items, `${path}[${i}]`, errors, ctx));
    }
}

function checkObject(value, schema, path, errors, ctx) {
    for (const req of schema.required || []) {
        if (value[req] === undefined) errors.push(`${label(path)}.${req} is required`);
    }
    const props = schema.properties || {};
    for (const [key, sub] of Object.entries(props)) {
        if (value[key] !== undefined) walk(value[key], sub, `${path}.${key}`, errors, ctx);
    }
    const ap = schema.additionalProperties;
    if (ap === undefined) return;
    const unknown = Object.keys(value).filter(key => props[key] === undefined);
    if (ap === false) {
        unknown.forEach(key => errors.push(
            `${label(path)} has unknown field '${key}' — not part of this entity's shape (server-owned fields like id/updatedAt are never sent)`
        ));
    } else {
        unknown.forEach(key => walk(value[key], ap, `${path}.${key}`, errors, ctx));
    }
}

/**
 * Validate `value` against `schema`.
 * @param schema JSON Schema (subset above). Schemas may $ref '#/name' against
 *   the `schemas` map passed in (entitySchemas.js validateEntity supplies
 *   ENTITY_SCHEMAS as the resolution root — kept explicit here so this module
 *   has zero imports and no cycle with the schema definitions).
 * @returns {{ ok: boolean, errors: string[] }} — the shared fail-closed shape.
 */
export function validateAgainstSchema(value, schema, { schemas = {} } = {}) {
    const errors = [];
    walk(value, schema, '$', errors, { schemas });
    return { ok: errors.length === 0, errors };
}
