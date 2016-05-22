import {PublicationTable} from "../base/dataFormat";
import DslParam = require("../base/DslParam");
import {Filter} from "./Filter";
import {registerFilterClass} from "./filterRegistry";
import {observable} from "../decorators/observable";

@registerFilterClass
export class TableDescriptionFilter extends Filter {
    @observable()
    value: string|null;

    constructor(value: string|null = null) {
        super();
        this.value = value;
        this.registerSerializableFields(['value']);
    }

    static getLongName() {
        return 'Table comment';
    }

    toElasticQuery(): any {
        if (this.value != null && this.value != '') {
            return {
                "match": {
                    "tables.description": this.value,
                },
            };
        } else {
            // dummy catch-all filter
            return {"bool": {must: []}};
        }
    }

    getComponent() {
        return {
            name: 'hep-table-description',
            params: { filter: this }
        }
    }
}