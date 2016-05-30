import AllFilter = require("filters/AllFilter");

// Ensure template loading works
import 'base/templateFromUrlLoader';

// Ensure components are pulled as a dependencies
import 'bindings/all-bindings';
import 'components/all-components';
import {IndepVarFilter, DepVarFilter} from "./filters/filter-factories";

// Ensure template utility functions are pulled too
import 'utils/recordCountFormat';
import {elastic} from "./services/Elastic";
import {DataPoint, PublicationTable} from "./base/dataFormat";
import TableCache = require("./services/TableCache");
import {PlotPool} from "./services/PlotPool";
import {Plot, PlotConfig, PlotConfigDump} from "./visualization/Plot";
import {assertHas, assert, AssertionError, ensure} from "./utils/assert";
import {map, imap, sum, union, range} from "./utils/map";
import CMEnergiesFilter = require("./filters/CMEnergiesFilter");
import {Filter, FilterDump} from "./filters/Filter";
import {StateDump} from "./base/StateDump";
import {stateStorage} from "./services/StateStorage";
import {customUrlHash} from "./utils/customUrlHash";
import {bind} from "./decorators/bind";
import {CustomPlotVM} from "./components/CustomPlotVM";
import {observable} from "./decorators/observable";
import "decorators/computedObservable";
import {computedObservable} from "./decorators/computedObservable";
import {rxObservableFromPromise} from "./rx/rxObservableFromPromise";
import {
    rxObservableFromHash, getCurrentHash,
    removeLeadingHashtag
} from "./rx/rxObservableFromHash";
import "rx/setLoadingOperator";
import "rx/chainOperator";
import "rx/withOperator";
import {HTTPError, NetworkError} from "./base/network";
import {ModalWindow} from "./base/ModalWindow";
import {ViewPublicationsVM} from "./components/ViewPublicationsVM";
import {combineAsTuple} from "./rx/combineAsTuple";
import {pair} from "./base/pair";

declare function stableStringify(thing: any): string;

interface ErrorMessage {
    title: string;
    message: string;
    detail: string|null;
}

function formatMessageFromError(err: HTTPError): ErrorMessage {
    const cause = _.get<string>(err.response, 'error.root_cause.0.type', 'unknown cause');
    const reason = _.get<string>(err.response, 'error.root_cause.0.reason', 'unknown reason');

    if (cause == 'illegal_argument_exception') {
        // Catch regex errors, which are the user' fault
        return {
            title: 'Invalid argument',
            message: 'This error is usually caused by a buggy regexp in your filters. More details below:',
            detail: reason,
        }
    } else {
        // Generic error (these should be the programmer's fault)
        return {
            title: 'Filter failed',
            message: 'The search server rejected the search with error.',
            detail: `${cause}: ${reason}`,
        }
    }

}

/**
 * Instructs the application to perform a search and update the UI with the
 * results.
 */
interface SearchRequest {
    /**
     * The filter to apply in ElasticSearch.
     */
    filter: Filter;

    /**
     * If set, once the data is received the current plots will be replaced with
     * these values. Otherwise, the current plot set will be updated to reflect
     * the new data using the auto-plot algorithm.
     */
    thenSetPlots: PlotConfigDump[]|null;
}

interface SearchState {
    error: ErrorMessage|null,
    tables: PublicationTable[]|null,
}

export class AppViewModel {
    @observable()
    rootFilter: Filter|null = null;

    /**
     * Stores the data from publications after a search has been performed, with
     * several indices.
     */
    tableCache = new TableCache;

    @observable()
    plotPool = new PlotPool(this.tableCache);

    /**
     * The application will generate automatically plots until `autoMaxPlots`
     * are allocated in the screen.
     */
    autoMaxPlots = 6;

    /**
     * Returns the view model of the Custom Plot modal dialog.
     *
     * It's kept as a convenience shorthand for debugging and coding in the
     * browser developer tools.
     */
    @computedObservable()
    get customPlotVM(): CustomPlotVM|null {
        return this.customPlotModal.viewModel;
    }

