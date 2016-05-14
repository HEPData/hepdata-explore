import {PublicationTable} from "../base/dataFormat";
import DslParam = require("../base/DslParam");
import {Filter} from "./Filter";
import {registerFilterClass} from "./filterRegistry";
import {observable} from "../decorators/observable";

@registerFilterClass
class CMEnergiesFilter extends Filter {
    @observable()
    min: number;

    @observable()
    max: number;

    constructor(min: number = null, max: number = null) {
        super();
        this.min = min;
        this.max = max;
        this.registerSerializableFields(['min', 'max']);
    }

    static getLongName() {
        return 'CM Energies filter';
    }

    toElasticQuery(): any {
        const restrictions = [];

        /*
         Each table defines a range of cmenergies. With this filter we find
         tables whose cmenergies range overlap with the specified filter range.
         */

        /*
         Min filtering, best understood with a drawing:

          |--> ✔   |--> ✔    |--> ✘
          |        |         |
         -+----|CMENERGIES|--+-----
              min        max
          */
        if (this.min != null) {
            restrictions.push({
                range: {
                    'tables.cmenergies_max': { gte: this.min }
                }
            })
        }

        /*
         Max filtering, best understood with a drawing:

        ✘ <--|    ✔ <--|   ✔ <--|
             |         |        |
         ----+-|CMENERGIES|-----+--
              min        max
         */
        if (this.max != null) {
            restrictions.push({
                range: {
                    'tables.cmenergies_min': { lte: this.max }
                }
            })
        }

        return {
            bool: {
                filter: restrictions
            }
        }
    }

    filterTable(table: PublicationTable): boolean {
        return (this.min == null || table.cmenergies_max >= this.min)
            && (this.max != null && table.cmenergies_min <= this.max);
    }

    getComponent() {
        return {
            name: 'cmenergies-filter',
            params: { filter: this }
        }
    }
}
export = CMEnergiesFilter;