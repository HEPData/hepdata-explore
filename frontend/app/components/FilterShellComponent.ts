import CompoundFilter = require("../filters/CompoundFilter");
import {Filter} from "../filters/Filter";
import {assertInstance} from "../utils/assert";
import {KnockoutComponent} from "../base/KnockoutComponent";

@KnockoutComponent('filter-shell', {
    template: { fromUrl: 'filter-shell.html' },
})
export class FilterShellComponent {
    parentFilter: CompoundFilter;
    _filter: KnockoutObservable<Filter>;

    get filter(): Filter {
        return this._filter();
    }

    constructor(params: {
        filter: KnockoutObservable<Filter>;
        parentFilter: CompoundFilter;
    }) {
        if (typeof params.filter == 'function') {
            this._filter = params.filter;
        } else {
            assertInstance(params.filter, Filter);
            this._filter = ko.computed<Filter>(() => (<Filter>(<any>params.filter)));
        }
        this.parentFilter = params.parentFilter;
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