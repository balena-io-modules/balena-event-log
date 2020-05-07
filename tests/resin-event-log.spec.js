var _ = require('lodash')
var expect = require('chai').expect
var base64Decode = require('base-64').decode
var querystring = require('querystring')
var mock = require('resin-universal-http-mock')

var IS_BROWSER = typeof window !== 'undefined'

// NB: set to true to get some extra reporting
var EXTRA_DEBUG = false

if (IS_BROWSER) {
	window.MIXPANEL_CUSTOM_LIB_URL = 'http://cdn.mxpnl.com/libs/mixpanel-2-latest.js'
	if (EXTRA_DEBUG) {
		window.GA_CUSTOM_LIB_URL = 'https://www.google-analytics.com/analytics_debug.js'
	}
}

var BalenaEventLog = require('..')

var MIXPANEL_TOKEN = 'MIXPANEL_TOKEN'
var SYSTEM = 'TEST'
var MIXPANEL_HOST = 'https://api.mixpanel.com'
var MIXPANEL_BROWSER_HOST = 'https://api-js.mixpanel.com'
var GA_ID = 'UA-123456-0'
var GA_SITE = 'balena-dev.com'
var GOSQUARED_ID = 'GSN-575655-Q'
var GOSQUARED_API_KEY = '12345'
var GOSQUARED_HOST = 'https://api.gosquared.com'
var GA_HOST = 'https://www.google-analytics.com'
var FAKE_USER = {
	username: 'fake',
	id: 123,
	email: 'fake@example.com',
	$created: new Date().toISOString()
}
var FAKE_EVENT = 'x'

function aggregateMock(mocks) {
	return {
		isDone: function() {
			return _.some(mocks, function(mock) {
				return mock.isDone()
			})
		}
	}
}

function validateMixpanelQuery(event, user) {
	return function(queryObject) {
		var data = queryObject.data
		if (!data) return false

		try {
			data = JSON.parse(base64Decode(data))

			if (data.event === '$create_alias') {
				return (!user || user.FAKE_USER === data.properties.alias)
			}

			return (
				data &&
				data.properties &&
				data.properties.token === MIXPANEL_TOKEN &&
				(!event || data.event === '[' + SYSTEM + '] ' + event)
			)
		} catch (e) {
			return false
		}
	}
}

function createMixpanelMock(options, times) {
	times = times || 1
	_.defaults(options, {
		// The mixpanel lib loaded in the browser uses a different endpoint and uses POST for most of the methods.
		host: IS_BROWSER ? MIXPANEL_BROWSER_HOST: MIXPANEL_HOST,
		method: IS_BROWSER ? 'POST' : 'GET',
		filterQuery: validateMixpanelQuery(options.event, options.user),
		response: '1'
	})

	delete options.event
	delete options.user

	var mocks = _.range(times).map(function () {
		return mock.create(options)
	})

	return aggregateMock(mocks)
}

function validateGaBody(event, user) {
	return function(bodyString) {
		var data = bodyString.split('\n')[0]
		if (!data) return false

		try {
			data = querystring.parse(data)
			return (
				data &&
				data.t === 'event' &&
				data.tid === GA_ID &&
				data.ec === GA_SITE &&
				data.el === SYSTEM &&
				(!event || data.ea === event) &&
				(!user || data.uid == user.id)
			)
		} catch (e) {
			return false
		}
	}
}

function createGaMock(options, times) {
	times = times || 1

	_.defaults(options, {
		host: GA_HOST,
		method: 'POST',
		filterBody: validateGaBody(options.event, options.user)
	})

	var mocks = _.range(times).reduce(function (acc) {
		acc.push(mock.create(options))
		var browserOpts = _.clone(options)
		browserOpts.endpoint = '/r' + options.endpoint
		acc.push(mock.create(browserOpts))
		return acc
	}, [])

	return aggregateMock(mocks)
}

function validateGsQuery(queryString) {
	return (
		queryString.site_token === GOSQUARED_ID &&
		queryString.api_key === GOSQUARED_API_KEY
	)
}

function validateGsBody(event, user) {
	return function(body) {
		return (
			(!event || body.event.name === '[' + SYSTEM + '] ' + event) &&
			(!user || body.person_id == user.id)
		)
	}
}

