import {AxesLayer} from "./AxesLayer";
import TableCache = require("../services/TableCache");
import {PublicationTable} from "../base/dataFormat";
import {RuntimeError} from "../base/errors";
import {PlotLayer} from "./PlotLayer";
import {assertDefined} from "../utils/assert";

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

    constructor(tableCache: TableCache) {
        this.tableCache = tableCache;
        this.canvasOnion = document.createElement('div');

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

        this.xScale = d3.scale.pow().exponent(.5).domain([
            this.dataMinX, this.dataMaxX]);
        this.yScale = d3.scale.linear().domain([
            this.dataMinY, this.dataMaxY]);

        this.axesLayer.clean();
        this.axesLayer.draw();
    }

    private calculateMinMax(allTables: PublicationTable[]) {
        let dataMinX = Infinity;
        let dataMinY = Infinity;
        let dataMaxX = -Infinity;
        let dataMaxY = -Infinity;

        for (let yVar of this.yVars) {
            for (let table of allTables) {
                const xCol = this.findColIndex(this.xVar, table);
                const yCol = this.findColIndex(yVar, table);
                
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
    
    private findColIndex(variableName: string, table: PublicationTable) {
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

    kill() {
        this.alive = false;
    }
}