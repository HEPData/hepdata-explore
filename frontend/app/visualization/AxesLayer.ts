import {PlotLayer} from "./PlotLayer";
import {Plot} from "./Plot";

export class AxesLayer extends PlotLayer {
    ctx: CanvasRenderingContext2D;

    constructor(plot: Plot) {
        super(plot);
        this.ctx = this.canvas.getContext('2d');
    }

    clean() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        const ctx = this.ctx;
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';

        const margin = this.plot.margins;
        const W = this.plot.width, H = this.plot.height;
        const w = this.plot.width - margin.left - margin.right;
        const h = this.plot.height - margin.top - margin.bottom;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Adjust to pixel boundaries
        ctx.save();
        ctx.translate(-0.5, 0.5);

        ctx.strokeStyle = '#000000';
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, H - margin.bottom);
        ctx.lineTo(W - margin.right, H - margin.bottom);
        ctx.stroke();

        const tickFormat = this.plot.xScale.tickFormat();

        ctx.font = '8px sans';

        // Draw X ticks
        let pastTickEnd = null;
        for (let tickValue of this.plot.xScale.ticks()) {
            const tickXRelPosition = this.plot.xScale(tickValue);
            const tickX = Math.round(margin.left + w * tickXRelPosition);

            ctx.moveTo(tickX, H - margin.bottom);
            ctx.lineTo(tickX, H - margin.bottom + 5);
            ctx.stroke();

            const textW = ctx.measureText(tickFormat(tickValue)).width;
            const textX = tickX - textW / 2;

            // There must be a margin of at least 1px between the end of the
            // previous tick label and the start of the current one.
            if (pastTickEnd === null || textX - textW / 2 - pastTickEnd > 1) {
                ctx.fillText(tickFormat(tickValue), textX,
                    H - margin.bottom + 14);

                pastTickEnd = textX + textW / 2;
            }
        }

        // Draw Y ticks
        for (let tickValue of this.plot.yScale.ticks()) {
            const tickYRelPosition = this.plot.yScale(tickValue);
            const tickY = Math.round(margin.top + h * (1 - tickYRelPosition));

            ctx.moveTo(margin.left, tickY);
            ctx.lineTo(margin.left - 5, tickY);
            ctx.stroke();

            const textW = ctx.measureText(tickFormat(tickValue)).width;
            ctx.fillText(tickFormat(tickValue), margin.left - 8 - textW,
                tickY + 3);
        }

        ctx.restore();

        // draw X label
        {
            const axisXCenter = margin.left + (w / 2);
            const textW = ctx.measureText(this.plot.xVar).width;
            ctx.font = '14px sans';
            ctx.fillText(this.plot.xVar, axisXCenter - textW / 2, margin.top + h + 30);
        }

        // draw Y label
        if (this.plot.yVars.length == 1) {
            const yVar = this.plot.yVars[0];

            const axisYCenter = margin.top + (h / 2);
            const textW = ctx.measureText(yVar).width;
            const textH = 12; // approximately

            ctx.save();
            ctx.translate(margin.left - 32, axisYCenter);
            ctx.rotate(-Math.PI / 2);

            ctx.fillText(yVar, -textW / 2, -textH / 2);

            ctx.restore();
        }
    }
}