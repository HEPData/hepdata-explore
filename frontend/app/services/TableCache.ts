import {PublicationTable} from "../base/dataFormat";
import {RuntimeError} from "../base/errors";

class TableCache {
    public allTables: PublicationTable[];

    private _tablesByIndepVar: Map<string, PublicationTable[]>;
    private _tablesByDepVar: Map<string, PublicationTable[]>;

    constructor(allTables: PublicationTable[] = []) {
        this._tablesByIndepVar = new Map<string, PublicationTable[]>();
        this._tablesByDepVar = new Map<string, PublicationTable[]>();
        this.replaceAllTables(allTables);
    }

    public replaceAllTables(newTables: PublicationTable[]) {
        this.allTables = newTables;
        this._tablesByIndepVar.clear();
        this._tablesByDepVar.clear();

        function addItemToMultiMap<K,V>(map: Map<K,V[]>, key: K, value: V) {
            let array = map.get(key);
            if (array == null) {
                array = [];
                map.set(key, array);
            }
            array.push(value);
        }

        for (let table of this.allTables) {
            for (let varName of table.indep_vars) {
                addItemToMultiMap(this._tablesByIndepVar, varName.name, table);
            }
            for (let varName of table.dep_vars) {
                addItemToMultiMap(this._tablesByDepVar, varName.name, table);
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