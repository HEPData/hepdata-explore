import {Plot} from "../visualization/Plot";
import TableCache = require("../services/TableCache");
import {AutocompleteService} from "../services/AutocompleteService";
import {observable} from "../decorators/observable";
import {map} from "../utils/map";
import {computedObservable} from "../decorators/computedObservable";
import {variableTokenizer} from "../utils/variableTokenizer";
import {bind} from "../decorators/bind";
import IDisposable = Rx.IDisposable;


export class VariableChoice {
    /* ? */
    position: number;

    /** Variable name */
    name: string;

    /**
     * True if choosing this variable would yield results (that is, if this is
     * a y var, there are tables that have both this y var and the selected x
     * var.
     */
    isCrossMatch: boolean;
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

    @observable()
    focused: boolean = false;

    autocomplete: AutocompleteService<VariableChoice>;

    constructor(opts: {
        initialValue: string|null,
        searchFn: (query: string) => Promise<VariableChoice[]>
    }) {
        this.fieldValue = this.cleanValue = opts.initialValue || '';

        this.autocomplete = new AutocompleteService<VariableChoice>({
            koQuery: ko.getObservable(this, 'fieldValue'),
            searchFn: opts.searchFn,
            rankingFn: (s: VariableChoice) => [
                // The currently selected variable always appears first, then
                // all the rest
                s.name == this.cleanValue ? 0 : 1,
                // Cross matches appear first
                s.isCrossMatch ? 0 : 1,
                // Finally, the suggestions are sorted by string length (simpler
                // matches first)
                s.name.length,
            ],
            keyFn: (s: VariableChoice) => s.name,
            maxSuggestions: 100,
            suggestionClickedFn: (suggestion: VariableChoice) => {
                this.fieldValue = suggestion.name;
                this.cleanValue = suggestion.name;
            },
        });

        this._subscription = ko.getObservable(this, 'focused')
            .subscribe((focused: boolean) => {
                if (focused) {
                    this.autocomplete.updateSearchResults();
                } else {
                    // If the field loses focuses dirty, restore it to the clean value
                    if (this.fieldValue != this.cleanValue && this.fieldValue != '') {
                        this.fieldValue = this.cleanValue;
                    }
                }
            })
    }

    private _subscription: KnockoutSubscription;
    dispose() {
        this._subscription.dispose();
        ko.untrack(this);
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
    private get _cleanValuesChanged() {
        this.xVar.cleanValue;
        for (let item of this.yVars) {
            item.cleanValue;
        }
        return ++this._counterCleanValues;
    }
    private _counterCleanValues = 0;

    @computedObservable()
    private get _fieldValuesChanged() {
        this.xVar.fieldValue;
        this.xVar.focused;
        for (let item of this.yVars) {
            item.fieldValue;
            item.focused;
        }
        return ++this._counterFieldValues;
    }
    private _counterFieldValues = 0;

    private _disposables: IDisposable[] = [];

    constructor(public plot: Plot, public tableCache: TableCache) {
        this._disposables.push(
            ko.getObservable(this, '_cleanValuesChanged').subscribe(() => {
                this.updatePlot();
            }));

        this._disposables.push(
            ko.getObservable(this, '_fieldValuesChanged').subscribe(() => {
                this.updateVariableFields();
            }));

        this._disposables.push(
            ko.getObservable(this.xVar, 'cleanValue').subscribe(() => {
                for (let yVar of this.yVars) {
                    // The order of the results may (and probably will) change
                    // if xVar is modified.
                    yVar.autocomplete.updateSearchResults();
                }
            }));
    }

    updateVariableFields() {
        for (var i = 0; i < this.yVars.length - 1; i++) {
            const yVar = this.yVars[i];
            if (yVar.fieldValue == '' && !yVar.focused) {
                this.deleteYVar(i--);
            }
        }

        const lastYVar = this.yVars[this.yVars.length - 1];
        if (lastYVar.fieldValue != '') {
            this.yVars.push(new VariableVM({
                initialValue: '',
                searchFn: this.getYCompletion,
            }));
        }
    }

    @bind()
    deleteYVar(index: number) {
        this.yVars[index].dispose();
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
            // Replace this.plot.config.yVars contents
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

        const yVarsSet = new Set(this.getPlottableYVars());
        const results = allVariablesIndex.search(query)
            .map((result, index) => ({
                position: index,
                name: allVariables[result.ref],
                isCrossMatch: !!this.tableCache.hasTableWithVariables(
                    allVariables[result.ref],
                    yVarsSet),
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
                isCrossMatch: !!this.tableCache.hasTableWithVariables(
                    this.xVar.cleanValue,
                    allVariables[result.ref])
            }));

        return Promise.resolve(results);
    }

    dispose() {
        this.xVar.dispose();
        for (let yVar of this.yVars) {
            yVar.dispose();
        }
        ko.untrack(this);
    }
}