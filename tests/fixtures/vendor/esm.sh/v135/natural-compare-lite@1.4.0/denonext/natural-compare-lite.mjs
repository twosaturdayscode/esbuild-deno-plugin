/* esm.sh - esbuild bundle(natural-compare-lite@1.4.0) denonext production */
var y=Object.create;var C=Object.defineProperty;var O=Object.getOwnPropertyDescriptor;var b=Object.getOwnPropertyNames;var j=Object.getPrototypeOf,k=Object.prototype.hasOwnProperty;var q=(a,t)=>()=>(t||a((t={exports:{}}).exports,t),t.exports),w=(a,t)=>{for(var n in t)C(a,n,{get:t[n],enumerable:!0})},A=(a,t,n,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let f of b(t))!k.call(a,f)&&f!==n&&C(a,f,{get:()=>t[f],enumerable:!(i=O(t,f))||i.enumerable});return a},l=(a,t,n)=>(A(a,t,"default"),n&&A(n,t,"default")),v=(a,t,n)=>(n=a!=null?y(j(a)):{},A(t||!a||!a.__esModule?C(n,"default",{value:a,enumerable:!0}):n,a));var g=q((G,S)=>{var B=function(a,t){var n,i,f=1,m=0,x=0,e=String.alphabet;function p(_,h,r){if(r){for(n=h;r=p(_,n),r<76&&r>65;)++n;return+_.slice(h-1,n)}return r=e&&e.indexOf(_.charAt(h)),r>-1?r+76:(r=_.charCodeAt(h)||0,r<45||r>127?r:r<46?65:r<48?r-1:r<58?r+18:r<65?r-11:r<91?r+11:r<97?r-37:r<123?r+5:r-63)}if((a+="")!=(t+="")){for(;f;)if(i=p(a,m++),f=p(t,x++),i<76&&f<76&&i>66&&f>66&&(i=p(a,m,m),f=p(t,x,m=n),x=n),i!=f)return i<f?-1:1}return 0};try{S.exports=B}catch{String.naturalCompare=B}});var u={};w(u,{default:()=>E});var z=v(g());l(u,v(g()));var{default:s,...D}=z,E=s!==void 0?s:D;export{E as default};
/*! Bundled license information:

natural-compare-lite/index.js:
  (*
   * @version    1.4.0
   * @date       2015-10-26
   * @stability  3 - Stable
   * @author     Lauri Rooden (https://github.com/litejs/natural-compare-lite)
   * @license    MIT License
   *)
*/
//# sourceMappingURL=natural-compare-lite.mjs.map