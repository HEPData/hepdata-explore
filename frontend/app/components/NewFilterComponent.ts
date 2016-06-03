import CompoundFilter = require("../filters/CompoundFilter");
import {Filter} from "../filters/Filter";
import {assertHas} from "../utils/assert";
import {FilterIndexSearchResult} from "../services/FilterIndex";
import {filterIndex} from "../services/FilterIndex";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {AutocompleteService} from "../services/AutocompleteService";
import {bind} from "../decorators/bind";
import {observable} from "../decorators/observable";

@KnockoutComponent('new-filter', {
    template: { fromUrl: 'new-filter.html' },
})
export class NewFilterComponent {
    @observable()
    parentFilter: CompoundFilter;
    @observable()
    query = '';

    /** This observable property is used by the template to focus the text box
     * when the component is created.
     */
    @observable()
    focused = true;
    autocomplete: AutocompleteService<FilterIndexSearchResult>;

    constructor(params:any) {
        assertHas(params, ['parentFilter']);
        this.parentFilter = ko.unwrap(params.parentFilter);

        this.autocomplete = new AutocompleteService({
            koQuery: ko.computed(() => this.query),
            searchFn: (query: string) => {
                if (query != '') {
                    return Promise.resolve(filterIndex.search(query));
                } else {
                    return Promise.resolve(filterIndex.returnAll());
                }
            },
            rankingFn: (suggestion) => -suggestion.score,
            keyFn: (suggestion) => suggestion.match.filterClass,
            suggestionClickedFn: this.addFilterFromSearchResult,
            maxSuggestions: 100,
            acceptWithTabKey: false,
        });
        this.autocomplete.updateSearchResults();
    }

    @bind()
    addFilterFromSearchResult(searchResult: FilterIndexSearchResult) {
        const filterClass = <any>searchResult.match.filterClass;
        this.parentFilter.children.push(<Filter>new filterClass());
        this.query = '';
    }

    @bind()
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