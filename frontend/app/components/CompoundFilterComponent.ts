import CompoundFilter = require("../filters/CompoundFilter");
import AllFilter = require("../filters/AllFilter");
import SomeFilter = require("../filters/SomeFilter");
import {app} from "../AppViewModel";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {observable} from "../decorators/observable";
import {computedObservable} from "../decorators/computedObservable";
import {
    registerFilterComponent,
    unregisterFilterComponent
} from "../base/getFilterComponent";
import {insideElementOfClass} from "../utils/insideElementOfClass";

// http://ejohn.org/blog/comparing-document-position/
function htmlContains(a: HTMLElement, b: HTMLElement){
    return a.contains ?
    a != b && a.contains(b) :
        !!(a.compareDocumentPosition(b) & 16);
}

@KnockoutComponent('compound-filter', {
    template: { fromUrl: 'compound-filter.html' },
})
export class CompoundFilterComponent {
    @observable()
    filter: CompoundFilter;

    constructor(params:any) {
        this.filter = params.filter;

        registerFilterComponent(this.filter, this);
    }

    @computedObservable()
    get flagText() {
        return this.filter.getFlagText();
    }

    @computedObservable()
    get flagClasses() {
        return ['flag', this.filter.getFlagClass()].join(' ');
    }

    // tip from http://jsfiddle.net/cfenzo/7chaomnz/
    dragulaAccepts(el: HTMLElement, target: HTMLElement, source: HTMLElement,
                   sibling: HTMLElement)
    {
        // prevent dragged containers from trying to drop inside itself
        return !htmlContains(el,target);
    }

    dragulaMoves(el: HTMLElement, source: HTMLElement, handle: HTMLElement,
                 sibling: HTMLElement)
    {
        // Only allow to move filters dragging their drag handles
        return insideElementOfClass(handle, 'drag-handle');
    }

    toggleFilterType() {
        let otherFilterClass: typeof SomeFilter | typeof AllFilter;
        if (this.filter instanceof AllFilter) {
            otherFilterClass = SomeFilter;
        } else {
            otherFilterClass = AllFilter;
        }
        const newFilter = new otherFilterClass(this.filter.children);
        app.replaceFilter(this.filter, newFilter);
        this.filter = newFilter;
    }

    dispose() {
        ko.untrack(this);
        unregisterFilterComponent(this.filter);
    }
}