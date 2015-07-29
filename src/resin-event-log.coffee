((root, factory) ->
	if typeof define is 'function' and define.amd
		# AMD. Register as an anonymous module.
		define ['lodash', '../bower_components/node-uuid/uuid'], factory
	else if typeof exports is 'object'
		# Node. Does not work with strict CommonJS, but
		# only CommonJS-like enviroments that support module.exports,
		# like Node.
		module.exports = factory(require('lodash'), require('node-uuid'))
) this, (_, uuid) ->
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
		beforeStart: (userId, interactionUuid) -> #
		afterStart: (userId, interactionUuid) -> #
		beforeEnd: -> #
		afterEnd: -> #
		beforeCreate: (type, jsonData, applicationId, deviceId) -> #
		afterCreate: (type, jsonData, applicationId, deviceId) -> #

	return (PinejsClient, subsystem, hooks) ->
		if not subsystem
			throw Error('subsystem is required to start events interaction.')

		hooks = _.merge(HOOKS, hooks)

		exported =
			subsystem: subsystem

			start: (userId, interactionUuid) ->
				hooks.beforeStart.apply(this, arguments)
				if not userId
					throw Error('userId is required to start events interaction.')

				@userId = userId
				@interactionUuid = interactionUuid or uuid()
				hooks.afterStart.call(this, @userId, @interactionUuid)

			end: ->
				hooks.beforeEnd.apply(this)
				@userId = null
				@interactionUuid = null
				hooks.afterEnd.apply(this)

			create: (type, jsonData, applicationId, deviceId) ->
				args = arguments

				hooks.beforeCreate.apply(this, args)
				PinejsClient.post
					resource: 'event'
					body:
						user: @userId
						interaction_uuid: @interactionUuid
						application_id: applicationId
						device_id: deviceId
						type: "[#{@subsystem}] #{type}"
						json_data: jsonData
				.then =>
					hooks.afterCreate.apply(this, args)


		_.forEach EVENTS, (events, base) ->
			exported[base] ?= {}
			_.forEach events, (event) ->
				exported[base][event] = (jsonData, applicationId = null, deviceId = null) ->
					exported.create(
						_.startCase("#{base} #{event}")
						jsonData, applicationId, deviceId
					)

		return exported