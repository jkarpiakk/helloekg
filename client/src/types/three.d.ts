// three.js ships no bundled types and @types/three isn't installed here.
// This ambient declaration keeps `import("three")` type-clean under `strict`
// (three resolves to `any`). Vite bundles the real module at build time, so
// runtime is unaffected.
// TODO: `npm i -D @types/three` to restore full typing for the 3D heart.
declare module "three";
