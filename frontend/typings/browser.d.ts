/// <reference path="browser/ambient/bluebird/index.d.ts" />
/// <reference path="browser/ambient/crossfilter/index.d.ts" />
/// <reference path="browser/ambient/d3/index.d.ts" />
/// <reference path="browser/ambient/dc/index.d.ts" />
/// <reference path="browser/ambient/gl-matrix/index.d.ts" />
/// <reference path="browser/ambient/jasmine/index.d.ts" />
/// <reference path="browser/ambient/jquery/index.d.ts" />
/// <reference path="browser/ambient/js-yaml/index.d.ts" />
/// <reference path="browser/ambient/knockout.es5/index.d.ts" />
/// <reference path="browser/ambient/knockout.rx/index.d.ts" />
/// <reference path="browser/ambient/knockout/index.d.ts" />
/// <reference path="browser/ambient/lodash/index.d.ts" />
/// <reference path="browser/ambient/lunr/index.d.ts" />
/// <reference path="browser/ambient/map2/map2.d.ts" />
/// <reference path="browser/ambient/rx-dom/index.d.ts" />
/// <reference path="browser/ambient/rx-lite/index.d.ts" />
/// <reference path="browser/ambient/rx.async/index.d.ts" />
/// <reference path="browser/ambient/rx.binding-lite/index.d.ts" />
/// <reference path="browser/ambient/rx.time-lite/index.d.ts" />
/// <reference path="browser/ambient/rx.time/index.d.ts" />
/// <reference path="browser/ambient/rx/index.d.ts" />
/// <reference path="browser/ambient/set2/set2.d.ts" />


// https://github.com/eligrey/FileSaver.js/
declare function saveAs(blob: Blob, fileName: string): void;

declare function stableStringify(thing: any): string;