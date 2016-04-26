import {Plot} from "../visualization/Plot";
import {assertHas} from "../utils/assert";
import TableCache = require("../services/TableCache");

class PlotComponent {
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

    bindCanvasOnion(canvasOnion: HTMLDivElement) {
        this.plot.bootstrap(canvasOnion, this.tableCache);
    }
}

ko.components.register('hep-plot', {
    viewModel: PlotComponent,
    template: { fromUrl: 'plot.html' },
});

export = PlotComponent;