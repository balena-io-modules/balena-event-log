((root, factory) ->
	if typeof define is 'function' and define.amd
		# AMD. Register as an anonymous module.
		define [
			'../bower_components/resin-mixpanel-client/bin/resin-mixpanel-client'
			'lodash'
		], factory
	else if typeof exports is 'object'
		# Node. Does not work with strict CommonJS, but
		# only CommonJS-like enviroments that support module.exports,
		# like Node.
		module.exports = factory(
			require('./resin-mixpanel-client')
			require('lodash')
		)
) this, (ResinMixpanelClient, _) ->
	EVENTS =
		user: [
			'login'
			'logout'
			'signup'
			'passwordCreate'
			'passwordEdit'
			'emailEdit'
		]
		publicKey: [
			'create'
			'delete'
		]
		application: [
			'create'
			'open'
			'delete'
			'osDownload'
		]
		environmentVariable: [
			'create'
			'edit'
			'delete'
		]
		device: [
			'open'
			'rename'
			'delete'
			'terminalOpen'
			'terminalClose'
		]
		deviceEnvironmentVariable: [
			'create'
			'edit'
			'delete'
		]

	HOOKS =
		beforeCreate: (type, jsonData, applicationId, deviceId, callback) -> callback()
		afterCreate: (type, jsonData, applicationId, deviceId) -> #

	return (mixpanelToken, subsystem, hooks) ->
		if not mixpanelToken or not subsystem
			throw Error('mixpanelToken and subsystem are required to start events interaction.')

		hooks = _.merge(HOOKS, hooks)
		mixpanel = ResinMixpanelClient(mixpanelToken)

		getMixpanelUser = (userData) ->
			mixpanelUser = _.extend
				'$email': userData.email
				'$name': userData.username
			, userData

			return _.pick mixpanelUser, [
				'$email'
				'$name'
				'$created'
				'hasPasswordSet'
				'iat'
				'id'
				'permissions'
				'public_key'
				'username'
			]

		exported =
			subsystem: subsystem

			start: (user, callback) ->
				if not user
					throw Error('user is required to start events interaction.')

				@userId = user.id
				mixpanelUser = getMixpanelUser(user)

				login = ->
					mixpanel.login user.username, ->
						mixpanel.setUserOnce(mixpanelUser, callback)
				if (mixpanelUser.$created)
					return mixpanel.signup user.username, ->
						login()
				login()

			end: (callback) ->
				@userId = null
				mixpanel.logout(callback)

			create: (type, jsonData, applicationId, deviceId) ->
				hooks.beforeCreate.call this, type, jsonData, applicationId, deviceId, =>
					mixpanel.track "[#{@subsystem}] #{type}", {
						applicationId
						deviceId
						jsonData
					}, =>
						hooks.afterCreate.call(this, type, jsonData, applicationId, deviceId)


		_.forEach EVENTS, (events, base) ->
			exported[base] ?= {}
			_.forEach events, (event) ->
				exported[base][event] = (jsonData, applicationId = null, deviceId = null) ->
					exported.create(
						_.startCase("#{base} #{event}")
						jsonData, applicationId, deviceId
					)

		return exported