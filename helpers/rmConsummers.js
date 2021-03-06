'use strict';
module.exports = function (dbsNames, event, models) {
    var _getHelper = require('./integrationHelperRetriever')(models, event);
    var IntegrationService = require('../services/integration')(models);
    var SettingsService = require('../services/settings')(models);
    var CONSTANTS = require('../constants/mainConstants');
    var async = require('async');
    var _ = require('lodash');
    var getHelper = _getHelper.getHelper;
    var getVersion = _getHelper.getVersion;
    var logger = require('../helpers/logger');
    var redisClient = require('../helpers/redisClient');
    var integrationStatsHelper = require('../helpers/integrationStatsComposer')(models);
    var queues = [];
    var dbKeys = Object.keys(dbsNames);
    var getAllConsumer;
    var synConsumer;
    var key;
    var _db;
    var i;

    function getIntegrationSettings(options, callback) {
        var type = options.type;
        var dbName = options.dbName;
        var version = options.version;

        SettingsService.getSettingsUrlsForApp({
            app    : type,
            dbName : dbName,
            version: version
        }, function (err, settings) {
            if (err) {
                return callback(err);
            }

            callback(null, settings);
        });
    }

    function syncChannel(syncData) {
        var type = syncData ? syncData.type : CONSTANTS.INTEGRATION.MAGENTO;
        var integrationHelper = getHelper(type);
        var db = syncData.dbName;
        var _queue = this;
        var channel = syncData._id;

        async.series([
            function (sCb) {
                integrationHelper.syncChannel(syncData, function (err) {
                    if (err) {
                        return logger.error(err);
                    }

                    sCb();
                });
            },

            function (sCb) {
                integrationStatsHelper(db, function (err, stats) {
                    if (err) {
                        return logger.error(err);
                    }

                    event.emit('recollectedStats', {dbName: db, stats: stats});
                    redisClient.writeToStorage('syncStats', db, JSON.stringify(stats));

                    sCb();
                });
            },

            function (sCb) {
                IntegrationService.findOneAndUpdate({_id: channel}, {$set: {lastSync: new Date()}}, {dbName: db}, function (err) {
                    if (err) {
                        return logger.error(err);
                    }

                    sCb();
                });
            }
        ], function (err) {
            if (err) {
                return logger.error(err);
            }

            _queue.shift();
        });
    }

    function getAllForChannel(data) {
        var _queue = this;
        var query = data.query;
        var type = data.type;
        var dbName = data.dbName;
        var userId = data.userId;
        var version = query && query.version || getVersion(type);
        var opts = {
            dbName : dbName,
            userId : userId,
            version: version,
            type   : type
        };
        var integrationHelper = getHelper(type);

        getIntegrationSettings(opts, function (err, settings) {
            var redisKey;
            var error;

            if (err) {
                return logger.error(err);
            }

            if (!settings) {
                error = new Error('Invalid integration settings');
                error.status = 400;
                return logger.error(error);
            }

            data.settings = settings;

            redisKey = dbName + '_' + data._id;

            integrationHelper.getAll(data, function (err) {
                if (err) {
                    return logger.error(err);
                }

                redisClient.sMove('syncInProgress', redisKey);

                _queue.shift();
            });
        });
    }

    for (i = dbKeys.length - 1; i >= 0; i--) {
        key = dbKeys[i];
        _db = dbsNames[key];
        synConsumer = {
            exchange  : 'sync',
            queue     : 'sync',
            routingKey: 'sync.forDataBase.' + _db.DBname,
            callback  : syncChannel
        };
        getAllConsumer = {
            exchange  : 'sync',
            queue     : 'get',
            routingKey: 'getAll.forDataBase.' + _db.DBname,
            callback  : getAllForChannel
        };

        queues.push(synConsumer, getAllConsumer);
    }

    return queues;
};
