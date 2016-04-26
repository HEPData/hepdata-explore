import {PlotLayer} from "./PlotLayer";

export class AxesLayer extends PlotLayer {
    ctx: CanvasRenderingContext2D;

    bootstrap() {
        this.ctx = this.canvas.getContext('2d');
    }

    clean() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        
    }
}