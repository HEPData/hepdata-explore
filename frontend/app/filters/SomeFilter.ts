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

        return {
            "bool": {
                "should": usableChildren.map((child: Filter) =>
                    child.toElasticQuery()),
                // An empty SomeFilter will allow any table
                "minimum_should_match": (usableChildren.length > 0 ? 1 : 0),
            }
        }
    }

    filterTable(table: PublicationTable): boolean {
        // Accept the data point if any children filter matches of there are no children
        if (this.children.length == 0) {
            return true;
        }
        for (let childFilter of this.children) {
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