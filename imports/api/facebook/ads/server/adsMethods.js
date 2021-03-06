import SimpleSchema from "simpl-schema";
import { ValidatedMethod } from "meteor/mdg:validated-method";
import { AdsHelpers } from "./adsHelpers.js";

export const getAdCampaigns = new ValidatedMethod({
  name: "ads.getAdCampaigns",
  validate: new SimpleSchema({
    campaignId: {
      type: String
    }
  }).validator(),
  run({ campaignId }) {
    logger.debug("ads.getAdCampaigns called", { campaignId });

    const userId = Meteor.userId();
    if (!userId) {
      throw new Meteor.Error(401, "You need to login");
    }

    if (!Meteor.call("campaigns.canManage", { campaignId, userId })) {
      throw new Meteor.Error(401, "You are not part of this campaign");
    }

    return AdsHelpers.getAdCampaigns({ campaignId });
  }
});

export const createAd = new ValidatedMethod({
  name: "ads.create",
  validate: new SimpleSchema({
    name: {
      type: String,
      optional: true
    },
    campaignId: {
      type: String
    },
    facebookAccountId: {
      type: String
    },
    audienceCategoryId: {
      type: String
    },
    geolocationId: {
      type: String
    },
    useConnection: {
      type: Boolean
    },
    adConfig: {
      type: Object,
      blackbox: true
    }
  }).validator(),
  run({
    name,
    campaignId,
    facebookAccountId,
    audienceCategoryId,
    geolocationId,
    useConnection,
    adConfig
  }) {
    this.unblock();
    logger.debug("ads.create called", {
      name,
      campaignId,
      facebookAccountId,
      audienceCategoryId,
      geolocationId,
      useConnection,
      adConfig
    });

    const userId = Meteor.userId();
    if (!userId) {
      throw new Meteor.Error(401, "You need to login");
    }

    if (!Meteor.call("campaigns.canManage", { campaignId, userId })) {
      throw new Meteor.Error(401, "You are not part of this campaign");
    }

    const ad = AdsHelpers.createAd({
      name,
      campaignId,
      facebookAccountId,
      audienceCategoryId,
      geolocationId,
      useConnection,
      adConfig
    });

    return ad;
  }
});
