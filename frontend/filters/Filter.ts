///<reference path="../ComponentRef.ts"/>

interface DslParam {
    key: string;
    value: string;
}

abstract class Filter {
    abstract getLongName(): string;

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