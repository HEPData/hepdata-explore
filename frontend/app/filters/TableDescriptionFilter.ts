import DslParam = require("../base/DslParam");
import {Filter} from "./Filter";
import {registerFilterClass} from "./filterRegistry";
import {observable} from "../decorators/observable";

@registerFilterClass
export class TableDescriptionFilter extends Filter {
    @observable()
    value: string|null;

    @observable()
    mode: 'match'|'regex';

    constructor(value: string|null = null, mode: 'match'|'regex' = 'match') {
        super();
        this.value = value;
        this.mode = mode;
        this.registerSerializableFields(['value', 'mode']);
    }

    static getLongName() {
        return 'Table description';
    }

    toElasticQuery(): any {
        if (this.value != null && this.value != '') {
            const field = (this.mode == 'match' ? 'description'
                : 'description_not_analyzed');

            return {
                [this.mode]: {
                    ["tables." + field]: this.value,
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