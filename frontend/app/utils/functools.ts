interface Iterable<T> {
    [Symbol.iterator]: () => IterableIterator<T>
}

export function map<V,Z>(iterable: Iterable<V>, callback: (value: V, index: number) => Z): Z[] {
    const ret: Z[] = [];
    let i = 0;
    for (let value of iterable) {
        ret.push(callback(value, i));
        i += 1;
    }
    return ret;
}

export function *imap<V,Z>(iterable: Iterable<V>, callback: (value: V, index: number) => Z): IterableIterator<Z> {
    let i = 0;
    for (let value of iterable) {
        yield callback(value, i);
        i += 1;
    }
}

export function sum(iterable: Iterable<number>): number;
export function sum<V>(iterable: Iterable<V>, callback: (value: V) => number): number;
export function sum<V>(iterable: Iterable<V>, callback?: (value: any) => number): number {
    if (!callback) {
        callback = (v) => v;
    }
    
    let ret = 0;
    for (let value of iterable) {
        ret += callback(value);
    }
    return ret;
}

export function union<T>(lists: Iterable<Iterable<T>>): T[] {
    return _.union.apply(_, map(lists, (list) => Array.from(list)));
}

export function* range(limit: number) {
    for (let i = 0; i < limit; i++) {
        yield i;
    }
}

export function* filter<T>(list: Iterable<T>, conditionFn: (val: T) => boolean): Iterable<T> {
    for (let item of list) {
        if (conditionFn(item)) {
            yield item;
        }
    }
}

export function groupBy<K,V>(list: Iterable<V>, keyFn: (value: V) => K): Map<K,V[]> {
    const ret = new Map<K,V[]>();
    for (let value of list) {
        const key = keyFn(value);
        if (!ret.has(key)) {
            ret.set(key, []);
        }

        ret.get(key)!.push(value);
    }
    return ret;
}

export function* enumerate<T>(list: Iterable<T>, startFrom = 0): Iterable<[number, T]> {
    let counter = startFrom;
    for (let item of list) {
        yield [counter, item];
        counter++;
    }
}

function test() {
    interface Point {
        x: number;
        y: number;
    }

    var myMap = new Map<string, Point>([
        ['objectA', {x: 2, y: 10}],
        ['objectB', {x: 20, y: 5}],
    ]);

    console.log(map(myMap, ([name, point]) => `${name} ${point.x}`));
    // ["objectA 2", "objectB 20"]

    console.log(sum(imap(myMap, ([k,v]) => v.x)));
    // 22

    console.log(sum([2, 3]))
    // 5

    for (let [name, distanceFromCenter] of imap(myMap, ([k, v]): [string, number] =>
                                                [k, Math.sqrt(v.x * v.x + v.y * v.y)])) {
        console.log(`${name} is ${distanceFromCenter.toFixed(2)} away from center.`);
    }
    // objectA is 10.20 away from center.
    // objectB is 20.62 away from center.
}

// test();