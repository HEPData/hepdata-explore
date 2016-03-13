import KeywordFilter = require("../filters/KeywordFilter");

class KeywordFilterComponent {
    filter: KeywordFilter;

    constructor(params:any) {
        this.filter = params.filter;
        ko.track(this);
    }
}

ko.components.register('keyword-filter-body', {
    viewModel: KeywordFilterComponent,
    template: { fromUrl: 'keyword-filter.html' },
});

export = KeywordFilterComponent;