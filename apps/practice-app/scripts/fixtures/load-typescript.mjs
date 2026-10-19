import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

export function typescriptLoader(root) {
  const cache = new Map();
  const load = file => {
    const name = path.resolve(root, file.endsWith('.ts') ? file : file + '.ts');
    if (cache.has(name)) return cache.get(name);
    const exports = {}; cache.set(name, exports);
    vm.runInNewContext(ts.transpileModule(readFileSync(name, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, require: id => id.startsWith('.') && !id.endsWith('.json')
      ? load(path.resolve(path.dirname(name), id)) : createRequire(name)(id),
      Intl, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch, Date, console }, { filename: name });
    return exports;
  };
  return load;
}
