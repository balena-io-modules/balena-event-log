var assign = require('lodash/assign')
var pick = require('lodash/pick')
var Promise = require('bluebird')

var ResinMixpanelClient = require('resin-mixpanel-client')

var ONE_TIME_USER_FIELDS = [
	'$created'
]

var UPDATE_USER_FIELDS = [
	'$email',
	'$name',
	'hasPasswordSet',
	'iat',
	'id',
	'permissions',
	'public_key',
	'username'
]

var getMixpanelUser = function(userData) {
	var mixpanelUser = assign({
		'$email': userData.email,
		'$name': userData.username
	}, userData)
	return {
		oneTime: pick(mixpanelUser, ONE_TIME_USER_FIELDS),
		update: pick(mixpanelUser, UPDATE_USER_FIELDS)
	}
}

module.exports = function (options) {
	var debug = options.debug,
		token = options.mixpanelToken,
		mixpanelOptions = options.mixpanelHost ? {
			api_host: options.mixpanelHost,
			decide_host: options.mixpanelHost
		} : {}

	if (!token) {
		if (debug) {
			console.warn("`mixpanelToken` is not set, Mixpanel tracking is disabled")
		}
		return null
	}

	var mixpanel = ResinMixpanelClient(token, mixpanelOptions)

	return {
		login: function(user) {
			if (!user) return
			var methodName = user.$created ? 'signup' : 'login'
			var mixpanelUser = getMixpanelUser(user)

			return mixpanel[methodName](user.username)
				.then(function() {
					// Calling this also ensures that the auto-tracked properties
					// ($os, $browser, $browser_version, $initial_referrer, $initial_referring_domain)
					// are collected and sent
					return mixpanel.setUser(mixpanelUser.update)
				})
				.then(function() {
					return mixpanel.setUserOnce(mixpanelUser.oneTime)
				})
		},
		logout: function() {
			return mixpanel.logout()
		},
		track: function (prefix, type, data) {
			return mixpanel.track("[" + prefix + "] " + type, data)
		}
	}
}
