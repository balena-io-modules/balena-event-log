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

const getUserProperties = function (userData) {
	// TODO: Think about moving this to the analytics-client.
	const data = Object.assign(
		{
			$email: userData.email,
			$name: userData.username,
		},
		userData,
	);
	return {
		$setOnce: pick(data, ONE_TIME_USER_FIELDS),
		$set: pick(data, UPDATE_USER_FIELDS),
	};
};

module.exports = function (options) {
	const analyticsClient = options.analyticsClient;

	// TODO: Remove direct Amplitude interface usage.
	const amplitude = analyticsClient.amplitude();
	const tracker = createWebTracker(options.analyticsClient);

	return {
		login: async (user) => {
			if (!user) {
				return;
			}
			amplitude.setUserProperties(getUserProperties(user));
			amplitude.setUserId(user.username);
		},
		logout: async () => {
			amplitude.setUserId(null);
			amplitude.regenerateDeviceId();
		},
		track: async (prefix, type, data) => {
			tracker.track(`[${prefix}] ${type}`, data);
		},
		getDistinctId: function () {
			const id = analyticsClient.deviceId();
			return { analyticsClient: id, mixpanel: id };
		},
		identify: async (ids) => {
			const id = ids['analyticsClient'];
			if (!id) {
				return null;
			}
			amplitude.setUserId(id);
		},
	};
};
