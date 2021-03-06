
import {jsonGET, plainPUT} from "../base/network";
import {StateDump} from "../base/StateDump";
import {config} from "../config";
class StateStorage {
    baseUrl: string;

    constructor() {
        this.baseUrl = config.kvServerUrl;
    }
    
    get(id: string): Promise<StateDump> {
        return jsonGET(this.baseUrl + '/states/' + id);
    }
    
    put(id: string, value: string) {
        return plainPUT(this.baseUrl + '/states/' + id, value);
    }
}

export const stateStorage = new StateStorage();