var Analytics = require('analytics-client')
var _ = require('lodash')
var expect = require('chai').expect
var mock = require('resin-universal-http-mock')

// NB: set to true to get some extra reporting
var EXTRA_DEBUG = false

var BalenaEventLog = require('..')

var projectId = 'balena-test'
var SYSTEM = 'TEST'
var BALENA_DATA_ENDPOINT = 'data.balena-staging.com'

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
						console.error('Analytics error:', err)
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

	describe('All platforms', function () {
		it('getDistinctId', async () => {
			const eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
				debug: EXTRA_DEBUG,
			})
			const id = await eventLog.getDistinctId()
			expect(id).to.have.length(1)
		})
	})
})
