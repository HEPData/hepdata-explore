///<reference path="Filter.ts"/>

abstract class CompoundFilter extends Filter {
    children: KnockoutObservableArray<Filter>;

    constructor(children: Filter[] = null) {
        super();
        this.children = ko.observableArray(children || []);
    }

    getDslItems() {
        return this.children();
    }
}