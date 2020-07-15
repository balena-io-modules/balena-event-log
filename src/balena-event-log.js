var pick = require('lodash/pick');
var startCase = require('lodash/startCase');

var EVENTS = {
	user: [
		'login',
		'logout',
		'signup',
		'passwordCreate',
		'passwordEdit',
		'emailEdit',
		'usernameEdit',
		'delete',
	],
	apiKey: ['create', 'edit', 'delete'],
	publicKey: ['create', 'delete'],
	application: [
		'create',
		'open',
		'osDownload',
		'osConfigDownload',
		'publicUrlEnable',
		'publicUrlDisable',
		'restart',
		'supportAccessEnable',
		'supportAccessDisable',
		'purge',
		'reboot',
		'shutdown',
		'applicationTypeChange',
		'delete',
		'pinToRelease',
	],
	applicationTag: ['set', 'create', 'edit', 'delete'],
	applicationMembers: ['create', 'edit', 'delete'],
	configVariable: ['create', 'edit', 'delete'],
	environmentVariable: ['create', 'edit', 'delete'],
	serviceVariable: ['create', 'edit', 'delete'],
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
		'pinToRelease',
		'diagnosticsDownload',
		'diagnosticsOpen',
		'diagnosticsRun',
		'healthChecksOpen',
		'healthChecksRun',
		'supervisorStateOpen',
	],
	release: [
		'addReleaseOpen',
		'instructionsCopy',
		'installLinkClick',
		'gettingStartedClick',
		'deployFromUrl',
	],
	deviceConfigVariable: ['create', 'edit', 'delete'],
	deviceEnvironmentVariable: ['create', 'edit', 'delete'],
	deviceServiceVariable: ['create', 'edit', 'delete'],
	deviceTag: ['set', 'create', 'edit', 'delete'],
	releaseTag: ['set', 'create', 'edit', 'delete'],
	billing: ['paymentInfoUpdate', 'planChange', 'invoiceDownload'],
	onboarding: ['stepClick', 'whatNextItemClick'],
	gettingStartedGuide: [
		'modalShow',
		'modalHide',
		'modalSkip',
		'modalGuideOpen',
	],
	page: ['visit'],
	navigation: ['click'],
	members: ['create', 'edit', 'delete', 'invite'],
	deployToBalena: ['open', 'cancel'],
	invite: ['addInviteOpen', 'create', 'delete', 'accept'],
};

var DEFAULT_HOOKS = {
	beforeCreate: function (
		_type,
		_jsonData,
		_applicationId,
		_deviceId,
		callback,
	) {
		return callback();
	},
	afterCreate: function (_error, _type, _jsonData, _applicationId, _deviceId) {
		// noop
	},
};

var ADAPTORS = [
	require('./adaptors/ga'),
	require('./adaptors/analytics-client'),
	require('./adaptors/gosquared'),
];

module.exports = function (options) {
	options = options || {};
	options = options || {};
	const { prefix, analyticsClient, debug } = options;
	if (!prefix) {
		throw Error('`prefix` is required.');
	}
	if (!analyticsClient) {
		throw Error('`analyticsClient` is required.');
	}

	var hooks = Object.assign(
		{},
		DEFAULT_HOOKS,
		pick(options, Object.keys(DEFAULT_HOOKS)),
	);

	var adaptors = ADAPTORS.map(function (adaptorFactory) {
		return adaptorFactory(options);
	}).filter(function (adaptor) {
		// Skip the adaptors that did not init (due to missing config options)
		return !!adaptor;
	});

	async function runForAllAdaptors(methodName, args, callback) {
		const p = Promise.all(
			adaptors.map(function (adaptor) {
				return adaptor?.[methodName]?.(...args);
			}),
		);
		if (callback) {
			p.then((result) => {
				callback(null, result);
			}, callback);
		}
		return p;
	}

	var eventLog = {
		userId: null,
		prefix: prefix,
		start: function (user, deviceIds, callback) {
			if (user) {
				if (!user.id || !user.username) {
					return Promise.reject(
						new Error('.id & .username are required when logging in a user'),
					);
				}
				this.userId = user.id;
			}

			return runForAllAdaptors('login', [user, deviceIds], callback);
		},
		end: function (callback) {
			if (!this.userId) {
				return Promise.resolve();
			}
			this.userId = null;
			return runForAllAdaptors('logout', [], callback);
		},
		create: function (type, jsonData, applicationId, deviceId, callback) {
			var _this = this;

			function runBeforeHook() {
				return new Promise(function (resolve, reject) {
					hooks.beforeCreate.call(
						_this,
						type,
						jsonData,
						applicationId,
						deviceId,
						(err, result) => {
							if (err) {
								return reject(err)
							}
							resolve(result)
						},
					);
				}).catch(function (err) {
					// discard the hook error
					if (debug) {
						console.warn('`beforeCreate` error', err);
					}
				});
			}

			function runAfterHook(err) {
				return new Promise(function (resolve) {
					resolve(hooks.afterCreate.call(
						_this,
						err,
						type,
						jsonData,
						applicationId,
						deviceId,
					));
				}).catch(function (err2) {
					// discard the hook error
					if (debug) {
						console.warn('`afterCreate` error', err2);
					}
				});
			}

			const p = runBeforeHook()
				.then(function () {
					return runForAllAdaptors('track', [
						_this.prefix,
						type,
						{
							applicationId: applicationId,
							deviceId: deviceId,
							jsonData: jsonData,
						},
					]);
				})
				.catch(function (err) {
					// catch the tracking error and call the hook
					runAfterHook(err);
					// rethrow the error to not call the hook for the second time in the next `.then`
					throw err;
				})
				.then(function () {
					return runAfterHook();
				})
				if (callback) {
					p.then((result) => {
						callback(null, result);
					}, callback);
				}
				return p;
		},
		// These functions are only available for use in the browser
		getDistinctId: function (callback) {
			return runForAllAdaptors('getDistinctId', [], callback);
		},
		identify: function (ids, callback) {
			return runForAllAdaptors('identify', [ids], callback);
		},
	};

	Object.keys(EVENTS).forEach(function (base) {
		var events = EVENTS[base];
		var obj = (eventLog[base] = {});
		events.forEach(function (event) {
			obj[event] = function (jsonData, applicationId, deviceId) {
				return eventLog.create(
					startCase(base + ' ' + event),
					jsonData,
					applicationId,
					deviceId,
				);
			};
		});
	});

	return eventLog;
};