    @observable()
    customPlotModal = new ModalWindow<CustomPlotVM>();

    @observable()
    viewPublicationsModal = new ModalWindow<ViewPublicationsVM>();

    @observable()
    loadingNewData = false;

    @observable()
    currentError: ErrorMessage|null = null;

    @computedObservable()
    get appState(): StateDump|null {
        if (!this.rootFilter) {
            // Can't build a valid StateDump without a filter.
            return null;
        }
        return {
            version: 1,
            filter: this.rootFilter.dump(),
            plots: this.plotsDump,
        };
    }

    @computedObservable()
    get filterDump(): FilterDump|null {
        if (this.rootFilter) {
            return this.rootFilter.dump();
        } else {
            return null;
        }
    }
    @computedObservable()
    get plotsDump(): PlotConfigDump[] {
        return map(this.plotPool.plots, (p) => p.config.dump());
    }

    private _updatedNonInteractively = {
        filter: false,
        plots: false,
    };
    private loadPlotsNonInteractive(value: PlotConfigDump[]) {
        this._updatedNonInteractively.plots = true;
        this.plotPool.loadPlots(value);
        this._updatedNonInteractively.plots = false;
    }
    private setFilterNonInteractive(value: Filter|null) {
        this._updatedNonInteractively.filter = true;
        this.rootFilter = value;
    }

    /**
     * While a state dump is being downloaded the filter controls are locked.
     *
     * Why would the user want to edit the filter if their changes are going to
     * be trashed down in a few seconds when the server sends the response with
     * the state dump?
     *
     * Just in case, this flag forbids them from doing it.
     *
     * @type {boolean}
     */
    public filterLocked = false;

