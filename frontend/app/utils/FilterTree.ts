import {Filter} from "../filters/Filter";
import {Option,Some,None} from "../base/Option";
import CompoundFilter = require("../filters/CompoundFilter");
import {assert} from "./assert";

interface TreeNode {
    filter: Filter;
    parent: Option<Filter>;
}

export class FilterTree {
    private nodes = new Map<Filter, TreeNode>();

    constructor(rootFilter: Filter) {
        this.exploreFilter(rootFilter, new None<Filter>())
    }

    private exploreFilter(filter: Filter, parent: Option<Filter>) {
        const node: TreeNode = {
            filter: filter,
            parent: parent,
        };
        this.nodes.set(filter, node);

        if (filter instanceof CompoundFilter) {
            for (let child of filter.children) {
                this.exploreFilter(child, new Some(filter));
            }
        }
    }

    public getParentOf(filter: Filter): Option<Filter> {
        const node: TreeNode = this.nodes.get(filter);
        assert(node != null);

        return node.parent;
    }
}