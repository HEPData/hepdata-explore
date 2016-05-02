import Filter = require("./Filter");
import {PublicationTable} from "../base/dataFormat";
import DslParam = require("../base/DslParam");

class CMEnergiesFilter extends Filter {
    constructor(public min: number = null, public max: number = null) {
        super();
        ko.track(this, ['min', 'max']);
    }

    static getLongName() {
        return 'CM Energies filter';
    }

    getDslName() {
        return 'CMEnergies';
    }

    getDslParams() {
        const ret: DslParam[] = [];
        if (this.min != null) {
            ret.push({key: 'min', value: this.min.toString()});
        }
        if (this.max != null) {
            ret.push({key: 'max', value: this.max.toString()});
        }
        return ret;
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