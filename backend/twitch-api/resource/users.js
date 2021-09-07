"use strict";

const accountAccess = require("../../common/account-access");

const twitchApi = require("../client");
const { TwitchAPICallType } = require("twitch/lib");

const NodeCache = require("node-cache");
const logger = require("../../logwrapper");

const userRoleCache = new NodeCache({ stdTTL: 30, checkperiod: 5 });

const getUserByName = async (username) => {
    try {
        const client = twitchApi.getClient();

        const response = await client.callApi({
            type: TwitchAPICallType.Helix,
            url: "users",
            query: {
                "login": username
            }
        });

        if (response && response.data) {
            return response.data[0];
        }
    } catch (err) {
        logger.debug("Couldn't find user by name", err);
    }
};

async function getUserChatInfo(userId) {
    const client = twitchApi.getClient();

    const streamer = accountAccess.getAccounts().streamer;

    const chatUser = await client.callApi({
        type: TwitchAPICallType.Kraken,
        url: `users/${userId}/chat/channels/${streamer.userId}`
    });

    return chatUser;
}

async function getUserChatInfoByName(username) {
    const client = twitchApi.getClient();
    try {
        const user = await client.helix.users.getUserByName(username);
        return getUserChatInfo(user.id);
    } catch (error) {
        return null;
    }
}

async function getUserSubInfo(userId) {
    const client = twitchApi.getClient();
    const streamer = accountAccess.getAccounts().streamer;
    const subInfo = await client.helix.subscriptions.getSubscriptionForUser(streamer.userId, userId);

    return subInfo;
}

async function getUserSubInfoByName(username) {
    try {
        const client = twitchApi.getClient();
        const user = await client.helix.users.getUserByName(username);

        return getUserSubInfo(user.id);
    } catch (error) {
        return null;
    }
}

async function getUserSubscriberRole(userIdOrName) {
    const isName = isNaN(userIdOrName);
    const subInfo = isName ?
        (await getUserSubInfoByName(userIdOrName)) :
        (await getUserSubInfo(userIdOrName));

    if (subInfo == null || subInfo.tier == null) {
        return null;
    }

    let role = '';
    switch (subInfo.tier) {
    case "1000":
        role = "tier1";
        break;
    case "2000":
        role = "tier2";
        break;
    case "3000":
        role = "tier3";
        break;
    }

    return role;
}

async function getUsersChatRoles(userIdOrName = "") {

    userIdOrName = userIdOrName.toLowerCase();

    /**@type {string[]} */
    const cachedRoles = userRoleCache.get(userIdOrName);

    if (cachedRoles != null) {
        return cachedRoles;
    }

    const isName = isNaN(userIdOrName);

    const userChatInfo = isName ?
        (await getUserChatInfoByName(userIdOrName)) :
        (await getUserChatInfo(userIdOrName));

    const subscriberRole = await getUserSubscriberRole(userIdOrName);

    if (userChatInfo == null && subscriberRole == null) {
        return [];
    }

    const roles = [];
    if (userChatInfo.badges) {
        for (let badge of userChatInfo.badges) {
            if (badge.id === "broadcaster") {
                roles.push("broadcaster");
            } else if (badge.id === "subscriber" || badge.id === "founder") {
                roles.push("sub");
            } else if (badge.id === "vip") {
                roles.push("vip");
            } else if (badge.id === "moderator") {
                roles.push("mod");
            }
        }
    }

    if (subscriberRole != null) {
        roles.push(subscriberRole);
    }

    userRoleCache.set(userChatInfo._id, roles);
    userRoleCache.set(userChatInfo.login, roles);

    return roles;
}

async function updateUserRole(userId, role, addOrRemove) {
    // eslint-disable-next-line no-warning-comments
    //TODO: Needs to be updated for twitch.
    return true;
}

