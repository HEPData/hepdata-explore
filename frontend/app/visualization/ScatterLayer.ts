import {PlotLayer} from "./PlotLayer";
import {Plot, findColIndex, findColIndexOrNull} from "./Plot";

export interface CanvasScatterPoint {
    x: number;
    y: number;
    color: string;
}

export class ScatterLayer extends PlotLayer {
    ctx: CanvasRenderingContext2D;
    points: CanvasScatterPoint[] = [];

    constructor(plot: Plot) {
        super(plot);
        this.ctx = this.canvas.getContext('2d');
    }

    clean() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        const ctx = this.ctx;

        const margin = this.plot.margins;
        const W = this.plot.width, H = this.plot.height;
        const w = this.plot.width - margin.left - margin.right;
        const h = this.plot.height - margin.top - margin.bottom;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(0.5, 0.5);

        // console.log(this.points.length);
        for (let point of this.points) {
            ctx.fillStyle = point.color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.restore();
    }
    
    public replaceDataPoints() {
        const plot = this.plot;
        const xScale = plot.xScale;
        const yScale = plot.yScale;
        const xVar = plot.xVar;
        var colorScale = d3.scale.category10();

        const points = this.points;
        points.length = 0;

        for (let yVar of plot.yVars) {
            const tables = plot.tableCache.getTablesWithVariables(xVar, yVar);
            for (let table of tables) {
                const colX = findColIndex(xVar, table);
                const colY = findColIndexOrNull(yVar, table);
                if (colY == null) {
                    // This table does not have this yVar, but may have other y
                    // variables.
                }
                const color = colorScale(yVar + '-' + table.table_num + '-' + table.publication.inspire_record);

                for (let row of table.data_points) {
                    const point: CanvasScatterPoint = {
                        x: xScale(row[colX].value),
                        y: yScale(row[colY].value),
                        color: color,
                    };
                    points.push(point);
                }
            }
        }
    }
}