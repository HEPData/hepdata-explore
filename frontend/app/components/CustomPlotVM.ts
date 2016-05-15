import {Plot} from "../visualization/Plot";
import TableCache = require("../services/TableCache");
import {AutocompleteService} from "../services/AutocompleteService";
import {observable} from "../decorators/observable";
import {map} from "../utils/map";
import {computedObservable} from "../decorators/computedObservable";
import {variableTokenizer} from "../utils/variableTokenizer";
import {bind} from "../decorators/bind";

export class VariableVM {
    /**
     * Contains the value that is in the bound input field and is updated
     * each time the user presses a key.
     */
    @observable()
    fieldValue: string;

    /**
     * Contains the confirmed value. It's updated when the user accepts a
     * suggestion from the autocomplete service.
     */
    @observable()
    cleanValue: string;

    /**
     * This is not as crazy as it looks like. It's actually used like this:
     * new VariableViewModel({fieldValue: '', cleanValue: ''})
     */
    constructor(values: VariableVM) {
        for (let k in values) {
            this[k] = values[k];
        }
    }
}

export class VariableChoice {
    position: number;
    name: string;
}

export class CustomPlotVM {
    @observable()
    xVar: VariableVM = new VariableVM({
        fieldValue: this.plot.config.xVar,
        cleanValue: this.plot.config.xVar,
    });

    @observable()
    yVars: VariableVM[] = map(this.plot.config.yVars,
        (varName) => new VariableVM({
            fieldValue: varName,
            cleanValue: varName,
        }))
        .concat([new VariableVM({
            fieldValue: '',
            cleanValue: '',
        })]);

    autocompleteXVar = new AutocompleteService<VariableChoice>({
        koQuery: ko.getObservable(this.xVar, 'fieldValue'),
        searchFn: this.getXCompletion,
        rankingFn: (s: VariableChoice) => s.position,
        keyFn: (s: VariableChoice) => s.name,
        maxSuggestions: 5,
        suggestionClickedFn: (xVar: VariableChoice) => {
            this.xVar.fieldValue = xVar.name;
            this.xVar.cleanValue = xVar.name;
        },
    });

    // Dummy computed used to track when xVar or yVars are modified.
    @computedObservable()
    private get _yVarsChanged() {
        this.xVar;
        this.yVars;
        for (let item of this.yVars) {
            item.cleanValue;
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
        return this.xVar.cleanValue.trim() != '';
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
            ret.push(this.yVars[i].cleanValue);
        }
        if (this.yVars.length >= 1
            && this.yVars[this.yVars.length - 1].cleanValue.trim() != '')
        {
            ret.push(this.yVars[this.yVars.length - 1].cleanValue);
        }
        return ret;
    }

    updatePlot() {
        if (this.isXVarClean() && this.plot.config.xVar != this.xVar.cleanValue) {
            this.plot.config.xVar = this.xVar.cleanValue;
        }
        if (this.isYVarsClean()
            && !_.isEqual(this.plot.config.yVars, this.getPlottableYVars()))
        {
            // Replace this.plot.yVars contents
            this.plot.config.yVars.splice(0, this.plot.config.yVars.length,
                ...this.getPlottableYVars());
        }
    }

    @bind()
    getXCompletion(query: string): Promise<VariableChoice[]> {
        const allVariables = Array.from(this.tableCache.getAllVariableNames());

        const allVariablesIndex = lunr(function() {
            this.field('value');
            this.ref('index');
            this.tokenizer(variableTokenizer);
        });
        allVariablesIndex.pipeline.remove(lunr.stopWordFilter);

        allVariables.forEach((value, index) => {
            allVariablesIndex.add({
                'value': value,
                'index': index,
            });
        });

        const results = allVariablesIndex.search(query)
            .map((result, index) => ({
                position: index,
                name: allVariables[result.ref],
            }));

        return Promise.resolve(results);
    }

    @bind()
    getYCompletion(query: string) {

    }
}