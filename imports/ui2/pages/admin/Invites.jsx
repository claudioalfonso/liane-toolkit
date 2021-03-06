import React, { Component } from "react";
import { injectIntl, intlShape, FormattedMessage } from "react-intl";
import styled from "styled-components";
import moment from "moment";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { modalStore } from "/imports/ui2/containers/Modal.jsx";

import CopyToClipboard from "/imports/ui2/components/CopyToClipboard.jsx";
import Table from "/imports/ui2/components/Table.jsx";
import Button from "/imports/ui2/components/Button.jsx";
import Page from "/imports/ui2/components/Page.jsx";
import PagePaging from "/imports/ui2/components/PagePaging.jsx";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
  .new-person {
    position: absolute;
    bottom: 1rem;
    right: 2rem;
    z-index: 9999;
    .button {
      background: #003399;
      border: 0;
      color: #fff;
      margin: 0;
      &:hover,
      &:active,
      &:focus {
        background: #333;
      }
    }
  }
  .invite-id {
    font-family: monospace;
    color: #666;
  }
  tr.used {
    opacity: 0.8;
    td {
      background: #f7f7f7;
    }
    .invite-id {
      text-decoration: line-through;
    }
  }
  .content-action {
    display: flex;
    text-align: left;
    .content {
      flex: 1 1 100%;
      font-size: 0.8em;
      display: flex;
      align-items: center;
    }
    .text {
      color: #999;
    }
    .actions {
      flex: 0 0 auto;
      font-size: 0.9em;
      a {
        color: #63c;
        &.remove {
          color: red;
          border-color: red;
        }
        &:hover {
          color: #fff;
        }
      }
    }
  }
  .fa-check,
  .fa-ban {
    float: left;
    margin-right: 1rem;
    font-size: 18px;
  }
  .fa-check {
    color: green;
  }
  .fa-ban {
    color: red;
  }
  a {
    .fa-copy {
      margin-right: 0.25rem;
    }
  }
  .designate-form {
    margin -0.5rem 0;
    input {
      font-size: 0.8rem;
      width: 240px;
      padding: 0.5rem;
      margin: 0;
      &.filled {
        border-color: #f7f7f7;
      }
      &:hover,
      &:active,
      &:focus {
        border-color: #ddd;
      }
    }
  }
`;

const TableContainer = styled.div`
  flex: 1 1 100%;
  overflow-x: hidden;
  overflow-y: auto;
  transition: opacity 0.1s linear;
  table {
    margin-bottom: 4rem;
  }
