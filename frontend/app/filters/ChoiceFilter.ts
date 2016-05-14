import {DataPoint, PublicationTable} from "../base/dataFormat";
import {Filter} from "./Filter";
import {observable} from "../decorators/observable";

class ChoiceFilter extends Filter {
    @observable()
    public field: string;
    @observable()
    public value: any;
    
    constructor(field: string = '', value = '') {
        super();
        this.field = field;
        this.value = value;
        this.registerSerializableFields(['field', 'value']);
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