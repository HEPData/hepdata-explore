///<reference path="Filter.ts"/>

class KeywordFilter extends Filter {
    keyword: KnockoutObservable<string>;

    constructor(keyword: string = '') {
        super();
        this.keyword = ko.observable(keyword);
    }

    getLongName() {
        return 'Keyword filter';
    }

    getDslName() {
        return 'Keyword';
    }

    getDslParams() {
        return [
            {key: 'keyword', value: this.keyword()},
        ];
    }

    getComponent() {
        return {
            name: 'keyword-filter-body',
            params: { filter: this }
        }
    }
}