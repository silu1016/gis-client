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
 * @class Koala.util.Date
 */
Ext.define('Koala.util.Date', {

    statics: {

        /**
         * The format string which we use at several places to format all local
         * dates so that they are understood by the serverside. Most of the
         * time, this will end up as aparameter to #Ext.Date.format. If you look
         * a th the possibly formats from tghe doc, you'll probably notice 'C',
         * which is new in Ext6, and probably dependent of `Date.toISOString`.
         *
         * If we use this, then the calculations with regard to adding and
         * subtracting of offsets are done by the browser. Since we can change
         * (via the button) if we are currently viewing utc dates or not, we
         * cannot use it. We want to handle the calculations ourself and only
         * a format string.
         *
         * @type {string} A format string, ready to be used with the
         *     method #Ext.Date.format.
         */
        ISO_FORMAT: 'Y-m-d\\TH:i:s.u\\Z',

        /**
         * The default (Moment) date format.
         *
         * @type {String}
         */
        DEFAULT_DATE_FORMAT: 'DD.MM.YYYY HH:mm:ss',

        /**
         * Server time is always UTC (and in ISO 8601 format)
         * Use moment in strict moment (this is also recommended
         * by the momentjs guys) by passing the format
         * moment.ISO_8601 YYYY-MM-DD HH:mm:ss
         *
         * Usage hint: Use this method if you have a server returned UTC
         *             datetime value (e.g. `2016-10-17T00:00:00Z` or
         *             1489167742783).
         *
         * @method getUtcMoment
         * @param {String|Number} dateValue The date value to parse.
         * @param {String} dateFormat [moment.ISO_8601] The moment date format
         *     to use for deserialization. Default is to moment.ISO_8601.
         * @return {moment} The moment object.
         */
        getUtcMoment: function(dateValue, dateFormat) {
            var momentDate;

            dateFormat = dateFormat || moment.ISO_8601;

            momentDate = moment.utc(
                dateValue,
                dateFormat,
                true
            );

            if (momentDate.isValid()) {
                return momentDate;
            } else {
                var warnMsg = Ext.String.format('The given defaulttimeinstant' +
                    ' {0} could not be parsed correctly. Please ensure the ' +
                    'date is defined in a valid ISO 8601 format.', dateValue);
                Ext.Logger.warn(warnMsg);
            }
        },

        /**
         * Creates an UTC moment object out of a moment object by adding
         * the local UTC time offset.
         *
         * @method addUtcOffset
         * @param {Moment} momentDate The moment to add the offset to.
         * @return {Moment} The adjusted moment.
         */
        addUtcOffset: function(momentDate) {
            if (!moment.isMoment(momentDate)) {
                Ext.Logger.warn('`momentDate` must be a Moment date object.');
                return;
            }

            var dateClone = momentDate.clone();

            dateClone.add(dateClone.utcOffset(), 'minutes').utc();

            return dateClone;
        },

        /**
         * Creates a local moment object out of a moment object by removing
         * the local UTC time offset.
         *
         * @method removeUtcOffset
         * @param {Moment} momentDate The moment to remove the offset from.
         * @return {Moment} The adjusted moment.
         */
        removeUtcOffset: function(momentDate) {
            if (!moment.isMoment(momentDate)) {
                Ext.Logger.warn('`momentDate` must be a Moment date object.');
                return;
            }

            var dateClone = momentDate.clone();

            dateClone.subtract(dateClone.local().utcOffset(), 'minutes').local();

            return dateClone;
        },

        /**
         * Serializes a moment date to the specified date format depending on
         * the current application's time reference (UTC or locale).
         *
         * @method getFormattedDate
         * @param {moment} momentDate The date to serialize.
         * @param {String} [Koala.util.Date.DEFAULT_DATE_FORMAT] dateFormat The
         *     moment format to use for serialization. See
         *     {@link https://momentjs.com/docs/#/displaying/format/|here}
         *     for a list of supported format identifiers. Default is to
         *     Koala.util.Date.DEFAULT_DATE_FORMAT.
         * @return {String} The serialized date.
         */
        getFormattedDate: function(momentDate, dateFormat, timeReferenceAware) {
            if (!moment.isMoment(momentDate)) {
                Ext.Logger.warn('`momentDate` must be a Moment date object.');
                return;
            }

            // The default should always the set to `true`.
            if (!(Ext.isDefined(timeReferenceAware))) {
                timeReferenceAware = true;
            }

            var dateClone = momentDate.clone();

            if (timeReferenceAware) {
                dateClone = Koala.util.Date
                    .getTimeReferenceAwareMomentDate(dateClone);
            }

            dateFormat = dateFormat || Koala.util.Date.DEFAULT_DATE_FORMAT;

            return dateClone.format(dateFormat);
        },

        /**
         * Returns a moment date object aware of the current application's
         * time reference.
         *
         * @method getTimeReferencedDate
         * @param {moment} momentDate The moment date to switch to utc/local.
         * @return {moment} The adjusted moment date.
         */
        getTimeReferenceAwareMomentDate: function(momentDate) {
            if (!moment.isMoment(momentDate)) {
                Ext.Logger.warn('`momentDate` must be a Moment date object.');
                return;
            }

            var dateClone = momentDate.clone();

            if (Koala.Application.isLocal()) {
                dateClone.local();
            } else {
                dateClone.utc();
            }

            return dateClone;
        }
    }

});
