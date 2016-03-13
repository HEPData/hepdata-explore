///<reference path="typings/browser.d.ts"/>
///<reference path="template-loader.ts"/>
///<reference path="components/all-components.ts"/>
///<reference path="filters/Filter.ts"/>
///<reference path="filters/KeywordFilter.ts"/>
///<reference path="filters/AllFilter.ts"/>
///<reference path="services/FilterIndex.ts"/>

class AppViewModel {
    rootFilter: Filter;

    currentFilterUri: KnockoutComputed<String>;

    private calcCurrentFilterUri(): String {
        return this.rootFilter.toDsl();
    }

    constructor() {
        this.rootFilter = new AllFilter([
            new KeywordFilter('miau'),
            new KeywordFilter('guau'),
            new AllFilter([
                new KeywordFilter('miau'),
                new KeywordFilter('guau'),
            ]),
        ]);
        this.currentFilterUri = ko.computed(this.calcCurrentFilterUri, this);
        this.currentFilterUri.subscribe((newFilterUri: string) => {
            console.log('Changed URL');
            history.replaceState(null, null, '#' + newFilterUri)
        })
    }
}

window.onhashchange = function() {
    console.log('User changed hash:');
    console.log(location.hash);
}

const app = new AppViewModel();
ko.applyBindings(app);