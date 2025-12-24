var Analytics = require('analytics-client')
var expect = require('chai').expect
var sinon = require('sinon')
var nise = require('nise')

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

describe('BalenaEventLog', function () {

	let analyticsClient
	let trackedEvents = []
	let lastUserId = null
	let lastUserProperties = null
	let regenerateCalled = false
	let server

	beforeEach(function () {
		server = nise.fakeServer.create()
		server.autoRespond = true
		server.respondWith('POST', `https://${BALENA_DATA_ENDPOINT}`, [
			200, { 'Content-Type': 'text/plain' }, 'success'
		])

		// On init, analytics client sends an identify call.

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
		analyticsClient.regenerateDeviceId = () => { regenerateCalled = true }
	});

	afterEach(function () {
		server.restore()
	})

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

		it('should call setUserId and regenerateDeviceId on logout', async () => {
			const eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
			})
			// Simulate login first to set userId
			await eventLog.start({ username: 'user', id: 1 })
			expect(lastUserId).to.equal('user')
	
			await eventLog.end()
			expect(lastUserId).to.be.null
			expect(regenerateCalled).to.be.true
		})
	
		it('should call setUserId on identify', async () => {
			const eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
			})
			
			await eventLog.identify({ analyticsClient: 'new-id' })
			expect(lastUserId).to.equal('new-id')
		})
	
		it('should expose all event namespaces', () => {
			const eventLog = BalenaEventLog({
				analyticsClient,
				prefix: SYSTEM,
			})
			const namespaces = [
				'user', 'apiKey', 'publicKey', 'organization', 'organizationMember',
				'organizationInvite', 'team', 'teamMember', 'teamApplication',
				'application', 'block', 'applicationTag', 'applicationMembers',
				'configVariable', 'environmentVariable', 'serviceVariable', 'device',
				'release', 'deviceConfigVariable', 'deviceEnvironmentVariable',
				'deviceServiceVariable', 'deviceTag', 'releaseTag', 'billing',
				'onboarding', 'gettingStartedGuide', 'page', 'navigation', 'changelog',
				'actionsSettingsOperations', 'creditsRunwayCalculator', 'members',
				'deployToBalena', 'invite', 'applicationDeviceType', 'applicationName'
			]
			namespaces.forEach(ns => {
				expect(eventLog).to.have.property(ns)
			})
		})
	})
})
