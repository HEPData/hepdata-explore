import {Plot} from "../visualization/Plot";
import TableCache = require("./TableCache");
import {RuntimeError} from "../base/errors";

class ExhaustedPool extends RuntimeError {
    constructor() {
        super('Exhausted plot pool');
    }
}

export class PlotPool {
    plots: Plot[];
    tableCache: TableCache;
    maxPlots = 6;

    constructor(tableCache: TableCache) {
        this.plots = [];
        this.tableCache = tableCache;

        for (let i = 0; i < this.maxPlots; i++) {
            this.plots[i] = new Plot(tableCache);
        }
    }

    getFreePlot() {
        for (let plot of this.plots) {
            if (!plot.alive) {
                return plot;
            }
        }
        throw new ExhaustedPool();
    }
}
