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
PinejsClient = require('pinejs-client')

pinejsClientInstance = new PinejsClient(...)

eventLogger = EventLog pinejsClientInstance, 'Subsystem - UI, CLI, etc.', {
    # Hooks:
    beforeCreate: ->
        @start('User ID', 'Interaction ID') # If no Interaction ID provided, it's auto-generated
    afterCreate: (type) ->
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
beforeStart = (userId, interactionUuid) ->
afterStart = (userId, interactionUuid) ->
beforeEnd = ->
afterEnd = ->
beforeCreate = (type, jsonData, applicationId, deviceId) ->
afterCreate = (type, jsonData, applicationId, deviceId) ->
```