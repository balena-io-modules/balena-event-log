var GsClient = require('balena-universal-gosquared');

module.exports = function (options) {
	var debug = options.debug;
	var gosquaredId = options.gosquaredId;
	var apiKey = options.gosquaredApiKey;
	var isBrowser = typeof window !== 'undefined';

	if (!gosquaredId) {
		if (debug) {
			console.warn('`gosquaredId` is not set, gosquared tracking is disabled');
		}
		return null;
	}

	if (!isBrowser && !apiKey) {
		if (debug) {
			console.warn(
				'`gosquaredApiKey` is not set, gosquared tracking is disabled',
			);
		}
		return null;
	}

	var gsClient = GsClient(gosquaredId, apiKey, debug);

	return {
		login: function (user) {
			if (user) {
				return gsClient.login(user.id);
			} else {
				if (debug) {
					console.warn(
						'Gosquared: user.id not set, continuing with anon login',
					);
				}
				return gsClient.anonLogin();
			}
		},
		logout: function () {
			return gsClient.logout();
		},
		track: function (prefix, type, data) {
			return gsClient.track(prefix, type, data);
		},
		getDistinctId: function () {
			return { gs: null };
		},
		identify: function () {
			return null;
		},
	};
};
