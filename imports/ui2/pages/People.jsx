import React, { Component } from "react";
import ReactTooltip from "react-tooltip";
import styled, { css } from "styled-components";
import moment from "moment";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Select from "react-select";
import { pick, debounce, defaultsDeep } from "lodash";

import { alertStore } from "../containers/Alerts.jsx";
import { modalStore } from "../containers/Modal.jsx";

import PeopleExport from "../components/PeopleExport.jsx";
import { PersonImportButton } from "../components/PersonImport.jsx";
import Button from "../components/Button.jsx";
import More from "../components/More.jsx";
import Page from "../components/Page.jsx";

import PageFilters from "../components/PageFilters.jsx";
import PagePaging from "../components/PagePaging.jsx";
import PeopleTable from "../components/PeopleTable.jsx";
import PeopleHistoryChart from "../components/PeopleHistoryChart.jsx";

import PeopleLists from "../components/PeopleLists.jsx";
import PeopleExports from "../components/PeopleExports.jsx";

import TagFilter from "../components/TagFilter.jsx";
import PersonMetaButtons from "../components/PersonMetaButtons.jsx";
import Reaction from "../components/Reaction.jsx";

const PeopleContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  .people-nav {
    flex: 0 0 auto;
  }
  .people-table {
    flex: 1 1 100%;
    overflow-x: hidden;
    overflow-y: auto;
    transition: opacity 0.1s linear;
  }
  .not-found {
    font-size: 1.5em;
    font-style: italic;
    color: #ccc;
    text-align: center;
    margin: 4rem;
  }
  ${props =>
    props.loading &&
    css`
      .people-table {
        opacity: 0.25;
      }
    `}
`;

const Message = styled.p`
  margin: 0;
  background: #24ff91;
  padding: 0.75rem 1rem;
  font-size: 0.8em;
