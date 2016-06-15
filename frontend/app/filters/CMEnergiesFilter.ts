import {Filter} from "./Filter";
import {registerFilterClass} from "./filterRegistry";
import {observable} from "../decorators/observable";
import DslParam = require("../base/DslParam");

@registerFilterClass
class CMEnergiesFilter extends Filter {
    @observable()
    min: number|null;

    @observable()
    max: number|null;

    constructor(min: number|null = null, max: number|null = null) {
        super();
        this.min = min;
        this.max = max;
        this.registerSerializableFields(['min', 'max']);
    }

    static getLongName() {
        return 'Center of mass energy';
    }

    toElasticQuery(): any {
        const restrictions: any = [];

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

    getComponent() {
        return {
            name: 'cmenergies-filter',
            params: { filter: this }
        }
    }
}
export = CMEnergiesFilter;