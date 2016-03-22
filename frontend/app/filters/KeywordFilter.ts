import Filter = require("./Filter");

class KeywordFilter extends Filter {
    keyword: string;

    constructor(keyword: string = '') {
        super();
        this.keyword = keyword;
        ko.track(this);
    }

    static getLongName() {
        return 'Keyword filter';
    }

    getDslName() {
        return 'Keyword';
    }

    toElasticQuery(): any {
        throw new Error('Not implemented');
    }

    getDslParams() {
        return [
            {key: 'keyword', value: this.keyword},
        ];
    }

    getComponent() {
        return {
            name: 'keyword-filter-body',
            params: { filter: this }
        }
    }
}
export = KeywordFilter;