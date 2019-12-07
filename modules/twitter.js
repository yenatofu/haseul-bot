// Require modules

const Client = require("../haseul.js").Client;
const config = require("../config.json");

const axios = require("axios");

const functions = require("../functions/functions.js");
const database = require("../db_queries/twitter_db.js");

// Consts

const twitter = axios.create({
    baseURL: 'https://api.twitter.com',
    timeout: 10000,
    headers: {'authorization': 'Bearer ' + config.twt_bearer}
})

// Functions

exports.msg = async function(message, args) {

    let perms;

    // Handle commands

    switch (args[0]) {

        case ".twitter":
        case ".twt":
            switch (args[1]) {

                case "noti":
                case "notif":
                case "notifs":
                case "notification":
                    perms = ["ADMINISTRATOR", "MANAGE_GUILD", "MANAGE_CHANNELS"];
                    if (!message.member) message.member = await message.guild.fetchMember(message.author.id);
                    if (!perms.some(p => message.member.hasPermission(p))) break;
                    switch (args[2]) {

                        case "add":
                            message.channel.startTyping();
                            twitter_notif_add(message, args.slice(3)).then(() => {
                                message.channel.stopTyping();
                            }).catch(error => {
                                console.error(error);
                                message.channel.stopTyping();
                            })
                            break;

                        case "remove":
                        case "delete":
                            message.channel.startTyping();
                            twitter_notif_del(message, args.slice(3)).then(() => {
                                message.channel.stopTyping();
                            }).catch(error => {
                                console.error(error);
                                message.channel.stopTyping();
                            })
                            break;

                        case "list":
                            message.channel.startTyping();
                            twitter_notif_list(message).then(() => {
                                message.channel.stopTyping();
                            }).catch(error => {
                                console.error(error);
                                message.channel.stopTyping();
                            })
                            break;

                    }
                    break;

                case "toggle":
                    switch (args[2]) {
    
                        case "retweets":
                        case "rts":
                            perms = ["ADMINISTRATOR", "MANAGE_GUILD"];
                            if (!message.member) message.member = await message.guild.fetchMember(message.author.id);
                            if (!perms.some(p => message.member.hasPermission(p))) break;
                            message.channel.startTyping();
                            retweet_toggle(message, args.slice(3)).then(() => {
                                message.channel.stopTyping();
                            }).catch(error => {
                                console.error(error);
                                message.channel.stopTyping();
                            })
                            break;
    
    
                    }
                    break;
                
                case "help":
                default:
                    message.channel.send("Help with Twitter can be found here: https://haseulbot.xyz/#twitter");
                    break;

            }
            break;
        
    }

}

