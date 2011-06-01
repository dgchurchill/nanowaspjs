/**
 * 
 */

var utils = utils || {};

utils.getBit = function (value, bit) {
    return (value >> bit) & 1;
};

utils.getBits = function (value, start, count) {
    return (value >> start) % (1 << count);
};

utils.clearBits = function (value, start, count) {
    return value & ~(((1 << count) - 1) << start);
};

utils.copyBits = function (old, start, count, value) {
    return utils.clearBits(old, start, count) | (utils.getBits(value, 0, count) << start);
};
