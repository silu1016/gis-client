/*global window*/
/* Copyright (c) 2015 terrestris GmbH & Co. KG
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
 * @class Koala.view.panel.RoutingLegendTree
 */
Ext.define("Koala.view.panel.RoutingLegendTree", {
    extend: "BasiGX.view.panel.LegendTree",
    xtype: "k-panel-routing-legendtree",

    requires: [
        "Koala.util.Layer",

        "Koala.view.panel.RoutingLegendTreeController",
        "Koala.view.panel.RoutingLegendTreeModel"
    ],

    controller: "k-panel-routing-legendtree",

    viewModel: {
        type: "k-panel-routing-legendtree"
    },

    config: {
        routingEnabled: false
    },

    hasRoutingListeners: false,

    listeners: {
        selectionchange: 'onSelectionChange',
        beforerender: 'bindUtcBtnToggleHandler',
        beforedestroy: 'unbindUtcBtnToggleHandler'
    },

    statics: {
        findByProp: function(arr, key, val){
            var item = null;
            Ext.each(arr, function(obj){
                if (obj[key] && obj[key] === val) {
                    item = obj;
                    return false; // stop early
                }
            });
            return item;
        },

        reorganizeMenu: function(comp){
            var olLayer = comp.layerRec.getOlLayer();

            var allowShortInfo = olLayer.get('allowShortInfo') || false;
            var allowDownload = olLayer.get('allowDownload') || false;
            var allowRemoval = olLayer.get('allowRemoval') || false;
            var allowOpacityChange = olLayer.get('allowOpacityChange') || false;
            var hasLegend = olLayer.get('hasLegend') || false;

            var shortInfoBtn = comp.down('button[name="shortInfo"]');
            var downloadBtn = comp.down('button[name="download"]');
            var removalBtn = comp.down('button[name="removal"]');
            var opacitySlider = comp.down('slider[name="opacityChange"]');
            var legend = comp.up().down('image[name="legend"]');

            if(shortInfoBtn){
                shortInfoBtn.setVisible(allowShortInfo);
            }
            if(downloadBtn){
                downloadBtn.setVisible(allowDownload);
            }
            if(removalBtn){
                removalBtn.setVisible(allowRemoval);
            }
            if(opacitySlider){
                opacitySlider.setVisible(allowOpacityChange);
            }
            if(legend){
                legend.setVisible(hasLegend);
            }
        },

        getFilterText: function(record){
            var layer = record.getOlLayer();
            var LayerUtil = Koala.util.Layer;

            if (!layer || !layer.metadata){
                return '';
            }
            return LayerUtil.getFiltersTextFromMetadata(layer.metadata);
        },

        shortInfoHandler: function(btn){
            var record = btn.layerRec;
            var layer = record.getOlLayer();
            var text = layer.get('name') + '<br>';

            if(Ext.isDefined(layer.metadata.filter)){
                var filtertext = Koala.view.panel.RoutingLegendTree
                    .getFilterText(record);
                text = filtertext;
            }
            Ext.toast(text, layer.get('name'));
        },

        removalHandler: function(btn){
            var layer = btn.layerRec.getOlLayer();
            var map = Ext.ComponentQuery.query('basigx-component-map')[0]
                .getMap();

            Ext.Msg.show({
                title: 'Info',
                message: 'Layer <b>' + layer.get('name') +
                    '</b> aus Karte entfernen?',
                buttonText: {
                    yes: "Ja",
                    no: "Nein"
                },
                fn: function(btnId){
                    if(btnId === "yes"){
                        map.removeLayer(layer);
                    }
                }
            });
        },

        downloadHandler: function(btn){
            var layer = btn.layerRec.getOlLayer();

            Ext.Msg.show({
                title: 'Info',
                message: 'Daten zu <b>' + layer.get('name') +
                    '</b> runterladen?',
                buttonText: {
                    yes: "Ja",
                    no: "Nein"
                },
                fn: function(btnId){
                    if(btnId === "yes"){
                        var url = Koala.util.Layer.getDownloadUrlWithFilter(
                                layer
                            );
                        window.open(url, '_blank');
                    }
                }
            });
        },

        sliderChangeHandler: function(slider, newValue){
            var layer = slider.layerRec.getOlLayer();
            layer.setOpacity(newValue / 100);
        },

        initializeOpacityVal: function(slider){
            var layer = slider.layerRec.getOlLayer();
            slider.setValue(layer.getOpacity() * 100);
        }
    },

    rowBodyCompTemplate: {
        xtype: 'container',
        name: 'legend-tree-row-component',
        scrollable: true,
        items: [ {
            xtype: 'container',
            layout: 'hbox',
            defaults: {
                margin: '0 5px 0 0'
            },
            listeners: {
                // We'll assign a handler to reorganize the menu once the
                // class is defined.
            },
            items: [{
                xtype: 'button',
                name: 'shortInfo',
                glyph: 'xf05a@FontAwesome',
                tooltip: 'Layerinformationen anzeigen'
                // We'll assign a handler to handle clicks here once the
                // class is defined and we can access the static methods
            }, {
                xtype: 'button',
                name: 'download',
                glyph: 'xf0c7@FontAwesome',
                tooltip: 'Daten speichern'
                // We'll assign a handler to handle clicks here once the
                // class is defined and we can access the static methods
            }, {
                xtype: 'button',
                name: 'removal',
                glyph: 'xf00d@FontAwesome',
                tooltip: 'Layer entfernen'
                // We'll assign a handler to handle clicks here once the
                // class is defined and we can access the static methods
            }, {
                xtype: 'slider',
                name: 'opacityChange',
                width: 100,
                value: 100,
                tipText: function(thumb){
                    return String(thumb.value) + '% Sichtbarkeit';
                },
                listeners: {
                    // We'll assign a handler to initialize and handle drags
                    // here once the class is defined and we can access the
                    // static methods
                }
            }]
        },
        {
            xtype: 'component',
            name: 'filtertext',
            layout: 'hbox',
            defaults: {
                margin: '0 5px 0 0'
            },
            html: '{{Koala.view.panel.RoutingLegendTree.getFilterText(record)}}'
        },
        {
            xtype: 'image',
            name: '{{record.getOlLayer().get("routeId") + "-legendImg"}}',
            margin: '5px 0 0 0',
            src: '{{' +
                'Koala.util.Layer.getCurrentLegendUrl(record.getOlLayer())' +
                '}}',
            width: '{{record.getOlLayer().get("legendWidth")}}',
            height: '{{record.getOlLayer().get("legendHeight")}}',
            alt: '{{"Legende " + record.getOlLayer().get("name")}}'
        }]
    },

    /**
     * Initialize the component.
     */
    initComponent: function() {
        var me = this;

        // call parent
        me.callParent();

        // See the comment above the constructor why we need this.
        if (me.initiallyCollapsed){
            me.on('afterlayout', function(){
                this.collapse();
            }, me, {single: true, delay: 100});
            me.initiallyCollapsed = null;
        }

        // configure rowexpanderwithcomponents-plugin
        me.plugins[0].hideExpandColumn = false;

        // Register moveend to update legendUrls
        var map = Ext.ComponentQuery.query('gx_map')[0].getMap();
        map.on('moveend', me.updateLegendsWithScale, me);
    },

    updateLegendsWithScale: function () {
        var store = this.getStore();
        store.each(function (rec) {
            var layer = rec.getOlLayer();
            var selector = '[name=' + layer.get("routeId") + '-legendImg]';
            var img = Ext.ComponentQuery.query(selector)[0];

            if (img) {
                img.setSrc(Koala.util.Layer.getCurrentLegendUrl(layer));
            }
        });
    },

    applyRoutingEnabled: function(newVal){
        var me = this;
        var controller = me.getController();
        var store = me.getStore();

        if (newVal && !me.hasRoutingListeners) {
            store.on('update', controller.setRouting, controller);
            store.on('datachange', controller.setRouting, controller);
            // controller.setRouting.call(controller, store);
            me.hasRoutingListeners = true;
        } else if (me.hasRoutingListeners){
            store.un('update', controller.setRouting, controller);
            store.un('datachange', controller.setRouting, controller);
            me.hasRoutingListeners = false;
        }
        return newVal;
    }

}, function(cls) {
    // bind the various handlers now that we have access to the static methods
    var layerMenuCfg = cls.prototype.rowBodyCompTemplate.items[0];
    var menuItems = layerMenuCfg.items;

    var infoBtnCfg = cls.findByProp(menuItems, 'name', 'shortInfo');
    var downloadBtnCfg = cls.findByProp(menuItems, 'name', 'download');
    var removalBtnCfg = cls.findByProp(menuItems, 'name', 'removal');
    var opacitySliderCfg = cls.findByProp(menuItems, 'name', 'opacityChange');

    if (layerMenuCfg) {
        layerMenuCfg.listeners.beforerender = cls.reorganizeMenu;
    }
    if (infoBtnCfg) {
        infoBtnCfg.handler = cls.shortInfoHandler;
    }
    if (downloadBtnCfg) {
        downloadBtnCfg.handler = cls.downloadHandler;
    }
    if (removalBtnCfg) {
        removalBtnCfg.handler = cls.removalHandler;
    }
    if (opacitySliderCfg) {
        opacitySliderCfg.listeners.change = cls.sliderChangeHandler;
        opacitySliderCfg.listeners.afterrender = cls.initializeOpacityVal;
    }

});