// add twitter notification
async function twitter_notif_add(message, args) {

    let { guild } = message;

    let formatMatch = args.join(' ').trim().match(/^(?:https:\/\/twitter\.com\/)?@?(.+?)(?:\/media\/?)?\s+<?#?(\d{8,})>?\s*((<@&)?(.+?)(>)?)?$/i);
    if (!formatMatch) {
        message.channel.send("⚠ Incorrect formatting. For help with Twitter, see: https://haseulbot.xyz/#twitter");
        return;
    }

    let screenName = formatMatch[1];
    let channelID = formatMatch[2];
    let mentionRole = formatMatch[3];

    let channel = guild.channels.get(channelID);
    if (!channel) {
        message.channel.send("⚠ The channel provided does not exist in this server.");
        return;
    }
    if (channel.type != "text") {
        message.channel.send("⚠ Please provide a text channel to send notifications to.");
        return;
    }

    let member;
    try {
        member = await guild.fetchMember(Client.user.id);
    } catch (e) {
        member = null;
    }
    if (!member) {
         message.channel.send("⚠ Error occurred.");
         return;
    }
    
    let botCanRead = channel.permissionsFor(member).has("VIEW_CHANNEL", true);
    if (!botCanRead) {
        message.channel.send("⚠ I cannot see this channel!");
        return;
    }

    let role;
    if (mentionRole) {
        if (formatMatch[4] && formatMatch[6]) {
            role = guild.roles.get(formatMatch[5])
            if (!role) {
                message.channel.send(`⚠ A role with the ID \`${formatMatch[5]}\` does not exist in this server.`);
                return;
            }
        } else {
            role = guild.roles.find(role => role.name == formatMatch[5]);
            if (!role) {
                message.channel.send(`⚠ The role \`${formatMatch[5]}\` does not exist in this server.`);
                return;
            }
        }
    }

    let response;
    try {
        response = await twitter.get('/1.1/users/show.json', { params: {screen_name: screenName} })
    } catch(e) {
        switch (e.response.status) {
            case 403:
            case 404:
                message.channel.send(`⚠ \`${screenName}\` is an invalid Twitter handle.`);
                break;
            case 429:
                message.channel.send(`⚠ API rate limit exceeded.`);
                break;
            default:
                message.channel.send(`⚠ Unknown error occurred.`);
                break;
        }
        return;
    }
    let { id_str, screen_name } = response.data;

    let twitterNotifs = await database.get_guild_twitter_channels(guild.id);
    let twitterIDs = new Set(twitterNotifs.map(x => x.twitterID));
    if (twitterIDs.size >= 3) {
        message.channel.send("⚠ No more than 3 Twitter accounts may be set up for notifications on a server.");
        return;
    }

    try {
        response = await twitter.get('/1.1/statuses/user_timeline.json', { params: {user_id: id_str, count: 20, trim_user: 1, exclude_replies: 1} })
    } catch(e) {
        console.error(e);
        message.channel.send("⚠ Unknown error occurred.");
        return;
    }
    let recentTweets = response.data;

    // let now = Date.now();
    // for (let tweet of recentTweets) {
    //     let createdAt = new Date(tweet.created_at).getTime();
    //     if (createdAt > (now - 1000*60)) continue; // don't add tweets in last minute; prevent conflicts with task

    //     await database.add_tweet(id_str, tweet.id_str);
    // }

    let added;
    try {
        added = await database.add_twitter_channel(guild.id, channel.id, id_str, screen_name, role ? role.id : null)
    } catch(e) {
        console.error(Error(e));
        message.channel.send("⚠ Error occurred.");
        return;
    }
    
    message.channel.send(added ? `${role ? `\`${role.name}\``:'You'} will now be notified when \`@${screen_name}\` posts a new tweet in ${channel}.` :
                                 `⚠ ${channel} is already set up to be notified when \`@${screen_name}\` posts a new tweet.`);

}

