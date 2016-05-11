import {Plot} from "../visualization/Plot";
import {assertHas} from "../utils/assert";
import TableCache = require("../services/TableCache");
import {KnockoutComponent} from "../decorators/KnockoutComponent";

@KnockoutComponent('hep-plot', {
    template: { fromUrl: 'plot.html' },
})
export class PlotComponent {
    plot: Plot;
    tableCache: TableCache;

    constructor(params: any) {
        assertHas(params, [
            {name: 'plot', type: Plot},
            {name: 'tableCache', type: TableCache},
        ]);

        this.plot = params.plot;
        this.tableCache = params.tableCache;
    }
}
