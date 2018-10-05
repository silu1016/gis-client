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
 * @class Koala.view.component.D3BarChartController
 */
Ext.define('Koala.view.component.D3BarChartController', {
    extend: 'Koala.view.component.D3BaseController',
    alias: 'controller.component-d3barchart',

    requires: [
        'Koala.util.Ogc',
        'Koala.util.String'
    ],

    /**
     *
     */
    scales: {},
    shapes: [],
    axes: {},
    gridAxes: {},
    tooltipCmp: null,
    initialPlotTransform: null,
    data: {},
    rawData: null,
    chartRendered: false,
    ajaxCounter: 0,
    chartConfig: null,
    featureProps: null,
    showUncertainty: true,
    colorsByKey: {},
    disabledSubCategories: [],
    gridFeatures: null,
    labels: [],

    /**
     * The default chart margin to apply.
     *
     * @type {Object}
     */
    defaultChartMargin: {
        top: 50,
        right: 200,
        bottom: 50,
        left: 50
    },

    /**
     * Called on painted event. Only used in modern toolkit.
     *
     * @private
     */
    onPainted: function() {
        var me = this;
        me.onBoxReady();
    },

    // OBSOLETE
    drawSvgContainer: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BaseController;
        var makeTranslate = staticMe.makeTranslate;
        var view = me.getView();
        var viewId = '#' + view.getId();

        var chartMargin = view.getChartMargin() || me.defaultChartMargin;
        var marginLeft = parseInt(chartMargin.left, 10);
        var translate = makeTranslate(chartMargin.left, chartMargin.top);
        var chartSize = me.getChartSize();
        var scrollbarHeight = Ext.getScrollbarSize().height;

        // Get the container view by its ID and append the SVG including an
        // additional group element to it.
        var container = d3.select(viewId);
        if (this.type === 'component-d3barchart') {
            container = container
                .append('div')
                .attr('style', 'overflow-x: auto; width: ' + chartSize[0] + 'px');
        }
        container
            .append('svg')
            .attr('viewBox', '0 0 ' + (chartSize[2] + marginLeft) + ' ' + (chartSize[1] - scrollbarHeight))
            .attr('width', (chartSize[2] + marginLeft))
            .attr('height', chartSize[1] - scrollbarHeight)
            .append('g')
            .attr('transform', translate);

        var containerSvg = d3.select(viewId + ' svg');
        me.containerSvg = containerSvg;
    },

    // OBSOLETE
    updateSvgContainerSize: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BaseController;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var chartSize = me.getChartSize();
        var makeTranslate = staticMe.makeTranslate;
        var chartMargin = view.getChartMargin() || me.defaultChartMargin;
        var marginLeft = parseInt(chartMargin.left, 10);
        var translate = makeTranslate(chartMargin.left, chartMargin.top);
        var scrollbarHeight = Ext.getScrollbarSize().height;

        var svgContainer = d3.select(viewId + ' svg');
        var svgGroup = d3.select(viewId + ' svg g');
        var svgRect = d3.select(viewId + ' svg rect');
        var viewSize = me.getViewSize();
        var legWidth = me.calculateLegendWidth();
        var barChartParent;
        var svgContainerWidth = (chartSize[2] < chartSize[0]) ? chartSize[0] : chartSize[2];

        svgContainer
            .attr('viewBox', '0 0 ' + viewSize[0] + ' ' + viewSize[1])
            .attr('width', viewSize[0])
            .attr('height', viewSize[1]);

        svgRect
            .attr('width', chartSize[0])
            .attr('height', chartSize[1]);

        if (this.type === 'component-d3barchart') {
            barChartParent = svgContainer.select(function() {
                return this.parentNode;
            });
            barChartParent
                .style('width', (viewSize[0] - legWidth) + 'px');

            svgRect
                .attr('height', chartSize[1] - scrollbarHeight)
                .attr('width', chartSize[2] + marginLeft);
            svgContainer
                .attr('height', viewSize[1] - scrollbarHeight)
                .attr('viewBox', '0 0 ' + (marginLeft + chartSize[2]) + ' ' + (viewSize[1] - scrollbarHeight))
                .attr('width', (svgContainerWidth + marginLeft));
        }

        svgGroup
            .attr('transform', translate);


        // Re-register the zoom interaction if requested as the charts sizes
        // may have changed.
        if (view.getZoomEnabled()) {
            me.createInteractions();
            d3.select(viewId + ' svg > g > g.k-d3-shape-container')
                .call(me.zoomInteraction);
        }
    },

    /**
     * Returns the request params for a given station.
     *
     * @param {ol.Feature} station The station to build the request for.
     * @return {Object} The request object.
     */
    getChartDataRequestParams: function(station) {
        var Ogc = Koala.util.Ogc;
        var me = this;
        var view = me.getView();
        var targetLayer = view.getTargetLayer();
        var chartConfig = targetLayer.get('barChartProperties');
        var filters = targetLayer.metadata.filters;
        var timeField;

        // Get the viewparams configured for the layer
        var layerViewParams = Koala.util.Object.getPathStrOr(
            targetLayer, 'metadata/layerConfig/olProperties/param_viewparams', '');

        // Get the request params configured for the chart
        var paramConfig = Koala.util.Object.getConfigByPrefix(
            chartConfig, 'param_', true);

        // Merge the layer viewparams to the chart params
        if (paramConfig.viewparams) {
            paramConfig.viewparams += ';' + layerViewParams;
        } else {
            paramConfig.viewparams = layerViewParams;
        }

        // Replace all template strings
        Ext.iterate(paramConfig, function(k, v) {
            paramConfig[k] = Koala.util.String.replaceTemplateStrings(
                v, station);
        });

        var requestFilter;

        Ext.each(filters, function(filter) {
            if (filter.type === 'pointintime') {
                var dateString;
                dateString = filter.effectivedatetime.toISOString();
                timeField = filter.param;
                requestFilter = Ogc.getPointInTimeFilter(dateString, timeField);
                return false;
            } else if (filter.type === 'timerange') {
                var startString = filter.effectivemindatetime.toISOString();
                var endString = filter.effectivemaxdatetime.toISOString();
                timeField = filter.param;
                requestFilter = Ogc.getDateTimeRangeFilter(
                    startString, endString, timeField);
                return false;
            }
        });

        var requestParams = {
            service: 'WFS',
            version: '1.1.0',
            request: 'GetFeature',
            typeName: chartConfig.dataFeatureType,
            outputFormat: 'application/json',
            filter: requestFilter,
            sortBy: timeField
        };

        Ext.apply(requestParams, paramConfig);

        return requestParams;
    },

    onChartDataRequestSuccess: function(chartDataResponse) {
        var me = this;
        var view = me.getView();
        me.rawData = chartDataResponse.responseText;

        if (!view) {
            me.onDataComplete(chartDataResponse);
            return;
        }
        var barChartProperties = view.getTargetLayer().get('barChartProperties');
        if (!barChartProperties.colorMapping || Ext.isEmpty(
            barChartProperties.colorMapping)) {
            me.onDataComplete(chartDataResponse);
            return;
        }
        var promise;
        if (Ext.String.startsWith(barChartProperties.colorMapping, 'url:')) {
            promise = Koala.util.String.replaceTemplateStringsWithPromise(
                barChartProperties.colorMapping
            );
        } else {
            promise = new Ext.Promise(function(resolve) {
                resolve(barChartProperties.colorMapping);
            });
        }

        promise.then(function(colorMap) {
            if (Ext.isString(colorMap)) {
                try {
                    colorMap = Ext.decode(colorMap);
                } catch (err) {
                    Ext.log.error('Could not parse the color data response: ', err);
                }
            }
            me.onDataComplete(chartDataResponse, colorMap);
        });
    },

    /**
     * Function to be called on request success.
     *
     * @param {Object} reponse The response object.
     */
    onDataComplete: function(chartDataResponse, colorMap) {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var view = me.getView();
        if (!view) {
            return;
        }
        var labelFunc = view.getLabelFunc() || me.getFallBackIdentity();
        var barChartProperties = view.getTargetLayer().get('barChartProperties');
        var groupProp = barChartProperties.groupAttribute || 'end_measure';
        var labelProp = barChartProperties.groupLabelAttribute || groupProp;
        var keyProp = barChartProperties.xAxisAttribute;
        // looks strange to toggle if !toggled, but that's actually the desired
        // behaviour
        if (!this.groupPropToggled) {
            var h = groupProp;
            groupProp = keyProp;
            keyProp = h;
        }
        var valueProp = barChartProperties.yAxisAttribute;
        var detectionLimitProp = barChartProperties.detectionLimitAttribute
                || 'nachweisgrenze';

        var uncertaintyProp = barChartProperties.uncertaintyAttribute
                || 'uncertainty';
        var colors = [];
        if (view.getShape().color) {
            colors = view.getShape().color.split(',');
        }
        var jsonObj;

        var seriesData = [];

        if (chartDataResponse && chartDataResponse.responseText) {
            try {
                jsonObj = Ext.decode(chartDataResponse.responseText);
            } catch (err) {
                Ext.log.error('Could not parse the chart data response: ', err);
                return false;
            }
        }

        //used for grid table in CartoWindowController
        me.gridFeatures = jsonObj.features;

        me.colorsByKey = {};
        me.labels = [];
        me.legendLabels = [];
        me.customColors = [];
        me.disabledSubCategories = [];

        var ids = [];

        Ext.each(jsonObj.features, function(feature) {
            var id = feature.properties.id;
            if (ids.indexOf(id) === -1) {
                ids.push(id);
                if (labelProp) {
                    me.labels.push(feature.properties[labelProp]);
                }
            }
        });

        Ext.each(jsonObj.features, function(feature) {
            var dataObj = {};
            var groupKey = feature.properties[groupProp];

            var createSeries = true;
            dataObj.key = feature.properties[keyProp];

            if (!me.colorsByKey[groupKey]) {
                me.colorsByKey[groupKey] =
                  me.customColors[groupKey] ||
                  (colorMap && colorMap[groupKey] ? colorMap[groupKey].color : null) ||
                  colors[0] ||
                  staticMe.getRandomColor();
                Ext.Array.removeAt(colors, 0);
            }

            var pushObj = dataObj;
            Ext.each(seriesData, function(tuple) {
                if (tuple.key === feature.properties[keyProp]) {
                    pushObj = tuple;
                    createSeries = false;
                    return false;
                }
            });

            if (!Ext.isObject(pushObj[groupKey])) {
                pushObj[groupKey] = {};
            }

            if (colorMap && colorMap[groupKey]) {
                pushObj[groupKey].color = colorMap[groupKey].color;
            } else {
                pushObj[groupKey].color = me.customColors[groupKey] || me.colorsByKey[groupKey];
            }
            pushObj[groupKey].value = feature.properties[valueProp];
            pushObj[groupKey].key = feature.properties[groupProp];
            pushObj[groupKey].detection_limit = feature.properties[detectionLimitProp];
            pushObj[groupKey].uncertainty = feature.properties[uncertaintyProp];
            pushObj[groupKey].group = feature.properties[keyProp];
            pushObj[groupKey].label = labelFunc(pushObj[groupKey].value, pushObj[groupKey], groupProp, keyProp);

            if (createSeries) {
                seriesData.push(pushObj);
            }
        });

        me.data = seriesData;
        me.chartDataAvailable = true;

        me.ajaxCounter++;
        if (me.ajaxCounter === view.getSelectedStations().length) {
            if (view.getShowLoadMask() && view.setLoading) {
                view.setLoading(false);
            }
            var config = me.getView().getConfig();
            var chartSize = me.getViewSize();
            this.chartConfig = Koala.util.ChartData.getChartConfiguration(
                config,
                chartSize,
                'bar',
                this.data,
                this.labels,
                this.getView().getSelectedStations()
            );
            me.fireEvent('chartdataprepared');
        }
    },

    /**
     *
     */
    drawChart: function() {
        if (!this.chartConfig) {
            return;
        }
        var me = this;

        me.currentDateRange = {
            min: null,
            max: null
        };

        var barComponent = new D3Util.BarComponent(this.chartConfig.barComponentConfig);
        this.chartConfig.chartRendererConfig.components = [
            barComponent,
            this.getLegendComponent(barComponent)
        ];
        this.chartRenderer = new D3Util.ChartRenderer(this.chartConfig.chartRendererConfig);
        var svg = d3.select('#' + this.getView().getId()).node();
        this.chartRenderer.render(svg);
    },

    /**
     * Constructs a new legend component based on current config, or undefined,
     * if we have no legend config.
     * @param  {D3Util.BarComponent} series the corresponding bar chart
     * component
     * @return {D3Util.LegendComponent} the new legend component, or undefined
     */
    getLegendComponent: function(barComponent) {
        if (!this.chartConfig.legendComponentConfig) {
            return;
        }
        var me = this;
        var Const = Koala.util.ChartConstants;
        var CSS = Const.CSS_CLASS;
        Ext.each(this.chartConfig.legendComponentConfig.items, function(legend) {
            legend.onClick = function(event) {
                var list = event.target.classList;
                if (list.contains(CSS.COLOR_ICON) ||
                    list.contains(CSS.DELETE_ICON)) {
                    return;
                }
                if (legend.groupIndex) {
                    barComponent.toggleGroup(legend.groupIndex);
                }
                if (legend.groupedIndex) {
                    barComponent.toggleGrouped(legend.groupedIndex);
                }
            };
            legend.customRenderer = function(node) {
                if (!Ext.isModern && legend.type === 'background') {
                    node.append('text')
                        // fa-paint-brush from FontAwesome, see http://fontawesome.io/cheatsheet/
                        .text('\uf1fc')
                        .attr('class', CSS.COLOR_ICON)
                        .attr('text-anchor', 'start')
                        .attr('dy', '1')
                        .attr('dx', '150') // TODO Discuss, do we need this dynamically?
                        .on('click', me.generateColorCallback(legend.seriesIndex));
                }
                node.append('text')
                    // ✖ from FontAwesome, see http://fontawesome.io/cheatsheet/
                    .text('')
                    .attr('class', CSS.DELETE_ICON)
                    .attr('text-anchor', 'start')
                    .attr('dy', '1')
                    .attr('dx', '170') // TODO Discuss, do we need this dynamically?
                    .on('click', function() {
                        me.handleDelete(legend);
                    });
            };
        });
        return new D3Util.LegendComponent(this.chartConfig.legendComponentConfig);
    },

    handleDelete: function(legend) {
        var me = this;
        if (legend.groupIndex) {
            me.chartConfig.barComponentConfig.data.data =
                me.chartConfig.barComponentConfig.data.data
                    .filter(function(group) {
                        return group.value !== legend.groupIndex;
                    });
            me.chartConfig.legendComponentConfig.items =
                me.chartConfig.legendComponentConfig.items
                    .filter(function(item) {
                        return item.groupIndex !== legend.groupIndex;
                    });
        }
        if (legend.groupedIndex) {
            me.chartConfig.barComponentConfig.data.grouped =
                me.chartConfig.barComponentConfig.data.grouped
                    .filter(function(value) {
                        return value !== legend.groupedIndex;
                    });
            Ext.each(me.chartConfig.barComponentConfig.data.data
                ,function(group) {
                    group.values = group.values.filter(function(value) {
                        return value.index !== legend.groupedIndex;
                    });
                });
            me.chartConfig.barComponentConfig.data.data =
                me.chartConfig.barComponentConfig.data.data
                    .filter(function(group) {
                        return group.value !== legend.groupIndex;
                    });
            me.chartConfig.legendComponentConfig.items =
                me.chartConfig.legendComponentConfig.items
                    .filter(function(item) {
                        return item.groupedIndex !== legend.groupedIndex;
                    });
        }
        me.drawChart();
    },

    /**
     * Sets the domain for each scale in the chart by the use of the extent
     * of the given input data values.
     */
    // OBSOLETE
    setDomainForScales: function() {
        var me = this;
        var Const = Koala.util.ChartConstants;
        var view = me.getView();

        // Iterate over all scales/axis orientations and all shapes to find the
        // corresponding data index for each scale. Set the extent (max/min range
        // in this data index) for each scale.
        Ext.iterate(me.scales, function(orient) {
            var axis = view.getAxes()[orient];
            var axisDomain;
            var makeDomainNice = true;
            var min;
            var max;
            var firstStationData = Ext.Object.getValues(me.data);

            if (axis && axis.scale === 'ordinal') {
                axisDomain = firstStationData.map(function(d) {
                    return d.key;
                });
                me.scales[orient].domain(axisDomain);
            } else if (axis) {
                var vals = [];
                Ext.each(firstStationData, function(a) {
                    if (a.hidden) {
                        return;
                    }
                    Ext.iterate(a, function(k, v) {
                        if (k !== 'key' && !Ext.Array.contains(me.disabledSubCategories, k)) {
                            var val = v.value;
                            if (me.showUncertainty && v.uncertainty) {
                                val += v.uncertainty;
                            }
                            vals.push(val);
                        }
                    });
                });
                var dataRange = d3.extent(vals);

                if (Ext.isDefined(axis.min)) {
                    min = Koala.util.String.coerce(axis.min);
                    makeDomainNice = false; // if one was given, don't auto-enhance
                } else {
                    min = 0;
                }
                if (Ext.isDefined(axis.max)) {
                    max = Koala.util.String.coerce(axis.max);
                    makeDomainNice = false; // if one was given, don't auto-enhance
                } else {
                    var additionalSpace = dataRange[1]/100*Const.ADDITIONAL_DOMAIN_SPACE;
                    max = dataRange[1] + additionalSpace;
                }

                if (Ext.isDefined(min) && Ext.isDefined(max)) {
                    // We're basically done for this axis, both min and max were
                    // given. We need to iterate over the data nonetheless, so as to
                    // extend the minimim and maximum in case of outliers.
                    axisDomain = [min, max];
                } else {
                    axisDomain = [dataRange[0], dataRange[1]];
                }

                // We have to check if min and max make sense in relation to
                // the scale; 0 doesn't make sense if scale is logarithmic.
                if (axis.scale === 'log' &&
                        (axisDomain[0] === 0 || axisDomain[1] === 0)) {
                    Ext.log.warn('Correcting min/max value for y-axis as ' +
                        'logarithmic scales don\'t work with 0');
                    if (axisDomain[0] === 0) {
                        axisDomain[0] = 0.00000001;
                    }
                    if (axisDomain[1] === 0) {
                        axisDomain[1] = 0.00000001;
                    }
                }

                // Actually set the domain
                var domain = me.scales[orient].domain(axisDomain);
                if (makeDomainNice) {
                    domain.nice();
                }
            }
        });
    },

    /**
     * Redraws the shapeGroup containg all shapes (bars in this case).
     */
    // OBSOLETE
    redrawShapes: function() {
        var me = this;
        var Const = Koala.util.ChartConstants;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var shapeGroup = d3.select(viewId + ' .' + Const.CSS_CLASS.SHAPE_GROUP);

        if (shapeGroup.node()) {
            shapeGroup.node().remove();
        }

        me.drawShapes();
    },

    /**
     *
     */
    // OBSOLETE
    drawShapes: function() {
        var me = this;
        var Const = Koala.util.ChartConstants;
        var view = me.getView();
        var selectedStation = view.getSelectedStations()[0];
        var viewId = '#' + view.getId();
        var chartSize = me.getChartSize();
        var labelFunc = view.getLabelFunc() || me.getFallBackIdentity();
        var barChartProperties = view.getTargetLayer().get('barChartProperties');
        var groupProp = barChartProperties.groupAttribute || 'end_measure';
        var keyProp = barChartProperties.xAxisAttribute;
        if (this.groupPropToggled) {
            var h = groupProp;
            groupProp = keyProp;
            keyProp = h;
        }
        var shapeConfig = view.getShape();
        var xField = 'key';
        var yField = 'value';
        var orientX = 'bottom';
        var orientXGroup = 'bottom_group';
        var orientY = 'left';
        var firstStationData = Ext.Object.getValues(me.data);

        var allShapes = d3.select(viewId + ' svg > g')
            .append('g')
            .attr('class', Const.CSS_CLASS.SHAPE_GROUP);
        this.appendBackground(allShapes);

        var groupedShapes = allShapes.selectAll(Const.CSS_CLASS.BAR_GROUP)
            .data(firstStationData);

        me.scales.bottom = me.scales.bottom.paddingInner(0.1);

        var shapes = groupedShapes.enter().append('g')
            .filter(function(d) {
                return !d.hidden;
            })
            .attr('transform', function(d) {
                return 'translate(' + me.scales[orientX](d[xField]) + ',0)';
            })
            .attr('class', Const.CSS_CLASS.BAR_GROUP)
            .attr('id', function(d) {
                return d[xField];
            });

        var x1 = d3.scaleBand().padding(0.1);
        var keys = [];
        Ext.each(me.data, function(data) {
            Ext.iterate(data, function(key, val) {
                if (Ext.isObject(val) && keys.indexOf(key) === -1) {
                    keys.push(key);
                }
            });
        });
        x1.domain(keys).rangeRound([0, me.scales[orientX].bandwidth()]);
        me.scales[orientXGroup] = x1;

        var bars = shapes.selectAll('rect')
            .data(function(d) {
                var values = Ext.Object.getValues(d);
                return Ext.Array.filter(values, function(a) {
                    return Ext.isObject(a);
                });
            })
            .enter()
            .append('g')
            .filter(function(d) {
                return !Ext.Array.contains(me.disabledSubCategories, d.key);
            })
            .attr('class', function(d) {
                var subCategories = Ext.Object.getKeys(me.colorsByKey);
                var categoryIndex = subCategories.indexOf(d.key);
                return Const.CSS_CLASS.BAR + ' subcategory-' + categoryIndex;
            });
            // .attr('class', staticMe.CSS_CLASS.BAR);

        bars
            .append('rect')
            .filter(function(d) {
                return me.shapeFilter(d, orientY, yField);
            })
            .filter(function(d) {
                return me.drawBar(d);
            })
            .style('fill', function(d) {
                return d.color;
            })
        // .style('opacity', shapeConfig.opacity)
            .attr('x', function(d) {
                return x1(d[xField]);
            })
            .attr('y', function(d) {
                return me.scales[orientY](d[yField]);
            })
            .attr('width', x1.bandwidth())
            .attr('height', function(d) {
                return chartSize[1] - me.scales[orientY](d[yField]);
            })
            .on('mouseover', function(data) {
                var tooltipCmp = me.tooltipCmp;
                var tooltipTpl = shapeConfig.tooltipTpl;
                // Only proceed and show tooltip if a tooltipTpl is
                // given in the chartConfig.
                if (tooltipTpl) {
                    var html = Koala.util.String.replaceTemplateStrings(tooltipTpl, {
                        xAxisAttribute: data[xField],
                        yAxisAttribute: data[yField]
                    });
                    html = Koala.util.String.replaceTemplateStrings(html, data);
                    html = Koala.util.String.replaceTemplateStrings(html, selectedStation);
                    tooltipCmp.setHtml(html);
                    tooltipCmp.setTarget(this);
                    tooltipCmp.show();
                }
            });

        // Uncertainty
        bars
            .append('path')
            .attr('class', Const.CSS_CLASS.UNCERTAINTY)
            .filter(function() {
                if (me.drawBar) {
                    return me.showUncertainty;
                } else {
                    return false;
                }
            })
            .attr('d', function(d) {
                if (d.uncertainty && d.uncertainty > 0) {
                    var lineWidth = x1.bandwidth() / 3;
                    var xCenter = x1(d.key) + x1.bandwidth() / 2;
                    var topVal = d[yField] + (d[yField]/100 * d.uncertainty);
                    var bottomVal = d[yField] - (d[yField]/100 * d.uncertainty);

                    if (bottomVal < 0) {
                        bottomVal = 0;
                    }

                    var yTop = me.scales[orientY](topVal);
                    var yBottom = me.scales[orientY](bottomVal);

                    return 'M' + (xCenter - lineWidth) + ',' + yBottom + 'L' + (xCenter + lineWidth) + ',' + yBottom + 'M' + xCenter + ',' + yBottom +
                    'L' + xCenter + ',' + yTop + 'M' + (xCenter - lineWidth) + ',' + yTop + 'L' + (xCenter + lineWidth) + ',' + yTop;
                }
            })
            .attr('stroke', function(d, idx) {
                var extColor = Ext.util.Color.create(me.customColors[idx] || d.color);
                extColor.darken(0.4);
                return extColor.toHex();
            })
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', 2);

        bars.append('text')
            .filter(function(d) {
                return me.shapeFilter(d, orientY, yField);
            })
            .text(function(d) {
                return labelFunc(d[yField], d, groupProp, keyProp);
            })
            .attr('transform', function(d) {
                return me.getBarLabelTransform(d, orientXGroup, orientY, xField,
                    yField, x1.bandwidth(), me.drawBar(d));
            })
            .attr('text-anchor', 'middle')
            // TODO make configurable. Generic from css config
            .style('font-family', 'sans-serif')
            .style('font-size', '11px')
            .style('fill', '#000')
            .style('font-weight', 'bold')
            .style('unselectable', 'on');

        if (shapeConfig.rotateBarLabel) {
            bars.selectAll('text')
                .filter(function(d) {
                    return me.shapeFilter(d, orientY, yField);
                })
                .attr('transform', function(d) {
                    var labelTransform = me.getBarLabelTransform(d, orientXGroup,
                        orientY, xField, yField, x1.bandwidth(), me.drawBar(d));
                    return labelTransform + ' rotate(-90)';
                })
                .attr('dy', function(d, idx, el) {
                    var textElHeight = el[0].clientHeight;
                    return textElHeight / 4;
                })
                .attr('dx', function(d, idx, el) {
                    if (shapeConfig.showLabelInsideBar) {
                        var textElWidth = el[0].clientWidth;
                        return (textElWidth + 5) * -1;
                    } else {
                        return 0;
                    }
                })
                .style('text-anchor', 'start');
        }
    },

    /**
    * checks if drawBarCondition is fulfilled
    * (this usually means if detectionLimits shall be visualized
    * returns TRUE / FALSE
    */
    drawBar: function(d) {
        var me = this;
        var view = me.getView();
        var drawBarCondition = view.getDrawBarCondition() || function() {
            return true;
        };
        //ToDo implement ToggleButton to show/hide
        //detectionLimits
        //check users rights before
        var userRigths = false;
        var showDetectionLimitsBtnState = true;
        if (userRigths && showDetectionLimitsBtnState) {
            return true;
        } else {
            return drawBarCondition(d);
        }
    },

    /**
     * Returns the translate string for a single bar label.
     *
     * @param  {Object} d        The current data object to create the label
     *                           for.
     * @param  {String} orientX  The x axis orientation.
     * @param  {String} orientY  The y axis orientation.
     * @param  {String} xField   The data index field (inside the given data
     *                           object) for the x axis.
     * @param  {String} yField   The data index field (inside the given data
     *                           object) for the y axis.
     * @param  {Number} barWidth The bar width.
     * @return {String}          The translate sting.
     */
    getBarLabelTransform: function(d, orientX, orientY, xField, yField, barWidth, drawBar) {
        var me = this;
        var chartSize = me.getChartSize();
        var translateX = me.scales[orientX](d[xField]) + (barWidth / 2);
        var translateY;
        if (drawBar) {
            translateY = me.scales[orientY](d[yField]) - 5 || chartSize[1];
        } else {
            translateY = chartSize[1] -5;
        }

        return 'translate(' + translateX + ', ' + translateY + ')';
    },

    /**
     * Checks if the given chart data object has to be drawn in the chart or not.
     *
     * @param  {Object} d The current data object to filter against.
     * @param  {String} orientY The identifier for the y orientation,
     *                          typically 'left'.
     * @param  {String} yField The identifier for the value field, typically
     *                         'value'.
     * @return {Boolean} Wheather to filter the data object or not.
     */
    shapeFilter: function(d, orientY, yField) {
        var me = this;
        var view = me.getView();
        var axisScale = view.getAxes()[orientY].scale;

        // Skip, if the value is not defined.
        if (!(Ext.isDefined(d[yField]))) {
            return false;
        }

        // Skip, if we have a logarithmic axis scale and a value
        // of 0.
        if (axisScale === 'log' && d[yField] === 0) {
            return false;
        }

        // If the current value is negative (considering the
        // current minimum axis value), we must also skip.
        if ((d[yField] - view.getAxes()[orientY].min) < 0) {
            return false;
        }

        // And also skip, if the data object is set to hidden.
        if (d.hidden) {
            return false;
        }

        // All others may pass.
        return true;
    },

    /**
     *
     */
    drawLegend: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var Const = Koala.util.ChartConstants;
        var makeTranslate = staticMe.makeTranslate;
        var CSS = Const.CSS_CLASS;
        var SVG_DEFS = Const.SVG_DEFS;
        var view = me.getView();
        var legendConfig = view.getLegend();
        var legendMargin = legendConfig.legendMargin;

        var legendEntryHeight = me.legendEntryTargetHeight;

        var legendParent = me.legendSvg;
        var legend = legendParent
            .append('g')
            .attr('class', CSS.SHAPE_GROUP + CSS.SUFFIX_LEGEND)
            .attr('transform', makeTranslate(legendMargin.left || 10, 0));

        var firstStationData = Ext.Object.getValues(me.data);
        var curTranslateY;

        var labels = me.scales.bottom.domain();
        if (!me.groupPropToggled) {
            labels = me.labels;
        }

        Ext.each(firstStationData, function(dataObj, idx) {
            if (!dataObj.key) {
                return;
            }
            var toggleVisibilityFunc = (function() {
                return function() {
                    var target = d3.select(d3.event.target);
                    if (target && target.classed(CSS.DELETE_ICON)) {
                        // click happened on the delete icon, no visibility
                        // toggling. The deletion is handled in an own event
                        // handler
                        return;
                    }
                    var barGroup = me.getBarGroupByKey(dataObj['key']);
                    me.toggleGroupVisibility(
                        barGroup, // the real group, containig shapepath & points
                        d3.select(this) // legend entry
                    );
                    var disabledClsName = CSS.DISABLED_CLASS;
                    d3.select(this).classed(disabledClsName, !dataObj.hidden);
                    dataObj.hidden = !dataObj.hidden;
                    me.drawChart();
                };
            }());

            curTranslateY = (idx + 1) * legendEntryHeight;
            var legendEntry = legend
                .append('g')
                .on('click', toggleVisibilityFunc)
                .attr('transform', staticMe.makeTranslate(0, curTranslateY))
                .attr('idx', CSS.PREFIX_IDX_LEGEND_GROUP + dataObj.key)
                .attr('class', function() {
                    if (dataObj.hidden) {
                        return CSS.DISABLED_CLASS;
                    }
                });

            // background for the concrete legend icon, to widen clickable area.
            legendEntry.append('path')
                .attr('d', SVG_DEFS.LEGEND_ICON_BACKGROUND)
                .style('stroke', 'none')
                // invisible, but still triggering events
                .style('fill', 'rgba(0,0,0,0)');

            legendEntry.append('path')
                .attr('d', SVG_DEFS.LEGEND_ICON_BAR)
                .style('fill', dataObj.color);

            var nameAsTooltip = labels[idx];
            // TODO This check doesn't seem to be ideal as it throws a warning
            // if a none datestring is the subCategory
            var isTime = (new moment(nameAsTooltip, moment.ISO_8601, true)).isValid();

            nameAsTooltip = isTime ? Koala.util.Date.getFormattedDate(
                new moment(nameAsTooltip)) : nameAsTooltip;

            legendEntry.append('text')
                .text(nameAsTooltip)
                .attr('text-anchor', 'start')
                .attr('dy', '0')
                .attr('dx', '25');

            legendEntry.append('title')
                .text(nameAsTooltip);

            legendEntry.append('text')
                // ✖ from FontAwesome, see http://fontawesome.io/cheatsheet/
                .text('')
                .attr('class', CSS.DELETE_ICON)
                .attr('text-anchor', 'start')
                .attr('dy', '1')
                .attr('dx', '160') // TODO Discuss, do we need this dynamically?
                .on('click', me.generateDeleteCallback(dataObj));
        });

        var subCategories = me.scales.bottom_group.domain();
        Ext.each(subCategories, function(subCategory, idx) {
            var shape = {};
            shape.config = firstStationData[0][subCategory];
            var toggleVisibilityFunc = (function() {
                return function() {
                    var target = d3.select(d3.event.target);
                    if (target && (target.classed(CSS.DELETE_ICON) ||
                        target.classed(CSS.COLOR_ICON))) {
                        // click happened on the delete icon, no visibility
                        // toggling. The deletion is handled in an own event
                        // handler
                        return;
                    }
                    var selector = me.getSubCategorySelector(subCategory);
                    var group = me.containerSvg.selectAll(selector);
                    me.toggleGroupVisibility(
                        group, // the real group, containig shapepath & points
                        d3.select(this) // legend entry
                    );

                    if (Ext.Array.contains(me.disabledSubCategories, subCategory)) {
                        Ext.Array.remove(me.disabledSubCategories, subCategory);
                    } else {
                        me.disabledSubCategories.push(subCategory);
                    }
                    me.drawChart();
                };
            }());

            curTranslateY = (firstStationData.length * legendEntryHeight) + (idx + 1) * legendEntryHeight;
            var legendEntry = legend
                .append('g')
                .on('click', toggleVisibilityFunc)
                .attr('transform', staticMe.makeTranslate(0, curTranslateY))
                .attr('idx', CSS.PREFIX_IDX_LEGEND_GROUP + subCategory)
                .attr('class', function() {
                    if (Ext.Array.contains(me.disabledSubCategories, subCategory) ) {
                        return CSS.DISABLED_CLASS;
                    }
                });

            // background for the concrete legend icon, to widen clickable area.
            legendEntry.append('path')
                .attr('d', SVG_DEFS.LEGEND_ICON_BACKGROUND)
                .style('stroke', 'none')
                .style('fill', me.customColors[idx] || me.colorsByKey[subCategory]);

            // TODO This check doesn't seem to be ideal as it throws a warning
            // if a none datestring is the subCategory
            var label = me.groupPropToggled ? me.labels[idx] : subCategory;
            var isTime = (new moment(label, moment.ISO_8601, true)).isValid();

            var nameAsTooltip = isTime ? Koala.util.Date.getFormattedDate(
                new moment(label)) : label;

            legendEntry.append('text')
                .text(nameAsTooltip)
                .attr('text-anchor', 'start')
                .attr('dy', '0')
                .attr('dx', '25');

            legendEntry.append('title')
                .text(nameAsTooltip);

            legendEntry.append('text')
                // ✖ from FontAwesome, see http://fontawesome.io/cheatsheet/
                .text('')
                .attr('class', CSS.DELETE_ICON)
                .attr('text-anchor', 'start')
                .attr('dy', '1')
                .attr('dx', '160')
                .on('click', me.deleteSubCategory.bind(me, subCategory));

            if (Ext.isClassic) {
                legendEntry.append('text')
                    // fa-paint-brush from FontAwesome, see http://fontawesome.io/cheatsheet/
                    .text('\uf1fc')
                    .attr('class', CSS.COLOR_ICON)
                    .attr('text-anchor', 'start')
                    .attr('dy', '1')
                    .attr('dx', '140') // TODO Discuss, do we need this dynamically?
                    .on('click', me.generateColorCallback(shape, idx));
            }
        });
        me.wrapAndResizeLegend();
    },

    /**
     * Update the chart configuration with the new size and redraw.
     */
    handleResize: function() {
        if (!this.chartConfig) {
            return;
        }
        var config = this.getView().getConfig();
        var gnosConfig = config.targetLayer.metadata.layerConfig.barChartProperties;
        var margin = gnosConfig.chartMargin.split(',');
        margin = Ext.Array.map(margin, function(w) {
            return parseInt(w, 10);
        });
        var chartSize = this.getViewSize();
        // set the size
        this.chartConfig.barComponentConfig.size = [chartSize[0] - margin[1] - margin[3], chartSize[1] - margin[0] - margin[2]];
        this.chartConfig.barComponentConfig.position = [margin[3], margin[0]];
        if (this.chartConfig.legendComponentConfig) {
            this.chartConfig.legendComponentConfig.position = [chartSize[0] - margin[1], margin[0]];
        } else {
            this.chartConfig.timeseriesComponentConfig.size[0] += margin[3];
        }
        this.chartConfig.chartRendererConfig.size = chartSize;

        this.drawChart();
    },

    /**
     * This returns the selector for a subcategory as it is needed for d3-select.
     *
     * @param {String} subCategory The real subcategory.
     * @return {String} The selector.
     */
    getSubCategorySelector: function(subCategory) {
        var me = this;
        var subCategories = me.scales.bottom_group.domain();
        var categoryIndex = subCategories.indexOf(subCategory);
        return '.subcategory-' + categoryIndex;
    },

    /**
     * Removes a subCategory from the chart, dataObj and Legend.
     *
     * @param {String} subCategory The real subcategory.
     */
    deleteSubCategory: function(subCategory) {
        var me = this;
        // Data
        var firstStationData = Ext.Object.getValues(me.data);
        Ext.each(firstStationData, function(category) {
            if (category[subCategory]) {
                delete category[subCategory];
            }
        });

        // Shape
        var selector = me.getSubCategorySelector(subCategory);
        var elements = me.containerSvg.selectAll(selector);
        elements.remove();

        // Legend
        me.deleteLegendEntry(subCategory);

        this.drawChart();
    },

    /**
     *
     */
    deleteData: function(dataKey) {
        var me = this;
        var firstStationData = Ext.Object.getValues(me.data);
        var dataObjToDelete = Ext.Array.findBy(firstStationData, function(dataObj) {
            return dataObj.key === dataKey;
        });
        Ext.Array.remove(firstStationData, dataObjToDelete);
    },

    /**
     * Removes the barGroup series specified by the given dataKey.
     */
    deleteBarGroup: function(dataKey) {
        var barGroup = this.getBarGroupByKey(dataKey);
        if (barGroup.node()) {
            barGroup.node().remove();
        }
    },

    /**
     *
     */
    getBarGroupByKey: function(key) {
        var me = this;
        var Const = Koala.util.ChartConstants;
        var CSS = Const.CSS_CLASS;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var selector = viewId + ' svg g.' + CSS.SHAPE_GROUP +
            ' g[id="' + key + '"]';
        return d3.select(selector);
    },

    /**
     * This sets the visibility of the uncertainty marker-bars.
     * @param {boolean} visible Wheather to show the uncertainty or not.
     */
    setUncertaintyVisibility: function(visible) {
        var me = this;
        var Const = Koala.util.ChartConstants;
        var CSS = Const.CSS_CLASS;
        var group = me.containerSvg.selectAll('.' + CSS.UNCERTAINTY);
        var hideClsName = CSS.HIDDEN_CLASS;
        if (group) {
            group.classed(hideClsName, !visible);
            me.showUncertainty = visible;
            me.drawChart();
        }
    },

    toggleUncertainty: function() {
        this.setUncertaintyVisibility(!this.showUncertainty);
    }

});
