/* Copyright (c) 2015-present terrestris GmbH & Co. KG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * @class Koala.view.panel.TimeSeries
 */
Ext.define('Koala.view.panel.TimeSeries', {
    extend: 'Ext.panel.Panel',
    xtype: 'k-panel-timeseries',
    cls: 'k-panel-timeseries',

    requires: [
        'Koala.util.ChartAxes',
        'Koala.util.ChartConstants',
        'Koala.util.ChartData',
        'Koala.util.Date',
        'Koala.util.Filter',
        'Koala.util.Help',
        'Koala.util.String',

        'Ext.form.field.Date'
    ],

    controller: 'k-panel-timeseries',

    viewModel: {
        type: 'k-panel-timeseries'
    },

    bind: {
        title: '{title}'
    },

    name: 'timeseriespanel',
    constrainHeader: true,
    collapsible: true,
    maxHeight: 800,
    height: 350,
    closable: false,
    width: 900,
    layout: {
        type: 'vbox'
    },
    tools: [{
        type: 'unpin',
        bind: {
            tooltip: '{unpinTooltip}',
            hidden: '{!pinned}'
        },
        callback: function() {
            var view = this.up('k-panel-timeseries');
            var viewModel = view.getViewModel();
            var container = view.up('[name=south-container]');
            Ext.create('Ext.window.Window', {
                height: 350,
                width: 900,
                layout: 'fit',
                items: view
            }).show();
            viewModel.set('pinned', false);
            container.remove(view);
            container.hide();
        }
    }, {
        type: 'pin',
        bind: {
            tooltip: '{pinTooltip}',
            hidden: '{pinned}'
        },
        callback: function() {
            var view = this.up('k-panel-timeseries');
            var window = view.up('window');
            var viewModel = view.getViewModel();
            var container = Ext.ComponentQuery.query('[name=south-container]')[0];
            container.add(view);
            container.show();
            viewModel.set('pinned', true);
            window.close();
        }
    }, {
        type: 'help',
        bind: {
            tooltip: '{helpTooltip}'
        },
        callback: function() {
            Koala.util.Help.showHelpWindow('mapTimeSeries', 'map');
        }
    }, {
        type: 'close',
        bind: {
            tooltip: '{closeTooltip}',
            hidden: '{!pinned}'
        },
        callback: function() {
            var view = this.up('k-panel-timeseries');
            view.close();
        }
    }],

    defaults: {
        flex: 1,
        width: '100%'
    },

    config: {
        addFilterForm: true
    },

    listeners: {
        show: 'onTimeseriesShow',
        close: 'onTimeseriesClose'
    },

    /**
     * The olLayer we were constructed with
     */
    initOlLayer: null,

    items: [],

    /**
     * Initializes the component.
     */
    initComponent: function() {
        var me = this;
        var FilterUtil = Koala.util.Filter;
        var metadata = me.initOlLayer.metadata;
        var timeRangeFilter = FilterUtil.getStartEndFilterFromMetadata(metadata);

        var filter = {
            defaultendtimeinstant: timeRangeFilter.maxdatetimeinstant,
            defaultstarttimeinstant: timeRangeFilter.mindatetimeinstant,
            unit: 'minutes',
            fromTimeseries: true
        };

        var timeRangeFilterFieldset = FilterUtil.createTimeRangeFieldset(
            'j F Y', filter, 1
        );

        Ext.each(timeRangeFilterFieldset.query('datefield'), function(field) {
            field.labelWidth = null;
        });

        var startContainer = timeRangeFilterFieldset.down('[name=mincontainer]');
        startContainer.padding = '0 5 0 0';
        timeRangeFilterFieldset.border = '0';
        timeRangeFilterFieldset.padding = '0 5 0 0';
        timeRangeFilterFieldset.setLayout('hbox');

        if (me.getAddFilterForm()) {
            me.items = [{
                xtype: 'form',
                layout: {
                    type: 'hbox',
                    pack: 'center'
                },
                padding: 5,
                height: 40,
                maxHeight: 40,
                minHeight: 40,
                items: [
                    timeRangeFilterFieldset,
                    {
                        xtype: 'button',
                        name: 'btn-set-filter',
                        bind: {
                            text: '{setFilterBtnText}'
                        },
                        handler: 'onSetFilterBtnClick',
                        margin: '0 3px 0 0'
                    }, {
                        xtype: 'button',
                        name: 'btn-reset-filter',
                        bind: {
                            text: '{resetFilterBtnText}'
                        },
                        handler: 'onResetFilterBtnClick',
                        margin: '0 3px 0 0'
                    }, {
                        xtype: 'combo',
                        displayField: 'text',
                        queryMode: 'local',
                        bind: {
                            emptyText: '{selectChartLayerComboEmptyText}',
                            fieldLabel: '{selectChartLayerComboLabel}'
                        },
                        listeners: {
                            select: 'onSelectChartLayerComboSelect',
                            beforerender: 'bindSelectChartLayerStore'
                        },
                        flex: 1
                    }]
            }];
        }
        me.callParent();
    }
});
