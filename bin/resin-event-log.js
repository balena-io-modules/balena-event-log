(function() {
  (function(root, factory) {
    if (typeof define === 'function' && define.amd) {
      return define(['lodash', '../bower_components/node-uuid/uuid'], factory);
    } else if (typeof exports === 'object') {
      return module.exports = factory(require('lodash'), require('node-uuid'));
    }
  })(this, function(_, uuid) {
    var EVENTS, HOOKS;
    EVENTS = {
      user: ['login', 'logout', 'signup', 'passwordCreate', 'passwordEdit', 'emailEdit'],
      publicKey: ['create', 'delete'],
      application: ['create', 'open', 'delete', 'osDownload'],
      environmentVariable: ['create', 'edit', 'delete'],
      device: ['open', 'rename', 'delete', 'terminalOpen', 'terminalClose'],
      deviceEnvironmentVariable: ['create', 'edit', 'delete']
    };
    HOOKS = {
      beforeStart: function(userId, interactionUuid) {},
      afterStart: function(userId, interactionUuid) {},
      beforeEnd: function() {},
      afterEnd: function() {},
      beforeCreate: function(type, jsonData, applicationId, deviceId) {},
      afterCreate: function(type, jsonData, applicationId, deviceId) {}
    };
    return function(PinejsClient, subsystem, hooks) {
      var exported;
      if (!subsystem) {
        throw Error('subsystem is required to start events interaction.');
      }
      hooks = _.merge(HOOKS, hooks);
      exported = {
        subsystem: subsystem,
        start: function(userId, interactionUuid) {
          hooks.beforeStart.apply(this, arguments);
          if (!userId) {
            throw Error('userId is required to start events interaction.');
          }
          this.userId = userId;
          this.interactionUuid = interactionUuid || uuid();
          return hooks.afterStart.call(this, this.userId, this.interactionUuid);
        },
        end: function() {
          hooks.beforeEnd.apply(this);
          this.userId = null;
          this.interactionUuid = null;
          return hooks.afterEnd.apply(this);
        },
        create: function(type, jsonData, applicationId, deviceId) {
          var args;
          args = arguments;
          hooks.beforeCreate.apply(this, args);
          return PinejsClient.post({
            resource: 'event',
            body: {
              user: this.userId,
              interaction_uuid: this.interactionUuid,
              application_id: applicationId,
              device_id: deviceId,
              type: "[" + this.subsystem + "] " + type,
              json_data: jsonData
            }
          }).then((function(_this) {
            return function() {
              return hooks.afterCreate.apply(_this, args);
            };
          })(this));
        }
      };
      _.forEach(EVENTS, function(events, base) {
        if (exported[base] == null) {
          exported[base] = {};
        }
        return _.forEach(events, function(event) {
          return exported[base][event] = function(jsonData, applicationId, deviceId) {
            if (applicationId == null) {
              applicationId = null;
            }
            if (deviceId == null) {
              deviceId = null;
            }
            return exported.create(_.startCase(base + " " + event), jsonData, applicationId, deviceId);
          };
        });
      });
      return exported;
    };
  });

}).call(this);
