import CompoundFilter = require("./CompoundFilter");
import Filter = require("./Filter");

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