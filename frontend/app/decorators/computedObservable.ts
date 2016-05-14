import {observable} from "./observable";
import {assertInstance} from "../utils/assert";

const ComputedProperties = Symbol('ComputedProperties');

export function computedObservable() {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor): any
    {
        const fn = descriptor.get;
        assertInstance(fn, Function);

        // Annotate the property name in the prototype of the class.
        // Class[ComputedProperties] contains a set of property names that use
        // computedObservable().
        if (!(ComputedProperties in target)) {
            target[ComputedProperties] = new Set<string>();
        }
        target[ComputedProperties].add(propertyKey);

        return {
            enumerable: true,
            configurable: false,
            get() {
                Object.defineProperty(this, propertyKey, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: ko.computed(fn, this),
                });
                ko.track(this, [propertyKey]);
                return this[propertyKey];
            },
        }
    };
}

const previousKoGetObservable = ko.getObservable;
// Patch ko.getObservable to initialize missing computed observables.
// Otherwise using ko.getObservable() on a computed observable that has never
// been queried would return null even if it's actually defined.
ko.getObservable = function (obj: Object, propertyName: string): KnockoutObservable<any> {
    if (ComputedProperties in obj && obj[ComputedProperties].has(propertyName)) {
        // Invoke the getter so the computed property is initialized if it
        // has not been yet.
        obj[propertyName];
    }
    return previousKoGetObservable.apply(this, arguments);
};

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
