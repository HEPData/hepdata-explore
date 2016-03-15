import CompoundFilter = require("../filters/CompoundFilter");

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
    flagText: String;
    flagClass: String;

    constructor(params:any) {
        this.filter = params.filter;
        this.flagText = params.flagText;
        this.flagClass = params.flagClass;
    }

    get flagClasses() {
        return ['flag', this.flagClass].join(' ');
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
}

ko.components.register('compound-filter', {
    viewModel: CompoundFilterComponent,
    template: { fromUrl: 'compound-filter.html' },
});

export = CompoundFilterComponent;