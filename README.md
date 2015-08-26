# Resin Event Log

Resin event logging facility.

## Installing

```sh
$ npm install resin-event-log
```

```sh
$ bower install resin-event-log
```

## Development mode

The following command will watch for any changes you make:

```sh
$ gulp watch
```

## Using

```coffeescript
EventLog = require('resin-event-log')

eventLogger = EventLog MIXPANEL_TOKEN, 'Subsystem - UI, CLI, etc.', {
    # Hooks:
    beforeCreate: (type, jsonData, applicationId, deviceId, callback) ->
        @start('User ID', callback)
    afterCreate: (type, jsonData, applicationId, deviceId) ->
        if type is 'User Logout'
            @end()
}

# Example logged event:
eventLoger.user.login(
    { json: 'data' } # Or null
    'Application ID' # Optional
    'Device ID' # Optional
)

# Example logged event without params:
eventLoger.user.login()
```

## Available hooks:

```coffeescript
beforeCreate = (type, jsonData, applicationId, deviceId, callback) -> callback()
afterCreate = (type, jsonData, applicationId, deviceId) -> #
```