import ChoiceFilter = require("../filters/ChoiceFilter");
import {elastic} from "../services/Elastic";
import {AutocompleteService} from "../services/AutocompleteService";
import CMEnergiesFilter = require("../filters/CMEnergiesFilter");
import {floatEquals} from "../utils/floatEquals";

class CMEnergiesFilterComponent {
    filter: CMEnergiesFilter;

    minTyped: string = '10.5';
    maxTyped: string = '';

    protected _disposables: KnockoutSubscription[] = [];

    constructor(params: any) {
        this.filter = params.filter;
        ko.track(this, ['filter', 'minTyped', 'maxTyped']);

        this.linkNumber('minTyped', 'min');
        this.linkNumber('maxTyped', 'max');
    }

    linkNumber(componentField: string, filterField: string) {
        // Two way binding
        const updateComponent = (filterValue: number) => {
            if (filterValue == null && this[componentField] != '') {
                this[componentField] = '';
            } else if (filterValue != null && !floatEquals(parseFloat(this[componentField]), filterValue)) {
                this[componentField] = filterValue.toFixed(1);
            }
        };

        const filterToComponent = ko.getObservable(this.filter, filterField)
            .subscribe(updateComponent);

        const componentToFilter = ko.getObservable(this, componentField).subscribe(
            (typedValue: string) => {
                const numberValue = parseFloat(typedValue);
                if (!isNaN(numberValue) && !floatEquals(numberValue, this.filter[filterField])) {
                    this.filter[filterField] = numberValue;
                } else if (typedValue == '') {
                    this.filter[filterField] = null;
                }
            }
        );

        updateComponent(this.filter[filterField]);
        this._disposables.push(filterToComponent);
        this._disposables.push(componentToFilter);
    }

    dispose() {
        for (let disposable of this._disposables) {
            disposable.dispose();
        }
        ko.untrack(this);
    }
}

ko.components.register('cmenergies-filter', {
    viewModel: CMEnergiesFilterComponent,
    template: {fromUrl: 'cmenergies-filter.html'},
});

export = CMEnergiesFilterComponent;