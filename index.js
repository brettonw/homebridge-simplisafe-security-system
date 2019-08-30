let Service, Characteristic;
let simplisafe = require("simplisafe");

module.exports = function(homebridge){
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-simplisafe", "homebridge-simplisafe", SimpliSafeSecuritySystemAccessory);
};

let SimplySafeState = {
    PENDING_HOME: "pending home",
    HOME: "home",
    AWAY: "away",
    OFF: "off"
};

let homekitStateNames = {};

function SimpliSafeSecuritySystemAccessory(log, config) {
    this.log = log;

    this.httpMethod = config.http_method || "GET";
    this.auth = config.auth;
    this.name = config.name;

    // setup homekit state names
    homekitStateNames[Characteristic.SecuritySystemTargetState.STAY_ARM] = "stay";
    homekitStateNames[Characteristic.SecuritySystemTargetState.NIGHT_ARM] = "night";
    homekitStateNames[Characteristic.SecuritySystemTargetState.AWAY_ARM] = "away";
    homekitStateNames[Characteristic.SecuritySystemTargetState.DISARM] = "disarm";

    this.convertHomeKitStateToSimpliSafeState = function(homeKitState) {
        switch (homeKitState) {
            case Characteristic.SecuritySystemTargetState.STAY_ARM:
            case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
                return SimplySafeState.HOME;
            case Characteristic.SecuritySystemTargetState.AWAY_ARM :
                return SimplySafeState.AWAY;
            case Characteristic.SecuritySystemTargetState.DISARM:
                return SimplySafeState.OFF;
        }
    };

    this.convertSimpliSafeStateToHomeKitState = function(simpliSafeState) {
        switch (simpliSafeState) {
            case SimplySafeState.HOME:
                return Characteristic.SecuritySystemTargetState.STAY_ARM;
            case SimplySafeState.AWAY:
                return Characteristic.SecuritySystemTargetState.AWAY_ARM;
            case SimplySafeState.PENDING_HOME:
            case SimplySafeState.OFF:
                return Characteristic.SecuritySystemTargetState.DISARM;
        }
    };
}

SimpliSafeSecuritySystemAccessory.prototype = {

    setTargetState: function(state, callback) {
        this.log("setTargetState");

        let self = this;
        simplisafe(this.auth, function (er, client) {
            //self.log(er, client);
            self.log("  setting alarm state from Homekit State " + state + " (" + homekitStateNames[state] + ")");
            client.setState(self.convertHomeKitStateToSimpliSafeState(state), function() {
                if (client && client.info && client.info.state) {
                    self.log("    callback setting alarm state to SimpliSafe State (" + client.info.state + ")");
                    // Important: after a successful server response, we update the current state of the system
                    self.securityService.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                    callback(null, state);
                    client.logout(function(er) {}); // Log out, clean out the connection
                }
            }); // this is really slow. Like 10-to-20 seconds slow
        });
    },

    getState: function(callback, name) {
        this.log (name);
        let self = this;
        simplisafe(this.auth, function (er, client) {
            if (client && client.info && client.info.state) {
                self.log("  getting SimpliSafe State (" + client.info.state + ")");
                callback(null, self.convertSimpliSafeStateToHomeKitState(client.info.state));
            }
        });
    },

    getCurrentState: function(callback) {
        this.getState(callback, "getCurrentState");
    },

    getTargetState: function(callback) {
        this.getState(callback, "getTargetState");
    },

    identify: function(callback) {
        this.log("Identify requested!");
        callback(); // success
    },

    getServices: function() {
        this.securityService = new Service.SecuritySystem(this.name);

        this.securityService
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .on("get", this.getCurrentState.bind(this));

        this.securityService
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on("get", this.getTargetState.bind(this))
            .on("set", this.setTargetState.bind(this));

        return [this.securityService];
    }
};
