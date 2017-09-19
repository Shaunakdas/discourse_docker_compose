/*global I18n:true */

// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (searchElement, fromIndex) {
    if ( this === undefined || this === null ) {
      throw new TypeError( '"this" is null or not defined' );
    }

    var length = this.length >>> 0; // Hack to convert object.length to a UInt32

    fromIndex = +fromIndex || 0;

    if (Math.abs(fromIndex) === Infinity) {
      fromIndex = 0;
    }

    if (fromIndex < 0) {
      fromIndex += length;
      if (fromIndex < 0) {
        fromIndex = 0;
      }
    }

    for (;fromIndex < length; fromIndex++) {
      if (this[fromIndex] === searchElement) {
        return fromIndex;
      }
    }

    return -1;
  };
}

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default handling of translation fallbacks to false
I18n.fallbacks = false;

// Set default separator
I18n.defaultSeparator = ".";

// Set current locale to null
I18n.locale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.fallbackRules = {};

I18n.noFallbacks = false;

I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  },
  "zh_CN": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  },
  "zh_TW": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  },
  "ko": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  }
};

I18n.getFallbacks = function(locale) {
  if (locale === I18n.defaultLocale) {
    return [];
  } else if (!I18n.fallbackRules[locale]) {
    var rules = [],
        components = locale.split("-");

    for (var l = 1; l < components.length; l++) {
      rules.push(components.slice(0, l).join("-"));
    }

    rules.push(I18n.defaultLocale);

    I18n.fallbackRules[locale] = rules;
  }

  return I18n.fallbackRules[locale];
};

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};
  var lookupInitialScope = scope,
      translations = this.prepareOptions(I18n.translations),
      locale = options.locale || I18n.currentLocale(),
      messages = translations[locale] || {},
      currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.defaultSeparator);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.defaultSeparator + scope;
  }

  scope = scope.split(this.defaultSeparator);

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (!messages) {
    if (I18n.fallbacks) {
      var fallbacks = this.getFallbacks(locale);
      for (var fallback = 0; fallback < fallbacks.length; fallbacks++) {
        messages = I18n.lookup(lookupInitialScope, this.prepareOptions({locale: fallbacks[fallback]}, options));
        if (messages) {
          break;
        }
      }
    }

    if (!messages && this.isValidNode(options, "defaultValue")) {
        messages = options.defaultValue;
    }
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
      opts,
      count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);
  var matches = message.match(this.PLACEHOLDER),
      placeholder,
      value,
      name;

  if (!matches) {
    return message;
  }

  for (var i = 0; placeholder = matches[i]; i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    value = options[name];

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}"));
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  var translation = this.lookup(scope, options);
  // Fallback to the default locale
  if (!translation && this.currentLocale() !== this.defaultLocale && !this.noFallbacks) {
    options.locale = this.defaultLocale;
    translation = this.lookup(scope, options);
  }
  if (!translation && this.currentLocale() !== 'en' && !this.noFallbacks) {
    options.locale = 'en';
    translation = this.lookup(scope, options);
  }

  try {
    if (typeof translation === "object") {
      if (typeof options.count === "number") {
        return this.pluralize(options.count, scope, options);
      } else {
        return translation;
      }
    } else {
      return this.interpolate(translation, options);
    }
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.localize = function(scope, value) {
  switch (scope) {
    case "currency":
      return this.toCurrency(value);
    case "number":
      scope = this.lookup("number.format");
      return this.toNumber(value, scope);
    case "percentage":
      return this.toPercentage(value);
    default:
      if (scope.match(/^(date|time)/)) {
        return this.toTime(scope, value);
      } else {
        return value.toString();
      }
  }
};

I18n.parseDate = function(date) {
  var matches, convertedDate;

  // we have a date, so just return it.
  if (typeof date === "object") {
    return date;
  }

  // it matches the following formats:
  //   yyyy-mm-dd
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ssZ
  //   yyyy-mm-dd[ T]hh:mm::ss+0000
  //
  matches = date.toString().match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?(Z|\+0000)?/);

  if (matches) {
    for (var i = 1; i <= 6; i++) {
      matches[i] = parseInt(matches[i], 10) || 0;
    }

    // month starts on 0
    matches[2] -= 1;

    if (matches[7]) {
      convertedDate = new Date(Date.UTC(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]));
    } else {
      convertedDate = new Date(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]);
    }
  } else if (typeof date === "number") {
    // UNIX timestamp
    convertedDate = new Date();
    convertedDate.setTime(date);
  } else if (date.match(/\d+ \d+:\d+:\d+ [+-]\d+ \d+/)) {
    // a valid javascript format with timezone info
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  } else {
    // an arbitrary javascript string
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  }

  return convertedDate;
};

I18n.toTime = function(scope, d) {
  var date = this.parseDate(d),
      format = this.lookup(scope);

  if (date.toString().match(/invalid/i)) {
    return date.toString();
  }

  if (!format) {
    return date.toString();
  }

  return this.strftime(date, format);
};

I18n.strftime = function(date, format) {
  var options = this.lookup("date");

  if (!options) {
    return date.toString();
  }

  options.meridian = options.meridian || ["AM", "PM"];

  var weekDay = date.getDay(),
      day = date.getDate(),
      year = date.getFullYear(),
      month = date.getMonth() + 1,
      hour = date.getHours(),
      hour12 = hour,
      meridian = hour > 11 ? 1 : 0,
      secs = date.getSeconds(),
      mins = date.getMinutes(),
      offset = date.getTimezoneOffset(),
      absOffsetHours = Math.floor(Math.abs(offset / 60)),
      absOffsetMinutes = Math.abs(offset) - (absOffsetHours * 60),
      timezoneoffset = (offset > 0 ? "-" : "+") + (absOffsetHours.toString().length < 2 ? "0" + absOffsetHours : absOffsetHours) + (absOffsetMinutes.toString().length < 2 ? "0" + absOffsetMinutes : absOffsetMinutes);

  if (hour12 > 12) {
    hour12 = hour12 - 12;
  } else if (hour12 === 0) {
    hour12 = 12;
  }

  var padding = function(n) {
    var s = "0" + n.toString();
    return s.substr(s.length - 2);
  };

  var f = format;
  f = f.replace("%a", options.abbr_day_names[weekDay]);
  f = f.replace("%A", options.day_names[weekDay]);
  f = f.replace("%b", options.abbr_month_names[month]);
  f = f.replace("%B", options.month_names[month]);
  f = f.replace("%d", padding(day));
  f = f.replace("%e", day);
  f = f.replace("%-d", day);
  f = f.replace("%H", padding(hour));
  f = f.replace("%-H", hour);
  f = f.replace("%I", padding(hour12));
  f = f.replace("%-I", hour12);
  f = f.replace("%m", padding(month));
  f = f.replace("%-m", month);
  f = f.replace("%M", padding(mins));
  f = f.replace("%-M", mins);
  f = f.replace("%p", options.meridian[meridian]);
  f = f.replace("%S", padding(secs));
  f = f.replace("%-S", secs);
  f = f.replace("%w", weekDay);
  f = f.replace("%y", padding(year));
  f = f.replace("%-y", padding(year).replace(/^0+/, ""));
  f = f.replace("%Y", year);
  f = f.replace("%z", timezoneoffset);

  return f;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ",", strip_insignificant_zeros: false}
  );

  var negative = number < 0,
      string = Math.abs(number).toFixed(options.precision).toString(),
      parts = string.split("."),
      precision,
      buffer = [],
      formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length -3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
        separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
        zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "")
    ;
  }

  return formattedNumber;
};

I18n.toCurrency = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.currency.format"),
    this.lookup("number.format"),
    {unit: "$", precision: 2, format: "%u%n", delimiter: ",", separator: "."}
  );

  number = this.toNumber(number, options);
  number = options.format
    .replace("%u", options.unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
      size = number,
      iterations = 0,
      unit,
      precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", {count: size});
    precision = 0;
  } else {
    unit = this.t("number.human.storage_units.units." + [null, "kb", "mb", "gb", "tb"][iterations]);
    precision = (size - Math.floor(size) === 0) ? 0 : 1;
  }

  options = this.prepareOptions(
    options,
    {precision: precision, format: "%n%u", delimiter: ""}
  );

  number = this.toNumber(size, options);
  number = options.format
    .replace("%u", unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toPercentage = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.percentage.format"),
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ""}
  );

  number = this.toNumber(number, options);
  return number + "%";
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(count, scope, options) {
  var translation;

  try { translation = this.lookup(scope, options); } catch (error) {}
  if (!translation) { return this.missingTranslation(scope); }

  options = this.prepareOptions(options);
  options.count = count.toString();

  var pluralizer = this.pluralizer(this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = ((typeof key === "object") && (key instanceof Array)) ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);
  if (message == null) message = this.missingTranslation(scope, keys[0]);

  return this.interpolate(message, options);
};

I18n.missingTranslation = function(scope, key) {
  var message = '[' + this.currentLocale() + "." + scope;
  if (key) { message += "." + key; }
  return message + ']';
};

I18n.currentLocale = function() {
  return (I18n.locale || I18n.defaultLocale);
};

// shortcuts
I18n.t = I18n.translate;
I18n.l = I18n.localize;
I18n.p = I18n.pluralize;

I18n.enable_verbose_localization = function(){
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value){
    var current = keys[scope];
    if(!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      Em.Logger.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (t" + current + ")";
  };
};


I18n.verbose_localization_session = function(){
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enable_verbose_localization();
  return true;
}

try {
  if(sessionStorage && sessionStorage.getItem("verbose_localization")) {
    I18n.enable_verbose_localization();
  }
} catch(e){
  // we don't care really, can happen if cookies disabled
}
;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
r += "У вас осталось ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='/unread'>1 непрочитанная</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " непрочитанных</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ru"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "и ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 новая</a> тема";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "и ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " новых</a> тем";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ru"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ", или ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "посмотрите другие темы в разделе ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "В этой теме ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 сообщение";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " сообщений";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ru"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "с высоким рейтингом симпатий";
return r;
},
"med" : function(d){
var r = "";
r += "с очень высоким рейтингом симпатий";
return r;
},
"high" : function(d){
var r = "";
r += "с чрезвычайно высоким рейтингом симпатий";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}};

MessageFormat.locale.ru = function (n) {
  var r10 = n % 10, r100 = n % 100;

  if (r10 == 1 && r100 != 11)
    return 'one';

  if (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14) && n == Math.floor(n))
    return 'few';

  return 'other';
};


