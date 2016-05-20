import ChoiceFilter = require("../filters/ChoiceFilter");
import CMEnergiesFilter = require("../filters/CMEnergiesFilter");
import {floatEquals} from "../utils/floatEquals";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {observable} from "../decorators/observable";

@KnockoutComponent('cmenergies-filter', {
    template: {fromUrl: 'cmenergies-filter.html'},
})
export class CMEnergiesFilterComponent {
    @observable()
    filter: CMEnergiesFilter;

    @observable()
    minTyped: string = '10.5';
    @observable()
    maxTyped: string = '';

    /** This observable property is used by the template to focus the text box
     * when the component is created.
     */
    @observable()
    focused = true;

    protected _disposables: KnockoutSubscription[] = [];

    constructor(params: any) {
        this.filter = params.filter;

        this.linkNumber('minTyped', 'min');
        this.linkNumber('maxTyped', 'max');
    }

    linkNumber(componentField: string, filterField: string) {
        const filter = <{[key: string]: number|null}>(<any>this.filter);
        const component = <{[key: string]: string}>(<any>this); 
        
        // Two way binding, with validation
        const updateComponent = (filterValue: number|null) => {
            if (filterValue == null && component[componentField] != '') {
                component[componentField] = '';
            } else if (filterValue != null && !floatEquals(parseFloat(component[componentField]), filterValue)) {
                component[componentField] = filterValue.toFixed(1);
            }
        };

        const filterToComponent = ko.getObservable(filter, filterField)
            .subscribe(updateComponent);

        const componentToFilter = ko.getObservable(this, componentField).subscribe(
            (typedValue: string) => {
                const numberValue = parseFloat(typedValue);
                const oldFilterValue = filter[filterField];
                
                if (typedValue == '') {
                    filter[filterField] = null;
                } else if (!isNaN(numberValue) && oldFilterValue != null
                    && !floatEquals(numberValue, oldFilterValue))
                {
                    filter[filterField] = numberValue;
                }
            }
        );

        updateComponent(filter[filterField]);
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