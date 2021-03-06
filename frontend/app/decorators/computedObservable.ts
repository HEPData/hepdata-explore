import {observable} from "./observable";
import {assertInstance} from "../utils/assert";
import {registerObservable} from "./_koGetObservablePatch";

export interface ComputedObservableOptions {
    pure: boolean;
}

export function computedObservable(options: ComputedObservableOptions = {pure: true}) {
    return function(target: any, propertyKey: string, descriptor: any): any
    {
        const fn = descriptor.get;
        assertInstance(fn, Function);

        registerObservable(target, propertyKey);

        return {
            enumerable: true,
            configurable: false,
            get() {
                Object.defineProperty(this, propertyKey, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: options.pure
                        ? ko.pureComputed(fn, this)
                        : ko.computed(fn, this),
                });
                ko.track(this, [propertyKey]);
                return this[propertyKey];
            },
        }
    };
}

/** Example usage */
class MyClass {
    @observable()
    public x = 1;

    @computedObservable()
    get myComputed() {
        return this.x + 1;
    }
}

function test() {
    const instance = new MyClass();
    // console.log(instance.myComputed);
    ko.getObservable(instance, 'myComputed').subscribe((x) => {
        console.log(x);
    });

    instance.x = 0; // 1
    instance.x = 1; // 2
    console.log(instance.myComputed); // 2
}
// test();
