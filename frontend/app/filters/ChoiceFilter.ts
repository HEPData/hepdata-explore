import {DataPoint, PublicationTable} from "../base/dataFormat";
import {Filter} from "./Filter";

class ChoiceFilter extends Filter {
    constructor(public field: string = '', public value = '') {
        super();
        this.registerSerializableFields(['field', 'value']);
        ko.track(this);
    }

    static getLongName() {
        return 'Choice filter';
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