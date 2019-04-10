var ResinGaClient = require('resin-universal-ga')

module.exports = function (options) {
	var debug = options.debug,
		propertyId = options.gaId,
		site = options.gaSite

	if (!(propertyId && site)) {
		if (debug) {
			console.warn("`gaId` and/or `gaSite` are not set, GA tracking is disabled")
		}
		return null
	}

	var gaClient = ResinGaClient(propertyId, site, debug)

	return {
		login: function(user) {
			if (user) {
				return gaClient.login(user.id)
			} else {
				if (debug) console.warn("GA: user.id not set, continuing with anon login")
				return gaClient.anonLogin()
			}
		},
		logout: function() {
			return gaClient.logout()
		},
		track: function (prefix, type, data) {
			return gaClient.track(site, type, prefix, data)
		}
	}
}
