# Balena Event Log

Balena event logging facility.

## Installing

```sh
$ npm install @balena/event-log
```

## Using

```javascript
var EventLog = require('@balena/event-log')

var eventLogger = EventLog({
	debug: true,
	mixpanelToken: MIXPANEL_TOKEN,
	mixpanelHost: 'api.mixpanel.com',
	gaSite: 'balena-cloud.com',
	gaId: GA_ID,
	prefix: 'UI, CLI, etc.',
	// Hooks:
	beforeCreate: function (type, jsonData, applicationId, deviceId, callback) {
		this.start('User ID', callback)
	}
	afterCreate: function (error, type, jsonData, applicationId, deviceId) {
		if (type === 'User Logout') {
			this.end()
		}
		if (error) {
			console.error(error)
		}
	}
})

// Example logged event:
eventLoger.user.login(
	{ json: 'data' }, // Or null
	'Application ID', // Optional
	'Device ID' // Optional
)

// Example logged event without params:
eventLoger.user.login()
```

## Options

* `prefix` - subsystem name like UI or CLI, acts as events names prefix
* `[debug = false]` — will print some warnings
* `[mixpanelToken = null]` - if set events will be reported to mixpanel
* `[mixpanelHost = null]` - if set will override the default mixpanel API host
* `[gaSite = null]`, `[gaSite = null]` - if set events will be reported to GA

### Hooks:

```javascript
beforeCreate = function (type, jsonData, applicationId, deviceId, callback) { return callback() } 
afterCreate = function (error, type, jsonData, applicationId, deviceId) {}
```
