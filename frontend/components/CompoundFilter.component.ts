///<reference path="../filters/CompoundFilter.ts"/>

class CompoundFilterComponent {
    filter: KnockoutObservable<CompoundFilter>;
    flagText: KnockoutObservable<String>;
    flagClass: KnockoutObservable<String>;
    flagClasses: KnockoutComputed<String>;

    constructor(params:any) {
        this.filter = ko.observable(params.filter);
        this.flagText = ko.observable(params.flagText);
        this.flagClass = ko.observable(params.flagClass);
        this.flagClasses = ko.computed(() =>
            ['flag', this.flagClass()].join(' '));
    }
}

ko.components.register('compound-filter', {
    viewModel: CompoundFilterComponent,
    template: { fromUrl: 'compound-filter.html' },
});