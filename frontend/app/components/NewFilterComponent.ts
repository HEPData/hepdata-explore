import CompoundFilter = require("../filters/CompoundFilter");
import Filter = require("../filters/Filter");
import {assertHas} from "../utils/assert";
import {FilterIndexSearchResult} from "../services/FilterIndex";
import {filterIndex} from "../services/FilterIndex";

class NewFilterComponent {
    parentFilter: CompoundFilter;
    query = '';
    queryFocused: KnockoutObservable<boolean>;
    private _searchMatches: FilterIndexSearchResult[] = [];

    constructor(params:any) {
        assertHas(params, ['parentFilter']);
        this.parentFilter = params.parentFilter;

        // Knockout loses the this binding when invoking click callbacks
        this.addSelectedFilter = this.addSelectedFilter.bind(this);
        this.addThisFilter = this.addThisFilter.bind(this);

        ko.track(this);
        this.queryFocused = ko.observable(false);
    }

    addSelectedFilter() {
        if (this._searchMatches.length > 0) {
            this.addThisFilter(this._searchMatches[0]);
        }
    }

    addThisFilter(searchResult: FilterIndexSearchResult) {
        const filterClass = <any>searchResult.match.filterClass;
        this.parentFilter.children.push(<Filter>new filterClass());
    }

    search() {
        const matches = filterIndex.search(this.query);
        this._searchMatches = matches;
        return matches;
    }

    getMatches(): FilterIndexSearchResult[] {
        console.log('miau');
        if (this.query != '') {
            return this.search();
        } else if (this.queryFocused()) {
            return filterIndex.returnAll();
        } else {
            return [];
        }
    }
}

ko.components.register('new-filter', {
    viewModel: NewFilterComponent,
    template: { fromUrl: 'new-filter.html' },
});

export = NewFilterComponent;