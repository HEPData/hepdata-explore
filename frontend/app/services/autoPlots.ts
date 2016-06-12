import {Plot} from "../visualization/Plot";
import {filter} from "../utils/functools";
import {assert} from "../utils/assert";
import {PlotPool} from "./PlotPool";


export function autoPlots(plotPool: PlotPool, maxPlots: number) {
    // After the next loop, this variable will hold how many free plots we have
    let remainingPlots = maxPlots;

    const plotsToRetire: Plot[] = [];
    const existingVariablePairs = new Set2<string,string>();

    // For every plot
    for (let plot of plotPool.plots) {
        // Update data
        plot.loadTables();

        if (!plot.config.pinned) {
            // If the plot is automatic (non pinned), remove the variables
            // from the plot that no longer have any data points
            plot.config.yVars = _.filter(plot.config.yVars, (yVar) =>
            plot.tablesByYVar.get(yVar)!.length > 0);
        }

        // Track existing variable pairs
        const xVar = plot.config.xVar;
        if (xVar) { // ignore ill configured plots
            for (let yVar of plot.config.yVars) {
                existingVariablePairs.add(xVar, yVar);
            }
        }

        // Remove automatic plots that have lost all data
        if (!plot.config.pinned && plot.isEmpty()) {
            plotsToRetire.push(plot)
        } else {
            remainingPlots--;
        }
    }
    for (let plot of plotsToRetire) {
        plotPool.retirePlot(plot);
    }

    // Continue only if we still have free plots
    if (remainingPlots <= 0) {
        return;
    }

    // Compute how many data points there are for each (dep var, indep var) pair
    let countByVariablePair = new Map2<string,string,number>();
    for (let table of plotPool.tableCache.allTables) {
        for (let depVar of table.dep_vars) {
            for (let indepVar of table.indep_vars) {
                const oldCount = countByVariablePair.get(indepVar.name, depVar.name) || 0;
                const newCount = oldCount + table.data_points.length;
                countByVariablePair.set(indepVar.name, depVar.name, newCount);
            }
        }
    }

    // Filter out pairs that are already plotted
    countByVariablePair = new Map2<string,string,number>(Array.from(
        filter(countByVariablePair.entries(), ([x, y, count]) =>
            !existingVariablePairs.has(x, y)
        )
    ));

    // Sort the variable pairs by data point count to get a ranking of the
    // most populous variables
    const countByVariablePairSorted = _.sortBy(Array.from(countByVariablePair.entries()),
        ([indepVar, depVar, dataPointCount]) => {
            return -dataPointCount
        });

    // Now comes assigning plots to the variable pairs.
    // It works like this: Each plot has one independent variable and up to
    // `maxPlotVars` dependent variables.
    const maxPlotVars = 5;
    // `freePlotSlots` plots can be added in total.
    let freePlotSlots = remainingPlots;


    /**
     * This is the bluebrint of a plot.
     */
    class PlotBlueprint {
        /** Will be assigned an independent variable. */
        xVar: string;
        /** Will be assigned one or more dependent variables. */
        yVars: string[];

        /** This blueprint may be linked to an existing plot */
        existingPlot: Plot|null;

        constructor(xVar: string, yVars: string[] = [], existingPlot: Plot|null = null) {
            assert(freePlotSlots > 0, 'No plot slots available');
            this.xVar = xVar;
            this.yVars = yVars;
            this.existingPlot = existingPlot;
        }

        isFull() {
            return this.yVars.length >= maxPlotVars;
        }

        addVariable(yVar: string) {
            assert(this.yVars.length < maxPlotVars, 'No variable slots available');
            this.yVars.push(yVar);
        }
    }

    const plotBlueprints: PlotBlueprint[] =
        plotPool.plots
        // Filter pinned plots
            .filter(p => !p.config.pinned)
            // Filter ill plots
            .filter(p => !!p.config.xVar)
            // Turn into linked blueprint (keeps reference to existing plot)
            .map(plot =>
                new PlotBlueprint(
                    plot.config.xVar!, plot.config.yVars, plot
                )
            );

    // At this point the algorithm it's a bit naive in that it chooses them
    // randomly by the order they were inserted. It could be improved to
    // always put some groups of related variables (e.g. 'expected' and
    // 'observed' variables) in the same plot.

    const tryAddVariablePairToBlueprints = (xVar: string, yVar: string) => {
        // Skip already existing pairs
        if (existingVariablePairs.has(xVar, yVar)) {
            return;
        }

        // Try to find an existing blueprint with space for another variable
        let plotWithSpace = plotBlueprints
            .find(p => p.xVar == xVar && !p.isFull());

        // If no such plot is found, create one if we have space
        if (!plotWithSpace && freePlotSlots > 0) {
            plotWithSpace = new PlotBlueprint(xVar, [], null);
            plotBlueprints.push(plotWithSpace);
            freePlotSlots--;
        }

        // If we get a plot with space in any of previous manners, add the
        // variable.
        if (plotWithSpace) {
            plotWithSpace.addVariable(yVar);

            // Add to the variable pair set to avoid it being duplicated
            existingVariablePairs.add(xVar, yVar);
        }
    };

    for (let [indepVar, depVar, dataPointCount] of countByVariablePairSorted) {
        tryAddVariablePairToBlueprints(indepVar, depVar);
    }

    for (let blueprint of plotBlueprints) {
        let plot: Plot;
        if (blueprint.existingPlot) {
            // Update existing plots (they have a linked blueprint)
            blueprint.existingPlot.config.yVars = blueprint.yVars;
            plot = blueprint.existingPlot;
        } else {
            // Create a new plot based on this blueprint
            plot = plotPool.spawnPlot().spawn(blueprint.xVar, blueprint.yVars);
        }

        // Use an appropriate color policy
        plot.config.colorPolicy = plot.config.yVars.length > 1
            ? 'per-variable' : 'per-table';
    }
}
