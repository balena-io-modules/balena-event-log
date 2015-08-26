(function() {
  (function(root, factory) {
    if (typeof define === 'function' && define.amd) {
      return define(['../bower_components/resin-mixpanel-client/bin/resin-mixpanel-client', 'lodash'], factory);
    } else if (typeof exports === 'object') {
      return module.exports = factory(require('./resin-mixpanel-client'), require('lodash'));
    }
  })(this, function(ResinMixpanelClient, _) {
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
      beforeCreate: function(type, jsonData, applicationId, deviceId, callback) {
        return callback();
      },
      afterCreate: function(type, jsonData, applicationId, deviceId) {}
    };
    return function(mixpanelToken, subsystem, hooks) {
      var exported, getMixpanelUser, mixpanel;
      if (!mixpanelToken || !subsystem) {
        throw Error('mixpanelToken and subsystem are required to start events interaction.');
      }
      hooks = _.merge(HOOKS, hooks);
      mixpanel = ResinMixpanelClient(mixpanelToken);
      getMixpanelUser = function(userData) {
        var mixpanelUser;
        mixpanelUser = _.extend({
          '$email': userData.email,
          '$name': userData.username
        }, userData);
        return _.pick(mixpanelUser, ['$email', '$name', '$created', 'hasPasswordSet', 'iat', 'id', 'permissions', 'public_key', 'username']);
      };
      exported = {
        subsystem: subsystem,
        start: function(user, callback) {
          var login, mixpanelUser;
          if (!user) {
            throw Error('user is required to start events interaction.');
          }
          this.userId = user.id;
          mixpanelUser = getMixpanelUser(user);
          login = function() {
            return mixpanel.login(user.username, function() {
              return mixpanel.setUserOnce(mixpanelUser, callback);
            });
          };
          if (mixpanelUser.$created) {
            return mixpanel.signup(user.username, function() {
              return login();
            });
          }
          return login();
        },
        end: function(callback) {
          this.userId = null;
          return mixpanel.logout(callback);
        },
        create: function(type, jsonData, applicationId, deviceId) {
          return hooks.beforeCreate.call(this, type, jsonData, applicationId, deviceId, (function(_this) {
            return function() {
              return mixpanel.track("[" + _this.subsystem + "] " + type, {
                applicationId: applicationId,
                deviceId: deviceId,
                jsonData: jsonData
              }, function() {
                return hooks.afterCreate.call(_this, type, jsonData, applicationId, deviceId);
              });
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
