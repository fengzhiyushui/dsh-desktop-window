// 构建浏览器端 client bundle。
// DSH 客户端模块系统要求每个 client bundle 的顶层副作用是：
//   window.__ModuleLoader__.load({ id, factory })
// factory 是惰性闭包：内部自建 `module`/`exports`，body 副作用在物化时才执行，
// 最后 return module.exports。裸 esbuild CJS 输出（module.exports = ...）不会注册，
// 加载器会报 "loaded without registering ... via __ModuleLoader__.load"。
// 另外 react 必须 external：官方 bundle 通过 require("react") 命中模块表的
// 种子词（shell 内核注册的共享 React），内联打包会产生第二份 React，
// 导致 Hooks 崩溃（Invalid hook call / Cannot read properties of null）。
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'lib', 'client.js')

const result = await build({
  entryPoints: [join(HERE, '..', 'src', 'client.js')],
  bundle: true,
  format: 'cjs',
  external: ['react'],
  write: false,
})

const body = result.outputFiles[0].text
const output = [
  'window.__ModuleLoader__.load({',
  '\tid: "dsh-desktop-window",',
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  body, // 已带尾换行
  '\t\treturn module.exports;',
  '\t}',
  '});',
  '',
].join('\n')

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, output)
console.log('built', OUT)
