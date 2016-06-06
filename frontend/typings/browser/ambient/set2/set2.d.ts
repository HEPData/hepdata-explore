// Type definitions for Map2
// Project: https://github.com/josephg/set2
// Definitions by: Juan Luis Boya García <https://github.com/ntrrgc>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare class Set2<V1,V2> {
    constructor(data?: [V1,V2][]);
    has(v1: V1, v2: V2): boolean;
    add(v1: V1, v2: V2): this;
    delete(v1: V1, v2: V2): boolean;
    deleteAll(v1: V1): boolean;
    clear(): void;
    forEach(fn: (v1: V1, v2: V2) => any): void;

    [Symbol.iterator](): IterableIterator<[V1,V2]>;
    entries(): IterableIterator<[V1,V2]>
    values(): IterableIterator<[V1,V2]>

    inspect(depth?: number, options?: any): string;
}