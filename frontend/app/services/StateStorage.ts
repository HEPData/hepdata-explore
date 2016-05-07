
import {jsonGET, plainPUT, HTTPError} from "../base/network";
import {StateDump} from "../base/StateDump";
class StateStorage {
    baseUrl: string;

    constructor() {
        if (location.host.indexOf('rufian.eu') != -1) {
            this.baseUrl = '/kv-server';
        } else {
            this.baseUrl = 'http://' + location.hostname + ':9201';
        }
    }
    
    get(id: string): Promise<StateDump> {
        return jsonGET(this.baseUrl + '/states/' + id);
    }
    
    put(id: string, value: string) {
        return plainPUT(this.baseUrl + '/states/' + id, value);
    }
}

export const stateStorage = new StateStorage();