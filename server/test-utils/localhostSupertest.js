import http from 'http';
import supertest from 'supertest';

const MAX_BIND_ATTEMPTS = 5;

// Bind a fresh IPv4 listener on an ephemeral port, waiting for the
// 'listening' event before resolving. Passing a still-binding server to
// supertest is unsafe: its serverAddress() sees a null address()
// (host binds resolve asynchronously via getaddrinfo) and calls
// listen(0) again, producing a wildcard IPv6 bind on macOS that
// silently bypasses the IPv4 fix.
function bindIPv4(app, attempt) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.once('error', (err) => {
            server.close(() => {});
            if (err.code === 'EADDRINUSE' && attempt < MAX_BIND_ATTEMPTS) {
                resolve(bindIPv4(app, attempt + 1));
            } else {
                reject(err);
            }
        });
        server.once('listening', () => {
            server.on('error', (err) => console.error('supertest server error:', err.message));
            resolve(server);
        });
        server.listen(0, '127.0.0.1');
    });
}

// Chainable stub: buffers builder calls (.send, .set, ...) until the
// server is listening, then replays them onto a real supertest Test.
function deferredRequest(serverPromise, method, url) {
    const calls = [];
    const stub = new Proxy(function () {}, {
        get(_target, prop) {
            if (prop === 'then') {
                return (onFulfilled, onRejected) => serverPromise.then((server) => {
                    const test = supertest(server)[method](url);
                    for (const [name, args] of calls) test[name](...args);
                    return new Promise((resolve, reject) => {
                        test.then(
                            (res) => { server.close(() => {}); resolve(res); },
                            (err) => { server.close(() => {}); reject(err); }
                        );
                    });
                }).then(onFulfilled, onRejected);
            }
            if (prop === 'catch') {
                return (onRejected) => stub.then(undefined, onRejected);
            }
            if (prop === 'finally') {
                return (onFinally) => stub.then().then(onFinally, (err) => { onFinally(); throw err; });
            }
            return (...args) => {
                calls.push([prop, args]);
                return stub;
            };
        },
    });
    return stub;
}

export function request(app) {
    const serverPromise = bindIPv4(app, 0);
    return new Proxy({}, {
        get(_target, method) {
            if (typeof method !== 'string') return undefined;
            return (url) => deferredRequest(serverPromise, method, url);
        },
    });
}
