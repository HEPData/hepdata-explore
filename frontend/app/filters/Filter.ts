import DslParam = require("../app/base/DslParam");
import ComponentRef = require("../app/base/ComponentRef");
import {DataPoint, PublicationTable} from "../base/dataFormat";
import {filterRegistry} from "./filterRegistry";
import {assert, assertInstance} from "../utils/assert";

export interface FilterDump {
    type: string,
    params: any,
}

export abstract class Filter {
    // Can't be defined in TypeScript... so there you are.
    //abstract static getLongName(): string;
    static getLongName(): string {
        throw new Error('Invoked abstract method');
    }

    getLongName(): string {
        return (<typeof Filter>this.constructor).getLongName();
    }

    abstract toElasticQuery(): any;

    abstract getComponent(): ComponentRef;

    abstract filterTable(table: PublicationTable): boolean;

    isRemoveAllowed() {
        return true;
    }

    // State serialization. This is used for saving the application state in the
    // server (and getting shareable short URLs in exchange).
    private _serializableParameters: string[] = [];

    /** This method should be called in the constructor of derived classes to
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

        const ret = {};
        for (let fieldName of this._serializableParameters) {
            ret[fieldName] = this.dumpValue(this[fieldName]);
        }
        return ret;
    };
    protected loadParameters(params: any): void {
        for (let key in params) {
            assert(this._serializableParameters.indexOf(key) != -1,
                'Unknown parameter found in class ' + this.constructor.name +
                ': ' + key);

            this[key] = this.loadValue(params[key]);
        }
    }

    /** Fields may have nested filters inside. This function serializes them
     * recursively. */
    private dumpValue(value: any) {
        if (Array.isArray(value)) {
            return _.map(value, (v) => this.dumpValue(v));
        } else if (value instanceof Filter) {
            return (<Filter>value).dump();
        } else {
            return value;
        }
    }

    /** Counterpart to dumpValue(), deserializes nested filters recursively if
     * used as a field value. */
    private loadValue(value: any) {
       if (Array.isArray(value)) {
           return _.map(value, (v) => this.loadValue(v));
       } else if (typeof value == 'object' && 'type' in value) {
           return Filter.load(value);
       } else {
           return value;
       }
    }

    /** Serializes this filter. */
    public dump(): FilterDump {
        return {
            type: this.constructor.name,
            params: this.dumpParameters(),
        }
    }

    /** Deserializes a filter. */
    public static load(dump: FilterDump) {
        const constructor = filterRegistry.get(dump.type);
        assert(constructor != null, 'Could not find constructor for ' + dump.type);

        const instance = new constructor();
        instance.loadParameters(dump.params);
        return instance;
    }
}