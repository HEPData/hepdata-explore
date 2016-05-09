export abstract class Option<T> {
    protected _value: T;

    getOrDefault(defaultValue: T): T {
        return (this._value != null ? this._value : defaultValue);
    }

    isSet(): this is Some<T> {
        return (this._value != null);
    }
}

export class None<T> extends Option<T> {
}

export class Some<T> extends Option<T> {
    constructor(value: T) {
        super();
        this._value = value;
    }
    
    get(): T {
        return this._value;
    }
}

function test1(condition: boolean): Option<number> {
    if (condition) {
        return new Some(5);
    } else {
        return new None<number>();
    }
}

function test2() {
    var val = test1(true);
    // val.get is a compile error here
    if (val.isSet()) {
        console.log(val.get() + 1);
    } else {
        console.log('val is null');
    }
}