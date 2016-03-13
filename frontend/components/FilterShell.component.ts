///<reference path="../filters/Filter.ts"/>

class FilterShellComponent {
    parentFilter: KnockoutObservable<CompoundFilter>;
    filter: KnockoutObservable<Filter>;

    component: KnockoutComputed<ComponentRef>;
    isRoot: KnockoutComputed<boolean>;

    constructor(params: {
        filter: Filter;
        parentFilter: CompoundFilter;
    }) {
        this.filter = ko.observable(ko.unwrap(params.filter));
        this.parentFilter = ko.observable(ko.unwrap(params.parentFilter));

        this.component = ko.computed(() => this.filter().getComponent());
        this.isRoot = ko.computed(() => this.parentFilter() == null);
    }

    removeFilter() {
        this.parentFilter().children.remove(this.filter());
    }
}

ko.components.register('filter-shell', {
    viewModel: FilterShellComponent,
    template: { fromUrl: 'filter-shell.html' },
});