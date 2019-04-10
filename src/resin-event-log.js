var Promise = require('bluebird')
var assign = require('lodash/assign')
var pick = require('lodash/pick')
var keys = require('lodash/keys')
var startCase = require('lodash/startCase')


var EVENTS = {
	user: [ 'login', 'logout', 'signup', 'passwordCreate', 'passwordEdit', 'emailEdit', 'usernameEdit' ],
	apiKey: [ 'create', 'edit', 'delete' ],
	publicKey: [ 'create', 'delete' ],
	application: [
		'create',
		'open',
		'osDownload',
		'publicUrlEnable',
		'publicUrlDisable',
		'restart',
		'supportAccessEnable',
		'supportAccessDisable',
		'purge',
		'reboot',
		'shutdown',
		'applicationTypeChange',
		'delete'
	],
	applicationTag: [ 'set', 'create', 'edit', 'delete' ],
	applicationMembers: [ 'create', 'edit', 'delete' ],
	configVariable: [ 'create', 'edit', 'delete' ],
	environmentVariable: [ 'create', 'edit', 'delete' ],
	serviceVariable: [ 'create', 'edit', 'delete' ],
	device: [
		'open',
		'rename',
		'terminalOpen',
		'terminalClose',
		'publicUrlEnable',
		'publicUrlDisable',
		'lockOverrideEnable',
		'lockOverrideDisable',
		'restart',
		'move',
		'hostOsUpdate',
		'hostOsUpdateHide',
		'hostOsUpdateFailed',
		'hostOsUpdateSucceeded',
		'localModeEnable',
		'localModeDisable',
		'supportAccessEnable',
		'supportAccessDisable',
		'purge',
		'reboot',
		'shutdown',
		'delete',
		'deactivate',
	],
	deviceConfigVariable: [ 'create', 'edit', 'delete' ],
	deviceEnvironmentVariable: [ 'create', 'edit', 'delete' ],
	deviceServiceVariable: [ 'create', 'edit', 'delete' ],
	deviceTag: [ 'set', 'create', 'edit', 'delete' ],
	releaseTag: [ 'set', 'create', 'edit', 'delete' ],
	billing: [ 'paymentInfoUpdate', 'planChange', 'invoiceDownload' ],
	page: [ 'visit' ],
	navigation: ['click']
}

var DEFAULT_HOOKS = {
	beforeCreate: function(type, jsonData, applicationId, deviceId, callback) {
		return callback()
	},
	afterCreate: function(error, type, jsonData, applicationId, deviceId) {}
}

var ADAPTORS = [
	require('./adaptors/ga'),
	require('./adaptors/mixpanel'),
	require('./adaptors/gosquared')
]

module.exports = function(options) {
	options = options || {}
	var prefix = options.prefix,
		debug = options.debug
	if (!prefix) {
		throw Error('`prefix` is required.')
	}

	var hooks = assign(
		{},
		DEFAULT_HOOKS,
		pick(options, keys(DEFAULT_HOOKS))
	)

	var adaptors = ADAPTORS.map(function (adaptorFactory) {
		return adaptorFactory(options)
	}).filter(function (adaptor) {
		// Skip the adaptors that did not init (due to missing config options)
		return !!adaptor
	})

	function runForAllAdaptors(methodName, args, callback) {
		return Promise.map(adaptors, function (adaptor) {
			return adaptor[methodName]
				? adaptor[methodName].apply(adaptor, args)
				: null
		}).asCallback(callback)
	}

	var eventLog = {
		userId: null,
		prefix: prefix,
		start: function(user, callback) {
			if (user) {
				if (!user.id || !user.username) {
					return Promise.reject(
						new Error('.id & .username are required when logging in a user')
					)
				}
				this.userId = user.id
			}

			return runForAllAdaptors('login', [ user ], callback)
		},
		end: function(callback) {
			if (!this.userId) {
				return Promise.resolve()
			}
			this.userId = null
			return runForAllAdaptors('logout', [], callback)
		},
		create: function(type, jsonData, applicationId, deviceId, callback) {
			var _this = this

			function runBeforeHook() {
				return Promise.fromCallback(function(callback) {
					hooks.beforeCreate.call(_this, type, jsonData, applicationId, deviceId, callback)
				}).catch(function (err) {
					// discard the hook error
					if (debug) {
						console.warn("`beforeCreate` error", err)
					}
				})
			}

			function runAfterHook(err) {
				return Promise.try(function() {
					hooks.afterCreate.call(_this, err, type, jsonData, applicationId, deviceId)
				}).catch(function (err) {
					// discard the hook error
					if (debug) {
						console.warn("`afterCreate` error", err)
					}
				})
 			}

			return runBeforeHook()
				.then(function() {
					return runForAllAdaptors('track', [
						_this.prefix, type, {
							applicationId: applicationId,
							deviceId: deviceId,
							jsonData: jsonData
						}
					])
				}).catch(function (err) {
					// catch the tracking error and call the hook
					runAfterHook(err)
					// rethrow the error to not call the hook for the second time in the next `.then`
					throw err
				}).then(function () {
					return runAfterHook()
				}).asCallback(callback)
		}
	}

	keys(EVENTS).forEach(function (base) {
		var events = EVENTS[base]
		var obj = eventLog[base] = {}
		events.forEach(function(event) {
			obj[event] = function(jsonData, applicationId, deviceId) {
				return eventLog.create(startCase(base + " " + event), jsonData, applicationId, deviceId)
			}
		})
	})

	return eventLog
}
