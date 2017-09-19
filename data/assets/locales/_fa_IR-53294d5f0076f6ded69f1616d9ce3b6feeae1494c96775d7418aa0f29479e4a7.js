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
r += "There ";
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
r += "is <a href='/unread'>1 unread</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " unread</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 new</a> topic";
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
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
})() + " new</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " remaining, or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "browse other topics in ";
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
r += "این موضوع است ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 reply";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " replies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "with a high like to post ratio";
return r;
},
"med" : function(d){
var r = "";
r += "with a very high like to post ratio";
return r;
},
"high" : function(d){
var r = "";
r += "with an extremely high like to post ratio";
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

MessageFormat.locale.fa_IR = function ( n ) {
  return "other";
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
I18n.translations = {"fa_IR":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"بایت"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} پیش","tiny":{"half_a_minute":"\u003c 1 دقیقه","less_than_x_seconds":{"other":"\u003c %{count} ثانیه"},"x_seconds":{"other":"%{count} ثانیه"},"x_minutes":{"other":"%{count} دقیقه"},"about_x_hours":{"other":"%{count} ساعت"},"x_days":{"other":"%{count} روز"},"about_x_years":{"other":"%{count} سال"},"over_x_years":{"other":"\u003e %{count} سال"},"almost_x_years":{"other":"%{count} سال"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"other":"%{count} دقیقه"},"x_hours":{"other":"%{count} ساعت"},"x_days":{"other":"%{count} روز"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"other":"%{count} دقیقه پیش"},"x_hours":{"other":"%{count} ساعت پیش"},"x_days":{"other":"%{count} روز پیش"}},"later":{"x_days":{"other":"%{count} روز بعد"},"x_months":{"other":"%{count} ماه بعد"},"x_years":{"other":"%{count} سال بعد"}},"previous_month":"ماه پیشین","next_month":"ماه بعد"},"share":{"topic":"پیوندی به این موضوع را به اشتراک بگذارید","post":"ارسال #%{postNumber}","close":"بسته","twitter":"این پیوند را در توییتر به اشتراک بگذارید.","facebook":"این پیوند را در فیسبوک به اشتراک بگذارید.","google+":"این پیوند را در Google+‎ به اشتراک بگذارید.","email":"این پیوند را با ایمیل بفرستید"},"action_codes":{"split_topic":"این مبحث را جدا کنید %{when}","autoclosed":{"enabled":"بسته شد %{when}","disabled":"باز شد %{when}"},"closed":{"enabled":"بسته شد %{when}","disabled":"باز شد %{when}"},"archived":{"enabled":"بایگانی شد %{when}","disabled":"از بایگانی درآمد %{when}"},"pinned":{"enabled":"سنجاق شد %{when}","disabled":"از سنجاق خارج شد %{when}"},"pinned_globally":{"enabled":"به صورت سراسری سنجاق شد %{when}","disabled":"از سنجاق خارج شد %{when}"},"visible":{"enabled":"فهرست شد %{when}","disabled":"از فهرست پاک شد %{when}"}},"topic_admin_menu":"اقدامات مدیریت موضوع","emails_are_disabled":"تمام ایمیل های خروجی بصورت کلی توسط مدیر قطع شده است. هیچگونه ایمیل اگاه سازی ارسال نخواهد شد.","edit":"سرنویس و دستهٔ این موضوع را ویرایش کنید","not_implemented":"آن ویژگی هنوز به کار گرفته نشده، متأسفیم!","no_value":"نه","yes_value":"بله","generic_error":"متأسفیم، خطایی روی داده.","generic_error_with_reason":"خطایی روی داد: %{error}","sign_up":"ثبت نام","log_in":"ورود","age":"سن","joined":"ملحق شده در","admin_title":"مدیر","flags_title":"پرچم‌ها","show_more":"بیش‌تر نشان بده","show_help":"گزینه ها","links":"پیوندها","links_lowercase":{"other":"پیوندها"},"faq":"پرسش‌های متداول","guidelines":"راهنماها","privacy_policy":"سیاست حریم خصوصی","privacy":"حریم خصوصی","terms_of_service":"شرایط استفاده از خدمات","mobile_view":"نمایش برای موبایل ","desktop_view":"نمایش برای کامپیوتر","you":"شما","or":"یا","now":"هم‌اکنون","read_more":"بیشتر بخوانید","more":"بیشتر","less":"کمتر","never":"هرگز","daily":"روزانه","weekly":"هفتگی","every_two_weeks":"هر دو هفته","every_three_days":"هر سه روز","max_of_count":"حداکثر {{count}}","alternation":"یا","character_count":{"other":"{{count}} نویسه"},"suggested_topics":{"title":"موضوعات پیشنهادی"},"about":{"simple_title":"درباره","title":"درباره %{title}","stats":"آمارهای سایت","our_admins":"مدیران  ما","our_moderators":"مدیران ما","stat":{"all_time":"تمام وقت","last_7_days":"7 روز اخیر","last_30_days":"30 روز گذشته"},"like_count":"لایک ها ","topic_count":"موضوعات","post_count":"پست ها","user_count":"کاربران جدید","active_user_count":"کاربران فعال","contact":"ارتباط با ما","contact_info":"در شرایط حساس و مسائل اضطراری مربوط به سایت٬‌ لطفا با تماس بگیرید از طریق %{contact_info}."},"bookmarked":{"title":"نشانک","clear_bookmarks":"پاک کردن نشانک ها","help":{"bookmark":"برای نشانک گذاری به اولین نوشته این موضوع مراجعه نمایید","unbookmark":"برای حذف تمام نشانک های این موضوع کلیک کنید"}},"bookmarks":{"not_logged_in":"متأسفیم، شما باید به وارد شوید تا روی نوشته ها نشانک بگذارید","created":"شما این نوشته ها را نشانک گذاشته‌اید","not_bookmarked":"شما این نوشته را خوانده‌اید؛ بفشارید تا روی آن نشانک بگذارید.","last_read":"این آخرین نوشته ای است که خوانده‌اید؛ بفشارید تا روی آن نشانک بگذارید.","remove":"پاک کردن نشانک","confirm_clear":"آیا مطمئنید که می‌خواهید همه نشانک ها را از این موضوع پاک کنید؟"},"topic_count_latest":{"other":"{{count}} موضوعات تازه یا به‌ روز شده."},"topic_count_unread":{"other":"{{count}} موضوعات خوانده نشده."},"topic_count_new":{"other":"{{count}} موضوعات تازه."},"click_to_show":"برای نمایش کلیک کنید.","preview":"پیش‌نمایش","cancel":"لغو","save":"ذخیره سازی تغییرات","saving":"در حال ذخیره سازی ...","saved":"ذخیره شد!","upload":"بارگذاری","uploading":"در حال بارگذاری...","uploading_filename":"بارگذاری {{filename}}...","uploaded":"بارگذاری شد!","enable":"فعال کردن","disable":"ازکاراندازی","undo":"برگردانی","revert":"برگشت","failed":"ناموفق","banner":{"close":"این سردر را رد بده.","edit":"این بنر را ویرایش کنید \u003e\u003e"},"choose_topic":{"none_found":"موضوعی یافت نشد.","title":{"search":"جستجو برای یک موضوع از روی نام، نشانی (url) یا شناسه (id)","placeholder":"سرنویس موضوع را اینجا بنویسید"}},"queue":{"topic":"جستار","approve":"تصویب","reject":"رد کردن","delete_user":"پاک کردن کاربر","title":"به تایید نیاز است","none":"نوشته ای برای بازبینی وجود ندارد.","edit":"ویرایش","cancel":"لغو کردن","view_pending":"مشاهده پست های در انتظار ","has_pending_posts":{"other":"این عنوان دارای \u003cb\u003e{{count}}\u003c/b\u003e نوشته‌ی در انتظار تایید است"},"confirm":"ذخیره سازی تغییرها","approval":{"title":"نوشته نیاز به تایید دارد","description":"ما نوشته شما را دریافت کرده ایم ولی نیاز به تایید آن توسط یکی از مدیران است قبل از اینکه نمایش داده شود. لطفا صبر داشته باشید.","pending_posts":{"other":"شما دارای  \u003cstrong\u003e{{count}}\u003c/strong\u003e  پست های در انتظار هستید "},"ok":"باشه"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003eنوشته شد\u003ca href='{{topicUrl}}'\u003eموضوع\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eشما\u003c/a\u003e در \u003ca href='{{topicUrl}}'\u003eاین موضوع\u003c/a\u003e نوشته گذاشتید","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e replied to \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e replied to \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e replied to \u003ca href='{{topicUrl}}'\u003ethe topic\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e replied to \u003ca href='{{topicUrl}}'\u003ethe topic\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mentioned \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mentioned \u003ca href='{{user2Url}}'\u003eyou\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eشما\u003c/a\u003e  نام برده شده اید \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Posted by \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Posted by \u003ca href='{{userUrl}}'\u003eyou\u003c/a\u003e","sent_by_user":"Sent by \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Sent by \u003ca href='{{userUrl}}'\u003eyou\u003c/a\u003e"},"directory":{"filter_name":"فیلتر بر اساس نام کاربری","title":"کاربران","likes_given":"داده","likes_received":"دریافت","time_read":"زمان خوانده‌ شده","topic_count":"موضوعات","topic_count_long":"موضوعات ساخته شده","post_count":"پاسخ ها","post_count_long":"پاسخ ها نوشته شده","no_results":"نتیجه ای یافت نشد.","days_visited":"بازدید ها","days_visited_long":"بازدید روزانه","posts_read":"خواندن","posts_read_long":"خواندن نوشته ها","total_rows":{"other":"%{count} کاربران"}},"groups":{"empty":{"posts":"در این گروه هیچ پستی توسط کاربران ","members":"هیچ عضوی در این گروه وجود ندارد.","mentions":"هیچ کجا به این گروه اشاره‌ای نشده است.","messages":"پیامی در این گروه وجود ندارد.","topics":"در این گروه هیچ موضوعی توسط کاربران ارسال نشده."},"add":"افزودن","selector_placeholder":"افزودن عضو","owner":"مالک","visible":"همهٔ کاربران گروه را می‌بینند","title":{"other":"گروه‌ها"},"members":"اعضا","posts":"نوشته ها","alias_levels":{"title":"چه کسی میتواند پیام بفرستد و به این گروه @اشاره کند؟","nobody":"هیچ‌کس","only_admins":"تنها مدیران","mods_and_admins":"فقط گردانندگان و ادمین ها","members_mods_and_admins":"تنها کاربران گروه، مدیران ومدیران کل","everyone":"هرکس"},"trust_levels":{"title":"سطح اعتماد به صورت خودکار به اعضاء داده میشود وقتی که آن ها اضافه میشوند:","none":"هیچ کدام"},"notifications":{"watching":{"title":"در حال مشاهده","description":"در صورت ارسال شدن پست جدید در هر پیام یک اعلان برای شما ارسال می‌شود و تعداد پاسخ‌های جدید نمایش داده می‌شود."},"tracking":{"title":"ردگیری","description":"در صورت اشاره شدن به @نام شما توسط اشخاص دیگر و یا دریافت پاسخ، اعلانی برای شما ارسال می‌شود و تعداد پاسخ‌های جدید نمایش داده می‌شود."},"regular":{"title":"معمولی","description":"در صورتی که به @نام شما اشاره شود و یا پاسخی دریافت کنید اعلانی برای شما ارسال می‌شود."},"muted":{"title":"بی صدا شد","description":"با ارسال شدن موضوعات جدید در این گروه شما اعلانی دریافت نمی‌کنید."}}},"user_action_groups":{"1":"پسندهای داده شده","2":"پسندهای دریافت شده","3":"نشانک‌ها","4":"موضوعات","5":"پاسخ ها","6":"واکنش","7":"اشاره‌ها","9":"نقل‌قول‌ها","11":"ویرایش‌ها","12":"ارسال موارد","13":"صندوق دریافت","14":"در انتظار"},"categories":{"all":"همهٔ دسته‌بندی ها","all_subcategories":"همه","no_subcategory":"هیچی","category":"دسته بندی","category_list":"نمایش لیست دسته‌بندی","reorder":{"title":"دوباره مرتب کردن دسته بندی ها","title_long":"سازماندهی مجدد فهرست دسته بندی ها","fix_order":"اصلاح موقعیت ها","fix_order_tooltip":"همه دسته بندی ها یک شماره موقعیت مخصوص ندارند, که ممکن است باعث نتایج غیر منتظره شود.","save":"ذخیره ترتیب","apply_all":"اعمال کردن","position":"موقعیت"},"posts":"نوشته ها","topics":"موضوعات","latest":"آخرین","latest_by":"آخرین توسط","toggle_ordering":"ضامن کنترل مرتب سازی","subcategories":"زیر دسته‌ بندی ها","topic_stat_sentence":{"other":"%{count} موضوعات تازه در %{unit} گذشته."}},"ip_lookup":{"title":"جستجوی نشانی IP","hostname":"نام میزبان","location":"موقعیت","location_not_found":"(ناشناس)","organisation":"سازمان","phone":"تلفن","other_accounts":"سایر حساب های کاربری با این ای پی .","delete_other_accounts":"حذف %{count}","username":"نام کاربری","trust_level":"TL","read_time":" زمان خواندن","topics_entered":"موضوعات وارد شده","post_count":"# نوشته ها","confirm_delete_other_accounts":"آیا مطمئن هستید که می خواهید این حساب کاربری را حذف نمایید؟"},"user_fields":{"none":"(یک گزینه انتخاب کنید)"},"user":{"said":"{{username}}:","profile":"نمایه","mute":"بی صدا","edit":"ویرایش تنظیمات","download_archive":"دانلود نوشته های من","new_private_message":"پیام های جدید","private_message":"پیام","private_messages":"پیام‌ها","activity_stream":"فعالیت","preferences":"تنظیمات","expand_profile":"باز کردن","bookmarks":"نشانک‌ها","bio":"درباره من","invited_by":"فراخوان از سوی","trust_level":"سطح اعتماد","notifications":"آگاه‌سازی‌ها","statistics":"وضعیت","desktop_notifications":{"label":"اعلانات دسکتاپ","not_supported":"اعلانات بر روی این مرورگر پشتیبانی نمیشوند. با عرض پوزش.","perm_default":"فعال کردن اعلانات","perm_denied_btn":"دسترسی رد شد","disable":"غیرفعال کردن اعلانات","enable":"فعال کردن اعلانات","each_browser_note":"نکته: شما باید این تنظیمات را در هر مرورگری که استفاده میکنید تغییر دهید."},"dismiss_notifications_tooltip":"علامت گذاری همه اطلاعیه های خوانده نشده به عنوان خوانده شده","disable_jump_reply":"بعد از پاسخ من به پست من پرش نکن","dynamic_favicon":" تعداد موضوعات جدید یا بروز شده را روی آیکون مرورگر نمایش بده","external_links_in_new_tab":"همهٔ پیوندهای برون‌رو را در یک تب جدید باز کن","enable_quoting":"فعال کردن نقل قول گرفتن از متن انتخاب شده","change":"تغییر","moderator":"{{user}} یک مدیر است","admin":"{{user}} یک مدیر کل است","moderator_tooltip":"این کاربر یک مدیر است","admin_tooltip":"این کاربر یک ادمین است","blocked_tooltip":"این کاربر مسدود شده است","suspended_notice":"این کاربر تا {{date}} در وضعیت معلق است.","suspended_reason":"دلیل: ","github_profile":"Github","watched_categories":"تماشا شده","tracked_categories":"پی‌گیری شده","muted_categories":"بی صدا شد","muted_categories_instructions":"شما از هیچ چیز مباحث جدید این دسته بندی ها آگاه نمیشوید, و آن ها در آخرین ها نمایش داده نمیشوند.","delete_account":"حساب من را پاک کن","delete_account_confirm":"آیا مطمئنید که می‌خواهید شناسه‌تان را برای همیشه پاک کنید؟ برگشتی در کار نیست!","deleted_yourself":"حساب‌ کاربری شما با موفقیت حذف شد.","delete_yourself_not_allowed":"در حال حاضر شما نمی‌توانید حساب کاربری خود را حذف کنید. به این منظور  با یکی از مدیران برای پاک کردن حسابتان تماس بگیرید.","unread_message_count":"پیام‌ها","admin_delete":"پاک کردن","users":"کاربران","muted_users":"بی صدا شده","muted_users_instructions":"متفوقف کردن تمام اطلاعیه ها از طرف این کاربران.","muted_topics_link":"نمایش مباحث قطع شده","staff_counters":{"flags_given":"پرچم گذاری های مفید","flagged_posts":"نوشته های پرچم گذاری شده","deleted_posts":"پست های حذف شده","suspensions":"تعلیق کردن","warnings_received":"هشدارها"},"messages":{"all":"همه","inbox":"صندوق دریافت","sent":"ارسال شد","archive":"بایگانی","groups":"گروه های من","bulk_select":"انتخاب پیام‌ها","move_to_inbox":"انتقال به صندوق دریافت","failed_to_move":"انتقال پیام‌های انتخاب شده با اشکال مواجه شد (شاید اتصال شما در دسترس نیست)","select_all":"انتخاب همه"},"change_password":{"success":"(ایمیل ارسال شد)","in_progress":"(فرستادن ایمیل)","error":"(خطا)","action":"ارسال ریست رمز عبور به ایمیل ","set_password":"تغییر کلمه عبور"},"change_about":{"title":"تغییر «دربارهٔ من»"},"change_username":{"title":"تغییر نام کاربری","taken":"متأسفیم، آن نام کاربری  قبلا گرفته شده است.","error":"در فرآیند تغییر نام کاربری شما خطایی روی داد.","invalid":"آن نام کاربری نامعتبر است. تنها باید عددها و حرف‌ها را در بر بگیرد."},"change_email":{"title":"تغییر ایمیل","taken":"متأسفیم، آن ایمیل در دسترس نیست.","error":"در تغییر ایمیلتان  خطایی روی داد. شاید آن نشانی از پیش در حال استفاده است؟","success":"ما ایمیلی به آن نشانی فرستاده‌ایم. لطفاً دستورکار تأییده را در آن دنبال کنید."},"change_avatar":{"title":"عکس نمایه خود را تغییر دهید","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eگراواتا\u003c/a\u003e, بر اساس","gravatar_title":"تصویرتان را در سایت Gravatar تغییر دهید","refresh_gravatar_title":"تازه‌سازی گراواتارتان","letter_based":"سیستم تصویر پرفایل را اختصاص داده است","uploaded_avatar":"تصویر شخصی","uploaded_avatar_empty":"افزودن تصویر شخصی","upload_title":"تصویرتان را بار بگذارید","upload_picture":"بارگذاری تصویر","image_is_not_a_square":"اخطار: ما تصویر شما بریدیم; طول و عرض برابر نبود.","cache_notice":"شما با موفقیت تصویر پروفایل خود را تغییر دادید اما به دلیل ذخیره سازی مرورگر ممکن است کمی زمان ببرد."},"change_profile_background":{"title":"پس‌زمینه نمایه","instructions":"تصاویر پس‌زمینه نمایه‌ها در مرکز قرار میگیرند و به صورت پیش‌فرض طول 850px دارند."},"change_card_background":{"title":"پس زمینه کارت کابر","instructions":"تصاویر پس زمینه در مرکز قرار خواهند گرفت و عرض  پیشفرض آن 590 پیکسل است"},"email":{"title":"ایمیل","instructions":"هرگز بصورت عمومی نشان نده","ok":"ایمیلی برای تایید برایتان می‌فرستیم","invalid":"لطفا یک آدرس ایمیل معتبر وارد کنید","authenticated":"ایمیل شما تصدیق شد توسط {{provider}}","frequency_immediately":"ما بلافاصله برای شما ایمیل میفرستیم اگر نخوانده باشید چیزی را که ما درباره آن برای شما ایمیل میفرستیم.","frequency":{"other":"ما فقط در صورتی برای شما ایمیل میفرستیم که شما را در {{count}} دقیقه آخر ندیده باشیم."}},"name":{"title":"نام","instructions":"نام کامل (اختیاری)","instructions_required":"نام کامل شما","too_short":"نام انتخابی شما خیلی کوتاه است","ok":"نام انتخابی شما به نطر می رسد خوب است"},"username":{"title":"نام کاربری","instructions":"منحصر به فرد،بدون فاصله،کوتاه","short_instructions":"می توانید به کاربران دیگر اشاره کنید با@{{username}}","available":"نام کاربری شما موجود است","global_match":"ایمیل منطبق نام کاربری ثبت شد.","global_mismatch":"از پیش ثبت شده.این را امتحان کن {{suggestion}} ؟","not_available":"فراهم نیست. این را امتحان کن {{suggestion}} ؟","too_short":"نام کاربری انتخابی شما خیلی کوتاه است","too_long":"نام کاربری انتخابی شما بسیار بلند است","checking":"بررسی فراهمی نام‌کاربری...","enter_email":"نام کاربری پیدا شد; ایمیل منطبق را وارد کن","prefilled":"ایمیل منطبق است با این نام کاربری ثبت شده "},"locale":{"title":"زبان رابط کاربر","instructions":"زبان رابط کاربری. با تازه کردن صفحه تغییر خواهد کرد.","default":"(پیش‌فرض)"},"password_confirmation":{"title":"رمز عبور را مجدد وارد نمایید"},"last_posted":"آخرین نوشته","last_emailed":"آخرین ایمیل فرستاده شده","last_seen":"مشاهده","created":"عضو شده","log_out":"خروج","location":"موقعیت","card_badge":{"title":"کارت مدال کاربر"},"website":"تارنما","email_settings":"ایمیل","email_digests":{"daily":"روزانه","every_three_days":"هر سه روز","weekly":"هفتگی","every_two_weeks":"هر دو هفته "},"email_direct":"به من ایمیل ارسال کن هنگامی که کسی از من نقل قول کرد، به نوشته های من پاسخ داد، یا به من اشاره کرد @username یا مرا به موضوعی دعوت کرد.","email_private_messages":"به من ایمیل ارسال کن وقتی کسی به من پیام خصوصی فرستاد","email_always":"ایمیل های اعلان را وقتی در سایت فعال هستم برای من بفرست","other_settings":"موارد دیگر","categories_settings":"دسته‌بندی ها","new_topic_duration":{"label":"موضوعات را جدید در نظر بگیر وقتی","not_viewed":"من هنوز آن ها را ندیدم","last_here":"آخرین باری که اینجا بودم ساخته شده‌اند","after_1_day":"ایجاد شده در روز گذشته","after_2_days":"ایجاد شده در 2 روز گذشته","after_1_week":"ایجاد شده در هفته گذشته","after_2_weeks":"ایجاد شده در 2 هفته گذشته"},"auto_track_topics":"دنبال کردن خودکار موضوعاتی که وارد می‌شوم","auto_track_options":{"never":"هرگز","immediately":"فورا","after_30_seconds":"پس از 30 ثانیه","after_1_minute":"پس از 1 دقیقه","after_2_minutes":"پس از 2 دقیقه","after_3_minutes":"پس از 3 دقیقه","after_4_minutes":"پس از 4 دقیقه","after_5_minutes":"پس از 5 دقیقه","after_10_minutes":"پس از 10 دقیقه"},"invited":{"search":"بنویسید تا فراخوانه‌ها را جستجو کنید...","title":"فراخوانه‌ها","user":"کاربر فراخوانده شده","sent":"فرستاده شده","none":"هیچ دعوت در انتظاری برای نمایش موجود نیست.","truncated":{"other":"نمایش اولین {{count}} دعوت."},"redeemed":"آزاد سازی دعوتنامه","redeemed_tab":"آزاد شده","redeemed_tab_with_count":"تایید شده ({{count}})","redeemed_at":"آزاد سازی","pending":"دعوت های بی‌پاسخ","pending_tab":"در انتظار","pending_tab_with_count":"در حال انتظار ({{count}})","topics_entered":"موضوعات بازدید شد","posts_read_count":"خواندن نوشته ها","expired":"این دعوت منقضی شده است.","rescind":"پاک کردن","rescinded":"فراخوانه پاک شد","reinvite":"ارسال دوباره دعوت","reinvited":"فرستادن دوباره دعوتنامه","time_read":"زمان خواندن","days_visited":"روز های بازدید شده","account_age_days":"عمر حساب بر اساس روز","create":"فرستادن یک دعوتنامه","generate_link":"کپی لینک دعوت","generated_link_message":"\u003cp\u003eلینک دعوت با موفقیت تولید شد!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eلینک دعوت فقط برای این ایمیل آدرس معتبر است: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"شما هنوز کسی را اینجا دعوت نکرده اید. می توانید بصورت تکی یا گروهی یکجا دعوتنامه را بفرستید از طریق  \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eبارگذار فراخوانه فله ای \u003c/a\u003e.","text":"دعوت گروهی از طریق فایل","uploading":"بارگذاری...","success":"فایل با موفقیت بارگذاری شد٬  وقتی که پروسه تمام شد  به شما را از طریق پیام اطلاع می دهیم. ","error":"در بارگذاری «{{filename}}» خطایی روی داد: {{message}}"}},"password":{"title":"رمزعبور","too_short":"رمز عبورتان خیلی کوتاه است","common":"رمز عبور خیلی ساده‌ای است","same_as_username":"رمز عبورتان با نام کاربری شما برابر است.","same_as_email":"رمز عبورتان با ایمیل شما برابر است. ","ok":"گذرواژهٔ خوبی است.","instructions":"در آخرین %{count} کاراکتر"},"associated_accounts":"ورود ها","ip_address":{"title":"آخرین نشانی IP"},"registration_ip_address":{"title":"نشانی IP ثبت‌نامی"},"avatar":{"title":"عکس نمایه","header_title":"پروفایل، پیام‌ها، نشانک‌ها و ترجیحات"},"title":{"title":"سرنویس"},"filters":{"all":"همه"},"stream":{"posted_by":"فرستنده:","sent_by":"فرستنده:","private_message":"پیام","the_topic":"موضوع"}},"loading":"بارگذاری","errors":{"prev_page":"هنگام تلاش برای بارگزاری","reasons":{"network":"خطای شبکه","server":"خطای سرور","forbidden":"دسترسی قطع شده است","unknown":"خطا","not_found":"صفحه پیدا نشد"},"desc":{"network":"ارتباط اینترنتی‌تان را بررسی کنید.","network_fixed":"به نظر می رسد اون برگشت.","server":"کد خطا : {{status}}","forbidden":"شما اجازه دیدن آن را ندارید.","not_found":"اوه, برنامه سعی کرد پیوندی را که وجود ندارد باز کند.","unknown":"اشتباهی روی داد."},"buttons":{"back":"برگشت","again":"تلاش دوباره","fixed":"بارگذاری برگه"}},"close":"بستن","assets_changed_confirm":"این وب سایت به روز رانی شده است،بارگزاری مجدد کنید برای آخرین نسخه ؟","logout":"شما از سایت خارج شده اید","refresh":"تازه کردن","read_only_mode":{"login_disabled":"ورود به سیستم غیر فعال شده همزمان با اینکه سایت در حال فقط خواندنی است."},"too_few_topics_and_posts_notice":"بیا \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e این بحث را شروع کنیم!\u003c/a\u003e در حال حاضر این \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e مبحث ها و \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e ارسال ها وجود دارد. بازدید کنندگان تازه وارد نیاز دارند به گفتگو هایی برای خواندن و پاسخ دادن.","too_few_topics_notice":"بیا \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e این بحث را شروع کنیم!\u003c/a\u003e در حال حاضر این \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e مباحث وجود دارد. بازدیدکنندگان تازه وارد نیاز دارند به گفتگوهایی برای خواندن و پاسخ دادن.","too_few_posts_notice":"بیا \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003e این بحث را شروع کنیم!\u003c/a\u003e در حال حاضر این \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e ارسال ها وجود دارد. بازدیدکنندگان تازه وارد نیاز دارند به گفتگوهایی برای خواندن و پاسخ دادن.","learn_more":"بیشتر بدانید...","year":"سال","year_desc":"موضوعاتی که در 365 روز گذشته باز شده‌اند","month":"ماه","month_desc":"موضوعاتی که در 30 روز گذشته ساخته شده اند","week":"هفته","week_desc":"موضوعاتی که در 7 روز گذشته باز شده‌اند","day":"روز","first_post":"نوشته نخست","mute":"بی صدا","unmute":"صدادار","last_post":"آخرین نوشته","last_reply_lowercase":"آخرین پاسخ","replies_lowercase":{"other":"پاسخ ها "},"signup_cta":{"sign_up":"ثبت نام","hide_session":"فردا به من یادآوری کن","hide_forever":"نه ممنون","hidden_for_session":"باشه, فردا از شما سئوال میکنم. شما همیشه میتوانید از 'ورود' نیز برای ساخت حساب کاربری استفاده کنید.","intro":"سلام! :heart_eyes: به نظر میاد شما از بحث لذت میبرید, اما شما هنوز برای یک حساب کاربری ثبت نام نکرده اید.","value_prop":"وقتی که شما یک حساب کابری ایجاد میکنید, ما به خاطر میسپاریم که شما دقیقا در حال خواندن چه چیزی بودید, بنابراین شما همیشه برمی گردید از جایی که خواندن را رها کردید. همچنین شما اعلانات را دریافت میکنید, اینجا و از طریق ایمیل, هر زمان که ارسال جدیدی فرستاده شود. و شما میتوانید ارسال ها را پسند کنید تا در محبت آن سهیم باشید. :heartbeat:"},"summary":{"enabled_description":"شما خلاصه ای از این موضوع را می بینید:  بالاترین‌ نوشته های  انتخاب شده توسط انجمن.","enable":"خلاصه این موضوع","disable":"نمایش همه نوشته‌ها"},"deleted_filter":{"enabled_description":"محتویات این موضوع باعث حذف نوشته شده٬ که پنهان شده است.","disabled_description":"پست های حذف شده در موضوع نشان داده است","enable":"مخفی کردن نوشته های حذف شده","disable":"نشان دادن نوشته های حذف شده"},"private_message_info":{"title":"پیام","invite":"فراخواندن دیگران...","remove_allowed_user":"آیا واقعا می خواهید اسم {{name}} از پیام برداشته شود ؟ "},"email":"رایانامه","username":"نام کاربری","last_seen":"مشاهده شد","created":"ساخته شده","created_lowercase":"ساخته شده","trust_level":"سطح اعتماد","search_hint":"نام کاربری ، ایمیل یا ای پی ","create_account":{"title":"ساختن شناسهٔ تازه","failed":"اشتباهی روی داده، شاید این نام کاربری پیش‌تر استفاده شده؛ پیوند فراموشی گذرواژه می‌تواند کمک کند."},"forgot_password":{"title":"باز یابی کلمه عبور","action":"گذرواژه‌ام را فراموش کرده‌ام","invite":"نام‌کاربری و نشانی رایانامهٔ خود را بنویسید و ما رایانامهٔ بازیابی گذرواژه را برایتان می‌فرستیم.","reset":"باز یابی رمز عبور","complete_username":"اگر حساب کاربری مشابه نام کاربری  \u003cb\u003e%{username}\u003c/b\u003e ,است،شما باید با استفاده از ایمیل رمز عبور حساب کاربری خود را مجدد تنظیم نمایید.","complete_email":"اگر حساب کاربری مشابه ایمیل \u003cb\u003e%{email}\u003c/b\u003e, است،شما باید با استفاده از ایمیل رمز عبور حساب کاربری خود را مجدد تنظیم نمایید.","complete_username_found":"ما حساب کاربری مشابه نام کاربری   \u003cb\u003e%{username}\u003c/b\u003e,پیدا کردیم،شما باید با استفاده از ایمیل رمز عبور حساب کاربری خود را مجدد تنظیم نمایید.","complete_email_found":"ما حساب کاربری مشابه با ایمیل  \u003cb\u003e%{email}\u003c/b\u003e, پیدا کردیم،شما باید با استفاده از ایمیل رمز عبور حساب کاربری خود را مجدد تنظیم نمایید.","complete_username_not_found":"هیچ حساب کاربری مشابه نام کاربری \u003cb\u003e%{username}\u003c/b\u003e وجود ندارد","complete_email_not_found":"هیچ حساب کاربری مشابه با \u003cb\u003e%{email}\u003c/b\u003e وجود ندارد"},"login":{"title":"ورود","username":"کاربر","password":"گذرواژه","email_placeholder":"نشانی رایانامه یا نام کاربری","caps_lock_warning":"Caps Lock روشن است","error":"خطای ناشناخته","rate_limit":"لطفا قبل از ورود مجدد اندکی صبر کنید","blank_username_or_password":"لطفا نام کاربری یا ایمیل خود ، با پسورد وارد نمایید.","reset_password":"نوسازی گذرواژه","logging_in":"درون آمدن...","or":"یا","authenticating":"اعتبارسنجی...","awaiting_confirmation":"شناسهٔ‌کاربری‌تان چشم به راه فعال‌سازی است، پیوند فراموشی گذرواژه را برای دریافت یک رایانامهٔ‌فعال‌سازی دیگر باز کنید.","awaiting_approval":"هنوز کارمندی شناسهٔ‌شما را تأیید نکرده است. پس از تأیید، یک رایانامه دریافت خواهید کرد.","requires_invite":"متأسفیم، دسترسی به این انجمن تنها با فراخوانه امکان دارد.","not_activated":"هنوز نمی‌توانید به درون بیایید. پیش‌تر یک رایانامهٔ فعال‌سازی برایتان به نشانی \u003cb\u003e{{sentTo}}\u003c/b\u003e فرستادیم. لطفاً دستور کار آن رایانامه را برای فعال‌سازی شناسه‌تان دنبال کنید.","not_allowed_from_ip_address":"شما نمی توانید با این اپی ادرس وارد شوید.","admin_not_allowed_from_ip_address":"شما نمی تواند با این اپی آدرس وارد کنترل  پنل ادمین شوید.","resend_activation_email":"برای فرستادن دوبارهٔ رایانامهٔ‌فعال‌سازی، اینجا را بفشارید.","sent_activation_email_again":"رایانامهٔ‌ فعال‌سازی دیگری را برایتان به نشانی \u003cb\u003e{{currentEmail}}\u003c/b\u003e فرستادیم. چند دقیقه‌ای طول می‌کشد تا برسد. مطمئن شوید که پوشهٔ هرزنامه را بررسی می‌کنید.","to_continue":"لطفا وارد شوید","preferences":"شما باید وارد شوید تا بتوانید تنظیمات کاربری خود را تغییر بدهید.","forgot":"من اطلاعات حساب کاربری خود را فراموش کردم","google":{"title":"با Google","message":"اعتبارسنجی با گوگل (مطمئن شوید که بازدارنده‌های pop up فعال نباشند)"},"google_oauth2":{"title":"با گوگل","message":"اهراز هویت با گوگل (لطفا برسی کنید پاپ بلوکر فعال نباشد)"},"twitter":{"title":"با Twitter","message":"اعتبارسنجی با توئیتر (مطمئن شوید که بازدارنده‌های pop up فعال نباشند)"},"facebook":{"title":"با Facebook","message":"اعتبارسنجی با فیسبوک (مطمئن شوید که بازدارنده‌های pop up فعال نباشند)"},"yahoo":{"title":"با یاهو","message":"اعتبارسنجی با یاهو (مطمئن شوید که بازدارنده‌های pop up فعال نباشند)"},"github":{"title":"با GitHub","message":"اعتبارسنجی با گیت‌هاب (مطمئن شوید که بازدارنده‌های pop up فعال نباشند)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"more_emoji":"بیشتر...","options":"گزینه ها","whisper":"نجوا","add_warning":"این یک هشدار رسمی است.","toggle_whisper":"تغییر وضعیت نجوا","posting_not_on_topic":"به کدام موضوع می‌خواهید پاسخ دهید؟","saving_draft_tip":"در حال ذخیره سازی ...","saved_draft_tip":"اندوخته شد","saved_local_draft_tip":"ذخیره سازی به صورت محلی","similar_topics":"موضوع شما شبیه است به...","drafts_offline":"پیش نویس آنلاین","error":{"title_missing":"سرنویس الزامی است","title_too_short":"سرنویس دست‌کم باید {{min}} نویسه باشد","title_too_long":"سرنویس نمی‌تواند بیش‌تر از {{max}} نویسه باشد","post_missing":"نوشته نمی‌تواند تهی باشد","post_length":"نوشته باید دست‌کم {{min}} نویسه داشته باشد","try_like":"این کلید را امتحان کرده اید \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e ؟ ","category_missing":"باید یک دسته برگزینید"},"save_edit":"ذخیره سازی ویرایش","reply_original":"پاسخ دادن در موضوع اصلی","reply_here":"پاسخ‌دادن همین‌جا","reply":"پاسخ","cancel":"لغو کردن","create_topic":"ایجاد موضوع","create_pm":"پیام","title":"یا Ctrl+Enter را بفشارید","users_placeholder":"افزودن یک کاربر","title_placeholder":"در یک جملهٔ‌ کوتاه، این موضوع در چه موردی است؟","edit_reason_placeholder":"چرا ویرایش می‌کنید؟","show_edit_reason":"(افزودن دلیل ویرایش)","reply_placeholder":"اینجا بنویسید. از Markdown, BBCode و یا HTML برای شکل دادن استفاده کنید. عکس ها را بکشید و یا کپی کنید.","view_new_post":"نوشته تازه‌تان را ببینید.","saving":"در حال ذخیره سازی","saved":"اندوخته شد!","saved_draft":"در حال حاضر پیشنویس وجود دارد . برای از سر گیری انتخاب نمایید.","uploading":"بارگذاری...","show_preview":"نشان دادن پیش‌نمایش \u0026laquo;","hide_preview":"\u0026raquo; پنهان کردن پیش‌نمایش","quote_post_title":"نقل‌قول همهٔ‌ نوشته","bold_title":"زخیم","bold_text":"نوشته قوی ","italic_title":"تاکید","italic_text":"متن تاکید شده","link_title":"لینک ارتباط دار","link_description":"توضیحات لینک را اینجا وارد کنید.","link_dialog_title":"لینک را درج کنید","link_optional_text":"سرنویس اختیاری","quote_title":"نقل قول","quote_text":"نقل قول","code_title":"نوشته تنظیم نشده","code_text":"متن تورفتگی تنظیم نشده توسط 4 فضا خالی","upload_title":"بارگذاری","upload_description":"توضیح بارگذاری را در اینجا بنویسید","olist_title":"لیست شماره گذاری شد","ulist_title":"لیست بولت","list_item":"فهرست موارد","heading_title":"عنوان","heading_text":"عنوان","hr_title":"خط کش افقی","help":"راهنمای ویرایش با Markdown","toggler":"مخفی یا نشان دادن پنل نوشتن","modal_ok":"باشه","modal_cancel":"لغو کردن","cant_send_pm":"متاسفانه , شما نمیتوانید پیام بفرستید به %{username}.","admin_options_title":"تنظیمات اختیاری مدیران برای این موضوع","auto_close":{"label":"بستن خودکار موضوع در زمان :","error":"لطفا یک مقدار معتبر وارد نمایید.","based_on_last_post":"آیا تا آخرین نوشته یک موضوع بسته نشده در این قدیمی است.","all":{"examples":"عدد ساعت را وارد نمایید (24)،زمان کامل (17:30) یا برچسب زمان (2013-11-22 14:00)."},"limited":{"units":"(# از ساعت ها)","examples":"لطفا عدد ساعت را وارد نمایید (24)."}}},"notifications":{"title":"اطلاع رسانی با اشاره به @name ،پاسخ ها به نوشته ها و موضوعات شما،پیام ها ، و ...","none":"قادر به بار گذاری آگاه سازی ها در این زمان نیستیم.","more":"دیدن آگاه‌سازی‌های پیشن","total_flagged":"همهٔ نوشته‌های پرچم خورده","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eEarned '{{description}}'\u003c/p\u003e","alt":{"mentioned":"اشاره شده توسط","quoted":"نقل قول شده توسط","replied":"پاسخ داده شد","posted":"ارسال شد توسط","edited":"ویرایش پست شما توسط","liked":"ارسال شما را پسندید","private_message":"پیام خصوصی از جانب","invited_to_private_message":"دعوت شد به یک پیام خصوصی از جانب","invited_to_topic":"دعوت شد به یک مبحث از جانب","invitee_accepted":"دعوت قبول شد توسط","moved_post":"ارسال شما انتقال داده شد توسط","linked":"پیوند به ارسال شما","granted_badge":"مدال اعطاء شد"},"popup":{"mentioned":"{{username}} mentioned you in \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} به شما در \"{{topic}}\" - {{site_title}} اشاره نمود","quoted":"{{username}} quoted you in \"{{topic}}\" - {{site_title}}","replied":"{{username}} replied to you in \"{{topic}}\" - {{site_title}}","posted":"{{username}} posted in \"{{topic}}\" - {{site_title}}","private_message":"{{username}} sent you a private message in \"{{topic}}\" - {{site_title}}","linked":"{{username}} linked to your post from \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"افزودن یک عکس","title_with_attachments":"افزودن یک تصویر یا پرونده","from_my_computer":"از دستگاه من","from_the_web":"از وب","remote_tip":"لینک به تصویر","remote_tip_with_attachments":"پیوند به عکس یا فایل {{authorized_extensions}}","local_tip":"عکس ها را از روی سیستم خود انتخاب کنید","local_tip_with_attachments":"عکس ها یا فایل ها را از دستگاه خود انتخاب کنید {{authorized_extensions}}","hint":"(برای آپلود می توانید فایل را کیشده و در ویرایشگر رها کنید)","hint_for_supported_browsers":"شما همچنین میتوانید عکس ها را به داخل ویرایشگر بکشید و رها کنید یا کپی کنید","uploading":"در حال بروز رسانی ","select_file":"انتخاب فایل","image_link":"به لینک تصویر خود اشاره کنید"},"search":{"sort_by":"مرتب سازی بر اساس","relevance":"ارتباطات","latest_post":"آخرین ارسال","most_viewed":"بیشترین بازدید شده","most_liked":"بیشترین پسندیده شده","select_all":"انتخاب همه","clear_all":"پاک کردن همه","result_count":{"other":"{{count}} نتایج \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"جستجوی موضوعات، نوشته ها، کاربران یا دسته‌ بندی ها","no_results":"چیزی یافت نشد.","no_more_results":"نتایجی بیشتری یافت نشد.","search_help":"راهنمای جستجو","searching":"جستجو کردن...","post_format":"#{{post_number}} توسط {{username}}","context":{"user":"جستجوی نوشته‌ها با @{{username}}","topic":"جستجوی این موضوع","private_messages":"جستجوی پیام"}},"hamburger_menu":"به فهرست مبحث یا دسته بندی دیگر بروید","new_item":"تازه","go_back":"برگردید","not_logged_in_user":"صفحه کاربر با خلاصه ای از فعالیت های و تنظیمات","current_user":"به نمایه‌تان بروید","topics":{"bulk":{"unlist_topics":"از فهرست خارج کردن مباحث","reset_read":"تنظیم مجدد خوانده شد","delete":"حذف موضوعات","dismiss":"پنهان کردن","dismiss_read":"پنهان کردن تمامی خوانده نشده ها","dismiss_button":"پنهان کردن...","dismiss_tooltip":"فقط پنهان کردن ارسال های تازه یا متوقف کردن پیگیری مباحث","also_dismiss_topics":"توقف پیگیری این مباحث پس آن ها دیگر هرگز به عنوان خوانده نشده دوباره برای من نمایش داده نمیشوند","dismiss_new":"بستن جدید","toggle":"ضامن انتخاب یکباره موضوعات","actions":"عملیات یکجا","change_category":"تغییر دسته بندی","close_topics":"بستن موضوعات","archive_topics":"آرشیو موضوعات","notification_level":"تغییر سطح آگاه‌سازی","choose_new_category":"یک دسته بندی جدید برای موضوع انتخاب نمایید","selected":{"other":"شما تعداد \u003cb\u003e{{count}}\u003c/b\u003e موضوع را انتخاب کرده اید."}},"none":{"unread":"موضوع خوانده نشده‌ای ندارید.","new":"شما هیچ موضوع تازه‌ای ندارید","read":"هنوز هیچ موضوعاتی را نخوانده‌اید.","posted":"هنوز در هیچ موضوعی  نوشته نگذاشته‌اید.","latest":"هیچ موضوع تازه‌ای نیست. چه بد!","hot":"هیچ موضوع داغی نیست.","bookmarks":"هنوز هیچ موضوع نشانک‌گذاری شده‌ای ندارید.","category":"هیچ موضوعاتی در {{category}} نیست.","top":"موضوع برتر وجود ندارد.","search":" هیچ نتیجه جستجویی وجود ندارد."},"bottom":{"latest":"موضوع تازهٔ دیگری نیست.","hot":"موضوع داغ دیگری نیست.","posted":"هیچ موضوعات نوشته شده  ای وجود ندارد","read":"موضوع خوانده شدهٔ‌ دیگری نیست.","new":"موضوع تازهٔ دیگری نیست.","unread":"موضوع خوانده نشدهٔ دیگری نیست.","category":"هیچ موضوع دیگری در {{category}} نیست.","top":"بالاترین‌ موضوعات بیشتری وجود ندارد","bookmarks":"موضوعات نشانک‌گذاری شده‌ی دیگری وجود ندارد.","search":"نتیجه جستجوی دیگری وجود ندارد"}},"topic":{"unsubscribe":{"stop_notifications":"حالا شما اعلانات کمتری برای \u003cstrong\u003e{{title}}\u003c/strong\u003e دریافت میکنید","change_notification_state":"وضعیت فعلی اعلانات شما این هست"},"create":"موضوع جدید","create_long":"ساخت یک موضوع جدید","private_message":"شروع یک پیام","list":"موضوعات","new":"موضوع تازه","unread":"خوانده نشده","new_topics":{"other":"{{count}} موضوعات جدید"},"unread_topics":{"other":"{{count}} موضوع خوانده نشده"},"title":"موضوع","invalid_access":{"title":"موضوع خصوصی است","description":"متأسفیم، شما دسترسی به این موضوع ندارید!","login_required":"برای مشاهده‌ی موضوع باید وارد سیستم شوید."},"server_error":{"title":"شکست در بارگذاری موضوع","description":"متأسفیم، نتوانستیم موضوع را بار بگذاریم، شاید به دلیل یک مشکل ارتباطی. لطفاً دوباره تلاش کنید. اگر مشکل پابرجا بود، ما را آگاه کنید."},"not_found":{"title":"موضوع یافت نشد","description":"متأسفیم، نتوانستیم آن موضوع را بیابیم. شاید کارمندی آن را پاک کرده؟"},"total_unread_posts":{"other":"شما تعداد {{count}} نوشته خوانده نشده در این موضوع دارید"},"unread_posts":{"other":"شما تعداد {{count}} نوشته خوانده نشده قدیمی در این موضوع دارید"},"new_posts":{"other":"تعداد {{count}} نوشته های جدید در این موضوع از آخرین خواندن شما وجود دارد"},"likes":{"other":"{{count}} پسند در این موضوع داده شده است"},"back_to_list":"بازگشت به فهرست موضوع","options":"گزینه‌های موضوع","show_links":"نمایش پیوندهای درون این موضوع","toggle_information":" ضامن جزئیات موضوع","read_more_in_category":"می خواهید بیشتر بخوانید? به موضوعات دیگر را مرور کنید {{catLink}} یا {{latestLink}}.","read_more":"می خواهید بیشتر بخوانید? {{catLink}} یا {{latestLink}}.","browse_all_categories":"جستوجوی همهٔ دسته‌ها","view_latest_topics":"مشاهده آخرین موضوع","suggest_create_topic":"چرا یک موضوع نسازید؟","jump_reply_up":"رفتن به جدید ترین پاسخ","jump_reply_down":"رفتن به آخرین پاسخ","deleted":"موضوع پاک شده است.","auto_close_notice":"این موضوع خودکار بسته خواهد شد %{timeLeft}.","auto_close_notice_based_on_last_post":"این نوشته بعد از  %{duration} آخرین پاسخ بشته خواهد شد .","auto_close_title":"تنضیمات قفل خوکار","auto_close_save":"‌ذخیره","auto_close_remove":"این موضوع را خوکار قفل نکن","progress":{"title":"نوشته ی در حال اجرا","go_top":"بالا","go_bottom":"پایین","go":"برو","jump_bottom":"پرش به آخرین نوشته","jump_bottom_with_number":"رفتن به نوشته ی %{post_number}","total":"همهٔ نوشته‌ها","current":"نوشته کنونی"},"notifications":{"reasons":{"3_6":"شما آگاه‌سازی‌ها را دریافت خواهید کرد، زیرا شما در حال مشاهده ی این  دسته بندی هستید.","3_5":"شما آگاه‌سازی‌ها را دریافت خواهید کرد، زیرا تماشای خودکار این موضوع را آغاز کرده‌اید.","3_2":"شما آگاه سازی دریافت می کنید زیرا در حال مشاهده این جستار هستید.","3_1":"از آنجا که این موضوع را ساخته‌اید، از رویدادهای آن آگاه خواهید شد.","3":"از آنجا که این موضوع را تماشا می‌کنید، از رویدادهای آن آگاه خواهید شد.","2_8":"شما آگاه سازی دریافت خواهید کرد چرا که شما این دسته بندی را پی گیری می کنید.","2_4":"از آنجا که به این جستار پاسخ فرستادید، از رویدادهای آن آگاه خواهید شد.","2_2":"از آنجا که این موضوع را دنبال می‌کنید، از رویدادهای آن آگاه خواهید شد.","2":"شما اطلاعیه ای دریافت خواهید کرد چون  \u003ca href=\"/users/{{username}}/preferences\"\u003eاین موضوع را مطالعه می نمایید\u003c/a\u003e.","1_2":"در صورتی که فردی با @name به شما اشاره کند یا به شما پاسخی دهد به شما اطلاع داده خواهد شد.","1":"در صورتی که فردی با @name به شما اشاره کند یا به شما پاسخی دهد به شما اطلاع داده خواهد شد.","0_7":"شما تمام آگاه سازی های این دسته بندی را نادیده گرفته اید","0_2":"شما کل آگاه سازی های این جستار را نادیده گرفته اید","0":"شما تمام آگاه سازی های این جستار را نادیده گرفته اید"},"watching_pm":{"title":"در حال مشاهده","description":"هر پاسخ جدید به این پیام به اطلاع شما خواهد رسید، و تعداد پاسخ‌های جدید نیز نمایش داده خواهد شد."},"watching":{"title":"در حال مشاهده","description":"هر پاسخ جدید در این عنوان به اطلاع شما خواهد رسید، و تعداد پاسخ‌های جدید نیز نمایش داده خواهد شد."},"tracking_pm":{"title":"ردگیری","description":"تعداد پاسخ‌های جدید برای این پیام نمایش داده خواهد شد. در صورتی که فردی با @name به شما اشاره کند یا به شما پاسخی دهد، به شما اطلاع رسانی خواهد شد."},"tracking":{"title":"ردگیری","description":"تعداد پاسخ‌های جدید برای این عنوان نمایش داده خواهد شد. در صورتی که فردی با @name به شما اشاره کند یا به شما پاسخی دهد، به شما اطلاع رسانی خواهد شد."},"regular":{"title":"معمولی","description":"در صورتی که فردی با @name به شما اشاره کند یا به شما پاسخی دهد به شما اطلاع داده خواهد شد."},"regular_pm":{"title":"معمولی","description":"در صورتی که فردی با @name به شما اشاره کند یا به شما پاسخی دهد به شما اطلاع داده خواهد شد."},"muted_pm":{"title":"بی صدا شد","description":" در باره این پیام هرگز  به شما اطلاع رسانی نخواهید شد"},"muted":{"title":"بی صدا شد","description":"شما هرگز از چیزی درباره این مبحث آگاه نمیشوید, و آن در آخرین ها نمایش داده نخواهد شد."}},"actions":{"recover":"بازیابی موضوع","delete":"پاک کردن موضوع","open":"باز کردن موضوع ","close":"بستن موضوع","multi_select":"گزیدن دیدگاه‌ها...","auto_close":"بستن خودکار","pin":"سنجاق زدن جستار...","unpin":"برداشتن سنجاق جستار...","unarchive":"موضوع بایگانی نشده","archive":"بایگانی کردن موضوع","invisible":"خارج کردن از لیست","visible":"فهرست ساخته شد","reset_read":"تنظیم مجدد خواندن داده ها"},"feature":{"pin":"سنجاق زدن جستار","unpin":"برداشتن سنجاق جستار","pin_globally":"سنجاق کردن موضوع در سطح سراسری","make_banner":"اعلان موضوع","remove_banner":"حذف اعلان موضوع"},"reply":{"title":"پاسخ","help":"آغاز ارسال یک پاسخ به این موضوع"},"clear_pin":{"title":"برداشتن سنجاق","help":"سنجاق استاتوس این موضوع را بردارید که پس از آن دیگر این موضوع در بالای فهرست موضوعات شما دیده نمی‌شود."},"share":{"title":"همرسانی ","help":"همرسانی  یک پیوند برای این موضوع"},"flag_topic":{"title":"پرچم","help":"پرچم خصوصی برای این موضوع جهت توجه یا برای ارسال آگاه سازی شخصی در باره آن.","success_message":"شما باموفقیت این موضوع را پرچم زدید"},"feature_topic":{"title":" ویژگی های این موضوع","pin":"این مبحث را در بالای {{categoryLink}} دسته بندی نمایش بده تا وقتی که","confirm_pin":"شما قبلا این  {{count}} موضوع را سنجاق کردید. تعداد زیاد موضوع های سنجاق شده شاید برای کاربران جدید یا ناشناس بار سنگینی ایجاد کند. آیا شما اطمینان دارید از سنجاق کردن یک موضوع دیگر در این دسته بندی ؟","unpin":"این موضوع را از لیست بالاترین‌ های دسته بندی {{categoryLink}} حذف کن","unpin_until":"این مبحث از بالای {{categoryLink}} دسته بندی حذف شود یا منتظر بمانید تا وقتی که \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"کاربران می توانند موضوع را بصورت جداگانه برای خود از سنجاق در بیاورند","pin_validation":"برای سنجاق کردن این مبحث نیاز به یک تاریخ معین است.","not_pinned":"هیچ مبحثی در {{categoryLink}} سنجاق نشده.","already_pinned":{"other":"مباحثی که در حال حاضر سنجاق شده اند در {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"نمایش این مبحث در بالای فهرست همه مباحث تا وقتی که","confirm_pin_globally":"شما قبلا این موضوع {{count}} را بصورت سراسری سنجاق زده اید. تعداد زیاد موضوع های سنجاق شده برای کاربران جدید و ناشناس می تواند سخت باشد. آیا از سنجاق کردن موضوع ها بصورت سراری اطمینان دارید ؟  ","unpin_globally":"حذف این موضوع از بالای همه لیست موضوعات.","unpin_globally_until":"حذف این مبحث از بالای لیست همه مباحث یا صبر کردن تا \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"کاربران می توانند موضوع را بصورت جداگانه برای خود از سنجاق در بیاورند","not_pinned_globally":"هیچ مبحثی به صورت سراسری سنجاق نشده.","already_pinned_globally":{"other":"مباحثی که در حال حاضر به صورت سراسری سنجاق شده اند: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"این موضوع را در وارد بنر کن که در تمام صفحات در بالای صفحه نشان داده شود","remove_banner":"حذف بنری که از بالای تمام صفحات نمایش داده می شود. ","banner_note":"کاربران می توانند بنر را با بستن آنها رد کنند. فقط یک موضوع را می توان  بنر کرد در هرزمان داده شده ای. ","no_banner_exists":"هیچ مبحث سرصفحه ای وجود ندارد.","banner_exists":"یک مبحث سرصفحه ای \u003cstrong class='badge badge-notification unread'\u003e هست \u003c/strong\u003e در حال حاضر."},"inviting":"فراخوانی...","invite_private":{"title":"دعوت به پیام خصوصی","email_or_username":"دعوتنامه ی ایمیل یا نام کاربر","email_or_username_placeholder":"نشانی ایمیل یا نام کاربری","action":"دعوتنامه ","success":"ما آن کاربر را برای شرکت در این پیام دعوت کردیم.","error":"با معذرت٬ یک خطا برای دعوت آن کاربر وجود داشت","group_name":"نام گروه"},"controls":"مدیریت مبحث","invite_reply":{"title":"دعوتنامه ","username_placeholder":"نام کاربری","action":"ارسال دعوتنامه ","help":"دعوت دیگران به این موضوع با ایمیل یا اطلاعیه ","to_forum":"ما ایملی کوتاه برای شما می فرستیم که دوست شما با کلیک کردن بر روی لینک سریعا ملحق شود٫‌ به ورود سیستم نیازی نیست. ","sso_enabled":"نام کاربری کسی را که می خواهید برای این موضوع دعوت کنید را وارد نمایید","to_topic_blank":"نام کاربری یا ایمیل کسی را که می خواهید برای این موضوع دعوت کنید را وارد نمایید","to_topic_email":"شما یک ایمیل آدرس وارد کردید. ما یک ایمیل خواهیم فرستاد که به دوستان شما اجازه می دهد سریعا به این جستار پاسخ دهند.","to_topic_username":"شما نام کاربری شخصی را وارد کرده‌اید. ما این امر را به اطلاع او رسانده و او را به این عنوان دعوت می‌کنیم.","to_username":"نام کاربری شخصی که می‌خواهید او را دعوت کنید، وارد کنید. ما این امر را به اطلاع او رسانده و او را به این عنوان دعوت می‌کنیم.","email_placeholder":"name@example.com","success_email":"lما از طریق ایمیل دعوت نامه ارسال کردیم \u003cB\u003e {{emailOrUsername}} \u003c/ B\u003e. هنگامی که به دعوت شما پاسخ داده شد ما به شما اطلاع خواهیم داد.برای پی گیری به تب دعوت ها در پنل کاربری مراجعه نمایید","success_username":"ما آن کاربر را برای شرکت در این جستار دعوت کردیم.","error":"متاسفیم٬‌ ما آن شخص را نمی توانیم دعوت کنیم. شاید قبلا دعوت شده اند. (فراخوان ها تعداد محدودی دارند)"},"login_reply":"برای پاسخ وارد شوید","filters":{"n_posts":{"other":"{{count}} نوشته ها"},"cancel":"حذف فیلتر"},"split_topic":{"title":"انتقال به موضوع جدید","action":"انتقال به موضوع جدید","topic_name":"نام موضوع تازه","error":"اینجا یک ایراد بود برای جابجایی نوشته ها به موضوع جدید.","instructions":{"other":"شما نزدیک به ساخت یک موضوع جدید و افزون کردن ان با \u003cb\u003e{{count}}\u003c/b\u003e با نوشته های که انتخاب کرده ای. "}},"merge_topic":{"title":"انتقال به موضوع موجود","action":"انتقال به موضوع موجود","error":"اینجا یک ایراد برای جابجایی نوشته ها به  آن موضوع بود.","instructions":{"other":"لطفاً موضوعی را که قصد دارید تا  \u003cb\u003e{{count}}\u003c/b\u003eاز نوشته‌ها را به آن انتقال دهید، انتخاب نمایید."}},"change_owner":{"title":"تغییر مالکیت نوشته ها","action":"تغییر مالکیت","error":"آنجا یک ایراد برای تغییر مالکیت آن پست وجود داشت. ","label":"مالک جدید نوشته ها ","placeholder":"نام کاربری مالک جدید","instructions":{"other":"لطفا مالک جدید را برای این {{count}}  نوشته انتخاب کنید با  \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"نکته٬ هر گونه آگاه سازی برای این پست  همانند سابق برای کاربر جدید فرستاده نمی شود. .\u003cbr\u003e اخطار: در حال حاضر٬‌ هیچگونه اطلاعات قبلی به کاربر جدید فرستاده نشده. با احتیاط استفاده شود. "},"change_timestamp":{"title":"تغییر برچسب زمان","action":"تغییر برچسب زمان","invalid_timestamp":"برچسب زمان نمیتواند در آینده باشد.","error":"یک ایراد برای تغییر برچسب زمان مبحث وجود دارد.","instructions":"لطفا یک برچسب زمان جدید برای مبحث انتخاب کنید. ارسال های مبحث برای داشتن یک اختلاف زمانی واحد به روز میشوند."},"multi_select":{"select":"انتخاب","selected":"انتخاب شده ({{count}}) ","select_replies":"انتخاب کردن + جواب دادن","delete":"حذف انتخاب شده ها","cancel":"لغو انتخاب","select_all":"انتخاب همه","deselect_all":"عدم انتخاب همه","description":{"other":"شما تعداد \u003cb\u003e{{count}}\u003c/b\u003e نوشته انتخاب کرده اید"}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"پاسخ با نقل قول","edit":"در حال ویرایش {{link}} {{replyAvatar}} {{username}}","edit_reason":"دلیل:","post_number":"نوشته {{number}}","last_edited_on":"آخرین ویرایش نوشته در","reply_as_new_topic":"پاسخگویی به عنوان یک موضوع لینک شده","continue_discussion":"دنبالهٔ موضوع {{postLink}}:","follow_quote":"برو به نوشته ای که نقل‌قول شده","show_full":"نمایش کامل نوشته","show_hidden":"نمایش درون‌مایهٔ پنهان","deleted_by_author":{"other":"(نوشته های ارسال شده توسط نویسنده،بصورت خودکار در %{count} ساعت حذف می شود مگر اینکه پرچم شود)"},"expand_collapse":"باز کردن/گستردن","gap":{"other":"{{count}} پاسخ پنهان را مشاهده کنید"},"unread":"نوشته خوانده نشده است","has_replies":{"other":"{{count}} پاسخ"},"has_likes":{"other":"{{count}} لایک"},"has_likes_title":{"other":"{{count}} کاربر این مورد را پسندیده اند"},"has_likes_title_only_you":"شما این ارسال را پسندیده اید","has_likes_title_you":{"other":"شما و {{count}} شخص دیگر این ارسال را پسندیده اید"},"errors":{"create":"متأسفیم، در فرستادن نوشته شما خطایی روی داد. لطفاً دوباره تلاش کنید.","edit":"متأسفیم، در ویرایش نوشته شما خطایی روی داد. لطفاً دوباره تلاش کنید.","upload":"متأسفیم، در بارگذاری آن پرونده خطایی روی داد. لطفاً دوباره تلاش کنید.","too_many_uploads":"متأسفیم، هر بار تنها می‌توانید یک پرونده را بار بگذارید.","upload_not_authorized":"متأسفیم، پرونده‌ای که تلاش دارید آن را بار بگذارید، پروانه‌دار نیست (پسوندهای پروانه‌دار: {{authorized_extensions})","image_upload_not_allowed_for_new_user":"با عرض پوزش، کاربران جدید نمی توانند تصویر بار گذاری نماییند.","attachment_upload_not_allowed_for_new_user":"با عرض پوزش، کاربران جدید نمی توانند فایل پیوست بار گذاری نماییند.","attachment_download_requires_login":"با عرض پوزش، شما برای دانلود فایل پیوست باید وارد سایت شوید."},"abandon":{"confirm":"آیا شما مطمئن هستید که میخواهید نوشته خود را رها کنید؟","no_value":"خیر، نگه دار","yes_value":"بله، رها کن"},"via_email":"این نوشته از طریق ایمیل ارسال شده است","whisper":"این ارسال نجوای خصوصی برای مدیران است","archetypes":{"save":" ذخیره تنظیمات"},"controls":{"reply":"آغاز ساخت یک پاسخ به این نوشته","like":"شبیه این نوشته","has_liked":"شما این نوشته را لایک کرده اید","undo_like":"برگنداندن لایک","edit":"ویرایش این نوشته","edit_anonymous":"با عرض پوزش، اما شما برای ویرایش این نوشته باید وارد سیستم شوید.","flag":"پرچم خصوصی این نوشته برا رسیدگی یا ارسال پیام خصوصی در باره آن","delete":"حذف این نوشته","undelete":"بازگردانی این نوشته","share":"اشتراک گذاری یک لینک در این نوشته","more":"بیشتر","delete_replies":{"confirm":{"other":"آیا شما می خواهید تعداد {{count}} پاسخ را از این نوشته حذف کنید ؟"},"yes_value":"بله، پاسخ ها را حذف کن","no_value":"نه، تنها این نوشته"},"admin":"عملیات مدیریت نوشته","wiki":"ساخت ویکی","unwiki":"حذف ویکی","convert_to_moderator":"اضافه کردن رنگ مدیر","revert_to_regular":"حذف زنگ مدیر","rebake":"باز سازی اچ تی ام ال","unhide":"آشکار کردن","change_owner":"تغییر مالکیت"},"actions":{"flag":"پرچم","defer_flags":{"other":"پرچم تسلیم"},"undo":{"off_topic":"برداشتن پرچم","spam":"برداشتن پرچم","inappropriate":"برگرداندن پرچم","bookmark":"برداشتن نشانک","like":"خنثی سازی لایک","vote":"خنثی سازی امتیاز"},"by_you":{"off_topic":"شما برای این مورد پرچم آف-تاپیک زدید","spam":"شما برای این مورد پرچم هرزنامه زدید","inappropriate":"شما این مورد را نامناسب گزارش کردید.","notify_moderators":"شما این مورد را برای بررسی پرچم زدید","notify_user":"شما یک پیام به این کاربر ارسال کردید","bookmark":"شما  روی این نوشته نشانک گذاشتید","like":"شما این نوشته را پسند کردید","vote":"شما به این نوشته رأی دادید"},"by_you_and_others":{"off_topic":{"other":"شما و {{count}} کاربر دیگر این مورد را آف-تاپیک گزارش کردید"},"spam":{"other":"شما و {{count}} کاربر دیگر این مورد را هرزنامه گزارش کردید"},"inappropriate":{"other":"شما و {{count}} کاربر دیگر این مورد را نامناسب گزارش کردید"},"notify_moderators":{"other":"شما و {{count}} کاربر دیگر این مورد را برای بررسی گزارش کردید"},"notify_user":{"other":"شما و {{count}} افراد دیگر به این کاربر پیام فرستاده اید"},"bookmark":{"other":"شما و {{count}} کاربر دیگر روی این نوشته نشانک گذاشتید"},"like":{"other":"شما و {{count}} کاربر دیگر این مورد را پسند کردید"},"vote":{"other":"شما و {{count}} کاربر دیگر به این نوشته رأی دادید"}},"by_others":{"off_topic":{"other":"{{count}} کاربر ین مورد را آف-تاپیک گزارش کردند"},"spam":{"other":"{{count}} کاربر ین مورد را هرزنامه گزارش کردند"},"inappropriate":{"other":"{{count}} کاربر این مورد را نامناسب گزارش کردند"},"notify_moderators":{"other":"{{count}} کاربر این مورد را برای بررسی گزارش کردند"},"notify_user":{"other":"{{count}} ارسال پیام به این کاربر"},"bookmark":{"other":"{{count}} کاربر روی این نوشته نشانک گذاشتند"},"like":{"other":"{{count}} کاربر این مورد را پسند کردند"},"vote":{"other":"{{count}} کاربران به این نوشته رأی دادند"}}},"delete":{"confirm":{"other":"آیا مطمئنید که می‌خواهید همهٔ آن نوشته ها را پاک کنید؟"}},"revisions":{"controls":{"first":"بازبینی نخست","previous":"بازبینی پیشین","next":"بازبینی پسین","last":"بازبینی نهایی","hide":"مخفی کردن نسخه","show":"نمایش نسخه","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"نمایش خروجی رندر با اضافات و از بین بردن درون خطی","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"نمایش تفاوت های خروجی رندر شده سو به سو","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"نمایش تفاوت های خروجی منبع اولیه سو به سو","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Raw"}}}},"category":{"can":"can\u0026hellip; ","none":"(بدون دسته)","all":"همهٔ دسته‌بندی ها","choose":"انتخاب یک دسته بندی\u0026hellip;","edit":"ویرایش","edit_long":"ویرایش","view":"نمایش موضوعات  در دسته","general":"عمومی","settings":"تنظیمات","topic_template":"قالب موضوع","delete":"پاک کردن دسته","create":"دسته بندی جدید","create_long":"ساختن یک دسته بندی جدید","save":"ذخیره سازی دسته بندی","slug":"Slug دسته بندی","slug_placeholder":"(اختیاری) dash-کلمه برای url","creation_error":"خطایی در ساخت این دسته بروز کرد.","save_error":"خطایی در ذخیره سازی این دسته بندی روی داد.","name":"نام دسته","description":"توضیحات","topic":"دسته بندی موضوع","logo":"تصویر لوگو برای دسته بندی","background_image":"تصویر پس زمینه برای دسته بندی","badge_colors":"رنگ مدال ها","background_color":"رنگ پس زمینه","foreground_color":"رنگ پیش زمینه","name_placeholder":"حداکثر یک با دوکلمه","color_placeholder":"هر رنگ وب","delete_confirm":"آیا مطمئنید که می‌خواهید این دسته‌بندی را پاک کنید؟","delete_error":"هنگام حذف دسته بندی خطایی رخ داد.","list":"فهرست دسته‌ بندی ها","no_description":"لطفا برای این دسته بندی توضیحاتی اضافه نمایید.","change_in_category_topic":"ویرایش توضیحات","already_used":"این رنگ توسط یک دسته بندی دیگر گزیده شده است","security":"امنیت","special_warning":"اخطار: این دسته بندی یک دسته بندی پیش کشت است و تنظیمات امینتی آن قابل تغییر نیست. اگر شما نمیخواهید از این دسته بندی استفاده کنید, به جای تغییر کاربرد حذفش کنید.","images":"تصاویر","auto_close_label":"بسته شدن خودکار موضوعات پس از:","auto_close_units":"ساعت ها","email_in":"آدرس ایمیل های دریافتی سفارشی:","email_in_allow_strangers":"تایید ایمیل ها از کاربران ناشناس  بدون حساب کاربری","email_in_disabled":"ارسال پست با ایمیل در تنظیمات سایت غیر فعال است. برای فعال سازی  موضوعات جدید را با ایمیل ارسال کنید, ","email_in_disabled_click":"فعال کردن تنظیمات \"email in\".","suppress_from_homepage":"برداشتن این دسته بندی از صفحه اصلی.","allow_badges_label":"امکان  اهداء مدال در این دسته بندی را بده","edit_permissions":"ویرایش پروانه‌ها","add_permission":"افزودن پروانه","this_year":"امسال","position":"موقعیت","default_position":"موقعیت پیش فرض","position_disabled":"دسته‌ها به‌ترتیب فعالیت نمایش داده می‌شوند. برای مهار ترتیب دسته‌ها در فهرست‌ها، تنظیمات «موقعیت‌های دستهٔ ثابت» را به کار اندازید.","position_disabled_click":"در تنظیمات \"مکان دسته بندی ثابت\"  فعال را کنید.","parent":"دسته مادر","notifications":{"watching":{"title":"در حال تماشا"},"tracking":{"title":"پیگیری"},"regular":{"title":"معمولی","description":"در صورتی که فردی با @name به شما اشاره کند یا به شما پاسخی دهد به شما اطلاع داده خواهد شد."},"muted":{"title":"بی صدا شد","description":"شما هیچ وقت از مبحث های تازه در این دسته بندی ها مطلع نمیشوید, و آن ها در آخرین ها نمایش داده نمیشوند."}}},"flagging":{"title":"تشکر برای کمک به نگه داشتن جامعه ما  بصورت مدنی !","action":"پرچم‌گذاری نوشته","take_action":"اقدام","notify_action":"پیام","delete_spammer":"پاک کردن هرزنگار","yes_delete_spammer":"بله، پاک‌کردن هرزنگار","ip_address_missing":"(N/A)","hidden_email_address":"(مخفی)","submit_tooltip":"ایجاد پرچم خصوصی","take_action_tooltip":"رسیدن سریع به آستانه پرچم، بلافاصله به جای انتظار برای پرچم انجمن","cant":"متأسفیم، در این زمان نمی‌توانید  روی این نوشته پرچم بگذارید.","formatted_name":{"off_topic":"آن موضوع قدیمی است","inappropriate":"این نامناسب است","spam":"آن هرزنامه است"},"custom_placeholder_notify_user":"خاص، سودمند باشید و همیشه مهربان.","custom_placeholder_notify_moderators":"به ما اجازه دهید بدانیم  شما در مورد چه چیز آن نگران هستید، و ارائه لینک مربوطه و نمونه آن امکان پذیر است."},"flagging_topic":{"title":"تشکر برای کمک به جامعه مدنی انجمن ما!","action":"پرچم‌گذاری موضوع","notify_action":"پیام"},"topic_map":{"title":"چکیدهٔ موضوع","participants_title":"نویسنده‌های فعال","links_title":"لینک‌های محبوب","clicks":{"other":"%{count} کلیک ها"}},"topic_statuses":{"warning":{"help":"این یک هشدار رسمی است."},"bookmarked":{"help":"شما بر روی این موضوع نشانک گذاشته‌اید."},"locked":{"help":"این موضوع بسته شده؛ پاسخ‌های تازه اینجا پذیرفته نمی‌شوند"},"archived":{"help":"این موضوع بایگانی شده؛ یخ زده و نمی‌تواند تغییر کند."},"locked_and_archived":{"help":"این مبحث بسته و آرشیو شده; دیگر پاسخ های تازه قبول نمیکند و قابل تغییر هم نیست"},"unpinned":{"title":"خارج کردن از سنجاق","help":"این موضوع برای شما شنجاق نشده است، آن طور منظم نمایش داده خواهد شد"},"pinned_globally":{"title":"به صورت سراسری سنجاق شد","help":"این مبحث بصورت سراسری سنجاق شده; در بالای آخرین ها و دسته بندی ها نمایش داده میشود"},"pinned":{"title":"سنجاق شد","help":"این موضوع برای شما سنجاق شده است، آن طور منظم در بالای دسته بندی نمایش داده خواهد شد."},"invisible":{"help":"این موضوع از لیست خارج شد: آن درلیست موضوعات نمایش داده نخواهد شد، و فقط از طریق لینک مستقیم در دسترس خواهد بود. "}},"posts":"نوشته‌ها","posts_long":"این موضوع {{number}} نوشته دارد","original_post":"نوشته اصلی","views":"نمایش‌ها","views_lowercase":{"other":"بازدیدها"},"replies":"پاسخ‌ها","views_long":"از این موضوع {{number}} بار بازدید شده","activity":"فعالیت","likes":"پسندها","likes_lowercase":{"other":"پسند ها"},"likes_long":"{{number}} پسند در این موضوع وجود دارد","users":"کاربران","users_lowercase":{"other":"کاربران"},"category_title":"دسته","history":"تاریخچه","changed_by":"توسط {{author}}","raw_email":{"title":"ایمیل خام","not_available":"در دسترس نیست!"},"categories_list":"فهرست دسته‌ بندی ها","filters":{"with_topics":"%{filter} موضوعات","with_category":"%{filter} %{category} موضوعات","latest":{"title":"آخرین","title_with_count":{"other":"آخرین ({{count}})"},"help":"موضوعات با نوشته های تازه"},"hot":{"title":"داغ","help":"گزینشی از داغترین موضوعات"},"read":{"title":"خواندن","help":"موضوعاتی که شما خواندید٬ بر اساس آخرین خوانده شده ها. "},"search":{"title":"جستجو","help":"جستجوی تمام موضوعات"},"categories":{"title":"دسته‌ بندی ها","title_in":"دسته بندی - {{categoryName}}","help":"همهٔ موضوعات در دسته‌ بندی ها جای گرفتند"},"unread":{"title":"خوانده‌ نشده‌","title_with_count":{"other":"خوانده‌ نشده‌ ({{count}})"},"help":"موضوعاتی که در حال حاضر مشاهده می کنید یا دنبال می کنید با نوشته های خوانده نشده","lower_title_with_count":{"other":"{{count}} خوانده نشده"}},"new":{"lower_title_with_count":{"other":"{{count}} تازه"},"lower_title":"جدید","title":"جدید","title_with_count":{"other":"جدید ({{count}})"},"help":"موضوعات  ایجاد شده در چند روز گذشته"},"posted":{"title":"نوشته‌های من","help":"در این موضوع شما نوشته داردید"},"bookmarks":{"title":"نشانک ها","help":"موضوعاتی که نشانک‌گذاری کرده‌اید."},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}} ({{count}})"},"help":"موضوعات تازه در دستهٔ {{categoryName}}"},"top":{"title":"بالاترین‌ ها","help":"بیشترین موضوعات فعال در سال گذشته، ماه  ، هفته یا روز","all":{"title":"تمام وقت"},"yearly":{"title":"سالیانه "},"quarterly":{"title":"بطور چهارگانه"},"monthly":{"title":"ماهیانه "},"weekly":{"title":"هفتگی"},"daily":{"title":"روزانه"},"all_time":"تمام وقت","this_year":"سال","this_quarter":"ربع","this_month":"ماه","this_week":"هفته","today":"امروز","other_periods":"دیدن بالاترین مطالب"}},"browser_update":"متاسفانه,\u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eمرورگر شما خیلی قدیمی است برای ادامه کار در این وب سایت\u003c/a\u003e. لطفا \u003ca href=\"http://browsehappy.com\"\u003eمرورگر خود را بروز رسانی نمایید\u003c/a\u003e.","permission_types":{"full":"ساختن / پاسخ دادن / دیدن","create_post":"پاسخ دادن / دیدن","readonly":"دیدن"},"poll":{"voters":{"other":"رأی دهندگان"},"total_votes":{"other":"مجموع آرا"},"average_rating":"میانگین امتیاز:  \u003cstrong\u003e%{average}\u003c/strong\u003e.","cast-votes":{"title":"انداختن رأی شما","label":"رای بدهید!"},"show-results":{"title":"نتایج نظرسنجی را نمایش بده","label":"نتایج را نشان بده"},"hide-results":{"title":"برگشتن به رای گیری ","label":"نتایج را مخفی کن "},"open":{"title":"نظرسنجی را باز کن ","label":"باز","confirm":"آیا از باز کردن این نظرسنجی اطمینان دارید ؟ "},"close":{"title":"نظرسنجی را ببند","label":"بسته ","confirm":"آیا از بستن این نظرسنجی اطمینان دارید ؟ "}},"type_to_filter":"بنویسید تا فیلتر کنید...","admin":{"title":"ادمین دیسکورس","moderator":"مدیران","dashboard":{"title":"پیشخوان","last_updated":"آخرین به‌ روزرسانی پیش‌خوان","version":"نسخه","up_to_date":"شما به روز هستید!","critical_available":"به روز رسانی مهم در دسترس است.","updates_available":"بروز رسانی در درسترس است.","please_upgrade":"لطفا ارتقاء دهید!","no_check_performed":"بررسی برای بروزرسانی انجام نشد. از اجرای sidekiq اطمینان حاصل کنید.","stale_data":"بررسی برای بروزرسانی اخیراً انجام نگرفته است. از اجرای  sidekiq اطمینان حاصل کنید.","version_check_pending":"گویا به‌تازگی به‌روز کرده‌اید. عالیه!","installed_version":"نصب","latest_version":"آخرین","problems_found":"ما در نصب Discourse شما چند مشکل پیدا کرده ایم.","last_checked":" آخرین چک شده","refresh_problems":"تازه کردن","no_problems":"هیچ مشکلات پیدا نشد.","moderators":"مدیران:","admins":"مدیران کل:","blocked":"مسدود شده ها:","suspended":"تعلیق شده:","private_messages_short":"پیام","private_messages_title":"پیام","mobile_title":"موبایل","space_free":"{{size}} آزاد","uploads":"بارگذاری ها","backups":"پشتیبان ها","traffic_short":"ترافیک","traffic":"درخواست های نرم افزار وب","page_views":"درخواست های API","page_views_short":"درخواست های API","show_traffic_report":"نمایش دقیق گزارش ترافیک","reports":{"today":"امروز","yesterday":"دیروز","last_7_days":"7 روز اخیر","last_30_days":"آخرین 30 روز","all_time":"همه زمان ها","7_days_ago":"7 روز پیش","30_days_ago":"30 روز پیش","all":"همه","view_table":"جدول","refresh_report":"تازه کردن گزارش","start_date":"تاریخ شروع","end_date":"تاریخ پایان"}},"commits":{"latest_changes":"آخرین تغییرات: لطفا دوباره به روز رسانی کنید!","by":"توسط"},"flags":{"title":"پرچم ها","old":"قدیمی","active":"فعال","agree":"موافقت کردن","agree_title":"تایید این پرچم به عنوان معتبر و صحیح","agree_flag_modal_title":"موافقت کردن و...","agree_flag_hide_post":"موافقت با (مخفی کردن نوشته + ارسال پیام خصوصی)","agree_flag_hide_post_title":"این نوشته را مخفی کن و به کاربر به صورت خودکار پیام ارسال کن تا این نوشته را ویرایش کند","agree_flag_restore_post":"موافقم (بازگرداندن نوشته)","agree_flag_restore_post_title":"بازگرداندن این نوشته","agree_flag":"موافقت با پرچم گذاری","agree_flag_title":"موافقت با پرچم و نگه داشتن نوشته بدون تغییر","defer_flag":" واگذار کردن","defer_flag_title":"حذف این پرچم; بدون نیاز به اقدام در این زمان","delete":"حذف","delete_title":"حذف پرچم نوشته و اشاره به.","delete_post_defer_flag":"حذف نوشته و رها کردن پرچم","delete_post_defer_flag_title":"حذف نوشته; اگر اولین نوشته است، موضوع را حذف نمایید.","delete_post_agree_flag":"حذف نوشته و موافقت با پرچم","delete_post_agree_flag_title":"حذف نوشته; اگر اولین نوشته است، موضوع را حذف نمایید.","delete_flag_modal_title":"حذف و...","delete_spammer":"حذف اسپمر","delete_spammer_title":"حذف کاربر و تمام نوشته ها و موضوعات این کاربر","disagree_flag_unhide_post":"مخالفم (با رویت نوشته)","disagree_flag_unhide_post_title":"حذف تمام پرچم های این نوشته و دوباره نوشته را قابل نمایش کن ","disagree_flag":"مخالف","disagree_flag_title":"انکار این پرچم به عنوان نامعتبر است و یا نادرست","clear_topic_flags":"تأیید","clear_topic_flags_title":"موضوع بررسی و موضوع حل شده است. تأیید را بفشارید تا پرچم‌ها برداشته شوند.","more":"(پاسخ های بیشتر...)","dispositions":{"agreed":"موافقت شد","disagreed":"مخالفت شد","deferred":"دیرفرست"},"flagged_by":"پرچم شده توسط","resolved_by":"حل شده توسط","took_action":"زمان عمل","system":"سیستم","error":"اشتباهی روی داد","reply_message":"پاسخ دادن","no_results":"هیچ پرچمی نیست","topic_flagged":"این \u003cstrong\u003eموضوع\u003c/strong\u003e پرچم خورده است.","visit_topic":" موضوع را ببینید برای اقدام لازم","was_edited":"نوشته پس از پرچم اول ویرایش شد","previous_flags_count":"این موضوع در حال حاضر با {{count}} پرچم گذاری شده است.","summary":{"action_type_3":{"other":"موضوعات غیرفعال x{{count}}"},"action_type_4":{"other":"نامناسب X{{count}}"},"action_type_6":{"other":"دلخواه x{{count}}"},"action_type_7":{"other":"دلخواه x{{count}}"},"action_type_8":{"other":" هرزنامه x{{count}}"}}},"groups":{"primary":"گروه اولیه","no_primary":"(بدون گروه اولیه)","title":"گروه‌ها","edit":"ویرایش گروه‌ها","refresh":"تازه کردن","new":"جدید","selector_placeholder":"نام کاربری را وارد نمایید .","name_placeholder":"نام گروه، بدون فاصله، همان قاعده نام کاربری","about":"اعضای گروهت و نام ها  را اینجا ویرایش کن","group_members":"اعضای گروه","delete":"حذف","delete_confirm":"حفظ کردن این گروه؟","delete_failed":"قادر به حذف گروه نیستیم. اگر این یک گروه خودکار است، نمی توان آن را از بین برد.","delete_member_confirm":"حذف کردن '%{username}' از '%{group}' گروه؟","delete_owner_confirm":"حذف حق مالکیت برای '%{username}'؟","name":"نام","add":"اضافه کردن","add_members":"اضافه کردن عضو","custom":"دلخواه","bulk_complete":"کاربران به گروه اضافه شدند.","bulk":"اضافه کردن تعداد زیادی به گروه","bulk_paste":"یک لیست از نام های کاربری و یا ایمیل ها وارد کنید, در هر خط فقط یکی:","bulk_select":"(یک گروه انتخاب کنید)","automatic":"خودکار","automatic_membership_email_domains":" کاربرانی که با ایمیل  دامنه ثبت نام کرده اند،دقیقا شبیه دامنه های لیست، بصورت خودکار به این گروه اضافه می شوند :","automatic_membership_retroactive":"درخواست همان قاعده دامنه ایمیل برای اضافه کردن برای کاربران ثبت نام کرده","default_title":"عنوان را پیش فرض کن برای تمام اعضا در این گروه","primary_group":"بطور خودکار به گروه اصلی تبدیل شد","group_owners":"مالکین","add_owners":"افزودن مالک","incoming_email":"آدرس ایمیل های دریافتی سفارشی","incoming_email_placeholder":"آدرس ایمیل را وارد کنید"},"api":{"generate_master":"ایجاد کلید اصلی API","none":"هم اکنون هیچ کلید API فعالی وجود ندارد","user":"کاربر","title":"API","key":"کلید API","generate":"تولید کردن","regenerate":"ایجاد مجدد","revoke":"لغو کردن","confirm_regen":"آیا می خواهید API موجود را با یک API جدید جایگزین کنید؟","confirm_revoke":"آیا مطمئن هستید که می خواهید کلید را برگردانید؟","info_html":"موضوعات تازه پس از آخرین بازدید شما","all_users":"همه کاربران","note_html":"این کلید را \u003cstrong\u003eامن\u003c/strong\u003e نگهدارید، تمام  کاربرانی که آن را دارند می توانند نوشته های دلخواه بسازند به عنوان هر کاربری"},"plugins":{"title":"افزونه ها","installed":"افزونه های نصب شده","name":"نام","none_installed":"شما هیچ افزونه نصب شده ای  ندارید","version":"نسخه","enabled":"فعال شده؟","is_enabled":"Y","not_enabled":"N","change_settings":"تغییر تنظیمات","change_settings_short":"تنظیمات","howto":"چگونه یک افزونه نصب کنیم؟"},"backups":{"title":"پشتیبان گیری","menu":{"backups":"پشتیبان ها","logs":"گزارش ها"},"none":"هیچ پشتیبانی در دسترس نیست.","logs":{"none":"هنوز بدون گزارش است ..."},"columns":{"filename":"نام پرونده","size":"اندازه"},"upload":{"label":"بار گذاری","title":"آپلود یک نسخه پشتیبان برای نمونه","uploading":"در حال بار گذاری ...","success":"'{{filename}}' با موفقیت آپلود شد.","error":"هنگام آپلود خطایی رخ می دهد '{{filename}}': {{message}}"},"operations":{"is_running":"عملیاتی در جریان است...","failed":"{{operation}} ناموفق شد. لطفا گزارشات را بررسی نمایید.","cancel":{"label":"لغو کردن","title":"کنار گذاشتن عملیات کنونی","confirm":"آیا مطمئنید که می‌خواهید عملیات کنونی را کنار بگذارید؟"},"backup":{"label":"پشتیبان گیری","title":"ساخت یک پشتیبان","confirm":"آیا می خواهید یک پشیبان گیری جدید را آغاز نمایید ؟","without_uploads":"بله (فایل ها را شامل نمی شود)"},"download":{"label":"دانلود","title":"دانلود پشتیبان"},"destroy":{"title":"پاک کردن پشتیبان","confirm":"آیا مطمئنید که می‌خواهید پشتیبان را از بین ببرید؟"},"restore":{"is_disabled":"بازگردانی در تنظیمات سایت از کار انداخته شده است.","label":"بازیابی","title":"بازیابی  پشتیبان"},"rollback":{"label":"عقبگرد","title":"عقب گرد پایگاه داده به حالت کار قبلی"}}},"export_csv":{"user_archive_confirm":"آیا مطمئنید که می‌خواهید نوشته‌هایتان را دانلود کنید؟","success":"فرایند برون ریزی، به شما از طریق پیام اطلاع رسانی خواهد شد وقتی این فرایند تکمیل شود.","failed":"برون ریزی شکست خورد.  لطفا لوگ گزارشات را مشاهده فرمایید.","rate_limit_error":"نوشته ها را می توانید روزی فقط یک بار دانلود کنید. لطفا فردا دوباره امتحان کنید.","button_text":"خروجی گرفتن","button_title":{"user":"برون ریزی لیست کاربر در قالب CSV .","staff_action":"برون ریزی تمام فعالیت  مدیران با فرمت CSV .","screened_email":"برون ریزی کامل لیست ایمیل به نمایش در آمده در فرمت CSV.","screened_ip":"برون ریزی کامل لیست IP به نمایش در آمده در فرمت CSV.","screened_url":"برون ریزی کامل لیست URL به نمایش در آمده در فرمت CSV."}},"export_json":{"button_text":"خروجی گرفتن"},"invite":{"button_text":"ارسال دعوتنامه","button_title":"ارسال دعوتنامه"},"customize":{"title":"شخصی‌سازی","long_title":"شخصی‌سازی سایت","css":"CSS","header":"سردر","top":"بالا","footer":"پانوشته ","embedded_css":"CSS جاساز شده","head_tag":{"text":"\u003c/head\u003e","title":"HTML هایی که  قرار داده شده  قبل از تگ \u003c/head\u003e "},"body_tag":{"text":"\u003c/body\u003e","title":"HTML هایی که  قرار داده شده  قبل از تگ \u003c/body\u003e "},"override_default":"شامل شیوه نامه استاندارد نکن","enabled":"فعال شد؟","preview":"پیش‌نمایش","undo_preview":"حذف پیش نمایش","rescue_preview":"به سبک پیش فرض","explain_preview":"مشاهده‌ی سایت با این قالب سفارشی","explain_undo_preview":"بازگشت به شیوه نامه های  فعال شخصی","explain_rescue_preview":"دیدن سایت با شیوه نامه پیش فرض","save":"ذخیره سازی","new":"تازه","new_style":"سبک جدید","import":"ورود داده‌ها","import_title":"فایلی را انتخاب یا متنی را پیست کنید","delete":"پاک کردن","delete_confirm":"پاک کردن این شخصی‌سازی؟","about":"اطلاح شیوه نامه CSS و هدر HTML در سایت، اضافه کردنیک سفارشی سازی برای شروع.","color":"رنگ","opacity":"تاری","copy":"کپی","email_templates":{"title":"قالب های ایمیل","subject":"عنوان","multiple_subjects":"این قالب ایمیل دارای چندین عنوان است.","body":"بدنه","none_selected":"یک قالب ایمیل برای شروع ویرایش انتخاب کنید.","revert":"باطل کردن تغییرات","revert_confirm":"آیا مطمئن هستید که میخواهید تنظیمات را باطل کنید؟"},"css_html":{"title":"CSS/HTML","long_title":"شخصی‌سازی CSS و HTML"},"colors":{"title":"رنگ‌ها","long_title":"طرح‌های رنگی","about":"تغییر رنگ استفاده شده در انجمن بدون نوشتن کد CSS.با اضافه کردن یک طرح شروع کنید.","new_name":"طرح رنگ جدید","copy_name_prefix":"نمونه سازی از","delete_confirm":"این طرح رنگ پاک شود؟","undo":"خنثی کردن","undo_title":"برگشت دادن رنگ دخیره شده خود به آخرین رنگی که ذخیره شده است","revert":"برگشت","revert_title":"تنظیم مجدد این رنگ به رنگ به پیش فرض دیسکورس.","primary":{"name":"اولی","description":"متن بیشتر، آیکون ها، و کناره ها."},"secondary":{"name":"دومی","description":"رنگ پس زمینه اصلی، و رنگ متن برخی از دکمه ها."},"tertiary":{"name":"سومین","description":"لینک ها، برخی از دکمه ها، اطلاعیه ها، و مد رنگ."},"quaternary":{"name":"چهارمی","description":"لینک های ناوبری."},"header_background":{"name":"پس زمینه هدر","description":"رنگ پس زمینه هدر سایت"},"header_primary":{"name":"هدر اولیه","description":"نوشته و آیکن های هدر سایت"},"highlight":{"name":"برجسته کردن","description":"رنگ پس زمینه عناصر  را برجسته  کرده  بر روی صفحه، مانند نوشته ها و موضوعات."},"danger":{"name":"خطرناک","description":"رنگ اقدامات  را برجسته کردن  مانند حذف نوشته ها و موضوعات."},"success":{"name":"موفقیت","description":"استفاده شده برای  مشخص کردن اقدام موفقیت آمیز بود"},"love":{"name":"دوست داشتن","description":"رنگ دکمه های لایک"}}},"email":{"settings":"تنظیمات","preview_digest":"پیشنمایش خلاصه","sending_test":"فرستادن ایمیل آزمایشی...","error":"\u003cb\u003eخطا\u003c/b\u003e - %{server_error}","test_error":"در ارسال ایمیل آزمایشی مشکلی وجود داشته است. لطفاً مجدداً تنظیمات ایمیل خود را بررسی کنید، از این که هاستتان اتصالات ایمیل را مسدود نکرده اطمینان حاصل کرده و مجدداً تلاش کنید.","sent":"فرستاده شده","skipped":"رد داده شده","sent_at":"ارسال شده در","time":"زمان","user":"کاربر","email_type":"نوع ایمیل","to_address":"به آدرس","test_email_address":"آدرس ایمیل برای آزمایش","send_test":"ارسال ایمیل آزمایشی","sent_test":"فرستاده شد!","delivery_method":"روش تحویل","preview_digest_desc":"پیش نمایش محتوای خلاصه ایمیل های ارسال شده به کاربران غیر فعال.","refresh":"تازه‌سازی","format":"قالب","html":"html","text":"متن","last_seen_user":"آخرین مشاهده کاربر :","reply_key":"کلید پاسخ","skipped_reason":"رد دادن دلیل","logs":{"none":"هیچ آماری یافت نشد.","filters":{"title":"فیلتر","user_placeholder":"نام کاربری","address_placeholder":"name@example.com","type_placeholder":"خلاصه، ثبت نام ...","reply_key_placeholder":"کلید پاسخ","skipped_reason_placeholder":"دلیل"}}},"logs":{"title":"گزارش ها","action":"عمل","created_at":"ساخته شد","last_match_at":"آخرین مطابقت ","match_count":"مطابقت ها","ip_address":"IP","topic_id":" ID موضوع","post_id":"ID نوشته","category_id":"شناسه دسته بندی","delete":"حذف","edit":"ویرایش‌","save":"ذخیره ","screened_actions":{"block":"انسداد","do_nothing":"هیچ کاری نکن"},"staff_actions":{"title":"عملیات مدیران","instructions":"بر روی نام کاربر کلیک کنید تا عمل فیلتر لیست انجام شود. بر روی عکس نمایه کلیک کنید تا به صفحه کاربر هدایت شوید.","clear_filters":"همه چیز را نشان بده ","staff_user":"کاربران مدیر","target_user":"کاربران هدف","subject":"عنوان","when":"چه زمانی","context":"محتوا","details":"جزئیات","previous_value":"پیشین","new_value":"جدید","diff":"تفاوت","show":"نمایش","modal_title":"جزئیات","no_previous":"هیچ مقدار قبلی وجود ندارد.","deleted":"بدون مقدار جدید. رکورد حذف شد.","actions":{"delete_user":"حذف کاربر","change_trust_level":"تغییر دادن سطح اعتماد","change_username":"تغییر نام کاربری","change_site_setting":"تغییر تنظیمات سایت","change_site_customization":"تغییر سفارشی‌سازی سایت","delete_site_customization":"پاک‌کردن سفارشی‌سازی سایت","change_site_text":"تغییر نوشته سایت","suspend_user":"کاربر تعلیق شده","unsuspend_user":"کابر تعلیق نشده","grant_badge":"اعطای مدال","revoke_badge":"لغو کردن مدال","check_email":"برسی ایمل","delete_topic":"حذف موضوع","delete_post":"حذف نوشته","impersonate":"جعل هویت کردن","anonymize_user":"کاربر ناشناس","roll_up":"آدرس‌های IP بلاک شده را جمع کنید","change_category_settings":"تغییر تنظیمات دسته بندی","delete_category":"حذف دسته بندی","create_category":"ساخت دسته بندی"}},"screened_emails":{"title":"ایمیل ها نمایش داده شده","description":"وقتی کسی سعی می کند یک حساب جدید ایجاد کند، از آدرس ایمیل زیر بررسی و ثبت نام مسدود خواهد شد، و یا برخی از اقدام های دیگر انجام می شود.","email":"آدرس ایمیل","actions":{"allow":"اجازه"}},"screened_urls":{"title":"URL های نمایش داده شده","description":"URLs ذکر شده در اینجا در پست های کاربران مورد استفاده قرار گرفت ٬ که به عنوان اسپم شناسایی شده است","url":"URL","domain":"دامنه"},"screened_ips":{"title":"نمایش  IPs","description":"آدرس IP که مشاهده شده.  \"اجازه\" استفاده در لیست سفید.","delete_confirm":"آیا از حذف قانون وضع شده برای {ip_address}% اطمینان دارید؟","roll_up_confirm":"آیا مطمئن هستید که می خواهید IP مشاهده شده به زیر شبکه بازگشت داده شوند ؟","rolled_up_some_subnets":"با موفقیت IP مسدود شده بازگشت داده شد به ورودی های این زیر شبکه: %{subnets}.","rolled_up_no_subnet":"هیچ چیز برای ذخیره کردن وجود ندارد.","actions":{"block":"انسداد","do_nothing":"اجازه دادن","allow_admin":"به مدیر اجازه بده"},"form":{"label":"جدید:","ip_address":"نشانی IP","add":"افزودن","filter":"جستجو"},"roll_up":{"text":"جمع کردن","title":"ساخت مسدود سازی زیر شبکه جدید اگر آنها آخرین 'min_ban_entries_for_roll_up' ورودی ها بودند."}},"logster":{"title":"گزارش خطا"}},"impersonate":{"title":"جعل هویت کردن","help":"با استفاده ازابزار  جعل هویت کردن   یک حساب کاربری را برای اشکال زدایی انتخاب نمایید، شما باید بعد از اتمام کار یک بار خارج شوید.","not_found":"چنین کاربری یافت نمی‌شود.","invalid":"متأسفیم، شما نمی‌توانید خود را به جای این کاربر جا بزنید."},"users":{"title":"کاربران","create":"اضافه کردن کاربر ادمین","last_emailed":"آخرین ایمیل فرستاده شده","not_found":"متاسفیم٬ این کاربر در سیستم ما وجود ندارد.","id_not_found":"متاسفیم٬ این ID کاربری در سیستم ما وجود ندارد.","active":"فعال","show_emails":"ایمیل عا را نشان بده","nav":{"new":"جدید","active":"فعال","pending":"در انتظار","staff":"مدیران","suspended":"تعلیق شد ","blocked":"مسدود شده","suspect":"مشکوک"},"approved":"تایید شده ؟","approved_selected":{"other":"کاربران تایید شده  ({{count}})"},"reject_selected":{"other":"کاربران رد شده  ({{count}})"},"titles":{"active":"کاربران فعال","new":"کاربران تازه","pending":"کاربران در انتظار بررسی","newuser":"کاربران در سطح اعتماد 0 (کاربران جدید)","basic":"کاربران در سطح اعتماد 1 (کاربر اصلی)","member":"کاربران در سطح اعتماد 2 (عضو)","regular":"کاربران در سطح اعتماد 3 (عادی)","leader":"کاربران در سطح اعتماد 4 (رهبر)","staff":"مدیر","admins":"کاربران مدیر","moderators":"مدیران","blocked":"کاربران مسدود شده","suspended":"کاربران تعلیق شده","suspect":"کاربران مشکوک"},"reject_successful":{"other":"کاربران %{count}  با موفقیت رد شدند"},"reject_failures":{"other":"رد کاربران %{count} ناموفق بود"},"not_verified":"تایید نشده","check_email":{"title":"ایمیل این کاربران را قابل رویت کن.","text":"نشان دادن"}},"user":{"suspend_failed":"در جریان به تعلیق درآوردن این کاربر اشتباهی رخ داد. {{error}}","unsuspend_failed":"در جریان خارج کردن این کاربر از تعلیق، اشتباهی رخ داد {{error}}","suspend_duration":"کاربر چه مدت در تعلیق خواهد بود؟","suspend_duration_units":"(روز ها)","suspend_reason_label":"شما چرا معلق شده‌اید؟ این متن بر روی صفحه‌ی نمایه‌ی کاربر \u003cb/\u003eبرای همه قابل مشاهده خواهد بود\u003cb\u003e، و در هنگام ورود به سیستم نیز به خود کاربر نشان داده خواهد شد. لطفاً خلاصه بنویسید.","suspend_reason":"دلیل","suspended_by":"تعلیق شده توسط","delete_all_posts":"پاک کردن همهٔ نوشته‌ها","suspend":"تعلیق","unsuspend":"خارج کردن از تعلیق","suspended":"تعلیق شد ؟","moderator":"مدیر ؟ ","admin":"مدیر؟","blocked":"مسدود شد ؟","show_admin_profile":"مدیر","edit_title":"ویرایش سرنویس","save_title":"ذخیره سازی سرنویس","refresh_browsers":"تازه کردن اجباری مرورگر","refresh_browsers_message":"ارسال پیام به تمام مشتریان! ","show_public_profile":"نمایش نمایه عمومی","impersonate":"جعل هویت کردن","ip_lookup":"IP Lookup","log_out":"خروج","logged_out":"کاربر از کل دستگاه ها خارج شد.","revoke_admin":"ابطال مدیریت","grant_admin":"اعطای مدیریت","revoke_moderation":"پس گرفتن مدیریت","grant_moderation":"اعطای مدیریت","unblock":"رفع انسداد","block":" انسداد","reputation":" اعتبار","permissions":"پروانه‌ها","activity":"فعالیت","like_count":"لایک‌های اعطایی/ دریافتی","last_100_days":"در 100 روز گذشته","private_topics_count":"موضوعات خصوصی","posts_read_count":"خواندن نوشته ها","post_count":"نوشته ها  ایجاد شد","topics_entered":" موضوعات بازدید شده","flags_given_count":"پرچم های داده شده","flags_received_count":"پرچم های دریافت شده","warnings_received_count":"اخطار های دریافت شده","flags_given_received_count":"پرچم های  داده شده/ دریافت شده","approve":"تصویب","approved_by":"تصویب شده توسط","approve_success":"کاربر تایید شده و ایمیل با دستورالعمل فعال سازی ارسال شد.","approve_bulk_success":"موفقیت! همه کاربران انتخاب شده تایید و اطلاعیه ارسال شد.","time_read":"خواندن زمان","anonymize":"کاربر ناشناس","anonymize_confirm":"آیا مطمئن هستید که می خواهید این حساب کاربری را ناشناس کنید؟ این ایمیل و نام کاربری را تغییر و تمام اطلاعات نمایه را بطور مجدد تنظیم می کند","anonymize_yes":"بله ، این یک حساب کاربری ناشناس است.","anonymize_failed":"یک مشکل با حساب کاربری ناشناس وجود دارد","delete":"پاک کردن کاربر","delete_forbidden_because_staff":"مدیران کل و مدیران را نمی‌توانید پاک کنید","delete_posts_forbidden_because_staff":"نمی توان همه نوشته های مدیران کل و مدیران را حذف کرد","delete_forbidden":{"other":"کاربرانی را که  دارای موضوع  هستند نمی‌توانید  پاک کنید. پیش از تلاش برای پاک کردن کاربر، نخست همهٔ‌ موضوعاتش را پاک کنید. (موضوعات که بیش از %{count}  روز پیش فرستاده شده باشند، نمی‌توانند پاک شوند.)"},"cant_delete_all_posts":{"other":"نمی توان همه نوشته ها را خذف کرد. برخی نوشته ها قدیمی تر از %{count} هستند.(در delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"other":"نمی توان همه نوشته ها را خذف کرد. چون تعداد کاربران از %{count} تعداد نوشته ها بیشتر است.(delete_all_posts_max)"},"delete_confirm":"آیا مطمئن هستید که می خواهید این کاربر را حذف کنید ؟ این برای همیشه است!","delete_and_block":"حذف و \u003cb\u003eمسدود\u003c/b\u003eکن این IP و آدرس ایمل را","delete_dont_block":"فقط حذف","deleted":"کاربر پاک شد.","delete_failed":"خطایی در پاک کردن آن کاربر روی داد. پیش از تلاش برای پاک کردن کاربر، مطمئن شوید همهٔ‌ موضوعات پاک شوند.","send_activation_email":"فرستادن ایمیل فعال‌سازی","activation_email_sent":"یک ایمیل فعال‌سازی فرستاده شده است.","send_activation_email_failed":"در فرستادن ایمیل  فعال‌سازی دیگری مشکل وجود دارد. \n%{error}","activate":"فعال‌سازی شناسه کاربری","activate_failed":"در فعال‌سازی این کاربر مشکلی پیش آمد.","deactivate_account":"غیرفعال‌کردن حساب کاربری","deactivate_failed":"برای غیرفعال کردن این کاربر مشکلی وجود دارد.","unblock_failed":" برداشتن رفع انسداد این کاربر مشکلی وجود دارد.","block_failed":"برای انسداد این کاربر مشکلی وجود دارد.","deactivate_explanation":"کاربر غیر فعال باید دوباره ایمیل خود را تایید کند.","suspended_explanation":"کاربر تعلیق شده نمی‌تواند وارد سیستم شود.","block_explanation":"کاربر انسداد شده نمی‌تواند نوشته ای بگذارد یا موضوعی آغاز کند.","trust_level_change_failed":"در تغییر سطح اعتماد کاربر مشکلی پیش آمد.","suspend_modal_title":"کاربر تعلیق شده","trust_level_2_users":"کاربران سطح اعتماد 2","trust_level_3_requirements":" سطح اعتماد 3 مورد نیاز است","trust_level_locked_tip":"سطح اعتماد بسته شده است. سیستم قادر به ترفیع/تنزل درجه‌ی کاربر نیست.","trust_level_unlocked_tip":"سطح اعتماد باز شده است. سیستم قادر به ترفیع/تنزل درجه‌ی کاربر خواهد بود.","lock_trust_level":"بستن سطح اعتماد","unlock_trust_level":"باز کردن سطح اعتماد","tl3_requirements":{"title":"شرایط لازم برای سطح اعتماد 3.","value_heading":"مقدار","requirement_heading":"نیازمندی‌ها","visits":"بازدیدها","days":"روز ها","topics_replied_to":"پاسخ به موضوعات","topics_viewed":"بازدید موضوعات","topics_viewed_all_time":"موضوعات مشاهده شده ( تمام مدت )","posts_read":"نوشته‌های خوانده شده","posts_read_all_time":"نوشته‌های خوانده شده ( تمام مدت )","flagged_posts":"نوشته‌های پرچم‌خورده","flagged_by_users":"کاربرانی که پرچم خورده‌اند","likes_given":"لایک‌های اعطایی","likes_received":"لایک‌های دریافتی","likes_received_days":"لایک‌های دریافتی: روزهای خاص","likes_received_users":"لایک‌های دریافتی: کاربران خاص","qualifies":"دارای صلاحیت برای سطح اعتماد 3.","does_not_qualify":"فاقد صلاحیت برای سطح اعتماد 3.","will_be_promoted":"به‌زودی ترفیع درجه خواهد گرفت.","will_be_demoted":"به‌زودی تنزل درجه خواهد گرفت.","on_grace_period":"در حال حاضر در مهلت ارتقا٬ تنزل نخواهد گرفت.","locked_will_not_be_promoted":"سطح اعتماد بسته شده. دیگر ترفیع درجه نخواهد گرفت.","locked_will_not_be_demoted":"سطح اعتماد بسته شده. دیگردرجه تنزل نخواهد گرفت."},"sso":{"title":"ورود یکپارچه به سیستم","external_id":" ID خارجی","external_username":"نام کاربری","external_name":"نام","external_email":"ایمیل","external_avatar_url":"URL تصویر نمایه"}},"user_fields":{"title":"زمینه های  کاربر","help":"به فیلدهایی که کاربرانتان می‌توانند پر کنند اضافه کنید.","create":"ساخت فیلد برای کاربر","untitled":"بدون عنوان","name":"نام فیلد","type":"نوع فیلد","description":"توضیحات فیلد","save":"ذخیره کردن","edit":"ویرایش","delete":"حذف","cancel":"لغو کردن","delete_confirm":"آیا برای حذف این فیلد کاربری مطمئن هستید ؟","options":"گزینه ها","required":{"title":"مورد نیاز در ثبت نام؟","enabled":"مورد نیاز ","disabled":"مورد نیاز نیست "},"editable":{"title":"قابل ویرایش بعد از ثبت نام؟","enabled":"قابل ویرایش","disabled":"غیر قابل ویرایش"},"show_on_profile":{"title":"در نمایه عمومی نمایش داده شود؟","enabled":"نمایش در نمایه","disabled":"در نمایه نشان ندهد"},"field_types":{"text":"فیلد متن","confirm":"تاییدیه","dropdown":"کرکره ای"}},"site_text":{"description":"شما میتوانید در انجمن خود همه متن ها را شخصی سازی کنید, لطفا با جستجو کردن متن زیر شروع کنید:","search":"جستجو برای متنی که میخواهید ویرایش کنید","title":"محتویات متن","edit":"ویرایش","revert":"باطل کردن تغییرات","revert_confirm":"آیا مطمئن هستید که میخواهید تغییرات را باطل کنید؟","go_back":"بازگشت به جستجو","recommended":"ما پیشنهاد میکنیم این متن را بر اساس نیاز های خود ویرایش کنید:","show_overriden":"تنها بازنویسی‌شده‌ها را نمایش بده"},"site_settings":{"show_overriden":"تنها بازنویسی‌شده‌ها را نمایش بده","title":"تنظیمات","reset":"بازنشانی","none":"هیچ کدام","no_results":"چیزی یافت نشد.","clear_filter":"واضح","add_url":"اضافه کردن URL","add_host":"اضافه کردن هاست","categories":{"all_results":"همه","required":"مورد نیاز","basic":"راه اندازی اولیه","users":"کاربران","posting":"در حال نوشتن","email":"رایانامه","files":"پرونده‌ها","trust":"سطح اعتماد","security":"امنیت","onebox":"یک جعبه","seo":"SEO","spam":"هرزنامه","rate_limits":"میزان محدودیت ها ","developer":"توسعه دهنده","embedding":"توکاری","legal":"حقوقی","uncategorized":"دیگر","backups":"پشتیبان‌ها","login":"ورود","plugins":"افزونه ها","user_preferences":"تنظیمات کاربری"}},"badges":{"title":"مدال ها","new_badge":"مدال جدید","new":"جدید","name":"نام","badge":"مدال","display_name":"نام نمایشی","description":"توضیح","badge_type":"نوع مدال","badge_grouping":"گروه","badge_groupings":{"modal_title":"گروه بندی مدال"},"granted_by":"اعطا شده توسط","granted_at":"اعطا شده در","reason_help":"(یک لینک به یک نوشته یا موضوع)","save":"ذخیره سازی","delete":"پاک کردن","delete_confirm":"آیا مطمئنید که می‌خواهید این مدال را پاک کنید؟","revoke":"ابطال ","reason":"دلیل","expand":"گستردن hellip\u0026;","revoke_confirm":"آیا مطمئنید که می‌خواهید این مدال را باطل کنید؟","edit_badges":"ویرایش مدال‌ها","grant_badge":"اعطای مدال","granted_badges":"مدال های اعطایی","grant":"اهداء","no_user_badges":"%{name} هیچ مدالی دریافت نکرده است.","no_badges":"مدالی برای اعطا کردن وجود ندارد.","none_selected":"برای شروع یک مدال رو انتخاب کنید","allow_title":"اجازه استفاده مدال برای عنوان","multiple_grant":"نمی توان چندین با اهداء کرد","listable":"نشان دادن مدال در صفحه مدال های عمومی","enabled":"به‌کارگیری مدال","icon":"آیکن","image":"تصویر","icon_help":"استفاده از یک نوع فونا باحال  یا URL به یک تصویر","query":"پرس جوی مدال (SQL)","target_posts":"پرس و جو نوشته های هدف","auto_revoke":"لفو اجرای روزانه پروس و جو","show_posts":"نمایش نوشته ای که در آن مدال اهداء شده در صفحه مدال ها","trigger":"گیره","trigger_type":{"none":"به‌روزرسانی روزانه","post_action":"هنگامی‌که کاربری روی نوشته ای کاری انجام می‌دهد","post_revision":"هنگامی که یک کاربر نوشته ای ویرایش می‌کند یا فرستد","trust_level_change":"هنگامی که کاربری سطح اعتماد را تغییر می‌دهد","user_change":"هنگامی که کاربری ویرایش یا ساخته می‌شود"},"preview":{"link_text":"پیش نمایش مدال های اعطایی","plan_text":"پیشنمایش با طرح پرسش","modal_title":"پیشنمایش پرسش مدال ","sql_error_header":"خطایی با پرسش وجود دارد","error_help":"پیروی کنید از پیوند برای کمک در رابطه با پرسش مدال ها","bad_count_warning":{"header":"هشدار!","text":"نمونه اعطای گم شده وجود دارد. این اتفاق زمانی می افتد که پرس و جوuser IDs یا post IDs که وجود ندارد را برمی گرداند. این ممکن است باعث خیلی از نتایج غیر منتظره بعد از آن شود - لطفا دوباره بررسی کنید."},"no_grant_count":"هیچ مدالی برای اختصاص دادن وجود ندارد.","grant_count":{"other":"\u003cb\u003e%{count}\u003c/b\u003e مدالهایی که قرار است اختصاص داده شود."},"sample":"نمونه:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e برای نوشته در %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e برای نوشته %{link} در \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e در \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"شکلک","help":"اضافه کردن شکلک های جدید که در دسترس همگان خواهد بود.(PROTIP: کشیدن و رها کردن فایل های چندگانه در یک بار)","add":"افزودن شکلک جدید","name":"نام","image":"تصویر","delete_confirm":"آیا مطمئنید که می‌خواهید شکلک :{name}%: را پاک کنید؟"},"embedding":{"get_started":"اگر مایل هستید که Discourse را بر روی یک وبسایت دیگر جاساز کنید, با اضافه کردن میزبان یا همان هاست آن وبسایت شروع کنید.","confirm_delete":"آیا مطمئن هستید که میخواهید آن میزبان را حذف کنید؟","sample":"از این کد HTML در سایت خود استفاده کنید تا بتوانید مبحث های Discourse ایجاد کنید یا جاساز کنید, این کد \u003cb\u003eREPLACE_ME\u003c/b\u003e را به URL استاندارد صفحه ای که بر روی آن جاسازی میکنید تغییر دهید.","title":"جاسازی","host":"میزبان های مجاز","edit":"ویرایش","category":"ارسال به دسته بندی","add_host":"اضافه کردن میزبان","settings":"تنظیمات جاسازی","feed_settings":"تنظیمات فید","feed_description":"اضافه کردن یک RSS/ATOM فید به وبسایت باعث افزایش قابلیت Discourse برای وارد کردن محتوای شما میشود.","crawling_settings":"تنظیمات خزنده","crawling_description":"وقتی که Discourse مبحث هایی برای ارسال های شما ایجاد میکند, اگر هیچ RSS/ATOM فیدی موجود نبود سعی میکند که محتوای شما را از HTML تان تجزیه کند. گاهی اوقات استخراج محتوای شما سخت است, برای همین ما قابلیت تعیین قوانین CSS را میدهیم که استخراج را آسان تر میکند.","embed_by_username":"نام کاربری برای ساخت مبحث","embed_post_limit":"حداکثر تعداد پست هایی که میتوان جاساز کرد","embed_username_key_from_feed":"کلیدی برای کشیدن نام کاربری Discourse از فید","embed_truncate":"کوتاه کردن نوشته های جاسازی شده","embed_whitelist_selector":"CSS انتخاب کننده برای المان هایی که اجازه دارند جاسازی شوند","embed_blacklist_selector":"انتخاب کننده CSS برای المان هایی که از جاسازی پاک شده اند","feed_polling_enabled":"وارد کردن پست ها توسط RSS/ATOM","feed_polling_url":" لینک RSS/ATOM فید برای خزیدن","save":"ذخیره تنظیمات کدهای جاساز"},"permalink":{"title":" پیوند دائمی","url":"آدرس","topic_id":"شناسه موضوع","topic_title":"موضوع","post_id":"شناسه نوشته","post_title":"نوشته","category_id":"شناسه دسته بندی","category_title":"دسته بندی","external_url":" آدرس خارجی","delete_confirm":"آیا مطمئنید که می‌خواهید این لینک دائمی را پاک کنید؟","form":{"label":"جدید:","add":"افزودن","filter":"جستجو (آدرس یا آدرس خارجی)"}}}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"tiny":{"less_than_x_seconds":{"one":"\u003c 1s"},"x_seconds":{"one":"1s"},"x_minutes":{"one":"1m"},"about_x_hours":{"one":"1h"},"x_days":{"one":"1d"},"about_x_years":{"one":"1y"},"over_x_years":{"one":"\u003e 1y"},"almost_x_years":{"one":"1y"}},"medium":{"x_minutes":{"one":"1 min"},"x_hours":{"one":"1 hour"},"x_days":{"one":"1 day"}},"medium_with_ago":{"x_minutes":{"one":"1 min ago"},"x_hours":{"one":"1 hour ago"},"x_days":{"one":"1 day ago"}},"later":{"x_days":{"one":"1 day later"},"x_months":{"one":"1 month later"},"x_years":{"one":"1 year later"}}},"action_codes":{"public_topic":"made this topic public %{when}","private_topic":"made this topic private %{when}","invited_user":"invited %{who} %{when}","invited_group":"invited %{who} %{when}","removed_user":"removed %{who} %{when}","removed_group":"removed %{who} %{when}"},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)","cn_north_1":"China (Beijing)"}},"links_lowercase":{"one":"link"},"every_30_minutes":"every 30 minutes","every_hour":"every hour","character_count":{"one":"{{count}} character"},"suggested_topics":{"pm_title":"Suggested Messages"},"topic_count_latest":{"one":"{{count}} new or updated topic."},"topic_count_unread":{"one":"{{count}} unread topic."},"topic_count_new":{"one":"{{count}} new topic."},"switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","queue":{"has_pending_posts":{"one":"This topic has \u003cb\u003e1\u003c/b\u003e post awaiting approval"},"delete_prompt":"Are you sure you want to delete \u003cb\u003e%{username}\u003c/b\u003e? This will remove all of their posts and block their email and IP address.","approval":{"pending_posts":{"one":"You have \u003cstrong\u003e1\u003c/strong\u003e post pending."}}},"directory":{"topics_entered":"Viewed","topics_entered_long":"Topics Viewed","total_rows":{"one":"1 user"}},"groups":{"index":"Groups","title":{"one":"group"},"topics":"Topics","mentions":"Mentions","messages":"Messages","notifications":{"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."}}},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"},"topic_stat_sentence":{"one":"%{count} new topic in the past %{unit}."}},"user":{"desktop_notifications":{"perm_denied_expl":"You denied permission for notifications. Allow notifications via your browser settings.","currently_enabled":"","currently_disabled":""},"dismiss_notifications":"Dismiss All","email_activity_summary":"Activity Summary","mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","daily":"Send daily updates","individual":"Send an email for every new post","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","watched_topics_link":"Show watched topics","automatically_unpin_topics":"Automatically unpin topics when I reach the bottom.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","messages":{"move_to_archive":"Archive"},"change_about":{"error":"There was an error changing this value."},"change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"like_notification_frequency":{"title":"Notify when liked","always":"Always","first_time_and_daily":"First time a post is liked and daily","first_time":"First time a post is liked","never":"Never"},"email_previous_replies":{"title":"Include previous replies at the bottom of emails","unless_emailed":"unless previously sent","always":"always","never":"never"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies","every_30_minutes":"every 30 minutes","every_hour":"hourly"},"include_tl0_in_digests":"Include content from new users in summary emails","email_in_reply_to":"Include an excerpt of replied to post in emails","invited":{"truncated":{"one":"Showing the first invite."},"reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!"},"summary":{"title":"Summary","stats":"Stats","time_read":"read time","topic_count":{"one":"topic created","other":"topics created"},"post_count":{"one":"post created","other":"posts created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited","other":"days visited"},"posts_read":{"one":"post read","other":"posts read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"},"top_replies":"Top Replies","no_replies":"No replies yet.","more_replies":"More Replies","top_topics":"Top Topics","no_topics":"No topics yet.","more_topics":"More Topics","top_badges":"Top Badges","no_badges":"No badges yet.","more_badges":"More Badges","top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."}},"read_only_mode":{"enabled":"This site is in read only mode. Please continue to browse, but replying, likes, and other actions are disabled for now.","logout_disabled":"Logout is disabled while the site is in read only mode."},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"replies_lowercase":{"one":"reply"},"summary":{"description":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies.","description_time":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies with an estimated read time of \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e."},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"login":{"instagram":{"title":"with Instagram","message":"Authenticating with Instagram (make sure pop up blockers are not enabled)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"emoji":"Emoji :)","unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","link_url_placeholder":"http://example.com","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} messages in your {{group_name}} inbox\u003c/p\u003e"},"alt":{"group_message_summary":"Messages in group inbox"}},"search":{"too_short":"Your search term is too short.","result_count":{"one":"1 result for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"context":{"category":"Search the #{{category}} category"}},"topics":{"bulk":{"selected":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e topic."},"change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."},"none":{"educate":{"new":"\u003cp\u003eYour new topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered new and will show a \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e indicator if they were created in the last 2 days.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e","unread":"\u003cp\u003eYour unread topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"archive_message":{"help":"Move message to your archive","title":"Archive"},"move_to_inbox":{"title":"Move to Inbox","help":"Move message back to Inbox"},"new_topics":{"one":"1 new topic"},"unread_topics":{"one":"1 unread topic"},"total_unread_posts":{"one":"you have 1 unread post in this topic"},"unread_posts":{"one":"you have 1 unread old post in this topic"},"new_posts":{"one":"there is 1 new post in this topic since you last read it"},"likes":{"one":"there is 1 like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"}},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"filters":{"n_posts":{"one":"1 post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."},"change_owner":{"instructions":{"one":"Please choose the new owner of the post by \u003cb\u003e{{old_user}}\u003c/b\u003e."}},"multi_select":{"description":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e post."}}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view 1 hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes":{"one":"{{count}} Like"},"has_likes_title":{"one":"1 person liked this post"},"has_likes_title_you":{"one":"you and 1 other person liked this post"},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","wiki":{"about":"this post is a wiki"},"few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","controls":{"delete_replies":{"confirm":{"one":"Do you also want to delete the direct reply to this post?"}}},"actions":{"defer_flags":{"one":"Defer flag"},"people":{"off_topic":"flagged this as off-topic","spam":"flagged this as spam","inappropriate":"flagged this as inappropriate","notify_moderators":"notified moderators","notify_user":"sent a message","bookmark":"bookmarked this","like":"liked this","vote":"voted for this"},"by_you_and_others":{"off_topic":{"one":"You and 1 other flagged this as off-topic"},"spam":{"one":"You and 1 other flagged this as spam"},"inappropriate":{"one":"You and 1 other flagged this as inappropriate"},"notify_moderators":{"one":"You and 1 other flagged this for moderation"},"notify_user":{"one":"You and 1 other sent a message to this user"},"bookmark":{"one":"You and 1 other bookmarked this post"},"like":{"one":"You and 1 other liked this"},"vote":{"one":"You and 1 other voted for this post"}},"by_others":{"off_topic":{"one":"1 person flagged this as off-topic"},"spam":{"one":"1 person flagged this as spam"},"inappropriate":{"one":"1 person flagged this as inappropriate"},"notify_moderators":{"one":"1 person flagged this for moderation"},"notify_user":{"one":"1 person sent a message to this user"},"bookmark":{"one":"1 person bookmarked this post"},"like":{"one":"1 person liked this"},"vote":{"one":"1 person voted for this post"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"revert":"Revert to this revision"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links...","clicks":{"one":"1 click"}},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"views_lowercase":{"one":"view"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (1)"}},"unread":{"title_with_count":{"one":"Unread (1)"},"lower_title_with_count":{"one":"1 unread"}},"new":{"lower_title_with_count":{"one":"1 new"},"title_with_count":{"one":"New (1)"}},"category":{"title_with_count":{"one":"{{categoryName}} (1)"}}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"public":{"title":"Votes are public."},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 2 options"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph","groups":"All groups"}},"flags":{"summary":{"action_type_3":{"one":"off-topic"},"action_type_4":{"one":"inappropriate"},"action_type_6":{"one":"custom"},"action_type_7":{"one":"custom"},"action_type_8":{"one":"spam"}}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}},"operations":{"restore":{"confirm":"Are you sure you want to restore this backup?"},"rollback":{"confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"email":{"title":"Emails","templates":"Templates","bounced":"Bounced","received":"Received","rejected":"Rejected","incoming_emails":{"from_address":"From","to_addresses":"To","cc_addresses":"Cc","subject":"Subject","error":"Error","none":"No incoming emails found.","modal":{"title":"Incoming Email Details","error":"Error","headers":"Headers","subject":"Subject","body":"Body","rejection_message":"Rejection Mail"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Subject...","error_placeholder":"Error"}}},"logs":{"staff_actions":{"actions":{"block_user":"block user","unblock_user":"unblock user","grant_admin":"grant admin","revoke_admin":"revoke admin","grant_moderation":"grant moderation","revoke_moderation":"revoke moderation","backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"users":{"approved_selected":{"one":"approve user"},"reject_selected":{"one":"reject user"},"reject_successful":{"one":"Successfully rejected 1 user."},"reject_failures":{"one":"Failed to reject 1 user."}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","delete_forbidden":{"one":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} day old can't be deleted.)"},"cant_delete_all_posts":{"one":"Can't delete all posts. Some posts are older than %{count} day old. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Can't delete all posts because the user has more than 1 post. (delete_all_posts_max)"},"block_confirm":"Are you sure you want to block this user? They will not be able to create any new topics or posts.","block_accept":"Yes, block this user","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"title":"Show on user card?","enabled":"shown on user card","disabled":"not shown on user card"}},"site_settings":{"categories":{"user_api":"User API","tags":"Tags","search":"Search"}},"badges":{"long_description":"Long Description","trigger_type":{"post_processed":"After a post is processed"},"preview":{"grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned."}}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_classname_whitelist":"Allowed CSS class names"}}}}};
I18n.locale = 'fa_IR';
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
//! locale : Persian (fa)
//! author : Ebrahim Byagowi : https://github.com/ebraminio

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var symbolMap = {
        '1': '۱',
        '2': '۲',
        '3': '۳',
        '4': '۴',
        '5': '۵',
        '6': '۶',
        '7': '۷',
        '8': '۸',
        '9': '۹',
        '0': '۰'
    }, numberMap = {
        '۱': '1',
        '۲': '2',
        '۳': '3',
        '۴': '4',
        '۵': '5',
        '۶': '6',
        '۷': '7',
        '۸': '8',
        '۹': '9',
        '۰': '0'
    };

    var fa = moment.defineLocale('fa', {
        months : 'ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر'.split('_'),
        monthsShort : 'ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر'.split('_'),
        weekdays : 'یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه'.split('_'),
        weekdaysShort : 'یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه'.split('_'),
        weekdaysMin : 'ی_د_س_چ_پ_ج_ش'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        meridiemParse: /قبل از ظهر|بعد از ظهر/,
        isPM: function (input) {
            return /بعد از ظهر/.test(input);
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 12) {
                return 'قبل از ظهر';
            } else {
                return 'بعد از ظهر';
            }
        },
        calendar : {
            sameDay : '[امروز ساعت] LT',
            nextDay : '[فردا ساعت] LT',
            nextWeek : 'dddd [ساعت] LT',
            lastDay : '[دیروز ساعت] LT',
            lastWeek : 'dddd [پیش] [ساعت] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'در %s',
            past : '%s پیش',
            s : 'چندین ثانیه',
            m : 'یک دقیقه',
            mm : '%d دقیقه',
            h : 'یک ساعت',
            hh : '%d ساعت',
            d : 'یک روز',
            dd : '%d روز',
            M : 'یک ماه',
            MM : '%d ماه',
            y : 'یک سال',
            yy : '%d سال'
        },
        preparse: function (string) {
            return string.replace(/[۰-۹]/g, function (match) {
                return numberMap[match];
            }).replace(/،/g, ',');
        },
        postformat: function (string) {
            return string.replace(/\d/g, function (match) {
                return symbolMap[match];
            }).replace(/,/g, '،');
        },
        ordinalParse: /\d{1,2}م/,
        ordinal : '%dم',
        week : {
            dow : 6, // Saturday is the first day of the week.
            doy : 12 // The week that contains Jan 1st is the first week of the year.
        }
    });

    return fa;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['fa_IR'] = function (n) {
   return "other";
};
