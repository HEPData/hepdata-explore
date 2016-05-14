import {RuntimeError} from "../base/errors";
export function observable() {
    return function(target: any, propertyKey: string): any
    {
        // Substitute the property in the prototype with a "proxy" property that
        // the first time it's read or written instantiates an observable and
        // sets it as a property in the instance, overriding the aforementioned
        // proxy prototype.
        return {
            enumerable: true,
            configurable: true,
            get() {
                throw new RuntimeError("Observable property read before assigned.");
            },
            set(value: any) {
                // We create the observable property in two steps.
                // First, we create a POJO property in the instance, initialized
                // to undefined.
                Object.defineProperty(this, propertyKey, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: undefined,
                });
                // Then we use ko.track() to turn it into a Knockout ES5 observable
                ko.track(this, [propertyKey]);
                // Finally we return what the new property returns (therefore
                // we are calling the observable, which is important to keep
                // ko.computed() observables working.
                return (this[propertyKey] = value);
            }
        }
    };
}

/** Example usage */
class MyClass {
    @observable()
    public x = 1;

    constructor() {
        console.log(this.x); // 1
    }
}

function test() {
    const instance = new MyClass();
    instance.x = 10;
    ko.getObservable(instance, 'x').subscribe((x) => {
        console.log(x);
    });

    instance.x = 2;
}
// test();