function createGsMock(options, times) {
	times = times || 1

	_.defaults(options, {
		host: GOSQUARED_HOST,
		method: 'POST',
		filterQuery: validateGsQuery,
		filterBody: validateGsBody(options.event, options.user),
		response: '1'
	})

	var mocks = _.range(times).map(function () {
		return mock.create(options)
	})

	return aggregateMock(mocks)
}

describe('BalenaEventLog', function () {

	before(mock.init)
	afterEach(mock.reset)
	after(mock.teardown)

	describe('Mixpanel track', function () {
		var eventLog

		beforeEach(function() {
			// We send up to three /engage requests:
			// * on login: identify or $set_once with $distinct_id, to ensure the user exists
			// * after login: $set to set their email/name/etc
			// * after login: $set_once to set their created time, if they don't already have one.
			createMixpanelMock({
				endpoint: '/engage',
				filterQuery: function() { return true }
			}, 3)

			createMixpanelMock({
				method: "GET",
				endpoint: '/decide',
				filterQuery: function() { return true },
				response: JSON.stringify({"notifications":[],"config":{"enable_collect_everything":false}})
			})

			createMixpanelMock({
				endpoint: '/track',
				event: '$create_alias'
			})
		})

		afterEach(function() {
			return eventLog.end()
		})

		it('should make basic request', function (done) {
			var mockedRequest = createMixpanelMock({
				filterQuery: function() { return true },
				endpoint: '/track'
			})

			eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('Mixpanel error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start().then(function () {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should track event with user login', function (done) {
			var mockedRequest = createMixpanelMock({
				filterQuery: function() { return true },
				endpoint: '/track',
				user: FAKE_USER,
				event: FAKE_EVENT
			})

			eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('Mixpanel error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start(FAKE_USER).then(function () {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should have semantic methods like device.rename', function (done) {
			var mockedRequest = createMixpanelMock({
				filterQuery: function() { return true },
				endpoint: '/track',
				user: FAKE_USER,
				event: 'Device Rename'
			})

			eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('Mixpanel error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal('Device Rename')
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start(FAKE_USER).then(function () {
				eventLog.device.rename()
			})
		})

		it('should track event with anon user', function (done) {

			var mockedRequest = createMixpanelMock({
				filterQuery: function() { return true },
				endpoint: '/track',
				event: FAKE_EVENT,
				user: (function () {
					// we only test for the distinct_id == undefined in node
					// because browser will generate a random uuid
					if (!IS_BROWSER) {
						return {
							username: undefined
						}
					}
				})()
			})

			eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('Mixpanel error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start().then(function () {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should track event with anonLogin and allow login later', function (done) {
			var mockedRequest = createMixpanelMock({
				filterQuery: function() { return true },
				endpoint: '/track',
				event: FAKE_EVENT,
				user: (function () {
					// we only test for the distinct_id == undefined in node
					// because browser will generate a random uuid
					if (!IS_BROWSER) {
						return {
							username: undefined
						}
					}
				})()
			})

			eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('Mixpanel error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
				}
			})

			eventLog.start().then(function () {
				return eventLog.create(FAKE_EVENT)
			})
			.then(function() {
				return eventLog.start(FAKE_USER)
			})
			.then(function() {
				expect(mockedRequest.isDone()).to.be.ok
				// TODO: not sure why but only works if you clear all pending mocks
				mock.reset()
				mockedRequest = createMixpanelMock({
				filterQuery: function() { return true },
					endpoint: '/track',
					user: FAKE_USER,
					event: FAKE_EVENT
				})
				return eventLog.create(FAKE_EVENT)
			})
			.then(function() {
				expect(mockedRequest.isDone()).to.be.ok
				done()
			})
			.catch(function(err) {
				console.log(err)
			})
		})

		it('should throw error when user with no .id is passed', function (done) {
			eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG
			})

			eventLog.start({})
			.catch(function(err) {
				expect(err.message).to.equal('.id & .username are required when logging in a user')
				done()
			})
		})
	})

	describe('Mixpanel identity', function () {
		var eventLog

		beforeEach(function() {
			// We send up to three /engage requests:
			// * on login: identify or $set_once with $distinct_id, to ensure the user exists
			// * after login: $set to set their email/name/etc
			// * after login: $set_once to set their created time, if they don't already have one.
			createMixpanelMock({
				endpoint: '/engage',
				filterQuery: function() { return true }
			}, 3)

			createMixpanelMock({
				method: "GET",
				endpoint: '/decide',
				filterQuery: function() { return true },
				response: JSON.stringify({"notifications":[],"config":{"enable_collect_everything":false}})
			})
		})

		afterEach(function() {
			return eventLog.end()
		})

		it('should create alias when $created property is passed', function (done) {
			createMixpanelMock({
				endpoint: '/track',
				event: '$create_alias'
			})
			var mockedRequest = createMixpanelMock({
				filterQuery: function() { return true },
				endpoint: '/track'
			})

			eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('Mixpanel error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal('x')
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start(FAKE_USER).then(function () {
				eventLog.create('x')
			})
		})

		it('should NOT create alias when $created property is not passed', function (done) {
			var aliasMock = createMixpanelMock({
				endpoint: '/track',
				event: '$create_alias'
			})
			var mockedRequest = createMixpanelMock({
				filterQuery: function() { return true },
				endpoint: '/track'
			})

			eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('Mixpanel error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal('x')
					expect(mockedRequest.isDone()).to.be.ok
					expect(!aliasMock.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start({
				username: 'fake',
				id: 123,
				email: 'fake@example.com',
			}).then(function () {
				eventLog.create('x')
			})
		})
	})

	describe('GA track', function () {
		// NB: GA tests **must** be run with `debug: true`, it influences some the cookiDomain and transport params of GA tracking
		var eventLog

		afterEach(function() {
			return eventLog.end()
		})

		it('should make basic request', function (done) {
			var mockedRequest = createGaMock({
				endpoint: '/collect'
			})

			eventLog = BalenaEventLog({
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('GA error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start().then(function () {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should track event with user login', function (done) {
			var mockedRequest = createGaMock({
				endpoint: '/collect',
				user: FAKE_USER
			})

			eventLog = BalenaEventLog({
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('GA error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start(FAKE_USER).then(function () {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should track event with anon user', function (done) {
			var mockedRequest = createGaMock({
				endpoint: '/collect',
				user: {
					id: undefined
				}
			})

			eventLog = BalenaEventLog({
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('GA error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal('Device Rename')
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start().then(function () {
				eventLog.device.rename()
			})
		})

		it('should have semantic methods like device.rename', function (done) {
			var mockedRequest = createGaMock({
				endpoint: '/collect',
				event: 'Device Rename'
			})

			eventLog = BalenaEventLog({
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('GA error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal('Device Rename')
					expect(mockedRequest.isDone()).to.be.ok
					done()
				}
			})

			eventLog.start(FAKE_USER).then(function () {
				eventLog.device.rename()
			})
		})

		it('should track event with anonLogin and allow login later', function (done) {
			var mockedRequest = createGaMock({
				endpoint: '/collect',
				user: {
					id: undefined
				},
				event: FAKE_EVENT
			})

			eventLog = BalenaEventLog({
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('GA error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
				}
			})

			eventLog.start().then(function () {
				return eventLog.create(FAKE_EVENT)
			})
			.then(function() {
				expect(mockedRequest.isDone()).to.be.ok
				mockedRequest = createGaMock({
					endpoint: '/collect',
					user: FAKE_USER,
					event: FAKE_EVENT
				})
				return eventLog.start(FAKE_USER)
			})
			.then(function() {
				return eventLog.create(FAKE_EVENT)
			})
			.then(function() {
				expect(mockedRequest.isDone()).to.be.ok
				done()
			})
		})
	})

	describe('gosquared track', function () {
		var endpoint = '/tracking/v1/event'
		var eventLog

		afterEach(function() {
			return eventLog.end()
		})

		it('should make basic request', function (done) {
			var mockedRequest = createGsMock({
				endpoint: endpoint
			})

			eventLog = BalenaEventLog({
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('gosquared error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)

					if (!IS_BROWSER) {
						expect(mockedRequest.isDone()).to.be.ok
						done()
					} else {
						// TODO: mock browser tests.
						// see: https://github.com/balena-io-modules/resin-analytics/pull/14
						done()
					}
				}
			})

			eventLog.start().then(function () {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should track event with user login', function (done) {
			var mockedRequest = createGsMock({
				endpoint: endpoint,
				user: FAKE_USER,
				event: FAKE_EVENT
			})
			eventLog = BalenaEventLog({
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('gosquared error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)

					if (!IS_BROWSER) {
						expect(mockedRequest.isDone()).to.be.ok
						done()
					} else {
						// TODO: mock browser tests.
						// see: https://github.com/balena-io-modules/resin-analytics/pull/14
						done()
					}
				}
			})

			eventLog.start(FAKE_USER).then(function () {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should track event with anon user', function (done) {
			var mockedRequest = createGsMock({
				endpoint: endpoint,
				user: {
					id: undefined
				},
				event: FAKE_EVENT
			})

			eventLog = BalenaEventLog({
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('gosquared error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)

					if (!IS_BROWSER) {
						expect(mockedRequest.isDone()).to.be.ok
						done()
					} else {
						// TODO: mock browser tests.
						// see: https://github.com/balena-io-modules/resin-analytics/pull/14
						done()
					}
				}
			})

			eventLog.start().then(function () {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should have semantic methods like device.rename', function (done) {
			var mockedRequest = createGsMock({
				endpoint: endpoint,
				event: 'Device Rename'
			})

			eventLog = BalenaEventLog({
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('gosquared error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal('Device Rename')

					if (!IS_BROWSER) {
						expect(mockedRequest.isDone()).to.be.ok
						done()
					} else {
						// TODO: mock browser tests.
						// see: https://github.com/balena-io-modules/resin-analytics/pull/14
						done()
					}
				}
			})

			eventLog.start(FAKE_USER).then(function () {
				eventLog.device.rename()
			})
		})

		it('should track event with anonLogin and allow login later', function (done) {
			var mockedRequest = createGsMock({
				endpoint: endpoint,
				user: {
					id: undefined
				},
				event: FAKE_EVENT
			})

			eventLog = BalenaEventLog({
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function(err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('gosquared error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
				}
			})

			eventLog.start().then(function () {
				return eventLog.create(FAKE_EVENT)
			})
			.then(function() {
				if (!IS_BROWSER) {
					expect(mockedRequest.isDone()).to.be.ok
				}

				mockedRequest = createGsMock({
					endpoint: endpoint,
					user: FAKE_USER,
					event: FAKE_EVENT
				})

				return eventLog.start(FAKE_USER)
			})
			.then(function() {
				return eventLog.create(FAKE_EVENT)
			})
			.then(function() {
				if (!IS_BROWSER) {
					expect(mockedRequest.isDone()).to.be.ok
				}
				done()
			})
			.catch(function(err) {
				console.error(err)
			})
		})
	})

	describe('All platforms', function () {
		it('Trigger getDistinctId in browser & fail in node', function (done) {
			var eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				gaId: GA_ID,
				gaSite: GA_SITE,
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
			})

			if(IS_BROWSER) {
				eventLog.getDistinctId()
				.then(function(platformIds) {
					expect(platformIds).to.have.lengthOf(3);
					// GA
					expect(platformIds[0]).to.have.property('ga');
					expect(platformIds[0]['ga']).to.be.null;
					// Mixpanel
					expect(platformIds[1]).to.have.property('mixpanel');
					expect(platformIds[1]['mixpanel']).to.be.a('string');
					// GS
					expect(platformIds[2]).to.have.property('gs');
					expect(platformIds[2]['gs']).to.be.null;

					done()
				})
			}
			else {
				eventLog.getDistinctId()
				.catch(function(err) {
					expect(err.message).to.equal('(Resin Mixpanel Client) function getDistinctId is only available for the browser')
					done()
				})
			}
		})

		it('Trigger identify in browser & fail in node', function (done) {
			var eventLog = BalenaEventLog({
				mixpanelToken: MIXPANEL_TOKEN,
				gaId: GA_ID,
				gaSite: GA_SITE,
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
			})

			if(IS_BROWSER) {
				eventLog.identify({
					mixpanel: 'dummy_id'
				})
				.then(function() {
					done()
				})
			}
			else {
				eventLog.identify({
					mixpanel: 'dummy_id'
				})
				.catch(function(err) {
					expect(err.message).to.equal('(Resin Mixpanel Client) function identify is only available for the browser')
					done()
				})
			}
		})
	})
})
