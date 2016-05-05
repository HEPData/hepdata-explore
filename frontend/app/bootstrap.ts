///<reference path="../typings/browser.d.ts"/>

import {app} from "./AppViewModel";
window.onhashchange = function () {
    console.log('User changed hash: ' + location.hash);
    app.loadNewHash(location.hash);
};

(<any>window).app = app;
export = app;

ko.applyBindings(app);