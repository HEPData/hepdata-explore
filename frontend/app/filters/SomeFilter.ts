import CompoundFilter = require("./CompoundFilter");
import Filter = require("./Filter");
import {DataPoint} from "../base/dataFormat";

class SomeFilter extends CompoundFilter {
    static getLongName() {
        return 'Some matching';
    }
    getDslName() {
        return 'Some';
    }
    toElasticQuery(): any {
        return {
            "bool": {
                "should": _.map(this.children, (child: Filter) => child.toElasticQuery()),
                "minimum_should_match": 1,
            }
        }
    }

    filterDataPoint(dataPoint: DataPoint): boolean {
        // Accept the data point if any children filter matches of there are no children
        if (this.children.length == 0) {
            return true;
        }
        for (let childFilter of this.children) {
            if (childFilter.filterDataPoint(dataPoint) == true) {
                return true;
            }
        }
        return false;
    }

    getComponent() {
        return {
            name: 'compound-filter',
            params: {
                filter: this,
                flagText: this.getDslName(),
                flagClass: 'some',
            }
        }
    }
}
export = SomeFilter;