import {Plot, PlotConfig, PlotConfigDump} from "../visualization/Plot";
import TableCache = require("./TableCache");
import {RuntimeError} from "../base/errors";
import {observable} from "../decorators/observable";
import {assert} from "../utils/assert";
import {map} from "../utils/map";

class ExhaustedPool extends RuntimeError {
    constructor() {
        super('Exhausted plot pool');
    }
}

export class PlotPool {
    /** Array of alive plots, in the order they appear in screen. */
    @observable()
    plots: Plot[] = [];

    /** Array of dead plots. */
    freePlots: Plot[] = [];

    tableCache: TableCache;

    constructor(tableCache: TableCache, numPlots = 6) {
        this.tableCache = tableCache;

        for (let i = 0; i < numPlots; i++) {
            this.freePlots.push(new Plot(tableCache));
        }
    }

    spawnPlot() {
        // Reuse a plot from the freePlots array if possible
        const plot = this.freePlots.pop() || new Plot(this.tableCache);

        this.plots.push(plot);

        return plot;
    }

    retirePlot(plot: Plot) {
        assert(this.plots.indexOf(plot) != -1);

        this.plots.remove(plot);
        this.freePlots.push(plot);
    }

    /**
     * Deserializes an array of PlotConfig[] objects into real plots and
     * replaces the pool contents with them.
     */
    loadPlots(plotsConfig: PlotConfigDump[]) {
        this.plots = map(plotsConfig, (config) => new Plot(this.tableCache,
            PlotConfig.load(config)));
    }
}
