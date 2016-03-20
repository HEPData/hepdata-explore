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
        this.addFilterFromSearchResult = this.addFilterFromSearchResult.bind(this);
        this.onSearchResultMouseDown = this.onSearchResultMouseDown.bind(this);

        ko.track(this);
        this.queryFocused = ko.observable(true);
    }

    addSelectedFilter() {
        if (this._searchMatches.length > 0) {
            this.addFilterFromSearchResult(this._searchMatches[0]);
        }
    }

    addFilterFromSearchResult(searchResult: FilterIndexSearchResult) {
        const filterClass = <any>searchResult.match.filterClass;
        this.parentFilter.children.push(<Filter>new filterClass());
        this.query = '';
    }

    onSearchResultMouseDown(searchResult: FilterIndexSearchResult,
                            event: MouseEvent) {
        if (event.button == 0) {
            this.addFilterFromSearchResult(searchResult);
        }
    }

    search() {
        const matches = filterIndex.search(this.query);
        this._searchMatches = matches;
        return matches;
    }

    getMatches(): FilterIndexSearchResult[] {
        if (this.query != '') {
            return this.search();
        } else if (this.queryFocused()) {
            return filterIndex.returnAll();
        } else {
            return [];
        }
    }

    dispose() {
        ko.untrack(this);
    }
}

ko.components.register('new-filter', {
    viewModel: NewFilterComponent,
    template: { fromUrl: 'new-filter.html' },
});

export = NewFilterComponent;