    constructor() {
        const appState$ = (<KnockoutObservable<StateDump>>
            ko.getObservable(this, 'appState'))
            .toObservableWithReplyLatest();

        const filterInteractiveUpdates$ = (<KnockoutObservable<FilterDump>>
            ko.getObservable(this, 'filterDump'))
            .toObservableWithReplyLatest()
            .filter(() => {
                if (!this._updatedNonInteractively.filter) {
                    return true;
                } else {
                    // Consume token and stop propagation of this update
                    this._updatedNonInteractively.filter = false;
                    return false;
                }
            })
            .distinctUntilChanged(stableStringify)
            // Return the real filter instead of a serialization of itself
            .map(() => this.rootFilter)
            .shareReplay(1);

        const plotsInteractiveUpdates$ = (<KnockoutObservable<Plot[]>>
            ko.getObservable(this, 'plotsDump'))
            .toObservable()
            .filter(() => !this._updatedNonInteractively.plots)
            .distinctUntilChanged(stableStringify)
            .shareReplay(1);

        const $searchRequests = new Rx.Subject<SearchRequest>();
        $searchRequests
            .distinctUntilChanged(stableStringify)
            .map((req) => elastic.fetchFilteredData(req.filter)
                .then(newTables => pair([req, newTables])))
            .do(() => {this.loadingNewData = true})
            .map(rxObservableFromPromise)
            .switch()
            .forEach(([req, newTables]) => {
                this.tableCache.replaceAllTables(newTables);
                if (req.thenSetPlots) {
                    // Replace plots with the specified set
                    this.loadPlotsNonInteractive(req.thenSetPlots);
                } else {
                    // Run autoplots algorithm
                    this.updateUnpinnedPlots();
                }
                // Now, and only now, that filter and plots are consistent,
                // send a request to upload the state and update the URL hash.
                const stateDump = ensure(this.appState);
                $stateUploadRequests.onNext(stateDump);
            });
            
        const $stateUploadRequests = new Rx.Subject<StateDump>();
        $stateUploadRequests
            // Stringify as JSON
            .map(stableStringify)
            // Avoid repeated states
            .distinctUntilChanged()
            // Calculate the hash of the state
            .map((stateDump: string) =>
                pair([stateDump, customUrlHash(stateDump)])
            )
            // Stop if the calculated hash is the one currently in the URL bar    
            .filter(([stateDump, hash]) =>
                hash != removeLeadingHashtag(location.hash)
            )
            // Update the browser history and persist the new state to the server
            .forEach(([stateDump, hash]) => {
                history.pushState(null, undefined, '#' + hash);
                // Asynchronous and optimistic upload
                console.log('Storing hash ' + hash);
                stateStorage.put(hash, stateDump)
                    .then(()=> {})
                    .catch(() => {
                        console.warn('Could not persist state: ' + hash);
                    });
            });

        // Loading of states from the URL
        // ==============================
        //
        // For every hash we get in the URL bar
        const locationHash$ = rxObservableFromHash();
        locationHash$
            // Filter out invalid hashes
            .filter(AppViewModel.isValidHash)
            .do((hash) => {console.log('Loading hash ' + hash);})
            // Fetch their associated state from the state server
            .map(this.fetchStateDumpFromHash)
            .map(rxObservableFromPromise)
            // Lock the filter UI while we download the new filter
            .do(() => {this.filterLocked = true})
            // Get the latest response
            .switch()
            .forEach((stateDump) => {
                const filter = Filter.load(stateDump.filter); 
                // Load the filter in the UI
                this.setFilterNonInteractive(filter);
                // Send a search and plot request
                $searchRequests.onNext({
                    filter: filter,
                    thenSetPlots: stateDump.plots,
                });
            })

        // Provide a default state when the application is started up without a hash.
        // ==========================================================================
        //
        locationHash$
            // Take the first hash the user has when the page is loaded
            .take(1)
            .forEach((hash) => {
                // If it's an empty or invalid hash (e.g. the main page without
                // any hash URL set)
                if (!AppViewModel.isValidHash(hash)) {
                    // Set a initial example filter
                    this.rootFilter = AppViewModel.getDefaultFilter();
                    // The update will be catched and autoplots will be run 
                }
            });

        // Handling of filter updates done by the user
        // ===========================================
        //
        // For every filter change
        filterInteractiveUpdates$
            // Ignore the first notification, when the application has just been
            // loaded and filter is still null.
            .filter((filter) => filter != null)
            .do((filter) => {
                console.log('Handling user filter update');
            })
            .map((filter) => filter!)
            // Run the search on the server
            .forEach((filter) => {
                // Request searching by the filter and then running autoplots
                $searchRequests.onNext({
                    filter: filter,
                    thenSetPlots: null,
                })
            });

        // Storing application state when the user edits a plot
        // ====================================================
        //
        // When the user edits a plot
        plotsInteractiveUpdates$
            .forEach((plots) => {
                // Request to upload the current state
                if (this.appState) {
                    $stateUploadRequests.onNext(this.appState);
                }
            });
    }

    @bind()
    searchAsObservable(source: Rx.Observable<Filter>): Rx.Observable<Rx.Observable<SearchState>> {
        return source
            .map(elastic.fetchFilteredData)
            .map(rxObservableFromPromise)
            .map(x => x
                .map<SearchState>(tables => ({tables: tables, error: null}))
                .retryWhen((errors) => errors
                    .scan((countRetries: number, err: any) => {
                        // Retry up to four times, for a total of 5 request attempts.
                        // Only retry non-400 errors.
                        if (countRetries >= 4 || err instanceof HTTPError && err.code != 400) {
                            throw err;
                        }
                        return countRetries + 1;
                    }, 1)
                    // Waiting 1 second between attempts.
                    .zip(Rx.Observable.timer(1000, 1000))
                )
                // Handle errors of the elastic request independently, so an
                // error at a request does not stop the complete stream (which
                // would prevent more filter updates from triggering these
                // search calls)
                .catch((err) => {
                    let errorMessage: ErrorMessage;
                    if (err instanceof HTTPError && err.code == 400) {
                        errorMessage = formatMessageFromError(err);
                    } else if (err instanceof NetworkError) {
                        errorMessage = {
                            title: 'Network error',
                            message: 'Could not contact the search server after several retries.',
                            detail: null,
                        }
                    } else {
                        errorMessage = {
                            title: 'Unknown error',
                            message: 'An unknown error occurred retrieving the filtered data.',
                            detail: null,
                        }
                    }
                    return Rx.Observable.just({error: errorMessage, tables: null});
                })
            );
    }

