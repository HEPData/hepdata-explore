import CompoundFilter = require("./CompoundFilter");
import Filter = require("./Filter");
import {DataPoint} from "../base/dataFormat";

class AllFilter extends CompoundFilter {
    static getLongName() {
        return 'All matching';
    }
    getDslName() {
        return 'All';
    }
    toElasticQuery(): any {
        return {
            "bool": {
                "must": _.map(this.children, (child: Filter) => child.toElasticQuery()),
            }
        }
    }

    filterDataPoint(dataPoint: DataPoint): boolean {
        // Accept the data point if it matches all the children filters
        for (let childFilter of this.children) {
            if (childFilter.filterDataPoint(dataPoint) == false) {
                return false;
            }
        }
        return true;
    }

    getComponent() {
        return {
            name: 'compound-filter',
            params: {
                filter: this,
                flagText: this.getDslName(),
                flagClass: 'all',
            }
        }
    }
}
export = AllFilter;