import { ValidatedMethod } from "meteor/mdg:validated-method";
import SimpleSchema from "simpl-schema";
import { Campaigns } from "/imports/api/campaigns/campaigns.js";
import { Canvas } from "/imports/api/canvas/canvas.js";

export const getNormalized = new ValidatedMethod({
  name: "canvas.getNormalized",
  validate: new SimpleSchema({
    campaignId: { type: String }
  }).validator(),
  run({ campaignId }) {
    const userId = Meteor.userId();
    if (!userId) {
      throw new Meteor.Error(401, "You need to login");
    }

    if (!Meteor.call("campaigns.canManage", { userId, campaignId })) {
      throw new Meteor.Error(401, "You are not allowed to do this action");
    }

    const data = Canvas.find({ campaignId }).fetch();

    let result = {};

    for (const item of data) {
      if (!result[item.sectionKey]) result[item.sectionKey] = {};
      result[item.sectionKey][item.key] = item.value;
    }

    return result;
  }
});

export const canvasFormUpdate = new ValidatedMethod({
  name: "canvas.formUpdate",
  validate: new SimpleSchema({
    campaignId: {
      type: String
    },
    sectionKey: {
      type: String
    },
    data: {
      type: Object,
      blackbox: true
    }
  }).validator(),
  run({ campaignId, sectionKey, data }) {
    logger.debug("canvas.formUpdate called", {
      campaignId,
      sectionKey,
      data
    });

    const userId = Meteor.userId();
    if (!userId) {
      throw new Meteor.Error(401, "You need to login");
    }

    if (!Meteor.call("campaigns.canManage", { userId, campaignId })) {
      throw new Meteor.Error(401, "You are not allowed to do this action");
    }

    const defaultItem = {
      campaignId,
      sectionKey
    };

    let items = [];

    for (const key in data) {
      items.push({
        ...defaultItem,
        key,
        value: data[key]
      });
    }

    let result = [];

    for ({ campaignId, sectionKey, key, ...item } of items) {
      result.push(
        Canvas.upsert(
          {
            campaignId,
            sectionKey,
            key
          },
          {
            $set: { ...item }
          }
        )
      );
    }

    return true;
  }
});
