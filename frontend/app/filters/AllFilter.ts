import CompoundFilter = require("./CompoundFilter");
import Filter = require("./Filter");

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