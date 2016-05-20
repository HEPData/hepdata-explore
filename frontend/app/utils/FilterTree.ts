import {Filter} from "../filters/Filter";
import CompoundFilter = require("../filters/CompoundFilter");
import {assert, AssertionError} from "./assert";

interface TreeNode {
    filter: Filter;
    parent: Filter|null;
}

export class FilterTree {
    private nodes = new Map<Filter, TreeNode>();

    constructor(rootFilter: Filter) {
        this.exploreFilter(rootFilter, null)
    }

    private exploreFilter(filter: Filter, parent: Filter|null) {
        const node: TreeNode = {
            filter: filter,
            parent: parent,
        };
        this.nodes.set(filter, node);

        if (filter instanceof CompoundFilter) {
            for (let child of filter.children) {
                this.exploreFilter(child, filter);
            }
        }
    }

    public getParentOf(filter: Filter): Filter|null {
        const node = this.nodes.get(filter);
        if (node == null) throw new AssertionError();

        return node.parent;
    }
}