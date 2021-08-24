"use strict";

const { ControlKind, InputEvent } = require('../../interactive/constants/MixplayConstants');
const effectModels = require("../models/effectModels");
const { EffectTrigger } = effectModels;

const { EffectCategory } = require('../../../shared/effect-constants');
const commandHandler = require("../../chat/commands/commandHandler");

/**
 * The Delay effect
 */
const model = {
    /**
   * The definition of the Effect
   */
    definition: {
        id: "firebot:runcommand",
        name: "Run Command",
        description: "Runs effects saved for the selected custom command.",
        icon: "fad fa-exclamation-square",
        categories: [EffectCategory.ADVANCED],
        dependencies: [],
        triggers: effectModels.buildEffectTriggersObject(
            [ControlKind.BUTTON, ControlKind.TEXTBOX],
            [InputEvent.MOUSEDOWN, InputEvent.KEYDOWN, InputEvent.SUBMIT],
            EffectTrigger.ALL
        )
    },
    /**
   * Global settings that will be available in the Settings tab
   */
    globalSettings: {},
    /**
   * The HTML template for the Options view (ie options when effect is added to something such as a button.
   * You can alternatively supply a url to a html file via optionTemplateUrl
   */
    optionsTemplate: `
    <eos-container header="Command Type" pad-top="true">
        <dropdown-select options="{ system: 'System', custom: 'Custom'}" selected="effect.commandType"></dropdown-select>
    </eos-container>

        <eos-container header="Command To Run" pad-top="true">
            <ui-select ng-model="effect.systemCommandId" theme="bootstrap" ng-show="effect.commandType === 'system'">
                <ui-select-match placeholder="Select or search for a command... ">{{$select.selected.trigger}}</ui-select-match>
                <ui-select-choices repeat="command.id as command in systemCommands | filter: { trigger: $select.search }" style="position:relative;">
                    <div ng-bind-html="command.trigger | highlight: $select.search"></div>
                </ui-select-choices>
            </ui-select>

            <ui-select ng-model="effect.customCommandId" theme="bootstrap" ng-show="effect.commandType === 'custom'">
                <ui-select-match placeholder="Select or search for a command... ">{{$select.selected.trigger}}</ui-select-match>
                <ui-select-choices repeat="command.id as command in customCommands | filter: { trigger: $select.search }" style="position:relative;">
                    <div ng-bind-html="command.trigger | highlight: $select.search"></div>
                </ui-select-choices>
            </ui-select>
        </eos-container>

        <eos-container header="Arguments (optional)" pad-top="true">
            <input type="text" style="margin-top: 20px;" class="form-control" ng-model="effect.args" placeholder="Enter some arguments..." replace-variables>
        </eos-container>

        <eos-container header="User who triggers the command (optional)" pad-top="true">
            <input type="text" style="margin-top: 20px;" class="form-control" ng-model="effect.username" placeholder="Enter a username..." replace-variables>
        </eos-container>

        <eos-container>
            <div class="effect-info alert alert-info" pad-top="true">
                Please keep in mind you may get unexpected results if any effects in the selected command have command specific things (such as $arg variables) when running outside the context of a chat event.
            </div>
        </eos-container>
    `,
    /**
   * The controller for the front end Options
   */
    optionsController: ($scope, commandsService) => {
        $scope.systemCommands = commandsService.getSystemCommands();
        $scope.customCommands = commandsService.getCustomCommands();
    },
    /**
   * When the effect is saved
   */
    optionsValidator: effect => {
        let errors = [];
        if (effect.commandType === "custom" && (effect.customCommandId == null || effect.customCommandId === "")) {
            errors.push("Please select a custom command to run.");
        }
        if (effect.commandType === "system" && (effect.systemCommandId == null || effect.systemCommandId === "")) {
            errors.push("Please select a system command to run.");
        }
        return errors;
    },
    /**
   * When the effect is triggered by something
   */
    onTriggerEvent: event => {
        return new Promise(resolve => {
            let { effect, trigger } = event;
            trigger.metadata.username = effect.username;

            if (effect.commandType === "custom") {
                commandHandler.runCustomCommandFromEffect(effect.customCommandId, trigger, effect.args);
            } else {
                commandHandler.runSystemCommandFromEffect(effect.systemCommandId, trigger, effect.args);
                resolve(true);
            }
            resolve(true);
        });
    }
};

module.exports = model;
