/* Copyright (c) 2017-present terrestris GmbH & Co. KG
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
 * @class Koala.view.window.CloneWindowController
 */
Ext.define('Koala.view.window.CloneWindowController', {
    extend: 'Ext.app.ViewController',
    alias: 'controller.k-window-clone',

    requires: [
    ],

    /**
     * Handle a click on the cancel button. Just closes the window.
     */
    cancelHandler: function() {
        this.getView().close();
        Ext.ComponentQuery.query('k-button-selectfeatures')[0].setPressed(false);
    },

    /**
     * Commence cloning action, then close the window.
     */
    cloneHandler: function() {
        var view = this.getView();
        var viewModel = view.getViewModel();
        var name = view.down('textfield').getValue();
        var maxFeatures = view.down('numberfield').getValue();
        var useBbox = view.down('checkbox').getValue();
        var templateCombo = view.down('k-form-field-vectortemplatecombo');
        var uuid = templateCombo.getViewModel().get('templateUuid');
        if (!uuid) {
            Ext.Msg.alert(viewModel.get('emptyTemplateMessage'));
            return;
        }
        var bbox;
        if (useBbox) {
            var map = BasiGX.util.Map.getMapComponent().map;
            bbox = map.getView().calculateExtent(map.getSize());
        }

        var dataSourceType = view.down('[name=datasource-radios]')
            .down('radio[checked=true]').inputValue;
        var copyStyle = view.down('[name=copystyle]').getValue();
        copyStyle = copyStyle && dataSourceType === 'useLayer';
        var dataSourceLayer;

        switch (dataSourceType) {
            case 'selectionLayer':
                dataSourceLayer = view.getViewModel().get('selectedFeaturesLayer');
                break;
            case 'useLayer':
                dataSourceLayer = view.getSourceLayer();
                if (!dataSourceLayer) {
                    var legend = Ext.ComponentQuery.query('k-panel-routing-legendtree')[0];
                    var selection = legend.getSelection();
                    dataSourceLayer = selection[0] ? selection[0].data : null;
                    if (!dataSourceLayer) {
                        Ext.Msg.alert(viewModel.get('noLayerSelected'));
                        return;
                    }
                    if (!dataSourceLayer.get('allowClone')) {
                        Ext.Msg.alert(viewModel.get('noCloneAllowed'));
                        return;
                    }
                }
                break;
        }

        Koala.util.Clone.cloneLayer(
            view.getSourceLayer() || dataSourceLayer,
            name,
            maxFeatures,
            bbox,
            dataSourceLayer,
            uuid,
            copyStyle,
            viewModel.get('selectedTemplateStyle')
        )
            .then(function() {
                view.close();
                Ext.ComponentQuery.query('k-button-selectfeatures')[0].setPressed(false);
            });
    },

    /**
     * Handles activation of the selection tool in case the 'from selection'
     * radio is pressed.
     * @param  {Ext.form.field.Radio} radio the radio button
     * @param  {Boolean} on true, if the radio is checked
     */
    handleDatasourceChange: function(radio, on) {
        if (radio.inputValue !== 'useLayer' && on) {
            this.getViewModel().set('noLayerSelected', true);
        } else if (on) {
            this.getViewModel().set('noLayerSelected', false);
        }
        if (radio.inputValue === 'selectionLayer' && on) {
            Ext.ComponentQuery.query('k-button-selectfeatures')[0].setPressed(true);
            this.getView().down('[name=selection-enabled]').setHidden(false);
        } else if (on) {
            this.getView().down('[name=selection-enabled]').setHidden(true);
        }
    },

    /**
     * Reloads the configured 'styleReference' from the selecte vectorTemplate.
     */
    onVectorTemplateChange: function(field, value) {
        var viewModel = this.getViewModel();
        Koala.util.Layer.getMetadataFromUuid(value).then(function(metadata) {
            var styles = Koala.util.Object.getPathStrOr(metadata,
                'layerConfig/olProperties/styleReference');
            if (styles) {
                styles = styles.split(',')
                    .map(function(style) {
                        return style.trim();
                    });
                viewModel.set('templateStyles', styles);
                viewModel.set('selectedTemplateStyle', styles[0]);
            } else {
                viewModel.set('templateStyles', []);
                viewModel.set('selectedTemplateStyle', undefined);
            }
        });
    }

});
