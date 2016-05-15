import {AxesLayer} from "./AxesLayer";
import TableCache = require("../services/TableCache");
import {PublicationTable} from "../base/dataFormat";
import {RuntimeError} from "../base/errors";
import {PlotLayer} from "./PlotLayer";
import {assertDefined} from "../utils/assert";
import {ScatterLayer} from "./ScatterLayer";
import {observable} from "../decorators/observable";

export interface Margins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface ScaleFunction {
    (value: number): number;

    ticks(): number[];
    tickFormat(count?: number, format?: string): (n: number) => string;
}

export function findColIndex(variableName: string, table: PublicationTable) {
    const colIndep = table.indep_vars.findIndex(
        (variable) => variable.name == variableName);
    if (colIndep != -1) {
        return colIndep;
    }

    const colDep = table.dep_vars.findIndex(
        (variable) => variable.name == variableName);
    if (colDep != -1) {
        return table.indep_vars.length + colDep;
    }

    throw new RuntimeError('Variable name not found');
}

export type ScaleType = "lin" | "log";

export function findColIndexOrNull(variableName: string, table: PublicationTable) {
    const colIndep = table.indep_vars.findIndex(
        (variable) => variable.name == variableName);
    if (colIndep != -1) {
        return colIndep;
    }

    const colDep = table.dep_vars.findIndex(
        (variable) => variable.name == variableName);
    if (colDep != -1) {
        return table.indep_vars.length + colDep;
    }

    return null; // Variable name not found
}

/** These properties here:
 * - are configurable by the user
 * - conform the serialized representation of the plot
 * -
 * */
export class PlotConfig {
    /** Non pinned plots may be removed from the interface when search terms are modified. */
    @observable()
    pinned: boolean = false;

    @observable()
    xVar: string = null;
    @observable()
    yVars: string[] = [];

    clone() {
        const c = new PlotConfig();
        c.pinned = this.pinned;
        c.xVar = this.xVar;
        c.yVars = _.clone(this.yVars);
        return c;
    }
}

export class Plot {
    config: PlotConfig;

    /** Plot is a pooled class. True if this instance is being used. */
    @observable()
    alive: boolean = false;

    /** An element created to hold several canvas stacked on top of each other. */
    canvasOnion: HTMLDivElement;
    /** Needed to extract data for plots. */
    tableCache: TableCache;

    width: number = 300;
    height: number = 300;
    margins: Margins = {
        top: 10,
        right: 20,
        bottom: 32,
        left: 40
    };

    @observable()
    xScaleType: ScaleType = null;
    @observable()
    yScaleType: ScaleType = null;
    xScale: ScaleFunction;
    yScale: ScaleFunction;

    tablesByYVar: Map<string, PublicationTable[]>;
    dataMinX: number;
    dataMaxX: number;
    dataMinY: number;
    dataMaxY: number;

    countTables: number;
    countPublications: number;

    axesLayer: AxesLayer;
    scatterLayer: ScatterLayer;

    constructor(tableCache: TableCache, config: PlotConfig = null) {
        this.tableCache = tableCache;
        this.config = config || new PlotConfig();
        this.canvasOnion = document.createElement('div');

        this.scatterLayer = new ScatterLayer(this);
        this.addLayer(this.scatterLayer);
        this.axesLayer = new AxesLayer(this);
        this.addLayer(this.axesLayer);
    }

    clone() {
        return new Plot(this.tableCache, this.config.clone());
    }

    private addLayer(layer: PlotLayer) {
        this.canvasOnion.insertBefore(layer.canvas, null);
    }

    spawn(xVar: string, yVars: string[]): this {
        this.alive = true;
        this.config.xVar = xVar;
        this.config.yVars = yVars;

        this.tablesByYVar = new Map(
            _.map(this.config.yVars, (yVar): [string, PublicationTable[]] =>
                [yVar, this.tableCache.getTablesWithVariables(xVar, yVar)])
        );

        this.loadTables();
        return this;
    }

    public chooseScale(minValue: number, maxValue: number): ScaleType {
        if (Math.abs(maxValue / minValue) > 10) {
            return 'log';
        } else {
            return 'lin';
        }
    }

    public d3Scale(scaleType: ScaleType) {
        if (scaleType == 'lin') {
            return d3.scale.linear();
        } else {
            return d3.scale.pow().exponent(.5);
        }
    }

    public loadTables() {
        // Collect all tables having data going to be plotted
        let allTables: PublicationTable[] = [];
        for (let tables of Array.from(this.tablesByYVar.values())) {
            allTables = allTables.concat(tables);
        }
        this.countTables = allTables.length;
        this.countPublications = _.uniq(_.map(allTables,
            (t: PublicationTable) => t.publication)).length;
        this.calculateMinMax(allTables);

        this.xScaleType = this.chooseScale(this.dataMinX, this.dataMaxX);
        this.xScale = this.d3Scale(this.xScaleType)
            .domain([this.dataMinX, this.dataMaxX])
            .range([this.margins.left, this.width - this.margins.right]);

        this.yScaleType = this.chooseScale(this.dataMinY, this.dataMaxY);
        this.yScale = this.d3Scale(this.yScaleType)
            .domain([this.dataMinY, this.dataMaxY])
            .range([this.height - this.margins.bottom, this.margins.top]);

        this.axesLayer.clean();
        this.axesLayer.draw();

        this.scatterLayer.replaceDataPoints();
        this.scatterLayer.clean();
        this.scatterLayer.draw();
    }

    public isEmpty() {
        return (this.scatterLayer.points.length == 0);
    }

    private calculateMinMax(allTables: PublicationTable[]) {
        let dataMinX = Infinity;
        let dataMaxX = -Infinity;
        let dataMinY = Infinity;
        let dataMaxY = -Infinity;
        
        for (let yVar of this.config.yVars) {
            for (let table of allTables) {
                const xCol = findColIndex(this.config.xVar, table);
                const yCol = findColIndexOrNull(yVar, table);
                if (yCol == null) {
                    // This table does not have this yVar, but may have other y
                    // variables.
                    continue;
                }

                for (let dataPoint of table.data_points) {
                    const x = dataPoint[xCol].value;
                    assertDefined(x);
                    if (isFinite(x) && x > dataMaxX) {
                        dataMaxX = x;
                    }
                    if (isFinite(x) && x < dataMinX) {
                        dataMinX = x;
                    }

                    const y = dataPoint[yCol].value;
                    if (isFinite(y) && y > dataMaxY) {
                        dataMaxY = y;
                    }
                    if (isFinite(y) && y < dataMinY) {
                        dataMinY = y;
                    }
                }
            }
        }

        this.dataMinX = dataMinX;
        this.dataMaxX = dataMaxX;
        this.dataMinY = dataMinY;
        this.dataMaxY = dataMaxY;
    }

    kill() {
        this.alive = false;
    }

    getPointCount() {
        return this.scatterLayer.points.length;
    }

    getRange() {
        return this.dataMinX + ' to ' + this.dataMaxX;
    }
}