export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// Fisher-Yates shuffle (in-place) driven by the seeded rng. Seeded generators
// must shuffle with this, never `arr.sort(() => rng() - 0.5)`: a random
// comparator makes the number of rng draws per shuffle an implementation
// detail of Array.prototype.sort (engine version and even V8 JIT tier), so the
// same seed produces different maps across environments and can flip
// mid-session (Room-Adjacent bug, 2026-11-12). Fisher-Yates consumes exactly
// arr.length - 1 draws regardless of engine.
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
