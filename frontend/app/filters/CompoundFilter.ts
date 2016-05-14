import {Filter} from "./Filter";
import {observable} from "../decorators/observable";

abstract class CompoundFilter extends Filter {
    @observable()
    children: Filter[];

    constructor(children: Filter[] = []) {
        super();
        this.registerSerializableFields(['children']);
        this.children = children;
    }

    isRemoveAllowed() {
        return this.children.length == 0;
    }

    getComponent() {
        return {
            name: 'compound-filter',
            params: {
                filter: this,
            }
        }
    }

    abstract getFlagText(): string;
    abstract getFlagClass(): string;

    public replaceFilter(oldFilter: Filter, newFilter: Filter): boolean {
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            if (child === oldFilter) {
                this.children[i] = newFilter;
                return true;
            } else {
                const foundInsideChild = child.replaceFilter(oldFilter, newFilter);
                if (foundInsideChild) {
                    return true;
                }
            }
        }
        return false;
    }

    public getUsableChildren() {
        return _.filter(this.children, (c: Filter) => c.isUsable());
    }
}
export = CompoundFilter;