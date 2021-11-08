const path = require('path')
const webpack = require('webpack')

/** @typedef {import('webpack').Configuration} WebpackConfig **/
/** @type WebpackConfig */
const webExtensionConfig = {
	mode: 'none',
	target: 'webworker',
	entry: {
		extension: './out/extension.js',
	},
	output: {
		filename: 'index.js',
		path: path.join(__dirname, './lib'),
		libraryTarget: 'commonjs',
		devtoolModuleFilenameTemplate: '../../[resource-path]'
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'],
		extensions: ['.js'],
		fallback: {
			assert: require.resolve('assert'),
			path: require.resolve('path-browserify'),
		}
	},
	plugins: [
		new webpack.ProvidePlugin({
			process: 'process/browser'
		})
	],
	externals: {
		vscode: 'commonjs vscode'
	},
	performance: {
		hints: false
	},
}

module.exports = [webExtensionConfig]
