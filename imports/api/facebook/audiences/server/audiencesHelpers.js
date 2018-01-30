import { Promise } from "meteor/promise";
import { FacebookAccounts } from "/imports/api/facebook/accounts/accounts.js";
import { Geolocations } from "/imports/api/geolocations/geolocations.js";
import { Campaigns } from "/imports/api/campaigns/campaigns.js";
import { AdAccountsHelpers } from "/imports/api/facebook/adAccounts/server/adAccountsHelpers.js";
import { Contexts } from "/imports/api/contexts/contexts.js";
import { FacebookAudiences } from "/imports/api/facebook/audiences/audiences.js";
import { AudienceCategories } from "/imports/api/audienceCategories/audienceCategories.js";
import { Jobs } from "/imports/api/jobs/jobs";
import { JobsHelpers } from "/imports/api/jobs/server/jobsHelpers.js";
import { Facebook, FacebookApiException } from "fb";
import redisClient from "/imports/startup/server/redis";
import crypto from "crypto";
import _ from "underscore";
import moment from "moment";

const options = {
  version: "v2.11",
  client_id: Meteor.settings.facebook.clientId,
  client_secret: Meteor.settings.facebook.clientSecret
};

const _fb = new Facebook(options);

const FacebookAudiencesHelpers = {
  async updateAccountAudience({ campaignId, facebookAccountId }) {
    check(facebookAccountId, String);

    logger.debug("AudienceCategoriesHelpers.updateAccountAudience", {
      campaignId,
      facebookAccountId
    });

    const campaign = Campaigns.findOne(campaignId);
    const adAccountId = campaign.adAccountId;
    const context = Contexts.findOne(campaign.contextId);
    const audienceCategories = AudienceCategories.find({
      _id: { $in: context.audienceCategories }
    }).fetch();

    const adAccountUsers = AdAccountsHelpers.getUsers({ adAccountId });

    if (!adAccountUsers.length) {
      throw new Meteor.Error("Ad account has no registered users on the app");
    }

    const tokens = adAccountUsers.map(
      user => user.services.facebook.accessToken
    );

    let jobIds = [];
    for (const audienceCategory of audienceCategories) {
      jobIds = jobIds.concat(
        FacebookAudiencesHelpers.fetchAudienceByCategory({
          contextId: context._id,
          campaignId: campaign._id,
          adAccountId,
          tokens,
          audienceCategoryId: audienceCategory._id,
          facebookAccountId
        })
      );
    }

    logger.debug("AudienceCategoriesHelpers.updateAccountAudience jobIds", {
      jobIds
    });

    return;

    // Wait jobs to finish
    // return await new Promise(resolve => {
    //   let completionMap = {};
    //   const query = Jobs.find({
    //     _id: { $in: jobIds }
    //   });
    //   query.observe({
    //     removed: function(job) {
    //       completionMap[job._id] = true;
    //       if (Object.keys(completionMap).length == jobIds.length) {
    //         resolve();
    //       }
    //     }
    //   });
    //   const jobs = query.fetch();
    //   if(!jobs.length) {
    //     resolve();
    //   }
    // });
  },
  fetchAudienceByCategory({
    contextId,
    campaignId,
    adAccountId,
    tokens,
    facebookAccountId,
    audienceCategoryId
  }) {
    check(contextId, String);
    check(campaignId, String);
    check(adAccountId, String);
    check(tokens, Array);
    check(facebookAccountId, String);
    check(audienceCategoryId, String);

    logger.debug("FacebookAudiencesHelpers.fetchAudienceByCategory", {
      contextId,
      campaignId,
      adAccountId,
      tokens,
      facebookAccountId,
      audienceCategoryId
    });

    const audienceCategory = AudienceCategories.findOne(audienceCategoryId);

    let spec = audienceCategory.spec;

    if (spec.interests)
      spec.interests = spec.interests.map(interest => interest.id);

    const jobIds = FacebookAudiencesHelpers.fetchContextAudiences({
      contextId,
      campaignId,
      adAccountId,
      tokens,
      facebookAccountId,
      audienceCategoryId,
      spec
    });

    return jobIds;
  },
  _getRegionFacebookType({ type }) {
    switch (type) {
      case "region": {
        return "regions";
      }
      case "country": {
        return "countries";
      }
      case "cities":
      case "city": {
        return "cities";
      }
    }
  },
  _buildFacebookLocations({ locations }) {
    if (!Array.isArray(locations)) {
      locations = [locations];
    }
    let geolocations = {};
    locations.forEach(location => {
      const type = this._getRegionFacebookType({ type: location.type });
      const key = location.key;
      if (!geolocations[type]) geolocations[type] = [];
      if (type == "countries") {
        geolocations[type].push(key);
      } else {
        geolocations[type].push({ key });
      }
    });
    return geolocations;
  },
  _buildFacebookCustomLocations({ center }) {
    return {
      custom_locations: [
        {
          latitude: center.center[0],
          longitude: center.center[1],
          radius: center.radius,
          distance_unit: "kilometer"
        }
      ]
    };
  },
  fetchContextAudiences({
    contextId,
    campaignId,
    adAccountId,
    tokens,
    facebookAccountId,
    audienceCategoryId,
    spec
  }) {
    check(contextId, String);
    check(campaignId, String);
    check(adAccountId, String);
    check(tokens, Array);
    check(facebookAccountId, String);
    check(audienceCategoryId, String);
    check(spec, Object);

    logger.debug("FacebookAudiencesHelpers.fetchContextAudiences", {
      contextId,
      campaignId,
      adAccountId,
      tokens,
      facebookAccountId,
      audienceCategoryId,
      spec
    });

    const context = Contexts.findOne(contextId);
    if (!context) {
      return { error: "Context does not exists" };
    }

    let jobIds = [];
    for (const geolocationId of context.geolocations) {
      const geolocation = Geolocations.findOne(geolocationId);
      if (
        (!geolocation.type || geolocation.type == "location") &&
        geolocation.facebook
      ) {
        spec["geo_locations"] = this._buildFacebookLocations({
          locations: geolocation.facebook
        });
      } else if (geolocation.type == "center") {
        spec["geo_locations"] = this._buildFacebookCustomLocations({
          center: geolocation.center
        });
      }

      const jobId = JobsHelpers.addJob({
        jobType: "audiences.fetchAndCreateSpecAudience",
        jobData: {
          campaignId,
          adAccountId,
          tokens,
          facebookAccountId,
          geolocationId,
          audienceCategoryId,
          spec
        }
      });

      jobIds.push(jobId);
    }
    return jobIds;
  },
  async fetchAndCreateSpecAudience({
    campaignId,
    adAccountId,
    tokens,
    facebookAccountId,
    geolocationId,
    audienceCategoryId,
    spec
  }) {
    logger.debug("FacebookAudiencesHelpers.fetchAndCreateSpecAudience", {
      campaignId,
      adAccountId,
      tokens,
      facebookAccountId,
      geolocationId,
      audienceCategoryId,
      spec
    });

    check(campaignId, String);
    check(adAccountId, String);
    check(tokens, Array);
    check(facebookAccountId, String);
    check(geolocationId, String);
    check(audienceCategoryId, String);
    check(spec, Object);

    const accessToken = tokens[0];

    const fetchDate = moment().format("YYYY-MM-DD");

    spec["connections"] = [facebookAccountId];

    const sleep = ms =>
      new Promise(resolve => {
        setTimeout(resolve, ms);
      });

    const fetch = async function(spec) {
      const hash = crypto
        .createHash("sha1")
        .update(JSON.stringify(spec) + fetchDate)
        .digest("hex");
      const redisKey = `audiences::fetch::${hash}`;
      try {
        let ready = false;
        let res = redisClient.getSync(redisKey);
        if (res) {
          return JSON.parse(res).data.users;
        } else {
          let multiplier = 1;
          while (ready === false) {
            res = await _fb.api(`${adAccountId}/reachestimate`, {
              targeting_spec: spec,
              access_token: accessToken
            });
            ready = res.data.estimate_ready;
            await sleep(5000 * multiplier);
            multiplier = multiplier + 0.5;
          }
          redisClient.setSync(
            redisKey,
            JSON.stringify(res),
            "EX",
            24 * 60 * 60
          );
          return res.data.users;
        }
      } catch (error) {
        throw new Meteor.Error(error);
      }
    };

    let result = {};

    result["estimate"] = await fetch(spec);
    result["total"] = await fetch(_.omit(spec, "interests"));
    result["location_estimate"] = await fetch(_.omit(spec, "connections"));
    result["location_total"] = await fetch(
      _.omit(spec, "interests", "connections")
    );

    return FacebookAudiences.upsert(
      {
        campaignId: campaignId,
        facebookAccountId: facebookAccountId,
        audienceCategoryId: audienceCategoryId,
        fetch_date: fetchDate,
        geolocationId: geolocationId
      },
      { $set: result }
    );
  }
};

exports.FacebookAudiencesHelpers = FacebookAudiencesHelpers;