(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();
I18n.translations = {"ru":{"js":{"number":{"format":{"separator":",","delimiter":" "},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Байт","few":"Байта","many":"Байт","other":"Байт"},"gb":"ГБ","kb":"КБ","mb":"МБ","tb":"ТБ"}}},"short":{"thousands":"{{number}} тыс.","millions":"{{number}} млн."}},"dates":{"time":"HH:mm","timeline_date":"MMM YYYY","long_no_year":"D MMM HH:mm","long_no_year_no_time":"D MMM","full_no_year_no_time":"D MMM","long_with_year":"D MMM YYYY, HH:mm","long_with_year_no_time":"D MMM, YYYY","full_with_year_no_time":"LL","long_date_with_year":"D MMM YY, LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM YYYY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM YYYY \u003cbr/\u003eLT","wrap_ago":"%{date} назад","tiny":{"half_a_minute":"\u003c 1мин","less_than_x_seconds":{"one":"\u003c 1сек","few":"\u003c %{count}сек","many":"\u003c %{count}сек","other":"\u003c %{count}сек"},"x_seconds":{"one":"1с","few":"%{count}с","many":"%{count}с","other":"%{count}с"},"x_minutes":{"one":"1мин","few":"%{count}мин","many":"%{count}мин","other":"%{count}мин"},"about_x_hours":{"one":"1ч","few":"%{count}ч","many":"%{count}ч","other":"%{count}ч"},"x_days":{"one":"1д","few":"%{count}д","many":"%{count}д","other":"%{count}д"},"about_x_years":{"one":"1год","few":"%{count}года","many":"%{count}лет","other":"%{count}лет"},"over_x_years":{"one":"\u003e 1 года","few":"\u003e %{count} лет","many":"\u003e %{count} лет","other":"\u003e %{count} лет"},"almost_x_years":{"one":"1 год","few":"%{count} года","many":"%{count} лет","other":"%{count} лет"},"date_month":"D MMM","date_year":"MMM YYYY"},"medium":{"x_minutes":{"one":"1 минута","few":"%{count} минуты","many":"%{count} минут","other":"%{count} минут"},"x_hours":{"one":"1 час","few":"%{count} часа","many":"%{count} часов","other":"%{count} часов"},"x_days":{"one":"1 день","few":"%{count} дня","many":"%{count} дней","other":"%{count} дней"},"date_year":"D MMM, YYYY"},"medium_with_ago":{"x_minutes":{"one":"1 минуту назад","few":"%{count} минуты назад","many":"%{count} минут назад","other":"%{count} минут назад"},"x_hours":{"one":"1 час назад","few":"%{count} часа назад","many":"%{count} часов назад","other":"%{count} часов назад"},"x_days":{"one":"1 день назад","few":"%{count} дня назад","many":"%{count} дней назад","other":"%{count} дней назад"}},"later":{"x_days":{"one":"1 день спустя","few":"%{count} дня спустя","many":"%{count} дней спустя","other":"%{count} дней спустя"},"x_months":{"one":"1 месяц спустя","few":"%{count} месяца спустя","many":"%{count} месяцев спустя","other":"%{count} месяцев спустя"},"x_years":{"one":"1 год спустя","few":"%{count} года спустя","many":"%{count} лет спустя","other":"%{count} лет спустя"}},"previous_month":"Предыдущий месяц","next_month":"Следующий месяц"},"share":{"topic":"Поделиться ссылкой на эту тему","post":"Ссылка на сообщение №%{postNumber}","close":"Закрыть","twitter":"Поделиться ссылкой через Twitter","facebook":"Поделиться ссылкой через Facebook","google+":"Поделиться ссылкой через Google+","email":"Поделиться ссылкой по электронной почте"},"action_codes":{"public_topic":"Сделал эту тему публичной %{when}","private_topic":"Сделал эту тему приватной %{when}","split_topic":"Разделил эту тему %{when}","invited_user":"Пригласил %{who} %{when}","invited_group":"Пригласил %{who} %{when}","removed_user":"Исключил %{who} %{when}","removed_group":"Исключил %{who} %{when}","autoclosed":{"enabled":"Закрыл тему %{when}","disabled":"Открыл тему %{when}"},"closed":{"enabled":"Закрыл тему %{when}","disabled":"Открыл тему %{when}"},"archived":{"enabled":"Заархивировал тему %{when}","disabled":"Разархивировал тему %{when}"},"pinned":{"enabled":"Закрепил тему %{when}","disabled":"Открепил тему %{when}"},"pinned_globally":{"enabled":"Закрепил тему глобально %{when}","disabled":"Открепил тему глобально %{when}"},"visible":{"enabled":"Включил в списки %{when}","disabled":"Исключил из списков %{when}"}},"topic_admin_menu":"действия администратора над темой","emails_are_disabled":"Все исходящие письма были глобально отключены администратором. Уведомления любого вида не будут отправляться на почту.","bootstrap_mode_enabled":"Чтобы облегчить развитие вашего нового сайта в самом начале, был включен режим запуска. В этом режиме, всем новым пользователям будет автоматически присвоен 1й уровень доверия при регистрации и включена ежедневная почтовая рассылка сводки новостей. Режим запуска будет выключен автоматически, как только количество зарегистрированных пользователей достигнет %{min_users}.","bootstrap_mode_disabled":"Режим запуска будет отключен в течение 24 часов.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)","cn_north_1":"China (Beijing)"}},"edit":"отредактировать название и раздел темы","not_implemented":"Извините, эта функция еще не реализована!","no_value":"Нет","yes_value":"Да","generic_error":"Извините, произошла ошибка.","generic_error_with_reason":"Произошла ошибка: %{error}","sign_up":"Зарегистрироваться","log_in":"Войти","age":"Возраст","joined":"Зарегистрировался","admin_title":"Админка","flags_title":"Жалобы","show_more":"показать дальше","show_help":"Cправка","links":"Ссылки","links_lowercase":{"one":"ссылка","few":"ссылки","other":"ссылок"},"faq":"Вопрос-ответ","guidelines":"Руководство","privacy_policy":"Политика конфиденциальности","privacy":"Политика конфиденциальности","terms_of_service":"Условия предоставления услуг","mobile_view":"Для мобильных устройств","desktop_view":"Для настольных устройств","you":"Вы","or":"или","now":"только что","read_more":"читать дальше","more":"Больше","less":"Меньше","never":"никогда","every_30_minutes":"каждые 30 минут","every_hour":"каждый час","daily":"ежедневно","weekly":"еженедельно","every_two_weeks":"каждые две недели","every_three_days":"каждые 3 дня","max_of_count":"{{count}} макс.","alternation":"или","character_count":{"one":"{{count}} буква","few":"{{count}} буквы","many":"{{count}} букв","other":"{{count}} букв"},"suggested_topics":{"title":"Похожие темы","pm_title":"Похожие сообщения"},"about":{"simple_title":"Информация","title":"Информация про %{title}","stats":"Статистика сайта","our_admins":"Наши администраторы","our_moderators":"Наши модераторы","stat":{"all_time":"За все время","last_7_days":"Последние 7 дней","last_30_days":"Последние 30 дней"},"like_count":"Симпатии","topic_count":"Темы","post_count":"Сообщения","user_count":"Новые пользователи","active_user_count":"Активные пользователи","contact":"Контакты","contact_info":"В случае возникновения критической ошибки или срочного дела, касающегося этого сайта, свяжитесь с нами по адресу %{contact_info}."},"bookmarked":{"title":"Избранное","clear_bookmarks":"Очистить закладки","help":{"bookmark":"Нажмите, чтобы добавить в закладки первое сообщение этой темы","unbookmark":"Нажмите, чтобы удалить все закладки в этой теме"}},"bookmarks":{"not_logged_in":"пожалуйста, войдите, чтобы добавлять сообщения в закладки","created":"вы добавили это сообщение в закладки","not_bookmarked":"вы прочитали это сообщение; нажмите, чтобы добавить его в закладки","last_read":"это последнее прочитанное вами сообщение; нажмите, чтобы добавить его в закладки","remove":"Удалить закладку","confirm_clear":"Вы уверены, что хотите удалить все эти темы из Избранного?"},"topic_count_latest":{"one":"1 новая или обновленная тема.","few":"{{count}} новые или обновленные темы.","many":"{{count}} новых или обновленных тем.","other":"{{count}} новых или обновленных тем."},"topic_count_unread":{"one":"1 непрочитанная тема.","few":"{{count}} непрочитанные темы.","many":"{{count}} непрочитанных тем.","other":"{{count}} непрочитанных тем."},"topic_count_new":{"one":"1 новая тема.","few":"{{count}} новые темы.","many":"{{count}} новых тем.","other":"{{count}} новых тем."},"click_to_show":"Показать.","preview":"предпросмотр","cancel":"отмена","save":"Сохранить","saving":"Сохранение...","saved":"Сохранено!","upload":"Загрузить","uploading":"Загрузка...","uploading_filename":"Загрузка файла {{filename}}...","uploaded":"Загружено!","enable":"Включить","disable":"Отключить","undo":"Отменить","revert":"Вернуть","failed":"Проблема","switch_to_anon":"Войти в Анонимный режим","switch_from_anon":"Выйти из Анонимного режима","banner":{"close":"Больше не показывать это объявление.","edit":"Редактировать это объявление \u003e\u003e"},"choose_topic":{"none_found":"Не найдено ни одной темы.","title":{"search":"Искать тему по названию, ссылке или уникальному номеру:","placeholder":"введите название темы здесь"}},"queue":{"topic":"Тема:","approve":"Одобрить","reject":"Отклонить","delete_user":"Удалить пользователя","title":"Требуют одобрения","none":"Нет сообщений для проверки","edit":"Изменить","cancel":"Отменить","view_pending":"Просмотреть сообщения в очереди","has_pending_posts":{"one":"В этой теме \u003cb\u003e1\u003c/b\u003e сообщение, ожидающее проверки","few":"В этой теме \u003cb\u003e{{count}}\u003c/b\u003e сообщения, ожидающих проверки","many":"В этой теме \u003cb\u003e{{count}}\u003c/b\u003e сообщений, ожидающих проверки","other":"В этой теме \u003cb\u003e{{count}}\u003c/b\u003e сообщений, ожидающих проверки"},"confirm":"Сохранить","delete_prompt":"Вы уверены, что хотите удалить \u003cb\u003e%{username}\u003c/b\u003e? Это также удалит все его сообщения и заблокирует его email и IP-адрес.","approval":{"title":"Сообщения для проверки","description":"Ваше сообщение отправлено, но требует проверки и утверждения модератором. Пожалуйста, будьте терпеливы.","pending_posts":{"one":"\u003cstrong\u003e{{count}}\u003c/strong\u003e сообщение ожидает одобрения.","few":"\u003cstrong\u003e{{count}}\u003c/strong\u003e сообщений ожидают одобрения.","many":"\u003cstrong\u003e{{count}}\u003c/strong\u003e сообщений ожидают одобрения.","other":"\u003cstrong\u003e{{count}}\u003c/strong\u003e сообщений ожидают одобрения."},"ok":"ОК"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e создал \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eВы\u003c/a\u003e создали \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ответил(а) на сообщение \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eВы\u003c/a\u003e ответили на сообщение \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ответил(а) в \u003ca href='{{topicUrl}}'\u003eтеме\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eВы\u003c/a\u003e ответили в \u003ca href='{{topicUrl}}'\u003eтеме\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e упомянул \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e упомянул\u003ca href='{{user2Url}}'\u003eВас\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eВы\u003c/a\u003e упомянули \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Размещено пользователем \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Размещено \u003ca href='{{userUrl}}'\u003eВами\u003c/a\u003e","sent_by_user":"Отправлено пользователем \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Отправлено \u003ca href='{{userUrl}}'\u003eВами\u003c/a\u003e"},"directory":{"filter_name":"фильтр по имени пользователя","title":"Пользователи","likes_given":"Отправлено","likes_received":"Получено","topics_entered":"Просмотрено","topics_entered_long":"Просмотрено тем","time_read":"Время чтения","topic_count":"Тем","topic_count_long":"Тем создано","post_count":"Ответов","post_count_long":"Ответов написано","no_results":"Ничего не найдено.","days_visited":"Посещений","days_visited_long":"Дней посещения","posts_read":"Прочитано сообщений","posts_read_long":"Прочитано сообщений","total_rows":{"one":"%{count} пользователь","few":"%{count} пользователя","many":"%{count} пользователей","other":"%{count} пользователей"}},"groups":{"empty":{"posts":"Участники этой группы не отправили ни одного сообщения","members":"В этой группе нет участников","mentions":"Упоминаний этой группы нет","messages":"Для этой группы нет сообщений","topics":"Участниками этой группы не создано ни одной темы"},"add":"Добавить","selector_placeholder":"Добавить участников","owner":"владелец","visible":"Группа видима всем пользователям","index":"Группы","title":{"one":"группа","few":"группы","many":"групп","other":"групп"},"members":"Участники","topics":"Темы","posts":"Сообщения","mentions":"Упоминания","messages":"Сообщения","alias_levels":{"title":"Кто может отправлять сообщения и @упоминать эту группу?","nobody":"Никто","only_admins":"Только администраторы","mods_and_admins":"Только модераторы и администраторы","members_mods_and_admins":"Только члены группы, модераторы и администраторы","everyone":"Все"},"trust_levels":{"title":"Уровень доверия участника при создании:","none":"(Нет)"},"notifications":{"watching":{"title":"Наблюдать","description":"Уведомлять по каждому ответу на это сообщение и показывать счетчик новых непрочитанных ответов."},"watching_first_post":{"description":"Уведомлять только о первом сообщении в каждой новой теме в этой группе."},"tracking":{"title":"Следить"},"regular":{"title":"Уведомлять","description":"Вам придёт уведомление, если кто-нибудь упомянет ваш @псевдоним или ответит вам."},"muted":{"title":"Выключено","description":"Не уведомлять о новых темах в этой группе."}}},"user_action_groups":{"1":"Выразил симпатий","2":"Получил симпатий","3":"Закладки","4":"Темы","5":"Сообщения","6":"Ответы","7":"Упоминания","9":"Цитаты","11":"Изменения","12":"Отправленные","13":"Входящие","14":"Ожидает одобрения"},"categories":{"all":"Все разделы","all_subcategories":"Все подкатегории","no_subcategory":"Вне подкатегорий","category":"Раздел","category_list":"Показать список разделов","reorder":{"title":"Упорядочивание разделов","title_long":"Реорганизация списка разделов","fix_order":"Зафиксировать порядковые номера","fix_order_tooltip":"Не всем разделам назначен уникальный порядковый номер. Это может привести к непредсказуемому порядку разделов.","save":"Сохранить порядок","apply_all":"Применить","position":"Порядковый номер"},"posts":"Сообщения","topics":"Темы","latest":"Последние","latest_by":"последние по","toggle_ordering":"изменить сортировку","subcategories":"Подразделы","topic_stat_sentence":{"one":"%{count} новая тема за предыдущий %{unit}.","few":"%{count} новые темы за предыдущий %{unit}.","many":"%{count} новых тем за предыдущий %{unit}.","other":"%{count} новых тем за предыдущий %{unit}."}},"ip_lookup":{"title":"Поиск IP адреса","hostname":"Название хоста","location":"Расположение","location_not_found":"(неизвестно)","organisation":"Организация","phone":"Телефон","other_accounts":"Другие учетные записи с этим IP адресом","delete_other_accounts":"Удалить %{count}","username":"псевдоним","trust_level":"Уровень","read_time":"время чтения","topics_entered":"посещено тем","post_count":"сообщений","confirm_delete_other_accounts":"Вы уверены, что хотите удалить эти учетные записи?"},"user_fields":{"none":"(выберите)"},"user":{"said":"{{username}}:","profile":"Профиль","mute":"Отключить","edit":"Настройки","download_archive":"Скачать архив сообщений","new_private_message":"Новое сообщение","private_message":"Сообщение","private_messages":"Личные сообщения","activity_stream":"Активность","preferences":"Настройки","expand_profile":"Развернуть","bookmarks":"Закладки","bio":"Обо мне","invited_by":"Пригласил","trust_level":"Уровень","notifications":"Уведомления","statistics":"Статистика","desktop_notifications":{"label":"Оповещения","not_supported":"К сожалению, оповещения не поддерживаются этим браузером.","perm_default":"Включить оповещения","perm_denied_btn":"Отказано в разрешении","perm_denied_expl":"Вы запретили оповещения в вашем браузере. Вначале возобновите разрешение, а затем попробуйте еще раз.","disable":"Отключить оповещения","enable":"Включить оповещения","each_browser_note":"Примечание: эта настройка устанавливается в каждом браузере индивидуально."},"dismiss_notifications":"Отложить все","dismiss_notifications_tooltip":"Пометить все непрочитанные уведомления прочитанными","disable_jump_reply":"Не переходить к вашему новому сообщению после ответа","dynamic_favicon":"Показывать колличество новых / обновленных тем на иконке сообщений","external_links_in_new_tab":"Открывать все внешние ссылки в новой вкладке","enable_quoting":"Позволить отвечать с цитированием выделенного текста","change":"изменить","moderator":"{{user}} - модератор","admin":"{{user}} - админ","moderator_tooltip":"{{user}} - модератор","admin_tooltip":"{{user}} - админ","blocked_tooltip":"Этот пользователь заблокирован","suspended_notice":"Пользователь заморожен до {{date}}.","suspended_reason":"Причина:","github_profile":"Github","mailing_list_mode":{"label":"Режим почтовой рассылки","enabled":"Включить почтовую рассылку","instructions":"Настройки почтовой рассылки перекрывают настройки сводки активности.\u003cbr /\u003e\nТемы и разделы с выключенными уведомлениями не будут включены в письма рассылки.\n","daily":"Присылать ежедневные обновления","individual":"Присылать письмо для каждого нового сообщения","many_per_day":"Присылать письмо для каждого нового сообщения (примерно {{dailyEmailEstimate}} в день)","few_per_day":"Присылать письмо для каждого нового сообщения (примерно 2 в день)"},"tag_settings":"Теги","watched_tags":"Наблюдение","muted_tags":"Выключено","watched_categories":"Наблюдение","tracked_categories":"Отслеживаемые разделы","watched_first_post_categories_instructions":"Уведомлять только о первом сообщении в каждой новой теме в этих разделах.","watched_first_post_tags_instructions":"Уведомлять только о первом сообщении в каждой новой теме с этими тегами.","muted_categories":"Выключенные разделы","muted_categories_instructions":"Не уведомлять меня о новых темах в этих разделах и не показывать новые темы на странице «Непрочитанные».","delete_account":"Удалить мою учётную запись","delete_account_confirm":"Вы уверены, что хотите удалить свою учётную запись? Отменить удаление будет невозможно!","deleted_yourself":"Ваша учётная запись была успешно удалена.","delete_yourself_not_allowed":"Вы не можете сейчас удалить свою учётную запись. Попросите администратора удалить вашу учётную запись.","unread_message_count":"Сообщения","admin_delete":"Удалить","users":"Пользователи","muted_users":"Выключено","muted_users_instructions":"Не отображать уведомления от этих пользователей.","muted_topics_link":"Показать темы \"Без уведомлений\"","watched_topics_link":"Показать наблюдаемые темы","automatically_unpin_topics":"Автоматически откреплять топики после прочтения.","staff_counters":{"flags_given":"полезные жалобы","flagged_posts":"сообщения с жалобами","deleted_posts":"удаленные сообщения","suspensions":"приостановки","warnings_received":"предупреждения"},"messages":{"all":"Все","inbox":"Входящие","sent":"Отправленные","archive":"Архив","groups":"Мои группы","bulk_select":"Выберите сообщения","move_to_inbox":"Переместить во входящие","move_to_archive":"Архив","failed_to_move":"Невозможно переместить выделенные сообщения (возможно, у вас проблемы с Интернетом)","select_all":"Выбрать все"},"change_password":{"success":"(письмо отправлено)","in_progress":"(отправка письма)","error":"(ошибка)","action":"Отправить письмо для сброса пароля","set_password":"Установить пароль"},"change_about":{"title":"Изменить информацию обо мне","error":"При изменении значения произошла ошибка."},"change_username":{"title":"Изменить псевдоним","taken":"Этот псевдоним уже занят.","error":"При изменении псевдонима произошла ошибка.","invalid":"Псевдоним должен состоять только из цифр и латинских букв"},"change_email":{"title":"Изменить E-mail","taken":"Этот e-mail недоступен.","error":"Произошла ошибка. Возможно, этот e-mail уже используется?","success":"На указанныю почту отправлено письмо с инструкциями."},"change_avatar":{"title":"Изменить фон профиля","gravatar":"На основе \u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e","gravatar_title":"Измените свой аватар на сайте Gravatar","refresh_gravatar_title":"Обновить ваш Gravatar","letter_based":"Фон профиля по умолчанию","uploaded_avatar":"Собственный аватар","uploaded_avatar_empty":"Добавить собственный аватар","upload_title":"Загрузка собственного аватара","upload_picture":"Загрузить изображение","image_is_not_a_square":"Внимание: мы обрезали ваше изображение; ширина и высота не равны друг другу.","cache_notice":"Вы изменили аватар. Аватар поменяется через некоторое время из-за кеширования браузера."},"change_profile_background":{"title":"Фон профиля","instructions":"Картинки фона профилей будут отцентрированы и по-умолчанию имеют ширину 850 пикселей."},"change_card_background":{"title":"Фон карточки пользователя","instructions":"Картинки фона будут отцентрированы и по-умолчанию имеют ширину 590 пикселей."},"email":{"title":"E-mail","instructions":"Всегда скрыт от публики","ok":"Мы вышлем вам письмо для подтверждения","invalid":"Введите действующий адрес электронной почты","authenticated":"Ваш адрес электронной почты подтвержден {{provider}}","frequency":{"one":"Мы отправим вам письмо только в том случае, если вы более {{count}} минуты находитесь оффлайн.","few":"Мы отправим вам письмо только в том случае, если вы не были онлайн последние {{count}} минуты.","many":"Мы отправим вам письмо только в том случае, если вы не были онлайн последние {{count}} минут.","other":"Мы отправим вам письмо только в том случае, если вы не были онлайн последние {{count}} минyт."}},"name":{"title":"Имя","instructions":"Ваше полное имя (опционально)","instructions_required":"Ваше полное имя","too_short":"Ваше имя слишком короткое","ok":"Допустимое имя"},"username":{"title":"Псевдоним","instructions":"Уникальный, без пробелов и покороче","short_instructions":"Пользователи могут упоминать вас по псевдониму @{{username}}","available":"Псевдоним доступен","global_match":"Адрес электронной почты совпадает с зарегистрированным псевдонимом","global_mismatch":"Уже занято. Попробуйте {{suggestion}}?","not_available":"Недоступно. Попробуйте {{suggestion}}?","too_short":"Псевдоним слишком короткий","too_long":"Псевдоним слишком длинный","checking":"Проверяю доступность псевдонима...","enter_email":"Псевдоним найден; введите адрес электронной почты","prefilled":"Адрес электронной почты совпадает с зарегистрированным псевдонимом"},"locale":{"title":"Язык интерфейса","instructions":"Язык сайта. Необходимо перезагрузить страницу, чтобы изменения вступили в силу.","default":"(по умолчанию)"},"password_confirmation":{"title":"Пароль еще раз"},"last_posted":"Последнее сообщение","last_emailed":"Последнее письмо","last_seen":"Был","created":"Вступил","log_out":"Выйти","location":"Местоположение","card_badge":{"title":"Иконка карточки пользователя"},"website":"Веб-сайт","email_settings":"E-mail","like_notification_frequency":{"title":"Уведомлять при получении симпатии","always":"Всегда","first_time_and_daily":"Для первой симпатии, и далее не чаще раза в день","first_time":"Только для первой симпатии","never":"Никогда"},"email_previous_replies":{"always":"всегда","never":"никогда"},"email_digests":{"every_30_minutes":"каждые 30 минут","every_hour":"каждый час","daily":"ежедневно","every_three_days":"каждые 3 дня","weekly":"еженедельно","every_two_weeks":"каждые 2 недели"},"email_direct":"Присылать почтовое уведомление, когда кто-то цитирует меня, отвечает на мой пост, упоминает мой @псевдоним или приглашает меня в тему","email_private_messages":"Присылать почтовое уведомление, когда кто-то оставляет мне сообщение","email_always":"Присылать почтовое уведомление, даже если я присутствую на сайте","other_settings":"Прочее","categories_settings":"Разделы","new_topic_duration":{"label":"Считать темы новыми, если","not_viewed":"ещё не просмотрены","last_here":"созданы после вашего последнего визита","after_1_day":"созданы за прошедший день","after_2_days":"созданы за последние 2 дня","after_1_week":"созданы за последнюю неделю","after_2_weeks":"созданы за последние 2 недели"},"auto_track_topics":"Автоматически отслеживать темы, которые я просматриваю","auto_track_options":{"never":"никогда","immediately":"немедленно","after_30_seconds":"более 30 секунд","after_1_minute":"более 1ой минуты","after_2_minutes":"более 2х минут","after_3_minutes":"более 3х минут","after_4_minutes":"более 4х минут","after_5_minutes":"более 5 минут","after_10_minutes":"более 10 минут"},"invited":{"search":"Введите текст для поиска по приглашениям...","title":"Приглашения","user":"Кто приглашен","sent":"Когда","none":"Приглашения, ожидающие одобрения, отсутствуют.","truncated":{"one":"Первое приглашение","few":"Первые {{count}} приглашения","many":"Первые {{count}} приглашений","other":"Первые {{count}} приглашений"},"redeemed":"Принятые приглашения","redeemed_tab":"Принятые","redeemed_tab_with_count":"Принятые ({{count}})","redeemed_at":"Принято","pending":"Еще не принятые приглашения","pending_tab":"Ожидающие","pending_tab_with_count":"Ожидающие ({{count}})","topics_entered":"Просмотрел тем","posts_read_count":"Прочитал сообщений","expired":"Это приглашение истекло.","rescind":"Отозвать","rescinded":"Приглашение отозвано","reinvite":"Повторить приглашение","reinvite_all":"Повторить все приглашения","reinvited":"Приглашение выслано повторно","reinvited_all":"Все приглашения высланы повторно!","time_read":"Времени читал","days_visited":"Дней посещал","account_age_days":"Дней с момента регистрации","create":"Отправить приглашение","generate_link":"Скопировать ссылку для приглашений","generated_link_message":"\u003cp\u003eПригласительная ссылка сгенерирована!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eЭта ссылка действует только для следующего e-mail:\u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Вы еще никого не приглашали на этот форум. Можно отправить индивидуальные приглашения по одному, или же пригласить сразу несколько людей \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eиз файла\u003c/a\u003e.","text":"Пригласить всех из файла","uploading":"Загрузка...","success":"Файл успешно загружен, вы получите сообщение, когда процесс будет завершен.","error":"В процессе загрузки файла '{{filename}}' произошла ошибка: {{message}}"}},"password":{"title":"Пароль","too_short":"Пароль слишком короткий.","common":"Пароль слишком короткий.","same_as_username":"Ваш пароль такой же, как и ваше имя пользователя.","same_as_email":"Ваш пароль такой же, как и ваш email.","ok":"Допустимый пароль.","instructions":"Не менее %{count} символов."},"summary":{"title":"Сводка","stats":"Статистика","time_read":"время чтения","topic_count":{"one":"тему создал","few":"темы создал","many":"тем создал","other":"тем создал"},"post_count":{"one":"сообщение написал","few":"сообщения написал","many":"сообщений написал","other":"сообщений написал"},"days_visited":{"one":"день заходил","few":"дня заходил","many":"дней заходил","other":"дней заходил"},"posts_read":{"one":"сообщение прочел","few":"сообщения прочел","many":"сообщений прочел","other":"сообщений прочел"},"bookmark_count":{"one":"закладка","few":"закладок","many":"закладки","other":"закладки"},"top_replies":"Лучшие сообщения","no_replies":"Пока не написал ни одного сообщения.","more_replies":"... другие сообщения","top_topics":"Лучшие темы","no_topics":"Пока не создал ни одной темы.","more_topics":"... другие темы","top_badges":"Самые престижные награды","no_badges":"Еще не получил ни одной награды.","more_badges":"... другие награды","top_links":"Лучшие темы","no_links":"Пока нет ссылок","most_liked_by":"Больше всего симпатий от","most_liked_users":"Больше всего симпатий","no_likes":"Пока ни одной симпатии."},"associated_accounts":"Связанные аккаунты","ip_address":{"title":"Последний IP адрес"},"registration_ip_address":{"title":"IP адрес регистрации"},"avatar":{"title":"Аватар","header_title":"профиль, сообщения, закладки и настройки"},"title":{"title":"Заголовок"},"filters":{"all":"Всего"},"stream":{"posted_by":"Опубликовано","sent_by":"Отправлено","private_message":"сообщение","the_topic":"тема"}},"loading":"Загрузка...","errors":{"prev_page":"при попытке загрузки","reasons":{"network":"Ошибка сети","server":"Ошибка сервера","forbidden":"Доступ закрыт","unknown":"Ошибка","not_found":"Страница не найдена"},"desc":{"network":"Пожалуйста, проверьте ваше соединение.","network_fixed":"Похоже, сеть появилась.","server":"Ошибка: {{status}}","forbidden":"У вас нет доступа для просмотра этого.","not_found":"Упс, произошла попытка загрузить несуществующую ссылку","unknown":"Что-то пошло не так."},"buttons":{"back":"Вернуться","again":"Попытаться еще раз","fixed":"Загрузить страницу"}},"close":"Закрыть","assets_changed_confirm":"Сайт только что был обновлен. Перезагрузить страницу для перехода к новой версии?","logout":"Вы вышли.","refresh":"Обновить","read_only_mode":{"login_disabled":"Вход отключён, пока сайт в режиме «только для чтения»","logout_disabled":"Выход отключён, пока сайт в режиме «только для чтения»"},"too_few_topics_and_posts_notice":"Давайте \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eприступим к обсуждению!\u003c/a\u003e Сейчас \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e тем и \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e сообщений. Новым пользователям будет интереснее тут, если появится больше тем для обсуждений.","too_few_topics_notice":"Давайте \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eприступим к обсуждению!\u003c/a\u003e Сейчас \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e тем. Новым пользователям будет интереснее тут, если появится больше тем для обсуждений.","too_few_posts_notice":"Давайте \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eприступим к обсуждению!\u003c/a\u003e  Сейчас \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e сообщений. Новым пользователям будет интереснее тут, если появится больше сообщений для обсуждения.","learn_more":"подробнее...","year":"год","year_desc":"темы, созданные за последние 365 дней","month":"месяц","month_desc":"темы, созданные за последние 30 дней","week":"неделя","week_desc":"темы, созданные за последние 7 дней","day":"день","first_post":"Первое сообщение","mute":"Отключить","unmute":"Включить","last_post":"Последнее сообщение","last_reply_lowercase":"последний ответ","replies_lowercase":{"one":"ответ","few":"ответа","other":"ответов"},"signup_cta":{"sign_up":"Зарегистрироваться","hide_session":"Напомнить мне завтра","hide_forever":"Нет, спасибо","hidden_for_session":"Хорошо, напомню завтра. Кстати, зарегистрироваться можно также и с помощью кнопки \"Войти\".","intro":"Привет! :heart_eyes: Кажется, форум пришелся вам по душе, но вы все еще не зарегистрировались.","value_prop":"После регистрации мы сможем запоминать, где вы закончили чтение, а когда вы заглянете в ту или иную тему снова, мы откроем ее там, где вы остановились в прошлый раз. Мы также сможем уведомлять вас о новых ответах в любимых темах в вашем личном кабинете или по электронной почте. А самое приятное - после регистрации можно ставить сердечки, тем самым выражая свою симпатию автору. :heartbeat:"},"summary":{"enabled_description":"Вы просматриваете выдержку из темы - только самые интересные сообщения по мнению сообщества.","description":"Есть \u003cb\u003e{{replyCount}}\u003c/b\u003e ответов.","description_time":"\u003cb\u003e{{replyCount}}\u003c/b\u003e ответов с предполагаемым временем прочтения около \u003cb\u003e{{readingTime}} минут\u003c/b\u003e.","enable":"Сводка по теме","disable":"Показать все сообщения"},"deleted_filter":{"enabled_description":"Этам тема содержит удаленные сообщения, которые сейчас скрыты.","disabled_description":"Удаленные сообщения темы показаны.","enable":"Скрыть удаленные сообщения","disable":"Показать удаленные сообщения"},"private_message_info":{"title":"Сообщение","invite":"Пригласить других...","remove_allowed_user":"Вы действительно хотите удалить {{name}} из данного сообщения?","remove_allowed_group":"Вы действительно хотите удалить {{name}} из данного сообщения?"},"email":"Email","username":"Псевдоним","last_seen":"Был","created":"Создан","created_lowercase":"создано","trust_level":"Уровень доверия","search_hint":"Псевдоним, e-mail или IP адрес","create_account":{"title":"Зарегистрироваться","failed":"Произошла ошибка. Возможно, этот Email уже используется. Попробуйте восстановить пароль"},"forgot_password":{"title":"Сброс пароля","action":"Я забыл свой пароль","invite":"Введите ваш псевдоним или адрес электронной почты, и мы отправим вам ссылку для сброса пароля.","reset":"Сброс пароля","complete_username":"Если учетная запись совпадает с псевдонимом \u003cb\u003e%{username}\u003c/b\u003e, вы скоро получите письмо с инструкциями о том, как сбросить пароль.","complete_email":"Если учетная запись совпадает с \u003cb\u003e%{email}\u003c/b\u003e, вы должны получить письмо с инструкциями о том, как быстро сбросить ваш пароль.","complete_username_found":"Мы нашли учетную запись с псевдонимом \u003cb\u003e%{username}\u003c/b\u003e и выслали вам на e-mail инструкции по сбросу пароля.","complete_email_found":"Мы нашли учетную запись с адресом электронной почты  \u003cb\u003e%{email}\u003c/b\u003e и выслали туда инструкцию по сбросу пароля.","complete_username_not_found":"Не найдено учетной записи с псевдонимом \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Не найдено учетной записи с адресом электронной почты \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Войти","username":"Пользователь","password":"Пароль","email_placeholder":"E-mail или псевдоним","caps_lock_warning":"Caps Lock включен","error":"Непредвиденная ошибка","rate_limit":"Пожалуйста, сделайте перерыв перед очередной попыткой войти.","blank_username_or_password":"Введите ваш e-mail (или псевдоним) и пароль.","reset_password":"Сброс пароля","logging_in":"Проверка...","or":"или","authenticating":"Проверка...","awaiting_confirmation":"Ваша учетная запись требует активации. Для того, чтобы получить активационное письмо повторно, нажмите на Сброс пароля.","awaiting_approval":"Ваша учетная запись еще не одобрена. Вы получите письмо, как только это случится.","requires_invite":"К сожалению, доступ к этому форуму только по приглашениям.","not_activated":"Прежде, чем вы сможете войти на форум, вам необходимо активировать свою учетную запись. Мы отправили на почту \u003cb\u003e{{sentTo}}\u003c/b\u003e подробные инструкции, как это cделать.","not_allowed_from_ip_address":"С этого IP адреса вход запрещен.","admin_not_allowed_from_ip_address":"Вы не можете войти в качестве админа с этого IP адреса.","resend_activation_email":"Щелкните здесь, чтобы мы повторно выслали вам письмо для активации учетной записи.","sent_activation_email_again":"По адресу \u003cb\u003e{{currentEmail}}\u003c/b\u003e повторно отправлено письмо с инструкциями по активации вашей учетной записи. Доставка сообщения может занять несколько минут. Имейте в виду, что иногда по ошибке письмо может попасть в папку Спам.","to_continue":"Войдите пожалуйста","preferences":"Вам необходимо войти на сайт для редактирования настроек пользователя","forgot":"Я не помню данные моего аккаунта","google":{"title":"С помощью Google","message":"Вход с помощью учетной записи Google (убедитесь, что блокировщик всплывающих окон отключен)"},"google_oauth2":{"title":"С помощью Google","message":"Вход с помощью учетной записи Google (убедитесь, что блокировщик всплывающих окон отключен)"},"twitter":{"title":"С помощью Twitter","message":"Вход с помощью учетной записи Twitter (убедитесь, что блокировщик всплывающих окон отключен)"},"instagram":{"title":"через Instagram","message":"Вход с помощью учетной записи Instagram (убедитесь, что блокировщик всплывающих окон отключен)"},"facebook":{"title":"С помощью Facebook","message":"Вход с помощью учетной записи Facebook (всплывающие окна должны быть разрешены)"},"yahoo":{"title":"С помощью Yahoo","message":"Вход с помощью учетной записи Yahoo (убедитесь, что блокировщик всплывающих окон отключен)"},"github":{"title":"С помощью GitHub","message":"Вход с помощью учетной записи GitHub (убедитесь, что блокировщик всплывающих окон отключен)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Смайлики :)","more_emoji":"еще...","options":"Дополнительные опции","whisper":"внутреннее сообщение","add_warning":"Это официальное предупреждение.","toggle_whisper":"Внутреннее сообщение","posting_not_on_topic":"В какой теме вы хотите ответить?","saving_draft_tip":"Сохранение...","saved_draft_tip":"Сохранено","saved_local_draft_tip":"Сохранено локально","similar_topics":"Ваша тема похожа на...","drafts_offline":"Черновики, сохраненные в офлайн","error":{"title_missing":"Требуется название темы","title_too_short":"Название темы должно быть не короче {{min}} символов","title_too_long":"Название темы не может быть длиннее {{max}} символов","post_missing":"Сообщение не может быть пустым","post_length":"Сообщение должно быть не короче {{min}} символов","try_like":"Пробовали ли вы выразить симпатию с помощью кнопки \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e ?","category_missing":"Нужно выбрать раздел"},"save_edit":"Сохранить","reply_original":"Ответ в первоначальной теме","reply_here":"Ответить в текущей теме","reply":"Ответить","cancel":"Отмена","create_topic":"Создать тему","create_pm":"Личное сообщение","title":"Или нажмите Ctrl+Enter","users_placeholder":"Добавить пользователя","title_placeholder":"Название: суть темы коротким предложением","edit_reason_placeholder":"Причина редактирования...","show_edit_reason":"(добавить причину редактирования)","reply_placeholder":"Поддерживаемые форматы: Markdown, BBCode и HTML. Чтобы вставить картинку, перетащите ее сюда или вставьте с помощью Ctrl+V, Command-V, или нажмите правой кнопкой мыши и выберите меню \"вставить\".","view_new_post":"Посмотреть созданное вами сообщение.","saving":"Сохранение...","saved":"Сохранено!","saved_draft":"Черновик сохранен; нажмите сюда, чтобы его открыть.","uploading":"Загрузка...","show_preview":"показать предпросмотр \u0026raquo;","hide_preview":"\u0026laquo; скрыть предпросмотр","quote_post_title":"Процитировать сообщение целиком","bold_title":"Жирный","bold_text":"текст, выделенный жирным","italic_title":"Курсив","italic_text":"текст, выделенный курсивом","link_title":"Ссылка","link_description":"введите описание ссылки","link_dialog_title":"Вставить ссылку","link_optional_text":"текст ссылки","link_url_placeholder":"http://example.com","quote_title":"Цитата","quote_text":"Впишите текст цитаты сюда","code_title":"Текст \"как есть\" (без применения форматирования)","code_text":"впишите текст сюда; также, отключить форматирование текста можно, начав строку с четырех пробелов","upload_title":"Загрузить","upload_description":"введите описание загружаемого объекта","olist_title":"Нумерованный список","ulist_title":"Ненумерованный список","list_item":"Пункт первый","heading_title":"Заголовок","heading_text":"Заголовок","hr_title":"Горизонтальный разделитель","help":"Справка по форматированию (Markdown)","toggler":"скрыть / показать панель редактирования","modal_ok":"OK","modal_cancel":"Отмена","cant_send_pm":"К сожалению, вы не можете отправлять сообщения пользователю %{username}.","admin_options_title":"Дополнительные настройки темы","auto_close":{"label":"Закрыть тему через:","error":"Пожалуйста, введите корректное значение.","based_on_last_post":"Не закрывать, пока не пройдет хотя бы такой промежуток времени с момента последнего сообщения в этой теме.","all":{"examples":"Введите количество часов (напр., 24), время (напр., 17:30) или дату и время (2013-11-22 14:00)."},"limited":{"units":"(кол-во часов)","examples":"Введите количество часов (24)."}}},"notifications":{"title":"уведомления об упоминании @псевдонима, ответах на ваши посты и темы, сообщения и т.д.","none":"Уведомления не могут быть загружены.","more":"посмотреть более ранние уведомления","total_flagged":"всего сообщений с жалобами","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} и ещё {{count}}\u003c/span\u003e {{description}}\u003c/p\u003e","few":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} и ещё {{count}}\u003c/span\u003e {{description}}\u003c/p\u003e","many":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} и ещё {{count}}\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} и ещё {{count}}\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='приглашен в тему' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e принял(а) ваше приглашение\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e переместил(а) {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eВы награждены: {{description}}\u003c/p\u003e","alt":{"mentioned":"Упомянуто","quoted":"Процитировано пользователем","replied":"Ответил","posted":"Опубликовано","edited":"Изменил ваше сообщение","liked":"Понравилось ваше сообщение","private_message":"Личное сообщение от","invitee_accepted":"Приглашение принято","moved_post":"Ваша тема перенесена участником ","linked":"Ссылка на ваше сообщение","granted_badge":"Награда получена от"},"popup":{"mentioned":"{{username}} упомянул вас в \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} упомянул вас в \"{{topic}}\" - {{site_title}}","quoted":"{{username}} процитировал Вас в \"{{topic}}\" - {{site_title}}","replied":"{{username}} ответил вам в \"{{topic}}\" - {{site_title}}","posted":"{{username}} написал в \"{{topic}}\" - {{site_title}}","private_message":"{{username}} отправил вам личное сообщение в \"{{topic}}\" - {{site_title}}","linked":"{{username}} ссылается на ваш пост в теме: \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Add an image","title_with_attachments":"Add an image or a file","from_my_computer":"С моего устройства","from_the_web":"С интернета","remote_tip":"ссылка на изображение","remote_tip_with_attachments":"ссылка на изображение или файл {{authorized_extensions}}","local_tip":"выбрать изображения с вашего устройства","local_tip_with_attachments":"выбрать изображения или файлы с вашего устройства {{authorized_extensions}}","hint":"(вы так же можете перетащить объект в редактор для его загрузки)","hint_for_supported_browsers":"вы так же можете перетащить или скопировать изображения в редактор","uploading":"Загрузка","select_file":"Выбрать файл","image_link":"ссылка, на которую будет указывать ваше изображение"},"search":{"sort_by":"Сортировка","relevance":"По смыслу","latest_post":"С недавними сообщениями","most_viewed":"Самые просматриваемые","most_liked":"Больше всего симпатий","select_all":"Выбрать все","clear_all":"Сбросить все","result_count":{"one":"Найдено 1: \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","few":"Найдено {{count}}: \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","many":"Найдено {{count}}: \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"Найдено {{count}}: \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"Поиск по темам, сообщениям, псевдонимам и разделам","no_results":"Ничего не найдено.","no_more_results":"Больше ничего не найдено.","search_help":"Справка по поиску","searching":"Поиск ...","post_format":"#{{post_number}} от {{username}}","context":{"user":"Искать сообщения от @{{username}}","category":"Искать в разделе \"{{category}}\"","topic":"Искать в этой теме","private_messages":"Искать в личных сообщениях"}},"hamburger_menu":"перейти к другому списку тем или другому разделу","new_item":"новый","go_back":"вернуться","not_logged_in_user":"страница пользователя с историей его последней активности и настроек","current_user":"перейти на вашу страницу пользователя","topics":{"bulk":{"unlist_topics":"Исключить из списков","reset_read":"Сбросить прочтённые","delete":"Удалить темы","dismiss":"OK","dismiss_read":"Отклонить все непрочитанные","dismiss_button":"Отложить...","dismiss_tooltip":"Отложить новые сообщения или перестать следить за этими темами","also_dismiss_topics":"Перестать следить за этими темами, чтобы они никогда больше не высвечивались как непрочитанные","dismiss_new":"Отложить новые","toggle":"Вкл./выкл. выбор нескольких тем","actions":"Массовое действие","change_category":"Изменить раздел","close_topics":"Закрыть темы","archive_topics":"Архивировать темы","notification_level":"Изменить уровень оповещения","choose_new_category":"Выберите новый раздел для тем:","selected":{"one":"Вы выбрали \u003cb\u003e{{count}}\u003c/b\u003e тему.","few":"Вы выбрали \u003cb\u003e{{count}}\u003c/b\u003e темы.","many":"Вы выбрали \u003cb\u003e{{count}}\u003c/b\u003e тем.","other":"Вы выбрали \u003cb\u003e{{count}}\u003c/b\u003e тем."},"change_tags":"Изменить тэги","choose_new_tags":"Выбрать новые тэги для выбранных тем:"},"none":{"unread":"У вас нет непрочитанных тем.","new":"У вас нет новых тем.","read":"Вы еще не прочитали ни одной темы.","posted":"Вы не принимали участие в обсуждении.","latest":"Новых тем нет.","hot":"Популярных тем нет.","bookmarks":"У вас нет избранных тем.","category":"В разделе {{category}} отсутствуют темы.","top":"Нет обсуждаемых тем.","search":"Ничего не найдено.","educate":{"new":"\u003cp\u003eВаши новые темы скоро появятся тут.\u003c/p\u003e\u003cp\u003eПо умолчанию, новые темы отмечаются иконкой: \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eНовая\u003c/span\u003e , если она была создана в течении 2 недель.\u003c/p\u003e\u003cp\u003eПерейдите в \u003ca href=\"%{userPrefsUrl}\"\u003eнастройки\u003c/a\u003e для того, чтобы выбрать период активности новых тем.\u003c/p\u003e","unread":"\u003cp\u003eВаши непрочитанные темы скоро появятся тут.\u003c/p\u003e\u003cp\u003eПо умолчанию темы получают счетчик \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e, если:\u003c/p\u003e\u003cul\u003e\u003cli\u003eСоздана тема\u003c/li\u003e\u003cli\u003eОтветили на тему\u003c/li\u003e\u003cli\u003eТема прочитана по истечении 4 минут, после ее создания \u003c/li\u003e\u003c/ul\u003e\u003cp\u003eИли можно задать свои настройки отслеживания новых тем.\u003c/p\u003e\u003cp\u003eПерейдите в свои \u003ca href=\"%{userPrefsUrl}\"\u003eнастройки\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Тем больше нет.","hot":"Популярных тем больше нет.","posted":"Созданных тем больше нет.","read":"Прочитанных тем больше нет.","new":"Больше нет новых тем.","unread":"Больше нет непрочитанных тем.","category":"В разделе {{category}} больше нет тем.","top":"Больше нет обсуждаемых тем.","bookmarks":"Больше нет избранных тем.","search":"Больше ничего не найдено."}},"topic":{"unsubscribe":{"change_notification_state":"Ваше текущее состояние уведомлений"},"create":"Создать Тему","create_long":"Создать новую тему","private_message":"Написать сообщение","archive_message":{"help":"Переместить сообщение в архив","title":"Архив"},"move_to_inbox":{"title":"Переместить во входящие","help":"Переместить сообщение во входящие"},"list":"Темы","new":"новая тема","unread":"непрочитанно","new_topics":{"one":"{{count}} новая тема","few":"{{count}} новых темы","many":"{{count}} новых тем","other":"{{count}} новых тем"},"unread_topics":{"one":"{{count}} непрочитанная тема","few":"{{count}} непрочитанные темы","many":"{{count}} непрочитанных тем","other":"{{count}} непрочитанных тем"},"title":"Тема","invalid_access":{"title":"Частная тема","description":"К сожалению, у вас нет прав доступа к теме!","login_required":"Вам необходимо войти на сайт, чтобы получить доступ к этой теме."},"server_error":{"title":"Не удалось загрузить тему","description":"К сожалению, мы не смогли загрузить тему, возможно, из-за проблемы подключения. Попробуйте еще раз. Если проблема повторится, пожалуйста, сообщите нам об этом."},"not_found":{"title":"Тема не найдена","description":"К сожалению, запрошенная тема не найдена. Возможно, она была удалена модератором."},"total_unread_posts":{"one":"у вас {{count}} непрочитанное сообщение в этой теме","few":"у вас {{count}} непрочитанных сообщения в этой теме","many":"у вас {{count}} непрочитанных сообщения в этой теме","other":"у вас {{count}} непрочитанных сообщения в этой теме"},"unread_posts":{"one":"у вас {{count}} непрочитанное старое сообщение в этой теме","few":"у вас {{count}} непрочитанных старых сообщения в этой теме","many":"у вас {{count}} непрочитанных старых сообщений в этой теме","other":"у вас {{count}} непрочитанных старых сообщений в этой теме"},"new_posts":{"one":"в этой теме {{count}} новое сообщение с её последнего просмотра вами","few":"в этой теме {{count}} новых сообщения с её последнего просмотра вами","many":"в этой теме {{count}} новых сообщений с её последнего просмотра вами","other":"в этой теме {{count}} новых сообщений с её последнего просмотра вами"},"likes":{"one":"в теме {{count}} лайк","few":"в теме {{count}} лайка","many":"в теме {{count}} лайков","other":"в теме {{count}} лайков"},"back_to_list":"Вернуться к списку тем","options":"Опции темы","show_links":"показать ссылки в теме","toggle_information":"скрыть / показать подробную информацию о теме","read_more_in_category":"Хотите почитать что-нибудь еще? Можно посмотреть темы в {{catLink}} или {{latestLink}}.","read_more":"Хотите почитать что-нибудь еще? {{catLink}} или {{latestLink}}.","browse_all_categories":"Просмотреть все разделы","view_latest_topics":"посмотреть последние темы","suggest_create_topic":"Почему бы вам не создать новую тему?","jump_reply_up":"перейти к более ранним ответам","jump_reply_down":"перейти к более поздним ответам","deleted":"Тема удалена","auto_close_notice":"Тема будет автоматически закрыта через %{timeLeft}.","auto_close_notice_based_on_last_post":"Эта тема будет закрыта через %{duration} после последнего ответа.","auto_close_title":"Настройки закрытия темы","auto_close_save":"Сохранить","auto_close_remove":"Не закрывать тему автоматически","progress":{"title":"текущее местоположение в теме","go_top":"перейти наверх","go_bottom":"перейти вниз","go":"=\u003e","jump_bottom":"перейти к последнему сообщению","jump_bottom_with_number":"перейти к сообщению %{post_number}","total":"всего сообщений","current":"текущее сообщение"},"notifications":{"reasons":{"3_6":"Вы будете получать уведомления, т.к. наблюдаете за этим разделом.","3_5":"Вы будете получать уведомления, т.к. наблюдение темы началось автоматически.","3_2":"Вы будете получать уведомления, т.к. наблюдаете за этой темой.","3_1":"Вы будете получать уведомления, т.к. создали эту тему.","3":"Вы будете получать уведомления, т.к. наблюдаете за темой.","2_8":"Вы будете получать уведомления, т.к. следите за этим разделом.","2_4":"Вы будете получать уведомления, т.к. ответили в теме.","2_2":"Вы будете получать уведомления, т.к. следите за этой темой.","2":"Вы будете получать уведомления, т.к. \u003ca href=\"/users/{{username}}/preferences\"\u003eчитали эту тему\u003c/a\u003e.","1_2":"Вы будете получать уведомления, если кто-то упомянет ваш @псевдоним или ответит вам.","1":"Вы будете получать уведомления, если кто-то упомянет ваш @псевдоним или ответит вам.","0_7":"Не получать уведомлений из этого раздела.","0_2":"Не получать уведомлений по этой теме.","0":"Не получать уведомлений по этой теме."},"watching_pm":{"title":"Наблюдать","description":"Уведомлять по каждому ответу на это сообщение и показывать счетчик новых непрочитанных ответов."},"watching":{"title":"Наблюдать","description":"Уведомлять по каждому новому сообщению в этой теме и показывать счетчик новых непрочитанных ответов."},"tracking_pm":{"title":"Следить","description":"Количество непрочитанных сообщений появится рядом с этим сообщением. Вам придёт уведомление, только если кто-нибудь упомянет ваш @псевдоним или ответит на ваше сообщение."},"tracking":{"title":"Следить","description":"Количество непрочитанных сообщений появится рядом с названием этой темы. Вам придёт уведомление, только если кто-нибудь упомянет ваш @псевдоним или ответит на ваше сообщение."},"regular":{"title":"Уведомлять","description":"Вам придёт уведомление, только если кто-нибудь упомянет ваш @псевдоним или ответит на ваше сообщение."},"regular_pm":{"title":"Уведомлять","description":"Вам придёт уведомление, только если кто-нибудь упомянет ваш @псевдоним или ответит на ваше сообщение."},"muted_pm":{"title":"Без уведомлений","description":"Никогда не получать уведомлений, связанных с этой беседой."},"muted":{"title":"Без уведомлений","description":"Не уведомлять об изменениях в этой теме и скрыть её из последних."}},"actions":{"recover":"Отменить удаление темы","delete":"Удалить тему","open":"Открыть тему","close":"Закрыть тему","multi_select":"Выбрать сообщения...","auto_close":"Автоматическое закрытие...","pin":"Закрепить тему...","unpin":"Открепить тему...","unarchive":"Разархивировать тему","archive":"Архивировать тему","invisible":"Исключить из списков","visible":"Включить в списки","reset_read":"Сбросить счетчики"},"feature":{"pin":"Закрепить тему","unpin":"Открепить тему","pin_globally":"Закрепить тему глобально","make_banner":"Создать объявление","remove_banner":"Удалить объявление"},"reply":{"title":"Ответить","help":"ответить в теме"},"clear_pin":{"title":"Открепить","help":"Открепить тему, чтобы она более не показывалась в самом начале списка тем"},"share":{"title":"Поделиться","help":"Поделиться ссылкой на тему"},"flag_topic":{"title":"Жалоба","help":"пожаловаться на сообщение","success_message":"Вы пожаловались на тему."},"feature_topic":{"title":"Закрепить эту тему","pin":"Закрепить эту тему вверху раздела {{categoryLink}} до","confirm_pin":"У вас уже есть закрепленные темы в разделе ({{count}}). Перебор таких тем может оказаться неприятным неудобством для новичков и анонимных читателей. Вы уверены, что хотите закрепить еще одну тему в этом разделе?","unpin":"Отменить закрепление этой темы вверху раздела {{categoryLink}}.","unpin_until":"Отменить закрепление этой темы вверху раздела {{categoryLink}} (произойдет автоматически \u003cstrong\u003e%{until}\u003c/strong\u003e).","pin_note":"Пользователи могут открепить тему, каждый сам для себя.","pin_validation":"Чтобы закрепить эту тему, требуется дата.","not_pinned":"В разделе {{categoryLink}} нет закрепленных тем.","already_pinned":{"one":"Глобально закрепленных тем в разделе {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","few":"Глобально закрепленных тем в разделе {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"Глобально закрепленных тем в разделе {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Глобально закрепленных тем в разделе {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Закрепить эту тему вверху всех разделов и списков тем до","confirm_pin_globally":"У вас уже есть глобально закрепленные темы ({{count}}). Перебор таких тем может оказаться неприятным неудобством для новичков и анонимных читателей. Вы уверены, что хотите глобально закрепить еще одну тему?","unpin_globally":"Отменить прикрепление этой темы вверху всех разделов и списков тем.","unpin_globally_until":"Отменить прикрепление этой темы вверху всех разделов и списков тем (произойдет автоматически \u003cstrong\u003e%{until}\u003c/strong\u003e).","global_pin_note":"Пользователи могут открепить тему, каждый сам для себя.","not_pinned_globally":"Нет глобально закрепленных тем.","already_pinned_globally":{"one":"Глобально закрепленных тем: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","few":"Глобально закрепленных тем: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"Глобально закрепленных тем: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Глобально закрепленных тем: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Превратить эту тему в объявление, которое будет отображаться вверху всех страниц.","remove_banner":"Убрать тему-объявление, которое отображается вверху всех страниц.","banner_note":"Пользователи могут закрывать объявление, каждый сам для себя, после чего оно больше не будет для них покываться. Только одна тема может быть сделана активным объявлением в любой момент времени.","no_banner_exists":"Нет текущих тем-объявлений.","banner_exists":"На данный момент \u003cstrong class='badge badge-notification unread'\u003eуже есть\u003c/strong\u003e тема-объявление."},"inviting":"Высылаю приглашение...","invite_private":{"title":"Пригласить в беседу","email_or_username":"Адрес электронной почты или псевдоним того, кого вы хотите пригласить","email_or_username_placeholder":"e-mail или псевдоним","action":"Пригласить","success":"Мы пригласили этого пользователя принять участие в беседе.","error":"К сожалению, в процессе приглашения пользователя произошла ошибка.","group_name":"название группы"},"controls":"Управление темой","invite_reply":{"title":"Пригласить","username_placeholder":"имя пользователя","action":"Отправить приглашение","help":"пригласить других в эту тему с помощью email или уведомлений","to_forum":"Будет отправлено короткое письмо, которое позволит вашему другу присоединиться просто кликнув по ссылке без необходимости входа на сайт.","sso_enabled":"Введите псевдоним пользователя, которого вы хотите пригласить в эту тему.","to_topic_blank":"Введите псевдоним или email пользователя, которого вы хотите пригласить в эту тему.","to_topic_email":"Вы указали адрес электронной почты. Мы отправим приглашение, которое позволит вашему другу немедленно ответить в этой теме.","to_topic_username":"Вы указали псевдоним пользователя. Мы отправим ему уведомление со ссылкой, чтобы пригласить его в эту тему.","to_username":"Введите псевдоним пользователя, которого вы хотите пригласить в эту тему. Мы отправим ему уведомление о том что вы приглашаете его присоединиться к этой теме.","email_placeholder":"name@example.com","success_email":"Приглашение отправлено по адресу \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Мы уведомим Вас, когда этим приглашением воспользуются. Проверьте вкладку Приглашения на вашей странице пользователя, чтобы узнать состояние всех ваших приглашений.","success_username":"Мы пригласили этого пользователя принять участие в теме.","error":"К сожалению, мы не смогли пригласить этого человека. Возможно, он уже был приглашен? (Приглашения ограничены рейтингом)"},"login_reply":"Войти и ответить","filters":{"n_posts":{"one":"{{count}} сообщение","few":"{{count}} сообщения","many":"{{count}} сообщений","other":"{{count}} сообщений"},"cancel":"Отменить фильтр"},"split_topic":{"title":"Переместить в новую тему","action":"переместить в новую тему","topic_name":"Название новой темы","error":"Во время перемещения сообщений в новую тему возникла ошибка.","instructions":{"one":"Сейчас вы создадите новую тему и в неё переместится выбранное вами \u003cb\u003e{{count}}\u003c/b\u003e сообщение.","few":"Сейчас вы создадите новую тему и в неё переместятся выбранные вами \u003cb\u003e{{count}}\u003c/b\u003e сообщения.","many":"Сейчас вы создадите новую тему и в неё переместятся выбранные вами \u003cb\u003e{{count}}\u003c/b\u003e сообщений.","other":"Сейчас вы создадите новую тему и в неё переместятся выбранные вами \u003cb\u003e{{count}}\u003c/b\u003e сообщений."}},"merge_topic":{"title":"Переместить в существующую тему","action":"переместить в существующую тему","error":"Во время перемещения сообщений в тему возникла ошибка.","instructions":{"one":"Пожалуйста, выберите тему, в которую вы хотели бы переместить это \u003cb\u003e{{count}}\u003c/b\u003e сообщение.","few":"Пожалуйста, выберите тему, в которую вы хотели бы переместить эти \u003cb\u003e{{count}}\u003c/b\u003e сообщения.","many":"Пожалуйста, выберите тему, в которую вы хотели бы переместить эти \u003cb\u003e{{count}}\u003c/b\u003e сообщений.","other":"Пожалуйста, выберите тему, в которую вы хотели бы переместить эти \u003cb\u003e{{count}}\u003c/b\u003e сообщений."}},"merge_posts":{"title":"Соединить выделенные сообщения","action":"Соединить выделенные сообщения","error":"Произошла ошибка во время соединения выделенных сообщений."},"change_owner":{"title":"Изменить владельца сообщений","action":"изменить владельца","error":"При смене владельца сообщений произошла ошибка.","label":"Новый владелец сообщений","placeholder":"псевдоним нового владельца","instructions":{"one":"Пожалуйста, выберите нового владельца {{count}} сообщения от \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"Пожалуйста, выберите нового владельца {{count}} сообщений от \u003cb\u003e{{old_user}}\u003c/b\u003e.","many":"Пожалуйста, выберите нового владельца {{count}} сообщений от \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Пожалуйста, выберите нового владельца {{count}} сообщений от \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Обратите внимание, что все уведомления об этом сообщении не будут переданы новому пользователю задним числом. \u003cbr\u003eВнимание: В настоящее время никакие данные, имеющие отношение к сообщению, не передаются новому пользователю. Используйте с осторожностью."},"change_timestamp":{"title":"Изменить временную метку","action":"изменить временную метку","invalid_timestamp":"Временная метка не может быть в будущем","error":"При изменении временной метки темы возникла ошибка","instructions":"Пожалуйста, выберите новую временную метку. Сообщения в теме будут обновлены, чтобы убрать временные различия."},"multi_select":{"select":"выбрать","selected":"выбрано ({{count}})","select_replies":"выбрать +ответы","delete":"удалить выбранные","cancel":"отменить выделение","select_all":"выбрать все","deselect_all":"снять весь выбор","description":{"one":"Вы выбрали \u003cb\u003e{{count}}\u003c/b\u003e сообщение.","few":"Вы выбрали \u003cb\u003e{{count}}\u003c/b\u003e сообщения.","many":"Вы выбрали \u003cb\u003e{{count}}\u003c/b\u003e сообщений.","other":"Вы выбрали \u003cb\u003e{{count}}\u003c/b\u003e сообщений."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"ответить цитированием","edit":"Изменить {{link}} {{replyAvatar}} {{username}}","edit_reason":"Причина:","post_number":"сообщение {{number}}","last_edited_on":"последний раз сообщение редактировалось","reply_as_new_topic":"Ответить в новой связанной теме","continue_discussion":"Продолжить обсуждение из {{postLink}}:","follow_quote":"перейти к цитируемому сообщению","show_full":"Показать полный текст","show_hidden":"Отобразить скрытое содержимое.","deleted_by_author":{"one":"(сообщение отозвано автором и будет автоматически удалено в течение %{count} часа, если только на сообщение не поступит жалоба)","few":"(сообщение отозвано автором и будет автоматически удалено в течение %{count} часов, если только на сообщение не поступит жалоба)","many":"(сообщение отозвано автором и будет автоматически удалено в течение %{count} часов, если только на сообщение не поступит жалоба)","other":"(сообщение отозвано автором и будет автоматически удалено в течение %{count} часов, если только на сообщение не поступит жалоба)"},"expand_collapse":"развернуть/свернуть","gap":{"one":"просмотреть {{count}} скрытый ответ","few":"просмотреть {{count}} скрытых ответов","many":"просмотреть {{count}} скрытых ответов","other":"просмотреть {{count}} скрытых ответов"},"unread":"Сообщение не прочитано","has_replies":{"one":"{{count}} Ответ","few":"{{count}} Ответа","many":"{{count}} Ответов","other":"{{count}} Ответов"},"has_likes":{"one":"{{count}} симпатия","few":"{{count}} симпатии","many":"{{count}} симпатий","other":"{{count}} симпатий"},"has_likes_title":{"one":"Это сообщение понравилось {{count}} человеку","few":"Это сообщение понравилось {{count}} людям","many":"Это сообщение понравилось {{count}} людям","other":"Это сообщение понравилось {{count}} людям"},"has_likes_title_only_you":"Вам понравилось это сообщение","errors":{"create":"К сожалению, не удалось создать сообщение из-за ошибки. Попробуйте еще раз.","edit":"К сожалению, не удалось изменить сообщение. Попробуйте еще раз.","upload":"К сожалению, не удалось загрузить файл. Попробуйте еще раз.","too_many_uploads":"К сожалению, за один раз можно загрузить только одно изображение.","upload_not_authorized":"К сожалению, вы не можете загрузить файл данного типа (список разрешенных типов файлов: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"К сожалению, загрузка изображений недоступна новым пользователям.","attachment_upload_not_allowed_for_new_user":"К сожалению, загрузка файлов недоступна новым пользователям.","attachment_download_requires_login":"Войдите, чтобы скачивать прикрепленные файлы."},"abandon":{"confirm":"Вы уверены, что хотите отказаться от сообщения?","no_value":"Нет, оставить","yes_value":"Да, отказаться"},"via_email":"это сообщение пришло с почты","whisper":"Это внутреннее сообщение, т.е. оно видно только модераторам","archetypes":{"save":"Параметры сохранения"},"controls":{"reply":"начать составление ответа на сообщение","like":"мне нравится","has_liked":"Вам понравилось это сообщение","undo_like":"больше не нравится","edit":"Изменить сообщение","edit_anonymous":"Войдите, чтобы отредактировать это сообщение.","flag":"пожаловаться на сообщение","delete":"удалить сообщение","undelete":"отменить удаление","share":"поделиться ссылкой на сообщение","more":"Ещё","delete_replies":{"confirm":{"one":"Хотите ли вы удалить также и {{count}} прямой ответ к этому сообщению?","few":"Хотите ли вы удалить также и {{count}} прямых ответа к этому сообщению?","many":"Хотите ли вы удалить также и {{count}} прямых ответов к этому сообщению?","other":"Хотите ли вы удалить также и {{count}} прямых ответов к этому сообщению?"},"yes_value":"Да, так же удалить ответы","no_value":"Нет, удалить только сообщение"},"admin":"действия администратора над сообщением","wiki":"Сделать вики-сообщением","unwiki":"Отменить вики-сообщение","convert_to_moderator":"Добавить цвет модератора","revert_to_regular":"Убрать цвет модератора","rebake":"Обработать сообщение заново - HTML","unhide":"Снова сделать видимым","change_owner":"Изменить владельца"},"actions":{"flag":"Жалоба","defer_flags":{"one":"Отложить жалобу","few":"Отложить жалобы","many":"Отложить жалобы","other":"Отложить жалобы"},"undo":{"off_topic":"Отозвать жалобу","spam":"Отозвать жалобу","inappropriate":"Отозвать жалобу","bookmark":"Удалить из закладок","like":"Больше не нравится","vote":"Отозвать голос"},"people":{"spam":"отмечено как спам","inappropriate":"отмеченно как неуместное","notify_moderators":"уведомлёные модераторы","notify_user":"отправил сообщение","like":"понравилось это","vote":"проголосовал за это"},"by_you":{"off_topic":"Помечена вами как оффтопик","spam":"Помечена вами как спам","inappropriate":"Помечена вами как неуместное","notify_moderators":"Вы отправили жалобу модератору","notify_user":"Вы отправили сообщение этому пользователю","bookmark":"Вы добавили сообщение в закладки","like":"Вам нравится","vote":"Вы проголосовали за данное сообщение"},"by_you_and_others":{"off_topic":{"one":"Вы и еще {{count}} человек отметили это как не относящееся к теме","few":"Вы и еще {{count}} человека отметили это как не относящееся к теме","many":"Вы и еще {{count}} человек отметили это как не относящееся к теме","other":"Вы и еще {{count}} человек отметили это как не относящееся к теме"},"spam":{"one":"Вы и еще {{count}} человек отметили это как спам","few":"Вы и еще {{count}} человека отметили это как спам","many":"Вы и еще {{count}} человек отметили это как спам","other":"Вы и еще {{count}} человек отметили это как спам"},"inappropriate":{"one":"Вы и еще {{count}} человек отметили это как неуместное","few":"Вы и еще {{count}} человека отметили это как неуместное","many":"Вы и еще {{count}} человек отметили это как неуместное","other":"Вы и еще {{count}} человек отметили это как неуместное"},"notify_moderators":{"one":"Вы и еще {{count}} человек отметили это как требующее модерации","few":"Вы и еще {{count}} человека отметили это как требующее модерации","many":"Вы и еще {{count}} человек отметили это как требующее модерации","other":"Вы и еще {{count}} человек отметили это как требующее модерации"},"notify_user":{"one":"Вы и еще 1 человек отправили сообщение этому пользователю","few":"Вы и еще {{count}} человека отправили сообщение этому пользователю","other":"Вы и еще {{count}} человек отправили сообщение этому пользователю"},"bookmark":{"one":"Вы и еще {{count}} человек добавили это сообщение в закладки","few":"Вы и еще {{count}} человека добавили это сообщение в закладки","many":"Вы и еще {{count}} человек добавили это сообщение в закладки","other":"Вы и еще {{count}} человек добавили это сообщение в закладки"},"like":{"one":"Вам и еще {{count}} человеку понравилось","few":"Вам и еще {{count}} людям понравилось","many":"Вам и еще {{count}} людям понравилось","other":"Вам и еще {{count}} людям понравилось"},"vote":{"one":"Вы и еще {{count}} человек проголосовали за это сообщение","few":"Вы и еще {{count}} человека проголосовали за это сообщение","many":"Вы и еще {{count}} человек проголосовали за это сообщение","other":"Вы и еще {{count}} человек проголосовали за это сообщение"}},"by_others":{"off_topic":{"one":"{{count}} человек отметил это как не относящееся к теме","few":"{{count}} человека отметили это как не относящееся к теме","many":"{{count}} человек отметили это как не относящееся к теме","other":"{{count}} человек отметили это как не относящееся к теме"},"spam":{"one":"{{count}} человек отметил это как спам","few":"{{count}} человека отметили это как спам","many":"{{count}} человек отметили это как спам","other":"{{count}} человек отметили это как спам"},"inappropriate":{"one":"{{count}} человек отметил это как неуместное","few":"{{count}} человек отметили это как неуместное","many":"{{count}} человек отметили это как неуместное","other":"{{count}} человек отметили это как неуместное"},"notify_moderators":{"one":"{{count}} человек отметил это как требующее модерации","few":"{{count}} человека отметили это как требующее модерации","many":"{{count}} человек отметили это как требующее модерации","other":"{{count}} человек отметили это как требующее модерации"},"notify_user":{"one":"1 человек отправил сообщение этому пользователю","few":"{{count}} человека отправили сообщение этому пользователю","other":"{{count}} человек отправили сообщение этому пользователю"},"bookmark":{"one":"{{count}} человек добавил это сообщение в закладки","few":"{{count}} человека добавили это сообщение в закладки","many":"{{count}} человек добавили это сообщение в закладки","other":"{{count}} человек добавили это сообщение в закладки"},"like":{"one":"{{count}} человеку понравилось","few":"{{count}} людям понравилось","many":"{{count}} людям понравилось","other":"{{count}} людям понравилось"},"vote":{"one":"{{count}} человек проголосовал за это сообщение","few":"{{count}} человека проголосовали за это сообщение","many":"{{count}} человек проголосовали за это сообщение","other":"{{count}} человек проголосовали за это сообщение"}}},"delete":{"confirm":{"one":"Вы уверены, что хотите удалить это сообщение?","few":"Вы уверены, что хотите удалить все эти сообщения?","many":"Вы уверены, что хотите удалить все эти сообщения?","other":"Вы уверены, что хотите удалить все эти сообщения?"}},"revisions":{"controls":{"first":"Начальная версия","previous":"Предыдущая версия","next":"Следующая версия","last":"Последняя версия","hide":"Скрыть редакцию","show":"Показать редакцию","revert":"Откат до этой версии","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Отобразить сообщение с включенными добавлениями и удалениями.","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Отобразить сообщение с построчными изменениями","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Показать отличия редакций бок о бок","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Исходный текст"}}}},"category":{"can":"может\u0026hellip; ","none":"(вне раздела)","all":"Все разделы","choose":"Выберете раздел\u0026hellip;","edit":"изменить","edit_long":"Изменить","view":"Просмотр тем по разделам","general":"Общие","settings":"Настройки","topic_template":"Шаблон темы","delete":"Удалить раздел","create":"Создать Раздел","create_long":"Создать новый раздел","save":"Сохранить раздел","slug":"Ссылка на раздел","slug_placeholder":"(Опция) дефисы в url","creation_error":"При создании нового раздела возникла ошибка.","save_error":"При сохранении раздела возникла ошибка.","name":"Название раздела","description":"Описание","topic":"тема раздела","logo":"Логотип раздела","background_image":"Фоновое изображение раздела","badge_colors":"Цвета наград","background_color":"Цвет фона","foreground_color":"Цвет переднего плана","name_placeholder":"Не более одного-двух слов","color_placeholder":"Любой цвет из веб-палитры","delete_confirm":"Вы действительно хотите удалить раздел?","delete_error":"При удалении раздела произошла ошибка.","list":"Список разделов","no_description":"Пожалуйста, добавьте описание для этого раздела.","change_in_category_topic":"Изменить описание","already_used":"Цвет уже используется другим разделом","security":"Безопасность","special_warning":"Внимание: данный раздел был предустановлен и настройки безопасности не могут быть изменены. Если не хотите использовать этот раздел, удалите его вместо изменения.","images":"Изображения","auto_close_label":"Закрыть тему через:","auto_close_units":"часов","email_in":"Индивидуальный адрес входящей почты:","email_in_allow_strangers":"Принимать письма от анонимных пользователей без учетных записей","email_in_disabled":"Создание новых тем через электронную почту отключено в настройках сайта. Чтобы разрешить создание новых тем через электронную почту,","email_in_disabled_click":"активируйте настройку \"email in\".","allow_badges_label":"Разрешить вручение наград в этом разделе","edit_permissions":"Изменить права доступа","add_permission":"Добавить права","this_year":"за год","position":"местоположение","default_position":"Позиция по умолчанию","position_disabled":"Разделы будут показаны в порядке активности. Чтобы настроить порядок разделов,","position_disabled_click":"включите настройку \"fixed category positions\".","parent":"Родительский раздел","notifications":{"watching":{"title":"Наблюдать"},"tracking":{"title":"Следить"},"regular":{"title":"Уведомлять","description":"Уведомлять, если кто-нибудь упомянет мой @псевдоним или ответит на мое сообщение."},"muted":{"title":"Без уведомлений","description":"Не уведомлять о новых темах в этом разделе и скрыть их из последних."}}},"flagging":{"title":"Спасибо за вашу помощь в поддержании порядка!","action":"Пожаловаться","take_action":"Принять меры","notify_action":"Сообщение","official_warning":"Официальное предупреждение","delete_spammer":"Удалить спамера","yes_delete_spammer":"Да, удалить спамера","ip_address_missing":"(не доступно)","hidden_email_address":"(скрыто)","submit_tooltip":"Отправить приватную отметку","take_action_tooltip":"Достигнуть порога жалоб не дожидаясь большего количества жалоб от сообщества","cant":"Извините, но вы не можете сейчас послать жалобу.","formatted_name":{"off_topic":"Это не по теме","inappropriate":"Это неприемлемо","spam":"Это спам"},"custom_placeholder_notify_user":"Будьте точны, конструктивны и всегда доброжелательны.","custom_placeholder_notify_moderators":"Сообщите нам, чем конкретно вы обеспокоены и предоставьте соответствующие ссылки, если это возможно."},"flagging_topic":{"title":"Спасибо за вашу помощь!","action":"Пометить тему","notify_action":"Сообщение"},"topic_map":{"title":"Сводка по теме","participants_title":"Частые авторы","links_title":"Популярные ссылки","clicks":{"one":"1 клик","few":"%{count} клика","many":"%{count} кликов","other":"%{count} кликов"}},"topic_statuses":{"warning":{"help":"Это официальное предупреждение."},"bookmarked":{"help":"Вы добавили тему в закладки "},"locked":{"help":"Тема закрыта; в ней больше нельзя отвечать"},"archived":{"help":"Тема заархивирована и не может быть изменена"},"locked_and_archived":{"help":"Тема закрыта и заархивирована; в ней больше нельзя отвечать она больше не может быть изменена"},"unpinned":{"title":"Откреплена","help":"Эта тема для вас откреплена; она будет отображаться в обычном порядке"},"pinned_globally":{"title":"Закреплена глобально","help":"Эта тема закреплена глобально; она будет отображаться вверху как на главной, так и в своем разделе"},"pinned":{"title":"Закреплена","help":"Эта тема для вас закреплена; она будет показана вверху своего раздела"},"invisible":{"help":"Тема исключена из всех списков тем и доступна только по прямой ссылке"}},"posts":"Сообщ.","posts_long":"{{number}} сообщений в теме","original_post":"Начальное сообщение","views":"Просм.","views_lowercase":{"one":"просмотр","few":"просмотра","other":"просмотров"},"replies":"Ответов","views_long":"тема просмотрена {{number}} раз","activity":"Активность","likes":"Нрав.","likes_lowercase":{"one":"лайк","few":"лайка","other":"лайков"},"likes_long":"{{number}} лайков в теме","users":"Пользователи","users_lowercase":{"one":"пользователь","few":"пользователя","other":"пользователей"},"category_title":"Раздел","history":"История","changed_by":"автором {{author}}","raw_email":{"title":"Исходное письмо","not_available":"Не доступно!"},"categories_list":"Список разделов","filters":{"with_topics":"%{filter} темы","with_category":"%{filter} %{category} темы","latest":{"title":"Последние","title_with_count":{"one":"Последние (1)","few":"Последние ({{count}})","many":"Последние ({{count}})","other":"Последние ({{count}})"},"help":"темы с недавними сообщениями"},"hot":{"title":"Популярные","help":"подборка популярных тем"},"read":{"title":"Прочитанные","help":"темы, которые вас заинтересовали (в обратном хронологическом порядке)"},"search":{"title":"Поиск","help":"искать во всех темах"},"categories":{"title":"Разделы","title_in":"Раздел - {{categoryName}}","help":"все темы, сгруппированные по разделам"},"unread":{"title":"Непрочитанные","title_with_count":{"one":"Непрочитанные ({{count}})","few":"Непрочитанные ({{count}})","many":"Непрочитанные ({{count}})","other":"Непрочитанные ({{count}})"},"help":"наблюдаемые или отслеживаемые темы с непрочитанными сообщениями","lower_title_with_count":{"one":"{{count}} непрочитанная","few":"{{count}} непрочитанных","many":"{{count}} непрочитанных","other":"{{count}} непрочитанных"}},"new":{"lower_title_with_count":{"one":"{{count}} новая","few":"{{count}} новых","many":"{{count}} новых","other":"{{count}} новых"},"lower_title":"новые","title":"Новые","title_with_count":{"one":"Новые ({{count}})","few":"Новые ({{count}})","many":"Новые ({{count}})","other":"Новые ({{count}})"},"help":"темы, созданные за последние несколько дней"},"posted":{"title":"Мои","help":"темы, в которых вы принимали участие"},"bookmarks":{"title":"Закладки","help":"темы, которые вы добавили в закладки"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} ({{count}})","few":"{{categoryName}} ({{count}})","many":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"последние темы в разделе {{categoryName}}"},"top":{"title":"Обсуждаемые","help":"Самые активные темы за последний год, месяц, квартал, неделю или день","all":{"title":"За все время"},"yearly":{"title":"За год"},"quarterly":{"title":"За квартал"},"monthly":{"title":"За месяц"},"weekly":{"title":"За неделю"},"daily":{"title":"За день"},"all_time":"За все время","this_year":"За год","this_quarter":"За квартал","this_month":"За месяц","this_week":"За неделю","today":"За сегодня","other_periods":"показать самые обсуждаемые"}},"browser_update":"К сожалению, ваш браузер устарел и не поддерживается этим сайтом. Пожалуйста, \u003ca href=\"http://browsehappy.com\"\u003eобновите браузер\u003c/a\u003e (нажмите на ссылку, чтобы узнать больше).","permission_types":{"full":"Создавать / Отвечать / Просматривать","create_post":"Отвечать / Просматривать","readonly":"Просматривать"},"keyboard_shortcuts_help":{"title":"Сочетания клавиш","jump_to":{"title":"Быстрый переход","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Главная","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Последние","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Новые","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Непрочитанные","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Разделы","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Обсуждаемые","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Закладки","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Профиль","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Личные сообщения"},"navigation":{"title":"Навигация","jump":"\u003cb\u003e#\u003c/b\u003e Перейти к сообщению №","back":"\u003cb\u003eu\u003c/b\u003e Назад","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Двигать курсор выделения темы \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e или \u003cb\u003eEnter\u003c/b\u003e Открыть выделенную курсором тему","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Следующая/предыдущая секция"},"application":{"title":"Форум","create":"\u003cb\u003ec\u003c/b\u003e Создать тему","notifications":"\u003cb\u003en\u003c/b\u003e Открыть уведомления","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Открыть меню гамбургер","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Открыть меню профиля","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Показать обновленные темы","search":"\u003cb\u003e/\u003c/b\u003e Поиск","help":"\u003cb\u003e?\u003c/b\u003e Показать сочетания клавиш","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Отложить новые сообщения","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Отложить темы","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Выйти"},"actions":{"title":"Темы","bookmark_topic":" \u003cb\u003ef\u003c/b\u003e Добавить / удалить из заклодок","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Закрепить / Открепить тему","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Поделиться темой","share_post":"\u003cb\u003es\u003c/b\u003e Поделиться сообщением","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Ответить в новой связанной теме","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Ответить в теме","reply_post":"\u003cb\u003er\u003c/b\u003e Ответить на сообщение","quote_post":"\u003cb\u003eq\u003c/b\u003e Процитировать сообщение","like":"\u003cb\u003el\u003c/b\u003e Выразить симпатию за сообщение","flag":"\u003cb\u003e!\u003c/b\u003e Анонимная жалоба","bookmark":"\u003cb\u003eb\u003c/b\u003e Добавить сообщение в закладки","edit":"\u003cb\u003ee\u003c/b\u003e Редактировать сообщение","delete":"\u003cb\u003ed\u003c/b\u003e Удалить сообщение","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Откл. уведомления в теме","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Стандартные уведомления в теме (по-умолчанию)","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Следить за темой","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Наблюдать за темой"}},"tagging":{"all_tags":"Все теги","selector_all_tags":"Все теги","selector_no_tags":"Нет тегов","changed":"Теги изменены:","tags":"Теги","choose_for_topic":"Выберите теги для этой темы (опционально)","delete_tag":"Удалить тег","delete_confirm":"Вы уверены, что хотите удалить этот тег?","rename_tag":"Редактировать тег","rename_instructions":"Выберите новое название тега:","sort_by":"Сортировка:","sort_by_count":"Количество","sort_by_name":"Название","manage_groups":"Управление группами тегов","manage_groups_description":"Организуйте теги в группы","filters":{"without_category":"%{filter} темы с тегом %{tag}","with_category":"%{filter} темы с тегом %{tag} в разделе %{category}","untagged_without_category":"%{filter} темы без тегов","untagged_with_category":"%{filter} темы в разделе %{category} без тегов"},"notifications":{"watching":{"title":"Наблюдать","description":"Автоматически наблюдать за всеми темами с этим тегом.  Уведомлять о всех новых темах и сообщениях, а также показывать количество непрочитанных и новых сообщений рядом с названиями тем."},"watching_first_post":{"title":"Наблюдать создание тем","description":"Уведомлять только о первом сообщении в каждой новой теме с этим тегом."},"tracking":{"title":"Следить","description":"Автоматически следить за всеми темами с этим тегом. Показывать количество непрочитанных и новых сообщений рядом с названиями тем."},"regular":{"title":"Стандартные уведомления","description":"Уведомлять, только если кто-то упомянет меня по @псевдониму, или ответит на мое сообщение."},"muted":{"title":"Без уведомлений","description":"Не уведомлять об обновлениях в новых темах с этим тегом и не показывать на странице «Непрочитанные»."}},"groups":{"title":"Группы тегов","about":"Для простоты управления тегами, распределите их по группам","new":"Новая группа","tags_label":"Теги в этой группе:","parent_tag_label":"Родительский тег:","parent_tag_placeholder":"Опционально","parent_tag_description":"Теги из этой группы будут доступны только после добавления к теме родительского тега.","one_per_topic_label":"Разрешить не более одного тега из этой группы в одной теме","new_name":"Назание новой группы","save":"Сохранить","delete":"Удалить","confirm_delete":"Вы уверены, что хотите удалить эту группу тегов?"},"topics":{"none":{"unread":"Нет непрочитанных тем.","new":"Нет новых тем.","read":"Вы еще не прочитали ни одной темы.","posted":"Вы еще не принимали участие ни в одной теме.","latest":"Нет последних тем.","hot":"Нет популярных тем.","bookmarks":"У вас пока нет тем в закладках.","top":"Нет обсуждаемых тем.","search":"Поиск не дал результатов."},"bottom":{"latest":"Больше нет последних тем.","hot":"Больше нет популярных тем.","posted":"Больше нет тем с сообщениями.","read":"Больше нет прочитанных тем.","new":"Больше нет новых тем.","unread":"Больше нет непрочитанных тем.","top":"Больше нет обсуждаемых тем.","bookmarks":"Больше нет тем в закладках.","search":"Больше нет результатов поиска."}}},"poll":{"voters":{"one":"голос","few":"голоса","many":"голосов","other":"голосов"},"total_votes":{"one":"голос","few":"голоса","many":"голосов","other":"голосов"},"average_rating":"Средний рейтинг: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Голоса в этом опросе будут видны всем (в отличие от анонимных опросов)."},"multiple":{"help":{"at_least_min_options":{"one":"Выберите хотя бы \u003cstrong\u003e1\u003c/strong\u003e вариант ответа","few":"Выберите хотя бы \u003cstrong\u003e%{count}\u003c/strong\u003e варианта ответов","many":"Выберите хотя бы \u003cstrong\u003e%{count}\u003c/strong\u003e вариантов ответов","other":"Выберите хотя бы \u003cstrong\u003e%{count}\u003c/strong\u003e вариантов ответов"},"up_to_max_options":{"one":"Выберите не более \u003cstrong\u003e1\u003c/strong\u003e варианта ответа","few":"Выберите не более \u003cstrong\u003e%{count}\u003c/strong\u003e вариантов ответов","many":"Выберите не более \u003cstrong\u003e%{count}\u003c/strong\u003e вариантов ответов","other":"Выберите не более \u003cstrong\u003e%{count}\u003c/strong\u003e вариантов ответов"},"x_options":{"one":"Выберите \u003cstrong\u003e1\u003c/strong\u003e вариант ответа","few":"Выберите \u003cstrong\u003e%{count}\u003c/strong\u003e варианта ответотв","many":"Выберите \u003cstrong\u003e%{count}\u003c/strong\u003e вариантов ответов","other":"Выберите \u003cstrong\u003e%{count}\u003c/strong\u003e вариантов ответов"},"between_min_and_max_options":"Выберите от \u003cstrong\u003e%{min}\u003c/strong\u003e до \u003cstrong\u003e%{max}\u003c/strong\u003e вариантов ответов"}},"cast-votes":{"title":"Проголосуйте","label":"Проголосовать!"},"show-results":{"title":"Показать результаты","label":"Показать результаты"},"hide-results":{"title":"Вернуться к опросу","label":"Скрыть результаты"},"open":{"title":"Снова начать принимать новые голоса","label":"Открыть","confirm":"Вы уверены, что хотите открыть этот опрос и принимать новые голоса?"},"close":{"title":"Завершить этот опрос, не принимать новые голоса","label":"Завершить","confirm":"Вы уверены, что хотите завершить этот опрос и больше не принимать голоса?"},"error_while_toggling_status":"Произошла ошибка при смене статуса опроса.","error_while_casting_votes":"Произошла ошибка в процессе обработки вашего голоса.","error_while_fetching_voters":"В процессе получения списка проголосовавших произошла ошибка.","ui_builder":{"title":"Создать опрос","insert":"Вставить опрос в сообщение","help":{"options_count":"Введите хотя бы 2 варианта ответа"},"poll_type":{"label":"Тип опроса","regular":"Выбор одного варианта из списка","multiple":"Выбор нескольких вариантов из списка","number":"Шкала из чисел"},"poll_config":{"max":"Макс.","min":"Мин.","step":"Шаг"},"poll_public":{"label":"Показывать, кто голосовал (не отмечайте флажок, чтобы голосование было анонимным)"},"poll_options":{"label":"Введите варианты ответа, по одному на строку"}}},"type_to_filter":"Введите текст для фильтрации...","admin":{"title":"Discourse Admin","moderator":"Модератор","dashboard":{"title":"Админка","last_updated":"Последнее обновление статистики:","version":"Версия","up_to_date":"Обновлений нет","critical_available":"Доступно критическое обновление.","updates_available":"Доступны обновления.","please_upgrade":"Пожалуйста, обновитесь!","no_check_performed":"Проверка обновлений не производится. Убедитесь, что запущен процесс sidekiq.","stale_data":"Проверка обновлений не в последнее время не производилась. Убедитесь, что запущен процесс sidekiq.","version_check_pending":"Вы недавно обновились. Замечательно!","installed_version":"У вас","latest_version":"Последняя","problems_found":"Обнаружены некоторые проблемы в вашей установке:","last_checked":"Последняя проверка","refresh_problems":"Обновить","no_problems":"Проблем не обнаружено.","moderators":"Модераторы:","admins":"Администраторы:","blocked":"Заблокированы:","suspended":"Заморожены:","private_messages_short":"Сообщ.","private_messages_title":"Сообщений","mobile_title":"Мобильный","space_free":"свободно {{size}}","uploads":"Загрузки","backups":"Резервные копии","traffic_short":"Трафик","traffic":"Трафик (веб-запросы)","page_views":"Запросы API","page_views_short":"Запросы API","show_traffic_report":"Раширенный отчет по трафику","reports":{"today":"Сегодня","yesterday":"Вчера","last_7_days":"7 дней","last_30_days":"30 дней","all_time":"За все время","7_days_ago":"7 дней назад","30_days_ago":"30 дней назад","all":"Всего","view_table":"Таблица","refresh_report":"Обновить отчет","start_date":"Дата от","end_date":"Дата до","groups":"Все группы"}},"commits":{"latest_changes":"Обновления в репозитории Github","by":"от"},"flags":{"title":"Жалобы","old":"Старые","active":"Активные","agree":"Принять","agree_title":"Подтвердить корректность жалобы","agree_flag_modal_title":"Принять и...","agree_flag_hide_post":"Принять (скрыть сообщение и послать личное сообщение)","agree_flag_hide_post_title":"Скрыть сообщение и автоматически отправить пользователю сообщение с просьбой исправить его","agree_flag_restore_post":"Согласиться (восстановить сообщение)","agree_flag_restore_post_title":"Восстановить это сообщение","agree_flag":"Принять жалобу","agree_flag_title":"Принять жалобу, оставить сообщение без изменений","defer_flag":"Отложить","defer_flag_title":"Удалить эту жалобу - никаких действий на данный момент не требуется.","delete":"Удалить","delete_title":"Удалить обжалованное сообщение.","delete_post_defer_flag":"Удалить сообщение и отложить жалобу","delete_post_defer_flag_title":"Удалить сообщение; если это первое сообщение, удалить тему целиком","delete_post_agree_flag":"Принять жалобу, удалить сообщение","delete_post_agree_flag_title":"Удалить сообщение; если это первое сообщение, удалить тему целиком","delete_flag_modal_title":"Удалить и...","delete_spammer":"Удалить спамера","delete_spammer_title":"Удалить пользователя и все его темы и сообщения.","disagree_flag_unhide_post":"Отклонить (сделать сообщение видимым)","disagree_flag_unhide_post_title":"Удалить все жалобы на это сообщение и сделать его снова видимым","disagree_flag":"Отклонить","disagree_flag_title":"Отклонить эту жалобу как некорректную","clear_topic_flags":"Готово","clear_topic_flags_title":"Тема была просмотрена, и все проблемы были решены. Нажмите Готово, чтобы удалить все жалобы.","more":"(еще ответы...)","dispositions":{"agreed":"принято","disagreed":"отклонено","deferred":"отложено"},"flagged_by":"Отмечено","resolved_by":"Разрешено","took_action":"Принята мера","system":"Системные","error":"что-то пошло не так","reply_message":"Ответить","no_results":"Жалоб нет.","topic_flagged":"Эта \u003cstrong\u003eтема\u003c/strong\u003e была помечена.","visit_topic":"Посетите тему чтобы принять меры","was_edited":"Сообщение было отредактировано после первой жалобы","previous_flags_count":"На это сообщение уже пожаловались {{count}} раз(а).","summary":{"action_type_3":{"one":"вне темы","few":"вне темы x{{count}}","many":"вне темы x{{count}}","other":"вне темы x{{count}}"},"action_type_4":{"one":"неуместно","few":"неуместно x{{count}}","many":"неуместно x{{count}}","other":"неуместно x{{count}}"},"action_type_6":{"one":"другое","few":"других x{{count}}","many":"других x{{count}}","other":"других x{{count}}"},"action_type_7":{"one":"другое","few":"других x{{count}}","many":"других x{{count}}","other":"других x{{count}}"},"action_type_8":{"one":"спам","few":"спам x{{count}}","many":"спам x{{count}}","other":"спам x{{count}}"}}},"groups":{"primary":"Основная группа","no_primary":"(нет основной группы)","title":"Группы","edit":"Управление группами","refresh":"Обновить","new":"Добавить новую","selector_placeholder":"введите псевдоним","name_placeholder":"Название группы, без пробелов, по тем же правилам, что и для псевдонимов.","about":"Здесь можно редактировать группы и имена групп","group_members":"Участники группы","delete":"Удалить","delete_confirm":"Удалить эту группу?","delete_failed":"Невозможно удалить группу. Если группа была создана автоматически, то она не может быть удалена.","delete_member_confirm":"Удалить пользователя '%{username}' из группы '%{group}'?","delete_owner_confirm":"Отозвать права владельца у пользователя '%{username}'?","name":"Название","add":"Добавить","add_members":"Добавить участников","custom":"Настраиваемые","bulk_complete":"Пользователи успешно добавлены в группу.","bulk":"Массовое добавление в группу","bulk_paste":"Впишите список пользователей или адресов e-mail, по одному на строчку:","bulk_select":"(выберите группу)","automatic":"Автоматические","automatic_membership_email_domains":"Пользователи, которые регистрируются с доменом электронной почты из этого списка, будут автоматически добавлены в группу:","automatic_membership_retroactive":"Добавить в группу уже сущетсвующих зарегестрированных пользователей по этому правилу домена электронной почты","default_title":"Заголовок по умолчанию для всех пользователей в группе","primary_group":"Автоматически использовать в качестве основной группы","group_owners":"Владельцы","add_owners":"Добавить владельцев","incoming_email":"Специальный входящий адрес e-mail","incoming_email_placeholder":"введите e-mail"},"api":{"generate_master":"Сгенерировать ключ API","none":"Отсутствует ключ API.","user":"Пользователь","title":"API","key":"Ключ API","generate":"Сгенерировать","regenerate":"Перегенерировать","revoke":"Отозвать","confirm_regen":"Вы уверены, что хотите заменить ключ API?","confirm_revoke":"Вы уверены, что хотите отозвать этот ключ?","info_html":"Ваш API ключ позволит вам создавать и обновлять темы, используя JSON calls.","all_users":"Все пользователи","note_html":"Никому \u003cstrong\u003eне сообщайте\u003c/strong\u003e этот ключ. Тот, у кого он есть, сможет создавать сообщения, выдавая себя за любого пользователя форума."},"plugins":{"title":"Плагины","installed":"Установленные плагины","name":"Название","none_installed":"Нет ни одного установленного плагина.","version":"Версия","enabled":"Включен?","is_enabled":"Y","not_enabled":"N","change_settings":"Настроить","change_settings_short":"Настройки","howto":"Как установить плагин?"},"backups":{"title":"Резервные копии","menu":{"backups":"Резервные копии","logs":"Журнал событий"},"none":"Нет доступных резервных копий","logs":{"none":"Пока нет сообщений в журнале регистрации..."},"columns":{"filename":"Имя файла","size":"Размер"},"upload":{"label":"Загрузить","title":"Загрузить копию на сервер","uploading":"Загрузка...","success":"'{{filename}}' был успешно загружен.","error":"При загрузке '{{filename}}' произошла ошибка: {{message}}"},"operations":{"is_running":"Операция в данный момент исполняется...","failed":"{{operation}} провалилась. Пожалуйста, проверьте журнал регистрации.","cancel":{"label":"Отменить","title":"Отменить текущую операцию","confirm":"Вы уверены, что хотите отменить текущую операцию?"},"backup":{"label":"Резервная копия","title":"Создать резервную копию","confirm":"Запустить резервное копирование?","without_uploads":"Да (исключить файлы)"},"download":{"label":"Скачать","title":"Скачать резервную копию"},"destroy":{"title":"Удалить резервную копию","confirm":"Вы уверены, что хотите уничтожить резервную копию?"},"restore":{"is_disabled":"Восстановление отключено в настройках сайта.","label":"Восстановить","title":"Восстановить резервную копию","confirm":"Вы уверены, что хотите восстановить этот бэкап?"},"rollback":{"label":"Откатить","title":"Откатить базу данных к предыдущему рабочему состоянию","confirm":"Вы уверены, что хотите откатить базу данных до предыдущего рабочего состояния?"}}},"export_csv":{"user_archive_confirm":"Вы уверены, то хотите скачать все ваши сообщения?","success":"Процедура экспорта начата, мы отправим вам сообщение, когда процесс будет завершен.","failed":"Экспорт не удался. Пожалуйста, проверьте логи.","rate_limit_error":"Записи могут быть загружены один раз в день, пожалуйста, попробуйте еще раз завтра.","button_text":"Экспорт","button_title":{"user":"Экспортировать список пользователей в CSV файл.","staff_action":"Экспортировать полный журнал действий персонала в CSV-файл.","screened_email":"Экспортировать список email-адресов в CSV формате.","screened_ip":"Экспортировать список IP в CSV формате.","screened_url":"Экспортировать список URL-адресов в CSV формате."}},"export_json":{"button_text":"Экспорт"},"invite":{"button_text":"Отправить приглашения","button_title":"Отправить приглашения"},"customize":{"title":"Оформление","long_title":"Стили и заголовки","css":"CSS","header":"Заголовок","top":"Топ","footer":"нижний колонтитул","head_tag":{"text":"\u003c/head\u003e","title":"HTML код, который будет добавлен перед тегом \u003c/head\u003e."},"body_tag":{"text":"\u003c/body\u003e","title":"HTML код, который будет добавлен перед тегом \u003c/body\u003e."},"override_default":"Не использовать стандартную таблицу стилей","enabled":"Разрешить?","preview":"как будет","undo_preview":"удалить предпросмотр","rescue_preview":"стиль по умолчанию","explain_preview":"Посмотреть сайт с этой таблицей стилей","explain_undo_preview":"Вернуться к текущей таблице стилей","explain_rescue_preview":"Посмотреть сайт со стандартной таблицей стилей","save":"Сохранить","new":"Новое","new_style":"Новый стиль","import":"Импорт","import_title":"Выберите файл или вставьте текст","delete":"Удалить","delete_confirm":"Удалить настройки?","about":"Измените CSS стили и HTML заголовки на сайте. Чтобы начать, внесите правки.","color":"Цвет","opacity":"Прозрачность","copy":"Копировать","email_templates":{"subject":"Тема","body":"Текст сообщения","none_selected":"Выберите шаблон письма, чтобы начать редактирование.","revert":"Отменить изменения"},"css_html":{"title":"CSS/HTML","long_title":"Настройка CSS и HTML"},"colors":{"title":"Цвета","long_title":"Цветовые схемы","about":"Изменить цвета, используемые на этом сайте, без редактирования CSS. Добавьте новую схему для начала.","new_name":"Новая цветовая схема","copy_name_prefix":"Копия","delete_confirm":"Удалить эту цветовую схему?","undo":"отменить","undo_title":"Отменить ваши изменения этого цвета с момента последнего сохранения.","revert":"вернуть","revert_title":"Вернуть этот цвет к стандартной цветовой схеме Discourse.","primary":{"name":"первичный","description":"Большинство текстов, иконок и границ."},"secondary":{"name":"вторичный","description":"Основной цвет фона и цвет текста для некоторых кнопок."},"tertiary":{"name":"третичный","description":"Ссылки, некоторые кнопки, уведомления и акцентный цвет."},"quaternary":{"name":"четвертичный","description":"Навигационные ссылки."},"header_background":{"name":"фон заголовка","description":"Фоновый цвет заголовка сайта."},"header_primary":{"name":"основной цвет заголовка","description":"Текст и иконки в заголовке сайта."},"highlight":{"name":"выделение","description":"Фоновый цвет выделенных элементов на странице, таких как сообщения и темы."},"danger":{"name":"опасность","description":"Цвет выделения для таких действий, как удаление сообщений и тем."},"success":{"name":"успех","description":"Используется, чтобы показать, что действие выполнено успешно."},"love":{"name":"любовь","description":"Цвет кнопки «Мне нравится»."}}},"email":{"settings":"Настройки","templates":"Шаблоны","preview_digest":"Просмотр сводки","sending_test":"Отправка тестового письма...","error":"\u003cb\u003eОШИБКА\u003c/b\u003e - %{server_error}","test_error":"При отправке тестового письма произошла ошибка. Пожалуйста, внимательно проверьте ваши почтовые настройки, проверьте, что ваш сервер не блокирует почтовые соединения, и попытайтесь снова.","sent":"Отправлено","skipped":"Пропущенные","received":"Принято","rejected":"Отклонено","sent_at":"Отправлено","time":"Время","user":"Пользователь","email_type":"Тип e-mail","to_address":"Адрес","test_email_address":"Электронный адрес для проверки","send_test":"Отправить тестовое письмо","sent_test":"отправлено!","delivery_method":"Метод отправки","refresh":"Обновить","format":"Формат","html":"html","text":"текст","last_seen_user":"Последнее посещение:","reply_key":"Ключ ответа","skipped_reason":"Причина пропуска","incoming_emails":{"from_address":"От","to_addresses":"Кому","cc_addresses":"Скрытая копия","subject":"Тема","error":"Ошибка","none":"Входящих сообщений нет","modal":{"title":"Подробности Входящего Email","error":"Ошибка","subject":"Тема"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","error_placeholder":"Ошибка"}},"logs":{"none":"Записи в журнале регистрации не найдены.","filters":{"title":"Фильтр","user_placeholder":"псевдоним","address_placeholder":"name@example.com","type_placeholder":"дайджест, подписка...","reply_key_placeholder":"ключ ответа","skipped_reason_placeholder":"причина"}}},"logs":{"title":"Логи","action":"Действие","created_at":"Создано","last_match_at":"Последнее совпадение","match_count":"Совпадения","ip_address":"IP","topic_id":"ID темы","post_id":"ID сообщения","category_id":"ID раздела","delete":"Удалить","edit":"Изменить","save":"Сохранить","screened_actions":{"block":"заблокировать","do_nothing":"ничего не делать"},"staff_actions":{"title":"Действия персонала","instructions":"Кликните по псевдониму или действиям для фильтрации списка. Кликните по аватару для перехода на страницу пользователя.","clear_filters":"Показать все","staff_user":"Персонал","target_user":"Целевой пользователь","subject":"Субъект","when":"Когда","context":"Контекст","details":"Подробности","previous_value":"Старое","new_value":"Новое","diff":"Различия","show":"Показать","modal_title":"Подробности","no_previous":"Старое значение отсутствует.","deleted":"Новое значение отсутствует. Запись была удалена.","actions":{"delete_user":"удален пользователь","change_trust_level":"изменен уровень доверия","change_username":"изменен псевдоним","change_site_setting":"изменена настройка сайта","change_site_customization":"изменена настройка сайта","delete_site_customization":"удалена настройка сайта","change_site_text":"изменен текст","suspend_user":"пользователь заморожен","unsuspend_user":"пользователь разморожен","grant_badge":"выдана награда","revoke_badge":"отозвана награда","check_email":"доступ к адресу e-mail","delete_topic":"удалена тема","delete_post":"удалено сообщение","impersonate":"вход от имени пользователя","anonymize_user":"пользователь анонимизрован","roll_up":"сгруппированы заблокированные IP адреса в подсеть","change_category_settings":"изменена настройка раздела","delete_category":"удален раздел","create_category":"создан раздел","block_user":"пользователь заблокирован","unblock_user":"пользователь разблокирован","grant_admin":"выданы права администратора","revoke_admin":"отозваны права администратора","grant_moderation":"выданы права модератора","revoke_moderation":"отозваны права модератора"}},"screened_emails":{"title":"Почтовые адреса","description":"Когда кто-то создает новую учетную запись, проверяется данный почтовый адрес и регистрация блокируется или производятся другие дополнительные действия.","email":"Почтовый адрес","actions":{"allow":"Разрешить"}},"screened_urls":{"title":"Ссылки","description":"Список ссылок от пользователей, которые были идентифицированы как спамеры.","url":"URL","domain":"Домен"},"screened_ips":{"title":"IP адреса","description":"Список правил для IP адресов. Чтобы добавить IP адрес в белый список, используйте правило \"Разрешить\".","delete_confirm":"Удалить правило для IP адреса %{ip_address}?","roll_up_confirm":"Сгруппировать отдельные экранированные IP адреса в подсети?","rolled_up_some_subnets":"Заблокированные IP адреса сгруппированы в следующие подсети: %{subnets}.","rolled_up_no_subnet":"Ничего не найдено для группирования","actions":{"block":"Заблокировать","do_nothing":"Разрешить","allow_admin":"Разрешить админов"},"form":{"label":"Новое правило:","ip_address":"IP адрес","add":"Добавить","filter":"Поиск"},"roll_up":{"text":"Группировка","title":"Создание новой записи бана целой подсети если уже имеется хотя бы 'min_ban_entries_for_roll_up' записей отдельных IP адресов."}},"logster":{"title":"Журнаш ошибок"}},"impersonate":{"title":"Войти от имени пользователя","help":"Используйте этот инструмент, чтобы войти от имени пользователя. Может быть полезно для отладки. После этого необходимо выйти и зайти под своей учетной записью снова.","not_found":"Пользователь не найден.","invalid":"Извините, но вы не можете представиться этим пользователем."},"users":{"title":"Пользователи","create":"Добавить администратора","last_emailed":"Последнее письмо","not_found":"К сожалению, такой псевдоним не зарегистрирован.","id_not_found":"К сожалению, этот пользователь не зарегистрирован.","active":"Активные","show_emails":"Показать адреса e-mail","nav":{"new":"Новые","active":"Активные","pending":"Ожидает одобрения","staff":"Персонал","suspended":"Замороженные","blocked":"Заблокированные","suspect":"Подозрительные"},"approved":"Подтвердить?","approved_selected":{"one":"подтвердить пользователя","few":"подтвердить пользователей ({{count}})","many":"одобрить пользователей ({{count}})","other":"одобрить пользователей ({{count}})"},"reject_selected":{"one":"отклонить пользователя","few":"отклонить пользователей ({{count}})","many":"отклонить пользователей ({{count}})","other":"отклонить пользователей ({{count}})"},"titles":{"active":"Активные пользователи","new":"Новые пользователи","pending":"Пользователи, ожидающие одобрения","newuser":"Пользователи с уровнем доверия 0 (Новые пользователи)","basic":"Пользователи с уровнем доверия 1 (Базовые пользователи)","member":"Пользователи с уровнем доверия 2 (активные)","regular":"Пользователи с уровнем доверия 3 (лидеры сообщества)","leader":"Пользователи с уровнем доверия 4 (старейшины)","staff":"Персонал","admins":"Администраторы","moderators":"Модераторы","blocked":"Заблокированные пользователи","suspended":"Замороженные пользователи","suspect":"Подозрительные пользователи"},"reject_successful":{"one":"Успешно отклонен %{count} пользователь.","few":"Успешно отклонены %{count} пользователя.","many":"Успешно отклонены %{count} пользователей.","other":"Успешно отклонены %{count} пользователей."},"reject_failures":{"one":"Не удалось отклонить %{count} пользователя.","few":"Не удалось отклонить %{count} пользователей.","many":"Не удалось отклонить %{count} пользователей.","other":"Не удалось отклонить %{count} пользователей."},"not_verified":"Не проверенные","check_email":{"title":"Открыть e-mail этого пользователя","text":"Показать"}},"user":{"suspend_failed":"Ошибка заморозки пользователя {{error}}","unsuspend_failed":"Ошибка разморозки пользователя {{error}}","suspend_duration":"На сколько времени вы хотите заморозить пользователя?","suspend_duration_units":"(дней)","suspend_reason_label":"Причина заморозки? Данный текст \u003cb\u003eбудет виден всем\u003c/b\u003e на странице профиля пользователя и будет отображаться, когда пользователь пытается войти. Введите краткое описание.","suspend_reason":"Причина","suspended_by":"Заморожен","delete_all_posts":"Удалить все сообщения","suspend":"Заморозить","unsuspend":"Разморозить","suspended":"Заморожен?","moderator":"Модератор?","admin":"Администратор?","blocked":"Заблокирован?","show_admin_profile":"Администратор","edit_title":"Редактировать заголовок","save_title":"Сохранить заголовок","refresh_browsers":"Выполнить перезагрузку браузера","refresh_browsers_message":"Сообщение отправлено всем клиентам!","show_public_profile":"Показать публичный профиль","impersonate":"Представиться как пользователь","ip_lookup":"Поиск IP","log_out":"Выйти","logged_out":"Пользователь вышел с сайта на всех устройствах","revoke_admin":"Лишить прав Администратора","grant_admin":"Выдать права Администратора","revoke_moderation":"Лишить прав Модератора","grant_moderation":"Выдать права Модератора","unblock":"Разблокировать","block":"Заблокировать","reputation":"Репутация","permissions":"Права","activity":"Активность","like_count":"Симпатий выразил / получил","last_100_days":"за последние 100 дней","private_topics_count":"Частные темы","posts_read_count":"Прочитано сообщений","post_count":"Создано сообщений","topics_entered":"Просмотрено тем","flags_given_count":"Отправлено жалоб","flags_received_count":"Получено жалоб","warnings_received_count":"Получено предупреждений","flags_given_received_count":"Жалоб отправил / получил","approve":"Одобрить","approved_by":"кем одобрено","approve_success":"Пользователь одобрен и на электронную почту отправлено письмо с инструкцией по активации.","approve_bulk_success":"Успех! Все выбранные пользователи были одобрены и уведомлены.","time_read":"Время чтения","anonymize":"Анонимизировать пользователя","anonymize_confirm":"Вы точно УВЕРЕНЫ, что хотите анонимизировать эту учетную запись? Это приведет к изменению псевдонима и адреса электронной почты и очистит всю информацию профиля.","anonymize_yes":"Да, анонимизировать эту учетную запись","anonymize_failed":"Не удалось анонимизировать учетную запись.","delete":"Удалить пользователя","delete_forbidden_because_staff":"Администраторы и модераторы не могут быть удалены","delete_posts_forbidden_because_staff":"Нельзя удалить все сообщения администраторов и модераторов.","delete_forbidden":{"one":"Пользователи не могут быть удалены, если у них есть сообщения. Перед удалением пользователя удалите все его сообщения. (Сообщения старше %{count} дня не могут быть удалены.)","few":"Пользователи не могут быть удалены, если у них есть сообщения. Перед удалением пользователя удалите все его сообщения. (Сообщения старше %{count} дней не могут быть удалены.)","many":"Пользователи не могут быть удалены, если у них есть сообщения. Перед удалением пользователя удалите все его сообщения. (Сообщения старше %{count} дней не могут быть удалены.)","other":"Пользователи не могут быть удалены, если у них есть сообщения. Перед удалением пользователя удалите все его сообщения. (Сообщения старше %{count} дней не могут быть удалены.)"},"cant_delete_all_posts":{"one":"Не удается удалить все сообщения. Некоторые сообщения старше %{count} дня. (Настройка delete_user_max_post_age.)","few":"Не удается удалить все сообщения. Некоторые сообщения старше %{count} дней. (Настройка delete_user_max_post_age.)","many":"Не удается удалить все сообщения. Некоторые сообщения старше %{count} дней. (Настройка delete_user_max_post_age.)","other":"Не удается удалить все сообщения. Некоторые сообщения старше %{count} дней. (Настройка delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Не удается удалить все сообщения, потому что у пользователя более %{count} сообщения.  (Настройка delete_all_posts_max.)","few":"Не удается удалить все сообщения, потому что у пользователя более %{count} сообщений.  (Настройка delete_all_posts_max.)","many":"Не удается удалить все сообщения, потому что у пользователя более %{count} сообщений.  (Настройка delete_all_posts_max.)","other":"Не удается удалить все сообщения, потому что у пользователя более %{count} сообщений.  (Настройка delete_all_posts_max.)"},"delete_confirm":"Вы УВЕРЕНЫ, что хотите удалить этого пользователя? Это действие необратимо!","delete_and_block":"Удалить и \u003cb\u003eзаблокировать\u003c/b\u003e этот e-mail и IP адрес","delete_dont_block":"Только удалить","deleted":"Пользователь удален.","delete_failed":"При удалении пользователя возникла ошибка. Для удаления пользователя необходимо сначала удалить все его сообщения.","send_activation_email":"Послать активационное письмо","activation_email_sent":"Активационное письмо отправлено.","send_activation_email_failed":"К сожалению, возникла ошибка при повторной отправке активационного письма. %{error}","activate":"Активировать","activate_failed":"Во время активации пользователя произошла ошибка.","deactivate_account":"Деактивировать","deactivate_failed":"Во время деактивации пользователя произошла ошибка.","unblock_failed":"Не удалось разблокировать пользователя.","block_failed":"Не удалось заблокировать пользователя.","block_confirm":"Вы уверены что хотите заблокировать этого пользователя? Он больше не сможет создавать темы и отправлять сообщения.","block_accept":"Подтвердить блокировку","deactivate_explanation":"Дезактивированные пользователи должны заново подтвердить свой e-mail.","suspended_explanation":"Замороженный пользователь не может войти.","block_explanation":"Заблокированный не может отвечать и создавать новые темы.","trust_level_change_failed":"Возникла ошибка при изменении уровня доверия пользователя.","suspend_modal_title":"Заморозить пользователя","trust_level_2_users":"Пользователи с уровнем доверия 2","trust_level_3_requirements":"Требуется 3 уровень доверия","trust_level_locked_tip":"уровень доверия заморожен, система не сможет по надобности разжаловать или продвинуть пользователя","trust_level_unlocked_tip":"уровень доверия разморожен, система сможет по надобности разжаловать или продвинуть пользователя","lock_trust_level":"Заморозить уровень доверия","unlock_trust_level":"Разморозить уровень доверия","tl3_requirements":{"title":"Требования для 3 уровня доверия","value_heading":"Значение","requirement_heading":"Требование","visits":"Посещений","days":"дни","topics_replied_to":"Ответы на темы","topics_viewed":"Просмотрено тем","topics_viewed_all_time":"Просмотрено тем (за все время)","posts_read":"Прочитано сообщений","posts_read_all_time":"Прочитано сообщений (за все время)","flagged_posts":"Сообщения с жалобами","flagged_by_users":"Пользователи, подававшие жалобы","likes_given":"Выразил симпатий","likes_received":"Получил симпатий","likes_received_days":"Получено симпатий: отдельные дни","likes_received_users":"Получено симпатий: уникальные пользователи","qualifies":"Заслуживает уровень доверия 3.","does_not_qualify":"Не заслуживает уровень доверия 3.","will_be_promoted":"Пользователь будет скоро продвинут до этого уровня.","will_be_demoted":"Пользователь скоро будет разжалован.","on_grace_period":"В данный момент в периоде доверия и не может быть разжалован.","locked_will_not_be_promoted":"Уровень доверия заморожен, поэтому пользователь никогда не будет продвинут до этого уровня.","locked_will_not_be_demoted":"Уровень доверия заморожен, поэтому пользователь никогда не будет разжалован."},"sso":{"title":"Технология единого входа SSO","external_id":"Внешний идентификатор","external_username":"Псевдоним","external_name":"Имя","external_email":"E-mail","external_avatar_url":"URL фона профиля"}},"user_fields":{"title":"Поля пользователя","help":"Добавить поля, которые пользователи смогут заполнять.","create":"Создать поле пользователя","untitled":"Без заголовка","name":"Название поля","type":"Тип поля","description":"Описание поля","save":"Сохранить","edit":"Изменить","delete":"Удалить","cancel":"Отмена","delete_confirm":"Вы уверены, что хотите удалить это поле?","options":"Опции","required":{"title":"Обязательное во время регистрации?","enabled":"Обязательное","disabled":"Необязательное"},"editable":{"title":"Редактируемое после регистрации?","enabled":"Редактируемое","disabled":"Нередактируемое"},"show_on_profile":{"title":"Показывать в публичном профиле?","enabled":"Показывать в профиле","disabled":"Не показывать в профиле"},"show_on_user_card":{"title":"Показывать в карточке пользователя?","enabled":"показывается в карточке пользователя","disabled":"Не показывать в карточке пользователя"},"field_types":{"text":"Текстовое поле","confirm":"Подтверждение","dropdown":"Выпадающий список"}},"site_text":{"description":"Вы можете отредактировать любой текст на вашем форуме. Начните с поиска ниже:","search":"Найти текст, который вы хотите отредактировать","title":"Текстовое содержание","edit":"изменить","revert":"Отменить изменения","revert_confirm":"Вы уверены что хите отменить ваши изменения?","go_back":"Вернуться к поиску","recommended":"Мы рекомендуем изменить следующий текст под ваши нужды:","show_overriden":"Показывать только измененные"},"site_settings":{"show_overriden":"Показывать только измененные","title":"Настройки","reset":"Вернуть по умолчанию","none":"(нет)","no_results":"Ничего не найдено.","clear_filter":"Очистить","add_url":"Добавить URL","add_host":"добавить хост","categories":{"all_results":"Все настройки","required":"Обязательное","basic":"Основное","users":"Пользователи","posting":"Сообщения","email":"E-mail","files":"Файлы","trust":"Уровни доверия","security":"Безопасность","onebox":"Умная вставка","seo":"Поисковая оптимизация (SEO)","spam":"Спам","rate_limits":"Ограничения","developer":"Программистам","embedding":"Встраивание","legal":"Юридическое","uncategorized":"Вне разделов","backups":"Резервные копии","login":"Учетные записи","plugins":"Плагины","user_preferences":"Пользовательские настройки","tags":"Тэги"}},"badges":{"title":"Награды","new_badge":"Новая награда","new":"Новая","name":"Название","badge":"Награда","display_name":"Отображаемое название","description":"Описание","long_description":"Длинное описание","badge_type":"Тип награды","badge_grouping":"Группа","badge_groupings":{"modal_title":"Типы наград"},"granted_by":"Кем выдана","granted_at":"Когда выдана","reason_help":"(Ссылка на сообщение или тему)","save":"Сохранить","delete":"Удалить","delete_confirm":"Вы уверены, что хотите удалить эту награду?","revoke":"Отозвать","reason":"Причина","expand":"Развернуть \u0026hellip;","revoke_confirm":"Вы уверены, что хотите отозвать эту награду?","edit_badges":"Редактировать награды","grant_badge":"Выдать награду","granted_badges":"Выданные награды","grant":"Выдать","no_user_badges":"У %{name} нет ни одной награды.","no_badges":"Нет наград, которые можно было бы выдать.","none_selected":"Выберите награду в списке слева","allow_title":"Разрешить использовать название награды в качестве титула","multiple_grant":"Может быть предоставлен несколько раз","listable":"Отображать награду на публичной странице наград","enabled":"Активировать использование награды","icon":"Иконка","image":"Картинка","icon_help":"Используйте класс шрифта Font Awesome или ссылку на картинку","query":"Выборка награды (SQL)","target_posts":"Выборка целевых сообщений","auto_revoke":"Запускать запрос на отзыв ежедневно","show_posts":"Показывать сообщение, на основе которого была выдана награда, на странице наград","trigger":"Запуск","trigger_type":{"none":"Обновлять ежедневно","post_action":"Когда пользователь совершает действие над сообщением","post_revision":"Когда пользователь редактирует или создает сообщение","trust_level_change":"Когда пользователь меняет уровень доверия","user_change":"Когда создается или редактируется пользователь","post_processed":"После обработки сообщения"},"preview":{"link_text":"Предварительный просмотр выданных наград","plan_text":"Предварительный просмотр с анализом быстродействия","modal_title":"Предосмотр запроса награды","sql_error_header":"В запросе произошла ошибка.","error_help":"См. следующую ссылку с информацией по запросам для наград.","bad_count_warning":{"header":"ВНИМАНИЕ!","text":"Обнаружены несуществующие примеры выдачи наград. Это может произойти, когда запрос возвращает несуществующие идентификаторы ID пользователей или сообщений. Это может привести к неожиданным проблемам со временем, поэтому внимательно проверьте ваш запрос."},"no_grant_count":"Нет наград для выдачи.","grant_count":{"one":"Будет выдана \u003cb\u003e%{count}\u003c/b\u003e награда.","few":"\u003cb\u003e%{count}\u003c/b\u003e наград будут выданы.","many":"\u003cb\u003e%{count}\u003c/b\u003e наград будут выданы.","other":"\u003cb\u003e%{count}\u003c/b\u003e наград будут выданы."},"sample":"Пример:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e за сообщение в %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e за сообщение в %{link} в \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e в \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Иконки","help":"Добавить новые смайлики-emoji, которые будут доступны всем. (Подсказка: можно перетаскивать несколько файлов за раз)","add":"Добавить новую иконку","name":"Название","image":"Изображение","delete_confirm":"Вы уверены, что хотите удалить иконку :%{name}:?"},"embedding":{"confirm_delete":"Вы уверены, что хотите удалить это поле?","title":"Встраивание","host":"Разрешённые Хосты","edit":"изменить","category":"Опубликовать в разделе","add_host":"Добавить хост","settings":"Настройки встраивания","feed_settings":"Настройки Фида","embed_post_limit":"Максимальное количество вложенных сообщений","embed_username_key_from_feed":"Ключ для извлечения пользователя из ленты","embed_truncate":"Обрезать встроенные сообщения.","embed_whitelist_selector":"Селекторы CSS которые разрешены для использования.","embed_blacklist_selector":"Селекторы CSS которые запрещены для использования.","embed_classname_whitelist":"Разрешённые CSS-классы","feed_polling_enabled":"Импорт сообщений через RSS/ATOM","save":"Сохранить настройки встраивания"},"permalink":{"title":"Постоянные ссылки","url":"Ссылка URL","topic_id":"Номер темы","topic_title":"Тема","post_id":"Номер сообщения","post_title":"Сообщение","category_id":"Номер раздела","category_title":"Раздел","external_url":"Внешняя ссылка","delete_confirm":"Удалить эту постоянную ссылку?","form":{"label":"Новая постоянная ссылка:","add":"Добавить","filter":"Поиск по ссылке или внешней ссылке (URL)"}}}}},"en":{"js":{"groups":{"notifications":{"watching_first_post":{"title":"Watching First Post"},"tracking":{"description":"You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"email_activity_summary":"Activity Summary","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_tags":"Watching First Post","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email":{"frequency_immediately":"We'll email you immediately if you haven't read the thing we're emailing you about."},"email_previous_replies":{"title":"Include previous replies at the bottom of emails","unless_emailed":"unless previously sent"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","email_in_reply_to":"Include an excerpt of replied to post in emails","summary":{"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"most_replied_to_users":"Most Replied To"}},"read_only_mode":{"enabled":"This site is in read only mode. Please continue to browse, but replying, likes, and other actions are disabled for now."},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages in your {{group_name}} inbox\u003c/p\u003e"},"alt":{"invited_to_private_message":"Invited to a private message from","invited_to_topic":"Invited to a topic from","group_message_summary":"Messages in group inbox"}},"search":{"too_short":"Your search term is too short."},"topics":{"bulk":{"changed_tags":"The tags of those topics were changed."}},"topic":{"unsubscribe":{"stop_notifications":"You will now receive less notifications for \u003cstrong\u003e{{title}}\u003c/strong\u003e"},"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."}},"post":{"has_likes_title_you":{"one":"you and 1 other person liked this post","other":"you and {{count}} other people liked this post"},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","wiki":{"about":"this post is a wiki"},"few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","actions":{"people":{"off_topic":"flagged this as off-topic","bookmark":"bookmarked this"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","suppress_from_homepage":"Suppress this category from the homepage.","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}}},"customize":{"embedded_css":"Embedded CSS","email_templates":{"title":"Email Templates","multiple_subjects":"This email template has multiple subjects.","revert_confirm":"Are you sure you want to revert your changes?"}},"email":{"title":"Emails","bounced":"Bounced","preview_digest_desc":"Preview the content of the digest emails sent to inactive users.","incoming_emails":{"modal":{"headers":"Headers","body":"Body","rejection_message":"Rejection Mail"},"filters":{"subject_placeholder":"Subject..."}}},"logs":{"staff_actions":{"actions":{"backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"get_started":"If you'd like to embed Discourse on another website, begin by adding its host.","sample":"Use the following HTML code into your site to create and embed discourse topics. Replace \u003cb\u003eREPLACE_ME\u003c/b\u003e with the canonical URL of the page you are embedding it on.","path_whitelist":"Path Whitelist","feed_description":"Providing an RSS/ATOM feed for your site can improve Discourse's ability to import your content.","crawling_settings":"Crawler Settings","crawling_description":"When Discourse creates topics for your posts, if no RSS/ATOM feed is present it will attempt to parse your content out of your HTML. Sometimes it can be challenging to extract your content, so we provide the ability to specify CSS rules to make extraction easier.","embed_by_username":"Username for topic creation","embed_title_scrubber":"Regular expression used to scrub the title of posts","feed_polling_url":"URL of RSS/ATOM feed to crawl"}}}}};
I18n.locale = 'ru';
//! moment.js
//! version : 2.13.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, function () { 'use strict';

    var hookCallback;

    function utils_hooks__hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function create_utc__createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function valid__isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            m._isValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                m._isValid = m._isValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function valid__createInvalid (flags) {
        var m = create_utc__createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    function isUndefined(input) {
        return input === void 0;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = utils_hooks__hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            utils_hooks__hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (utils_hooks__hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (utils_hooks__hooks.deprecationHandler != null) {
                utils_hooks__hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(arguments).join(', ') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (utils_hooks__hooks.deprecationHandler != null) {
            utils_hooks__hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    utils_hooks__hooks.suppressDeprecationWarnings = false;
    utils_hooks__hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function isObject(input) {
        return Object.prototype.toString.call(input) === '[object Object]';
    }

    function locale_set__set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _ordinalParseLenient.
        this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    // internal storage for locale config files
    var locales = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we
                // want to undo that for lazy loaded locales
                locale_locales__getSetGlobalLocale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function locale_locales__getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = locale_locales__getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale');
                config = mergeConfigs(locales[name]._config, config);
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    config = mergeConfigs(locales[config.parentLocale]._config, config);
                } else {
                    // treat as if there is no base config
                    deprecateSimple('parentLocaleUndefined',
                            'specified parentLocale is not defined yet');
                }
            }
            locales[name] = new Locale(config);

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale;
            if (locales[name] != null) {
                config = mergeConfigs(locales[name]._config, config);
            }
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            locale_locales__getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function locale_locales__getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function locale_locales__listLocales() {
        return keys(locales);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                get_set__set(this, unit, value);
                utils_hooks__hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get_set__get(this, unit);
            }
        };
    }

    function get_set__get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function get_set__set (mom, unit, value) {
        if (mom.isValid()) {
            mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    // MOMENTS

    function getSet (units, value) {
        var unit;
        if (typeof units === 'object') {
            for (unit in units) {
                this.set(unit, units[unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i;


    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (typeof callback === 'number') {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        return isArray(this._months) ? this._months[m.month()] :
            this._months[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function units_month__handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = create_utc__createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return units_month__handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (typeof value !== 'number') {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            utils_hooks__hooks.updateOffset(this, true);
            return this;
        } else {
            return get_set__get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    utils_hooks__hooks.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is discouraged and will be removed in upcoming major release. Please refer to https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    function createDate (y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0 && isFinite(date.getFullYear())) {
            date.setFullYear(y);
        }
        return date;
    }

    function createUTCDate (y) {
        var date = new Date(Date.UTC.apply(null, arguments));

        //the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0 && isFinite(date.getUTCFullYear())) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? utils_hooks__hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = utils_hooks__hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    utils_hooks__hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(utils_hooks__hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(local__createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = defaults(w.gg, config._a[YEAR], weekOfYear(local__createLocal(), dow, doy).year);
            week = defaults(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // constant that refers to the ISO standard
    utils_hooks__hooks.ISO_8601 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === utils_hooks__hooks.ISO_8601) {
            configFromISO(config);
            return;
        }

        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (getParsingFlags(config).bigHour === true &&
                config._a[HOUR] <= 12 &&
                config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!valid__isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || locale_locales__getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return valid__createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        } else if (isDate(input)) {
            config._d = input;
        } else {
            configFromInput(config);
        }

        if (!valid__isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (input === undefined) {
            config._d = new Date(utils_hooks__hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (typeof(input) === 'object') {
            configFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            utils_hooks__hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function local__createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
         'moment().min is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
         function () {
             var other = local__createLocal.apply(null, arguments);
             if (this.isValid() && other.isValid()) {
                 return other < this ? this : other;
             } else {
                 return valid__createInvalid();
             }
         }
     );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
        function () {
            var other = local__createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return valid__createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return local__createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = locale_locales__getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = ((string || '').match(matcher) || []);
        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : local__createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            utils_hooks__hooks.updateOffset(res, false);
            return res;
        } else {
            return local__createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    utils_hooks__hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
            } else if (Math.abs(input) < 16) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    add_subtract__addSubtract(this, create__createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    utils_hooks__hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm) {
            this.utcOffset(this._tzm);
        } else if (typeof this._i === 'string') {
            this.utcOffset(offsetFromString(matchOffset, this._i));
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? local__createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? create_utc__createUTC(c._a) : local__createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?\d*)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-)?P(?:(-?[0-9,.]*)Y)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)W)?(?:(-?[0-9,.]*)D)?(?:T(?:(-?[0-9,.]*)H)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)S)?)?$/;

    function create__createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])        * sign,
                h  : toInt(match[HOUR])        * sign,
                m  : toInt(match[MINUTE])      * sign,
                s  : toInt(match[SECOND])      * sign,
                ms : toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(local__createLocal(duration.from), local__createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    create__createDuration.fn = Duration.prototype;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = create__createDuration(val, period);
            add_subtract__addSubtract(this, dur, direction);
            return this;
        };
    }

    function add_subtract__addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (days) {
            get_set__set(mom, 'Date', get_set__get(mom, 'Date') + days * isAdding);
        }
        if (months) {
            setMonth(mom, get_set__get(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            utils_hooks__hooks.updateOffset(mom, days || months);
        }
    }

    var add_subtract__add      = createAdder(1, 'add');
    var add_subtract__subtract = createAdder(-1, 'subtract');

    function moment_calendar__calendar (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || local__createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            diff = this.diff(sod, 'days', true),
            format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format]() : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, local__createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(from, units) : !this.isBefore(from, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(to, units) : !this.isAfter(to, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : local__createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units || 'millisecond');
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input,units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input,units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            delta, output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        if (units === 'year' || units === 'month' || units === 'quarter') {
            output = monthDiff(this, that);
            if (units === 'quarter') {
                output = output / 3;
            } else if (units === 'year') {
                output = output / 12;
            }
        } else {
            delta = this - that;
            output = units === 'second' ? delta / 1e3 : // 1000
                units === 'minute' ? delta / 6e4 : // 1000 * 60
                units === 'hour' ? delta / 36e5 : // 1000 * 60 * 60
                units === 'day' ? (delta - zoneDelta) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                units === 'week' ? (delta - zoneDelta) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                delta;
        }
        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    utils_hooks__hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    utils_hooks__hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function moment_format__toISOString () {
        var m = this.clone().utc();
        if (0 < m.year() && m.year() <= 9999) {
            if (isFunction(Date.prototype.toISOString)) {
                // native implementation is ~50x faster, use it when we can
                return this.toDate().toISOString();
            } else {
                return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        } else {
            return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        }
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? utils_hooks__hooks.defaultFormatUtc : utils_hooks__hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 local__createLocal(time).isValid())) {
            return create__createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(local__createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 local__createLocal(time).isValid())) {
            return create__createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(local__createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = locale_locales__getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    function startOf (units) {
        units = normalizeUnits(units);
        // the following switch intentionally omits break keywords
        // to utilize falling through the cases.
        switch (units) {
        case 'year':
            this.month(0);
            /* falls through */
        case 'quarter':
        case 'month':
            this.date(1);
            /* falls through */
        case 'week':
        case 'isoWeek':
        case 'day':
        case 'date':
            this.hours(0);
            /* falls through */
        case 'hour':
            this.minutes(0);
            /* falls through */
        case 'minute':
            this.seconds(0);
            /* falls through */
        case 'second':
            this.milliseconds(0);
        }

        // weeks are a special case
        if (units === 'week') {
            this.weekday(0);
        }
        if (units === 'isoWeek') {
            this.isoWeekday(1);
        }

        // quarters are also special
        if (units === 'quarter') {
            this.month(Math.floor(this.month() / 3) * 3);
        }

        return this;
    }

    function endOf (units) {
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond') {
            return this;
        }

        // 'date' is an alias for 'day', so it should be considered as such.
        if (units === 'date') {
            units = 'day';
        }

        return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
    }

    function to_type__valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return this._offset ? new Date(this.valueOf()) : this._d;
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function moment_valid__isValid () {
        return valid__isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = utils_hooks__hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 1st is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        return isStrict ? locale._ordinalParse : locale._ordinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0], 10);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    // LOCALES

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        return isArray(this._weekdays) ? this._weekdays[m.day()] :
            this._weekdays[this._weekdays.isFormat.test(format) ? 'format' : 'standalone'][m.day()];
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return this._weekdaysShort[m.day()];
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return this._weekdaysMin[m.day()];
    }

    function day_of_week__handleStrictParse(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = create_utc__createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return day_of_week__handleStrictParse.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = create_utc__createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.
        return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = create_utc__createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var momentPrototype__proto = Moment.prototype;

    momentPrototype__proto.add               = add_subtract__add;
    momentPrototype__proto.calendar          = moment_calendar__calendar;
    momentPrototype__proto.clone             = clone;
    momentPrototype__proto.diff              = diff;
    momentPrototype__proto.endOf             = endOf;
    momentPrototype__proto.format            = format;
    momentPrototype__proto.from              = from;
    momentPrototype__proto.fromNow           = fromNow;
    momentPrototype__proto.to                = to;
    momentPrototype__proto.toNow             = toNow;
    momentPrototype__proto.get               = getSet;
    momentPrototype__proto.invalidAt         = invalidAt;
    momentPrototype__proto.isAfter           = isAfter;
    momentPrototype__proto.isBefore          = isBefore;
    momentPrototype__proto.isBetween         = isBetween;
    momentPrototype__proto.isSame            = isSame;
    momentPrototype__proto.isSameOrAfter     = isSameOrAfter;
    momentPrototype__proto.isSameOrBefore    = isSameOrBefore;
    momentPrototype__proto.isValid           = moment_valid__isValid;
    momentPrototype__proto.lang              = lang;
    momentPrototype__proto.locale            = locale;
    momentPrototype__proto.localeData        = localeData;
    momentPrototype__proto.max               = prototypeMax;
    momentPrototype__proto.min               = prototypeMin;
    momentPrototype__proto.parsingFlags      = parsingFlags;
    momentPrototype__proto.set               = getSet;
    momentPrototype__proto.startOf           = startOf;
    momentPrototype__proto.subtract          = add_subtract__subtract;
    momentPrototype__proto.toArray           = toArray;
    momentPrototype__proto.toObject          = toObject;
    momentPrototype__proto.toDate            = toDate;
    momentPrototype__proto.toISOString       = moment_format__toISOString;
    momentPrototype__proto.toJSON            = toJSON;
    momentPrototype__proto.toString          = toString;
    momentPrototype__proto.unix              = unix;
    momentPrototype__proto.valueOf           = to_type__valueOf;
    momentPrototype__proto.creationData      = creationData;

    // Year
    momentPrototype__proto.year       = getSetYear;
    momentPrototype__proto.isLeapYear = getIsLeapYear;

    // Week Year
    momentPrototype__proto.weekYear    = getSetWeekYear;
    momentPrototype__proto.isoWeekYear = getSetISOWeekYear;

    // Quarter
    momentPrototype__proto.quarter = momentPrototype__proto.quarters = getSetQuarter;

    // Month
    momentPrototype__proto.month       = getSetMonth;
    momentPrototype__proto.daysInMonth = getDaysInMonth;

    // Week
    momentPrototype__proto.week           = momentPrototype__proto.weeks        = getSetWeek;
    momentPrototype__proto.isoWeek        = momentPrototype__proto.isoWeeks     = getSetISOWeek;
    momentPrototype__proto.weeksInYear    = getWeeksInYear;
    momentPrototype__proto.isoWeeksInYear = getISOWeeksInYear;

    // Day
    momentPrototype__proto.date       = getSetDayOfMonth;
    momentPrototype__proto.day        = momentPrototype__proto.days             = getSetDayOfWeek;
    momentPrototype__proto.weekday    = getSetLocaleDayOfWeek;
    momentPrototype__proto.isoWeekday = getSetISODayOfWeek;
    momentPrototype__proto.dayOfYear  = getSetDayOfYear;

    // Hour
    momentPrototype__proto.hour = momentPrototype__proto.hours = getSetHour;

    // Minute
    momentPrototype__proto.minute = momentPrototype__proto.minutes = getSetMinute;

    // Second
    momentPrototype__proto.second = momentPrototype__proto.seconds = getSetSecond;

    // Millisecond
    momentPrototype__proto.millisecond = momentPrototype__proto.milliseconds = getSetMillisecond;

    // Offset
    momentPrototype__proto.utcOffset            = getSetOffset;
    momentPrototype__proto.utc                  = setOffsetToUTC;
    momentPrototype__proto.local                = setOffsetToLocal;
    momentPrototype__proto.parseZone            = setOffsetToParsedOffset;
    momentPrototype__proto.hasAlignedHourOffset = hasAlignedHourOffset;
    momentPrototype__proto.isDST                = isDaylightSavingTime;
    momentPrototype__proto.isDSTShifted         = isDaylightSavingTimeShifted;
    momentPrototype__proto.isLocal              = isLocal;
    momentPrototype__proto.isUtcOffset          = isUtcOffset;
    momentPrototype__proto.isUtc                = isUtc;
    momentPrototype__proto.isUTC                = isUtc;

    // Timezone
    momentPrototype__proto.zoneAbbr = getZoneAbbr;
    momentPrototype__proto.zoneName = getZoneName;

    // Deprecations
    momentPrototype__proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    momentPrototype__proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    momentPrototype__proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    momentPrototype__proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. https://github.com/moment/moment/issues/1779', getSetZone);

    var momentPrototype = momentPrototype__proto;

    function moment__createUnix (input) {
        return local__createLocal(input * 1000);
    }

    function moment__createInZone () {
        return local__createLocal.apply(null, arguments).parseZone();
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function locale_calendar__calendar (key, mom, now) {
        var output = this._calendar[key];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    function preParsePostFormat (string) {
        return string;
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relative__relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var prototype__proto = Locale.prototype;

    prototype__proto._calendar       = defaultCalendar;
    prototype__proto.calendar        = locale_calendar__calendar;
    prototype__proto._longDateFormat = defaultLongDateFormat;
    prototype__proto.longDateFormat  = longDateFormat;
    prototype__proto._invalidDate    = defaultInvalidDate;
    prototype__proto.invalidDate     = invalidDate;
    prototype__proto._ordinal        = defaultOrdinal;
    prototype__proto.ordinal         = ordinal;
    prototype__proto._ordinalParse   = defaultOrdinalParse;
    prototype__proto.preparse        = preParsePostFormat;
    prototype__proto.postformat      = preParsePostFormat;
    prototype__proto._relativeTime   = defaultRelativeTime;
    prototype__proto.relativeTime    = relative__relativeTime;
    prototype__proto.pastFuture      = pastFuture;
    prototype__proto.set             = locale_set__set;

    // Month
    prototype__proto.months            =        localeMonths;
    prototype__proto._months           = defaultLocaleMonths;
    prototype__proto.monthsShort       =        localeMonthsShort;
    prototype__proto._monthsShort      = defaultLocaleMonthsShort;
    prototype__proto.monthsParse       =        localeMonthsParse;
    prototype__proto._monthsRegex      = defaultMonthsRegex;
    prototype__proto.monthsRegex       = monthsRegex;
    prototype__proto._monthsShortRegex = defaultMonthsShortRegex;
    prototype__proto.monthsShortRegex  = monthsShortRegex;

    // Week
    prototype__proto.week = localeWeek;
    prototype__proto._week = defaultLocaleWeek;
    prototype__proto.firstDayOfYear = localeFirstDayOfYear;
    prototype__proto.firstDayOfWeek = localeFirstDayOfWeek;

    // Day of Week
    prototype__proto.weekdays       =        localeWeekdays;
    prototype__proto._weekdays      = defaultLocaleWeekdays;
    prototype__proto.weekdaysMin    =        localeWeekdaysMin;
    prototype__proto._weekdaysMin   = defaultLocaleWeekdaysMin;
    prototype__proto.weekdaysShort  =        localeWeekdaysShort;
    prototype__proto._weekdaysShort = defaultLocaleWeekdaysShort;
    prototype__proto.weekdaysParse  =        localeWeekdaysParse;

    prototype__proto._weekdaysRegex      = defaultWeekdaysRegex;
    prototype__proto.weekdaysRegex       =        weekdaysRegex;
    prototype__proto._weekdaysShortRegex = defaultWeekdaysShortRegex;
    prototype__proto.weekdaysShortRegex  =        weekdaysShortRegex;
    prototype__proto._weekdaysMinRegex   = defaultWeekdaysMinRegex;
    prototype__proto.weekdaysMinRegex    =        weekdaysMinRegex;

    // Hours
    prototype__proto.isPM = localeIsPM;
    prototype__proto._meridiemParse = defaultLocaleMeridiemParse;
    prototype__proto.meridiem = localeMeridiem;

    function lists__get (format, index, field, setter) {
        var locale = locale_locales__getLocale();
        var utc = create_utc__createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (typeof format === 'number') {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return lists__get(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = lists__get(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = locale_locales__getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return lists__get(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = lists__get(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function lists__listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function lists__listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function lists__listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function lists__listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function lists__listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    locale_locales__getSetGlobalLocale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports
    utils_hooks__hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', locale_locales__getSetGlobalLocale);
    utils_hooks__hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', locale_locales__getLocale);

    var mathAbs = Math.abs;

    function duration_abs__abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function duration_add_subtract__addSubtract (duration, input, value, direction) {
        var other = create__createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function duration_add_subtract__add (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function duration_add_subtract__subtract (input, value) {
        return duration_add_subtract__addSubtract(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'year') {
            days   = this._days   + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            return units === 'month' ? months : months / 12;
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function duration_as__valueOf () {
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asYears        = makeAs('y');

    function duration_get__get (units) {
        units = normalizeUnits(units);
        return this[units + 's']();
    }

    function makeGetter(name) {
        return function () {
            return this._data[name];
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        s: 45,  // seconds to minute
        m: 45,  // minutes to hour
        h: 22,  // hours to day
        d: 26,  // days to month
        M: 11   // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function duration_humanize__relativeTime (posNegDuration, withoutSuffix, locale) {
        var duration = create__createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds < thresholds.s && ['s', seconds]  ||
                minutes <= 1           && ['m']           ||
                minutes < thresholds.m && ['mm', minutes] ||
                hours   <= 1           && ['h']           ||
                hours   < thresholds.h && ['hh', hours]   ||
                days    <= 1           && ['d']           ||
                days    < thresholds.d && ['dd', days]    ||
                months  <= 1           && ['M']           ||
                months  < thresholds.M && ['MM', months]  ||
                years   <= 1           && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set a threshold for relative time strings
    function duration_humanize__getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        return true;
    }

    function humanize (withSuffix) {
        var locale = this.localeData();
        var output = duration_humanize__relativeTime(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var iso_string__abs = Math.abs;

    function iso_string__toISOString() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        var seconds = iso_string__abs(this._milliseconds) / 1000;
        var days         = iso_string__abs(this._days);
        var months       = iso_string__abs(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds;
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        return (total < 0 ? '-' : '') +
            'P' +
            (Y ? Y + 'Y' : '') +
            (M ? M + 'M' : '') +
            (D ? D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? h + 'H' : '') +
            (m ? m + 'M' : '') +
            (s ? s + 'S' : '');
    }

    var duration_prototype__proto = Duration.prototype;

    duration_prototype__proto.abs            = duration_abs__abs;
    duration_prototype__proto.add            = duration_add_subtract__add;
    duration_prototype__proto.subtract       = duration_add_subtract__subtract;
    duration_prototype__proto.as             = as;
    duration_prototype__proto.asMilliseconds = asMilliseconds;
    duration_prototype__proto.asSeconds      = asSeconds;
    duration_prototype__proto.asMinutes      = asMinutes;
    duration_prototype__proto.asHours        = asHours;
    duration_prototype__proto.asDays         = asDays;
    duration_prototype__proto.asWeeks        = asWeeks;
    duration_prototype__proto.asMonths       = asMonths;
    duration_prototype__proto.asYears        = asYears;
    duration_prototype__proto.valueOf        = duration_as__valueOf;
    duration_prototype__proto._bubble        = bubble;
    duration_prototype__proto.get            = duration_get__get;
    duration_prototype__proto.milliseconds   = milliseconds;
    duration_prototype__proto.seconds        = seconds;
    duration_prototype__proto.minutes        = minutes;
    duration_prototype__proto.hours          = hours;
    duration_prototype__proto.days           = days;
    duration_prototype__proto.weeks          = weeks;
    duration_prototype__proto.months         = months;
    duration_prototype__proto.years          = years;
    duration_prototype__proto.humanize       = humanize;
    duration_prototype__proto.toISOString    = iso_string__toISOString;
    duration_prototype__proto.toString       = iso_string__toISOString;
    duration_prototype__proto.toJSON         = iso_string__toISOString;
    duration_prototype__proto.locale         = locale;
    duration_prototype__proto.localeData     = localeData;

    // Deprecations
    duration_prototype__proto.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', iso_string__toISOString);
    duration_prototype__proto.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    utils_hooks__hooks.version = '2.13.0';

    setHookCallback(local__createLocal);

    utils_hooks__hooks.fn                    = momentPrototype;
    utils_hooks__hooks.min                   = min;
    utils_hooks__hooks.max                   = max;
    utils_hooks__hooks.now                   = now;
    utils_hooks__hooks.utc                   = create_utc__createUTC;
    utils_hooks__hooks.unix                  = moment__createUnix;
    utils_hooks__hooks.months                = lists__listMonths;
    utils_hooks__hooks.isDate                = isDate;
    utils_hooks__hooks.locale                = locale_locales__getSetGlobalLocale;
    utils_hooks__hooks.invalid               = valid__createInvalid;
    utils_hooks__hooks.duration              = create__createDuration;
    utils_hooks__hooks.isMoment              = isMoment;
    utils_hooks__hooks.weekdays              = lists__listWeekdays;
    utils_hooks__hooks.parseZone             = moment__createInZone;
    utils_hooks__hooks.localeData            = locale_locales__getLocale;
    utils_hooks__hooks.isDuration            = isDuration;
    utils_hooks__hooks.monthsShort           = lists__listMonthsShort;
    utils_hooks__hooks.weekdaysMin           = lists__listWeekdaysMin;
    utils_hooks__hooks.defineLocale          = defineLocale;
    utils_hooks__hooks.updateLocale          = updateLocale;
    utils_hooks__hooks.locales               = locale_locales__listLocales;
    utils_hooks__hooks.weekdaysShort         = lists__listWeekdaysShort;
    utils_hooks__hooks.normalizeUnits        = normalizeUnits;
    utils_hooks__hooks.relativeTimeThreshold = duration_humanize__getSetRelativeTimeThreshold;
    utils_hooks__hooks.prototype             = momentPrototype;

    var _moment = utils_hooks__hooks;

    return _moment;

}));
//! moment.js locale configuration
//! locale : russian (ru)
//! author : Viktorminator : https://github.com/Viktorminator
//! Author : Menelion Elensúle : https://github.com/Oire
//! author : Коренберг Марк : https://github.com/socketpair

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    function plural(word, num) {
        var forms = word.split('_');
        return num % 10 === 1 && num % 100 !== 11 ? forms[0] : (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20) ? forms[1] : forms[2]);
    }
    function relativeTimeWithPlural(number, withoutSuffix, key) {
        var format = {
            'mm': withoutSuffix ? 'минута_минуты_минут' : 'минуту_минуты_минут',
            'hh': 'час_часа_часов',
            'dd': 'день_дня_дней',
            'MM': 'месяц_месяца_месяцев',
            'yy': 'год_года_лет'
        };
        if (key === 'm') {
            return withoutSuffix ? 'минута' : 'минуту';
        }
        else {
            return number + ' ' + plural(format[key], +number);
        }
    }
    var monthsParse = [/^янв/i, /^фев/i, /^мар/i, /^апр/i, /^ма[йя]/i, /^июн/i, /^июл/i, /^авг/i, /^сен/i, /^окт/i, /^ноя/i, /^дек/i];

    // http://new.gramota.ru/spravka/rules/139-prop : § 103
    // Сокращения месяцев: http://new.gramota.ru/spravka/buro/search-answer?s=242637
    // CLDR data:          http://www.unicode.org/cldr/charts/28/summary/ru.html#1753
    var ru = moment.defineLocale('ru', {
        months : {
            format: 'января_февраля_марта_апреля_мая_июня_июля_августа_сентября_октября_ноября_декабря'.split('_'),
            standalone: 'январь_февраль_март_апрель_май_июнь_июль_август_сентябрь_октябрь_ноябрь_декабрь'.split('_')
        },
        monthsShort : {
            // по CLDR именно "июл." и "июн.", но какой смысл менять букву на точку ?
            format: 'янв._февр._мар._апр._мая_июня_июля_авг._сент._окт._нояб._дек.'.split('_'),
            standalone: 'янв._февр._март_апр._май_июнь_июль_авг._сент._окт._нояб._дек.'.split('_')
        },
        weekdays : {
            standalone: 'воскресенье_понедельник_вторник_среда_четверг_пятница_суббота'.split('_'),
            format: 'воскресенье_понедельник_вторник_среду_четверг_пятницу_субботу'.split('_'),
            isFormat: /\[ ?[Вв] ?(?:прошлую|следующую|эту)? ?\] ?dddd/
        },
        weekdaysShort : 'вс_пн_вт_ср_чт_пт_сб'.split('_'),
        weekdaysMin : 'вс_пн_вт_ср_чт_пт_сб'.split('_'),
        monthsParse : monthsParse,
        longMonthsParse : monthsParse,
        shortMonthsParse : monthsParse,
        monthsRegex: /^(сентябр[яь]|октябр[яь]|декабр[яь]|феврал[яь]|январ[яь]|апрел[яь]|августа?|ноябр[яь]|сент\.|февр\.|нояб\.|июнь|янв.|июль|дек.|авг.|апр.|марта|мар[.т]|окт.|июн[яь]|июл[яь]|ма[яй])/i,
        monthsShortRegex: /^(сентябр[яь]|октябр[яь]|декабр[яь]|феврал[яь]|январ[яь]|апрел[яь]|августа?|ноябр[яь]|сент\.|февр\.|нояб\.|июнь|янв.|июль|дек.|авг.|апр.|марта|мар[.т]|окт.|июн[яь]|июл[яь]|ма[яй])/i,
        monthsStrictRegex: /^(сентябр[яь]|октябр[яь]|декабр[яь]|феврал[яь]|январ[яь]|апрел[яь]|августа?|ноябр[яь]|марта?|июн[яь]|июл[яь]|ма[яй])/i,
        monthsShortStrictRegex: /^(нояб\.|февр\.|сент\.|июль|янв\.|июн[яь]|мар[.т]|авг\.|апр\.|окт\.|дек\.|ма[яй])/i,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D MMMM YYYY г.',
            LLL : 'D MMMM YYYY г., HH:mm',
            LLLL : 'dddd, D MMMM YYYY г., HH:mm'
        },
        calendar : {
            sameDay: '[Сегодня в] LT',
            nextDay: '[Завтра в] LT',
            lastDay: '[Вчера в] LT',
            nextWeek: function (now) {
                if (now.week() !== this.week()) {
                    switch (this.day()) {
                    case 0:
                        return '[В следующее] dddd [в] LT';
                    case 1:
                    case 2:
                    case 4:
                        return '[В следующий] dddd [в] LT';
                    case 3:
                    case 5:
                    case 6:
                        return '[В следующую] dddd [в] LT';
                    }
                } else {
                    if (this.day() === 2) {
                        return '[Во] dddd [в] LT';
                    } else {
                        return '[В] dddd [в] LT';
                    }
                }
            },
            lastWeek: function (now) {
                if (now.week() !== this.week()) {
                    switch (this.day()) {
                    case 0:
                        return '[В прошлое] dddd [в] LT';
                    case 1:
                    case 2:
                    case 4:
                        return '[В прошлый] dddd [в] LT';
                    case 3:
                    case 5:
                    case 6:
                        return '[В прошлую] dddd [в] LT';
                    }
                } else {
                    if (this.day() === 2) {
                        return '[Во] dddd [в] LT';
                    } else {
                        return '[В] dddd [в] LT';
                    }
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'через %s',
            past : '%s назад',
            s : 'несколько секунд',
            m : relativeTimeWithPlural,
            mm : relativeTimeWithPlural,
            h : 'час',
            hh : relativeTimeWithPlural,
            d : 'день',
            dd : relativeTimeWithPlural,
            M : 'месяц',
            MM : relativeTimeWithPlural,
            y : 'год',
            yy : relativeTimeWithPlural
        },
        meridiemParse: /ночи|утра|дня|вечера/i,
        isPM : function (input) {
            return /^(дня|вечера)$/.test(input);
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 4) {
                return 'ночи';
            } else if (hour < 12) {
                return 'утра';
            } else if (hour < 17) {
                return 'дня';
            } else {
                return 'вечера';
            }
        },
        ordinalParse: /\d{1,2}-(й|го|я)/,
        ordinal: function (number, period) {
            switch (period) {
            case 'M':
            case 'd':
            case 'DDD':
                return number + '-й';
            case 'D':
                return number + '-го';
            case 'w':
            case 'W':
                return number + '-я';
            default:
                return number;
            }
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 1st is the first week of the year.
        }
    });

    return ru;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY, HH:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['ru'] = function (n) {
  if (n % 10 == 1 && n % 100 != 11) return "one";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return "few";
  return "other";
};
