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
        return {
            "bool": {
                "should": _.map(this.children, (child: Filter) => child.toElasticQuery()),
                "minimum_should_match": 1,
            }
        }
    }

    filterTable(table: PublicationTable): boolean {
        // Accept the data point if any children filter matches of there are no children
        if (this.children.length == 0) {
            return true;
        }
        for (let childFilter of this.children) {
            if (childFilter.filterTable(table) == true) {
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