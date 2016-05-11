import {Filter} from "../filters/Filter";
import {FilterTree} from "./FilterTree";
import SomeFilter = require("../filters/SomeFilter");
import {assertInstance} from "./assert";
import AllFilter = require("../filters/AllFilter");
import {Option,Some,None} from "../base/Option";

export function calculateComplementaryFilter(
    excluded: Filter,
    rootFilter: Filter
): Option<Filter>
{
    const tree = new FilterTree(rootFilter);

    // Rebuild the filter tree starting from the parent of the excluded filter.
    let parent = tree.getParentOf(excluded);
    // If the parent is a SOME filter, exclude the entire filter.
    while (parent.isSet() && parent.get() instanceof SomeFilter) {
        excluded = parent.get();
        parent = tree.getParentOf(excluded);
    }

    if (parent.isSet()) {
        assertInstance(parent.get(), AllFilter);
        const originalAllFilter = <AllFilter>parent.get();
        // Create a new AllFilter without the excluded child
        return new Some(new AllFilter(_.filter(originalAllFilter.children,
            (f: Filter) => f !== excluded)));
    } else {
        // Reached the root of the tree without finding an AllFilter, return the
        // empty filter.
        return new None<Filter>();
    }
}

(<any>window).calculateComplementaryFilter = calculateComplementaryFilter;