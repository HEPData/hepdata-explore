///<reference path="Filter.ts"/>

abstract class CompoundFilter extends Filter {
    children: Filter[];

    constructor(children: Filter[] = null) {
        super();
        this.children = children || [];
        ko.track(this);
    }

    getDslItems() {
        return this.children;
    }

    isRemoveAllowed() {
        return this.children.length == 0;
    }
}