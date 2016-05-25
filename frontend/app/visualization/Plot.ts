import {AxesLayer} from "./AxesLayer";
import TableCache = require("../services/TableCache");
import {PublicationTable} from "../base/dataFormat";
import {RuntimeError} from "../base/errors";
import {PlotLayer} from "./PlotLayer";
import {assertDefined, AssertionError, ensure, assert} from "../utils/assert";
import {ScatterLayer} from "./ScatterLayer";
import {observable} from "../decorators/observable";
import {computedObservable} from "../decorators/computedObservable";
import {groupBy, map} from "../utils/map";

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

export function findColIndexOrNull(variableName: string, table: PublicationTable): number|null {
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

export type ScaleType = "lin" | "log";
export type ColorPolicy = 'per-variable' | 'per-table';

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
    xVar: string|null = null;
    @observable()
    yVars: string[] = [];

    @observable()
    colorPolicy: ColorPolicy = 'per-variable';

    clone() {
        const c = new PlotConfig();
        c.pinned = this.pinned;
        c.xVar = this.xVar;
        c.colorPolicy = this.colorPolicy;
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
    xScaleType: ScaleType|null = null;
    @observable()
    yScaleType: ScaleType|null = null;
    xScale: ScaleFunction;
    yScale: ScaleFunction;

    dataMinX: number;
    dataMaxX: number;
    dataMinY: number;
    dataMaxY: number;

    countTables: number;
    countPublications: number;

    axesLayer: AxesLayer;
    scatterLayer: ScatterLayer;

    @observable()
    matchingTables: PublicationTable[];

    @computedObservable()
    private get matchingTablesByPublication() {
        const groups = groupBy(this.matchingTables, (t) => t.publication);
        return map(groups.entries(), ([publication, tables]) => ({
            publication: publication,
            tables: tables,
        }));
    }

    @computedObservable()
    private get _configChanged() {
        this.config.xVar;
        this.config.yVars;
        return ++this._counter;
    }
    private _counter = 0;

    constructor(tableCache: TableCache, config?: PlotConfig) {
        this.tableCache = tableCache;
        this.config = config || new PlotConfig();
        this.canvasOnion = document.createElement('div');

        this.scatterLayer = new ScatterLayer(this);
        this.addLayer(this.scatterLayer);
        this.axesLayer = new AxesLayer(this);
        this.addLayer(this.axesLayer);

        // Listen for config changes.
        ko.getObservable(this, '_configChanged').subscribe(() => {
            if (this.alive) {
                this.loadTables();
            }
        });
    }

    clone() {
        const newPlot = new Plot(this.tableCache, this.config.clone());
        newPlot.alive = true;
        newPlot.loadTables();
        return newPlot;
    }

    private addLayer(layer: PlotLayer) {
        this.canvasOnion.insertBefore(layer.canvas, null!);
    }

    spawn(xVar: string, yVars: string[]): this {
        this.config.xVar = xVar;
        this.config.yVars = yVars;
        this.alive = true;

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
        const xVar = ensure(this.config.xVar);
        const tablesByYVar: Map<string, PublicationTable[]> = new Map(
            _.map(this.config.yVars, (yVar): [string, PublicationTable[]] =>
                [yVar, this.tableCache.getTablesWithVariables(xVar, yVar)])
        );

        // Collect all tables having data going to be plotted
        let matchingTables: PublicationTable[] = [];
        for (let tables of Array.from(tablesByYVar.values())) {
            matchingTables = matchingTables.concat(tables);
        }
        this.matchingTables = matchingTables;
        this.countTables = matchingTables.length;
        this.countPublications = _.uniq(_.map(matchingTables,
            (t: PublicationTable) => t.publication)).length;
        this.calculateMinMax(matchingTables);

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
        const xVar = ensure(this.config.xVar);
        
        for (let yVar of this.config.yVars) {
            for (let table of allTables) {
                const xCol = findColIndex(xVar, table);
                const yCol = findColIndexOrNull(yVar, table);
                if (yCol == null) {
                    // This table does not have this yVar, but may have other y
                    // variables.
                    continue;
                }

                for (let dataPoint of table.data_points) {
                    const x = dataPoint[xCol].value;
                    const y = dataPoint[yCol].value;
                    if (x == null || y == null) {
                        // Skip empty data points
                        continue;
                    }

                    if (isFinite(x) && x > dataMaxX) {
                        dataMaxX = x;
                    }
                    if (isFinite(x) && x < dataMinX) {
                        dataMinX = x;
                    }

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

    private colorScale = d3.scale.category10();
    getLegendColor(table: PublicationTable, yVar: string) {
        if (this.config.colorPolicy == 'per-table') {
            return this.getLegendColorByTable(table);
        } else if (this.config.colorPolicy == 'per-variable') {
            return this.getLegendColorByVariable(yVar);
        } else {
            throw new RuntimeError('Unsupported colorPolicy value');
        }
    }

    getLegendColorByTable(table: PublicationTable) {
        assert(table.table_num != null);
        assert(table.publication.inspire_record != null);
        return this.colorScale(table.table_num + '-' + table.publication.inspire_record);
    }

    getLegendColorByVariable(yVar: string) {
        assert(typeof yVar == 'string');
        return this.colorScale(yVar);
    }
}