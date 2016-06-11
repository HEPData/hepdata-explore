import {Filter} from "../filters/Filter";
import {FilterTree} from "./FilterTree";
import {AssertionError} from "./assert";
import SomeFilter = require("../filters/SomeFilter");
import AllFilter = require("../filters/AllFilter");

export function calculateComplementaryFilter(
    excluded: Filter,
    rootFilter: Filter
): Filter
{
    const tree = new FilterTree(rootFilter);

    // Rebuild the filter tree starting from the parent of the excluded filter.
    let parent = tree.getParentOf(excluded);
    // If the parent is a SOME filter, exclude the entire filter.
    while (parent && parent instanceof SomeFilter) {
        excluded = parent;
        parent = tree.getParentOf(excluded);
    }

    if (parent) {
        if (!(parent instanceof AllFilter)) throw new AssertionError();
        const originalAllFilter = parent;
        // Create a new AllFilter without the excluded child
        return new AllFilter(_.filter(originalAllFilter.children,
            (f: Filter) => f !== excluded));
    } else {
        // Reached the root of the tree without finding an AllFilter, return the
        // empty filter.
        return new AllFilter([]);
    }
}

(<any>window).calculateComplementaryFilter = calculateComplementaryFilter;