//Require modules

const lastfm = require("../modules/lastfm.js");
const media = require("../modules/media.js");
const moderation = require("../modules/moderation.js");
const notifications = require("../modules/notifications.js");
const roles = require("../modules/roles.js");
const servers = require("../modules/servers.js");
const users = require("../modules/users.js");
const utility = require("../modules/utility.js");

//Handle message

exports.handleMsg = (message) => {

    let { system, author, channel, content } = message

    if (system) return;
    if (author.bot) return;
    if (channel.type === "dm") return;

    let args = content.replace(/\s{2,}/gi, ' ').trim().split(' ');

    //Pass message to modules
    lastfm.msg(message, args);
    moderation.msg(message, args);
    media.msg(message, args);
    notifications.msg(message, args);
    roles.msg(message, args);
    servers.msg(message, args);
    users.msg(message, args);
    utility.msg(message, args);

}

