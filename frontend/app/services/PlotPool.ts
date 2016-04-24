import {Plot} from "../visualization/Plot";

export function ExhaustedPool() {
    this.name = 'ExhaustedPool';
    this.message = 'Exhausted plot pool';
    this.stack = (<any>new Error()).stack;
}
ExhaustedPool.prototype = new Error();

export class PlotPool {
    plots: Plot[];
    maxPlots = 3;

    constructor() {
        this.plots = [];

        for (let i = 0; i < this.maxPlots; i++) {
            this.plots[i] = new Plot;
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
