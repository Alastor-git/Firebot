"use strict";

const logger = require("../logwrapper");
const profileManager = require("../common/profile-manager");
const frontendCommunicator = require("../common/frontend-communicator");

/**
 * @typedef SavedGiveaway
 * @property {string} id - the id of the giveaway
 * @property {string} name - the name of the giveaway
 * @property {string} prize - the prize that will be or has been given away
 * @property {string[]} entries - the names of the users that have entered
 * @property {string} [winner] - the winner of the giveaway
 * @property {boolean} isOpen - whether the giveaway is open or closed
 */

/** @type {Object.<string, SavedGiveaway>} */
let giveaways = {};

function getGiveawaysDb() {
    return profileManager
        .getJsonDbInProfile("giveaways");
}

function loadGiveaways() {
    logger.debug(`Attempting to load giveaways...`);

    const giveawaysDb = getGiveawaysDb();

    try {
        const giveawaysData = giveawaysDb.getData("/");

        if (giveawaysData) {
            giveaways = giveawaysData;
        }

        logger.debug(`Loaded giveaways.`);
    } catch (err) {
        logger.warn(`There was an error reading giveaways file.`, err);
    }
}

/**
 * @param {SavedGiveaway} giveaway
 */
async function saveGiveaway(giveaway) {
    if (giveaway == null) return;

    if (giveaway.id != null) {
        giveaways[giveaway.id] = giveaway;
    } else {
        const uuidv1 = require("uuid/v1");
        giveaway.id = uuidv1();
        giveaways[giveaway.id] = giveaway;
    }

    try {
        const giveawaysDb = getGiveawaysDb();

        giveawaysDb.push("/" + giveaway.id, giveaway);

        logger.debug(`Saved giveaway ${giveaway.id} to file.`);

        return giveaway;
    } catch (err) {
        logger.warn(`There was an error saving a giveaway.`, err);
        return null;
    }
}

async function saveAllGiveaways(allGiveaways) {
    const giveawaysObject = allGiveaways.reduce((acc, current) => {
        acc[current.id] = current;
        return acc;
    }, {});

    giveaways = giveawaysObject;

    try {
        const giveawaysDb = getGiveawaysDb();

        giveawaysDb.push("/", giveaways);

        logger.debug(`Saved all giveaways to file.`);

    } catch (err) {
        logger.warn(`There was an error saving all giveaways.`, err);
        return null;
    }
}

function deleteGiveaway(giveawayId) {
    if (giveawayId == null) return;

    delete giveaways[giveawayId];

    try {
        const giveawaysDb = getGiveawaysDb();

        giveawaysDb.delete("/" + giveawayId);

        logger.debug(`Deleted giveaway: ${giveawayId}`);

    } catch (err) {
        logger.warn(`There was an error deleting a giveaway.`, err);
    }
}

function getGiveaway(giveawayId) {
    if (giveawayId == null) return null;
    return giveaways[giveawayId];
}

function triggerUiRefresh() {
    frontendCommunicator.send("all-giveaways", giveaways);
}

frontendCommunicator.onAsync("getGiveaways", async () => giveaways);

frontendCommunicator.onAsync("saveGiveaway",
    (/** @type {SavedGiveaway} */ giveaway) => saveGiveaway(giveaway));

frontendCommunicator.onAsync("saveAllGiveaways",
    async (/** @type {SavedGiveaway[]} */ allGiveaways) => {
        saveAllGiveaways(allGiveaways);
    }
);

frontendCommunicator.on("deleteGiveaway", (giveawayId) => {
    deleteGiveaway(giveawayId);
});

exports.loadGiveaways = loadGiveaways;
exports.getGiveaway = getGiveaway;
exports.saveGiveaway = saveGiveaway;
exports.deleteGiveaway = deleteGiveaway;
exports.triggerUiRefresh = triggerUiRefresh;
