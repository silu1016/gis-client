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
            .down('[checked=true]').inputValue;
        var dataSourceLayer;

        switch (dataSourceType) {
            case 'selectionLayer':
                dataSourceLayer = view.getViewModel().get('selectedFeaturesLayer');
                break;
            case 'useLayer':
                dataSourceLayer = view.getSourceLayer();
                break;
        }

        Koala.util.Clone.cloneLayer(
            view.getSourceLayer(),
            name,
            maxFeatures,
            bbox,
            dataSourceLayer,
            uuid
        );
        view.close();
    }

});
