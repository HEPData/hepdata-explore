// Type definitions for Map2
// Project: https://github.com/josephg/map2
// Definitions by: Alicia Boya García <https://github.com/ntrrgc>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare class Map2<K1,K2,V> {
    constructor(data?: [K1,K2,V][]);
    get(k1: K1, k2: K2): V;
    has(k1: K1, k2: K2): boolean;
    set(k1: K1, k2: K2, v: V): this;
    delete(k1: K1, k2: K2): boolean;
    clear(): void;
    forEach(fn: (v: V, k1: K1, k2: K2) => any): void;
    
    [Symbol.iterator](): IterableIterator<[K1,K2,V]>;
    entries(): IterableIterator<[K1,K2,V]>
    keys(): IterableIterator<[K1,K2]>
    values(): IterableIterator<V>
    
    inspect(depth?: number, options?: any): string;
}