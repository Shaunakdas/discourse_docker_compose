define("discourse/helpers/application", 
  ["discourse/lib/helpers","discourse/lib/formatter"],
  function(__dependency1__, __dependency2__) {
    "use strict";
    var registerUnbound = __dependency1__.registerUnbound;
    var longDate = __dependency2__.longDate;
    var autoUpdatingRelativeAge = __dependency2__.autoUpdatingRelativeAge;
    var number = __dependency2__.number;

    var safe = Handlebars.SafeString;

    registerUnbound('raw-date', function (dt) {
      return longDate(new Date(dt));
    });

    registerUnbound('age-with-tooltip', function (dt) {
      return new safe(autoUpdatingRelativeAge(new Date(dt), { title: true }));
    });

    registerUnbound('number', function (orig, params) {
      orig = parseInt(orig, 10);
      if (isNaN(orig)) {
        orig = 0;
      }

      var title = orig;
      if (params.numberKey) {
        title = I18n.t(params.numberKey, { number: orig });
      }

      var classNames = 'number';
      if (params['class']) {
        classNames += ' ' + params['class'];
      }

      var result = "<span class='" + classNames + "'";
      var addTitle = params.noTitle ? false : true;

      // Round off the thousands to one decimal place
      var n = number(orig);
      if (n.toString() !== title.toString() && addTitle) {
        result += " title='" + Handlebars.Utils.escapeExpression(title) + "'";
      }
      result += ">" + n + "</span>";

      return new safe(result);
    });
  });
