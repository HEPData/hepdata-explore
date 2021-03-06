import CompoundFilter = require("../filters/CompoundFilter");
import {Filter} from "../filters/Filter";
import {assertInstance, assert} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";

@KnockoutComponent('filter-shell', {
    template: { fromUrl: 'filter-shell.html' },
})
export class FilterShellComponent {
    _parentFilter: KnockoutObservable<CompoundFilter>;
    _filter: KnockoutObservable<Filter>;

    get filter(): Filter {
        return this._filter();
    }
    get parentFilter(): CompoundFilter {
        return this._parentFilter();
    }

    constructor(params: {
        filter: Filter;
        parentFilter: CompoundFilter;
    }) {
        this.loadObservableParam(params, 'filter', Filter);
        this.loadObservableParam(params, 'parentFilter', CompoundFilter, false);
    }

    loadObservableParam<T>(params: any, paramName: string, type: T, required: boolean = true) {
        const component = <{[key: string]: Function}>(<any>this);
        const value: any = params[paramName];
        if (required) {
            assert(value != undefined, 'Parameter ' + paramName + ' is missing.');
        }
        if (typeof value == 'function') {
            // The value is a observable, set it.
            component['_' + paramName] = value;
        } else {
            // The value is a raw object, wrap it in a observable
            if (value != undefined) { // undefined/null is OK for optional params
                assertInstance(value, type);
            }
            component['_' + paramName] = ko.computed(() => (value));
        }
    }

    get component() {
        return this.filter.getComponent();
    }

    isRoot() {
        return this.parentFilter == null;
    }

    removeFilter() {
        this.parentFilter.children.remove(this.filter);
    }

    isRemoveAllowed() {
        return !this.isRoot() && this.filter.isRemoveAllowed();
    }
}