    updateUnpinnedPlots() {
        this._updatedNonInteractively.plots = true;

        // After the next loop, this variable will hold how many free plots we have
        let remainingPlots = this.autoMaxPlots;

        // Update every plot data
        const plotsToRetire: Plot[] = [];
        for (let plot of this.plotPool.plots) {
            // Update data
            plot.loadTables();
            // Kill if no data is matched with the new tables
            if (plot.isEmpty()) {
                plotsToRetire.push(plot)
            } else {
                remainingPlots--;
            }
        }
        for (let plot of plotsToRetire) {
            this.plotPool.retirePlot(plot);
        }

        // Continue only if we still have free plots
        assert(remainingPlots >= 0, 'remainingPlots >= 0');
        if (remainingPlots == 0) {
            return;
        }

        // Compute how many data points there are for each (dep var, indep var) pair
        const countByVariablePair = new Map2<string,string,number>();
        for (let table of this.tableCache.allTables) {
            for (let depVar of table.dep_vars) {
                for (let indepVar of table.indep_vars) {
                    const oldCount = countByVariablePair.get(indepVar.name, depVar.name) || 0;
                    const newCount = oldCount + table.data_points.length;
                    countByVariablePair.set(indepVar.name, depVar.name, newCount);
                }
            }
        }

        // Sort the pairs by data point count
        const countByVariablePairSorted = _.sortBy(Array.from(countByVariablePair.entries()),
            ([indepVar, depVar, dataPointCount]) => {
                return -dataPointCount
            });

        // Now comes assigning plots to the variable pairs.
        // It works like this: Each plot has one independent variable and upto
        // `maxPlotVars` dependent variables.
        const maxPlotVars = 5;
        // `freePlotSlots` plots can be added in total.
        let freePlotSlots = remainingPlots;
        let freeVariableSlots = remainingPlots * maxPlotVars;

        const groupsAssigned = new Map<string, PlotGroupConfiguration>();

        /** We define a 'plot group' as a pair of (xVar, yVars). A plot group may
         * be split later into one or more plots.
         */
        class PlotGroupConfiguration {
            /** Will be assigned an independent variable. */
            xVar: string;
            /** Will be assigned one or more dependent variables. */
            yVars: string[] = [];

            plotsAllocated = 1;
            /** How many variables we can add to yVars without requiring a new plot. */
            variableSlotsFree = maxPlotVars;

            constructor(xVar: string) {
                assert(freePlotSlots > 0, 'No plot slots available');
                this.xVar = xVar;

                freePlotSlots -= 1;
                groupsAssigned.set(xVar, this);
            }

            addVariable(yVar: string) {
                assert(this.variableSlotsFree > 0, 'No variable slots available');

                this.yVars.push(yVar);
                this.variableSlotsFree -= 1;
                freeVariableSlots -= 1;
            }

            allocateAnotherPlot() {
                assert(freePlotSlots > 0, 'No plot slots available');
                assert(this.variableSlotsFree == 0, 'Unnecessary plot allocation');

                this.plotsAllocated += 1;
                this.variableSlotsFree += maxPlotVars;
                freePlotSlots -= 1;
            }
        }

        for (let [indepVar, depVar, dataPointCount] of countByVariablePairSorted) {
            const existingGroup = groupsAssigned.get(indepVar);
            if (!existingGroup) {
                if (freePlotSlots > 0) {
                    // No plot group exists for this indepVar, but we have room
                    // for a new one.
                    const group = new PlotGroupConfiguration(indepVar);
                    group.addVariable(depVar);
                }
            } else {
                // A group for this indepVar variable already exists
                if (existingGroup.variableSlotsFree) {
                    // If it has no room for more variables already try to get
                    // a new plot.
                    if (existingGroup.variableSlotsFree == 0 && freePlotSlots > 0) {
                        existingGroup.allocateAnotherPlot();
                    }

                    // If it has enough space, add the variable
                    if (existingGroup.variableSlotsFree > 0) {
                        existingGroup.addVariable(depVar);
                    }
                }
            }
        }

        // Before we can create the plots, we have to split the groups in plots
        // of up to `maxPlotVars` variables.

        // At this point the algorithm it's a bit naive in that it chooses them
        // randomly by the order they were inserted. It could be improved to
        // always put some groups of related variables (e.g. 'expected' and
        // 'observed' variables) in the same plot.

        for (let group of groupsAssigned.values()) {
            for (let numPlot of range(group.plotsAllocated)) {
                const yVars = group.yVars.slice(numPlot * maxPlotVars,
                    (numPlot + 1) * maxPlotVars);

                // Finally, we add the new plot now
                const plot = this.plotPool.spawnPlot().spawn(group.xVar, yVars);
            }
        }

        this._updatedNonInteractively.plots = false;
    }

