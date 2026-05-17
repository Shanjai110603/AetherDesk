import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import _generate from '@babel/generator';

// Handle ESM default export interop for Babel packages in Vite
const traverse = typeof _traverse === 'function' ? _traverse : (_traverse as any).default;
const generate = typeof _generate === 'function' ? _generate : (_generate as any).default;

export function injectComponentToAst(
  sourceCode: string,
  componentName: string,
  importPath: string
): string {
  try {
    // 1. Parse the source code into an AST
    const ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    let hasImport = false;
    let lastImportIndex = -1;

    // 2. Find last import and check if component is already imported
    traverse(ast, {
      ImportDeclaration(path: any) {
        lastImportIndex = ast.program.body.indexOf(path.node);
        if (
          path.node.source.value === importPath &&
          path.node.specifiers.some(
            (specifier: any) =>
              t.isImportDefaultSpecifier(specifier) &&
              specifier.local.name === componentName
          )
        ) {
          hasImport = true;
        }
      },
    });

    // 3. Inject Import if missing
    if (!hasImport) {
      const newImport = t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier(componentName))],
        t.stringLiteral(importPath)
      );
      
      if (lastImportIndex >= 0) {
        ast.program.body.splice(lastImportIndex + 1, 0, newImport);
      } else {
        ast.program.body.unshift(newImport);
      }
    }

    // 4. Inject JSX Component Tag
    let injected = false;
    traverse(ast, {
      ReturnStatement(path: any) {
        if (injected) return;
        
        const arg = path.node.argument;
        if (t.isJSXElement(arg) || t.isJSXFragment(arg)) {
          const newElement = t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier(componentName), [], true),
            null,
            [],
            true
          );

          if (t.isJSXElement(arg)) {
             // Append to root element children
             arg.children.push(t.jsxText('\n      '));
             arg.children.push(newElement);
             arg.children.push(t.jsxText('\n    '));
             injected = true;
          } else if (t.isJSXFragment(arg)) {
             arg.children.push(t.jsxText('\n      '));
             arg.children.push(newElement);
             arg.children.push(t.jsxText('\n    '));
             injected = true;
          }
        }
      }
    });

    // 5. Generate code from modified AST
    const result = generate(ast, { retainLines: false, compact: false }, sourceCode);
    return result.code;
  } catch (error) {
    console.error("AST Injection failed:", error);
    throw new Error(`Failed to inject component ${componentName} via AST manipulation.`);
  }
}
