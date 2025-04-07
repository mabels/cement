/**
 * Codemod to change import/require paths ending in .js to .cjs.
 *
 * Example:
 * import x from './file.js';  => import x from './file.cjs';
 * const y = require('./other.js'); => const y = require('./other.cjs');
 */
export default function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let changed = false; // Keep track if we made any changes

  const changeExtension = (pathValue) => {
    if (typeof pathValue === "string" && pathValue.endsWith(".js")) {
      // Check for relative paths specifically, though changing absolute might be okay depending on use case.
      // This example changes *any* path ending in .js. Add more checks if needed (e.g., must start with './' or '../').
      return pathValue.slice(0, -3) + ".cjs";
    }
    return null; // Indicate no change needed
  };

  // 1. Handle ES Module 'import ... from ...' statements
  root
    .find(j.ImportDeclaration, {
      // Find import declarations where the source is a Literal (string)
      source: { type: "Literal" },
    })
    .forEach((path) => {
      const originalPath = path.value.source.value;
      const newPath = changeExtension(originalPath);
      if (newPath) {
        // Replace the source Literal node with a new one
        path.value.source = j.stringLiteral(newPath);
        changed = true;
      }
    });

  // 2. Handle dynamic 'import()' expressions
  root
    .find(j.ImportExpression, {
      // Find dynamic import expressions where the source is a Literal (string)
      source: { type: "Literal" },
    })
    .forEach((path) => {
      const originalPath = path.value.source.value;
      const newPath = changeExtension(originalPath);
      if (newPath) {
        // Replace the source Literal node with a new one
        path.value.source = j.stringLiteral(newPath);
        changed = true;
      }
    });

  // 3. Handle CommonJS 'require(...)' calls
  root
    .find(j.CallExpression, {
      // Find call expressions where the callee is the identifier 'require'
      callee: { type: "Identifier", name: "require" },
    })
    .forEach((path) => {
      // Check if the first argument exists and is a Literal (string)
      if (path.value.arguments.length > 0 && path.value.arguments[0].type === "Literal") {
        const originalPath = path.value.arguments[0].value;
        const newPath = changeExtension(originalPath);
        if (newPath) {
          // Replace the argument Literal node with a new one
          path.value.arguments[0] = j.stringLiteral(newPath);
          changed = true;
        }
      }
    });

  // Only return the modified source if changes were made
  return changed ? root.toSource() : null;
}
