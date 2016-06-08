import DslParam = require("../base/DslParam");
import ComponentRef = require("../base/ComponentRef");
import {DataPoint, PublicationTable} from "../base/dataFormat";
import {filterRegistry} from "./filterRegistry";
import {assert, assertInstance} from "../utils/assert";
import {RuntimeError} from "../base/errors";

export interface FilterDump {
    type: string,
    params: any,
}

export abstract class Filter {

    // Can't be defined in TypeScript... so there you are.
    //abstract static getLongName(): string;

    /**
     * Human readable name of the filter that will be used in the UI.
     *
     * Must be implemented by every leaf class.
     */
    static getLongName(): string {
        throw new Error('Invoked abstract method');
    }


    /**
     * Returns a human readable name for this filter.
     */
    getLongName(): string {
        return (<typeof Filter>this.constructor).getLongName();
    }

    /** Not usable filters are ignored when the search is performed.
     *
     * A filter is usually set as not usable when it has just been created and
     * the user has not set their parameters, so they are empty and using them
     * would (in some filters, e.g. DepVar) make the search return zero results.
     */
    isUsable(): boolean {
        return true;
    }

    /**
     * Returns a query object that is embedded inside a the ElasticSearch
     * query.
     *
     * The returned object will always live inside a ``nested`` filter
     * with path = "tables".
     */
    abstract toElasticQuery(): any;

    /**
     * Returns an specification of the component that should be used to render
     * this filter in the UI.
     */
    abstract getComponent(): ComponentRef;

    /**
     * By default tables are only filtered by elastic search. This function
     * allows to add an additional client side filter.
     */
    filterTable(table: PublicationTable): boolean {
        return true;
    };

    /**
     * In some cases (notably CompoundFilter) it may be desirable to disable
     * removing the filter under some circumstances (e.g. nested children) to
     * avoid the user deleting the wrong filter and losing nested ones.
     *
     * This method allows implementing this restriction.
     */
    isRemoveAllowed() {
        return true;
    }

    // State serialization. This is used for saving the application state in the
    // server (and getting shareable short URLs in exchange).
    private _serializableParameters: string[] = [];

    /**
     * This method should be called in the constructor of derived classes to
     * register the fields that should be serialized and deserialized with 
     * load() and dump()
     * @param newFields New field names.
     */
    protected registerSerializableFields(newFields: string[]) {
        this._serializableParameters = this._serializableParameters.concat(newFields);
    }

    protected dumpParameters(): {} {
        assert(this._serializableParameters.length > 0, 'Serializable parameters ' +
            'not declared in class ' + this.constructor.name);

        const ret: any = {};
        for (let fieldName of this._serializableParameters) {
            ret[fieldName] = this.dumpValue((<any>this)[fieldName]);
        }
        return ret;
    };
    protected loadParameters(params: any): void {
        for (let key in params) {
            assert(this._serializableParameters.indexOf(key) != -1,
                'Unknown parameter found in class ' + this.constructor.name +
                ': ' + key);

            (<any>this)[key] = this.loadValue(params[key]);
        }
    }

    /**
     * Fields may have nested filters inside. This function serializes them
     * recursively.
     */
    private dumpValue(value: any): any {
        if (Array.isArray(value)) {
            return _.map(value, (v) => this.dumpValue(v));
        } else if (value instanceof Filter) {
            return (<Filter>value).dump();
        } else {
            return value;
        }
    }

    /**
     * Counterpart to dumpValue(), deserializes nested filters recursively if
     * used as a field value.
     */
    private loadValue(value: any|null): any {
       if (Array.isArray(value)) {
           return _.map(value, (v) => this.loadValue(v));
       } else if (value !== null && typeof value == 'object' && 'type' in value) {
           return Filter.load(value);
       } else {
           return value;
       }
    }

    /**
     * Serializes this filter.
     */
    public dump(): FilterDump {
        return {
            type: this.constructor.name,
            params: this.dumpParameters(),
        }
    }

    /**
     * Deserializes a filter.
     */
    public static load(dump: FilterDump): Filter {
        const constructor = filterRegistry.get(dump.type);
        if (!constructor)
            throw new RuntimeError('Could not find constructor for ' + dump.type);

        const instance = new constructor();
        instance.loadParameters(dump.params);
        return instance;
    }

    /**
     * Deeply explores this filter children (if any) in search of `oldFilter`.
     * If found, replaces it with newFilter.
     *
     * Returns boolean indicating whether a replacement was made.
     */
    public replaceFilter(oldFilter: Filter, newFilter: Filter): boolean {
        // This (and most) filters don't have children, so the search fails.
        return false;
    }
}