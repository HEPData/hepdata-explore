import CompoundFilter = require("../filters/CompoundFilter");

// http://ejohn.org/blog/comparing-document-position/
function htmlContains(a: HTMLElement, b: HTMLElement){
    return a.contains ?
    a != b && a.contains(b) :
        !!(a.compareDocumentPosition(b) & 16);
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
    dragulaAccept(el: HTMLElement, target: HTMLElement, source: HTMLElement,
                  sibling: HTMLElement)
    {
        // prevent dragged containers from trying to drop inside itself
        return !htmlContains(el,target);
    }
}

ko.components.register('compound-filter', {
    viewModel: CompoundFilterComponent,
    template: { fromUrl: 'compound-filter.html' },
});

export = CompoundFilterComponent;