// remove twitter notification
async function twitter_notif_del(message, args) {

    let { guild } = message;

    let formatMatch = args.join(' ').trim().match(/^(?:https:\/\/twitter\.com\/)?@?(.+?)(?:\/media\/?)?\s+<?#?(\d{8,})>?/i);
    if (!formatMatch) {
        message.channel.send("⚠ Incorrect formatting. For help with Twitter, see: https://haseulbot.xyz/#twitter");
        return;
    }

    let screenName = formatMatch[1];
    let channelID = formatMatch[2];

    let channel = guild.channels.get(channelID);
    if (!channel) {
        message.channel.send("⚠ The channel provided does not exist in this server.");
        return;
    }

    let response;
    try {
        response = await twitter.get('/1.1/users/show.json', { params: {screen_name: screenName} })
    } catch(e) {
        switch (e.response.status) {
            case 403:
            case 404:
                message.channel.send(`⚠ \`${screenName}\` is an invalid Twitter handle.`);
                break;
            case 429:
                message.channel.send(`⚠ API rate limit exceeded.`);
                break;
            default:
                message.channel.send(`⚠ Unknown error occurred.`);
                break;
        }
        return;
    }
    let { id_str, screen_name } = response.data;

    let deleted;
    try {
        deleted = await database.del_twitter_channel(channel.id, id_str);
    } catch(e) {
        console.error(Error(e));
        message.channel.send("⚠ Error occurred.");
        return;
    }
    
    message.channel.send(deleted ? `You will no longer be notified when \`@${screen_name}\` posts a new tweet in ${channel}.` :
                                   `⚠ Twitter notifications for \`@${screen_name}\` are not set up in ${channel} on this server.`);

}

// list twitter notifications
async function twitter_notif_list(message) {

    let { guild } = message;

    let notifs = await database.get_guild_twitter_channels(guild.id)
    if (notifs.length < 1) {
        message.channel.send("⚠ There are no Twitter notifications added to this server.");
        return;
    }
    notifString = notifs.sort((a,b) => a.screenName.localeCompare(b.screenName)).map(x => `<#${x.channelID}> - [@${x.screenName}](https://twitter.com/${x.screenName}/)${x.retweets ? ` + <:retweet:618184292820058122>`:``}${x.mentionRoleID ? ` <@&${x.mentionRoleID}>`:``}`).join('\n');

    let descriptions = [];
    while (notifString.length > 2048 || notifString.split('\n').length > 25) {
        let currString = notifString.slice(0, 2048);

        let lastIndex = 0;
        for (let i = 0; i < 25; i++) {
            let index = currString.indexOf('\n', lastIndex) + 1;
            if (index) lastIndex = index; else break;
        }
        currString = currString.slice(0, lastIndex);
        notifString = notifString.slice(lastIndex);

        descriptions.push(currString);
    } 
    descriptions.push(notifString);

    let pages = descriptions.map((desc, i) => {
        return {
            content: undefined,
            options: {embed: {
                author: {
                    name: "Twitter Notifications", icon_url: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
                },
                description: desc,
                color: 0x1da1f2,
                footer: {
                    text: `Page ${i+1} of ${descriptions.length}`
                }
            }}
        }
    })

    functions.pages(message, pages);

}

// toggle retweets for twitter/channel
async function retweet_toggle(message, args) {

    let { guild } = message;

    let formatMatch = args.join(' ').trim().match(/^(?:https:\/\/twitter\.com\/)?@?(.+?)(?:\/media\/?)?\s+<?#?(\d{8,})>?/i);
    if (!formatMatch) {
        message.channel.send("⚠ Incorrect formatting. For help with Twitter, see: https://haseulbot.xyz/#twitter");
        return;
    }

    let screenName = formatMatch[1];
    let channelID = formatMatch[2];

    let channel = guild.channels.get(channelID);
    if (!channel) {
        message.channel.send("⚠ The channel provided does not exist in this server.");
        return;
    }

    let response;
    try {
        response = await twitter.get('/1.1/users/show.json', { params: {screen_name: screenName} })
    } catch(e) {
        switch (e.response.status) {
            case 403:
            case 404:
                message.channel.send(`⚠ \`${screenName}\` is an invalid Twitter handle.`);
                break;
            case 429:
                message.channel.send(`⚠ API rate limit exceeded.`);
                break;
            default:
                message.channel.send(`⚠ Unknown error occurred.`);
                break;
        }
        return;
    }
    let { id_str, screen_name } = response.data;

    let toggle;
    try {
        toggle = await database.toggle_retweets(channel.id, id_str)
    } catch(e) {
        console.error(Error(e));
        message.channel.send("⚠ Unknown error occurred.");
        return;
    }

    if (toggle === null) {
        message.channel.send(`⚠ Twitter notifications for \`@${screen_name}\` are not set up in ${channel} on this server.`);
        return;
    }
    
    message.channel.send(toggle ? `You will now be notified for retweets from \`@${screen_name}\` in ${channel}.` :
                                  `You will no longer be notified for retweets from \`@${screen_name}\` in ${channel}.`);

}
