import AllFilter = require("filters/AllFilter");

// Ensure template loading works
import "base/templateFromUrlLoader";
import "bindings/all-bindings";
import "components/all-components";
import {IndepVarFilter} from "./filters/concrete-filters";
import "utils/recordCountFormat";
import {elastic} from "./services/Elastic";
import {PublicationTable} from "./base/dataFormat";
import {PlotPool} from "./services/PlotPool";
import {Plot, PlotConfigDump} from "./visualization/Plot";
import {assert, AssertionError, ensure} from "./utils/assert";
import {map, range, filter, imap} from "./utils/functools";
import {Filter, FilterDump} from "./filters/Filter";
import {StateDump} from "./base/StateDump";
import {stateStorage} from "./services/StateStorage";
import {customUrlHash} from "./utils/customUrlHash";
import {bind} from "./decorators/bind";
import {CustomPlotVM} from "./components/CustomPlotVM";
import {observable} from "./decorators/observable";
import "decorators/computedObservable";
import {computedObservable} from "./decorators/computedObservable";
import {
    rxObservableFromHash,
    removeLeadingHashtag
} from "./rx/rxObservableFromHash";
import "rx/setLoadingOperator";
import "rx/chainOperator";
import "rx/withOperator";
import {HTTPError, NetworkError} from "./base/network";
import {ModalWindow} from "./base/ModalWindow";
import {ViewPublicationsVM} from "./components/ViewPublicationsVM";
import {pair} from "./base/pair";

// Ensure components are pulled as a dependencies

// Ensure template utility functions are pulled too
import TableCache = require("./services/TableCache");
import CMEnergiesFilter = require("./filters/CMEnergiesFilter");
import {autoPlots} from "./services/autoPlots";
import {migrateStateDump} from "./services/migrateStateDump";

class SearchError {
    title: string;
    message: string;
    detail: string|null;

    constructor(data: SearchError) {
        _.assign(this, data);
        Object.seal(this);
    }
}

