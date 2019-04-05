karmaConfig = require('resin-config-karma')
packageJSON = require('./package.json')

module.exports = function (config) {
	karmaConfig.logLevel = config.LOG_INFO
	karmaConfig.sauceLabs = {
		testName: packageJSON.name + ' v' + packageJSON.version
	}
	karmaConfig.client = {
		captureConsole: true
	}
	karmaConfig.preprocessors['test/**/*.js'] = [ 'browserify' ]
	karmaConfig.files = [
		'test/*.spec.js'
	]
	config.set(karmaConfig)
}
