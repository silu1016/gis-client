/* Copyright (c) 2015-2016 terrestris GmbH & Co. KG
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
    extend: 'Ext.app.ViewController',
    alias: 'controller.component-d3barchart',

    statics: {

        /**
         * [CSS_CLASS description]
         * @type {Object}
         */
        CSS_CLASS: {
            AXIS: 'k-d3-axis',
            AXIS_X: 'k-d3-axis-x',
            AXIS_Y: 'k-d3-axis-y',

            PLOT_BACKGROUND: 'k-d3-plot-background',

            GRID: 'k-d3-grid',
            GRID_X: 'k-d3-grid-x',
            GRID_Y: 'k-d3-grid-y',

            SHAPE_GROUP: 'k-d3-shape-group',
            BAR: 'k-d3-bar',
            SHAPE_PATH: 'k-d3-shape-path',
            SHAPE_POINT_GROUP: 'k-d3-shape-points',
            DELETE_ICON: 'k-d3-delete-icon',

            PREFIX_IDX_SHAPE_GROUP: 'shape-group-',
            PREFIX_IDX_SHAPE_PATH: 'shape-path-',
            PREFIX_IDX_SHAPE_POINT_GROUP: 'shape-points-',
            PREFIX_IDX_LEGEND_GROUP: 'legend-group-',

            SUFFIX_LEGEND: '-legend',
            SUFFIX_HIDDEN: '-hidden'
        },

        /**
         * [ADDITIONAL_BAR_MARGIN description]
         * @type {Number}
         */
        ADDITIONAL_BAR_MARGIN: 5,

        /**
         * Static mapping of supported D3 axis generators. See the
         * {@link https://github.com/d3/d3-axis/blob/master/README.md#axisTop|D3 API documentation}
         * for further details.
         *
         * @type {function} top - Return a top-oriented axis generator.
         * @type {function} right - Return a right-oriented axis generator.
         * @type {function} bottom - Return a bottom-oriented axis generator.
         * @type {function} left - Return a left-oriented axis generator.
         */
        ORIENTATION: {
            top: d3.axisTop,
            right: d3.axisRight,
            bottom: d3.axisBottom,
            left: d3.axisLeft
        },

        /**
         * Static mapping of supported d3 scales. In D3 Scales are functions that
         * map from an input domain to an output range. See the
         * {@link https://github.com/d3/d3/blob/master/API.md#scales-d3-scale|D3 API documentation}
         * for further details.
         *
         * @type {function} linear - Return a quantitative linear scale.
         * @type {function} pow - Return a quantitative power scale.
         * @type {function} sqrt - Return a quantitative power scale with exponent 0.5.
         * @type {function} log - Return a quantitative logarithmic scale.
         * @type {function} ident - Return a quantitative identity scale.
         * @type {function} time - Return a linear scale for time.
         * @type {function} utc - Return a linear scale for UTC.
         */
        SCALE: {
            linear: d3.scaleLinear,
            pow: d3.scalePow,
            sqrt: d3.scaleSqrt,
            log: d3.scaleLog,
            ident: d3.scaleIdentity,
            time: d3.scaleTime,
            utc: d3.scaleUtc,
            ordinal: d3.scaleBand
        },

        /**
         * Static mapping of supported d3 shape types. See the
         * {@link https://github.com/d3/d3/blob/master/API.md#shapes-d3-shape|D3 API documentation}
         * for further details.
         *
         * @type {function} line - Return a line generator.
         * @type {function} area - Return an area generator.
         * @type {function} bar - TODO
         */
        TYPE: {
            line: d3.line,
            area: d3.area,
            // TODO: set another type?!
            bar: d3.line
        },

        /**
         * Static mapping of supported d3 curve types. In D3 the curve type
         * represents the interpolation between points in a continous shape. See
         * the {@link https://github.com/d3/d3/blob/master/API.md#curves|D3 API documentation}
         * for further details.
         *
         * @type {function} linear - A polyline through specified points.
         * @type {function} cubicBasisSpline - A cubic basis spline using the
         *       specified control points.
         * @type {function} curveMonotoneX - A cubic spline that preserves
         *       monotonicity in y, assuming monotonicity in x.
         * @type {function} naturalCubicSpline - A natural cubic spline with the
         *       second derivative of the spline set to zero at the endpoints.
         * @type {function} curveStep - A piecewise constant function. The y-value
         *       changes at the midpoint of each pair of adjacent x-values.
         * @type {function} curveStepAfter - A piecewise constant function. The
         *       y-value changes after the x-value.
         * @type {function} curveStepBefore - A piecewise constant function. The
         *       y-value changes before the x-value.
         */
        CURVE: {
            linear: d3.curveLinear,
            cubicBasisSpline: d3.curveBasis,
            curveMonotoneX: d3.curveMonotoneX,
            naturalCubicSpline: d3.curveNatural,
            curveStep: d3.curveStep,
            curveStepAfter: d3.curveStepAfter,
            curveStepBefore: d3.curveStepBefore
        }
    },

    /**
     *
     */
    scales: {},
    shapes: [],
    axes: {},
    gridAxes: {},
    tooltipCmp: null,
    zoomInteraction: null,
    initialPlotTransform: null,
    data: {},
    // data: [],
    chartRendered: false,
    ajaxCounter: 0,
    chartConfig: null,
    featureProps: null,

    /**
     * [getChartSize description]
     * @return {[type]} [description]
     */
    getChartSize: function() {
        var me = this;
        var view = me.getView();
        var chartMargin = view.getChartMargin();

        return [
            view.getWidth() - chartMargin.left - chartMargin.right,
            view.getHeight() - chartMargin.top - chartMargin.bottom
        ];
    },

    /**
     *
     */
    onShow: function() {
        var me = this;

        // We have to cleanup manually.  WHY?!
        this.scales = {};
        this.shapes = [];
        this.axes = {};
        this.gridAxes = {};
        this.data = [];

        me.prepareData();
        me.drawChart();
    },

    /**
     *
     */
    prepareData: function() {
        var me = this;
        var view = me.getView();
        var targetLayer = view.getTargetLayer();
        var selectedStation = view.getSelectedStation();
        var chartConfig = targetLayer.metadata.layerConfig.barChartProperties;
        var featureProps = selectedStation.getProperties();
        var fields = chartConfig.chartFieldSequence.split(',');
        var colors = chartConfig.colorSequence.split(',');

        Ext.each(fields, function(field, idx) {
            var dataObj = {};
            dataObj.key = field;
            dataObj.value = featureProps[field];
            dataObj.color = colors[idx] || '#'+(Math.random()*0xFFFFFF<<0).toString(16);
            me.data.push(dataObj);
        });
    },

    /**
     *
     */
    drawChart: function() {
        var me = this;

        me.createInteractions();
        me.drawSvgContainer();

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
    },

    /**
     * [createInteractions description]
     * @return {[type]} [description]
     */
    createInteractions: function() {
        var me = this;
        me.zoomInteraction = me.createZoomInteraction();
    },

    /**
     * Draws the root <svg>-element into the <div>-element rendered by the Ext
     * component.
     */
    drawSvgContainer: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var CSS = staticMe.CSS_CLASS;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var chartMargin = view.getChartMargin();
        var chartSize = me.getChartSize();
        var translate = 'translate(' + chartMargin.left + ',' +
                chartMargin.top + ')';

        // Get the container view by its ID and append the SVG including an
        // additional group element to it.
        d3.select(viewId)
            .append('svg')
                .attr('viewBox', "0 0 " + view.getWidth() + " " + view.getHeight())
                .attr('width', view.getWidth())
                .attr('height', view.getHeight())
            .append('g')
                .attr('transform', translate)
            .append('rect')
                .style('fill', view.getBackgroundColor())
                .attr('class', CSS.PLOT_BACKGROUND)
                .attr('width', chartSize[0])
                .attr('height', chartSize[1])
                .attr('pointer-events', 'all');

        //Add a "defs" element to the svg
        var defs = d3.select(viewId + ' svg')
            .append("defs");

        //Append a clipPath element to the defs element, and a Shape
        // to define the cliping area
        defs
            // .append("clipPath")
                // .attr('id', 'my-clip-path')
            .append('rect')
                .attr('width', chartSize[0]) //Set the width of the clipping area
                .attr('height', chartSize[1]); // set the height of the clipping area

        //clip path for x axis
        defs
            // .append("clipPath")
                // .attr('id', 'x-clip-path')
            .append('rect')
                .attr('width', chartSize[0]) //Set the width of the clipping area
                .attr('height', chartSize[1] + chartMargin.bottom); // set the height of the clipping area

    },

    /**
     *
     */
    createScales: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var view = me.getView();
        var chartSize = me.getChartSize();

        Ext.iterate(view.getAxes(), function(orient, axisConfig) {
            var scaleType = staticMe.SCALE[axisConfig.scale];
            var range;

            if (orient === 'top' || orient === 'bottom') {
                range = [0, chartSize[0]];
            } else if (orient === 'left' || orient === 'right') {
                range = [chartSize[1], 0];
            }

            me.scales[orient] = scaleType().range(range);
        });
    },

    /**
     * [createAxes description]
     * @return {[type]} [description]
     */
    createAxes: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var view = me.getView();
        var axesConfig = view.getAxes();

        Ext.iterate(axesConfig, function(orient, axisConfig) {
            var axis = staticMe.ORIENTATION[orient];
            var scale = me.scales[orient];
            var chartAxis;
            if(orient === "left"){
                chartAxis = axis(scale);
            } else {
                var tickFormat = axisConfig.format ? d3.format(axisConfig.format) : undefined;
                chartAxis = axis(scale)
                    .ticks(axisConfig.ticks)
                    .tickValues(axisConfig.values)
                    .tickFormat(tickFormat)
                    .tickSize(axisConfig.tickSize || 6)
                    .tickPadding(axisConfig.tickPadding || 3);
            }

            me.axes[orient] = chartAxis;
        });
    },

    /**
     * Creates a simple ExtJS tooltip, see the
     * {@link http://docs.sencha.com/extjs/6.0.0/classic/Ext.tip.ToolTip.html|ExtJS API documentation}
     * for further details and config options.
     */
    createTooltip: function() {
        this.tooltipCmp = Ext.create('Ext.tip.ToolTip');
    },

    /**
     * Sets the domain for each scale in the chart by the use of the extent of
     * the given input data values.
     */
    setDomainForScales: function() {
        var me = this;

        // iterate over all scales/axis orientations and all shapes to find the
        // corresponding data index for each scale. Set the extent (max/min range
        // in this data index) for each scale.
        Ext.iterate(me.scales, function(orient) {
            if (orient === 'top' || orient === 'bottom') {
                me.scales[orient].domain(me.data.map(function(d) {
                    return d.key;
                }));
            } else if (orient === 'left' || orient === 'right') {
                me.scales[orient].domain([0, d3.max(me.data, function(d) {
                    return d.value + d.value/20;
                })]);
            }
        });
    },

    /**
     *
     */
    drawTitle: function() {
        var me = this;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var titleConfig = view.getTitle();
        var chartSize = me.getChartSize();

        d3.select(viewId + ' svg > g')
            .append('text')
                .attr('transform', 'translate(' + (chartSize[0] / 2) + ', 0)')
                .attr('dy', (titleConfig.labelPadding || 18) * -1)
                .attr('fill', titleConfig.labelColor || '#000')
                .style('text-anchor', 'middle')
                .style('font-weight', 'bold')
                .style('font-size', titleConfig.labelSize || 20)
                .text(titleConfig.label || '');
    },

    /**
     *
     */
    drawAxes: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var CSS = staticMe.CSS_CLASS;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var axesConfig = view.getAxes();
        var chartSize = me.getChartSize();

        Ext.iterate(axesConfig, function(orient, axisConfig) {
            var axisTransform;
            var labelTransform;
            var labelPadding;
            var cssClass;

            if (orient === 'top' || orient === 'bottom') {
                cssClass = CSS.AXIS + ' ' + CSS.AXIS_X;
                axisTransform = (orient === 'bottom') ?
                        'translate(0,' + chartSize[1] + ')' : undefined;

                labelTransform = 'translate(' + (chartSize[0] / 2) + ', 0)';
                labelPadding = axisConfig.labelPadding || 35;
                // clipPath = 'url(#x-clip-path)';
            } else if (orient === 'left' || orient === 'right') {
                cssClass = CSS.AXIS + ' ' + CSS.AXIS_Y;
                axisTransform = (orient === 'right') ?
                        'translate(' + chartSize[0] + ', 0)' : undefined;

                labelTransform = 'rotate(-90), translate(' + (chartSize[1] / 2 * -1) + ', 0)';
                labelPadding = (axisConfig.labelPadding || 25) * -1;
            }

            // We draw the left axis in the grid part as it fits our needs for barcharts.
            if (orient === 'top' || orient === 'bottom') {
                d3.select(viewId + ' svg > g')
                    // .append('g')
                        // .attr('clip-path', clipPath)
                    .append('g')
                        .attr('class', cssClass)
                        .attr('transform', axisTransform)
                        .call(me.axes[orient])
                    .append('text')
                        .attr('transform', labelTransform)
                        .attr('dy', labelPadding)
                        .attr('fill', axisConfig.labelColor || '#000')
                        .style('text-anchor', 'middle')
                        .style('font-weight', 'bold')
                        .style('font-size', axisConfig.labelSize || 12)
                        .text(axisConfig.label || '');
            }

        });
    },

    /**
     *
     */
    drawShapes: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var view = me.getView();
        var selectedStation = view.getSelectedStation();
        var viewId = '#' + view.getId();
        var chartSize = me.getChartSize();
        var barWidth;

        // Wrap the shapes in its own <svg> element.
        // var shapeSvg = d3.select(viewId + ' svg > g')
        //     .append('svg')
        //         .attr('top', 0)
        //         .attr('left', 0)
        //         .attr('width', chartSize[0])
        //         .attr('height', chartSize[1]);
                // .attr('viewBox', '0 0 550 420');

        var shapeConfig = view.getShape();
        // var xField = shapeConfig.xField;
        // var yField = shapeConfig.yField;
        var xField = 'key';
        var yField = 'value';
        // var orientX = me.getAxisByField(xField);
        // var orientY = me.getAxisByField(yField);
        var orientX = 'bottom';
        var orientY = 'left';
        // var color = shapeConfig.color;

        var shapeGroup = d3.select(viewId + ' svg > g')
        // var shapeGroup = shapeSvg
            .append('g')
                .attr('class', staticMe.CSS_CLASS.SHAPE_GROUP);
                // .attr('clip-path','url(#my-clip-path)');

        barWidth = (chartSize[0] / me.data.length);
        barWidth -= staticMe.ADDITIONAL_BAR_MARGIN;
        shapeGroup
            .selectAll('rect')
                .data(me.data)
            .enter().append('g')
                .attr('class', staticMe.CSS_CLASS.BAR)
                .attr('id', function(d) {
                    return d[xField];
                })
                .append('rect')
                .filter(function(d) {
                    return Ext.isDefined(d[yField]);
                })
                    .style('fill', function(d) {
                        return d.color;
                    })
                    .style('opacity', shapeConfig.opacity)
                    .attr('x', function(d) {
                        return me.scales[orientX](d[xField]);
                    })
                    .attr('y', function(d) {
                        return me.scales[orientY](d[yField]);
                    })
                    // .attr('transform', 'translate(' + ((barWidth / 2) * -1) + ', 0)')
                    .attr('width', barWidth)
                    .attr('height', function(d) {
                        return chartSize[1] - me.scales[orientY](d[yField]);
                    })
                    .on('mouseover', function(data) {
                        var tooltipCmp = me.tooltipCmp;
                        var tooltipTpl = shapeConfig.tooltipTpl;

                        // Seperate prereplacements. Not sure if this could be done by replaceTemplateStrings util
                        tooltipTpl = tooltipTpl.replace("[[xAxisAttribute]]", data[xField]);
                        tooltipTpl = tooltipTpl.replace("[[yAxisAttribute]]", data[yField]);

                        var html = Koala.util.String.replaceTemplateStrings(tooltipTpl, selectedStation);
                        tooltipCmp.setHtml(html);
                        // tooltip.setTitle('Title for ' + shapeConfig.name);
                        tooltipCmp.setTarget(this);
                        tooltipCmp.show();
                    });

        var bars = d3.selectAll('.k-d3-bar');

        bars.append("text")
            // TODO add configurable labelfunc e.g. unter nachweisgrenze
            .text(function(d){
                return d[yField];
            })
            .filter(function(d) {
                return Ext.isDefined(d[yField]);
            })
            .attr("x", function(d) {
                 return me.scales[orientX](d[xField]);
            })
            .attr("y", function(d) {
                 return me.scales[orientY](d[yField]);
            })
            .attr('transform', 'translate(' + (barWidth / 2) + ', -5)')
            .attr("text-anchor", "middle")
            // TODO make configurable. Generic from css config
            .style("font-family", "sans-serif")
            .style("font-size", "11px")
            .style("fill", "#000")
            .style("font-weight", "bold")
            .style("unselectable", "on");

        if (barWidth !== undefined) {
            me.initialPlotTransform = {
                x: (barWidth / 2),
                y: 0,
                k: 1
            };
            // me.transformPlot(me.initialPlotTransform, 0);
        }
    },

    /**
     * [createZoomInteraction description]
     * @return {[type]} [description]
     */
    createZoomInteraction: function() {
        var me = this;
        var staticMe = Koala.view.component.D3ChartController;
        var CSS = staticMe.CSS_CLASS;
        var view = me.getView();
        var viewId = '#' + view.getId();

        return d3.zoom()
            .extent([0, 0], [0, 0])
            .scaleExtent([1, 10])
            .on('zoom', function() {
                // d3.selectAll(viewId + ' svg g.' + CSS.SHAPE_GROUP)
                //     .attr('transform', d3.event.transform);

                Ext.iterate(me.axes, function(orient) {
                    var axis;
                    var axisSelector = 'svg g.' + CSS.AXIS;
                    var axisGenerator = me.axes[orient];
                    var scaleGenerator = me.scales[orient];

                    if (orient === 'top' || orient === 'bottom') {
                        axis = d3.select(axisSelector + '.' + CSS.AXIS_X);
                        var zoomTransform = d3.event.transform;

                        // axis.call(axisGenerator.scale(
                        //     d3.event.transform.rescaleX(scaleGenerator)));

                        var bars = d3.selectAll(viewId + ' svg g.' + CSS.SHAPE_GROUP + ' g');
                        bars.attr("transform", "translate(" + zoomTransform.x + ",0)scale(" + zoomTransform.k + ",1)");

                        axis
                            .attr("transform", "translate(" + zoomTransform.x + "," + (me.getChartSize()[1]) + ")")
                            .call(axisGenerator.scale(scaleGenerator.range([0, me.getChartSize()[0] * zoomTransform.k])));

                        // axis.call(axisGenerator);

                    } else if (orient === 'left' || orient === 'right') {
                        axis = d3.select(axisSelector + '.' + CSS.AXIS_Y);

                        // axis.call(axisGenerator.scale(
                        //     d3.event.transform.rescaleY(scaleGenerator)));

                        axis.call(axisGenerator);
                    }
                });
            });
    },

    /**
     *
     */
    getAxisByField: function(field) {
        var view = this.getView();
        var axisOrientation;

        Ext.iterate(view.getAxes(), function(orient, axisConfig) {
            if (axisConfig.dataIndex === field) {
                axisOrientation = orient;
                return false; // break early
            }
        });

        return axisOrientation;
    },

    /**
     * [createGridAxes description]
     * @return {[type]} [description]
     */
    createGridAxes: function() {
        var me = this;
        var view = me.getView();
        var gridConfig = view.getGrid();

        if (!gridConfig.show) {
            return false;
        }

        var staticMe = Koala.view.component.D3BarChartController;
        var chartSize = me.getChartSize();

        var axis = staticMe.ORIENTATION.left;
        var scale = me.scales.left;
        var tickSize = chartSize[0] * -1;

        me.gridAxes.left = axis(scale)
            .tickSize(tickSize);
    },

    /**
     * [drawGridAxes description]
     * @return {[type]} [description]
     */
    drawGridAxes: function() {
        var me = this;
        var view = me.getView();
        var gridConfig = view.getGrid();

        if (!gridConfig.show) {
            return false;
        }

        var staticMe = Koala.view.component.D3BarChartController;
        var CSS = staticMe.CSS_CLASS;
        var viewId = '#' + view.getId();

        var cssClass = CSS.GRID + ' ' + CSS.GRID_Y;

        d3.select(viewId + ' svg > g')
            .append('g')
                .attr('class', cssClass)
                .call(me.gridAxes.left);

        d3.selectAll(viewId + ' svg g.' + CSS.GRID + ' line')
            .style('stroke-width', gridConfig.width)
            .style('stroke', gridConfig.color)
            .style('stroke-opacity', gridConfig.opacity);
    },

    /**
     * [transformPlot description]
     * @return {[type]} [description]
     */
    transformPlot: function(transform, duration) {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var CSS = staticMe.CSS_CLASS;
        var viewId = '#' + me.getView().getId();
        var plot = d3.select(viewId + ' svg rect.' + CSS.PLOT_BACKGROUND);

        if (duration && duration > 0) {
            plot
                .transition()
                .duration(duration)
                .call(
                    me.zoomInteraction.transform,
                    d3.zoomIdentity
                        .translate(transform.x, transform.y)
                        .scale(transform.k)
                );
        } else {
            plot
                .call(
                    me.zoomInteraction.transform,
                    d3.zoomIdentity
                        .translate(transform.x, transform.y)
                        .scale(transform.k)
                );
        }
    },

    /**
     * [resetZoom description]
     */
    resetZoom: function() {
        var me = this;
        this.transformPlot(me.initialPlotTransform, 500);
    },

    /**
     * Removes the current legend from the chart (if it exists) and redraws the
     * legend by looking atour internal data.
     */
    redrawLegend: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var CSS = staticMe.CSS_CLASS;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var legendCls = CSS.SHAPE_GROUP + CSS.SUFFIX_LEGEND;
        var legend = d3.select(viewId + ' svg g.' + legendCls);
        if (legend) {
            var legendNode = legend.node();
            legendNode.parentNode.removeChild(legendNode);
        }
        me.drawLegend();
    },

    /**
     *
     */
    drawLegend: function() {
        var me = this;
        var staticMe = Koala.view.component.D3BarChartController;
        var CSS = staticMe.CSS_CLASS;
        var view = me.getView();
        var viewId = '#' + view.getId();
        var legendConfig = view.getLegend();
        var legendMargin = legendConfig.legendMargin;
        var chartSize = me.getChartSize();

        var legend = d3.select(viewId + ' svg > g')
            .append('g')
                .attr('class', CSS.SHAPE_GROUP + CSS.SUFFIX_LEGEND)
                .attr('transform', 'translate(' + (chartSize[0] + legendMargin.left) + ',' + (legendMargin.bottom) + ')');

        Ext.each(me.data, function(dataObj, idx) {
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
                    me.toggleBarGroupVisibility(
                        barGroup, // the real group, containig shapepath & points
                        d3.select(this) // legend entry
                    );
                };
            }());

            var legendEntry = legend
                .append('g')
                .on('click', toggleVisibilityFunc)
                .attr('transform', 'translate(0, ' + (idx * 30) + ')')
                .attr('idx', staticMe.CSS_CLASS.PREFIX_IDX_LEGEND_GROUP + idx);

            // background for the concrete legend icon, to widen clickable area.
            legendEntry.append('path')
                .attr('d', 'M-3 -14 h 25 v 16 h -25 Z')
                .style('stroke', 'none')
                // invisible, but still triggering events
                .style('fill', 'rgba(0,0,0,0)');

            legendEntry.append('path')
                .attr('d', 'M0 -10 h 6 v 12 h -6 Z M7 -6 h 6 v 8 h -6 Z M14 -10 h 6 v 12 h -6 Z')
                .style('fill', dataObj.color);

            legendEntry.append('text')
                .text(dataObj.key)
                .attr('text-anchor', 'start')
                .attr('dy', '0')
                .attr('dx', '25');

            legendEntry.append('text')
                .text('✖')
                .attr('class', CSS.DELETE_ICON)
                .attr('text-anchor', 'start')
                .attr('dy', '1')
                .attr('dx', '150') // TODO will be hard to do dynamically…
                .on('click', me.generateDeleteCallback(dataObj));
        });
    },

    /**
     * Generates a callback that can be used for the click event on the delete
     * icon. Inside this callback all relevant parts of the series are removed.
     *
     * @param {Object} shape The current shape object to handle.
     * @param {[type]} idx The index of the shape object in the array of all
     *     shapes.
     * @return {Function} The callback to be used as click handler on the delete
     *     icon.
     */
    generateDeleteCallback: function(dataObj) {
        var me = this;
        var deleteCallback = function() {
            var name = dataObj.key;
            var title = 'Serie "' + name + '" entfernen?';
            var msg = 'Möchten sie die Serie <b>' + name + '</b>' +
                ' aus dem Graphen entfernen?';
            var confirmCallback = function(buttonId) {
                if (buttonId === 'ok' || buttonId === 'yes') {
                    me.deleteEverything(dataObj, this.parentNode);
                    me.redrawLegend();
                }
            };
            Ext.Msg.confirm(title, msg, confirmCallback, this);
        };
        return deleteCallback;
    },

    /**
     *
     */
    deleteEverything: function(dataObj, legendElement) {
        // Data
        this.deleteData(dataObj.key);
        // Shape
        this.deleteBarGroup(dataObj.key);
        // Legend
        this.deleteLegendEntry(legendElement);
    },

    /**
     *
     */
    deleteData: function(dataKey) {
        var me = this;
        var dataObjToDelete = Ext.Array.findBy(me.data, function(dataObj){
            return dataObj.key === dataKey;
        });
        Ext.Array.remove(me.data, dataObjToDelete);
    },

    /**
     * Deletes the legendentry passed from the DOM.
     *
     * @param  {DOMElement} legendEntry The DOM element to remove.
     */
    deleteLegendEntry: function (legendEntry) {
        var parent = legendEntry && legendEntry.parentNode;
        if (parent) {
            parent.removeChild(legendEntry);
        }
    },

    /**
     * Removes the barGroup series specified by the given dataKey.
     *
     */
    deleteBarGroup: function(dataKey) {
        var me = this;
        var barGroup = me.getBarGroupByKey(dataKey);
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

        return d3.select(viewId + ' svg g.' + CSS.SHAPE_GROUP + ' g[id=' + key + ']');
    },

    /**
     *
     */
    toggleBarGroupVisibility: function(barGroup, legendElement) {
        var staticMe = Koala.view.component.D3BarChartController;
        var CSS = staticMe.CSS_CLASS;
        var hideClsName = CSS.SHAPE_GROUP + CSS.SUFFIX_HIDDEN;
        var hideClsNameLegend = CSS.SHAPE_GROUP + CSS.SUFFIX_LEGEND + CSS.SUFFIX_HIDDEN;
        if (barGroup) {
            var isHidden = barGroup.classed(hideClsName);
            barGroup.classed(hideClsName, !isHidden);
            legendElement.classed(hideClsNameLegend, !isHidden);
        }
    }

});
