interface Iterable<T> {
    [Symbol.iterator]: () => IterableIterator<T>
}

export function map<V,Z>(iterable: Iterable<V>, callback: (value: V) => Z): Z[] {
    const ret = [];
    for (let value of iterable) {
        ret.push(callback(value));
    }
    return ret;
}

export function *imap<V,Z>(iterable: Iterable<V>, callback: (value: V) => Z): IterableIterator<Z> {
    for (let value of iterable) {
        yield callback(value);
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