///<reference path="../typings/browser.d.ts"/>

import Filter = require("filters/Filter");
import AllFilter = require("filters/AllFilter");
import KeywordFilter = require("filters/KeywordFilter");

// Ensure template loading works
import 'base/templateFromUrlLoader';

// Ensure components are pulled as a dependencies
import 'components/all-components';
import {IndepVarFilter} from "./filters/filter-factories";

// Ensure template utility functions are pulled too
import 'utils/recordCountFormat';
import {elastic} from "./services/Elastic";
import {DataPoint} from "./base/DataPoint";
import {showGraphs} from "./visualization/visualization";

function screenUpdated() {
    return new Promise(function (resolve, reject) {
        window.requestAnimationFrame(resolve)
    });
}

enum ProcessingState {
    Done,
    Downloading,
    Rendering,
}

class AppViewModel {
    rootFilter: Filter;
    currentFilterUri: KnockoutComputed<String>;
    processingState: ProcessingState = ProcessingState.Done;
    
    isLoading() {
        return this.processingState != ProcessingState.Done;
    }
    
    isRendering() {
        return this.processingState == ProcessingState.Rendering;
    }

    private calcCurrentFilterUri(): String {
        return this.rootFilter.toDsl();
    }
    
    private loadDataPromise: Promise<DataPoint[]> = Promise.resolve(null);
    
    private loadData() {
        this.loadDataPromise.cancel();
        this.processingState = ProcessingState.Downloading;
        
        this.loadDataPromise = elastic.fetchFilteredData(this.rootFilter);
        this.loadDataPromise
            .then((dataPoints: DataPoint[]) => {
                this.processingState = ProcessingState.Rendering;

                // Wait one frame for the screen to update
                return screenUpdated().then(() => dataPoints);
            })
            .then((dataPoints: DataPoint[]) => {
                var t1 = performance.now();
                var ret = showGraphs(dataPoints, (<any>window).x_var);
                var t2 = performance.now();
                console.log("Data indexed in %.2f ms.", t2 - t1);

                this.processingState = ProcessingState.Done;
            })
    }

    constructor() {
        this.rootFilter = new AllFilter([
            new IndepVarFilter('COS(THETA)'),
        ]);
        this.currentFilterUri = ko.computed(this.calcCurrentFilterUri, this);
        this.currentFilterUri.subscribe((newFilterUri: string) => {
            history.replaceState(null, null, '#' + newFilterUri)
            this.loadData();
        })

        this.loadData();

        ko.track(this, ['processingState']);
    }
}

window.onhashchange = function () {
    console.log('User changed hash:');
    console.log(location.hash);
};

const app = new AppViewModel();
export = app;

ko.applyBindings(app);