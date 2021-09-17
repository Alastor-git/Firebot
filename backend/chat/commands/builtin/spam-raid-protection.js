"use strict";

const chat = require("../../twitch-chat");
const chatModerationManager = require("../../moderation/chat-moderation-manager");
const commandManager = require("../CommandManager");
const frontendCommunicator = require("../../../common/frontend-communicator");

const activateProtectionOptions = async (commandOptions) => {
    if (commandOptions.enableFollowerOnly) {
        chat.enableFollowersOnly(commandOptions.enableFollowerOnlyDuration);
    }

    if (commandOptions.enableSubscriberOnly) {
        chat.enableSubscribersOnly();
    }

    if (commandOptions.enableEmoteOnly) {
        chat.enableEmoteOnly();
    }

    if (commandOptions.enableSlowMode) {
        chat.enableSlowMode(commandOptions.enableSlowModeDelay);
    }

    if (commandOptions.clearChat) {
        chat.clearChat();
    }

    if (commandOptions.banRaiders || commandOptions.blockRaiders) {
        chatModerationManager.enableSpamRaidProtection(commandOptions.banRaiders, commandOptions.blockRaiders);
    }

    setTimeout(() => {
        chat.sendChatMessage(commandOptions.displayTemplate);
    }, 2000);
};

const toggleSetting = (option, setting) => {
    const systemCommands = commandManager.getAllSystemCommandDefinitions();
    let command = systemCommands.find(sc => sc.id === "firebot:spamRaidProtection");

    if (command == null) return;

    if (setting === "on") {
        command.options[option].value = true;
    } else if (setting === "off") {
        command.options[option].value = false;
    } else {
        command.options[option].value = !command.options[option].value;
    }

    commandManager.saveSystemCommandOverride(command);
    frontendCommunicator.send("custom-commands-updated");
};

const spamRaidProtection = {
    definition: {
        id: "firebot:spamRaidProtection",
        name: "Spam Raid Protection",
        active: true,
        hidden: false,
        trigger: "!spamraidprotection",
        description: "Toggles protective measures like chat clearing, follow only, sub only, emote only and slow mode, as well as whether spam raiders should be banned and/or blocked or not.",
        autoDeleteTrigger: false,
        scanWholeMessage: false,
        cooldown: {
            user: 0,
            global: 30
        },
        restrictionData: {
            restrictions: [
                {
                    id: "sys-cmd-mods-only-perms",
                    type: "firebot:permissions",
                    mode: "roles",
                    roleIds: [
                        "broadcaster",
                        "mod"
                    ]
                }
            ]
        },
        options: {
            displayTemplate: {
                type: "string",
                title: "Output Template",
                description: "A message that will tell the users what is going on.",
                default: `We are currently experiencing a spam raid, and have therefore temporarily turned on protective measures.`,
                useTextArea: true
            },
            enableFollowerOnly: {
                type: "boolean",
                title: "Follower only mode",
                description: "Allows you to restrict chat to all or some of your followers, based on how long they’ve followed (0 minutes to 3 months).",
                default: false
            },
            enableFollowerOnlyDuration: {
                type: "string",
                title: "Follower only mode duration (formats: 1m / 1h / 1d / 1w / 1mo)",
                description: "Allows you to restrict chat to all or some of your followers, based on how long they’ve followed (0 minutes to 3 months).",
                default: "15m"
            },
            enableEmoteOnly: {
                type: "boolean",
                title: "Emote only mode",
                description: "Chatters can only chat with Twitch emotes.",
                default: false
            },
            enableSubscriberOnly: {
                type: "boolean",
                title: "Subscriber only mode",
                description: "Only subscribers to the channel are allowed to chat.",
                default: false
            },
            enableSlowMode: {
                type: "boolean",
                title: "Slow mode",
                description: "In slow mode, users can only post one chat message every x seconds.",
                default: false
            },
            enableSlowModeDelay: {
                type: "number",
                title: "Slow mode delay in seconds",
                description: "In slow mode, users can only post one chat message every x seconds.",
                default: 30
            },
            clearChat: {
                type: "boolean",
                title: "Clear chat",
                description: "The chat will be cleared.",
                default: true
            },
            blockRaiders: {
                type: "boolean",
                title: "Block raiders",
                description: "Block every user that posted the raid message.",
                default: true
            },
            banRaiders: {
                type: "boolean",
                title: "Ban raiders",
                description: "Ban every user that posted the raid message from your channel.",
                default: true
            }
        },
        subCommands: [
            {
                arg: "off",
                usage: "off",
                description: "Turn off the protection command."
            },
            {
                arg: "followeronly",
                usage: "followeronly [on/off]",
                description: "Whether follower-only mode should be turned on when the protection command is used."
            },
            {
                arg: "subsonly",
                usage: "subsonly [on/off]",
                description: "Whether subs-only mode should be turned on when the protection command is used."
            },
            {
                arg: "emoteonly",
                usage: "emoteonly [on/off]",
                description: "Whether emote-only mode should be turned on when the protection command is used."
            },
            {
                arg: "slow",
                usage: "slow [on/off]",
                description: "Whether slow mode should be turned on when the protection command is used."
            },
            {
                arg: "clearchat",
                usage: "clearchat [on/off]",
                description: "Whether chat should be cleared when the protection command is used."
            },
            {
                arg: "banraiders",
                usage: "banraiders [on/off]",
                description: "Whether spam raiders should be banned when the protection command is used."
            },
            {
                arg: "blockraiders",
                usage: "blockraiders [on/off]",
                description: "Whether spam raiders should be blocked when the protection command is used."
            }
        ]
    },
    onTriggerEvent: async event => {
        const { commandOptions } = event;
        const args = event.userCommand.args;

        if (args.length === 0) {
            activateProtectionOptions(commandOptions);
            return;
        }

        let option = "";
        switch (args[0]) {
        case "followeronly":
            option = "enableFollowerOnly";
            break;
        case "subsonly":
            option = "enableSubscriberOnly";
            break;
        case "emoteonly":
            option = "enableEmoteOnly";
            break;
        case "slow":
            option = "enableSlowMode";
            break;
        case "clearchat":
            option = "clearChat";
            break;
        case "banraiders":
            option = "banRaiders";
            break;
        case "blockraiders":
            option = "blockRaiders";
            break;
        }

        if (args.length === 2) {
            toggleSetting(option, args[1]);
        } else {
            if (args[0] === "off") {
                chat.disableFollowersOnly();
                chat.disableSubscribersOnly();
                chat.disableEmoteOnly();
                chat.disableSlowMode();
                chatModerationManager.disableSpamRaidProtection();

                chat.sendChatMessage("Protection turned off.");
                return;
            }

            toggleSetting(option);
        }
    }
};

module.exports = spamRaidProtection;