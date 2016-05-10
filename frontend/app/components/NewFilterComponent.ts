import CompoundFilter = require("../filters/CompoundFilter");
import {Filter} from "../filters/Filter";
import {assertHas} from "../utils/assert";
import {FilterIndexSearchResult} from "../services/FilterIndex";
import {filterIndex} from "../services/FilterIndex";
import {KnockoutComponent} from "../base/KnockoutComponent";
import {AutocompleteService} from "../services/AutocompleteService";

@KnockoutComponent('new-filter', {
    template: { fromUrl: 'new-filter.html' },
})
export class NewFilterComponent {
    parentFilter: CompoundFilter;
    query = '';

    /** This observable property is used by the template to focus the text box
     * when the component is created.
     */
    focused = true;
    autocomplete: AutocompleteService<FilterIndexSearchResult>;

    constructor(params:any) {
        assertHas(params, ['parentFilter']);
        this.parentFilter = params.parentFilter;

        // Knockout loses the this binding when invoking click callbacks
        this.addFilterFromSearchResult = this.addFilterFromSearchResult.bind(this);
        this.handleSearchResultMouseDown = this.handleSearchResultMouseDown.bind(this);

        this.autocomplete = new AutocompleteService({
            koQuery: ko.computed(() => this.query),
            searchFn: (query: string) => {
                if (query != '') {
                    return Promise.resolve(filterIndex.search(query));
                } else {
                    return Promise.resolve(filterIndex.returnAll());
                }
            },
            rankingFn: (suggestion) => suggestion.score,
            keyFn: (suggestion) => suggestion.match.filterClass,
            suggestionClickedFn: this.addFilterFromSearchResult,
            maxSuggestions: 100,
        });

        ko.track(this);
    }

    addFilterFromSearchResult(searchResult: FilterIndexSearchResult) {
        const filterClass = <any>searchResult.match.filterClass;
        this.parentFilter.children.push(<Filter>new filterClass());
        this.query = '';
    }

    handleSearchResultMouseDown(searchResult: FilterIndexSearchResult,
                                event: MouseEvent) {
        if (event.button == 0) {
            this.addFilterFromSearchResult(searchResult);
        }
    }

    dispose() {
        ko.untrack(this);
    }
}