import CompoundFilter = require("./CompoundFilter");
import {PublicationTable} from "../base/dataFormat";
import {Filter} from "./Filter";
import {registerFilterClass} from "./filterRegistry";

@registerFilterClass
class AllFilter extends CompoundFilter {
    static getLongName() {
        return 'All matching';
    }
    toElasticQuery(): any {
        return {
            "bool": {
                "must": _.map(this.getUsableChildren(),
                    (child: Filter) => child.toElasticQuery()),
            }
        }
    }

    filterTable(table: PublicationTable): boolean {
        // Accept the data point if it matches all the children filters
        for (let childFilter of this.children) {
            if (childFilter.isUsable() && childFilter.filterTable(table) == false) {
                return false;
            }
        }
        return true;
    }
    
    getFlagText() {
        return 'All';
    }
    getFlagClass() {
        return 'all';
    }
}
export = AllFilter;