`;

class InvitesPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loadingCount: false,
      count: 0,
      designations: {}
    };
  }
  componentDidUpdate(prevProps) {}
  componentDidMount() {
    this.setState({ loadingCount: true });
    Meteor.call("invites.queryCount", { query: {} }, (err, res) => {
      this.setState({ loadingCount: false, count: res });
    });
  }
  createInvite = () => {
    Meteor.call("invites.new");
  };
  _handleNext = () => {
    const { page, limit } = this.props;
    const { count } = this.state;
    if ((page - 1) * limit + limit < count) {
      FlowRouter.setQueryParams({ page: page + 1 });
    }
  };
  _handlePrev = () => {
    const { page } = this.props;
    if (page > 1) {
      FlowRouter.setQueryParams({ page: page - 1 });
    }
  };
  _getLink = inviteKey => {
    return Meteor.absoluteUrl() + "?invite=" + inviteKey;
  };
  _handleDesignateForm = inviteId => ev => {
    ev.preventDefault();
    const designated = this.state.designations[inviteId];
    if (typeof designated == "string") {
      Meteor.call("invites.designate", { inviteId, designated });
    }
  };
  _handleDesignateChange = inviteId => ({ target }) => {
    this.setState({
      designations: {
        ...this.state.designations,
        [inviteId]: target.value
      }
    });
  };
  _handleDesignateClick = inviteId => ev => {
    ev.preventDefault();
    Meteor.call("invites.designate", { inviteId });
  };
  _handleCopyClick = inviteKey => ev => {
    ev.preventDefault();
  };
  _handleRemoveClick = inviteId => ev => {
    ev.preventDefault();
    Meteor.call("invites.remove", { inviteId });
  };
  _handleNewClick = ev => {
    ev.preventDefault();
    this.createInvite();
  };
  render() {
    const { intl, invites, page, limit } = this.props;
    const { designations, loadingCount, count } = this.state;
    return (
      <Container>
        <PagePaging
          skip={page - 1}
          limit={limit}
          count={count}
          loading={loadingCount}
          onNext={this._handleNext}
          onPrev={this._handlePrev}
        />
        <TableContainer>
          <Table compact>
            <thead>
              <tr>
                <th>
                  <FormattedMessage
                    id="app.admin.invites.invite_id"
                    defaultMessage="Invite ID"
                  />
                </th>
                <th>
                  <FormattedMessage
                    id="app.admin.invites.designated"
                    defaultMessage="Designated"
                  />
                </th>
                <th className="fill">
                  <FormattedMessage
                    id="app.admin.invites.available"
                    defaultMessage="Available"
                  />
                </th>
                <th>
                  <FormattedMessage
                    id="app.admin.invites.created"
                    defaultMessage="Created"
                  />
                </th>
              </tr>
            </thead>
            {invites.map(invite => (
              <tbody key={invite._id}>
                <tr className={invite.used ? "used" : ""}>
                  <td className="small invite-id">{invite.key}</td>
                  <td>
                    <span className="content-action">
                      <span className="content">
                        <FontAwesomeIcon
                          icon={invite.designated ? "check" : "ban"}
                        />
                      </span>
                      <span className="actions">
                        <form
                          className="designate-form"
                          onSubmit={this._handleDesignateForm(invite._id)}
                        >
                          <input
                            className={invite.designated ? "filled" : ""}
                            type="text"
                            onChange={this._handleDesignateChange(invite._id)}
                            placeholder="Type a name or email and press enter"
                            value={
                              typeof designations[invite._id] == "string"
                                ? designations[invite._id]
                                : invite.designated
                            }
                          />
                        </form>
                      </span>
                      {/* {invite.designated ? (
                        <span className="content">
                          <FontAwesomeIcon icon="check" />
                        </span>
                      ) : (
                        <>
                          <span className="content">
                            <FontAwesomeIcon icon="ban" />
                          </span>
                          <span className="actions">
                            <Button
                              className="small"
                              onClick={this._handleDesignateClick(invite._id)}
                            >
                              <FormattedMessage
                                id="app.admin.invites.mark_designated"
                                defaultMessage="Mark as designated"
                              />
                            </Button>
                          </span>
                        </>
                      )} */}
                    </span>
                  </td>
                  <td className="fill">
                    <span className="content-action">
                      <span className="content">
                        <span className="icon">
                          {invite.used ? (
                            <FontAwesomeIcon icon="ban" />
                          ) : (
                            <FontAwesomeIcon icon="check" />
                          )}
                        </span>
                        {invite.user ? (
                          <span className="text">
                            <FormattedMessage
                              id="app.admin.invites.used_by"
                              defaultMessage="Used by {name}"
                              values={{ name: invite.user.name }}
                            />
                          </span>
                        ) : null}
                      </span>
                      <span className="actions">
                        {!invite.used ? (
                          <CopyToClipboard text={this._getLink(invite.key)}>
                            <Button
                              className="small"
                              onClick={this._handleCopyClick(invite._id)}
                            >
                              <FontAwesomeIcon icon="copy" />
                              <FormattedMessage
                                id="app.admin.invites.copy"
                                defaultMessage="Copy link"
                              />
                            </Button>
                          </CopyToClipboard>
                        ) : null}
                        <Button
                          className="small remove"
                          onClick={this._handleRemoveClick(invite._id)}
                        >
                          <FormattedMessage
                            id="app.admin.invites.remove"
                            defaultMessage="Remove"
                          />
                        </Button>
                      </span>
                    </span>
                  </td>
                  <td className="small">
                    {moment(invite.createdAt).format("LLL")}
                  </td>
                </tr>
              </tbody>
            ))}
          </Table>
        </TableContainer>
        <div className="new-person">
          <Button onClick={this._handleNewClick}>
            +{" "}
            <FormattedMessage
              id="app.admin.invites.new"
              defaultMessage="New invite"
            />
          </Button>
        </div>
      </Container>
    );
  }
}

InvitesPage.propTypes = {
  intl: intlShape.isRequired
};

export default injectIntl(InvitesPage);
