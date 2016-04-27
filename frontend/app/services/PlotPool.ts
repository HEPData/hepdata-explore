import {Plot} from "../visualization/Plot";
import TableCache = require("./TableCache");

export function ExhaustedPool() {
    this.name = 'ExhaustedPool';
    this.message = 'Exhausted plot pool';
    this.stack = (<any>new Error()).stack;
}
ExhaustedPool.prototype = new Error();

export class PlotPool {
    plots: Plot[];
    tableCache: TableCache;
    maxPlots = 3;

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
