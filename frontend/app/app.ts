///<reference path="../typings/browser.d.ts"/>

import Filter = require("filters/Filter");
import AllFilter = require("filters/AllFilter");
import KeywordFilter = require("filters/KeywordFilter");

// Ensure template loading works
import 'base/templateFromUrlLoader';

// Ensure components are pulled as a dependencies
import 'components/all-components';
import {IndepVarFilter} from "./filters/filter-factories";

class AppViewModel {
    rootFilter: Filter;

    currentFilterUri: KnockoutComputed<String>;

    private calcCurrentFilterUri(): String {
        return this.rootFilter.toDsl();
    }

    constructor() {
        this.rootFilter = new AllFilter([
            new IndepVarFilter(),
        ]);
        this.currentFilterUri = ko.computed(this.calcCurrentFilterUri, this);
        this.currentFilterUri.subscribe((newFilterUri: string) => {
            console.log('Changed URL');
            history.replaceState(null, null, '#' + newFilterUri)
        })
    }
}

window.onhashchange = function () {
    console.log('User changed hash:');
    console.log(location.hash);
};

const app = new AppViewModel();
export = app;

ko.applyBindings(app);