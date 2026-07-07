import { createSseObservers } from './sseObservers.js';

global.fetch = vi.fn();

describe('createSseObservers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return an array of observer objects', () => {
        const observers = createSseObservers('test-campaign');
        expect(Array.isArray(observers)).toBe(true);
        expect(observers.length).toBeGreaterThan(0);
    });

    it('should have observers for each mapped event', () => {
        const observers = createSseObservers('test-campaign');
        const events = observers.map(o => o.event);

        expect(events).toContain('damage:rolled');
        expect(events).toContain('damage:applied');
        expect(events).toContain('sneak:applied');
        expect(events).toContain('housekeeping:do');
    });

    it('should have a wildcard observer for modal pauses', () => {
        const observers = createSseObservers('test-campaign');
        const events = observers.map(o => o.event);

        expect(events).toContain('*');
    });

    it('should have a pipeline:resumed observer', () => {
        const observers = createSseObservers('test-campaign');
        const events = observers.map(o => o.event);

        expect(events).toContain('pipeline:resumed');
    });

    it('should POST to the correct endpoint for damage:rolled', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const damageObserver = observers.find(o => o.event === 'damage:rolled');

        await damageObserver.handler({}, { data: { total: 15 } });

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/campaigns/my-campaign/pipeline-event',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const callArg = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callArg.key).toBe('damage:rolled');
        expect(callArg.data).toEqual({ data: { total: 15 } });
    });

    it('should POST to the correct endpoint for damage:applied', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const damageObserver = observers.find(o => o.event === 'damage:applied');

        await damageObserver.handler({}, { data: { done: true } });

        const callArg = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callArg.key).toBe('damage:applied');
    });

    it('should POST modal:shown when result has modal property', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const modalObserver = observers.find(o => o.event === '*');

        await modalObserver.handler({}, { modal: true, data: { step: 'test-step' } });

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/campaigns/my-campaign/pipeline-event',
            expect.objectContaining({
                method: 'POST',
            })
        );

        const callArg = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callArg.key).toBe('modal:shown');
    });

    it('should NOT POST modal:shown when result does not have modal property', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const modalObserver = observers.find(o => o.event === '*');

        await modalObserver.handler({}, { data: { total: 10 } });

        // The damage:rolled observer also fires, so we check that modal:shown was NOT called
        const modalCalls = fetchMock.mock.calls.filter(
            call => {
                const body = JSON.parse(call[1].body);
                return body.key === 'modal:shown';
            }
        );
        expect(modalCalls).toHaveLength(0);
    });

    it('should POST modal:dismissed for pipeline:resumed event', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const resumedObserver = observers.find(o => o.event === 'pipeline:resumed');

        await resumedObserver.handler({}, { data: { step: 'test-step' } });

        const callArg = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callArg.key).toBe('modal:dismissed');
    });

    it('should handle fetch errors silently', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockRejectedValue(new Error('Network error'));

        const observers = createSseObservers('my-campaign');
        const damageObserver = observers.find(o => o.event === 'damage:rolled');

        // Should not throw
        await expect(damageObserver.handler({}, { data: { total: 10 } })).resolves.toBeUndefined();
    });

    it('should encode campaign name in URL', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my campaign!');
        const damageObserver = observers.find(o => o.event === 'damage:rolled');

        await damageObserver.handler({}, { data: { total: 10 } });

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/campaigns/my%20campaign!/pipeline-event',
            expect.anything()
        );
    });

    it('should include all 20 mapped events', () => {
        const observers = createSseObservers('test-campaign');
        const events = observers.map(o => o.event);

        const requiredEvents = [
            'housekeeping:do',
            'maneuvers:check',
            'maneuvers:handled',
            'cunning:checked',
            'bi:checked',
            'damage:rolled',
            'context:built',
            'sneak:applied',
            'twf:applied',
            'effects:applied',
            'superiority:applied',
            'automation:applied',
            'weapon_hit:applied',
            'n20:applied',
            'celestial:applied',
            'riders:applied',
            'overchannel:self-damage',
            'dmg_type:modified',
            'damage:ready',
            'damage:applied',
        ];

        for (const event of requiredEvents) {
            expect(events).toContain(event);
        }
    });
});
