import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
	files: '.test/test/**/*.test.js',
	mocha: {
      ui: 'bdd',
      timeout: 20000
    },
})
