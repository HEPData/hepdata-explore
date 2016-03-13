import CompoundFilter = require("./CompoundFilter");

class AllFilter extends CompoundFilter {
    static getLongName() {
        return 'All matching';
    }
    getDslName() {
        return 'All';
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