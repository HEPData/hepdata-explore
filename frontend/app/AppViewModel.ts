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
import {Plot} from "./visualization/Plot";
import {assertHas, assert} from "./utils/assert";
import {map, imap, sum, union, range} from "./utils/map";
import CMEnergiesFilter = require("./filters/CMEnergiesFilter");
import {Filter} from "./filters/Filter";
import {StateDump} from "./base/StateDump";
import {stateStorage} from "./services/StateStorage";
import {customUrlHash} from "./utils/customUrlHash";
import {Option, Some, None} from "./base/Option";
import {bind} from "./decorators/bind";
import {CustomPlotVM} from "./components/CustomPlotVM";
import {observable} from "./decorators/observable";
import "decorators/computedObservable";
import {computedObservable} from "./decorators/computedObservable";
import {rxObservableFromPromise} from "./rx/rxObservableFromPromise";
import {rxObservableFromHash, getCurrentHash} from "./rx/rxObservableFromHash";

declare function stableStringify(thing: any): string;

function screenUpdated() {
    return new Promise(function (resolve, reject) {
        window.requestAnimationFrame(resolve)
    });
}

export class AppViewModel {
    @observable()
    rootFilter: Filter = null;

    tableCache = new TableCache;

    @observable()
    plotPool: PlotPool;

    @observable()
    customPlotVisible = false;

    @observable()
    customPlotVM: Option<CustomPlotVM> = new None<CustomPlotVM>();

    @computedObservable()
    get applicationState(): StateDump {
        return {
            version: 1,
            filter: this.rootFilter ? this.rootFilter.dump() : null,
        };
    }

    private appState: Rx.Observable<StateDump>;

    constructor() {
        this.plotPool = new PlotPool(this.tableCache);

        this.appState = (<KnockoutObservable<StateDump>>
            ko.getObservable(this, 'applicationState')).toObservable();

        const locationHash = rxObservableFromHash();
        // For every hash we get in the URL bar
        locationHash
            // Keep those that are valid
            .filter(AppViewModel.isValidHash)
            // Fetch their associated state from the state server
            .map(this.fetchStateDumpFromHash)
            .map(rxObservableFromPromise)
            // Discard old responses received out of order
            .switch()
            // Load them in the application
            .forEach(this.loadStateDump);

        locationHash
            // Take the first hash the user hash when the page is loaded
            .take(1)
            // If it's an empty or invalid hash, load a default state
            .forEach((hash) => {
                if (!AppViewModel.isValidHash(hash)) {
                    this.loadStateDump(AppViewModel.getDefaultState());
                }
            });

        // For every state of the application
        this.appState
                .do(console.log.bind(console))
            // Serialize it
            .map(stableStringify)
            // If this state is different from the previous one
            .distinctUntilChanged()
            // Calculate a new URL hash from this state dump
            .map((stateDump: string) => [stateDump, customUrlHash(stateDump)])
            // If the hash differs from the current one
            .filter(([stateDump, hash]) => hash != getCurrentHash())
            // Update the browser history and persist the new state to the server
            .forEach(([stateDump, hash]) => {
                history.pushState(null, undefined, '#' + hash);
                stateStorage.put(hash, stateDump);
            });

        // For every state of the application
        this.appState
            // If the filter has changed
            .map((it)=>it.filter)
            .distinctUntilChanged(stableStringify)
            // Run the search on the server
            .map(Filter.load)
            .map(elastic.fetchFilteredData)
            .map(rxObservableFromPromise)
            // Get the latest response
            .switch()
            // Replace the tables and update the plots
            .forEach((tables: PublicationTable[]) => {
                var t1 = performance.now();

                this.tableCache.replaceAllTables(tables);
                this.updateUnpinnedPlots();

                var t2 = performance.now();
                console.log("Data indexed in %.2f ms.", t2 - t1);
            });
    }

    updateUnpinnedPlots() {
        // After the next loop, this variable will hold how many free plots we have
        let remainingPlots = this.plotPool.maxPlots;

        // Update every plot data
        for (let plot of this.plotPool.plots) {
            if (plot.alive) {
                // Update data
                plot.loadTables();
                // Kill if no data is matched with the new tables
                if (plot.isEmpty()) {
                    plot.kill();
                } else {
                    remainingPlots--;
                }
            }
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
                const plot = this.plotPool.getFreePlot().spawn(group.xVar, yVars);
            }
        }
    }

    @bind()
    public loadStateDump(stateDump: StateDump) {
        if (stateDump.version != 1) {
            console.warn('Unknown state dump version: ' + stateDump.version);
        }
        this.rootFilter = Filter.load(stateDump.filter);
    }

    private static regexStateId = /^([\w1-9]+)$/;

    private static isValidHash(hash): boolean {
        return !!AppViewModel.regexStateId.exec(hash);
    }

    private static getDefaultState(): StateDump {
        return {
            version: 1,
            filter: new AllFilter([
                new IndepVarFilter('PT (GEV)'),
            ]).dump(),
        };
    }

    @bind()
    private fetchStateDumpFromHash(hash: string): Promise<StateDump> {
        const match = AppViewModel.regexStateId.exec(hash);
        assert(match != null);
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
        if (this.rootFilter === oldFilter) {
            this.rootFilter = newFilter;
            return true;
        } else {
            return this.rootFilter.replaceFilter(oldFilter, newFilter);
        }
    }
    
    public showEditPlotDialog(plot: Plot) {
        this.customPlotVM = new Some(new CustomPlotVM(plot, this.tableCache));
        this.customPlotVisible = true;
    }

    @bind()
    public customPlotConfirm() {
        console.log('confirm');
        this.customPlotVisible = false;
        this.customPlotVM = new None<CustomPlotVM>();
    }

    @bind()
    public addCustomPlotDialog() {
        console.log('Not yet implemented');
    }
}
export const app = new AppViewModel();