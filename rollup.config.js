import module from 'module'
import path from 'path'
import pluginDts from 'rollup-plugin-dts'
import pluginTypescript from 'rollup-plugin-typescript2'
import { terser as pluginTerser } from 'rollup-plugin-terser'
import pkg from './package.json'

const external = [...module.builtinModules, ...Object.keys(pkg.dependencies || {})]

const targetDir = 'dist'

const plugins = [
  pluginTypescript({
    useTsconfigDeclarationDir: true,
    verbosity: 1
  })
]

if (process.env.BUILD === 'production') {
  plugins.push(
    pluginTerser({
      output: { comments: false },
      toplevel: true
    })
  )
}

export default [
  {
    external,
    input: 'lib/index.ts',
    output: {
      file: path.join(targetDir, 'index.js'),
      format: 'es',
      name: 'index',
      sourcemap: true
    },
    plugins
  },
  {
    external,
    input: './build/lib/index.d.ts',
    output: {
      file: path.join(targetDir, 'index.d.ts'),
      format: 'es'
    },
    plugins: [pluginDts({ verbose: true })]
  }
]