function formatMessageFromError(err: HTTPError): SearchError {
    const cause = _.get<string>(err.response, 'error.root_cause.0.type', 'unknown cause');
    const reason = _.get<string>(err.response, 'error.root_cause.0.reason', 'unknown reason');

    if (cause == 'illegal_argument_exception') {
        // Catch regex errors, which are the user' fault
        return new SearchError({
            title: 'Invalid argument',
            message: 'This error is usually caused by a buggy regexp in your filters. More details below:',
            detail: reason,
        });
    } else {
        // Generic error (these should be the programmer's fault)
        return new SearchError({
            title: 'Filter failed',
            message: 'The search server rejected the search with error.',
            detail: `${cause}: ${reason}`,
        });
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
    error: SearchError|null,
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
    currentSearchError: SearchError|null = null;

    @observable()
    currentStateLoadError: SearchError|null = null;

    /**
     * Return the error that will be shown in the UI, if any.
     * @returns {SearchError|null}
     */
    @computedObservable()
    get currentError() {
        return this.currentSearchError || this.currentStateLoadError;
    }

    @computedObservable()
    get appState(): StateDump|null {
        if (!this.rootFilter) {
            // Can't build a valid StateDump without a filter.
            return null;
        }
        return {
            version: 2,
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
     * True if some matching publications were not retrieved due to too many
     * results.
     */
    @observable()
    incomplete: boolean = false;

    /**
     * Amount of matching publications not retrieved due to having too many
     * results.
     */
    @observable()
    omittedPublicationsCount: number = 0;

    /**
     * While a state dump is being downloaded the filter controls are locked.
     *
     * Why would the user want to edit the filter if their changes are going to
     * be trashed down in a few seconds when the server sends the response with
     * the state dump?
     *
     * Just in case, this flag forbids them from doing it.
     *
     * TODO: Use this in the UI.
     */
    public filterLocked = false;

    public filterInteractiveUpdates$: Rx.Observable<Filter|null>;

    constructor() {
        const appState$ = (<KnockoutObservable<StateDump>>
            ko.getObservable(this, 'appState'))
            .toObservableWithReplyLatest();

        this.filterInteractiveUpdates$ = (<KnockoutObservable<FilterDump>>
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

        const $searchRequests = new Rx.ReplaySubject<SearchRequest>(1);
        // Each time a piece of the application requests a search
        $searchRequests
            // If it's different than the previous search
            .distinctUntilChanged((searchRequest) => stableStringify({
                filter: searchRequest.filter.dump(),
                thenSetPlots: searchRequest.thenSetPlots,
            }))
            // Request the data for the new filter, but keep the entire request
            // object handy, as it contains data we will need later.
            //
            // .defer() is required in order to return a *cold* observable so
            // that in case of error, retries *create* a new promise (and
            // therefore a new HTTP request) instead of reusing the value of
            // the old one.
            .map((req) => Rx.Observable.defer(() =>
                elastic.fetchFilteredData(req.filter)
                    .then(newTables => pair([req, newTables])
            )))
            // Turn the loading indicator on
            .do(() => {this.loadingNewData = true})
            // Retrying and error handling logic is complex enough to warrant
            // being separate in its own function
            .map(AppViewModel.handleSearchErrors)
            // Discard out of order responses
            .switch()
            .forEach((result) => {
                if (result instanceof SearchError) {
                    // Show error to the user
                    this.currentSearchError = result;
                } else {
                    const [req, searchResult] = result;
                    const newTables = searchResult.tables;

                    // Load the tables returned by the search
                    this.tableCache.replaceAllTables(newTables);
                    this.incomplete = searchResult.incomplete;

                    const countRetrievedPublications = _.uniqBy(this.tableCache.allTables, t =>
                        t.publication).length;
                    this.omittedPublicationsCount = searchResult.totalPublicationsInServer
                        - countRetrievedPublications;

                    if (req.thenSetPlots) {
                        // Replace plots with the specified set
                        this.loadPlotsNonInteractive(req.thenSetPlots);
                    } else {
                        // Run autoplots algorithm
                        this.runAutoPlots();
                    }

                    // Now, and only now, that filter and plots are consistent,
                    // send a request to upload the state and update the URL hash.
                    const stateDump = ensure(this.appState);
                    $stateUploadRequests.onNext(stateDump);

                    // Turn off the loading data indication
                    this.loadingNewData = false;

                    // Clear previous errors, if any
                    this.currentSearchError = null;
                }
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
            .map((hash) => Rx.Observable.defer(() =>
                this.fetchStateDumpFromHash(hash)))
            .map(AppViewModel.handleStateLoadErrors)
            // Lock the filter UI while we download the new filter
            .do(() => {this.filterLocked = true})
            // Get the latest response
            .switch()
            .forEach((result) => {
                if (result instanceof SearchError) {
                    this.currentStateLoadError = result;
                } else {
                    const stateDump = migrateStateDump(<StateDump>result);

                    console.log('Loaded state dump');
                    const filter = Filter.load(stateDump.filter);
                    // Load the filter in the UI
                    this.setFilterNonInteractive(filter);
                    // Send a search and plot request
                    $searchRequests.onNext({
                        filter: filter,
                        thenSetPlots: stateDump.plots,
                    });
                    this.currentStateLoadError = null;
                }
            });

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
        this.filterInteractiveUpdates$
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

    static retryRequest<T>(source: Rx.Observable<T>) {
        return source
            .retryWhen((errors) => errors
                .scan<number>((countRetries: number, err: any) => {
                    // Retry up to four times, for a total of 5 request attempts.
                    // Only retry non-400 (Bad Request) errors.
                    const isError400 = (err instanceof HTTPError && err.code == 400);
                    if (isError400 || countRetries == 5) {
                        throw err;
                    }
                    return countRetries + 1;
                }, 1)
                // Waiting 1 second between attempts.
                .zip(Rx.Observable.timer(1000, 1000))
            );
    }

    static handleSearchErrors<T>(searchObservable: Rx.Observable<T>)
        : Rx.Observable<T|SearchError>
    {
        // It's important to place the .catch (and therefore, this call)
        // inside the nested observable, so an error at a request does not
        // stop the complete stream (which would prevent more filter updates
        // from triggering these search calls)

        return searchObservable
            // Introduce type divergence: the search may return a list of
            // publications or a SearchError.
            .map(tables => <T|SearchError>tables)
            // Retry logic
            .chain(AppViewModel.retryRequest)
            // Catch errors from the elastic request and turn them into a
            // human friendly SearchError object.
            .catch((err) => {
                let searchError: SearchError;
                if (err instanceof HTTPError && err.code == 400) {
                    searchError = formatMessageFromError(err);
                } else if (err instanceof NetworkError) {
                    searchError = new SearchError({
                        title: 'Network error',
                        message: 'Could not contact the search server after several retries.',
                        detail: null,
                    });
                } else {
                    searchError = new SearchError({
                        title: 'Unknown error',
                        message: 'An unknown error occurred retrieving the filtered data.',
                        detail: null,
                    });
                }
                console.warn('Error querying ElasticSearch:');
                console.warn(err);
                return Rx.Observable.just(searchError);
            });
    }

    static handleStateLoadErrors<T>(source: Rx.Observable<T>) {
        return source
            .map(state => <T|SearchError>state)
            // Retry logic
            .chain(AppViewModel.retryRequest)
            .catch((err) => {
                let error: SearchError;
                if (err instanceof NetworkError) {
                    error = new SearchError({
                        title: 'Network error',
                        message: 'Could not load the requested application state (URL) due to a connectivity problem.',
                        detail: null
                    });
                } else if (err instanceof HTTPError && err.code == 404) {
                    error = new SearchError({
                        title: 'State not found',
                        message: 'The state specified in the URL does not exist in the server.',
                        detail: null,
                    })
                } else {
                    error = new SearchError({
                        title: 'Unknown error',
                        message: 'An unknown error occurred retrieving the application state from the URL.',
                        detail: 'toString' in err ? err.toString() : null,
                    })
                }
                console.warn('Error querying kv-server:');
                console.warn(err);
                return Rx.Observable.just(error);
            })
    }

    public runAutoPlots() {
        // Inhibit 'user updated plot' events during the execution of this function
        this._updatedNonInteractively.plots = true;
        autoPlots(this.plotPool, this.autoMaxPlots);
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
            new IndepVarFilter('PT [GEV]'),
        ]);
    }

    @bind()
    private fetchStateDumpFromHash(hash: string): Promise<StateDump> {
        const match = AppViewModel.regexStateId.exec(hash);
        if (match == null) throw new AssertionError();
        const id = match[1];
        return stateStorage.get(id);
    }

    /**
     * Deeply explores the filter tree in search of `oldFilter`. If found,
     * replaces it with `newFilter`.
     *
     * Returns boolean indicating whether a replacement was made.
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
            // Set the modified plot as pinned to ensure the user does not lose
            // it accidentally
            customPlotVM.plot.config.pinned = true;

            // Bring the updated configuration to the original plot
            plot.config = customPlotVM.plot.config;
            return null;
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
            // Set the created plot as pinned to ensure the user does not lose
            // it accidentally
            customPlotVM.plot.config.pinned = true;

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

    downloadAllPlots() {
        const exportedData = {
            'hepdata-explore-uri': location.href,
            'filter': this.filterDump,
            'plots': this.plotPool.plots.map(p => p.export()),
        };
        const exportedDataYaml = jsyaml.safeDump(exportedData);
        const blob = new Blob([exportedDataYaml], {
            type: 'text/x-yaml;charset=utf-8',
        });
        saveAs(blob, 'exported_plots.yaml');
    }
}
export const app = new AppViewModel();