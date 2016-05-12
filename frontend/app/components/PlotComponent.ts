import {Plot} from "../visualization/Plot";
import {assertHas} from "../utils/assert";
import TableCache = require("../services/TableCache");
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {bind} from "../decorators/bind";
import {app} from "../AppViewModel";

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
        // params arrive as observables, which are transformed into properties
        // by ko.track()
        ko.track(this);
    }
    
    @bind()
    showEditPlot() {
        app.showEditPlotDialog(this.plot);
    }
}
