import {PlotLayer} from "./PlotLayer";
import {Plot} from "./Plot";

function yottaAndBeyondFormat(normalFormat: (n: number) => string) {
    return (n: number) => {
        const abs = Math.abs(n);
        let ret: string;
        if (abs == 0) {
            ret = '0';
        } else if (abs < 1e24 && (abs == 0 || abs > 1e-24)) {
            // If the absolute value of the exponent is less than 24
            // use normal format (e.g. with SI prefixes, like 30.2M)
            ret = normalFormat(n);
        } else {
            // Use scientific notation (e.g. 2.78e+100)
            ret = n.toExponential(1);
        }
        return ret;
    }
}

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

        // Adjust to pixel boundaries
        ctx.save();
        ctx.translate(-0.5, 0.5);

        ctx.strokeStyle = '#000000';
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, H - margin.bottom);
        ctx.lineTo(W - margin.right, H - margin.bottom);
        ctx.stroke();

        ctx.font = '8px sans';

        // Draw X ticks
        let pastTickEnd = null;
        const xTickFormat = yottaAndBeyondFormat(this.plot.xScale.tickFormat(null, 's'));
        for (let tickValue of this.plot.xScale.ticks()) {
            const tickX = Math.round(this.plot.xScale(tickValue));

            ctx.moveTo(tickX, H - margin.bottom);
            ctx.lineTo(tickX, H - margin.bottom + 5);
            ctx.stroke();

            const textW = ctx.measureText(xTickFormat(tickValue)).width;
            const textX = tickX - textW / 2;

            // There must be a margin of at least 1px between the end of the
            // previous tick label and the start of the current one.
            if (pastTickEnd === null || textX - textW / 2 - pastTickEnd > 1) {
                ctx.fillText(xTickFormat(tickValue), textX,
                    H - margin.bottom + 14);

                pastTickEnd = textX + textW / 2;
            }
        }

        // Draw Y ticks
        const yTickFormat = yottaAndBeyondFormat(this.plot.yScale.tickFormat(null, 's'));
        for (let tickValue of this.plot.yScale.ticks()) {
            const tickY = Math.round(this.plot.yScale(tickValue));

            ctx.moveTo(margin.left, tickY);
            ctx.lineTo(margin.left - 5, tickY);
            ctx.stroke();

            const textW = ctx.measureText(yTickFormat(tickValue)).width;
            ctx.fillText(yTickFormat(tickValue), margin.left - 8 - textW,
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