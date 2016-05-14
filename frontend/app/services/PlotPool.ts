import {Plot} from "../visualization/Plot";
import TableCache = require("./TableCache");
import {RuntimeError} from "../base/errors";
import {observable} from "../decorators/observable";

class ExhaustedPool extends RuntimeError {
    constructor() {
        super('Exhausted plot pool');
    }
}

export class PlotPool {
    @observable()
    plots: Plot[] = [];
    tableCache: TableCache;
    maxPlots = 6;

    constructor(tableCache: TableCache) {
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
