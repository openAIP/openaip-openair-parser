const checkTypes = require('check-types');

/**
 * @param {number} meters
 * @return {number}
 * @private
 */
function metersToFeet(meters) {
    checkTypes.assert.number(meters);

    return meters * 3.28084;
}

/**
 * @param {number} feet
 * @return {number}
 * @private
 */
function feetToMeters(feet) {
    checkTypes.assert.number(feet);

    return feet / 3.28084;
}

module.exports = { metersToFeet, feetToMeters };
