import { createSseObservers } from './sseObservers.js';

global.fetch = vi.fn();

describe('createSseObservers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return an array of observer objects', () => {
        const observers = createSseObservers('test-campaign');
        expect(Array.isArray(observers)).toBe(true);
        expect(observers.length).toBe(3);
    });

    it('should have a wildcard observer for general broadcast', () => {
        const observers = createSseObservers('test-campaign');
        const events = observers.map(o => o.event);

        expect(events).toContain('*');
    });

    it('should have two wildcard observers (broadcast + modal pauses)', () => {
        const observers = createSseObservers('test-campaign');
        const events = observers.map(o => o.event);

        const wildcardCount = events.filter(e => e === '*').length;
        expect(wildcardCount).toBe(2);
    });

    it('should have a pipeline:resumed observer', () => {
        const observers = createSseObservers('test-campaign');
        const events = observers.map(o => o.event);

        expect(events).toContain('pipeline:resumed');
    });

    it('should broadcast event name via wildcard observer', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const wildcardObserver = observers.find(o => o.event === '*');

        await wildcardObserver.handler({}, { data: { total: 15 } }, 'damage:rolled');

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

    it('should broadcast different event names correctly', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const wildcardObserver = observers.find(o => o.event === '*');

        await wildcardObserver.handler({}, { data: { done: true } }, 'spell:applied');

        const callArg = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callArg.key).toBe('spell:applied');
    });

    it('should POST modal:shown when result has modal property', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const modalObserver = observers.find((o, idx) => o.event === '*' && idx > 0);

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
        const modalObserver = observers.find((o, idx) => o.event === '*' && idx > 0);

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
        const wildcardObserver = observers.find(o => o.event === '*');

        // Should not throw
        await expect(wildcardObserver.handler({}, { data: { total: 10 } }, 'damage:rolled')).resolves.toBeUndefined();
    });

    it('should encode campaign name in URL', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my campaign!');
        const wildcardObserver = observers.find(o => o.event === '*');

        await wildcardObserver.handler({}, { data: { total: 10 } }, 'damage:rolled');

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/campaigns/my%20campaign!/pipeline-event',
            expect.anything()
        );
    });

    it('should skip broadcast when modal is present', async () => {
        const fetchMock = global.fetch;
        fetchMock.mockResolvedValue({ ok: true });

        const observers = createSseObservers('my-campaign');
        const wildcardObserver = observers.find((o, idx) => o.event === '*' && idx === 0);

        await wildcardObserver.handler({}, { modal: true, data: { step: 'test-step' } }, 'damage:rolled');

        // Should not have posted because modal is present
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
