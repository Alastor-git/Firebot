import { DateTime } from "luxon";

import logger from "../logwrapper";
import accountAccess from "../common/account-access";
import twitchApi from "./api";
import frontendCommunicator from "../common/frontend-communicator";
import { settings } from "../common/settings-access";
import eventManager from "../events/EventManager";

class AdManager {
    private _adCheckIntervalId: NodeJS.Timeout;
    private _isAdCheckRunning = false;
    private _upcomingEventTriggered = false;
    private _isAdRunning = false;

    constructor() {
        frontendCommunicator.on("ad-manager:refresh-ad-schedule", async () => {
            await this.runAdCheck();
        });
    }

    async runAdCheck(): Promise<void> {
        if (this._isAdCheckRunning === true) {
            return;
        }

        if (this._isAdRunning) {
            logger.debug("Ad break currently running. Skipping ad timer check.");
            return;
        }

        const streamer = accountAccess.getAccounts().streamer;
        if (streamer.broadcasterType === "") {
            logger.debug("Streamer is not affiliate/partner. Skipping ad timer check.");
            return;
        }

        this._isAdCheckRunning = true;
        logger.debug("Starting ad timer check.");

        const adSchedule = await twitchApi.channels.getAdSchedule();

        if (adSchedule?.nextAdDate != null) {
            frontendCommunicator.send("ad-manager:next-ad", {
                nextAdBreak: adSchedule.nextAdDate,
                duration: adSchedule.duration
            });

            const upcomingTriggerMinutes = Number(settings.getTriggerUpcomingAdBreakMinutes());
            const minutesUntilNextAdBreak = Math.abs(DateTime.fromJSDate(adSchedule.nextAdDate).diffNow("minutes").minutes);

            if (upcomingTriggerMinutes > 0
                && this._upcomingEventTriggered !== true
                && minutesUntilNextAdBreak <= upcomingTriggerMinutes
            ) {
                this._upcomingEventTriggered = true;

                eventManager.triggerEvent("twitch", "ad-break-upcoming", {
                    minutesUntilNextAdBreak: minutesUntilNextAdBreak,
                    adBreakDuration: adSchedule.duration
                });
            }
        } else {
            frontendCommunicator.send("ad-manager:hide-ad-break-timer");
        }

        logger.debug("Ad timer check complete.");
        this._isAdCheckRunning = false;
    }

    triggerAdBreak(duration: number, endsAt: Date) {
        this._isAdRunning = true;
        frontendCommunicator.send("ad-manager:ad-running", {
            duration,
            endsAt
        });
    }

    triggerAdBreakComplete(): void {
        this._upcomingEventTriggered = false;
        this._isAdRunning = false;
        this.runAdCheck();
    }

    startAdCheck(): void {
        if (this._adCheckIntervalId == null) {
            this._adCheckIntervalId = setInterval(async () => {
                await this.runAdCheck();
            }, 15 * 1000);
        }
    }

    stopAdCheck(): void {
        if (this._adCheckIntervalId != null) {
            clearInterval(this._adCheckIntervalId);
            this._adCheckIntervalId = null;
        }
    }
}

const adManager = new AdManager();

export = adManager;