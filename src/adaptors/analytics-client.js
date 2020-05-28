const { createWebTracker } = require('analytics-client');
const pick = require('lodash/pick');

const ONE_TIME_USER_FIELDS = ['$created'];

const UPDATE_USER_FIELDS = [
	'$email',
	'$name',
	'hasPasswordSet',
	'id',
	'permissions',
	'public_key',
	'username',
];

const userProperties = function (userData) {
	// TODO: Think about moving this to the analytics-client.
	const data = Object.assign(
		{
			$email: userData.email,
			$name: userData.username,
		},
		userData,
	);
	return {
		setOnce: pick(data, ONE_TIME_USER_FIELDS),
		set: pick(data, UPDATE_USER_FIELDS),
	};
};

module.exports = function (options) {
	const analyticsClient = options.analyticsClient;
	const tracker = createWebTracker(options.analyticsClient);

	return {
		login: async (user) => {
			if (!user) {
				return;
			}
			analyticsClient.setUserId(user.username);
			analyticsClient.setUserProperties(userProperties(user));
		},
		logout: async () => {
			analyticsClient.setUserId(null);
			analyticsClient.regenerateDeviceId();
		},
		track: async (prefix, type, data) => {
			tracker.track(`[${prefix}] ${type}`, data);
		},
		getDistinctId: () => {
			const id = analyticsClient.deviceId();
			return { analyticsClient: id, mixpanel: id };
		},
		identify: async (ids) => {
			const id = ids['analyticsClient'];
			if (!id) {
				return null;
			}
			analyticsClient.setUserId(id);
		},
	};
};
