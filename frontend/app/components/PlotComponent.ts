import {Plot} from "../visualization/Plot";
import {assertHas} from "../utils/assert";
import TableCache = require("../services/TableCache");
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {bind} from "../decorators/bind";
import {app} from "../AppViewModel";
import {observable} from "../decorators/observable";

@KnockoutComponent('hep-plot', {
    template: { fromUrl: 'plot.html' },
})
export class PlotComponent {
    @observable()
    plot: Plot;
    @observable()
    tableCache: TableCache;

    constructor(params: any) {
        assertHas(params, [
            {name: 'plot', type: Plot},
            {name: 'tableCache', type: TableCache},
        ]);

        this.plot = params.plot;
        this.tableCache = ko.unwrap(params.tableCache);
    }
    
    @bind()
    showEditPlot() {
        app.showEditPlotDialog(this.plot);
    }
}
