import { Promise } from "meteor/promise";
import { Campaigns } from "/imports/api/campaigns/campaigns.js";
import { FacebookAccounts } from "/imports/api/facebook/accounts/accounts.js";
import {
  People,
  PeopleTags,
  PeopleLists,
  PeopleExports
} from "/imports/api/facebook/people/people.js";
import { PeopleHelpers } from "/imports/api/facebook/people/server/peopleHelpers.js";
import { MapFeatures } from "/imports/api/mapFeatures/mapFeatures";
import { FAQ } from "/imports/api/faq/faq.js";
import { FacebookAudiences } from "/imports/api/facebook/audiences/audiences.js";
import { Canvas } from "/imports/api/canvas/canvas.js";
import { Jobs } from "/imports/api/jobs/jobs.js";
import { FacebookAccountsHelpers } from "/imports/api/facebook/accounts/server/accountsHelpers.js";
import { FacebookAudiencesHelpers } from "/imports/api/facebook/audiences/server/audiencesHelpers.js";
import { UsersHelpers } from "/imports/api/users/server/usersHelpers.js";
import { JobsHelpers } from "/imports/api/jobs/server/jobsHelpers.js";
import _ from "underscore";

const YEEKO = Meteor.settings.yeeko;

const CampaignsHelpers = {
  refreshCampaignAccountsTokens({ campaignId }) {
    const campaign = Campaigns.findOne(campaignId);
    let accounts = [campaign.facebookAccount];
    if (campaign.accounts) {
      accounts = accounts.concat(campaign.accounts);
    }
    const users = campaign.users;
    let tokens = {};
    for (let campaignUser of users) {
      let userAccounts = {};
      try {
        userAccounts = FacebookAccountsHelpers.getUserAccounts({
          userId: campaignUser.userId
        });
      } catch (e) {
        console.log(e);
      }
      if (userAccounts && userAccounts.result && userAccounts.result.length) {
        userAccounts.result.forEach(acc => {
          if (accounts.find(account => acc.id == account.facebookId)) {
            const tokenDebug = UsersHelpers.debugFBToken({
              token: acc.access_token
            });
            if (tokenDebug && tokenDebug.is_valid) {
              tokens[acc.id] = acc.access_token;
            }
          }
        });
      }
    }
    let update = [];
    for (let account of accounts) {
      if (tokens[account.facebookId]) {
        const longToken = FacebookAccountsHelpers.exchangeFBToken({
          token: tokens[account.facebookId]
        });
        Campaigns.update(
          {
            _id: campaignId,
            "accounts.facebookId": account.facebookId
          },
          {
            $set: {
              "accounts.$.accessToken": longToken.result
            }
          }
        );
      }
    }
  },
  setMainAccount({ campaignId, account }) {
    check(campaignId, String);
    check(account, Object);

    const upsertObj = {
      $set: {
        name: account.name,
        category: account.category,
        fanCount: account.fan_count
      }
    };

    FacebookAccounts.upsert({ facebookId: account.id }, upsertObj);

    const token = FacebookAccountsHelpers.exchangeFBToken({
      token: account.access_token
    });

    const updateObj = {
      facebookId: account.id,
      accessToken: token.result,
      chatbot: {
        active: false
      }
    };

    // Facebook subscription
    FacebookAccountsHelpers.updateFBSubscription({
      facebookAccountId: account.id,
      token: token.result
    });

    Campaigns.update(
      { _id: campaignId },
      { $set: { facebookAccount: updateObj } }
    );

    JobsHelpers.addJob({
      jobType: "entries.updateAccountEntries",
      jobData: {
        campaignId,
        facebookId: account.id,
        accessToken: token.result
      }
    });

    JobsHelpers.addJob({
      jobType: "campaigns.healthCheck",
      jobData: {
        campaignId
      }
    });
    // JobsHelpers.addJob({
    //   jobType: "audiences.updateAccountAudience",
    //   jobData: {
    //     campaignId,
    //     facebookAccountId: account.id
    //   }
    // });
    JobsHelpers.addJob({
      jobType: "people.updateFBUsers",
      jobData: {
        campaignId,
        facebookAccountId: account.id
      }
    });
    return;
  },
  addAccount({ campaignId, account }) {
    check(campaignId, String);
    check(account, Object);

    const upsertObj = {
      $set: {
        name: account.name,
        category: account.category,
        fanCount: account.fan_count
      }
    };

    FacebookAccounts.upsert({ facebookId: account.id }, upsertObj);

    const token = FacebookAccountsHelpers.exchangeFBToken({
      token: account.access_token
    });

    const updateObj = {
      facebookId: account.id,
      accessToken: token.result,
      chatbot: {
        active: false
      }
    };

    // Facebook subscription
    try {
      const fbRes = Promise.await(
        FB.api(`${account.id}/subscribed_apps`, "post", {
          subscribed_fields: [
            "feed",
            "messages",
            "message_deliveries",
            "messaging_postbacks",
            "messaging_optins",
            "message_deliveries",
            "message_reads"
          ],
          access_token: token.result
        })
      );
    } catch (err) {
      throw new Meteor.Error(500, "Error trying to subscribe");
    }

    Campaigns.update(
      { _id: campaignId },
      { $addToSet: { accounts: updateObj } }
    );

    JobsHelpers.addJob({
      jobType: "entries.updateAccountEntries",
      jobData: {
        campaignId,
        facebookId: account.id,
        accessToken: token.result
      }
    });
    JobsHelpers.addJob({
      jobType: "audiences.updateAccountAudience",
      jobData: {
        campaignId,
        facebookAccountId: account.id
      }
    });
    JobsHelpers.addJob({
      jobType: "people.updateFBUsers",
      jobData: {
        campaignId,
        facebookAccountId: account.id
      }
    });
    return;
  },
  removeAccount({ campaignId, facebookId }) {
    check(campaignId, String);
    check(facebookId, String);

    const campaign = Campaigns.findOne(campaignId);

    if (!campaign) {
      throw new Meteor.Error(404, "Campaign not found");
    }

    let account;
    if (campaign.accounts && campaign.accounts.length) {
      account = campaign.accounts.find(acc => acc.facebookId == facebookId);
    }

    FacebookAudiences.remove({
      campaignId,
      facebookAccountId: facebookId
    });

    // Remove entry jobs
    Jobs.remove({
      $or: [
        { "data.facebookId": facebookId },
        { "data.facebookAccountId": facebookId }
      ],
      "data.campaignId": campaignId
    });

    if (account) {
      Campaigns.update({ _id: campaignId }, { $pull: { accounts: account } });
    }
    return;
  },
  addAudienceAccount({ campaignId, account }) {
    check(campaignId, String);
    check(account, Object);

    logger.debug("CampaignsHelpers.addAudienceAccountToCampaign: called", {
      campaignId,
      account
    });

    throw new Meteor.Error(500, "This method is unavailable");

    let updateObj = {
      facebookId: account.id,
      name: account.name
    };

    if (account.fan_count) {
      updateObj.fanCount = account.fan_count;
    }

    const campaign = Campaigns.findOne(campaignId);

    const audienceAccount = _.findWhere(campaign.audienceAccounts, {
      facebookId: account.id
    });

    if (audienceAccount) {
      throw new Meteor.Error(403, "Audience Account already connected");
    }

    Campaigns.update(
      { _id: campaignId },
      { $addToSet: { audienceAccounts: updateObj } }
    );

    JobsHelpers.addJob({
      jobType: "audiences.updateAccountAudience",
      jobData: {
        campaignId,
        facebookAccountId: account.id
      }
    });
    return;
  },
  removeAudienceAccount({ campaignId, facebookId }) {
    check(campaignId, String);
    check(facebookId, String);

    const audienceAccount = _.findWhere(campaign.audienceAccounts, {
      facebookId
    });

    if (!audienceAccount) {
      throw new Meteor.Error(404, "Audience Account not found");
    }

    Jobs.remove({
      "data.campaignId": campaignId,
      "data.facebookAccountId": facebookId
    });

    FacebookAudiences.remove({
      campaignId,
      facebookAccountId: facebookId
    });

    return Campaigns.update(
      { _id: campaignId },
      { $pull: { audienceAccounts: audienceAccount } }
    );
  },
  refreshHealthCheck({ campaignId }) {
    const healthCheckJob = Jobs.findOne({
      type: "campaigns.healthCheck",
      "data.campaignId": campaignId
    });
    if (healthCheckJob) {
      if (
        healthCheckJob.status == "failed" ||
        healthCheckJob.status == "cancelled"
      ) {
        Jobs.getJob(healthCheckJob._id).restart();
      } else if (healthCheckJob.status == "waiting") {
        Jobs.getJob(healthCheckJob._id).ready({ time: Jobs.foreverDate });
      }
    } else {
      JobsHelpers.addJob({
        jobType: "campaigns.healthCheck",
        jobData: {
          campaignId
        }
      });
    }
  },
  refreshCampaignJobs({ campaignId }) {
    check(campaignId, String);
    const campaign = Campaigns.findOne(campaignId);
    // if (campaign.audienceAccounts && campaign.audienceAccounts.length) {
    //   for (const account of campaign.audienceAccounts) {
    //     this.refreshAccountJob({
    //       campaignId,
    //       facebookAccountId: account.facebookId,
    //       type: "audiences"
    //     });
    //   }
    // }

    // health check job
    this.refreshHealthCheck({ campaignId });

    let accountsIds = _.pluck(campaign.accounts, "facebookId");
    if (campaign.facebookAccount) {
      accountsIds.push(campaign.facebookAccount.facebookId);
    }
    if (accountsIds.length) {
      const accounts = FacebookAccounts.find({
        facebookId: { $in: accountsIds }
      }).fetch();
      for (const account of accounts) {
        this.refreshAccountJob({
          campaignId,
          facebookAccountId: account.facebookId,
          type: "entries"
        });
        // this.refreshAccountJob({
        //   campaignId,
        //   facebookAccountId: account.facebookId,
        //   type: "audiences"
        // });
      }
    }
  },
  refreshAccountJob({ campaignId, facebookAccountId, type }) {
    logger.debug("CampaignsHelpers.refreshAccountJob: called", {
      campaignId,
      facebookAccountId,
      type
    });
    const campaign = Campaigns.findOne(campaignId);

    if (campaign.status == "suspended") {
      throw new Meteor.Error(401, "This campaign is suspended");
    }

    const account =
      _.findWhere(campaign.accounts, {
        facebookId: facebookAccountId
      }) || campaign.facebookAccount;

    let jobType, jobData;
    switch (type) {
      case "entries":
        jobType = "entries.updateAccountEntries";
        jobData = {
          facebookId: facebookAccountId,
          accessToken: account.accessToken,
          campaignId: campaign._id
        };
        break;
      case "refetch":
        jobType = "entries.refetchAccountEntries";
        jobData = {
          facebookId: facebookAccountId,
          accessToken: account.accessToken,
          campaignId: campaign._id
        };
        break;
      case "audiences":
        jobType = "audiences.updateAccountAudience";
        jobData = {
          campaignId: campaign._id,
          facebookAccountId: facebookAccountId
        };
        break;
      case "fbUsers":
        jobType = "people.updateFBUsers";
        jobData = {
          campaignId,
          facebookAccountId
        };
        break;
    }

    const query = {
      type: jobType
    };

    for (const prop in jobData) {
      if (prop !== "accessToken") {
        query[`data.${prop}`] = jobData[prop];
      }
    }

    const job = Jobs.findOne(query);

    if (job) {
      if (job.status == "failed" || job.status == "cancelled") {
        Jobs.getJob(job._id).restart();
      } else if (job.status == "waiting") {
        Jobs.getJob(job._id).ready({ time: Jobs.foreverDate });
      }
    } else {
      JobsHelpers.addJob({
        jobType,
        jobData
      });
    }
  },
  removeCampaign({ campaignId }) {
    const campaign = Campaigns.findOne(campaignId);

    if (!campaign) {
      throw new Meteor.Error(404, "Campaign not found");
    }

    // Expire and remove exports
    const exportJobs = Jobs.find({
      type: "people.expireExport",
      "data.campaignId": campaignId
    }).fetch();
    if (exportJobs && exportJobs.length) {
      for (let job of exportJobs) {
        PeopleHelpers.expireExport({ exportId: job.data.exportId });
      }
    }
    PeopleExports.remove({ campaignId });

    this.clearCampaignJobs({ campaignId });

    FAQ.remove({ campaignId });
    People.remove({ campaignId });
    PeopleLists.remove({ campaignId });
    PeopleTags.remove({ campaignId });
    Canvas.remove({ campaignId });
    FacebookAudiences.remove({ campaignId });
    MapFeatures.remove({ campaignId });

    // Facebook accounts to delete
    let accountsIds = _.pluck(campaign.accounts, "facebookId");
    if (campaign.facebookAccount) {
      accountsIds.push(campaign.facebookAccount.facebookId);
    }
    const accounts = FacebookAccounts.find({
      facebookId: {
        $in: accountsIds
      }
    }).fetch();
    for (const account of accounts) {
      const accountCampaignsCount = Campaigns.find({
        $or: [
          { accounts: { $elemMatch: { facebookId: account.facebookId } } },
          { "facebookAccount.facebookId": account.facebookId }
        ]
      }).count();
      if (accountCampaignsCount <= 1) {
        FacebookAccountsHelpers.removeAccount({
          facebookAccountId: account.facebookId,
          token: campaign.facebookAccount.accessToken
        });
      }
    }

    return Campaigns.remove(campaignId);
  },
  clearCampaignJobs({ campaignId }) {
    check(campaignId, String);
    Jobs.remove({ "data.campaignId": campaignId });
  },
  suspendCampaign({ campaignId }) {
    check(campaignId, String);
    Campaigns.update({ _id: campaignId }, { $set: { status: "suspended" } });
    this.clearCampaignJobs({ campaignId });
  },
  activateCampaign({ campaignId }) {
    check(campaignId, String);
    Campaigns.update({ _id: campaignId }, { $set: { status: "active" } });
    this.refreshCampaignJobs({ campaignId });
  },
  suspendAdAccount({ campaignId }) {
    check(campaignId, String);
    Campaigns.update(
      { _id: campaignId },
      { $set: { adAccountId: null, status: "invalid_adaccount" } }
    );
  }
};

exports.CampaignsHelpers = CampaignsHelpers;
