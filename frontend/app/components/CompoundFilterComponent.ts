import CompoundFilter = require("../filters/CompoundFilter");
import AllFilter = require("../filters/AllFilter");
import SomeFilter = require("../filters/SomeFilter");
import {app} from "../AppViewModel";

// http://ejohn.org/blog/comparing-document-position/
function htmlContains(a: HTMLElement, b: HTMLElement){
    return a.contains ?
    a != b && a.contains(b) :
        !!(a.compareDocumentPosition(b) & 16);
}

function insideElementOfClass(element: HTMLElement, className: string) {
    if (element !== null) {
        return element.classList.contains('drag-handle')
            || insideElementOfClass(element.parentElement, className);
    } else {
        return false;
    }
}

class CompoundFilterComponent {
    filter: CompoundFilter;

    constructor(params:any) {
        this.filter = params.filter;

        ko.track(this);
    }

    get flagText() {
        return this.filter.getFlagText();
    }

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
}

ko.components.register('compound-filter', {
    viewModel: CompoundFilterComponent,
    template: { fromUrl: 'compound-filter.html' },
});

export = CompoundFilterComponent;