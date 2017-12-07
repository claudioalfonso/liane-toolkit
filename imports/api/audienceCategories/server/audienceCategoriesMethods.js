import SimpleSchema from "simpl-schema";
import { AudienceCategories } from "/imports/api/audienceCategories/audienceCategories.js";
import { ValidatedMethod } from "meteor/mdg:validated-method";
import { Facebook, FacebookApiException } from "fb";
import { AudienceCategoriesHelpers } from "./audienceCategoriesHelpers.js";
// DDPRateLimiter = require('meteor/ddp-rate-limiter').DDPRateLimiter;

export const createAudienceCategory = new ValidatedMethod({
  name: "facebook.audienceCategories.create",
  validate: new SimpleSchema({
    title: {
      type: String
    },
    spec: {
      type: Object,
      blackbox: true
    }
  }).validator(),
  run({ title, spec }) {
    logger.debug("audienceCategories.create called", { title });

    const userId = Meteor.userId();
    if (!userId) {
      throw new Meteor.Error(401, "You need to login");
    }

    if (!Roles.userIsInRole(userId, ["admin"])) {
      throw new Meteor.Error(403, "Access denied");
    }

    const insertDoc = { title, spec };
    AudienceCategories.insert(insertDoc);
    return;
  }
});

export const searchAdInterests = new ValidatedMethod({
  name: "facebook.audienceCategories.searchAdInterests",
  validate: new SimpleSchema({
    q: {
      type: String
    }
  }).validator(),
  run({ q }) {
    logger.debug("audienceCategories.searchAdInterests called", { q });

    const userId = Meteor.userId();
    if (!userId) {
      throw new Meteor.Error(401, "You need to login");
    }

    if (!Roles.userIsInRole(userId, ["admin"])) {
      throw new Meteor.Error(403, "Access denied");
    }

    const user = Meteor.users.findOne(userId);

    return AudienceCategoriesHelpers.facebookSearch({
      type: "adinterest",
      accessToken: user.services.facebook.accessToken,
      q
    });
  }
});

export const searchAdInterestSuggestions = new ValidatedMethod({
  name: "facebook.audienceCategories.searchAdInterestSuggestions",
  validate: new SimpleSchema({
    interest_list: {
      type: Array
    },
    "interest_list.$": {
      type: String
    }
  }).validator(),
  run({ interest_list }) {
    logger.debug("audienceCategories.searchAdInterestSuggestions called", {
      interest_list
    });

    const userId = Meteor.userId();
    if (!userId) {
      throw new Meteor.Error(401, "You need to login");
    }

    if (!Roles.userIsInRole(userId, ["admin"])) {
      throw new Meteor.Error(403, "Access denied");
    }

    const user = Meteor.users.findOne(userId);

    return AudienceCategoriesHelpers.getInterestSuggestions({
      accessToken: user.services.facebook.accessToken,
      interest_list
    });
  }
});