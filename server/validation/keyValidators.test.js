// @maintained-by-ai
// aiConfig override shapes (backlog ai-config-ui-clobbers-api-overrides):
// every shape the config-row UI writes must pass the server chokepoint —
// boolean jsonSchema (on/off), numeric temperature (0..2), removal when
// blanked (key absent), plus preservation-safe unknown keys. No 400s, and
// the classic refusals (string jsonSchema, out-of-range temperature) stay
// refused.
import { validateRuntimeWrite } from './keyValidators.js';

// localhost ⇒ authority guard satisfied for engaged (mode !== 'off') writes.
const CTX = { req: { hostname: 'localhost' }, current: {} };
const BASE = { mode: 'suggest', endpoint: 'http://localhost:8000/v1', model: 'm' };
const write = (value) => validateRuntimeWrite('aiConfig', value, CTX);

describe('keyValidators — aiConfig override shapes', () => {
    it('accepts every UI-written shape', () => {
        expect(write(BASE)).toMatchObject({ ok: true }); // untouched save invents nothing
        expect(write({ ...BASE, jsonSchema: true })).toMatchObject({ ok: true }); // decoding "on"
        expect(write({ ...BASE, jsonSchema: false })).toMatchObject({ ok: true }); // decoding "off"
        expect(write({ ...BASE, temperature: 0 })).toMatchObject({ ok: true }); // 0 is legitimate…
        expect(write({ ...BASE, temperature: 0.7 })).toMatchObject({ ok: true });
        expect(write({ ...BASE, temperature: 2 })).toMatchObject({ ok: true }); // …and so is 2
        expect(write({ ...BASE, jsonSchema: true, temperature: 0.3 })).toMatchObject({ ok: true });
        expect(write({ ...BASE, futureKey: 'x' })).toMatchObject({ ok: true }); // merge-preserved unknowns pass
    });

    it('still refuses malformed overrides (no silent acceptance)', () => {
        expect(write({ ...BASE, jsonSchema: 'true' }).ok).toBe(false); // string, not boolean
        expect(write({ ...BASE, temperature: 3 }).ok).toBe(false); // above 0..2
        expect(write({ ...BASE, temperature: '0.7' }).ok).toBe(false); // string, not number
        expect(write({ ...BASE, temperature: NaN }).ok).toBe(false); // unparsable input
        expect(write({ ...BASE, temperature: -0.1 }).ok).toBe(false);
    });

    it('null (Turn AI off) stays a legal write', () => {
        expect(write(null)).toMatchObject({ ok: true });
    });
});
