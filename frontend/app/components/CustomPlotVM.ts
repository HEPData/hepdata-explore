import {Plot} from "../visualization/Plot";
import TableCache = require("../services/TableCache");
import {AutocompleteService} from "../services/AutocompleteService";

export class CustomPlotVM {
    xVar: string = this.plot.xVar;
    yVars: string[] = _.clone(this.plot.yVars);

    // xVarCompletion = new AutocompleteService({
    //    koQuery:
    // });

    constructor(public plot: Plot, public tableCache: TableCache) {
        ko.track(this);
    }

    deleteYVar(index: number) {
        this.yVars.splice(index, 1);
    }

    isXVarClean() {
        return this.xVar.trim() != '';
    }

    isYVarsClean(): boolean {
        return !_.find(this.getPlottableYVars(), (yVar: string) =>
            yVar.trim() != '');
    }

    /** Returns yVars, minus the last empty value that is reserved to let the
     * user add a new y variable. */
    getPlottableYVars() {
        let ret = [];
        for (let i = 0; i < this.yVars.length - 1; i++) {
            ret.push(this.yVars[i]);
        }
        if (this.yVars.length >= 1 && this.yVars[this.yVars.length - 1].trim() != '') {
            ret.push(this.yVars[this.yVars.length - 1]);
        }
        return ret;
    }

    updatePlot() {
        if (this.isXVarClean() && this.plot.xVar != this.xVar) {
            this.plot.xVar = this.xVar;
        }
        if (this.isYVarsClean() && !_.isEqual(this.plot.yVars, this.getPlottableYVars())) {
            // Replace this.plot.yVars contents
            this.plot.yVars.splice(0, this.plot.yVars.length, ...this.getPlottableYVars());
        }
    }

    getXCompletion(query: string) {

    }

    getYCompletion(query: string) {

    }
}