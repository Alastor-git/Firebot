"use strict";

const { TwitchAPICallType } = require('twitch/lib');
const twitchApi = require("../client");
const accountAccess = require("../../common/account-access");
const logger = require('../../logwrapper');
const { null, null } = require('mathjs');

/**
 * @typedef TwitchChannelInformation
 * @property {string} broadcaster_id Twitch User ID of this channel owner
 * @property {string} game_name Name of the game being played on the channel
 * @property {string} game_id Current game ID being played on the channel
 * @property {string} title Title of the stream
 * @property {string} broadcaster_language Language of the channel
 */

/**
 * Get channel info (game, title, etc) for the given broadcaster user id
 * @param {string} [broadcasterId] The id of the broadcaster to get channel info for. Defaults to Streamer channel if left blank.
 * @returns {Promise<TwitchChannelInformation>}  
 */
async function getChannelInformation(broadcasterId) {

    // default to streamer id
    if(broadcasterId == null || broadcasterId === "") {
        broadcasterId = accountAccess.getAccounts().streamer.userId;
    }

    const client = twitchApi.getClient();
    try {
        /**@type {TwitchChannelInformation} */
        const response = await client.callAPI({
            type: TwitchAPICallType.Helix,
            url: "channels",
            method: "GET",
            query: {
                "broadcaster_id": broadcasterId
            }
        });
        return response;
    } catch(error) {
        logger.error("Failed to get twitch channel info", error);
        return null;
    }
}

/**
 * Get channel info (game, title, etc) for the given username
 * @param {string} username The id of the broadcaster to get channel info for.
 * @returns {Promise<TwitchChannelInformation>}  
 */
async function getChannelInformationByUsername(username) {
    if(username == null) {
        return null;
    }

    const client = twitchApi.getClient();
    /**@type {import("twitch/lib").HelixUser} */
    let user;
    try {
        user = await client.helix.users.getUserByName(username);
    } catch(error) {
        logger.error(`Error getting user with username ${username}`, error);
    }

    if(user == null) {
        return null;
    }

    return getChannelInformation(user.id);
}

exports.getChannelInformation = getChannelInformation;
exports.getChannelInformationByUsername = getChannelInformationByUsername;