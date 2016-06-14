import {assert} from "../utils/assert";
import {Filter} from "./Filter";

export interface Constructor<T> {
    new (): T;
}

export const filterRegistry = new Map<string, Constructor<Filter>>();

export function registerFilterClass(constructor: Constructor<Filter>) {
    const className = constructor.name;

    assert(className != 'Filter', 'Must be a concrete class');
    assert(!filterRegistry.has(className), 'Already registered');
    filterRegistry.set(className, constructor);

    // Export the filter for easy programmatic access in the console
    (<any>window)[className] = constructor;
}