import CompoundFilter = require("../filters/CompoundFilter");

class CompoundFilterComponent {
    filter: CompoundFilter;
    flagText: String;
    flagClass: String;

    constructor(params:any) {
        this.filter = params.filter;
        this.flagText = params.flagText;
        this.flagClass = params.flagClass;
    }

    get flagClasses() {
        return ['flag', this.flagClass].join(' ');
    }
}

ko.components.register('compound-filter', {
    viewModel: CompoundFilterComponent,
    template: { fromUrl: 'compound-filter.html' },
});

export = CompoundFilterComponent;