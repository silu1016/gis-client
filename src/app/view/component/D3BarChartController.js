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
    chartRendered: false,
    ajaxCounter: 0,
    chartConfig: null,
    featureProps: null,

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

    /**
     * Returns the request params for a given station.
     *
     * @param {ol.Feature} station The station to build the request for.
     * @return {Object} The request object.
     */
    getChartDataRequestParams: function(station) {
        var me = this;
        var view = me.getView();
        var targetLayer = view.getTargetLayer();
        var chartConfig = targetLayer.get('barChartProperties');
        var filters = targetLayer.metadata.filters;
        var dateString;
        var timeField;

        // Get the viewparams configured for the layer
        var layerViewParams = Koala.util.Object.getPathStrOr(
                    targetLayer, 'metadata/layerConfig/olProperties/param_viewparams', '');

        // Get the request params configured for the chart
        var paramConfig = Koala.util.Object.getConfigByPrefix(
                chartConfig, 'param_', true);

        // Merge the layer viewparams to the chart params
        paramConfig.viewparams += ';' + layerViewParams;

        // Replace all template strings
        Ext.iterate(paramConfig, function(k, v) {
            paramConfig[k] = Koala.util.String.replaceTemplateStrings(
                v, station);
        });

        Ext.each(filters, function(filter) {
            if (filter.type === 'pointintime') {
                dateString = filter.effectivedatetime.toISOString();
                timeField = filter.param;
                return false;
            }
        });

        var requestParams = {
            service: 'WFS',
            version: '1.1.0',
            request: 'GetFeature',
            typeName: chartConfig.dataFeatureType,
            outputFormat: 'application/json',
            filter: me.getPointInTimeFilter(dateString, timeField),
            sortBy: timeField
        };

        Ext.apply(requestParams, paramConfig);

        return requestParams;
    },

    /**
     * Function to be called on request success.
     *
     * @param {Object} reponse The response object.
     * @param {ol.Feature} station The station the corresponding request was
     *                             send for.
     */
    onChartDataRequestSuccess: function(response, station) {
        var me = this;
        var view = me.getView();
        var colors = view.getShape().color.split(',');
        var jsonObj;
        var stationId = station.get('id');
        var seriesData = [];

        if (response && response.responseText) {
            try {
                jsonObj = Ext.decode(response.responseText);
            } catch (err) {
                Ext.log.error('Could not parse the response: ', err);
                return false;
            }
        }

        Ext.each(jsonObj.features, function(feature, idx) {
            var dataObj = {};
            dataObj.key = feature.properties['nuclide']; // TODO Do we need this configurable
            dataObj.value = feature.properties['result_value']; // TODO Do we need this configurable
            dataObj.color = colors[idx] || me.getRandomColor();
            dataObj.detection_limit = feature.properties['nachweisgrenze']; // TODO Do we need this configurable
            dataObj.uncertainty = feature.properties['uncertainty']; // TODO Do we need this configurable
            seriesData.push(dataObj);
        });
        me.data[stationId] = seriesData;
        me.chartDataAvailable = true;

        var value;
        if (featureProps[field] || featureProps[field] === 0) {
            value = featureProps[field];
        } else {
            value = Koala.util.String.getValueFromSequence(
                defaultsSequence, idx, undefined);
        }

        me.ajaxCounter++;
        if (me.ajaxCounter === view.getSelectedStations().length) {
            if (view.getShowLoadMask()) {
                view.setLoading(false);
            }
            me.fireEvent('chartdataprepared');
        }
    },

    /**
     *
     */
    drawChart: function() {
        var me = this;

        me.drawSvgContainer();
        me.drawLegendContainer();

        me.createScales();
        me.createAxes();
        me.createGridAxes();
        me.createTooltip();

        me.setDomainForScales();

        me.drawTitle();
        me.drawAxes();
        me.drawGridAxes();
        me.drawShapes();

        me.drawLegend();

        me.chartRendered = true;
    },

    /**
     *
     */
    redrawChart: function() {
        var me = this;

        if (me.chartRendered && me.data) {

            me.updateSvgContainerSize();

            me.deleteShapeContainerSvg();

            me.createScales();
            me.createAxes();
            me.createGridAxes();

            me.setDomainForScales();

            me.redrawTitle();
            me.redrawAxes();
            me.redrawGridAxes();
            me.redrawShapes();

            me.updateLegendContainerPosition();
        }
    },

    /**
     * Sets the domain for each scale in the chart by the use of the extent
     * of the given input data values.
     */
    setDomainForScales: function() {
        var me = this;
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
            var firstStationData = Object.values(me.data)[0];

            if (axis.scale === 'ordinal') {
                axisDomain = firstStationData.map(function(d) {
                    return d.key;
                });
                me.scales[orient].domain(axisDomain);
            } else {
                var dataRange = d3.extent(firstStationData, function(d) {
                    if (!d.hidden) {
                        return d.value;
                    }
                });
                //limit chart data to 80% of chart height
                dataRange[1] = dataRange[1]/0.8;

                if (Ext.isDefined(axis.min)) {
                    min = Koala.util.String.coerce(axis.min);
                    makeDomainNice = false; // if one was given, don't auto-enhance
                } else {
                    min = dataRange[0];
                }
                if (Ext.isDefined(axis.max)) {
                    max = Koala.util.String.coerce(axis.max);
                    makeDomainNice = false; // if one was given, don't auto-enhance
                } else {
                    max = dataRange[1] + (dataRange[1]/10);
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
                if (axisDomain) {
                    var domain = me.scales[orient].domain(axisDomain);
                    if (makeDomainNice) {
                        domain.nice();
                    }
                }
            }
        });
    },

    /**
     * Redraws the shapeGroup containg all shapes (bars in this case).
     */
    redrawShapes: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var shapeGroup = d3.select(viewId + ' .' + staticMe.CSS_CLASS.SHAPE_GROUP);

        if (shapeGroup.node()) {
            shapeGroup.node().remove();
        }

        me.drawShapes();
    },

    /**
     *
     */
    drawShapes: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var view = me.getView();
        var selectedStation = view.getSelectedStations()[0];
        var viewId = '#' + view.getId();
        var chartSize = me.getChartSize();
        var barWidth;

        var labelFunc = view.getLabelFunc() || staticMe.identity;

        var shapeConfig = view.getShape();
        var xField = 'key';
        var yField = 'value';
        var orientX = 'bottom';
        var orientY = 'left';
        var firstStationData = Object.values(me.data)[0];

        var shapeGroup = d3.select(viewId + ' svg > g')
            .append('g')
            .attr('class', staticMe.CSS_CLASS.SHAPE_GROUP);

        barWidth = (chartSize[0] / firstStationData.length);
        barWidth -= staticMe.ADDITIONAL_BAR_MARGIN;

        var shapes = shapeGroup
            .selectAll('rect')
            .data(me.data)
            .enter().append('g')
            .attr('class', staticMe.CSS_CLASS.BAR)
            .attr('id', function(d) {
                return d[xField];
            })
            .append('rect')
            .filter(function(d) {
                return me.shapeFilter(d, orientY, yField);
            })
            .style('fill', function(d) {
                return d.color || staticMe.getRandomColor();
            })
        // .style('opacity', shapeConfig.opacity)
            .attr('x', function(d) {
                return me.scales[orientX](d[xField]);
            })
            .attr('y', function(d) {
                return me.scales[orientY](d[yField]);
            })
            .attr('width', barWidth)
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
        shapes
            .append('path')
            .attr('d', function(d) {
                if (d.uncertainty && d.uncertainty > 0) {
                    var lineWidth = 10;
                    var xCenter = me.scales[orientX](d[xField]) + barWidth/2;
                    var topVal = d[yField] + d.uncertainty;
                    var bottomVal = d[yField] - d.uncertainty;

                    if (bottomVal < 0) {
                        bottomVal = 0;
                    }

                    var yTop = me.scales[orientY](topVal);
                    var yBottom = me.scales[orientY](bottomVal);

                    return 'M' + (xCenter - lineWidth) + ',' + yBottom + 'L' + (xCenter + lineWidth) + ',' + yBottom + 'M' + xCenter + ',' + yBottom +
                    'L' + xCenter + ',' + yTop + 'M' + (xCenter - lineWidth) + ',' + yTop + 'L' + (xCenter + lineWidth) + ',' + yTop;
                }
            })
            .attr('stroke', 'grey')
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', 2);

        var bars = d3.selectAll(viewId + ' .k-d3-bar');

        bars.append('text')
            .filter(function(d) {
                return me.shapeFilter(d, orientY, yField);
            })
            .text(function(d) {
                return labelFunc(d[yField], d);
            })
            .attr('transform', function(d) {
                return me.getBarLabelTransform(d, orientX, orientY, xField,
                    yField, barWidth);
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
                    var labelTransform = me.getBarLabelTransform(d, orientX,
                        orientY, xField, yField, barWidth);
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
    getBarLabelTransform: function(d, orientX, orientY, xField, yField, barWidth) {
        var me = this;
        var chartSize = me.getChartSize();
        var translateX = me.scales[orientX](d[xField]) + (barWidth / 2);
        var translateY = me.scales[orientY](d[yField]) - 5 || chartSize[1];

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
        var makeTranslate = staticMe.makeTranslate;
        var CSS = staticMe.CSS_CLASS;
        var SVG_DEFS = staticMe.SVG_DEFS;
        var view = me.getView();
        var legendConfig = view.getLegend();
        var legendMargin = legendConfig.legendMargin;

        var legendEntryHeight = me.legendEntryTargetHeight;

        var legendParent = me.legendSvg;
        var legend = legendParent
            .append('g')
            .attr('class', CSS.SHAPE_GROUP + CSS.SUFFIX_LEGEND)
            .attr('transform', makeTranslate(legendMargin.left || 10, 0));

        me.updateLegendContainerDimensions();

        var firstStationData = Object.values(me.data)[0];

        Ext.each(firstStationData, function(dataObj, idx) {
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
                    var SHAPE_GROUP = CSS.SHAPE_GROUP;
                    var SUFFIX_HIDDEN = CSS.SUFFIX_HIDDEN;
                    var hideClsNameLegend = SHAPE_GROUP + CSS.SUFFIX_LEGEND + SUFFIX_HIDDEN;
                    d3.select(this).classed(hideClsNameLegend, !dataObj.hidden);
                    dataObj.hidden = !dataObj.hidden;
                    me.redrawChart();
                };
            }());

            var curTranslateY = (idx + 1) * legendEntryHeight;
            var legendEntry = legend
                .append('g')
                .on('click', toggleVisibilityFunc)
                .attr('transform', staticMe.makeTranslate(0, curTranslateY))
                .attr('idx', CSS.PREFIX_IDX_LEGEND_GROUP + dataObj.key);

            // background for the concrete legend icon, to widen clickable area.
            legendEntry.append('path')
                .attr('d', SVG_DEFS.LEGEND_ICON_BACKGROUND)
                .style('stroke', 'none')
                // invisible, but still triggering events
                .style('fill', 'rgba(0,0,0,0)');

            legendEntry.append('path')
                .attr('d', SVG_DEFS.LEGEND_ICON_BAR)
                .style('fill', dataObj.color);

            var nameAsTooltip = dataObj.key;
            var visualLabel = staticMe.labelEnsureMaxLength(
                nameAsTooltip, (legendConfig.legendEntryMaxLength || 17)
            );

            legendEntry.append('text')
                .text(visualLabel)
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
    },

    /**
     *
     */
    deleteEverything: function(dataObj) {
        // Data
        this.deleteData(dataObj.key);
        // Shape
        this.deleteBarGroup(dataObj.key);
        // Legend
        this.deleteLegendEntry(dataObj.key);

        this.redrawChart();
        this.redrawLegend();
    },

    /**
     *
     */
    deleteData: function(dataKey) {
        var me = this;
        var firstStationData = Object.values(me.data)[0];
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
        barGroup.node().remove();
    },

    /**
     *
     */
    getBarGroupByKey: function(key) {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var CSS = staticMe.CSS_CLASS;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var selector = viewId + ' svg g.' + CSS.SHAPE_GROUP +
            ' g[id="' + key + '"]';
        return d3.select(selector);
    }

});
