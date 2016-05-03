import {Filter} from "./Filter";

abstract class CompoundFilter extends Filter {
    children: Filter[];

    constructor(children: Filter[] = null) {
        super();
        this.registerSerializableFields(['children']);
        this.children = children || [];
        ko.track(this);
    }

    isRemoveAllowed() {
        return this.children.length == 0;
    }
}
export = CompoundFilter;