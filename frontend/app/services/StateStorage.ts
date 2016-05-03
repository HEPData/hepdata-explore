
import {jsonGET, plainPUT, HTTPError} from "../base/network";
class StateStorage {
    baseUrl: string;

    constructor() {
        if (location.host.indexOf('rufian.eu') != -1) {
            this.baseUrl = '/kv-server';
        } else {
            this.baseUrl = 'http://localhost:9201';
        }
    }
    
    get(id: string) {
        return jsonGET(this.baseUrl + '/states/' + id);
    }
    
    put(id: string, value: string) {
        return plainPUT(this.baseUrl + '/states/' + id, value);
    }
}

export const stateStorage = new StateStorage();