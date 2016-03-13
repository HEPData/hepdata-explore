///<reference path="CompoundFilter.ts"/>

class AllFilter extends CompoundFilter {
    getLongName() {
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