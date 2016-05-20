import {RuntimeError} from "../base/errors";
import {registerObservable} from "./_koGetObservablePatch";

export function observable() {
    return function(target: any, propertyKey: string): any
    {
        registerObservable(target, propertyKey);

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
                if (ko.isObservable(value)) {
                    throw new RuntimeError("Assigning an observable to another observable is not supported.");
                }

                // We create the observable property in two steps.
                // First, we create a POJO property in the instance, initialized
                // to undefined.
                Object.defineProperty(this, propertyKey, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: value,
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

    @observable()
    public list: string[] = []; // MUST be initialized to an array, otherwise an ordinary
    // ko.observable() would be used instead of a ko.observableArray()

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

    ko.getObservable(instance, 'list').subscribe((list) => {
        console.log(list);
    });
    instance.list = [];
    instance.list.push('a');
    instance.list.push('b');
    instance.list = ['c'];
    instance.list.push('d');
}
// test();
