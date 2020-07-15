var Analytics = require('analytics-client')
var _ = require('lodash')
var expect = require('chai').expect
var querystring = require('querystring')
var mock = require('resin-universal-http-mock')

var IS_BROWSER = typeof window !== 'undefined'

// NB: set to true to get some extra reporting
var EXTRA_DEBUG = false

if (IS_BROWSER && EXTRA_DEBUG) {
	window.GA_CUSTOM_LIB_URL = 'https://www.google-analytics.com/analytics_debug.js'
}

var BalenaEventLog = require('..')

var projectId = 'balena-test'
var SYSTEM = 'TEST'
var BALENA_DATA_ENDPOINT = 'data.balena-staging.com'
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
		isDone: function () {
			return _.some(mocks, function (mock) {
				return mock.isDone()
			})
		}
	}
}

function createAnalyticsBackendMock(options, times) {
	times = times || 1
	_.defaults(options, {
		host: `https://${BALENA_DATA_ENDPOINT}`,
		method: 'POST',
		response: 'success'
	})

	var mocks = _.range(times).map(function () {
		return mock.create(options)
	})

	return aggregateMock(mocks)
}

function validateGaBody(event, user) {
	return function (bodyString) {
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
	return function (body) {
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

	let analyticsClient
	let trackedEvents = []
	let lastUserId = null
	let lastUserProperties = null
	let regenerateCalled = false

	before(mock.init)
	afterEach(mock.reset)
	after(mock.teardown)

	beforeEach(function () {
		// On init, analytics client sends an identify call.
		createAnalyticsBackendMock({
			endpoint: '/amplitude',
		}, 1)

		analyticsClient = Analytics.createClient({
			projectName: projectId,
			endpoint: BALENA_DATA_ENDPOINT,
			componentName: SYSTEM
		})

		// Stub analytics client methods.
		trackedEvents = []
		lastUserProperties = null
		lastUserId = null
		regenerateCalled = false
		analyticsClient.track = (eventType, props) => trackedEvents.push({eventType, props})
		analyticsClient.setUserId = (userId) => { lastUserId = userId }
		analyticsClient.setUserProperties = (props) => { lastUserProperties = props }
	});

	describe('Analytics client track', function () {
		let eventLog

		afterEach(function () {
			return eventLog.end()
		})

		it('should make basic request and call after hook', (done) => {
			eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('analytics error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
					expect(trackedEvents).to.have.length(1)
					expect(trackedEvents[0].eventType).to.be.equal(`[${SYSTEM}] ${FAKE_EVENT}`)
					done()
				}
			})

			eventLog.start().then(() => {
				eventLog.create(FAKE_EVENT)
			})
		})

		it('should track event with user login', async () => {
			eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG
			})

			await eventLog.start(FAKE_USER);
			expect(lastUserId).to.be.equal(FAKE_USER.username)

			await eventLog.create(FAKE_EVENT)
			expect(trackedEvents).to.have.length(1)
		})

		it('should have semantic methods like device.rename', async () => {
			eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG
			})

			await eventLog.start(FAKE_USER);
			expect(lastUserId).to.be.equal(FAKE_USER.username)

			await eventLog.device.rename()
			expect(trackedEvents).to.have.length(1)
			expect(trackedEvents[0].eventType).to.be.equal(`[${SYSTEM}] Device Rename`)
		})

		it('should track event with anon user', async () => {
			eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG
			})

			await eventLog.start()
			expect(lastUserId).to.be.null
			await eventLog.create(FAKE_EVENT)
			expect(trackedEvents).to.have.length(1)
		})

		it('should track event with anonLogin and allow login later', async () => {
			eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
					if (err) {
						console.error('Mixpanel error:', err)
					}
					expect(!err).to.be.ok
					expect(type).to.be.equal(FAKE_EVENT)
				}
			})

			await eventLog.start()
			await eventLog.create(FAKE_EVENT)
			expect(lastUserId).to.be.null
			expect(trackedEvents).to.have.length(1)

			await eventLog.start(FAKE_USER)
			expect(lastUserId).to.be.equal(FAKE_USER.username)

			await eventLog.create(FAKE_EVENT)
			expect(trackedEvents).to.have.length(2)
		})

		it('should throw error when user with no .id is passed', async () => {
			eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG
			})

			try {
				await eventLog.start({})
				expect(false).to.be.ok
			} catch (err) {
				expect(err.message).to.equal('.id & .username are required when logging in a user')
			}
		})
	})

	describe('Analytics client identity', function () {
		let eventLog

		afterEach(function () {
			return eventLog.end()
		})

		it('should update $created with $setOnce', async () => {
			eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG
			})

			await eventLog.start(FAKE_USER)
			expect(lastUserProperties).to.be.not.null
			expect(lastUserProperties.setOnce).to.haveOwnProperty('$created')
		})

		it('should set $email with $set', async () => {
			eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG
			})

			await eventLog.start({
				username: 'fake',
				id: 123,
				email: 'fake@example.com',
			})
			expect(lastUserProperties).to.be.not.null
			expect(lastUserProperties.set).to.haveOwnProperty('$email')
			expect(lastUserProperties.set.$email).to.be.equal('fake@example.com')
		})
	})

	describe('GA track', function () {
		// NB: GA tests **must** be run with `debug: true`, it influences some the cookiDomain and transport params of GA tracking
		var eventLog

		afterEach(function () {
			return eventLog.end()
		})

		it('should make basic request', function (done) {
			var mockedRequest = createGaMock({
				endpoint: '/collect'
			})

			eventLog = BalenaEventLog({
				analyticsClient,
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
				analyticsClient,
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
				analyticsClient,
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
				analyticsClient,
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
				analyticsClient,
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
					.then(function () {
						expect(mockedRequest.isDone()).to.be.ok
						mockedRequest = createGaMock({
							endpoint: '/collect',
							user: FAKE_USER,
							event: FAKE_EVENT
						})
						return eventLog.start(FAKE_USER)
					})
					.then(function () {
						return eventLog.create(FAKE_EVENT)
					})
					.then(function () {
						expect(mockedRequest.isDone()).to.be.ok
						done()
					})
		})
	})

	describe('gosquared track', function () {
		var endpoint = '/tracking/v1/event'
		var eventLog

		afterEach(function () {
			return eventLog.end()
		})

		it('should make basic request', function (done) {
			var mockedRequest = createGsMock({
				endpoint: endpoint
			})

			eventLog = BalenaEventLog({
				analyticsClient,
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
				analyticsClient,
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
				analyticsClient,
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
				analyticsClient,
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
				analyticsClient,
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: true,
				afterCreate: function (err, type, jsonData, applicationId, deviceId) {
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
					.then(function () {
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
					.then(function () {
						return eventLog.create(FAKE_EVENT)
					})
					.then(function () {
						if (!IS_BROWSER) {
							expect(mockedRequest.isDone()).to.be.ok
						}
						done()
					})
					.catch(function (err) {
						console.error(err)
					})
		})
	})

	describe('All platforms', function () {
		it('getDistinctId', async () => {
			const eventLog = BalenaEventLog({
				analyticsClient,
				gaId: GA_ID,
				gaSite: GA_SITE,
				gosquaredId: GOSQUARED_ID,
				gosquaredApiKey: GOSQUARED_API_KEY,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
			})
			const id = await eventLog.getDistinctId()
			expect(id).to.have.length(3)
		})
	})
})
