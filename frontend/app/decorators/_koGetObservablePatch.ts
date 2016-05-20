export const ComputedProperties = Symbol('ComputedProperties');

/**
 * Annotate the property name in the prototype of the class.
 * Class[ComputedProperties] contains a set of property names that use
 * computedObservable().
 */
export function registerObservable(target: any, propertyKey: string) {
    if (!(ComputedProperties in target)) {
        target[ComputedProperties] = new Set<string>();
    }
    target[ComputedProperties].add(propertyKey);
}

const previousKoGetObservable = ko.getObservable;
// Patch ko.getObservable to initialize missing computed observables.
// Otherwise using ko.getObservable() on a computed observable that has never
// been queried would return null even if it's actually defined.
ko.getObservable = function (obj: any, propertyName: string): KnockoutObservable<any> {
    if (ComputedProperties in obj && obj[ComputedProperties].has(propertyName)) {
        // Invoke the getter so the computed property is initialized if it
        // has not been yet.
        obj[propertyName];
    }
    return previousKoGetObservable.apply(this, arguments);
};