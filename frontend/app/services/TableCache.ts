import {PublicationTable} from "../base/dataFormat";
import {observable} from "../decorators/observable";

class TableCache {
    @observable()
    public allTables: PublicationTable[];

    tablesByIndepVar: Map<string, PublicationTable[]>;
    tablesByDepVar: Map<string, PublicationTable[]>;

    constructor(allTables: PublicationTable[] = []) {
        this.tablesByIndepVar = new Map<string, PublicationTable[]>();
        this.tablesByDepVar = new Map<string, PublicationTable[]>();
        this.replaceAllTables(allTables);
    }

    public replaceAllTables(newTables: PublicationTable[]) {
        this.tablesByIndepVar.clear();
        this.tablesByDepVar.clear();

        function addItemToMultiMap<K,V>(map: Map<K,V[]>, key: K, value: V) {
            let array = map.get(key);
            if (array == null) {
                array = [];
                map.set(key, array);
            }
            array.push(value);
        }

        for (let table of newTables) {
            for (let varName of table.indep_vars) {
                addItemToMultiMap(this.tablesByIndepVar, varName.name, table);
            }
            for (let varName of table.dep_vars) {
                addItemToMultiMap(this.tablesByDepVar, varName.name, table);
            }
        }

        this.allTables = newTables;
    }

    /** Returns a list of tables containing the required variables.
     *
     * Both xVar and yVars may be dependent or independent variables.
     *
     * For a table to be selected it MUST have both xVar and and at least one of
     * yVars.
     */
    public getTablesWithVariables(xVar: string, yVars: Set<string>|string): PublicationTable[] {
        const yVarsSet = (typeof yVars == 'string' ? new Set([yVars]) : yVars);

        return _.filter(this.allTables, (table) => {
            const variableNames = _.map(table.indep_vars, x=>x.name).concat(
                                  _.map(table.dep_vars, x=>x.name));
            return variableNames.indexOf(xVar) != -1 &&
                   !!variableNames.find(x=>yVarsSet.has(x));
        });
    }

    /** Tries to find a table containing the required variables.
     *
     * Both xVar and yVars may be kdependent or independent variables.
     *
     * For a table to be selected it MUST have both xVar and and at least one of
     * yVars.
     *
     * Returns true if such table is found, false otherwise.
     */
    public hasTableWithVariables(xVar: string, yVars: Set<string>|string): boolean {
        const yVarsSet = (typeof yVars == 'string' ? new Set([yVars]) : yVars);

        return !!_.find(this.allTables, (table) => {
            const variableNames = _.map(table.indep_vars, x=>x.name).concat(
                _.map(table.dep_vars, x=>x.name));
            return variableNames.indexOf(xVar) != -1 &&
                !!variableNames.find(x=>yVarsSet.has(x));
        });
    }

    public getAllVariableNames(): Set<string> {
        const ret = new Set<string>();
        for (let varName of this.tablesByDepVar.keys()) {
            ret.add(varName);
        }
        for (let varName of this.tablesByIndepVar.keys()) {
            ret.add(varName);
        }
        return ret;
    }
}

export = TableCache;