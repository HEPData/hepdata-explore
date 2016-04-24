import Filter = require("./Filter");
import {DataPoint, PublicationTable} from "../base/dataFormat";

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
                ["tables." + this.field]: this.value,
            }
        }
    }

    filterTable(table: PublicationTable): boolean {
        return table[this.field] == this.value;
    }

    getComponent() {
        return {
            name: 'choice-filter',
            params: { filter: this }
        }
    }
}
export = ChoiceFilter;