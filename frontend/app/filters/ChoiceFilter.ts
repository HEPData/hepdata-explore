import Filter = require("./Filter");
import {DataPoint} from "../base/dataFormat";

class ChoiceFilter extends Filter {
    constructor(public field: string = '', public value = '') {
        super();
        ko.track(this);
    }

    static getLongName() {
        return 'Choice filter';
    }

    getDslName() {
        return 'Choice';
    }

    getDslParams() {
        return [
            {key: this.field, value: this.value},
        ];
    }

    toElasticQuery(): any {
        return {
            "match": {
                ["tables.groups." + this.field]: this.value,
            }
        }
    }

    filterDataPoint(dataPoint: DataPoint): boolean {
        return dataPoint[this.field] == this.value;
    }

    getComponent() {
        return {
            name: 'choice-filter',
            params: { filter: this }
        }
    }
}
export = ChoiceFilter;