async function blockUser(userId) {
    if (userId == null) return;

    const client = twitchApi.getClient();

    try {
        await client.callApi({
            type: TwitchAPICallType.Helix,
            method: "PUT",
            url: "users/blocks",
            query: {
                "target_user_id": userId
            }
        });

        return true;
    } catch (err) {
        logger.error("Couldn't block user", err);
        return false;
    }

}

const blockUserByName = async (username) => {
    try {
        const user = await getUserByName(username);
        blockUser(user.id);
    } catch (err) {
        logger.error("Couldn't block user", err);
    }
};

async function unblockUser(userId) {
    if (userId == null) return;

    const client = twitchApi.getClient();

    try {
        await client.callApi({
            type: TwitchAPICallType.Helix,
            method: "DELETE",
            url: "users/blocks",
            query: {
                "target_user_id": userId
            }
        });

        return true;
    } catch (err) {
        logger.error("Couldn't unblock user", err);

        return false;
    }
}

const unblockUserByName = async (username) => {
    try {
        const user = await getUserByName(username);
        unblockUser(user.id);
    } catch (err) {
        logger.error("Couldn't unblock user", err);
    }
};

async function getAllBlockedUsers(userId, cursor) {
    const client = twitchApi.getClient();

    try {
        let response = {};

        if (cursor == null) {
            response = await client.callApi({
                type: TwitchAPICallType.Helix,
                url: "users/blocks",
                query: {
                    "broadcaster_id": userId
                }
            });
        } else {
            response = await client.callApi({
                type: TwitchAPICallType.Helix,
                url: "users/blocks",
                query: {
                    "broadcaster_id": userId,
                    after: cursor
                }
            });
        }

        if (response == null || response.data == null || response.data.length < 1) {
            logger.error("Couldn't find any blocked users");
            return null;
        }

        return response;
    } catch (error) {
        logger.error("Failed to get blocked users", error);
        return null;
    }
}

async function getAllBlockedUsersPaginated(streamerId) {
    let response = await getAllBlockedUsers(streamerId);
    if (response == null) return;

    let cursor = "";
    let blockedUsers = response.data.map(u => u.user_id);

    while (response.pagination.cursor && response.pagination.cursor !== cursor) {
        cursor = response.pagination.cursor;
        response = await getAllBlockedUsers(streamerId, cursor);
        blockedUsers = blockedUsers.concat(response.data.map(u => u.user_id));
    }

    return blockedUsers;
}

async function getFollowDateForUser(username) {
    const client = twitchApi.getClient();
    const streamerData = accountAccess.getAccounts().streamer;

    const userId = (await client.kraken.users.getUserByName(username)).id;
    const channelId = (await client.kraken.users.getUserByName(streamerData.username)).id;

    const followerDate = (await client.kraken.users.getFollowedChannel(userId, channelId)).followDate;

    if (followerDate == null || followerDate.length < 1) {
        return null;
    }

    return new Date(followerDate);
}

async function doesUserFollowChannel(username, channelName) {
    if (username == null || channelName == null) return false;

    const client = twitchApi.getClient();

    if (username.toLowerCase() === channelName.toLowerCase()) {
        return true;
    }

    const userId = (await client.kraken.users.getUserByName(username)).id;
    const channelId = (await client.kraken.users.getUserByName(channelName)).id;

    if (userId == null || channelId == null) {
        return false;
    }

    const userFollow = await client.kraken.users.getFollowedChannel(userId, channelId);

    if (userFollow == null) {
        return false;
    }

    if (userFollow.followDate == null || userFollow.followDate.length < 1) {
        return false;
    }

    return true;
}

exports.getUserChatInfoByName = getUserChatInfoByName;
exports.getUsersChatRoles = getUsersChatRoles;
exports.blockUser = blockUser;
exports.blockUserByName = blockUserByName;
exports.unblockUser = unblockUser;
exports.unblockUserByName = unblockUserByName;
exports.getAllBlockedUsersPaginated = getAllBlockedUsersPaginated;
exports.getFollowDateForUser = getFollowDateForUser;
exports.updateUserRole = updateUserRole;
exports.doesUserFollowChannel = doesUserFollowChannel;
