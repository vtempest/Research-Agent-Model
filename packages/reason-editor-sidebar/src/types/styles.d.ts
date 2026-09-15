/**
 * Ambient declarations for the stylesheets this package imports for their side
 * effects. Vite turns such an import into a bundled `<style>`; TypeScript 7
 * refuses one without a declaration:
 *
 *   error TS2882: Cannot find module or type declarations for side-effect
 *   import of './filemanager.css'.
 */

declare module '*.css';
declare module '*.scss';
