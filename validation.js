const { URL } = require('url');

const isValidUrl = (str) => {
  try {
    new URL(str);
    return true;
  } catch (e) {
    return false;
  }
}

const isNotEmpty = (value) => {
  return typeof value === 'string' && value.length !== 0
};

const isNumber = (value) => {
  return value.length !== 0 && typeof +value === 'number' && Number.isInteger(+value);
}

module.exports = {
  isValidUrl,
  isNotEmpty,
  isNumber
}