class KeywordFilterComponent {
    filter: KnockoutObservable<KeywordFilter>;

    constructor(params:any) {
        this.filter = ko.observable(params.filter);
    }
}

ko.components.register('keyword-filter-body', {
    viewModel: KeywordFilterComponent,
    template: { fromUrl: 'keyword-filter.html' },
});