`;

export default class PeoplePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      loadingCount: false,
      people: [],
      query: {
        q: "",
        form: false,
        commented: false,
        private_reply: false
      },
      options: {
        skip: 0,
        limit: 20
      }
    };
  }
  componentDidMount() {
    this.fetchPeople();
    this.setState({
      query: defaultsDeep(this.props.query, {
        q: "",
        form: false,
        commented: false,
        private_reply: false
      }),
      options: defaultsDeep(this.props.options, {
        limit: 20,
        skip: 0
      })
    });
    this.fetchHistory();
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    const { importCount } = this.props;
    const { query, options } = this.state;
    if (
      JSON.stringify(query) != JSON.stringify(prevState.query) ||
      JSON.stringify(options) != JSON.stringify(prevState.options)
    ) {
      this.setLoading();
      this.fetchPeople();
    }

    if (importCount == 0 && prevProps.importCount > 0) {
      this.setState({ imported: true });
    }
  }
  sanitizeQueryParams = (params, allowedParams = []) => {
    let sanitized = {};
    for (let key in params) {
      if (params[key]) {
        sanitized[key] = params[key];
      } else {
        sanitized[key] = null;
      }
    }
    if (allowedParams.length) {
      return pick(sanitized, allowedParams);
    }
    return sanitized;
  };
  buildOptions = options => {
    let queryOptions = {};
    if (options.limit) {
      queryOptions.limit = options.limit;
    }
    if (options.skip) {
      queryOptions.skip = options.skip * queryOptions.limit;
    }
    if (options.sort) {
      queryOptions.sort = options.sort;
      queryOptions.order = options.order == "desc" ? -1 : 1;
    }
    return queryOptions;
  };
  setLoading = debounce(
    () => {
      this.setState({
        loading: true,
        loadingCount: true
      });
    },
    200,
    {
      leading: true,
      trailing: false
    }
  );
  fetchPeople = debounce(() => {
    const { campaignId } = this.props;
    const { query, options } = this.state;
    FlowRouter.setQueryParams(this.sanitizeQueryParams(query));
    FlowRouter.setQueryParams(
      this.sanitizeQueryParams(options, ["sort", "order"])
    );
    if (campaignId) {
      const methodParams = {
        campaignId,
        query,
        options: this.buildOptions(options)
      };
      Meteor.call("people.search", methodParams, (err, data) => {
        if (err) {
          this.setState({
            loading: false
          });
        } else {
          this.setState({ people: data, loading: false });
        }
      });
      Meteor.call("people.search.count", methodParams, (err, data) => {
        if (err) {
          this.setState({
            loadingCount: false
          });
        } else {
          this.setState({ count: data, loadingCount: false });
        }
      });
    }
  }, 200);
  fetchHistory = () => {
    const { campaignId } = this.props;
    Meteor.call("people.history", { campaignId }, (err, res) => {
      if (err) {
        alertStore.add(err);
      } else {
        this.setState({
          peopleHistory: res
        });
      }
    });
  };
  _handlePrev = () => {
    const { options } = this.state;
    if (options.skip > 0) {
      this.setState({
        options: {
          ...options,
          skip: options.skip - 1
        }
      });
    }
  };
  _handleNext = () => {
    const { options, count } = this.state;
    if (options.skip * options.limit + options.limit < count) {
      this.setState({
        options: {
          ...options,
          skip: options.skip + 1
        }
      });
    }
  };
  _handlePeopleChange = people => {
    this.setState({ people });
  };
  _handleTableSort = (sort, order) => {
    let options = {};
    if (!order) {
      options = { order: "", sort: "" };
    } else {
      options = { order, sort };
    }
    this.setState({
      options: {
        ...this.state.options,
        ...options,
        skip: 0
      }
    });
  };
  _handleFormChange = ({ target }) => {
    this.setState({
      query: {
        ...this.state.query,
        [target.name]: target.value
      },
      options: {
        ...this.state.options,
        skip: 0
      }
    });
  };
  _handleSelectChange = (selected, { name }) => {
    let value = null;
    if (selected && selected.value) {
      value = selected.value;
    }
    this.setState({
      query: {
        ...this.state.query,
        [name]: value
      },
      options: {
        ...this.state.options,
        skip: 0
      }
    });
  };
  _handleCheckboxChange = ({ target }) => {
    this.setState({
      query: {
        ...this.state.query,
        [target.name]: target.checked
      },
      options: {
        ...this.state.options,
        skip: 0
      }
    });
  };
  _handleDateChange = ({ max, min }) => {
    this.setState({
      query: {
        ...this.state.query,
        creation_from: min ? moment(min).format("YYYY-MM-DD") : null,
        creation_to: max ? moment(max).format("YYYY-MM-DD") : null,
        source: min || max ? "facebook" : null
      },
      options: {
        ...this.state.options,
        skip: 0
      }
    });
  };
  _handleReactionFilterChange = value => {
    this.setState({
      query: {
        ...this.state.query,
        reaction_type: value
      }
    });
  };
  _getDateValue = key => {
    const { campaign } = this.props;
    const { query } = this.state;
    return query[key] ? moment(query[key]).toDate() : null;
  };
  categoriesOptions = () => {
    let options = [];
    for (let key in PersonMetaButtons.labels) {
      options.push({
        value: key,
        label: PersonMetaButtons.labels[key]
      });
    }
    return options;
  };
  getCategoryValue = () => {
    const { query } = this.state;
    if (query.category) {
      const label = PersonMetaButtons.labels[query.category];
      return { value: query.category, label };
    }
    return null;
  };
  getSourceOptions = () => {
    const { lists } = this.props;
    let options = [
      {
        value: "manual",
        label: "Manual"
      },
      {
        value: "facebook",
        label: "Facebook"
      }
    ];
    if (lists.length) {
      options.push({
        label: "Importação",
        options: [
          {
            value: "import",
            label: "Qualquer importação"
          },
          ...lists.map(list => {
            return {
              value: `list:${list._id}`,
              label: list.name
            };
          })
        ]
      });
    }
    return options;
  };
  getSourceValue = () => {
    const { lists } = this.props;
    const { query } = this.state;
    if (query.source) {
      let value = {
        value: query.source,
        label: ""
      };
      switch (true) {
        case /facebook/.test(query.source):
          value.label = "Facebook";
          break;
        case /import/.test(query.source):
          value.label = "Qualquer importação";
          break;
        case /manual/.test(query.source):
          value.label = "Manual";
          break;
        case /list:/.test(query.source):
          value.label = lists.find(
            l => l._id == query.source.split("list:")[1]
          ).name;
          break;
        default:
      }
      return value;
    }
    return null;
  };
  _handleManageImportsClick = ev => {
    const { lists } = this.props;
    ev.preventDefault();
    modalStore.setTitle("Gerenciar importações");
    modalStore.set(<PeopleLists lists={lists} />);
  };
  _handleManageExportsClick = ev => {
    const { peopleExports } = this.props;
    ev.preventDefault();
    modalStore.setTitle("Gerenciar exportações");
    modalStore.set(<PeopleExports peopleExports={peopleExports} />);
  };
  render() {
    const { campaign, importCount, exportCount, peopleExports } = this.props;
    const {
      loading,
      people,
      query,
      options,
      expanded,
      skip,
      count,
      loadingCount,
      peopleHistory,
      imported
    } = this.state;
    return (
      <>
        <Page.Nav full plain>
          <PageFilters>
            <div className="filters">
              <form onSubmit={ev => ev.preventDefault()}>
                <input
                  type="text"
                  placeholder="Buscar por nome"
                  onChange={this._handleFormChange}
                  name="q"
                  value={query.q}
                  className="main-input"
                />
                <Select
                  classNamePrefix="select"
                  options={this.categoriesOptions()}
                  isSearchable={false}
                  isClearable={true}
                  onChange={this._handleSelectChange}
                  name="category"
                  value={this.getCategoryValue()}
                  placeholder="Filtrar por categoria"
                />
                <Select
                  classNamePrefix="select"
                  options={this.getSourceOptions()}
                  isSearchable={false}
                  isClearable={true}
                  onChange={this._handleSelectChange}
                  name="source"
                  value={this.getSourceValue()}
                  placeholder="Filtrar por origem"
                />
                {this.props.tags && this.props.tags.length ? (
                  <TagFilter
                    tags={this.props.tags}
                    onChange={this._handleFormChange}
                    name="tag"
                    value={query.tag}
                    placeholder="Filtrar por tag"
                  />
                ) : null}
                <label>
                  <input
                    type="checkbox"
                    checked={query.form}
                    onChange={this._handleCheckboxChange}
                    name="form"
                  />
                  <span>
                    Formulário
                    <span className="tip">
                      Apenas pessoas que preencheram o formulário.
                    </span>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={query.commented}
                    onChange={this._handleCheckboxChange}
                    name="commented"
                  />
                  <span>
                    Comentários
                    <span className="tip">
                      Apenas pessoas que comentaram ao menos 1 vez.
                    </span>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={query.private_reply}
                    onChange={this._handleCheckboxChange}
                    name="private_reply"
                  />
                  <span>
                    Mensagens privadas
                    <span className="tip">
                      Apenas pessoas que podem receber mensagens privadas.
                    </span>
                  </span>
                </label>
                {peopleHistory && peopleHistory.total ? (
                  <label>
                    <PeopleHistoryChart
                      data={peopleHistory}
                      onChange={this._handleDateChange}
                      min={this._getDateValue("creation_from")}
                      max={this._getDateValue("creation_to")}
                    />
                  </label>
                ) : null}
                <div className="reaction-count-input">
                  <h4>Filtrar por quantidade de reações</h4>
                  <div className="input">
                    <span>ao menos</span>
                    <span>
                      <input
                        type="number"
                        placeholder="Quantidade"
                        name="reaction_count"
                        value={query.reaction_count}
                        onChange={this._handleFormChange}
                      />
                    </span>
                  </div>
                  <Reaction.Filter
                    showAny
                    size="tiny"
                    name="reaction_type"
                    value={query.reaction_type}
                    onChange={this._handleReactionFilterChange}
                  />
                </div>
              </form>
            </div>
            <div className="actions">
              <Button.Group vertical attached>
                <Button.WithIcon>
                  <PeopleExport
                    query={query}
                    options={this.buildOptions(options)}
                    running={exportCount}
                    peopleExports={peopleExports}
                  >
                    Exportar resultados
                  </PeopleExport>
                  <a
                    href="javascript:void(0);"
                    className="icon"
                    onClick={this._handleManageExportsClick}
                  >
                    <FontAwesomeIcon
                      icon="cog"
                      data-tip="Gerenciar exportações"
                      data-for="people-actions"
                    />
                  </a>
                </Button.WithIcon>
                <Button.WithIcon>
                  <PersonImportButton importCount={importCount} />
                  <a
                    href="javascript:void(0);"
                    className="icon"
                    onClick={this._handleManageImportsClick}
                  >
                    <FontAwesomeIcon
                      icon="cog"
                      data-tip="Gerenciar importações"
                      data-for="people-actions"
                    />
                  </a>
                </Button.WithIcon>
              </Button.Group>
            </div>
            <ReactTooltip id="people-actions" place="top" effect="solid" />
          </PageFilters>
        </Page.Nav>
        <PeopleContent loading={loading}>
          {imported ? (
            <Message>
              Uma importação foi concluída,{" "}
              <a
                href="javascript:void(0);"
                onClick={() => {
                  window.location.reload();
                }}
              >
                clique aqui
              </a>{" "}
              para atualizar a página
            </Message>
          ) : null}
          <PagePaging
            skip={options.skip}
            limit={options.limit}
            count={count}
            loading={loadingCount}
            onNext={this._handleNext}
            onPrev={this._handlePrev}
          />
          {!loading && (!people || !people.length) ? (
            <p className="not-found">Nenhum resultado encontrado.</p>
          ) : (
            <PeopleTable
              tags={this.props.tags}
              people={people}
              options={options}
              onChange={this._handlePeopleChange}
              onSort={this._handleTableSort}
              compact
              scrollable
            />
          )}
        </PeopleContent>
      </>
    );
  }
}
