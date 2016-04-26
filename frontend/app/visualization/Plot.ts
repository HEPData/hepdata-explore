import {AxesLayer} from "./AxesLayer";
import TableCache = require("../services/TableCache");
import {PublicationTable} from "../base/dataFormat";
import {RuntimeError} from "../base/errors";

export class Plot {
    alive: boolean = false;
    canvasOnion: HTMLDivElement;
    tableCache: TableCache;

    xVar: string;
    yVars: string[];

    tablesByYVar: Map<string, PublicationTable[]>;
    dataMinX: number;
    dataMaxX: number;
    dataMinY: number;
    dataMaxY: number;

    countTables: number;
    countPublications: number;

    axesLayer: AxesLayer;

    bootstrap(canvasOnion: HTMLDivElement, tableCache: TableCache) {
        this.canvasOnion = canvasOnion;
        this.tableCache = tableCache;

        // this.canvasOnion.insertBefore()
    }

    spawn(xVar: string, yVars: string[]) {
        this.xVar = xVar;
        this.yVars = yVars;

        this.tablesByYVar = new Map(
            _.map(this.yVars, (yVar): [string, PublicationTable[]] =>
                [yVar, this.tableCache.getTablesWithVariables(xVar, yVar)])
        );
        const allTables: PublicationTable[] =
            _.union.apply(_, Array.of(this.tablesByYVar.values()));
        this.countTables = allTables.length;
        this.countPublications = _.uniq(_.map(allTables,
            (t: PublicationTable) => t.publication)).length;
        this.calculateMinMax(allTables);
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
        
        const colDep = table.indep_vars.findIndex(
            (variable) => variable.name == variableName);
        if (colDep != -1) {
            return table.indep_vars.length + colDep;
        }
        
        throw new RuntimeError('Variable name not found');
    }

    kill() {
        this.alive = false;
    }
}