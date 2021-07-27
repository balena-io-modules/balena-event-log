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

function validateGaData (data, event, user) {
	return (
		data &&
		data.t === 'event' &&
		data.tid === GA_ID &&
		data.ec === GA_SITE &&
		data.el === SYSTEM &&
		(!event || data.ea === event) &&
		(!user || data.uid == user.id)
	)
}

function validateGaQuery(event, user) {
	return function (queryObject) {
		if (!queryObject) return false
		return validateGaData(queryObject, event, user);
	}
}

function validateGaBody(event, user) {
	return function (bodyString) {
		var data = bodyString.split('\n')[0]
		if (!data) return false

		try {
			data = querystring.parse(data)
			return validateGaData(data, event, user);
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

		// On the latest vendor ga client always sends the first
		// request on `/j/collect` and all the data are on the
		// query string instead of the body
		var initialRequestOpts = _.clone(options)
		initialRequestOpts.endpoint = '/j' + options.endpoint
		delete initialRequestOpts.filterBody
		initialRequestOpts.filterQuery = validateGaQuery(options.event, options.user)
		acc.push(mock.create(initialRequestOpts))

		return acc
	}, [])

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

	describe('All platforms', function () {
		it('getDistinctId', async () => {
			const eventLog = BalenaEventLog({
				analyticsClient,
				gaId: GA_ID,
				gaSite: GA_SITE,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
			})
			const id = await eventLog.getDistinctId()
			expect(id).to.have.length(2)
		})
	})
})
