///<reference path="../services/FilterIndex.ts"/>
///<reference path="../filters/Filter.ts"/>
///<reference path="../utils/assert.ts"/>

class NewFilterComponent {
    parentFilter: CompoundFilter;
    query = 'logical';
    matches: FilterIndexSearchResult[] = [];

    constructor(params:any) {
        assertHas(params, ['parentFilter']);
        this.parentFilter = params.parentFilter;
        console.log(this.parentFilter);
        ko.track(this);
    }

    addSelectedFilter() {
        if (this.matches.length > 0) {
            this.addThisFilter(this.matches[0]);
        }
    }

    addThisFilter(searchResult: FilterIndexSearchResult) {
        const filterClass = <any>searchResult.match.filterClass;
        this.parentFilter.children.push(<Filter>new filterClass());
    }

    search() {
        const matches = FilterIndexInstance.search(this.query)
        this.matches = matches;
        return matches;
    }
}

ko.components.register('new-filter', {
    viewModel: NewFilterComponent,
    template: { fromUrl: 'new-filter.html' },
});