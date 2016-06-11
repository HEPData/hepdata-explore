import CompoundFilter = require("./CompoundFilter");
import {DataPoint, PublicationTable} from "../base/dataFormat";
import {Filter} from "./Filter";
import {registerFilterClass} from "./filterRegistry";

@registerFilterClass
class SomeFilter extends CompoundFilter {
    static getLongName() {
        return 'Some matching';
    }
    toElasticQuery(): any {
        const usableChildren = this.getUsableChildren();

        if (usableChildren.length > 0) {
            // When the SomeFilter has children (the usual case), it should
            // return a should filter
            return {
                "bool": {
                    "should": usableChildren.map((child: Filter) =>
                        child.toElasticQuery()),
                    "minimum_should_match": 1,
                }
            }
        } else {
            // An empty SomeFilter will allow any table.
            // Return a dummy filter that matches anything.
            return {
                "bool": {
                    "must": []
                }
            }
        }
    }

    filterTable(table: PublicationTable): boolean {
        const usableChildren = this.getUsableChildren();

        // Accept the data point if any children filter matches of there are no children
        if (usableChildren.length == 0) {
            return true;
        }
        for (let childFilter of usableChildren) {
            if (childFilter.isUsable() && childFilter.filterTable(table) == true) {
                return true;
            }
        }
        return false;
    }

    getFlagText() {
        return 'Some';
    }
    getFlagClass() {
        return 'some';
    }
}
export = SomeFilter;