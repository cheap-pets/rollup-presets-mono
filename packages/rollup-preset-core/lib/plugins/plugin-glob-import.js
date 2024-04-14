import { glob } from 'glob'
import { camelCase } from 'change-case'
import { customAlphabet } from 'nanoid'
import { isFunction } from '../utils/type.js'
import { resolve, basename, dirname, extname } from 'node:path'

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10)

function plugin (options = {}) {
  const {
    namedExport = false,
    exportNames = '[name]',
    indexFileExportName
  } = options

  const getExportName = isFunction(exportNames)
    ? exportNames
    : () => exportNames

  function resolveModuleName (file) {
    const dirName = camelCase(basename(dirname(file)))
    const baseName = camelCase(basename(file, extname(file)))

    return getExportName(file)
      .replaceAll('[name]', (indexFileExportName && baseName === 'index') ? indexFileExportName : baseName)
      .replaceAll('[dirname]', dirName)
  }

  return {
    name: 'glob-import',

    resolveId (source, importer) {
      return source.includes('*')
        ? `${source}?globImporter=${importer}`
        : null
    },

    async load (id) {
      const matched = /(.*)\?globImporter=([^?]+)$/.exec(id)

      if (!matched) return null

      const pattern = matched[1]
      const importer = matched[2] // resolve(matched[2])

      const dir = dirname(importer)
      const files = await glob(pattern, { cwd: dir, nodir: true })

      const codes = []
      const exports = []

      files.forEach(el => {
        const file = resolve(dir, el)

        if (file !== importer) {
          const importName = `$${nanoid()}`

          codes.push(
            `import * as ${importName} from ${JSON.stringify(file)};`
          )

          exports.push(
            namedExport
              ? [resolveModuleName(el), importName]
              : importName
          )
        }
      })

      codes.push(
        namedExport
          ? `export default {\n  ${
              exports.map(([key, value]) => `${key}: ${value}`).join(',\n  ')
            }\n};`
          : `export default [\n  ${
              exports.join(',\n  ')
            }\n];`,
        ''
      )

      return codes.join('\n')
    }
  }
}

export default plugin
