import CompoundFilter = require("../filters/CompoundFilter");
import {Filter} from "../filters/Filter";
import {assertHas} from "../utils/assert";
import {FilterIndexSearchResult} from "../services/FilterIndex";
import {filterIndex} from "../services/FilterIndex";
import {KnockoutComponent} from "../base/KnockoutComponent";

@KnockoutComponent('new-filter', {
    template: { fromUrl: 'new-filter.html' },
})
export class NewFilterComponent {
    parentFilter: CompoundFilter;
    query = '';
    private _searchMatches: FilterIndexSearchResult[] = [];

    constructor(params:any) {
        assertHas(params, ['parentFilter']);
        this.parentFilter = params.parentFilter;

        // Knockout loses the this binding when invoking click callbacks
        this.addSelectedFilter = this.addSelectedFilter.bind(this);
        this.addFilterFromSearchResult = this.addFilterFromSearchResult.bind(this);
        this.onSearchResultMouseDown = this.onSearchResultMouseDown.bind(this);

        ko.track(this);
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
        } else {
            return filterIndex.returnAll();
        }
    }

    dispose() {
        ko.untrack(this);
    }
}