import { Campaigns, Invites } from "/imports/api/campaigns/campaigns.js";
import { FacebookAccounts } from "/imports/api/facebook/accounts/accounts.js";
import {
  PeopleTags,
  PeopleLists
} from "/imports/api/facebook/people/people.js";
import { Contexts } from "/imports/api/contexts/contexts.js";
import { Geolocations } from "/imports/api/geolocations/geolocations.js";
import { Jobs } from "/imports/api/jobs/jobs.js";

import _ from "underscore";

Meteor.publishComposite("campaigns.all", function({ query, options }) {
  this.unblock();
  const currentUser = this.userId;
  if (currentUser && Roles.userIsInRole(currentUser, ["admin"])) {
    return {
      find: function() {
        return Campaigns.find(
          query || {},
          options || {
            sort: { createdAt: -1 }
          }
        );
      },
      children: [
        {
          find: function(campaign) {
            return Jobs.find({
              "data.campaignId": campaign._id,
              type: {
                $in: [
                  "campaigns.healthCheck",
                  "entries.updateAccountEntries",
                  "entries.refetchAccountEntries",
                  "people.updateFBUsers"
                ]
              }
            });
          }
        },
        {
          find: function(campaign) {
            return Meteor.users.find(
              {
                _id: { $in: _.pluck(campaign.users, "userId") }
              },
              {
                fields: {
                  name: 1,
                  "emails.address": 1
                }
              }
            );
          }
        },
        {
          find: function(campaign) {
            return FacebookAccounts.find({
              facebookId: campaign.facebookAccount.facebookId
            });
          }
        }
      ]
    };
  } else {
    return this.ready();
  }
});

Meteor.publish("campaigns.byUser", function() {
  this.unblock();
  const currentUser = this.userId;
  if (currentUser) {
    return Campaigns.find(
      {
        users: { $elemMatch: { userId: currentUser, status: "active" } }
      },
      {
        fields: {
          _id: 1,
          name: 1,
          users: 1
        }
      }
    );
  } else {
    return this.ready();
  }
});

Meteor.publishComposite("campaigns.publicDetail", function({
  campaignId,
  slug
}) {
  this.unblock();
  if (!campaignId && !slug) {
    return this.ready();
  }
  let selector = {};
  if (campaignId) {
    selector = { _id: campaignId };
  } else if (slug) {
    selector = { "forms.slug": slug };
  }
  logger.debug("campaigns.publicDetail pub", { selector: campaignId || slug });
  return {
    find: function() {
      return Campaigns.find(selector, {
        fields: {
          name: 1,
          party: 1,
          candidate: 1,
          office: 1,
          country: 1,
          "forms.slug": 1,
          "forms.crm": 1
        }
      });
    }
  };
});

Meteor.publishComposite("campaigns.detail", function({ campaignId }) {
  this.unblock();
  const userId = this.userId;
  logger.debug("campaigns.detail pub", { campaignId });
  let fields = {
    "facebookAccount.facebookId": 1,
    name: 1,
    candidate: 1,
    party: 1,
    office: 1,
    country: 1,
    creatorId: 1,
    geolocationId: 1,
    status: 1,
    forms: 1,
    createdAt: 1
  };
  let children = [
    {
      find: function(campaign) {
        let ids = _.pluck(campaign.accounts || [], "facebookId");
        if (campaign.facebookAccount)
          ids.push(campaign.facebookAccount.facebookId);
        return FacebookAccounts.find({
          facebookId: { $in: ids }
        });
      }
    },
    {
      find: function(campaign) {
        return Geolocations.find({ _id: campaign.geolocationId });
      }
    }
  ];
  const campaign = Campaigns.findOne(campaignId);

  // Creator extra data
  if (campaign.creatorId == userId) {
    fields.users = 1;
    children.push({
      find: function(campaign) {
        return Meteor.users.find(
          {
            _id: { $in: _.pluck(campaign.users, "userId") }
          },
          {
            fields: {
              name: 1,
              "emails.address": 1
            }
          }
        );
      }
    });
  } else {
    fields["users.userId"] = 1;
  }

  // People view permission extra data
  if (
    Meteor.call("campaigns.userCan", {
      campaignId,
      userId,
      feature: "people",
      permission: "view"
    })
  ) {
    children.push({
      find: function(campaign) {
        return PeopleTags.find({
          campaignId: campaign._id
        });
      }
    });
    children.push({
      find: function(campaign) {
        return PeopleLists.find({
          campaignId: campaign._id
        });
      }
    });
  }

  if (userId) {
    return {
      find: function() {
        return Campaigns.find(
          {
            _id: campaignId,
            users: { $elemMatch: { userId } }
          },
          { fields }
        );
      },
      children
    };
  } else {
    return this.ready();
  }
});

Meteor.publishComposite("invites.all", function({ query, options }) {
  this.unblock();
  const currentUser = this.userId;
  if (currentUser && Roles.userIsInRole(currentUser, ["admin"])) {
    return {
      find: function() {
        return Invites.find(
          query || {},
          options || { sort: { createdAt: -1 } }
        );
      },
      children(invite) {
        let children = [];
        if (invite.usedBy) {
          children.push({
            find: function() {
              return Meteor.users.find({ _id: invite.usedBy });
            }
          });
        }
        return children;
      }
    };
    return Invites.find({});
  } else {
    return this.ready();
  }
});

// Meteor.publishComposite("campaigns.jobsCount", function() {
//   const currentUser = this.userId;
//   logger.debug("campaigns.jobsCount pub");
//   if (Roles.userIsInRole(currentUser, ["admin"])) {
//     return {
//       find: function() {
//         return Campaigns.find(null, { fields: { name: 1 } });
//       },
//       children: [
//         {
//           find: function(campaign) {
//             return Counts.publish(
//               this,
//               "jobCountFor",
//               FacebookAudiences.find(search)
//             );
//           }
//         }
//       ]
//     };
//   } else {
//     this.ready();
//   }
// });
