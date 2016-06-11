import {Filter} from "../filters/Filter";

/**
 * This module serves debugging purposes.
 * 
 * Filter components may be registered in order to be able to access them
 * from the console by providing a filter object.
 * 
 * For instance, to access the component of the first child of the root filter
 * you would write:
 * 
 *  getFilterComponent(app.rootFilter.children[0]) 
 */

const componentsByFilter = new WeakMap<Filter, any>();

export function registerFilterComponent(filter: Filter, component: any) {
    componentsByFilter.set(filter, component);
}

export function unregisterFilterComponent(filter: Filter) {
    componentsByFilter.delete(filter);
}

export function getFilterComponent(filter: Filter): any|null {
    return componentsByFilter.get(filter);
}

(<any>window).getFilterComponent = getFilterComponent;