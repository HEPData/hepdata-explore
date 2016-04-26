import {PublicationTable} from "../base/dataFormat";
import {RuntimeError} from "../base/errors";

class TableCache {
    public allTables: PublicationTable[];

    private _tablesByIndepVar: Map<string, PublicationTable>;
    private _tablesByDepVar: Map<string, PublicationTable>;

    constructor(allTables: PublicationTable[] = []) {
        this._tablesByIndepVar = new Map;
        this._tablesByDepVar = new Map;
        this.replaceAllTables(allTables);
    }

    public replaceAllTables(newTables: PublicationTable[]) {
        this.allTables = newTables;
        this._tablesByIndepVar.clear();
        this._tablesByDepVar.clear();
        for (let table of this.allTables) {
            for (let varName of table.indep_vars) {
                this._tablesByIndepVar.set(varName.name, table);
            }
            for (let varName of table.dep_vars) {
                this._tablesByDepVar.set(varName.name, table);
            }
        }
    }

    /** Returns a list of tables containing the required variables.
     *
     * Both xVar and yVars may be kdependent or independent variables.
     *
     * For a table to be selected it MUST have both xVar and and yVar.
     */
    public getTablesWithVariables(xVar: string, yVar: string): PublicationTable[] {
        return _.filter(this.allTables, (table) => {
            const variableNames = _.map(table.indep_vars, 'name').concat(
                                  _.map(table.dep_vars, 'name'));
            return variableNames.indexOf(xVar) != -1 &&
                    variableNames.indexOf(yVar) != -1;
        });
    }
}

export = TableCache;