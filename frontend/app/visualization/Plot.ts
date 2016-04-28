import {AxesLayer} from "./AxesLayer";
import TableCache = require("../services/TableCache");
import {PublicationTable} from "../base/dataFormat";
import {RuntimeError} from "../base/errors";
import {PlotLayer} from "./PlotLayer";
import {assertDefined} from "../utils/assert";
import {ScatterLayer} from "./ScatterLayer";

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

    throw new RuntimeError('findColIndex: Variable name not found');
}

export class Plot {
    /** Plot is a pooled class. True if this instance is being used. */
    alive: boolean = false;
    /** An element created to hold several canvas stacked on top of each other. */
    canvasOnion: HTMLDivElement;
    /** Needed to extract data for plots. */
    tableCache: TableCache;

    width: number = 300;
    height: number = 300;
    margins: Margins = {
        top: 10,
        right: 50,
        bottom: 32,
        left: 52
    };

    xVar: string;
    yVars: string[];
    
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

    constructor(tableCache: TableCache) {
        this.tableCache = tableCache;
        this.canvasOnion = document.createElement('div');

        this.scatterLayer = new ScatterLayer(this);
        this.addLayer(this.scatterLayer);
        this.axesLayer = new AxesLayer(this);
        this.addLayer(this.axesLayer);

        ko.track(this, ['alive']);
    }

    private addLayer(layer: PlotLayer) {
        this.canvasOnion.insertBefore(layer.canvas, null);
    }

    spawn(xVar: string, yVars: string[]) {
        this.alive = true;
        this.xVar = xVar;
        this.yVars = yVars;

        this.tablesByYVar = new Map(
            _.map(this.yVars, (yVar): [string, PublicationTable[]] =>
                [yVar, this.tableCache.getTablesWithVariables(xVar, yVar)])
        );

        let allTables: PublicationTable[] = [];
        for (let tables of Array.from(this.tablesByYVar.values())) {
            allTables = allTables.concat(tables);
        }
        this.countTables = allTables.length;
        this.countPublications = _.uniq(_.map(allTables,
            (t: PublicationTable) => t.publication)).length;
        this.calculateMinMax(allTables);

        this.xScale = d3.scale.pow().exponent(.5)
            .domain([this.dataMinX, this.dataMaxX])
            .range([this.margins.left, this.width - this.margins.right]);
        this.yScale = d3.scale.linear()
            .domain([this.dataMinY, this.dataMaxY])
            .range([this.height - this.margins.bottom, this.margins.top]);

        this.axesLayer.clean();
        this.axesLayer.draw();
        
        this.scatterLayer.replaceDataPoints();
        this.scatterLayer.clean();
        this.scatterLayer.draw();
    }

    private calculateMinMax(allTables: PublicationTable[]) {
        let dataMinX = Infinity;
        let dataMinY = Infinity;
        let dataMaxX = -Infinity;
        let dataMaxY = -Infinity;

        for (let yVar of this.yVars) {
            for (let table of allTables) {
                const xCol = findColIndex(this.xVar, table);
                const yCol = findColIndex(yVar, table);
                
                for (let dataPoint of table.data_points) {
                    const x = dataPoint[xCol].value;
                    if (x > dataMaxX) {
                        dataMaxX = x;
                    }
                    if (x < dataMinX) {
                        dataMinX = x;
                    }
                    
                    const y = dataPoint[yCol].value;
                    if (y > dataMaxY) {
                        dataMaxY = y;
                    }
                    if (y < dataMinY) {
                        dataMinY = y;
                    }
                }
            }
        }
        
        this.dataMinX = dataMinX;
        this.dataMinY = dataMinY;
        this.dataMaxX = dataMaxX;
        this.dataMaxY = dataMaxY;
    }

    kill() {
        this.alive = false;
    }
}