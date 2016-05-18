import {Plot} from "../visualization/Plot";
import TableCache = require("../services/TableCache");
import {AutocompleteService} from "../services/AutocompleteService";
import {observable} from "../decorators/observable";
import {map} from "../utils/map";
import {computedObservable} from "../decorators/computedObservable";
import {variableTokenizer} from "../utils/variableTokenizer";
import {bind} from "../decorators/bind";


export class VariableChoice {
    position: number;
    name: string;
}


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

    autocomplete: AutocompleteService<VariableChoice>;

    constructor(opts: {
        initialValue: string,
        searchFn: (query: string) => Promise<VariableChoice[]>
    }) {
        this.fieldValue = this.cleanValue = opts.initialValue;

        this.autocomplete = new AutocompleteService<VariableChoice>({
            koQuery: ko.getObservable(this, 'fieldValue'),
            searchFn: opts.searchFn,
            rankingFn: (s: VariableChoice) => -s.name.length,
            keyFn: (s: VariableChoice) => s.name,
            maxSuggestions: 100,
            suggestionClickedFn: (suggestion: VariableChoice) => {
                this.fieldValue = suggestion.name;
                this.cleanValue = suggestion.name;
            },
        });
    }


}


export class CustomPlotVM {
    @observable()
    xVar: VariableVM = new VariableVM({
        initialValue: this.plot.config.xVar,
        searchFn: this.getXCompletion,
    });

    @observable()
    yVars: VariableVM[] = map(this.plot.config.yVars,
        (varName) => new VariableVM({
            initialValue: varName,
            searchFn: this.getYCompletion,
        }))
        .concat([new VariableVM({
            initialValue: '',
            searchFn: this.getYCompletion,
        })]);

    // Dummy computed used to track when xVar or yVars are modified.
    @computedObservable()
    private get _yVarsChanged() {
        this.xVar.cleanValue;
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
    getYCompletion(query: string): Promise<VariableChoice[]> {
        const allVariables = Array.from(this.tableCache.getAllVariableNames());

        const allVariablesIndex = lunr(function () {
            this.field('value');
            this.ref('index');
            this.tokenizer(variableTokenizer);
        });
        allVariablesIndex.pipeline.remove(lunr.stopWordFilter);

        allVariables.forEach((value, index) => {
            allVariablesIndex.add({
                value: value,
                index: index,
            });
        });

        const results = allVariablesIndex.search(query)
            .map((result, index) => ({
                position: index,
                name: allVariables[result.ref],
            }));

        return Promise.resolve(results);
    }
}