    @bind()
    public loadStateDumpFilter(stateDump: StateDump) {
        if (stateDump.version != 1) {
            console.warn('Unknown state dump version: ' + stateDump.version);
        }
        if (stateDump.filter) {
            this.rootFilter = Filter.load(stateDump.filter);
        } else {
            this.rootFilter = null;
        }
    }

    private static regexStateId = /^([\w1-9]+)$/;

    private static isValidHash(hash: string): boolean {
        return !!AppViewModel.regexStateId.exec(hash);
    }

    private static getDefaultFilter(): Filter {
        return new AllFilter([
            new IndepVarFilter('PT (GEV)'),
        ]);
    }

    @bind()
    private fetchStateDumpFromHash(hash: string): Promise<StateDump> {
        const match = AppViewModel.regexStateId.exec(hash);
        if (match == null) throw new AssertionError();
        const id = match[1];
        return stateStorage.get(id);
    }

    /** Deeply explores the filter tree in search of `oldFilter`. If found,
     * replaces it with `newFilter`.
     *
     * Returns boolean indicating whether a replacement was made.
     *
     * @param oldFilter
     * @param newFilter
     */
    public replaceFilter(oldFilter: Filter, newFilter: Filter): boolean {
        if (this.rootFilter == null) throw new AssertionError();

        if (this.rootFilter === oldFilter) {
            this.rootFilter = newFilter;
            return true;
        } else {
            return this.rootFilter.replaceFilter(oldFilter, newFilter);
        }
    }

    public showEditPlotDialog(plot: Plot) {
        const customPlotVM = new CustomPlotVM(plot.clone());
        this.customPlotModal.show('Edit plot', customPlotVM).then(() => {
            // Bring the updated configuration to the original plot
            plot.config = customPlotVM.plot.config;
        }).catch(() => {
            // No action on cancel
        }).finally(() => {customPlotVM.dispose()});
    }

    public showPublicationsDialog(plot: Plot) {
        const viewPublicationsVM = new ViewPublicationsVM(plot.clone());
        this.viewPublicationsModal.show(null, viewPublicationsVM)
            .then(() => {})
            .catch(() => {})
            .finally(() => {viewPublicationsVM.dispose()});
    }

    @bind()
    public addCustomPlotDialog() {
        const customPlotVM = new CustomPlotVM(new Plot(this.tableCache));
        this.customPlotModal.show('Add plot', customPlotVM).then(() => {
            const plot = this.plotPool.spawnPlot();
            plot.config = customPlotVM.plot.config;
        }).catch(() => {
        }).finally(() => {customPlotVM.dispose()});
    }

    @computedObservable()
    get tableCount() {
        return this.tableCache.allTables.length;
    }

    @computedObservable()
    get publicationCount() {
        return _.uniqBy(this.tableCache.allTables,
            (t) => t.publication.inspire_record).length;
    }
}
export const app = new AppViewModel();