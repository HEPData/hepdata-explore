import {Plot} from "../visualization/Plot";
import TableCache = require("../services/TableCache");
import {AutocompleteService} from "../services/AutocompleteService";
import {observable} from "../decorators/observable";
import {map} from "../utils/map";
import {computedObservable} from "../decorators/computedObservable";

export class YVar {
    @observable()
    name: string;

    constructor(name: string = '') {
        this.name = name;
    }
}

export class CustomPlotVM {
    @observable()
    xVar: string = this.plot.config.xVar;

    @observable()
    // ko.observableArray does not handle item updates, so we have to use
    // wrapper objects with observables inside instead :(
    yVars: YVar[] = map(this.plot.config.yVars, (name) => new YVar(name))
        .concat([new YVar()]);

    // Dummy computed used to track when xVar or yVars are modified.
    @computedObservable()
    private get _yVarsChanged() {
        this.xVar;
        this.yVars;
        for (let item of this.yVars) {
            item.name;
        }
        return ++this._counter;
    }
    private _counter = 0;

    // xVarCompletion = new AutocompleteService({
    //    koQuery:
    // });

    constructor(public plot: Plot, public tableCache: TableCache) {
        ko.getObservable(this, '_yVarsChanged').subscribe(() => {
            this.updatePlot();
        });
    }

    deleteYVar(index: number) {
        this.yVars.splice(index, 1);
    }

    isXVarClean() {
        return this.xVar.trim() != '';
    }

    isYVarsClean(): boolean {
        return !_.find(this.getPlottableYVars(), (yVar: string) =>
            yVar.trim() == '');
    }

    /** Returns yVars, minus the last empty value that is reserved to let the
     * user add a new y variable. */
    getPlottableYVars() {
        let ret: string[] = [];
        for (let i = 0; i < this.yVars.length - 1; i++) {
            ret.push(this.yVars[i].name);
        }
        if (this.yVars.length >= 1 && this.yVars[this.yVars.length - 1].name.trim() != '') {
            ret.push(this.yVars[this.yVars.length - 1].name);
        }
        return ret;
    }

    updatePlot() {
        console.log('updplot');
        if (this.isXVarClean() && this.plot.config.xVar != this.xVar) {
            this.plot.config.xVar = this.xVar;
        }
        if (this.isYVarsClean() && !_.isEqual(this.plot.config.yVars, this.getPlottableYVars())) {
            // Replace this.plot.yVars contents
            this.plot.config.yVars.splice(0, this.plot.config.yVars.length,
                ...this.getPlottableYVars());
        }
    }

    getXCompletion(query: string) {

    }

    getYCompletion(query: string) {

    }
}