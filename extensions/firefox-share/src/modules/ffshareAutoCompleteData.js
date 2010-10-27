
let EXPORTED_SYMBOLS = ["ffshareAutoCompleteData"];

let data = [];

let ffshareAutoCompleteData = {
  get: function () {
    return data;
  },
  set: function (newData) {
    data = (newData || []);
  }
};
