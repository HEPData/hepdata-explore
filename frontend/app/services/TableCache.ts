import {PublicationTable} from "../base/dataFormat";

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
}

export = TableCache;