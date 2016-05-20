import {assertInstance} from "../utils/assert";

export function bind() {
    return function(target: any, propertyKey: string, descriptor: any)
        : PropertyDescriptor
    {
        const fn = <Function>descriptor.value;
        assertInstance(fn, Function);

        // Substitute the function value with a property that returns a bound method.
        // As a side effect, the property is sealed to avoid accidental changes.
        return {
            configurable: false,
            get() {
                var self = this;
                return function() {
                    return fn.apply(self, arguments);
                }
            }
        }
    };
}

/** Example usage */
class MyClass {
    public x = 10;

    @bind()
    printX() {
        console.log(this.x);
    }
}

function test() {
    const instance = new MyClass();
    const method = instance.printX;
    method();
}
// test();