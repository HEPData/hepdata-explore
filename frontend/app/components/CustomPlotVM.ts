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

    autocomplete: AutocompleteService<VariableChoice, VariableIndex>;

    constructor(opts: {
        initialValue: string|null,
        searchFn: (query: string, index: VariableIndex) => VariableChoice[],
        suggestionsIndexStream: Rx.Observable<VariableIndex>,
    }) {
        this.fieldValue = this.cleanValue = opts.initialValue || '';

        this.autocomplete = new AutocompleteService<VariableChoice, VariableIndex>({
            koQuery: ko.getObservable(this, 'fieldValue'),
            suggestionsIndexStream: opts.suggestionsIndexStream,
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
            maxSuggestions: 50,
            suggestionAcceptedFn: (suggestion: VariableChoice) => {
                console.log('Accepted ' + suggestion.name);
                this.fieldValue = suggestion.name;
                this.cleanValue = suggestion.name;
            },
            acceptWithTabKey: true,
            nonUniformPaging: false,
        });

        this._subscription = ko.getObservable(this, 'focused')
            .subscribe((focused: boolean) => {
                if (focused) {
                    // this.autocomplete.updateSearchResults();
                } else {
                    // If the field loses focus dirty, restore it to the clean value
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

interface VariableIndex {
    allVariables: string[];
    lunrIndex: lunr.Index;
}

export class CustomPlotVM {
    xVarCompletionIndex$ = new Rx.ReplaySubject<VariableIndex>(1);
    yVarCompletionIndex$ = new Rx.ReplaySubject<VariableIndex>(1);

    @observable()
    xVar: VariableVM = new VariableVM({
        initialValue: this.plot.config.xVar,
        searchFn: this.getXCompletion,
        suggestionsIndexStream: this.xVarCompletionIndex$,
    });

    @observable()
    yVars: VariableVM[] = this.plot.config.yVars
        .map((varName) => new VariableVM({
            initialValue: varName,
            searchFn: this.getYCompletion,
            suggestionsIndexStream: this.yVarCompletionIndex$,
        }))
        .concat([new VariableVM({
            initialValue: '',
            searchFn: this.getYCompletion,
            suggestionsIndexStream: this.yVarCompletionIndex$,
        })]);    

    // Dummy computed used to track when xVar or yVars are modified.
    @computedObservable()
    private get _cleanValuesChanged() {
        this.xVar.cleanValue;
        this._yVarsChanged;
        return ++this._counterCleanValues;
    }
    private _counterCleanValues = 0;

    @computedObservable()
    private get _yVarsChanged() {
        for (let item of this.yVars) {
            item.cleanValue;
        }
        return ++this._yVarsChangedValues;
    }
    private _yVarsChangedValues = 0;

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

    constructor(public plot: Plot) {
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
                    // yVar.autocomplete.updateSearchResults();
                }
            }));

        /* Autocompletion code */
        this.allVariablesIndex = this.createAllVariablesIndex();

        // Stream of indices for Y variables.
        // Each time the X variable is updated the autocompletion for the Y
        // variables must be rebuild.  
        const yVarCompletionIndex$ = (<KnockoutObservable<string>>
            ko.getObservable(this.xVar, 'cleanValue'))
            // For each value of xVar
            .toObservableWithReplyLatest()
            // Emit the index.
            .map(() => this.allVariablesIndex)
            // Note we're always emitting the same index, but doing so triggers
            // a new search, which will retrieve updated values for the
            // `isCrossMatch` field.

        // Connect the stream we just created.
        // 
        // VariableVM needs a stream on creation but we need the VariableVM 
        // object to create the stream.
        //
        // To escape the catch-22, we supply VariableVM with an empty Rx.Subject
        // in this.yVarCompletionIndex$, and connect it later here.
        yVarCompletionIndex$
            .subscribe(this.yVarCompletionIndex$);

        // Stream of indices for X variable (similar to the case above).
        // Each time one of the Y variables is updated the autocompletion for 
        // the X variable must be rebuild.  
        const xVarCompletionIndex$ = (<KnockoutObservable<void>>
            ko.getObservable(this, '_yVarsChanged'))
            .toObservableWithReplyLatest()
            .map(() => this.allVariablesIndex)

        xVarCompletionIndex$
            .subscribe(this.xVarCompletionIndex$)
    }

    // Exposed as member just for debugging purposes
    private allVariablesIndex: VariableIndex;

    private createAllVariablesIndex(): VariableIndex {
        const allVariables = Array.from(this.plot.tableCache.getAllVariableNames());

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

        return {
            allVariables: allVariables,
            lunrIndex: allVariablesIndex,
        };
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
                suggestionsIndexStream: this.yVarCompletionIndex$,
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
    getXCompletion(query: string, index: VariableIndex): VariableChoice[] {
        const yVarsSet = new Set(this.getPlottableYVars());
        if (query != '') {
            return index.lunrIndex.search(query)
                .map((result, i) => ({
                    position: i,
                    name: index.allVariables[result.ref],
                    isCrossMatch: !!this.plot.tableCache.hasTableWithVariables(
                        index.allVariables[result.ref],
                        yVarsSet
                    ),
                }));
        } else {
            return index.allVariables
                .map((xVar, i) => ({
                    position: i,
                    name: xVar,
                    isCrossMatch: !!this.plot.tableCache.hasTableWithVariables(
                        xVar,
                        yVarsSet
                    )
                }));
        }
    }

    @bind()
    getYCompletion(query: string, index: VariableIndex): VariableChoice[] {
        if (query != '') {
            return index.lunrIndex.search(query)
                .map((result, i) => ({
                    position: i,
                    name: index.allVariables[result.ref],
                    isCrossMatch: !!this.plot.tableCache.hasTableWithVariables(
                        this.xVar.cleanValue,
                        index.allVariables[result.ref]
                    )
                }));
        } else {
            return index.allVariables
                .map((yVar, i) => ({
                    position: i,
                    name: yVar,
                    isCrossMatch: !!this.plot.tableCache.hasTableWithVariables(
                        this.xVar.cleanValue,
                        yVar
                    )
                }));
        }
    }

    dispose() {
        this.xVar.dispose();
        for (let yVar of this.yVars) {
            yVar.dispose();
        }
        ko.untrack(this);
    }
}