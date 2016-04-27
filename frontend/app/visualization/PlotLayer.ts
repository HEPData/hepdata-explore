import {Plot} from "./Plot";

export abstract class PlotLayer {
    public canvas: HTMLCanvasElement;
    constructor(public plot: Plot) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = plot.width;
        this.canvas.height = plot.height;
    }

    abstract clean(): void;
    abstract draw(): void;
}