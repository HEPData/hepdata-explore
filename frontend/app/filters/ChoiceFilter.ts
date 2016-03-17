import Filter = require("./Filter");

class ChoiceFilter extends Filter {
    constructor(public field: string = '', public value = '') {
        super();
        ko.track(this);
    }

    static getLongName() {
        return 'Choice filter';
    }

    getDslName() {
        return 'Choice';
    }

    getDslParams() {
        return [
            {key: this.field, value: this.value},
        ];
    }

    getComponent() {
        return {
            name: 'choice-filter',
            params: { filter: this }
        }
    }
}
export = ChoiceFilter;