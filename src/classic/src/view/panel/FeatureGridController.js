/* Copyright (c) 2018-present terrestris GmbH & Co. KG
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
 * @class Koala.view.panel.FeatureGridController
 */
Ext.define('Koala.view.panel.FeatureGridController', {
    extend: 'Ext.app.ViewController',
    alias: 'controller.k-panel-featuregrid',

    require: [
        'Koala.util.WFST'
    ],

    onBeforeDestroy: function() {
        var view = this.getView();
        this.unregisterListeners();
        var map = BasiGX.util.Map.getMapComponent().map;
        if (view.originalLayer !== view.layer) {
            map.removeLayer(view.layer);
        }
    },

    /**
     * Disable the hover plugin when using some digitalisation tools,
     * as it interferes e.g. with selections
     *
     * @param {Ext.button.Button} btn The button that has been pressed
     */
    disableHover: function(btn) {
        var mapComponent = BasiGX.util.Map.getMapComponent();
        var hoverPlugin = mapComponent.getPlugin('hoverBfS');
        if (hoverPlugin) {
            if (btn.pressed) {
                hoverPlugin.getCmp().setPointerRest(false);
            } else {
                hoverPlugin.getCmp().setPointerRest(true);
            }
        }
    },

    /**
     * Handle click on delete button. This enables removal of features selected
     * in the grid/map if desired.
     * @param  {Ext.button.Button} btn the delete button
     */
    handleDelete: function(btn) {
        this.disableHover(btn);
        var viewModel = this.getViewModel();
        var source = this.getView().layer.getSource();
        var grid = this.getView().down('basigx-grid-featuregrid').down('grid');
        var selection = grid.getSelection();
        if (selection.length > 0) {
            var text = Ext.String.format(viewModel.get(
                'deleteMessage'), selection.length);
            Ext.Msg.confirm(viewModel.get('deleteTitle'), text, function(button) {
                if (button === 'yes') {
                    Ext.each(selection, function(rec) {
                        source.removeFeature(rec.olObject);
                    });
                }
            });
        }
    },

    /**
     * Issues a WFS-T LockFeature
     *
     * @param {Ext.button.Button} btn The button itself
     * @param {ol.layer} layer The layer the lock should be aquired for
     */
    getFeatureLock: function(btn, layer) {
        var me = this;
        if (layer.get('persisted') === false) {
            btn.setPressed(false);
            Ext.toast(this.getViewModel().get(
                'layerNotSavedYet'));
            return;
        }
        if (!Koala.util.WFST.lockAquired) {
            Koala.util.WFST.lockFeatures(layer).
                then(Koala.util.WFST.handleLockFeaturesResponse).
                then(function(msg) {
                    if (msg === 'Could not aquire an WFST-Lock') {
                        Ext.toast(me.getViewModel().get(
                            'wfstLockFail'));
                        btn.setPressed(false);
                        return;
                    } else {
                        var text = Ext.String.format(me.getViewModel().get(
                            'wfstLockSuccess'), Koala.util.WFST.lockTime);
                        Ext.toast(text);
                        btn.setPressed(true);

                        var task = new Ext.util.DelayedTask(function() {
                            if (Koala.util.WFST.lockAquired === false) {
                                // check if window has been closed already
                                if (me.getView()) {
                                    Ext.toast(me.getViewModel().get(
                                        'wfstLockExpired'));
                                    btn.setPressed(false);
                                }
                            }
                        });
                        task.delay(Koala.util.WFST.lockTime * 1000 * 60);
                    }
                }).
                otherwise(function() {
                    Ext.toast(me.getViewModel().get(
                        'wfstLockFail'));
                    btn.setPressed(false);
                });
        } else {
            btn.setPressed(true);
        }
    },

    /**
     * Populates the different arrays for WFS Transactions
     *
     * @param {Object} evt The event
     * @param{ol.layer} layer The layer containing the features
     */
    handleFeatureChanged: function(evt, layer) {
        // dont populate arrays when the layer is not persisted yet
        if (layer.get('persisted') === false) {
            return;
        }
        var type = evt.type;
        var feature = evt.feature;
        var featuregridWindow = this.getView();
        switch (type) {
            case 'removefeature':
                featuregridWindow.wfstDeletes = Ext.Array.merge(
                    featuregridWindow.wfstDeletes, [feature]);
                break;
            case 'addfeature':
                featuregridWindow.wfstInserts = Ext.Array.merge(
                    featuregridWindow.wfstInserts, [feature]);
                break;
            case 'changefeature':
                featuregridWindow.wfstUpdates = Ext.Array.merge(
                    featuregridWindow.wfstUpdates, [feature]);
                break;
            default:
                break;
        }
    },

    /**
     * Register listeners for WFS-T
     */
    registerListeners: function() {
        var me = this;
        var layer = me.getView().layer;
        layer.getSource().on('addfeature', this.onAddFeature = function(evt) {
            me.handleFeatureChanged(evt, layer);
        }, me);
        layer.getSource().on('changefeature', this.onChangeFeature = function(evt) {
            me.handleFeatureChanged(evt, layer);
        }, me);
        layer.getSource().on('removefeature', this.onRemoveFeature = function(evt) {
            me.handleFeatureChanged(evt, layer);
        }, me);
    },

    /**
     * Unregister listeners for WFS-T
     */
    unregisterListeners: function() {
        var me = this;
        var layer = me.getView().layer;
        layer.getSource().un('addfeature', this.onAddFeature, me);
        layer.getSource().un('changefeature', this.onChangeFeature, me);
        layer.getSource().un('removefeature', this.onRemoveFeature, me);
    },

    downloadLayer: function() {
        var map = BasiGX.util.Map.getMapComponent();
        var view = this.getView();
        var viewModel = view.getViewModel();
        var menu = Ext.create('Ext.menu.Menu', {
            items: [{
                text: viewModel.get('geoJsonText'),
                handler: function() {
                    BasiGX.util.Download.downloadLayer(view.layer, map.map, 'geojson');
                }
            }, {
                text: viewModel.get('shapefileText'),
                handler: function() {
                    BasiGX.util.Download.downloadLayer(view.layer, map.map, 'zip');
                }
            }]
        });
        var btn = view.down('#feature-grid-download-button');
        menu.showBy(btn);
    },

    /**
     * Returns a newly created store with the grid's current attributes.
     * @return {Ext.data.Store} the new store
     */
    getAttributeStore: function() {
        var grid = this.getView().down('basigx-grid-featuregrid');
        var cols = grid.extractSchema(this.getView().down('grid').getStore());
        return Ext.create('Ext.data.Store', {
            fields: ['text', 'dataIndex', 'editor'],
            data: cols
        });
    },

    /**
     * Opens a menu to quickly set an attribute in multiple rows to a new value.
     * @param  {Ext.button.Button} btn the button on which to open the menu
     */
    multiEdit: function(btn) {
        var grid = this.getView().down('basigx-grid-featuregrid').down('grid');
        var selection = grid.getSelection();
        var menu = Ext.create('Ext.menu.Menu', {
            items: [{
                xtype: 'panel',
                layout: 'hbox',
                padding: '5px',
                items: [{
                    xtype: 'combo',
                    store: this.getAttributeStore(),
                    displayField: 'text'
                }, {
                    xtype: 'label',
                    text: '=',
                    padding: '5px'
                }, {
                    xtype: 'textfield',
                    name: 'value-field'
                }, {
                    xtype: 'button',
                    glyph: 'xf00c@FontAwesome',
                    handler: function() {
                        var text = menu.down('[name=value-field]').getValue();
                        var attribute = menu.down('combo').getValue();
                        Ext.each(selection, function(rec) {
                            rec.set(attribute, text);
                        });
                        menu.close();
                    }
                }]
            }]
        });
        menu.showBy(btn);
    },

    /**
     * Toggles sorting selected rows on top.
     * @param  {Ext.button.Button} btn the button
     * @param  {boolean} toggled whether the button is currently toggled
     */
    sortSelected: function() {
        var grid = this.getView().down('grid');
        var sorters = grid.getStore().getSorters();
        sorters.insert(0, grid.getColumns()[1].getSorter());
        grid.scrollTo(0, 0, true);
    }

});
