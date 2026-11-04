(globalThis["webpackChunk_canva_web"] = globalThis["webpackChunk_canva_web"] || []).push([[69798],{

/***/ 713538:
function(_, __, __webpack_require__) {__webpack_require__.n_x = __webpack_require__.n;const __web_req__ = __webpack_require__;__web_req__(905716);globalThis._5f74ec40302898c5a55451c9fbd04240 = globalThis._5f74ec40302898c5a55451c9fbd04240 || {};(function(__c) {var Lbc,Mbc,Obc;Lbc=function(a){return Array.isArray(a.k)&&typeof a.k[0]==="object"};__c.Nbc=function(a,b){if(a.assets)for(var c of a.assets)if("layers"in c)for(const e of c.layers){if(e.ty!==4)continue;const f=[];var d=e.shapes??[];for(const g of d)d=Mbc(g,b),f.push(d);e.shapes=f}if(a.layers)for(const e of a.layers)if(e.ty===4){a=[];c=e.shapes??[];for(const f of c)c=Mbc(f,b),a.push(c);e.shapes=a}};
Mbc=function(a,b){switch(a.ty){case "fl":case "st":if(Lbc(a.c))break;const d=Obc(a.c.k)?.Tr();if(d){var c=Array.from(b.keys()).find(e=>e===d);c&&b.get(c)!==void 0&&(b=b.get(c),b=__c.zr(b),a.c.k=[b.r/255,b.g/255,b.b/255,1])}break;case "gr":c=[];for(const e of a.it){const f=Mbc(e,b);c.push(f)}a.it=c}return a};Obc=function(a){if(a.length===4)return a=a.map(b=>Number((b*255).toFixed(2))),new __c.rr(a[0],a[1],a[2])};
}).call(globalThis, globalThis._5f74ec40302898c5a55451c9fbd04240);}

}])
//# sourceMappingURL=sourcemaps/3c8d795acd872618.js.map