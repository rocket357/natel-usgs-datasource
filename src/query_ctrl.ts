import _ from 'lodash';
import { QueryCtrl } from 'grafana/app/plugins/sdk';
import './css/query-editor.css';

import USGSQuery from './query';

export class USGSDatasourceQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  query: USGSQuery;
  info: any;
  key = '';

  /** @ngInject */
  constructor(public $scope, public $rootScope, $injector, public uiSegmentSrv) {
    super($scope, $injector);

    let refresh = false;
    if (_.isNil(this.target.query)) {
      this.target.query = '&sites=01646500&service=iv';
      refresh = true;
    }
    this.query = new USGSQuery(this.target);
    this.validateArgsAndCheckInfo();
    if (refresh) {
      this.panelCtrl.refresh();
    }
  }

  doSitePopup() {
    const scope = this.$scope.$new(true);
    scope.target = this.target;
    scope.datasource = this.datasource;
    this.$rootScope.appEvent('show-modal', {
      templateHtml: '<find-usgs-site-modal target="target" datasource="datasource"></find-usgs-site-modal>',
      scope,
    });
  }

  toggleSeries(series) {
    let show = this.target.args.show;
    if (this.isSelected(series)) {
      _.unset(show, series.key);
    } else {
      if (!show) {
        this.target.args.show = show = {};
      }
      show[series.key] = '';
    }
    this.onChangeInternal();
  }

  isSelected(series) {
    return _.hasIn(this.target.args, 'show.' + series.key);
  }

  toggleEditorMode() {
    this.target.rawQuery = !this.target.rawQuery;
  }

  onChangeQuery() {
    this.target.args = this.query.parse(this.target.query);
    this.validateArgsAndCheckInfo(true);
  }

  onChangeInternal() {
    this.validateArgsAndCheckInfo(true);
  }

  validateArgsAndCheckInfo(doRefresh = false) {
    // Pick the params and Stats from the keys
    const args = this.target.args;

    // Just in case
    _.unset(args, 'parameterCd');
    _.unset(args, 'statCd');

    // Get the parameter and stats code from the
    if (args.show) {
      if (_.size(args.show) > 0) {
        _.forEach(args.show, (v, k) => {
          const ids = k.split('_');
          if (ids.length > 1) {
            const val = ids[1];
            if (args.parameterCd == null) {
              args.parameterCd = [val];
            } else if (!_.includes(args.parameterCd, val)) {
              args.parameterCd.push(val);
            }
          }
          if (ids.length > 2) {
            const val = ids[2];
            if (args.statCd == null) {
              args.statCd = [val];
            } else if (!_.includes(args.statCd, val)) {
              args.statCd.push(val);
            }
          }
        });
      } else {
        _.unset(args, 'show');
      }
    }

    const key = args.service + '@' + args.sites;
    if (this.key !== key) {
      this.key = key;
      const url = 'https://waterservices.usgs.gov/nwis/' + args.service + '/service/?format=rdb&sites=' + args.sites;
      return this.datasource.backendSrv
        .datasourceRequest({
          url: url,
          method: 'GET',
        })
        .then(result => {
          const lines = result.data.split('\n');
          this.info = this.datasource.readRDB(lines, false, null);

          // Make sure the values exist
          if (args.show) {
            const clean = {};
            _.forEach(args.show, (v, k) => {
              _.forEach(this.info.series, s => {
                if (k === s.key) {
                  clean[k] = v;
                  return false;
                }
                return true;
              });
            });

            if (_.size(clean) > 0) {
              args.show = clean;
            } else {
              _.unset(args, 'show');
            }
          }

          if (doRefresh) {
            this.target.query = this.query.argsToQueryString(args);
            this.panelCtrl.refresh();
          }
        });
    } else if (doRefresh) {
      this.target.query = this.query.argsToQueryString(args);
      this.panelCtrl.refresh(); // Asks the panel to refresh data.
    }
  }
}
