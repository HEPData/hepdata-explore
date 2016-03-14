import DslParam = require("../app/base/DslParam");
import ComponentRef = require("../app/base/ComponentRef");

abstract class Filter {
    // Can't be defined in TypeScript... so there you are.
    //abstract static getLongName(): string;
    static getLongName(): string {
        throw new Error('Invoked abstract method');
    }

    getLongName(): string {
        return (<typeof Filter>this.constructor).getLongName();
    }

    abstract getDslName(): string;
    getDslParams(): DslParam[] {
        return null;
    };
    getDslItems(): Filter[] {
        return null;
    }

    toDsl(): string {
        let ret = this.getDslName();
        const params = this.getDslParams();
        const items = this.getDslItems();

        if (params !== null) {
            ret += '(' + params
                    .map(param => param.key + '=' + param.value)
                    .join(',')
                + ')';
        }
        
        if (items !== null) {
            ret += '{' + items
                    .map(filter => filter.toDsl())
                    .join(',')
                + '}';
        }

        return ret;
    }

    abstract getComponent(): ComponentRef;

    isRemoveAllowed() {
        return true;
    }
}

export = Filter;