// ---------------------------------------------------------------------------
// Game content barrel. The actual kid-facing data lives in src/content/*:
//   grid.js     – tile size + field dimensions
//   towers.js   – TOWERS (helpers) + TOWER_ORDER
//   enemies.js  – ENEMIES (cute monsters + bosses)
//   levels.js   – PATHS, the themed AREAS, and the flattened LEVELS list
// This file just re-exports them so everything can `import … from './content.js'`.
// ---------------------------------------------------------------------------
export { TILE, COLS, ROWS, FIELD_W, FIELD_H } from './content/grid.js'
export { TOWERS, TOWER_ORDER } from './content/towers.js'
export { ENEMIES } from './content/enemies.js'
export { LEVELS, AREAS } from './content/levels.js'
