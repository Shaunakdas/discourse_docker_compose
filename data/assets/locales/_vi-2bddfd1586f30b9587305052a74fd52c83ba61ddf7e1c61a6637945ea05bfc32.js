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
r += "Có ";
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
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "Chủ đề này có ";
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
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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

MessageFormat.locale.vi = function ( n ) {
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
I18n.translations = {"vi":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"Byte"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"other":"\u003c %{count}s"},"x_seconds":{"other":"%{count}s"},"x_minutes":{"other":"%{count}m"},"about_x_hours":{"other":"%{count}h"},"x_days":{"other":"%{count}d"},"about_x_years":{"other":"%{count}y"},"over_x_years":{"other":"\u003e %{count}y"},"almost_x_years":{"other":"%{count}y"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"other":"%{count} phút"},"x_hours":{"other":"%{count} giờ"},"x_days":{"other":"%{count} ngày"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"other":" %{count} phút trước"},"x_hours":{"other":"%{count} giờ trước"},"x_days":{"other":"%{count} ngày trước"}},"later":{"x_days":{"other":"còn %{count} ngày"},"x_months":{"other":"còn %{count} tháng"},"x_years":{"other":"còn %{count} năm"}},"previous_month":"Tháng Trước","next_month":"Tháng Sau"},"share":{"topic":"chia sẻ chủ đề này","post":"đăng #%{Bài đăng số}","close":"đóng lại","twitter":"chia sẻ lên Twitter","facebook":"chia sẻ lên Facebook","google+":"chia sẻ lên Google+","email":"Gửi liên kết này qua thư điện tử"},"action_codes":{"split_topic":"chìa chủ đề này lúc %{when}","invited_user":"đã mời bởi %{who} %{when}","removed_user":"loại bỏ bởi %{who} %{when}","autoclosed":{"enabled":"đóng lúc %{when}","disabled":"mở lúc %{when}"},"closed":{"enabled":"đóng lúc %{when}","disabled":"mở lúc %{when}"},"archived":{"enabled":"lưu trữ %{when}","disabled":"bỏ lưu trữ %{when}"},"pinned":{"enabled":"gắn lúc %{when}","disabled":"bỏ gim %{when}"},"pinned_globally":{"enabled":"đã gắn toàn trang %{when}","disabled":"đã bỏ gắn %{when}"},"visible":{"enabled":"đã lưu %{when}","disabled":"bỏ lưu %{when}"}},"topic_admin_menu":"quản lí chủ đề.","emails_are_disabled":"Ban quản trị đã chặn mọi email đang gửi. Sẽ không có bắt kỳ thông báo nào về email được gửi đi.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)"}},"edit":"thay đổi tiêu đề và chuyên mục của chủ đề","not_implemented":"Tính năng này chưa được hoàn thiện hết, xin lỗi!","no_value":"Không","yes_value":"Có","generic_error":"Rất tiếc, đã có lỗi xảy ra.","generic_error_with_reason":"Đã xảy ra lỗi: %{error}","sign_up":"Đăng ký","log_in":"Đăng nhập","age":"Độ tuổi","joined":"Đã tham gia","admin_title":"Quản trị","flags_title":"Báo cáo","show_more":"hiện thêm","show_help":"lựa chọn","links":"Liên kết","links_lowercase":{"other":"liên kết"},"faq":"FAQ","guidelines":"Hướng dẫn","privacy_policy":"Chính sách riêng tư","privacy":"Sự riêng tư","terms_of_service":"Điều khoản dịch vụ","mobile_view":"Xem ở chế độ di động","desktop_view":"Xem ở chế độ máy tính","you":"Bạn","or":"hoặc","now":"ngay lúc này","read_more":"đọc thêm","more":"Nhiều hơn","less":"Ít hơn","never":"không bao giờ","every_30_minutes":"mỗi 30 phút","every_hour":"mỗi giờ","daily":"hàng ngày","weekly":"hàng tuần","every_two_weeks":"mỗi hai tuần","every_three_days":"ba ngày một","max_of_count":"tối đa của {{count}}","alternation":"hoặc","character_count":{"other":"{{count}} ký tự"},"suggested_topics":{"title":"Chủ đề tương tự","pm_title":"Tin nhắn gợi ý"},"about":{"simple_title":"Giới thiệu","title":"Giới thiệu về %{title}","stats":"Thống kê của trang","our_admins":"Các quản trị viên","our_moderators":"Các điều hành viên","stat":{"all_time":"Từ trước tới nay","last_7_days":"7 ngày qua","last_30_days":"30 ngày vừa qua"},"like_count":"Lượt thích","topic_count":"Các chủ đề","post_count":"Các bài viết","user_count":"Thành viên mới","active_user_count":"Thành viên tích cực","contact":"Contact Us","contact_info":"Trong trường hợp có bất kỳ sự cố nào ảnh hưởng tới trang này, xin vui lòng liên hệ với chúng tôi theo địa chỉ %{contact_info}."},"bookmarked":{"title":"Bookmark","clear_bookmarks":"Clear Bookmarks","help":{"bookmark":"Chọn bài viết đầu tiên của chủ đề cho vào bookmark","unbookmark":"Chọn để xoá toàn bộ bookmark trong chủ đề này"}},"bookmarks":{"not_logged_in":"rất tiếc, bạn phải đăng nhập để có thể đánh dấu bài viết","created":"bạn đã đánh dấu bài viết này","not_bookmarked":"bạn đã đọc bài viết này; nhấp chuột để đánh dấu","last_read":"đây là bài viết cuối cùng bạn đã đọc; nhấp chuột để đánh dấu","remove":"Xóa đánh dấu","confirm_clear":"Bạn có chắc muốn xóa tất cả đánh dấu ở topic này?"},"topic_count_latest":{"other":"{{count}} chủ đề mới hoặc đã cập nhật."},"topic_count_unread":{"other":"{{count}} chủ đề chưa đọc."},"topic_count_new":{"other":"{{count}} chủ đề mới."},"click_to_show":"Nhấp chuột để hiển thị.","preview":"xem trước","cancel":"hủy","save":"Lưu thay đổi","saving":"Đang lưu ...","saved":"Đã lưu!","upload":"Tải lên","uploading":"Đang tải lên...","uploading_filename":"Đang tải lên {{filename}}...","uploaded":"Đã tải lên!","enable":"Kích hoạt","disable":"Vô hiệu hóa","undo":"Hoàn tác","revert":"Phục hồi","failed":"Thất bại","banner":{"close":"Xóa biểu ngữ này.","edit":"Sửa banner này \u003e\u003e"},"choose_topic":{"none_found":"Không tìm thấy chủ đề nào","title":{"search":"Tìm kiếm chủ đề dựa vào tên, url hoặc id:","placeholder":"viết tiêu đề của chủ đề thảo luận ở đây"}},"queue":{"topic":"Chủ đề","approve":"Phê duyệt","reject":"Từ chối","delete_user":"Xóa tài khoản","title":"Cần phê duyệt","none":"Không có bài viết nào để xem trước","edit":"Sửa","cancel":"Hủy","view_pending":"xem bài viết đang chờ xử lý","has_pending_posts":{"other":"Chủ đề này có \u003cb\u003e{{count}}\u003c/b\u003e bài viết cần phê chuẩn"},"confirm":"Lưu thay đổi","delete_prompt":"Bạn có chắc chắn muốn xóa \u003cb\u003e%{username}\u003c/b\u003e? Thao tác này sẽ loại bỏ tất cả các bài viết của họ kèm theo khóa địa chỉ IP và email của họ.","approval":{"title":"Bài viết cần phê duyệt","description":"Chúng tôi đã nhận được bài viết mới của bạn, nhưng nó cần phải được phê duyệt bởi admin trước khi được hiện. Xin hãy kiên nhẫn.","pending_posts":{"other":"Bạn có \u003cstrong\u003e{{count}}\u003c/strong\u003e bài viết đang chờ xử lý."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e đăng \u003ca href='{{topicUrl}}'\u003echủ đề\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eBạn\u003c/a\u003e đã đăng \u003ca href='{{topicUrl}}'\u003echủ đề\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e đã trả lời tới \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eBạn\u003c/a\u003e đã trả lời tới \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e đã trả lời \u003ca href='{{topicUrl}}'\u003echủ đề\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eBạn\u003c/a\u003e đã trả lời tới \u003ca href='{{topicUrl}}'\u003echủ đề\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e đã nhắc đến \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e đã nhắc tới \u003ca href='{{user2Url}}'\u003ebạn\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eBạn\u003c/a\u003e đã đề cập \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Được đăng bởi \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Được đăng bởi \u003ca href='{{userUrl}}'\u003ebạn\u003c/a\u003e","sent_by_user":"Đã gửi bởi \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Đã gửi bởi \u003ca href='{{userUrl}}'\u003ebạn\u003c/a\u003e"},"directory":{"filter_name":"lọc theo tên đăng nhập","title":"Thành viên","likes_given":"Đưa ra","likes_received":"Đã nhận","time_read":"Thời gian đọc","topic_count":"Chủ đề","topic_count_long":"Chủ đề đã được tạo","post_count":"Trả lời","post_count_long":"Trả lời đã được đăng","no_results":"Không tìm thấy kết quả.","days_visited":"Ghé thăm","days_visited_long":"Ngày đã ghé thăm","posts_read":"Đọc","posts_read_long":"Đọc bài viết","total_rows":{"other":"%{count} người dùng"}},"groups":{"empty":{"posts":"Không có chủ đề của các thành viên trong nhóm","members":"Không có thành viên nào trong nhóm","mentions":"Không có thành viên nào trong nhóm","messages":"Không có tin nhắn nào trong nhóm","topics":"Không có chủ đề của các thành viên trong nhóm"},"add":"Thêm","selector_placeholder":"Thêm thành viên","owner":"chủ","visible":"Mọi thành viên có thể nhìn thấy nhóm","title":{"other":"các nhóm"},"members":"Các thành viên","topics":"Chủ đề","posts":"Các bài viết","mentions":"Được nhắc đến","messages":"Tin nhắn","alias_levels":{"title":"Ai có thể nhắn tin và @mention trong nhóm này?","nobody":"Không ai cả","only_admins":"Chỉ các quản trị viên","mods_and_admins":"Chỉ có người điều hành và ban quản trị","members_mods_and_admins":"Chỉ có thành viên trong nhóm, ban điều hành, và ban quản trị","everyone":"Mọi người"},"trust_levels":{"title":"Cấp độ tin tưởng tự động tăng cho thành viên khi họ thêm:","none":"Không có gì"},"notifications":{"watching":{"title":"Đang xem","description":"Bạn sẽ được thông báo khi có bài viết mới trong mỗi tin nhắn, và số lượng trả lời mới sẽ được hiển thị"},"tracking":{"title":"Đang theo dõi","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn, và số lượng trả lời mới sẽ được hiển thị"},"regular":{"title":"Bình thường","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn"},"muted":{"title":"Im lặng","description":"Bạn sẽ không bao giờ được thông báo về bất cứ chủ đề mới nào trong nhóm này"}}},"user_action_groups":{"1":"Lần thích","2":"Lần được thích","3":"Chỉ mục","4":"Các chủ đề","5":"Trả lời","6":"Phản hồi","7":"Được nhắc đến","9":"Lời trích dẫn","11":"Biên tập","12":"Bài đã gửi","13":"Hộp thư","14":"Đang chờ xử lý"},"categories":{"all":"tất cả chuyên mục","all_subcategories":"Tất cả","no_subcategory":"không có gì","category":"Chuyên mục","category_list":"Hiễn thị danh sách chuyên mục","reorder":{"title":"Sắp xếp lại danh mục","title_long":"Tổ chức lại danh sách danh mục","fix_order":"Vị trí cố định","fix_order_tooltip":"Không phải tất cả danh mục có vị trí duy nhất, điều này có thể dẫn đến kết quả không mong muốn.","save":"Lưu thứ tự","apply_all":"Áp dụng","position":"Vị trí"},"posts":"Bài viết","topics":"Chủ đề","latest":"Mới nhất","latest_by":"mới nhất bởi","toggle_ordering":"chuyển lệnh kiểm soát","subcategories":"Phân loại phụ","topic_stat_sentence":{"other":"%{count} số lượng chủ đề mới tỏng quá khứ %{unit}."}},"ip_lookup":{"title":"Tìm kiếm địa chỉ IP","hostname":"Hostname","location":"Vị trí","location_not_found":"(không biết)","organisation":"Công ty","phone":"Điện thoại","other_accounts":"Tài khoản khác với địa chỉ IP này","delete_other_accounts":"Xoá %{count}","username":"tên đăng nhập","trust_level":"TL","read_time":"thời gian đọc","topics_entered":"chủ để đã xem","post_count":"# bài viết","confirm_delete_other_accounts":"Bạn có muốn xóa những tài khoản này không?"},"user_fields":{"none":"(chọn một tùy chọn)"},"user":{"said":"{{username}}:","profile":"Tiểu sử","mute":"Im lặng","edit":"Tùy chỉnh","download_archive":"Tải bài viết về","new_private_message":"Tin nhắn mới","private_message":"Tin nhắn","private_messages":"Các tin nhắn","activity_stream":"Hoạt động","preferences":"Tùy chỉnh","expand_profile":"Mở","bookmarks":"Theo dõi","bio":"Về tôi","invited_by":"Được mời bởi","trust_level":"Độ tin tưởng","notifications":"Thông báo","statistics":"Thống kê","desktop_notifications":{"label":"Desktop Notifications","not_supported":"Xin lỗi. Trình duyệt của bạn không hỗ trợ Notification.","perm_default":"Mở thông báo","perm_denied_btn":"Không có quyền","perm_denied_expl":"Bạn đã từ chối nhận thông báo, để nhận lại bạn cần thiết lập trình duyệt.","disable":"Khóa Notification","enable":"Cho phép Notification","each_browser_note":"Lưu ý: Bạn phải thay đổi trong cấu hình mỗi trình duyệt bạn sử dụng."},"dismiss_notifications_tooltip":"Đánh dấu đã đọc cho tất cả các thông báo chưa đọc","disable_jump_reply":"Đừng tới bài viết của tôi sau khi tôi trả lời","dynamic_favicon":"Hiện số chủ đề mới / cập nhật vào biểu tượng trình duyệt","external_links_in_new_tab":"Mở tất cả liên kết bên ngoài trong thẻ mới","enable_quoting":"Bật chế độ làm nổi bật chữ trong đoạn trích dẫn trả lời","change":"thay đổi","moderator":"{{user}} trong ban quản trị","admin":"{{user}} là người điều hành","moderator_tooltip":"Thành viên này là MOD","admin_tooltip":"Thành viên này là admin","blocked_tooltip":"Tài khoản này bị khóa","suspended_notice":"Thành viên này bị đình chỉ cho đến ngày {{date}}. ","suspended_reason":"Lý do: ","github_profile":"Github","watched_categories":"Xem","tracked_categories":"Theo dõi","muted_categories":"Im lặng","muted_categories_instructions":"Bạn sẽ không bao giờ được thông báo về bất cứ điều gì về các chủ đề mới trong các chuyên mục này, và chúng sẽ không hiển thị mới nhất","delete_account":"Xoá Tài khoản của tôi","delete_account_confirm":"Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của bạn? Hành động này không thể được hoàn tác!","deleted_yourself":"Tài khoản của bạn đã được xóa thành công.","delete_yourself_not_allowed":"Bạn không thể xóa tài khoản của bạn ngay bây giờ. Liên lạc với admin để làm xóa tài khoản  cho bạn.","unread_message_count":"Tin nhắn","admin_delete":"Xoá","users":"Thành viên","muted_users":"Im lặng","muted_users_instructions":"Ngăn chặn tất cả các thông báo từ những thành viên.","muted_topics_link":"Hiển thị chủ đề Im Lặng","automatically_unpin_topics":"Tự động bỏ ghim chủ đề khi tôi xuống cuối trang.","staff_counters":{"flags_given":"cờ hữu ích","flagged_posts":"bài viết gắn cờ","deleted_posts":"bài viết bị xoá","suspensions":"đình chỉ","warnings_received":"cảnh báo"},"messages":{"all":"Tất cả","inbox":"Hộp thư","sent":"Đã gửi","archive":"Lưu Trữ","groups":"Nhóm của tôi","bulk_select":"Chọn tin nhắn","move_to_inbox":"Chuyển sang hộp thư","move_to_archive":"Lưu trữ","failed_to_move":"Lỗi khi chuyển các tin nhắn đã chọn (có thể do lỗi mạng)","select_all":"Chọn tất cả"},"change_password":{"success":"(email đã gửi)","in_progress":"(đang gửi email)","error":"(lỗi)","action":"Gửi lại mật khẩu tới email","set_password":"Nhập Mật khẩu"},"change_about":{"title":"Thay đổi thông tin về tôi","error":"Có lỗi xảy ra khi thay đổi giá trị này."},"change_username":{"title":"Thay Username","taken":"Xin lỗi, đã có username này.","error":"Có lỗi trong khi thay đổi username của bạn.","invalid":"Username này không thích hợp. Nó chỉ chứa các ký tự  là chữ cái và chữ số. "},"change_email":{"title":"Thay đổi Email","taken":"Xin lỗi, email này không dùng được. ","error":"Có lỗi xảy ra khi thay đổi email của bạn. Có thể địa chỉ email đã được sử dụng ?","success":"Chúng tôi đã gửi email tới địa chỉ đó. Vui lòng làm theo chỉ dẫn để xác nhận lại."},"change_avatar":{"title":"Đổi ảnh đại diện","gravatar":"dựa trên \u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e","gravatar_title":"Đổi ảnh đại diện của bạn trên website Gravatar","refresh_gravatar_title":"Làm mới Gravatar của bạn","letter_based":"Hệ thống xác định ảnh đại diện","uploaded_avatar":"Chính sửa hình ảnh","uploaded_avatar_empty":"Thêm một ảnh chỉnh sửa","upload_title":"Upload hình ảnh của bạn","upload_picture":"Úp hình","image_is_not_a_square":"Cảnh báo: chúng tôi đã cắt hình ảnh của bạn; chiều rộng và chiều cao không bằng nhau.","cache_notice":"Hình hồ sở của bạn đã thay đổi thành công nhưng có thể thỉnh thoảng xuất hiện ảnh cũ bởi cache của trình duyệt."},"change_profile_background":{"title":"Hình nền trang hồ sơ","instructions":"Hình nền trang hồ sơ sẽ ở giữa và có chiều rộng mặc định là 850px."},"change_card_background":{"title":"Hình nền Card","instructions":"Hình nền sẽ ở giữa và có chiều rộng mặc định là 590px."},"email":{"title":"Email","instructions":"Không bao giờ công khai","ok":"Chúng tôi sẽ gửi thư điện tử xác nhận đến cho bạn","invalid":"Vùi lòng nhập một thư điện tử hợp lệ","authenticated":"Thư điện tử của bạn đã được xác nhận bởi {{provider}}","frequency_immediately":"Chúng tôi sẽ gửi email cho bạn ngay lập tức nếu bạn đã chưa đọc những điều chúng tôi đã gửi cho bạn qua email.","frequency":{"other":"Chúng tôi sẽ chỉ gửi email cho bạn nếu chúng tôi đã không nhìn thấy bạn trong {{count}} phút cuối."}},"name":{"title":"Tên","instructions":"Tên đầy đủ của bạn (tùy chọn)","instructions_required":"Tên đầy đủ của bạn","too_short":"Tên của bạn quá ngắn","ok":"Tên của bạn có vẻ ổn"},"username":{"title":"Username","instructions":"Duy nhất, không khoảng trắng","short_instructions":"Mọi người có thể nhắc tới bạn bằng @{{username}}","available":"Tên đăng nhập của bạn có sẵn","global_match":"Email đúng với username đã được đăng ký","global_mismatch":"Đã đăng ký rồi. Thử {{suggestion}}?","not_available":"Chưa có sẵn. Thử {{suggestion}}?","too_short":"Tên đăng nhập của bạn quá ngắn","too_long":"Tên đăng nhập của bạn quá dài","checking":"Đang kiểm tra username sẵn sàng để sử dụng....","enter_email":"Đã tìm được tên đăng nhập. Điền thư điện tử phù hợp.","prefilled":"Thư điện tử trủng với tên đăng nhập này."},"locale":{"title":"Ngôn ngữ hiển thị","instructions":"Ngôn ngữ hiển thị sẽ thay đổi khi bạn tải lại trang","default":"(mặc định)"},"password_confirmation":{"title":"Nhập lại Password"},"last_posted":"Bài viết cuối cùng","last_emailed":"Đã email lần cuối","last_seen":"được thấy","created":"Đã tham gia","log_out":"Log Out","location":"Vị trí","card_badge":{"title":"Huy hiệu của thẻ thành viên"},"website":"Web Site","email_settings":"Email","like_notification_frequency":{"title":"Thông báo khi tôi like","always":"Luôn luôn","first_time_and_daily":"Lần đầu tiên bài viết được like và hàng ngày","first_time":"Lần đầu tiên bài viết được like","never":"Không"},"email_previous_replies":{"title":"Kèm theo các trả lời trước ở dưới cùng email","unless_emailed":"trừ khi đã gửi trước đó","always":"luôn luôn","never":"không"},"email_digests":{"every_30_minutes":"mỗi 30 phút","every_hour":"hàng giờ","daily":"hàng ngày","every_three_days":"ba ngày một","weekly":"hàng tuần","every_two_weeks":"hai tuần một"},"email_in_reply_to":"Kèm theo đoạn dẫn trích trả lời bài viết trong email","email_direct":"Gửi cho tôi một email khi có người trích dẫn, trả lời cho bài viết của tôi, đề cập đến @username của tôi, hoặc mời tôi đến một chủ đề","email_private_messages":"Gửi cho tôi email khi có ai đó nhắn tin cho tôi","email_always":"Gửi email thông báo cho tôi mỗi khi tôi kích hoạt trên website này","other_settings":"Khác","categories_settings":"Chuyên mục","new_topic_duration":{"label":"Để ý tới chủ đề mới khi","not_viewed":"Tôi chưa từng xem họ","last_here":"tạo ra kể từ lần cuối tôi ở đây","after_1_day":"được tạo ngày hôm qua","after_2_days":"được tạo 2 ngày trước","after_1_week":"được tạo tuần trước","after_2_weeks":"được tạo 2 tuần trước"},"auto_track_topics":"Tự động theo dõi các chủ đề tôi tạo","auto_track_options":{"never":"không  bao giờ","immediately":"ngay lập tức","after_30_seconds":"sau 30 giây","after_1_minute":"sau 1 phút","after_2_minutes":"sau 2 phút","after_3_minutes":"sau 3 phút","after_4_minutes":"sau 4 phút","after_5_minutes":"sau 5 phút","after_10_minutes":"sau 10 phút"},"invited":{"search":"gõ để tìm kiếm thư mời ","title":"Lời mời","user":"User được mời","sent":"Đã gửi","none":"Không có thư mời nào đang chờ để hiển thị","truncated":{"other":"Hiện {{count}} thư mời đầu tiên"},"redeemed":"Lời mời bù lại","redeemed_tab":"Làm lại","redeemed_tab_with_count":"Làm lại ({{count}})","redeemed_at":"Nhận giải","pending":"Lời mời tạm hoãn","pending_tab":"Đang treo","pending_tab_with_count":"Đang xử lý ({{count}})","topics_entered":"Bài viết được xem ","posts_read_count":"Đọc bài viết","expired":"Thư mời này đã hết hạn.","rescind":"Xoá","rescinded":"Lời mời bị xóa","reinvite":"Mời lại","reinvited":"Gửi lại lời mời","time_read":"Đọc thời gian","days_visited":"Số ngày đã thăm","account_age_days":"Thời gian của tài khoản theo ngày","create":"Gửi một lời mời","generate_link":"Chép liên kết Mời","generated_link_message":"\u003cp\u003eLiên kết thư mời được tạo thành công!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eLiên kết thư mời chỉ hợp lệ cho email này: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Bạn đã mời ai ở đây chưa. Bạn có thể mời một hoặc một nhóm bằng \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003etải lên hàng loạt file mời\u003c/a\u003e.","text":"Mời hàng loạt bằng file","uploading":"Uploading...","success":"Tải lên thành công, bạn sẽ được thông báo qua tin nhắn khi quá trình hoàn tất.","error":"Có lỗi xảy ra khi upload '{{filename}}': {{message}}"}},"password":{"title":"Mật khẩu","too_short":"Mật khẩu của bạn quá ngắn.","common":"Mật khẩu quá đơn giản, rất dễ bị đoán ra","same_as_username":"Mật khẩu của bạn trùng với tên đăng nhập.","same_as_email":"Mật khẩu của bạn trùng với email của bạn.","ok":"Mật khẩu của bạn có vẻ ổn.","instructions":"Ít nhất %{count} ký tự"},"summary":{"title":"Tóm tắt","stats":"Thống kê","time_read":"thời gian đọc","topic_count":{"other":"Chủ đề đã được tạo"},"post_count":{"other":"Bài viết đã được tạo"},"days_visited":{"other":"Ngày đã ghé thăm"},"posts_read":{"other":"Bài viết đã đọc"},"top_replies":"Top trả lời","no_replies":"Chưa có trả lời.","more_replies":"Thêm trả lời","top_topics":"Top chủ đề","no_topics":"Chưa có chủ đề nào.","more_topics":"Thêm chủ đề","top_badges":"Top huy hiệu","no_badges":"Chưa có huy hiệu nào.","more_badges":"Thêm huy hiệu"},"associated_accounts":"Đăng nhập","ip_address":{"title":"Địa chỉ IP cuối cùng"},"registration_ip_address":{"title":"Địa chỉ IP đăng ký"},"avatar":{"title":"Ảnh đại diện","header_title":"hồ sơ cá nhân, tin nhắn, đánh dấu và sở thích"},"title":{"title":"Tiêu đề"},"filters":{"all":"All"},"stream":{"posted_by":"Đăng bởi","sent_by":"Gửi bởi","private_message":"tin nhắn","the_topic":"chủ đề"}},"loading":"Đang tải...","errors":{"prev_page":"trong khi cố gắng để tải","reasons":{"network":"Mạng Internet bị lỗi","server":"Máy chủ đang có vấn đề","forbidden":"Bạn không thể xem được","unknown":"Lỗi","not_found":"Không Tìm Thấy Trang"},"desc":{"network":"Hãy kiểm tra kết nối của bạn","network_fixed":"Hình như nó trở lại.","server":"Mã lỗi :  {{status}}","forbidden":"Bạn không được cho phép để xem mục này","not_found":"Oops, ứng dụng đang tải đường dẫn không tồn tại","unknown":"Có một lỗi gì đó đang xảy ra"},"buttons":{"back":"Quay trở lại","again":"Thử lại","fixed":"Load lại trang"}},"close":"Đóng lại","assets_changed_confirm":"Website đã được cập nhật bản mới. Bạn có thể làm mới lại trang để có thể sử dụng bản mới được cập nhật","logout":"Bạn đã đăng xuất","refresh":"Tải lại","read_only_mode":{"enabled":"Website đang ở chế độ chỉ đọc, bạn có thể duyệt xem nhưng không thể trả lời, likes, hay thực hiện các hành động khác.","login_disabled":"Chức năng Đăng nhập đã bị tắt khi website trong trạng thái chỉ đọc","logout_disabled":"Chức năng đăng xuất đã bị tắt khi website đang trong trạng thái chỉ đọc."},"too_few_topics_and_posts_notice":"Hãy \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ebắt đầu thảo luận!\u003c/a\u003e Hiện có \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e chủ đề và \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e bài viết. Khách ghé thăm cần một số chủ đề để đọc và trả lời.","too_few_topics_notice":"Hãy \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ebắt đầu thảo luận!\u003c/a\u003e Hiện có \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e chủ đề. Khách ghé thăm cần một số chủ đề để đọc và trả lời.","too_few_posts_notice":"Hãy \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ebắt đầu thảo luận!\u003c/a\u003e Hiện có \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e bài viết. Khách ghé thăm cần một số chủ đề để đọc và trả lời.","logs_error_rate_notice":{"rate":{"other":"%{count} lỗi/%{duration}"}},"learn_more":"tìm hiểu thêm...","year":"năm","year_desc":"chủ đề được tạo ra trong 365 ngày qua","month":"tháng","month_desc":"chủ đề được tạo ra trong 30 ngày qua","week":"tuần","week_desc":"chủ đề được tạo ra trong 7 ngày qua","day":"ngày","first_post":"Bài viết đầu tiên","mute":"Im lặng","unmute":"Bỏ im lặng","last_post":"Bài viết cuối cùng","last_reply_lowercase":"trả lời cuối cùng","replies_lowercase":{"other":"trả lời"},"signup_cta":{"sign_up":"Đăng ký","hide_session":"Nhắc vào ngày mai","hide_forever":"không, cảm ơn","hidden_for_session":"OK, Tôi sẽ hỏi bạn vào ngày mai. Bạn có thể luôn luôn sử dụng chức năng đăng nhập để tạo tài khoản.","intro":"Xin chào! :heart_eyes: Có vẻ như bạn đang thích thú để thảo luận, nhưng bạn chưa đăng nhập.","value_prop":"Khi bạn tạo tài khoản, website nhớ chính xác những gì bạn đã đọc, vì vậy bạn sẽ luôn trở lại đúng nơi đã rời đi. Bạn cũng có thể nhận thông báo ở đây hoặc qua email mỗi khi có bài viết mới. Bạn cũng có thể like bài viết để chia sẻ cảm xúc của mình. :heartbeat:"},"summary":{"enabled_description":"Bạn đang xem một bản tóm tắt của chủ đề này: các bài viết thú vị nhất được xác định bởi cộng đồng.","description":"Có \u003cb\u003e{{replyCount}}\u003c/b\u003e trả lời.","description_time":"Có \u003cb\u003e{{replyCount}}\u003c/b\u003e trả lời với thời gian đọc ước tính khoảng \u003cb\u003e{{readingTime}} phút\u003c/b\u003e.","enable":"Tóm tắt lại chủ đề","disable":"HIển thị tất cả các bài viết"},"deleted_filter":{"enabled_description":"Chủ để này có chứa các bài viết bị xoá, chúng đã bị ẩn đi","disabled_description":"Xoá các bài viết trong các chủ để được hiển thị","enable":"Ẩn các bài viết bị xoá","disable":"Xem các bài viết bị xoá"},"private_message_info":{"title":"Tin nhắn","invite":"Mời người khác...","remove_allowed_user":"Bạn thực sự muốn xóa {{name}} từ tin nhắn này?"},"email":"Email","username":"Username","last_seen":"Đã xem","created":"Tạo bởi","created_lowercase":"ngày tạo","trust_level":"Độ tin tưởng","search_hint":"username, email or IP address","create_account":{"title":"Tạo tài khoản mới","failed":"Có gì đó không đúng, có thể email này đã được đăng ký, thử liên kết quên mật khẩu"},"forgot_password":{"title":"Đặt lại mật khẩu","action":"Tôi đã quên mật khẩu của tôi","invite":"Điền vào username của bạn hoặc địa chỉ email và chúng tôi sẽ gửi bạn email để khởi tạo lại mật khẩu","reset":"Tạo lại mật khẩu","complete_username":"Nếu một tài khoản phù hợp với tên thành viên \u003cb\u003e% {username} \u003c/ b\u003e, bạn sẽ nhận được một email với hướng dẫn về cách đặt lại mật khẩu của bạn trong thời gian ngắn.","complete_email":"Nếu một trận đấu tài khoản \u003cb\u003e% {email} \u003c/ b\u003e, bạn sẽ nhận được một email với hướng dẫn về cách đặt lại mật khẩu của bạn trong thời gian ngắn.","complete_username_found":"Chúng tôi tìm thấy một tài khoản phù hợp với tên thành viên \u003cb\u003e% {username} \u003c/ b\u003e, bạn sẽ nhận được một email với hướng dẫn về cách đặt lại mật khẩu của bạn trong thời gian ngắn.","complete_email_found":"Chúng tôi tìm thấy một tài khoản phù hợp với \u003cb\u003e% {email} \u003c/ b\u003e, bạn sẽ nhận được một email với hướng dẫn về cách đặt lại mật khẩu của bạn trong thời gian ngắn.","complete_username_not_found":"Không có tài khoản phù hợp với tên thành viên \u003cb\u003e% {username} \u003c/ b\u003e","complete_email_not_found":"Không tìm thấy tài khoản nào tương ứng với \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Đăng nhập","username":"Thành viên","password":"Mật khẩu","email_placeholder":"Email hoặc tên đăng nhập ","caps_lock_warning":"Phím Caps Lock đang được bật","error":"Không xác định được lỗi","rate_limit":"Xin đợi trước khi đăng nhập lại lần nữa.","blank_username_or_password":"Bạn phải nhập email hoặc username, và mật khẩu","reset_password":"Khởi tạo mật khẩu","logging_in":"Đăng nhập...","or":"Hoặc","authenticating":"Đang xác thực...","awaiting_confirmation":"Tài khoản của bạn đang đợi kích hoạt, sử dụng liên kết quên mật khẩu trong trường hợp kích hoạt ở 1 email khác.","awaiting_approval":"Tài khoản của bạn chưa được chấp nhận bới thành viên. Bạn sẽ được gửi một email khi được chấp thuận ","requires_invite":"Xin lỗi, bạn phải được mời để tham gia diễn đàn","not_activated":"Bạn không thể đăng nhập. Chúng tôi đã gửi trước email kích hoạt cho bạn tại \u003cb\u003e{{sentTo}}\u003c/b\u003e. Vui lòng làm theo hướng dẫn trong email để kích hoạt tài khoản của bạn.","not_allowed_from_ip_address":"Bạn không thể đăng nhập từ địa chỉ IP này","admin_not_allowed_from_ip_address":"Bạn không thể đăng nhập với quyền quản trị từ địa chỉ IP đó.","resend_activation_email":"Bấm đây để gửi lại email kích hoạt","sent_activation_email_again":"Chúng tôi gửi email kích hoạt tới cho bạn ở \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Nó sẽ mất vài phút để đến; bạn nhớ check cả hồm thư spam nhe. ","to_continue":"Vui lòng đăng nhập","preferences":"Bạn cần phải đăng nhập để thay đổi cài đặt tài khoản.","forgot":"Tôi không thể nhớ lại chi tiết tài khoản của tôi.","google":{"title":"với Google ","message":"Chứng thực với Google (Bạn hãy chắc chắn là chặn popup không bật)"},"google_oauth2":{"title":"với Google","message":"Chứng thực với Google (chắc chắn rằng cửa sổ pop up blocker không được kích hoạt)"},"twitter":{"title":"với Twitter","message":"Chứng thực với Twitter(hãy chắc chắn là chăn pop up không bật)"},"instagram":{"title":"với Instagram","message":"Chứng thực với Instagram (chăc chắn rằng chặn pop-up không bật)"},"facebook":{"title":"với Facebook","message":"Chứng thực với Facebook(chắc chắn là chặn pop up không bật)"},"yahoo":{"title":"với Yahoo","message":"Chứng thực với Yahoo (Chắc chắn chặn pop up không bật)"},"github":{"title":"với GitHub","message":"Chứng thực với GitHub (chắc chắn chặn popup không bật)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"thêm...","options":"Lựa chọn","whisper":"nói chuyện","add_warning":"Đây là một cảnh báo chính thức","toggle_whisper":"Chuyển chế độ Nói chuyện","posting_not_on_topic":"Bài viết nào bạn muốn trả lời ","saving_draft_tip":"đang lưu...","saved_draft_tip":"Đã lưu","saved_local_draft_tip":"Đã lưu locally","similar_topics":"Bài viết của bạn tương tự với ","drafts_offline":"Nháp offline","error":{"title_missing":"Tiêu đề là bắt buộc","title_too_short":"Tiêu để phải có ít nhất {{min}} ký tự","title_too_long":"Tiêu đề có tối đa {{max}}  ký tự","post_missing":"Bài viết không được bỏ trắng","post_length":"Bài viết phải có ít nhất {{min}} ký tự","try_like":"Các bạn đã thử các nút \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e?","category_missing":"Bạn phải chọn một phân loại"},"save_edit":"Lưu chỉnh sửa","reply_original":"Trả lời cho bài viết gốc","reply_here":"Trả lời đây ","reply":"Trả lời ","cancel":"Huỷ","create_topic":"Tạo chủ đề","create_pm":"Tin nhắn","title":"Hoặc nhất Ctrl+Enter","users_placeholder":"Thêm thành viên ","title_placeholder":"Tóm tắt lại thảo luận này trong một câu ngắn gọn","edit_reason_placeholder":"Tại sao bạn sửa","show_edit_reason":"(thêm lý do sửa)","reply_placeholder":"Gõ ở đây. Sử dụng Markdown, BBCode, hoặc HTML để định dạng. Kéo hoặc dán ảnh.","view_new_post":"Xem bài đăng mới của bạn. ","saving":"Đang lưu","saved":"Đã lưu","saved_draft":"Bài nháp đang lưu. Chọn để tiếp tục.","uploading":"Đang đăng ","show_preview":"Xem trước \u0026raquo;","hide_preview":"\u0026laquo;ẩn xem trước","quote_post_title":"Trích dẫn cả bài viết","bold_title":"In đậm","bold_text":"chữ in đậm","italic_title":"Nhấn mạnh","italic_text":"văn bản nhấn mạnh","link_title":"Liên kết","link_description":"Nhập mô tả liên kết ở đây","link_dialog_title":"Chèn liên kết","link_optional_text":"tiêu đề tùy chọn","link_url_placeholder":"http://example.com","quote_title":"Trích dẫn","quote_text":"Trích dẫn","code_title":"Văn bản định dạng trước","code_text":"lùi đầu dòng bằng 4 dấu cách","upload_title":"Tải lên","upload_description":"Nhập mô tả tải lên ở đây","olist_title":"Danh sách kiểu số","ulist_title":"Danh sách kiểu ký hiệu","list_item":"Danh sách các mục","heading_title":"Tiêu đề","heading_text":"Tiêu đề","hr_title":"Căn ngang","help":"Trợ giúp soạn thảo bằng Markdown","toggler":"ẩn hoặc hiển thị bảng điều khiển soạn thảo","modal_ok":"OK","modal_cancel":"Hủy","cant_send_pm":"Xin lỗi, bạn không thể gởi tin nhắn đến %{username}.","admin_options_title":"Tùy chọn quản trị viên cho chủ đề này","auto_close":{"label":"Thời gian tự khóa chủ đề:","error":"Vui lòng nhập một giá trị hợp lệ.","based_on_last_post":"Không đóng cho đến khi bài viết cuối cùng trong chủ đề này trở thành bài cũ","all":{"examples":"Nhập giờ (định dạng 24h), thời gian chính xác ( vd: 17:30) hoặc thời gian kèm ngày tháng (2013-11-22 14:00)."},"limited":{"units":"(# của giờ)","examples":"Nhập số giờ ( theo định dạng 24h)"}}},"notifications":{"title":"thông báo của @name nhắc đến, trả lời bài của bạn và chủ đề, tin nhắn, vv","none":"Không thể tải các thông báo tại thời điểm này.","more":"xem thông báo cũ hơn","total_flagged":"tổng số bài viết gắn cờ","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} và {{count}} người khác\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e chấp nhận lời mời của bạn\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e chuyển {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eThu được '{{description}}'\u003c/p\u003e","group_message_summary":{"other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} tin nhắn trong {{group_name}} của bạn\u003c/p\u003e"},"alt":{"mentioned":"Được nhắc đến bởi","quoted":"Trích dẫn bởi","replied":"Đã trả lời","posted":"Đăng bởi","edited":"Bài viết của bạn được sửa bởi","liked":"Bạn đã like bài viết","private_message":"Tin nhắn riêng từ","invited_to_private_message":"Lời mời thảo luận riêng từ","invited_to_topic":"Lời mời tham gia chủ đề từ","invitee_accepted":"Lời mời được chấp nhận bởi","moved_post":"Bài viết của bạn đã được di chuyển bởi","linked":"Liên kết đến bài viết của bạn","granted_badge":"Cấp huy hiệu","group_message_summary":"Tin nhắn trong hộp thư đến"},"popup":{"mentioned":"{{username}} nhắc đến bạn trong \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} nhắc đến bạn trong \"{{topic}}\" - {{site_title}}","quoted":"{{username}} trích lời bạn trong \"{{topic}}\" - {{site_title}}","replied":"{{username}} trả lời cho bạn trong \"{{topic}}\" - {{site_title}}","posted":"{{username}} gửi bài trong \"{{topic}}\" - {{site_title}}","private_message":"{{username}} đã gửi cho bạn một tin nhắn trong \"{{topic}}\" - {{site_title}}","linked":"{{username}} liên quan đến bài viết của bạn từ \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Thêm một ảnh","title_with_attachments":"Thêm một ảnh hoặc tệp tin","from_my_computer":"Từ thiết bị của tôi","from_the_web":"Từ Web","remote_tip":"đường dẫn tới hình ảnh","remote_tip_with_attachments":"chọn ảnh hoặc file {{authorized_extensions}}","local_tip":"chọn hình từ thiết bị của bạn","local_tip_with_attachments":"chọn ảnh hoặc file {{authorized_extensions}} từ thiết bị của bạn","hint":"(Bạn cũng có thể kéo \u0026 thả vào trình soạn thảo để tải chúng lên)","hint_for_supported_browsers":"bạn có thể kéo và thả ảnh vào trình soan thảo này","uploading":"Đang tải lên","select_file":"Chọn Tài liệu","image_link":"liên kết hình ảnh của bạn sẽ trỏ đến"},"search":{"sort_by":"Sắp xếp theo","relevance":"Độ phù hợp","latest_post":"Bài viết mới nhất","most_viewed":"Xem nhiều nhất","most_liked":"Like nhiều nhất","select_all":"Chọn tất cả","clear_all":"Xóa tất cả","result_count":{"other":"{{count}} kết quả cho \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"tìm kiếm chủ đề, bài viết, tài khoản hoặc các danh mục","no_results":"Không tìm thấy kết quả.","no_more_results":"Không tìm thấy kết quả","search_help":"Giúp đỡ tìm kiếm","searching":"Đang tìm ...","post_format":"#{{post_number}} bởi {{username}}","context":{"user":"Tìm bài viết của @{{username}}","topic":"Tìm trong chủ đề này","private_messages":"Tìm tin nhắn"}},"hamburger_menu":"đi đến danh sách chủ đề hoặc danh mục khác","new_item":"mới","go_back":"quay trở lại","not_logged_in_user":"Trang cá nhân với tóm tắt các hoạt động và cấu hình","current_user":"đi đến trang cá nhân của bạn","topics":{"bulk":{"unlist_topics":"Chủ đề không công khai","reset_read":"Đặt lại lượt đọc","delete":"Xóa chủ đề","dismiss":"Bỏ qua","dismiss_read":"Bỏ qua tất cả thư chưa đọc","dismiss_button":"Bỏ qua...","dismiss_tooltip":"Bỏ qua chỉ bài viết mới hoặc ngừng theo dõi chủ đề","also_dismiss_topics":"Ngừng theo dõi các chủ đề này để không hiển thị lại là chủ đề chưa đọc","dismiss_new":"Bỏ ","toggle":"chuyển sang chọn chủ đề theo lô","actions":"Hành động theo lô","change_category":"Chuyển chuyên mục","close_topics":"Đóng các chủ đề","archive_topics":"Chủ đề Lưu trữ","notification_level":"Thay đổi cấp độ thông báo","choose_new_category":"Chọn chuyên mục mới cho chủ đề này:","selected":{"other":"Bạn đã chọn \u003cb\u003e{{count}}\u003c/b\u003e chủ đề"}},"none":{"unread":"Bạn không có chủ đề nào chưa đọc.","new":"Bạn không có chủ đề mới nào.","read":"Bạn vẫn chưa đọc bất kì chủ đề nào.","posted":"Bạn vẫn chưa đăng bài trong bất kì một chủ đề nào","latest":"Chán quá. Chẳng có chủ đề mới nào hết trơn.","hot":"Không có chủ đề nào nổi bật.","bookmarks":"Bạn chưa chủ đề nào được đánh dấu.","category":"Không có chủ đề nào trong {{category}} .","top":"Không có chủ đề top.","search":"Không có kết quả tìm kiếm.","educate":{"new":"\u003cp\u003eChủ đề mới của bạn sẽ hiển thị ở đây.\u003c/p\u003e\u003cp\u003eMặc định, chủ đề được coi là mới và sẽ hiển thị \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e cho biết chúng đã được tạo ra trong 2 ngày qua.\u003c/p\u003e\u003cp\u003eXem \u003ca href=\"%{userPrefsUrl}\"\u003ethiết lập\u003c/a\u003e của bạn nếu muốn thay đổi.\u003c/p\u003e","unread":"\u003cp\u003eChủ đề chưa đọc của bạn sẽ hiển thị ở đây.\u003c/p\u003e\u003cp\u003eMặc định, chủ đề được coi là chưa đọc và sẽ hiển thị số \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e nếu bạn:\u003c/p\u003e\u003cul\u003e\u003cli\u003eĐã tạo chủ đề\u003c/li\u003e\u003cli\u003eĐã trả lời chủ đề\u003c/li\u003e\u003cli\u003eĐọc chủ đề trong hơn 4 phút\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eHoặc nếu bạn đã thiết lập một cách rõ ràng các chủ đề Theo dõi hoặc Xem thông qua việc kiểm soát thông báo ở dưới cùng của mỗi chủ đề.\u003c/p\u003e\u003cp\u003eXem \u003ca href=\"%{userPrefsUrl}\"\u003ethiết lập\u003c/a\u003e của bạn nếu muốn thay đổi.\u003c/p\u003e"}},"bottom":{"latest":"Không còn thêm chủ đề nào nữa.","hot":"Không còn của đề nổi bật nào nữa.","posted":"Ở đây không có thêm chủ đề nào được đăng.","read":"Không còn thêm chủ đề chưa đọc nào nữa.","new":"Không còn thêm chủ đề mới nào nữa.","unread":"Không còn thêm chủ đề chưa đọc nào nữa.","category":"Không còn thêm chủ đề nào trong {{category}} .","top":"Không còn của đề top nào nữa.","bookmarks":"Không còn thêm chủ đề được đánh dấu nào nữa.","search":"Không có thêm kết quả tìm kiếm nào nữa."}},"topic":{"unsubscribe":{"stop_notifications":"Từ bây giờ bạn sẽ không nhận thông báo từ \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Tình trạn thông báo của bạn là"},"create":"Chủ đề Mới","create_long":"Tạo một Chủ đề mới","private_message":"Bắt đầu một thông điệp","archive_message":{"help":"Chuyển tin nhắn sang lưu trữ","title":"Lưu trữ"},"move_to_inbox":{"title":"Chuyển sang hộp thư","help":"Chuyển tin nhắn trở lại hộp thư"},"list":"Chủ đề","new":"chủ đề mới","unread":"chưa đọc","new_topics":{"other":"{{count}} chủ đề mới."},"unread_topics":{"other":"{{count}} chủ đề chưa đọc."},"title":"Chủ đề","invalid_access":{"title":"Chủ đề này là riêng tư","description":"Xin lỗi, bạn không có quyền truy cập vào chủ đề đó!","login_required":"Bạn cần phải đăng nhập để xem chủ đề đó"},"server_error":{"title":"Tải chủ đề thất bại","description":"Xin lỗi, chúng tôi không thể tải chủ đề, có thể do kết nối có vấn đề. Xin hãy thử lại. Nếu vấn đề còn xuất hiện, hãy cho chúng tôi biết"},"not_found":{"title":"Không tìm thấy chủ đề","description":"Xin lỗi, chúng tôi không thể tìm thấy chủ đề đó. Có lẽ nó đã bị loại bởi mod?"},"total_unread_posts":{"other":"Bạn có {{number}} bài đăng chưa đọc trong chủ đề này"},"unread_posts":{"other":"bạn có {{number}} bài đăng củ chưa đọc trong chủ đề này"},"new_posts":{"other":"có {{count}} bài đăng mới trong chủ đề này từ lần đọc cuối"},"likes":{"other":"có {{count}} thích trong chủ để này"},"back_to_list":"Quay lại danh sách chủ đề","options":"Các lựa chọn chủ đề","show_links":"Hiển thị liên kết trong chủ đề này","toggle_information":"chuyển đổi các chi tiết chủ để","read_more_in_category":"Muốn đọc nữa? Xem qua các chủ đề khác trong {{catLink}} hoặc {{latestLink}}","read_more":"Muốn đọc nữa? {{catLink}} hoặc {{latestLink}}","browse_all_categories":"Duyệt tất cả các hạng mục","view_latest_topics":"xem các chủ đề mới nhất","suggest_create_topic":"Tại sao không tạo một chủ đề mới?","jump_reply_up":"nhảy đến những trả lời trước đó","jump_reply_down":"nhảy tới những trả lời sau đó","deleted":"Chủ đề này đã bị xóa","auto_close_notice":"Chủ đề này sẽ tự động đóng %{timeLeft}.","auto_close_notice_based_on_last_post":"Chủ đề này sẽ đóng %{duration} sau trả lời cuối cùng.","auto_close_title":"Tự động-Đóng các Cài đặt","auto_close_save":"Lưu","auto_close_remove":"Đừng Tự Động-Đóng Chủ Đề Này","progress":{"title":"tiến trình của chủ đề","go_top":"trên cùng","go_bottom":"dưới cùng","go":"đi tới","jump_bottom":"nhảy tới bài viết cuối cùng","jump_bottom_with_number":"nhảy tới bài viết %{post_number}","total":"tổng số bài viết","current":"bài viết hiện tại"},"notifications":{"reasons":{"3_6":"Bạn sẽ nhận được các thông báo bởi vì bạn đang xem chuyên mục nàyotification","3_5":"Bạn sẽ nhận được các thông báo bởi vì bạn đã bắt đầu xem chủ đề này một cách tự động","3_2":"Bạn sẽ nhận được các thông báo bởi vì bạn đang xem chủ đề này","3_1":"Bạn sẽ được nhận thông báo bởi bạn đã tạo chủ để này.","3":"Bạn sẽ nhận được các thông báo bởi vì bạn đang xem chủ đề này","2_8":"Bạn sẽ nhận được thông báo bởi vì bạn đang theo dõi chuyên mục này.","2_4":"Bạn sẽ nhận được các thông báo bởi vì bạn đã đăng một trả lời vào chủ đề này","2_2":"Bạn sẽ nhận được các thông báo bởi vì bạn đang theo dõi chủ đề này.","2":"Bạn sẽ nhận được các thông báo bởi vì bạn \u003ca href=\"/users/{{username}}/preferences\"\u003e đọc chủ đề này \u003c/a\u003e","1_2":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn","1":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn","0_7":"Bạn đang bỏ qua tất cả các thông báo trong chuyên mục này","0_2":"Bạn đang bỏ qua tất cả các thông báo trong chủ đề này","0":"Bạn đang bỏ qua tất cả các thông báo trong chủ đề này"},"watching_pm":{"title":"Đang xem","description":"Bạn sẽ được thông báo về từng trả lời mới trong tin nhắn này, và một số trả lời mới sẽ được hiển thị"},"watching":{"title":"Dang theo dõi","description":"Bạn sẽ được thông báo về từng trả lời mới trong tin nhắn này, và một số trả lời mới sẽ được hiển thị"},"tracking_pm":{"title":"Đang theo dõi","description":"Một số trả lời mới sẽ được hiển thị trong tin nhắn này. Bạn sẽ được thông báo nếu ai đó đề cập đến @tên của bạn hoặc trả lời bạn"},"tracking":{"title":"Đang theo dõi","description":"Một số trả lời mới sẽ được hiển thị trong chủ đề này. Bạn sẽ được thông báo nếu ai đó đề cập đến @tên của bạn hoặc trả lời bạn"},"regular":{"title":"Bình thường","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn"},"regular_pm":{"title":"Bình thường","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn"},"muted_pm":{"title":"Im lặng","description":"Bạn sẽ không bao giờ được thông báo về bất cứ điều gì về tin nhắn này. "},"muted":{"title":"Im lặng","description":"Bạn sẽ không nhận được bất kỳ thông báo nào trong chủ đề này, và chúng sẽ không hiển thị là mới nhất."}},"actions":{"recover":"Không-Xóa Chủ Đề Này","delete":"Xóa-Chủ Đề Này","open":"Mở Chủ Đề","close":"Đóng Chủ Đề","multi_select":"Chọn Bài Viết...","auto_close":"Tự Động Đóng...","pin":"Ghim Chủ Đề...","unpin":"Bỏ-Ghim Chủ Đề...","unarchive":"Chủ đề Không Lưu Trữ","archive":"Chủ Đề Lưu Trữ","invisible":"Make Unlisted","visible":"Make Listed","reset_read":"Đặt lại dữ liệu đọc"},"feature":{"pin":"Ghim Chủ Đề","unpin":"Bỏ-Ghim Chủ Đề","pin_globally":"Ghim Chủ Đề Tổng Thể","make_banner":"Banner chủ đề","remove_banner":"Bỏ banner chủ đề"},"reply":{"title":"Trả lời","help":"bắt đầu soạn một trả lời mới cho chủ đề này"},"clear_pin":{"title":"Xóa ghim","help":"Xóa trạng thái ghim của chủ đề này để nó không còn xuất hiện trên cùng danh sách chủ đề của bạn"},"share":{"title":"Chia sẻ","help":"Chia sẻ một liên kết đến chủ đề này"},"flag_topic":{"title":"Gắn cờ","help":"đánh dấu riêng tư chủ đề này cho sự chú ý hoặc gửi một thông báo riêng về nó","success_message":"Bạn đã đánh dấu thành công chủ đề này"},"feature_topic":{"title":"Đề cao chủ đề này","pin":"Làm cho chủ đề này xuất hiện trên top của chuyên mục {{categoryLink}}","confirm_pin":"Bạn đã có {{count}} chủ đề được ghim. Qúa nhiều chủ đề được ghim có thể là một trở ngại cho những thành viên mới và thành viên ẩn danh. Bạn có chắc chắn muốn ghim chủ đề khác trong chuyên mục này?","unpin":"Xóa chủ đề này từ phần trên cùng của chủ đề {{categoryLink}}","unpin_until":"Gỡ bỏ chủ đề này khỏi top của chuyên mục {{categoryLink}} và đợi cho đến \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Người dùng có thể bỏ ghim chủ đề riêng cho mình","pin_validation":"Ngày được yêu câu để gắn chủ đề này","not_pinned":"Không có chủ đề được ghim trong {{categoryLink}}.","already_pinned":{"other":"Chủ đề gần đây được ghim trong {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Làm cho chủ đề này xuất hiện trên top của tất cả các chủ đề","confirm_pin_globally":"Bạn đã có {{count}} chủ đề được ghim. Ghim quá nhiều chủ đề có thể là trở ngại cho những thành viên mới và ẩn danh. Bạn có chắc chắn muốn ghim chủ đề khác?","unpin_globally":"Bỏ chủ đề này khỏi phần trên cùng của danh sách tất cả các chủ đề","unpin_globally_until":"Gỡ bỏ chủ đề này khỏi top của danh sách tất cả các chủ đề và đợi cho đến \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Người dùng có thể bỏ ghim chủ đề riêng cho mình","not_pinned_globally":"Không có chủ đề nào được ghim.","already_pinned_globally":{"other":"Chủ đề gần đây được ghim trong: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Đặt chủ đề này là một banner xuất hiện trên top của tất cả các trang.","remove_banner":"Gỡ bỏ banner xuất hiện trên top của tất cả các trang.","banner_note":"Người dùng có thể bỏ qua banner này bằng cách đóng nó. Chỉ một chủ đề có thể được đặt là banner tại một thời điểm.","no_banner_exists":"Không có chủ đề banner nào.","banner_exists":"Có \u003cstrong class='badge badge-notification unread'\u003eis\u003c/strong\u003e đang là chủ đề banner."},"inviting":"Đang mời...","invite_private":{"title":"Mời thảo luận","email_or_username":"Email hoặc username người được mời","email_or_username_placeholder":"địa chỉ thư điện tử hoặc tên người dùng","action":"Mời","success":"Chúng tôi đã mời người đó tham gia thảo luận này.","error":"Xin lỗi, có lỗi khi mời người dùng này.","group_name":"Nhóm tên"},"controls":"Topic Controls","invite_reply":{"title":"Mời","username_placeholder":"tên người dùng","action":"Gửi Lời Mời","help":"mời người khác tham gia chủ đề thông qua email hoặc thông báo","to_forum":"Chúng tôi sẽ gửi một email tóm tắt cho phép bạn của bạn gia nhập trực tiệp bằng cách nhấp chuột vào một đường dẫn, không cần phải đăng nhập.","sso_enabled":"Nhập tên đăng nhập hoặc địa chỉ email của người mà bạn muốn mời vào chủ đề này.","to_topic_blank":"Nhập tên đăng nhập hoặc địa chỉ email của người bạn muốn mời đến chủ đề này.","to_topic_email":"Bạn vừa điền địa chỉ email, website sẽ gửi lời mời cho phép bạn bè của bạn có thể trả lời chủ đề này.","to_topic_username":"Bạn vừa điền tên thành viên, website sẽ gửi thông báo kèm theo lời mời họ tham gia chủ đề này.","to_username":"Điền tên thành viên bạn muốn mời, website sẽ gửi thông báo kèm theo lời mời họ tham gia chủ đề này.","email_placeholder":"name@example.com","success_email":"Website vừa gửi lời mời tới \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e và sẽ thông báo cho bạn khi lời mời đó được chấp nhận. Kiểm tra tab lời mời trên trang tài khoản để theo dõi lời mời của bạn.","success_username":"Website đã mời người đó tham gia thảo luận này.","error":"Xin lỗi, chúng tôi không thể mời người đó. Có lẽ họ đã được mời? (giới hạn lời mời)"},"login_reply":"Đăng nhập để trả lời","filters":{"n_posts":{"other":"{{count}} bài viết"},"cancel":"Bỏ đièu kiện lọc"},"split_topic":{"title":"Di chuyển tới Chủ đề mới","action":"di chuyển tới chủ đề mới","topic_name":"Tên chủ đề mới","error":"Có lỗi khi di chuyển bài viết tới chủ đề mới.","instructions":{"other":"Bạn muốn tạo chủ đề mới và phổ biến nó với \u003cb\u003e{{count}}\u003c/b\u003e bài viết đã chọn."}},"merge_topic":{"title":"Di chuyển tới chủ đề đang tồn tại","action":"di chuyển tới chủ đề đang tồn tại","error":"Có lỗi khi di chuyển bài viết đến chủ đề này.","instructions":{"other":"Hãy chọn chủ đề bạn muốn di chuyển \u003cb\u003e{{count}}\u003c/b\u003e bài viết này tới."}},"change_owner":{"title":"Chuyển chủ sở hữu bài viết","action":"chuyển chủ sở hữu","error":"Có lỗi xảy ra khi thay đổi quyền sở hữu của các bài viết.","label":"Chủ sở hữ mới của Bài viết","placeholder":"tên đăng nhập của chủ sở hữu mới","instructions":{"other":"Hãy chọn chủ sở hữu mới cho {{count}} bài viết của \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Lưu ý rằng bất kỳ thông báo nào về bài viết này sẽ không được chuyển giao cho thành viên mới trở về trước.\u003cbr\u003eCảnh báo: Hiện không có dữ liệu bài viết phụ thuộc được chuyển giao cho thành viên mới. Hãy thận trọng!"},"change_timestamp":{"title":"Đổi Timestamp","action":"đổi timestamp","invalid_timestamp":"Timestamp không thể trong tương lai.","error":"Có lỗi khi thay đổi timestamp của chủ đề.","instructions":"Hãy chọn dòng thời gian mới cho chủ đề, các bài viết trong chủ đề sẽ được cập nhật để có sự khác biệt cùng một lúc."},"multi_select":{"select":"chọn","selected":"đã chọn ({{count}})","select_replies":"chọn + trả lời","delete":"xóa lựa chọn","cancel":"hủy lựa chọn","select_all":"chọn tất cả","deselect_all":"bỏ chọn tất cả","description":{"other":"Bạn đã chọn \u003cb\u003e{{count}}\u003c/b\u003e bài viết."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"trả lời trích dẫn","edit":"Đang sửa {{link}} {{replyAvatar}} {{username}}","edit_reason":"Lý do: ","post_number":"bài viết {{number}}","last_edited_on":"đã sửa bài viết lần cuối lúc","reply_as_new_topic":"Trả lời như là liên kết đến Chủ đề","continue_discussion":"Tiếp tục thảo luận từ {{postLink}}:","follow_quote":"đến bài viết trích dẫn","show_full":"Hiển thị đầy đủ bài viết","show_hidden":"Xem nội dung ẩn","deleted_by_author":{"other":"(bài viết theo tác giả sẽ được xóa tự động sau %{count} giờ, trừ khi đã đánh dấu)"},"expand_collapse":"mở/đóng","gap":{"other":"xem {{count}} trả lời bị ẩn"},"unread":"Bài viết chưa đọc","has_replies":{"other":"{{count}} Trả lời"},"has_likes":{"other":"{{count}} Thích"},"has_likes_title":{"other":"{{count}} người thích bài viết này"},"has_likes_title_only_you":"bạn đã like bài viết này","has_likes_title_you":{"other":"bạn và {{count}} người khác đã like bài viết này"},"errors":{"create":"Xin lỗi, có lỗi xảy ra khi tạo bài viết của bạn. Vui lòng thử lại.","edit":"Xin lỗi, có lỗi xảy ra khi sửa bài viết của bạn. Vui lòng thử lại.","upload":"Xin lỗi, có lỗi xảy ra khi tải lên tập tin này. Vui lòng thử lại.","too_many_uploads":"Xin lỗi, bạn chỉ có thể tải lên 1 file cùng 1 lúc.","upload_not_authorized":"Xin lỗi, tập tin của bạn tải lên chưa được cho phép (định dạng cho phép: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Xin lỗi, tài khoản mới không thể tải lên ảnh.","attachment_upload_not_allowed_for_new_user":"Xin lỗi, tài khoản mới không thể tải lên đính kèm.","attachment_download_requires_login":"Xin lỗi, bạn cần đăng nhập để tải về đính kèm."},"abandon":{"confirm":"Bạn có chắc muốn bỏ bài viết của bạn?","no_value":"Không, giữ lại","yes_value":"Đồng ý, bỏ"},"via_email":"bài viết này đăng qua email","whisper":"bài viết này là lời nhắn từ điều hành viên","wiki":{"about":"bài viết này là wiki"},"archetypes":{"save":"Lưu lựa chọn"},"few_likes_left":"Cám ơn bạn đã chia sẻ cảm nhận! Bạn chỉ còn lại vài lượt like cho ngày hôm nay.","controls":{"reply":"bắt đầu soản trả lời cho bài viết này","like":"like bài viết này","has_liked":"bạn đã like bài viết này","undo_like":"hủy like","edit":"sửa bài viết này","edit_anonymous":"Xin lỗi, nhưng bạn cần đăng nhập để sửa bài viết này.","flag":"đánh dấu bài viết này để tạo chú ý hoặc gửi một thông báo riêng về nó","delete":"xóa bài viết này","undelete":"hủy xóa bài viết này","share":"chia sẻ liên kết đến bài viết này","more":"Thêm","delete_replies":{"confirm":{"other":"Bạn muốn xóa {{count}} trả lời cho bài viết này?"},"yes_value":"Đồng ý, xóa những trả lời","no_value":"Không, chỉ xóa chủ đề"},"admin":"quản lý bài viết","wiki":"Tạo Wiki","unwiki":"Xóa Wiki","convert_to_moderator":"Thêm màu Nhân viên","revert_to_regular":"Xóa màu Nhân viên","rebake":"Tạo lại HTML","unhide":"Bỏ ẩn","change_owner":"Đổi chủ sở hữu"},"actions":{"flag":"Gắn cờ","defer_flags":{"other":"Đánh dấu hoãn"},"undo":{"off_topic":"Hủy gắn cờ","spam":"Hủy gắn cờ","inappropriate":"Hủy gắn cờ","bookmark":"Hủy đánh dấu","like":"Hủy like","vote":"Hủy bình chọn"},"people":{"off_topic":"đánh dấu là chủ đề đóng","spam":"đánh dấu là spam","inappropriate":"đánh dấu là không phù hợp","notify_moderators":"đã thông báo với BQT","notify_user":"đã gửi tin nhắn","bookmark":"đã đánh dấu bài này","like":"đã like bài này","vote":"đã bầu cho bài này"},"by_you":{"off_topic":"Bạn đã đánh dấu cái nfay là chủ đề đóng","spam":"Bạn đã đánh dấu cái này là rác","inappropriate":"Bạn đã đánh dấu cái này là không phù hợp","notify_moderators":"Bạn đã đánh dấu cái này cho điều tiết","notify_user":"Bạn đã gửi một tin nhắn đến người dùng này","bookmark":"Bạn đã đánh dấu bài viết này","like":"Bạn đã thích cái này","vote":"Bạn đã bình chọn cho bài viết này"},"by_you_and_others":{"off_topic":{"other":"Bạn và  {{count}}  người khác đã đánh dấu đây là chủ đề đóng"},"spam":{"other":"Bạn và {{count}} người khác gắn cờ nó là rác"},"inappropriate":{"other":"Bạn và {{count}} other người khác đã đánh dấu nó là không phù hợp"},"notify_moderators":{"other":"Bạn và {{count}} người khác gắn cờ nó là điều tiết"},"notify_user":{"other":"Bạn và {{count}} người khác đã gửi một tin nhắn đến người dùng này"},"bookmark":{"other":"Bạn và {{count}} người khác đã đánh dấu bài viết này"},"like":{"other":"Bạn và {{count}} người khác đã thích cái này"},"vote":{"other":"Bạn và {{count}} nười khác đã bình chọn cho bài viết này"}},"by_others":{"off_topic":{"other":"{{count}} người đã đánh dấu nó là chủ đề đóng"},"spam":{"other":"{{count}} người khác đánh dấu là rác"},"inappropriate":{"other":"{{count}} người khác đã đánh dấu là không phù hợp"},"notify_moderators":{"other":"{{count}} người đã đánh dấu để chờ duyệt"},"notify_user":{"other":"{{count}} gửi tin nhắn đến người dùng này"},"bookmark":{"other":"{{count}} người đã đánh dấu bài viết này"},"like":{"other":"{count}} người đã thích cái này"},"vote":{"other":"{{count}} người đã bình chọn cho bài viết này"}}},"delete":{"confirm":{"other":"Bạn muốn xóa những bài viết này?"}},"revisions":{"controls":{"first":"Sửa đổi đầu tiên","previous":"Sửa đổi trước","next":"Sửa đổi tiếp theo","last":"Sửa đổi gần nhất","hide":"Ẩn sửa đổi","show":"Hiện sửa đổi","revert":"Hoàn nguyên sửa đổi","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Hiển thị dạng xuất kèm theo các bổ sung và loại bỏ nội tuyến","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Hiển thị dạng xuất với các điểm khác biệt cạnh nhau","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Hiển thị nguyên bản với các điểm khác biệt cạnh nhau","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Thô"}}}},"category":{"can":"can\u0026hellip;","none":"(không danh mục)","all":"Tất cả danh mục","choose":"Chọn chuyên mục\u0026hellip;","edit":"sửa","edit_long":"Sửa","view":"Xem Chủ đề trong Danh mục","general":"Chung","settings":"Cấu hình","topic_template":"Mẫu Chủ đề","delete":"Xóa chuyên mục","create":"Chuyên mục mới","create_long":"Tạo Chủ đề mới","save":"Lưu chuyên mục","slug":"Đường dẫn chuyên mục","slug_placeholder":"(Tùy chọn) các từ sử dụng trong url","creation_error":"Có lỗi xảy ra khi tạo chuyên mục","save_error":"Có lỗi xảy ra khi lưu chuyên mục","name":"Tên chuyên mục","description":"Mô tả","topic":"chủ đề chuyên mục","logo":"Logo của chuyên mục","background_image":"Ảnh nền của chuyên mục","badge_colors":"Màu huy hiệu","background_color":"Màu nền","foreground_color":"Màu mặt trước","name_placeholder":"Tối đa một hoặc hai từ","color_placeholder":"Bất cứ màu nào","delete_confirm":"Bạn có chắc sẽ xóa chuyên mục này chứ?","delete_error":"Có lỗi xảy ra khi xóa chuyên mục này","list":"Danh sách chuyên mục","no_description":"Hãy thêm mô tả cho chuyên mục này","change_in_category_topic":"Sửa mô tả","already_used":"Màu này đã được dùng bởi chuyên mục khác","security":"Bảo mật","special_warning":"Cảnh báo: Đây là chuyên mục có sẵn nên bạn không thể chỉnh sửa các thiết lập bảo mật. Nếu bạn muốn sử dụng chuyên mục này, hãy xóa nó thay vì tái sử dụng.","images":"Hình ảnh","auto_close_label":"Tự động khóa chủ đề sau:","auto_close_units":"giờ","email_in":"Tùy chỉnh địa chỉ nhận thư điện tử ","email_in_allow_strangers":"Nhận thư điện tử từ người gửi vô danh không tài khoản","email_in_disabled":"Tạo chủ đề mới thông qua email đã được tắt trong thiết lập. Để bật tính năng này, ","email_in_disabled_click":"kích hoạt thiết lập thư điện tử","suppress_from_homepage":"Ngăn chặn chuyên mục này hiển thị trên trang chủ.","allow_badges_label":"Cho phép thưởng huy hiệu trong chuyên mục này","edit_permissions":"Sửa quyền","add_permission":"Thêm quyền","this_year":"năm nay","position":"vị trí","default_position":"vị trí mặc định","position_disabled":"Chuyên mục sẽ được hiển thị theo thứ tự hoạt động. Để kiểm soát thứ tự chuyên mục trong danh sách, ","position_disabled_click":"bật thiết lập \"cố định vị trí chuyên mục\".","parent":"Danh mục cha","notifications":{"watching":{"title":"Theo dõi"},"tracking":{"title":"Đang theo dõi"},"regular":{"title":"Bình thường","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn"},"muted":{"title":"Im lặng","description":"Bạn sẽ không nhận được thông báo về bất cứ chủ đề mới nào trong các chuyên mục này, và chúng sẽ không hiển thị là mới nhất."}}},"flagging":{"title":"Cám ơn bạn đã giúp phát triển cộng đồng!","action":"Đánh dấu Bài viết","take_action":"Thực hiện","notify_action":"Tin nhắn","delete_spammer":"Xóa người Spam","yes_delete_spammer":"Có, xóa người spam","ip_address_missing":"(N/A)","hidden_email_address":"(ẩn)","submit_tooltip":"Đánh dấu riêng tư","take_action_tooltip":"Tiếp cận ngưỡng đánh dấu ngay lập tức, thay vì đợi cộng đồng","cant":"Xin lỗi, bạn không thể đánh dấu bài viết lúc này.","notify_staff":"Thông báo riêng cho BQT","formatted_name":{"off_topic":"Nó là sai chủ đề","inappropriate":"Không phù hợp","spam":"Nó là rác"},"custom_placeholder_notify_user":"Phải hảo tâm và mang tính xây dựng.","custom_placeholder_notify_moderators":"Hãy cho chúng tôi biết cụ thể những gì bạn quan tâm, và cung cấp các liên kết hoặc ví dụ liên quan nếu có thể."},"flagging_topic":{"title":"Cám ơn bạn đã giúp phát triển cộng đồng!","action":"Gắn cờ Chủ đề","notify_action":"Tin nhắn"},"topic_map":{"title":"Tóm tắt Chủ đề","participants_title":"Poster thường xuyên","links_title":"Liên kết phổ biến","clicks":{"other":"%{count} nhấp chuột"}},"topic_statuses":{"warning":{"help":"Đây là một cảnh báo chính thức."},"bookmarked":{"help":"Bạn đã đánh dấu chủ đề này"},"locked":{"help":"Chủ đề đã đóng; không cho phép trả lời mới"},"archived":{"help":"Chủ đề này đã được lưu trữ, bạn không thể sửa đổi nữa"},"locked_and_archived":{"help":"Chủ đề này đã đóng và lưu trữ, không cho phép trả lời mới và sửa đổi nữa"},"unpinned":{"title":"Hủy gắn","help":"Chủ đề này không còn được ghim nữa, nó sẽ hiển thị theo thứ tự thông thường"},"pinned_globally":{"title":"Ghim toàn trang","help":"Chủ đề này được ghim toàn trang, nó sẽ hiển thị ở trên cùng các chủ đề mới và trong chuyên mục"},"pinned":{"title":"Gắn","help":"Chủ đề này đã được ghim, nó sẽ hiển thị ở trên cùng chuyên mục"},"invisible":{"help":"Chủ đề này ẩn, nó sẽ không hiển thị trong danh sách chủ đề, và chỉ có thể truy cập thông qua liên kết trực tiếp"}},"posts":"Bài viết","posts_long":"Có {{number}} bài đăng trong chủ đề này","original_post":"Bài viết gốc","views":"Lượt xem","views_lowercase":{"other":"lượt xem"},"replies":"Trả lời","views_long":"chủ đề đã được xem {{number}} lần","activity":"Hoạt động","likes":"Lượt thích","likes_lowercase":{"other":"lượt thích"},"likes_long":"Có {{number}} thích trong chủ đề này","users":"Người dùng","users_lowercase":{"other":"người dùng"},"category_title":"Danh mục","history":"Lịch sử","changed_by":"bởi {{author}}","raw_email":{"title":"Email gốc","not_available":"Không sẵn sàng!"},"categories_list":"Danh sách Danh mục","filters":{"with_topics":"%{filter} chủ đề","with_category":"%{filter} %{category} chủ đề","latest":{"title":"Mới nhất","title_with_count":{"other":"Mới nhất ({{count}})"},"help":"chủ đề với bài viết gần nhất"},"hot":{"title":"Nổi bật","help":"chọn các chủ đề nóng nhất"},"read":{"title":"Đọc","help":"chủ đề bạn đã đọc, theo thứ tự bạn đọc lần cuối cùng"},"search":{"title":"Tìm kiếm","help":"tìm trong tất cả chủ đề"},"categories":{"title":"Danh mục","title_in":"Danh mục - {{categoryName}}","help":"tất cả các chủ đề được nhóm theo chuyên mục"},"unread":{"title":"Chưa đọc","title_with_count":{"other":"Chưa đọc ({{count}})"},"help":"chủ đề bạn đang xem hoặc theo dõi có bài viết chưa đọc","lower_title_with_count":{"other":"{{count}} chưa đọc"}},"new":{"lower_title_with_count":{"other":"{{count}} mới"},"lower_title":"mới","title":"Mới","title_with_count":{"other":"Mới ({{count}})"},"help":"chủ đề đã tạo cách đây vài ngày"},"posted":{"title":"Bài viết của tôi","help":"chủ đề của bạn đã được đăng trong"},"bookmarks":{"title":"Đánh dấu","help":"chủ để của bạn đã được đánh dấu"},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}} ({{count}})"},"help":"Những chủ đề mới nhất trong chuyên mục{{categoryName}} "},"top":{"title":"Trên","help":"Các chủ đề tích cực nhất trong năm, tháng, tuần, hoặc ngày trước","all":{"title":"Từ trước tới nay"},"yearly":{"title":"Hàng năm"},"quarterly":{"title":"Hàng quý"},"monthly":{"title":"Hàng tháng"},"weekly":{"title":"Hàng tuần"},"daily":{"title":"Hàng ngày"},"all_time":"Từ trước tới nay","this_year":"Năm","this_quarter":"Quý","this_month":"Tháng","this_week":"Tuần","today":"Ngày","other_periods":"xem top"}},"browser_update":"Không may, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003etrình duyệt của bạn quá cũ để website hoạt động\u003c/a\u003e. Hãy \u003ca href=\"http://browsehappy.com\"\u003enâng cấp trình duyệt\u003c/a\u003e của bạn.","permission_types":{"full":"Tạo / Trả lời / Xem","create_post":"Trả lời / Xem","readonly":"Xem"},"poll":{"voters":{"other":"người bình chọn"},"total_votes":{"other":"tổng số bình chọn"},"average_rating":"Đánh giá trung bình: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Bình chọn công khai."},"multiple":{"help":{"at_least_min_options":{"other":"Chọn ít nhất \u003cstrong\u003e%{count}\u003c/strong\u003e tùy chọn"},"up_to_max_options":{"other":"Chọn tối đa \u003cstrong\u003e%{count}\u003c/strong\u003e tùy chọn"},"x_options":{"other":"Chọn \u003cstrong\u003e%{count}\u003c/strong\u003e tùy chọn"}}},"cast-votes":{"title":"Bỏ phiếu của bạn","label":"Bình chọn ngay!"},"show-results":{"title":"Hiển thị kết quả cuộc thăm dò","label":"Hiện kết quả"},"hide-results":{"title":"Trở lại bình chọn của bạn","label":"Ẩn kết quả"},"open":{"title":"Mở bình chọn","label":"Mở","confirm":"Bạn có chắc bạn muốn mở bình chọn này?"},"close":{"title":"Đóng bình chọn","label":"Đóng lại","confirm":"Bạn có chắc chắn muốn đóng bình chọn này?"},"ui_builder":{"help":{"options_count":"Nhập vào ít nhất 2 tùy chọn"},"poll_type":{"label":"Loại"},"poll_config":{"max":"Tối đa","min":"Tối thiểu","step":"Bước"},"poll_public":{"label":"Hiển thị ai đã bình chọn"}}},"type_to_filter":"gõ để lọc...","admin":{"title":"Quản trị Diễn đàn","moderator":"Điều hành","dashboard":{"title":"Bảng điều khiển","last_updated":"Bảng điều khiển cập nhật gần nhất:","version":"Phiên bản","up_to_date":"Bạn đã cập nhật phiên bản mới nhất","critical_available":"Bản cập nhật quan trọng sẵn sằng.","updates_available":"Cập nhật đang sẵng sàng","please_upgrade":"Vui lòng cập nhật!","no_check_performed":"Kiểm tra phiên bản mới đã không được thực hiện, đảm bảo rằng Sidekiq đang chạy.","stale_data":"Kiểm tra phiên bản mới đã không được thực hiện gần đây, đảm bảo rằng Sidekiq đang chạy.","version_check_pending":"Hình như bạn mới nâng cấp, thật tuyệt!","installed_version":"Đã cài đặt","latest_version":"Mới nhất","problems_found":"Tìm thấy vấn đề với bản cài đặt Discourse của bạn:","last_checked":"Kiểm tra lần cuối","refresh_problems":"Làm mới","no_problems":"Không phát hiện vấn đề","moderators":"Điều hành:","admins":"Quản trị:","blocked":"Đã khóa:","suspended":"Đã tạm khóa:","private_messages_short":"Tin nhắn","private_messages_title":"Tin nhắn","mobile_title":"Điện thoại","space_free":"{{size}} trống","uploads":"tải lên","backups":"sao lưu","traffic_short":"Băng thông","traffic":"Application web requests","page_views":"API Requests","page_views_short":"API Requests","show_traffic_report":"Xem chi tiết Báo cáo Lưu lượng","reports":{"today":"Hôm nay","yesterday":"Hôm qua","last_7_days":"7 Ngày gần nhất","last_30_days":"30 Ngày gần nhất","all_time":"Từ trước tới nay","7_days_ago":"7 Ngày trước","30_days_ago":"30 Ngày trước","all":"Tất cả","view_table":"bảng","refresh_report":"Làm mới báo cáo","start_date":"Từ ngày","end_date":"Đến ngày","groups":"Các nhóm"}},"commits":{"latest_changes":"Thay đổi cuối: vui lòng cập nhật thường xuyên!","by":"bởi"},"flags":{"title":"Gắn cờ","old":"Cũ","active":"Kích hoạt","agree":"Đồng ý","agree_title":"Xác nhận đánh dấu này hợp lệ và chính xác","agree_flag_modal_title":"Đồng ý và...","agree_flag_hide_post":"Đồng ý (ẩn bài viết + gửi PM)","agree_flag_hide_post_title":"Ẩn bài viết này và tự động gửi tin nhắn đến người dùng hối thúc họ sửa nó","agree_flag_restore_post":"Đồng ý (khôi phục bài viết)","agree_flag_restore_post_title":"Khôi phục bài viết này","agree_flag":"Đống ý với cờ này","agree_flag_title":"Đồng ý với cờ này và giữ bài viết không thay đổi","defer_flag":"Hoãn","defer_flag_title":"Xóa cờ này; nó yêu cầu không có hành động nào vào thời điểm này.","delete":"Xóa","delete_title":"Xóa bài viết đánh dấu này đề cập đến.","delete_post_defer_flag":"Xóa bài viết và Hoãn đánh dấu","delete_post_defer_flag_title":"Xóa bài viết; nếu là bài viết đầu tiên, xóa chủ đề này","delete_post_agree_flag":"Xóa bài viết và Đồng ý với cờ","delete_post_agree_flag_title":"Xóa bài viết; nếu là bài viết đầu tiên, xóa chủ đề này","delete_flag_modal_title":"Xóa và...","delete_spammer":"Xóa người Spam","delete_spammer_title":"Xóa người dùng này và tất cả bài viết à chủ để của người dùng này.","disagree_flag_unhide_post":"Không đồng ý (ẩn bài viết)","disagree_flag_unhide_post_title":"Loại bỏ bất kỳ đánh dấu nào khỏi bài viết này và làm cho bài viết hiển thị trở lại","disagree_flag":"Không đồng ý","disagree_flag_title":"Từ chối đánh dấu này là không hợp lệ hoặc chính xác","clear_topic_flags":"Hoàn tất","clear_topic_flags_title":"Chủ đề đã được xem xét vấn đề và giải quyết, click để loại bỏ đánh dấu.","more":"(thêm trả lời...)","dispositions":{"agreed":"đồng ý","disagreed":"không đồng ý","deferred":"hoãn"},"flagged_by":"Gắn cờ bởi","resolved_by":"Xử lý bởi","took_action":"Thực hiện","system":"Hệ thống","error":"Có lỗi xảy ra","reply_message":"Trả lời ","no_results":"Không được gắn cờ","topic_flagged":"\u003cstrong\u003eChủ đề này\u003c/strong\u003e đã được đánh dấu.","visit_topic":"Tới chủ đề để thực hiện","was_edited":"Bài viết đã được chỉnh sửa sau khi đánh dấu đầu tiên","previous_flags_count":"Bài viết này đã được đánh dấu {{count}} lần.","summary":{"action_type_3":{"other":"sai chủ đề x{{count}}"},"action_type_4":{"other":"Không phù hợp x{{count}}"},"action_type_6":{"other":"tùy chỉnh x{{count}}"},"action_type_7":{"other":"tùy chỉnh x{{count}}"},"action_type_8":{"other":"spam x{{count}}"}}},"groups":{"primary":"Nhóm Chính","no_primary":"(không có nhóm chính)","title":"Nhóm","edit":"Sửa nhóm","refresh":"Làm mới","new":"Mới","selector_placeholder":"nhập tên tài khoản","name_placeholder":"Tên nhóm, không khoản trắng, cùng luật với tên tài khoản","about":"Chỉnh sửa nhóm thành viên và tên của bạn ở đây","group_members":"Nhóm thành viên","delete":"Xóa","delete_confirm":"Xóa nhóm này?","delete_failed":"Không thể xóa nhóm. Nếu đây là một nhóm tự động, nó không thể hủy bỏ.","delete_member_confirm":"Loại bỏ '%{username}' khỏi nhóm '%{group}'?","delete_owner_confirm":"Loại bỏ quyền sở hữu của '%{username}'?","name":"Tên","add":"Thêm","add_members":"Thêm thành viên","custom":"Tùy biến","bulk_complete":"Các thành viên đã được thêm vào nhóm.","bulk":"Thêm vào nhóm theo lô","bulk_paste":"Dán danh sách username hoặc email, mỗi mục một dòng:","bulk_select":"(chọn nhóm)","automatic":"Tự động","automatic_membership_email_domains":"Các thành viên đã đăng ký với đuôi email khớp với một trong danh sách này sẽ được tự động thêm vào nhóm:","automatic_membership_retroactive":"Áp dụng quy tắc đuôi email tương tự để thêm thành viên đăng ký hiện tại","default_title":"Tên mặc định cho tất cả các thành viên trong nhóm này","primary_group":"Tự động cài là nhóm chính","group_owners":"Chủ sở hữu","add_owners":"Thêm chủ sở hữu","incoming_email":"Tùy chỉnh địa chỉ email đến","incoming_email_placeholder":"điền địa chỉ email"},"api":{"generate_master":"Tạo Master API Key","none":"Không có API keys nào kích hoạt lúc này.","user":"Thành viên","title":"API","key":"API Key","generate":"Khởi tạo","regenerate":"Khởi tạo lại","revoke":"Thu hồi","confirm_regen":"Bạn muốn thay API Key hiện tại bằng cái mới?","confirm_revoke":"Bạn có chắc chắn muốn hủy bỏ khóa đó?","info_html":"Khóa API cho phép bạn tạo và cập nhật chủ đề sử dụng JSON.","all_users":"Tất cả Thành viên","note_html":"Giữ khóa nào \u003cstrong\u003ebảo mật\u003c/strong\u003e, tất cả tài khoản có thể dùng khóa này để tạo bài viết với bất kỳ tài khoản nào."},"plugins":{"title":"Plugin","installed":"Đã cài Plugin","name":"Tên","none_installed":"Bạn chưa cài plugin nào.","version":"Phiên bản","enabled":"Kích hoạt","is_enabled":"Có","not_enabled":"Không","change_settings":"Đổi Cấu hình","change_settings_short":"Cấu hình","howto":"Plugin cài như thế nào?"},"backups":{"title":"Bản sao lưu","menu":{"backups":"Bản sao lưu","logs":"Log"},"none":"Chưa có bản sao lưu.","read_only":{"enable":{"title":"Bật chế độ chỉ đọc","label":"Bật chỉ đọc","confirm":"Bạn có chắc chắn muốn bật chế độ chỉ đọc?"},"disable":{"title":"Tắt chế độ chỉ đọc","label":"Tắt chỉ đọc"}},"logs":{"none":"Chưa có log..."},"columns":{"filename":"Tên tập tin","size":"Kích thước"},"upload":{"label":"Tải lên","title":"Tải lên bản sao lưu cho phiên bản này","uploading":"Đang tải lên...","success":"'{{filename}}' đã tải lên thành công.","error":"Có lõi trong quá trình tải lên '{{filename}}': {{message}}"},"operations":{"is_running":"Tác vụ đang chạy...","failed":"{{operation}} Thấy bại. Vui lòng xem log.","cancel":{"label":"Hủy","title":"Hủy tác vụ hiện tại","confirm":"Bạn muốn hủy tác vụ hiện tại?"},"backup":{"label":"Sao lưu","title":"Tạo bản sao lưu","confirm":"Bạn muốn bắt đầu một bản sao lưu mới?","without_uploads":"Đúng (không bao gồm những tập tin)"},"download":{"label":"Tải xuống","title":"Tải xuống bản sao lưu này"},"destroy":{"title":"Xóa bản sao lưu này","confirm":"Bạn muốn hủy bản sao lưu này?"},"restore":{"is_disabled":"Khôi phục đã bị cấm sử dụng trong cấu hình trang.","label":"Khôi phục","title":"Khôi phục lại sao lưu này","confirm":"Bạn có chắc chắn muón phục hồi bản sao lưu này?"},"rollback":{"label":"Rollback","title":"Đưa csdl về trạng thái làm việc trước","confirm":"Bạn có chắc chắn muốn phục hồi csdl về trạng thái làm việc trước?"}}},"export_csv":{"user_archive_confirm":"Bạn có chắc chắn muốn download các bài viết của mình?","success":"Export đang được khởi tạo, bạn sẽ nhận được tin nhắn thông báo khi quá trình hoàn tất.","failed":"Xuất lỗi. Vui lòng kiểm tra log.","rate_limit_error":"Bài viết có thể tải về 1 lần mỗi này, vui lòng thử lại vào ngày mai.","button_text":"Xuất","button_title":{"user":"Xuất danh sách người dùng đầy đủ với định dạng CSV.","staff_action":"Xuất đầy đủ log hành động của nhân viên với định dạng CSV.","screened_email":"Export danh sách email theo định dạng CSV.","screened_ip":"Export danh sách IP theo định dạng CSV.","screened_url":"Export danh sách URL theo định dạng CSV."}},"export_json":{"button_text":"Xuất"},"invite":{"button_text":"Gửi Lời Mời","button_title":"Gửi Lời Mời"},"customize":{"title":"Tùy biến","long_title":"Tùy biến trang","css":"CSS","header":"Header","top":"Trên","footer":"Footer","embedded_css":"Nhúng CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML sẻ thêm trước thẻ \u003c/head\u003e"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML sẽ thêm trước thẻ \u003c/body\u003e"},"override_default":"Không bao gồm style sheet chuẩn","enabled":"Cho phép?","preview":"xem trước","undo_preview":"xóa xem trước","rescue_preview":"default style","explain_preview":"Xem website với stylesheet tùy chỉnh","explain_undo_preview":"Quay trở lại với kiểu tùy chỉnh stylesheet hiện tại","explain_rescue_preview":"Xem website với stylesheet mặc định","save":"Lưu","new":"Mới","new_style":"Style mới","import":"Nhập","import_title":"Chọn một file hoặc paste chữ.","delete":"Xóa","delete_confirm":"Xóa tùy biến này?","about":"Chỉnh sửa CSS  và HTML header trên trang. Thêm tùy biến để bắt đầu.","color":"Màu sắc","opacity":"Độ mờ","copy":"Sao chép","email_templates":{"title":"Email Templates","subject":"Chủ đề","multiple_subjects":"Email template này có nhiều chủ đề.","body":"Nội dung","none_selected":"Chọn email template để bắt đầu chỉnh sửa.","revert":"Hoàn nguyên thay đổi","revert_confirm":"Bạn có chắc chắn muốn hoàn nguyên các thay đổi?"},"css_html":{"title":"CSS/HTML","long_title":"Tùy biến CSS và HTML"},"colors":{"title":"Màu sắc","long_title":"Bảng màu","about":"Chỉnh ","new_name":"Bản màu mới","copy_name_prefix":"Bản sao của","delete_confirm":"Xóa bảng màu này?","undo":"hoàn tác","undo_title":"Hoàn tác thay đổi của bạn vơ","revert":"phục hồi","revert_title":"Thiết lập lại màu về mặc định của Discourse.","primary":{"name":"chính","description":"Hầu hết chữ, biểu tượng, và viền."},"secondary":{"name":"cấp hai","description":"Màu nền, và màu chữ của một vài nút."},"tertiary":{"name":"cấp ba","description":"Liên kết, một và nút, thông báo, và màu nhấn."},"quaternary":{"name":"chia bốn","description":"Liên kết điều hướng."},"header_background":{"name":"nền header","description":"Màu nền header của trang."},"header_primary":{"name":"header chính","description":"Chữ và icon trong header của website."},"highlight":{"name":"highlight","description":"Màu nền của các thành phần được đánh dấu trên trang, như là bài viết và chủ đề."},"danger":{"name":"nguy hiểm","description":"Màu đánh dấu cho thao tác xóa bài viết và chủ đề."},"success":{"name":"thành công","description":"Sử dụng để chỉ một thao tác đã thành công."},"love":{"name":"đáng yêu","description":"Màu của nút like"}}},"email":{"title":"Emails","settings":"Cấu hình","templates":"Templates","preview_digest":"Xem trước tập san","sending_test":"Đang gửi Email test...","error":"\u003cb\u003eLỖI\u003c/b\u003e - %{server_error}","test_error":"Có vấn đề khi gửi email test. Vui lòng kiểm tra lại cấu hình email của bạn, chắc chắn host mail của bạn không bị khóa kết nối, và thử lại.","sent":"Đã gửi","skipped":"Đã bỏ qua","received":"Đã nhận","rejected":"Từ chối","sent_at":"Đã gửi vào lúc","time":"Thời gian","user":"Thành viên","email_type":"Loại Email","to_address":"Đến Địa chỉ","test_email_address":"địa chỉ email để test","send_test":"Gửi Email test","sent_test":"đã gửi!","delivery_method":"Phương thức chuyển giao","preview_digest_desc":"Xem trước nội dung của tập san email đã gửi cho các thành viên không hoạt động.","refresh":"Tải lại","format":"Định dạng","html":"html","text":"text","last_seen_user":"Người dùng cuối:","reply_key":"Key phản hồi","skipped_reason":"Bỏ qua Lý do","incoming_emails":{"from_address":"Từ","to_addresses":"Tới","cc_addresses":"Cc","subject":"Chủ đề","error":"Lỗi","none":"Không tìm tháy các email đến.","modal":{"title":"Chi Tiết Email Đến","error":"Lỗi","headers":"Tên","subject":"Tiêu đề","body":"Nội dung","rejection_message":"Từ Chối Thư"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Chủ đề...","error_placeholder":"Lỗi"}},"logs":{"none":"Không tìm thấy log.","filters":{"title":"Lọc","user_placeholder":"tên người dùng","address_placeholder":"name@example.com","type_placeholder":"tập san, đăng ký...","reply_key_placeholder":"key phản hồi","skipped_reason_placeholder":"lý do"}}},"logs":{"title":"Log","action":"Hành động","created_at":"Đã tạo","last_match_at":"Khớp lần cuối","match_count":"Khớp","ip_address":"IP","topic_id":"ID Chủ đề","post_id":"ID Bài viết","category_id":"ID Danh mục","delete":"Xoá","edit":"Sửa","save":"Lưu","screened_actions":{"block":"khóa","do_nothing":"không làm gì"},"staff_actions":{"title":"Staff Actions","instructions":"Click username và thực hiện lọc danh sách, click ảnh hồ sơ để đến trang thành viên.","clear_filters":"Hiện thị mọi thứ","staff_user":"Tài khoản Nhân viên","target_user":"Target User","subject":"Chủ đề","when":"Khi","context":"Ngữ cảnh","details":"Chi tiết","previous_value":"Trước","new_value":"Mới","diff":"So sánh","show":"Hiển thị","modal_title":"Chi tiết","no_previous":"Không có giá trị trước đó.","deleted":"Không có giá trị mới, bản ghi đã được xóa.","actions":{"delete_user":"xóa người dùng","change_trust_level":"thay đổi cấp tin cậy","change_username":"thay đổi username","change_site_setting":"thay đổi cấu hình trang","change_site_customization":"thay đổi tùy biến trang","delete_site_customization":"xóa tùy biến trang","change_site_text":"thay đổi chữ trên website","suspend_user":"tạm khóa thành viên","unsuspend_user":"hủy tạm khóa thành viên","grant_badge":"cấp huy hiệu","revoke_badge":"hủy bỏ huy hiệu","check_email":"kiểm tra email","delete_topic":"xóa chủ đề","delete_post":"xóa bài viết","impersonate":"mạo danh","anonymize_user":"thành viên ẩn danh","roll_up":"cuộn lên khối IP","change_category_settings":"thay đổi cấu hình danh mục","delete_category":"xóa danh mục","create_category":"tạo danh mục","block_user":"khóa tài khoản","unblock_user":"mở khóa tài khoản","grant_admin":"cấp quản trị","revoke_admin":"hủy bỏ quản trị","grant_moderation":"cấp điều hành","revoke_moderation":"hủy bỏ điều hành","backup_operation":"hoạt động sao lưu"}},"screened_emails":{"title":"Screened Emails","description":"Khi ai đó cố gắng tạo tài khoản mới, các địa chỉ email sau sẽ được kiểm tra và đăng ký sẽ bị chặn, hoặc một số hành động khác được thực hiện.","email":"Địa chỉ Email","actions":{"allow":"Cho phép"}},"screened_urls":{"title":"Screened URLs","description":"Các URL được liệt kê ở đây được sử dụng trong các bài viết của người dùng đã được xác định là spammer.","url":"URL","domain":"Tên miền"},"screened_ips":{"title":"Screened IPs","description":"Các địa chỉ IP đã được xem, sử dụng \"Cho phép\" để tạo danh sách trắng các địa chỉ.","delete_confirm":"Bạn có chắc chắn muốn xóa quy tắc cho %{ip_address}?","roll_up_confirm":"Bạn có chắc chắn muốn cuộn các địa chỉ IP thông thường vào các mạng con?","rolled_up_some_subnets":"Cuộn thành công các IP cấm vào các mạng con: %{subnets}.","rolled_up_no_subnet":"Không có gì để cuộn lên.","actions":{"block":"Khóa","do_nothing":"Cho phép","allow_admin":"Cho phép Quản trị"},"form":{"label":"Mới:","ip_address":"Địa chỉ IP","add":"Thêm","filter":"Tìm kiếm"},"roll_up":{"text":"Cuộn lên","title":"Tạo mạng con mới các entry cấm nếu có ít nhất 'min_ban_entries_for_roll_up' entry."}},"logster":{"title":"Log lỗi"}},"impersonate":{"title":"Mạo danh","help":"Sử dụng công cụ này để mạo danh một tài khoản thành viên cho mục đích gỡ lỗi, bạn sẽ phải đăng xuất sau khi hoàn tất.","not_found":"Không tìm thấy người dùng này.","invalid":"Xin lỗi, bạn không thể mạo danh tài khoản đó."},"users":{"title":"Tài khoản","create":"Thêm tài khoản Quản trị","last_emailed":"Email trước đây","not_found":"Xin lỗi, username không tồn tại trong hệ thống.","id_not_found":"Xin lỗi, id người dùng không tồn tại trong hệ thống.","active":"Kích hoạt","show_emails":"Hiện địa chỉ Email","nav":{"new":"Mới","active":"Kích hoạt","pending":"Đang chờ xử lý","staff":"Nhân viên","suspended":"Đã tạm khóa","blocked":"Đã khóa","suspect":"Nghi ngờ"},"approved":"Đã duyệt?","approved_selected":{"other":"duyệt tài khoản ({{count}})"},"reject_selected":{"other":"từ chối tài khoản ({{count}})"},"titles":{"active":"Thành viên kích hoạt","new":"Thành viên mới","pending":"Hoãn Xem xét Tài khoản","newuser":"Tài khoản ở Cấp độ Tin tưởng 0 (Tài khoản mới)","basic":"Tài khoản ở Cấp độ Tin tưởng 1 (Tài khoản Cơ bản)","member":"Tài khoản ở Độ tin cậy mức 2 (Member)","regular":"Tài khoản ở Độ tin cậy mức 3 (Regular)","leader":"Tài khoản ở Độ tin cậy mức 4 (Leader)","staff":"Nhân viên","admins":"Tài khoản Quản trị","moderators":"Điều hành viên","blocked":"Tài khoản Khóa","suspended":"Tài khoản Tạm khóa","suspect":"Tài khoản đáng ngờ"},"reject_successful":{"other":"Từ chối thành công %{count} tài khoản."},"reject_failures":{"other":"Từ chối thất bại %{count} tài khoản."},"not_verified":"Chưa xác thực","check_email":{"title":"Khám phá email của tài khoản này","text":"Hiển thị"}},"user":{"suspend_failed":"Có gì đó đã sai khi đình chỉ tài khoản này {{error}}","unsuspend_failed":"Có gì đó sai khi gỡ bỏ đình chỉ tài khoản này {{error}}","suspend_duration":"Tài khoản này sẽ bị đình chỉ bao lâu?","suspend_duration_units":"(ngày)","suspend_reason_label":"Tại sao bạn bị đình chỉ? Dòng chữ \u003cb\u003ehiển thị cho tất cả mọi người\u003c/b\u003e sẽ hiển thị trên trang hồ sơ tài khoản của người dùng này, và sẽ hiển thị cho thành viên khi họ đăng nhập, hãy viết ngắn.","suspend_reason":"Lý do","suspended_by":"Tạm khóa bởi","delete_all_posts":"Xóa tất cả bài viết","suspend":"Tạm khóa","unsuspend":"Đã mở khóa","suspended":"Đã tạm khóa?","moderator":"Mod?","admin":"Quản trị?","blocked":"Đã khóa?","staged":"Cấp bậc?","show_admin_profile":"Quản trị","edit_title":"Sửa Tiêu đề","save_title":"Lưu Tiêu đề","refresh_browsers":"Bắt buộc làm mới trình duyệt","refresh_browsers_message":"Tin nhắn đã gửi cho tất cả người dùng!","show_public_profile":"Hiển thị hồ sơ công khai","impersonate":"Mạo danh","ip_lookup":"Tìm kiếm địa chỉ IP","log_out":"Đăng xuất","logged_out":"Thành viên đã đăng xuất trên tất cả thiết bị","revoke_admin":"Thu hồi quản trị","grant_admin":"Cấp quản trị","revoke_moderation":"Thu hồi điều hành","grant_moderation":"Cấp điều hành","unblock":"Mở khóa","block":"Khóa","reputation":"Danh tiếng","permissions":"Quyền","activity":"Hoạt động","like_count":"Đã like / Nhận","last_100_days":"trong 100 ngày gần đây","private_topics_count":"Chủ đề riêng tư","posts_read_count":"Đọc bài viết","post_count":"Bài đăng đã được tạo","topics_entered":"Chủ để đã xem","flags_given_count":"Đã đánh dấu","flags_received_count":"Flags Received","warnings_received_count":"Đã nhận Cảnh báo","flags_given_received_count":"Đã đánh dấu / Nhận","approve":"Duyệt","approved_by":"duyệt  bởi","approve_success":"Thành viên được duyệt và đã gửi email hướng đẫn kích hoạt.","approve_bulk_success":"Thành công! Tất cả thành viên đã chọn được duyệt và thông báo.","time_read":"Thời gian đọc","anonymize":"Tài khoản Nặc danh","anonymize_confirm":"Bạn CHĂC CHẮN muốn xóa tài khoản nặc danh này? Nó sẽ thay đổi tên đăng nhập và email, và xóa tất cả thông tin trong hồ sơ.","anonymize_yes":"Đồng ý, đây là tài khoản nặc danh.","anonymize_failed":"Có vấn đề với những tài khoản nặc danh.","delete":"Xóa thành viên","delete_forbidden_because_staff":"Admin và mod không thể xóa.","delete_posts_forbidden_because_staff":"Không thể xóa tất cả bài viết của quản trị và điều hành viên.","delete_forbidden":{"other":"Không thể xóa tài khoản nếu họ có bài viết, hãy xóa tất cả các bài viết trước khi xóa tài khoản. (Không thể xóa các bài viết cũ hơn %{count} ngày.)"},"cant_delete_all_posts":{"other":"Không thể xóa tất cả các bài viết, một số bài viết cũ hơn %{count} ngày. (Thiết lập delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"other":"Không thể xóa tất cả các bài viết do tài khoản có hơn %{count} bài viết. (delete_all_posts_max)"},"delete_confirm":"Bạn CHẮC CHẮN muốn xóa thành viên này? Nó là vĩnh viễn!","delete_and_block":"Xóa và \u003cb\u003ekhóa\u003c/b\u003e email này và địa chỉ IP","delete_dont_block":"Chỉ xóa","deleted":"Thành viên này đã bị xóa","delete_failed":"Có lỗi trong quá trình xóa thành viên này. Chắc chắn rằng tất cả bài viết đã được xóa trước khi xóa thành viên.","send_activation_email":"Gửi email kích hoạt","activation_email_sent":"Email kích hoạt đã được gửi.","send_activation_email_failed":"Có vấn đề khi gửi lại email kích hoạt. %{error}","activate":"Kích hoạt tài khoản","activate_failed":"Có vấn đề khi kích hoạt thành viên này.","deactivate_account":"Vô hiệu hóa Tài khoản","deactivate_failed":"Có vấn đề khi bỏ kích hoạt thành viên này.","unblock_failed":"Có vẫn đề khi gỡ khóa thành viên này.","block_failed":"Có vấn đề khi khóa thành viên này.","block_confirm":"Bạn có chắc chắn muốn chặn người dùng này? Họ sẽ không thể tạo bất kỳ chủ đề hoặc bài viết mới nào.","block_accept":"Có, chặn người dùng này","deactivate_explanation":"Tài khoản chờ kích hoạt phải xác thực email của họ.","suspended_explanation":"Tài khoản tạm khóa không thể đăng nhập.","block_explanation":"Tài khoản bị khóa không thể đăng bài hoặc tạo chủ đề.","trust_level_change_failed":"Có lỗi xảy ra khi thay đổi mức độ tin tưởng của tài khoản.","suspend_modal_title":"Tạm khóa Thành viên","trust_level_2_users":"Độ tin cậy tài khoản mức 2","trust_level_3_requirements":"Độ tin cậy bắt buộc mức 3","trust_level_locked_tip":"mức độ tin cậy đang khóa, hệ thống sẽ không thể thăng hoặc giáng chức người dùng","trust_level_unlocked_tip":"độ tin cậy đang được mở, hệ thống có thể thăng hoặc giáng chức người dùng","lock_trust_level":"Khóa Cấp độ Tin tưởng","unlock_trust_level":"Mở khóa độ tin cậy","tl3_requirements":{"title":"Yêu cầu Cấp độ tin tưởng 3","value_heading":"Giá trị","requirement_heading":"Yêu cầu","visits":"Lượt xem","days":"ngày","topics_replied_to":"Topics Replied To","topics_viewed":"Đã xem chủ đề","topics_viewed_all_time":"Đã xem chủ đề (mọi lúc)","posts_read":"Đọc bài viết","posts_read_all_time":"Đọc bài viết (mọi lúc)","flagged_posts":"Đã gắn cờ Bài viết","flagged_by_users":"Users Who Flagged","likes_given":"Lượt Likes","likes_received":"Likes Đã Nhận","likes_received_days":"Like nhận được: ngày độc nhất","likes_received_users":"Like nhận được: tài khoản độc nhất","qualifies":"Đủ điều kiện cho độ tin cậy mức 3.","does_not_qualify":"Không đủ điều kiện cho độ tin cậy mức 3.","will_be_promoted":"Sẽ sớm được thăng chức.","will_be_demoted":"Sẽ sớm bị giáng chức.","on_grace_period":"Hiện đang trong khoảng thời gian gia hạn thăng chức, sẽ không thể giáng chức.","locked_will_not_be_promoted":"Mức độ tin cậy đang khóa, sẽ không thể thăng chức.","locked_will_not_be_demoted":"Mức độ tin cậy đang khóa, sẽ không thể giáng chức."},"sso":{"title":"Single Sign On","external_id":"ID Bên ngoài","external_username":"Tên đăng nhập","external_name":"Tên","external_email":"Email","external_avatar_url":"URL Ảnh đại diện"}},"user_fields":{"title":"Trường tài khoản","help":"Thêm trường dữ liệu cho người dùng nhập.","create":"Tạo trường tài khoản","untitled":"Không có tiêu đề","name":"Tên Trường","type":"Loại Trường","description":"Trường mô tả","save":"Lưu","edit":"Sửa","delete":"Xoá","cancel":"Hủy","delete_confirm":"Bạn muốn xóa trường thành viên?","options":"Lựa chọn","required":{"title":"Bắt buộc lúc đăng ký?","enabled":"bắt buộc","disabled":"không bắt buộc"},"editable":{"title":"Có thể chỉnh sửa sau khi đăng ký?","enabled":"có thể chỉnh sửa","disabled":"không thể chỉnh sửa"},"show_on_profile":{"title":"Hiển thị trong hồ sơ công khai","enabled":"hiển thị trong hồ sơ","disabled":"không hiển thị trong hồ sơ"},"show_on_user_card":{"title":"Hiện trên thẻ người dùng?","enabled":"hiển trên thẻ người dùng","disabled":"không hiện trên thẻ người dùng"},"field_types":{"text":"Nội dung chữ","confirm":"Xác nhận","dropdown":"Xổ xuống"}},"site_text":{"description":"Bạn có thể tùy chỉnh bất kỳ nội dung nào trên diễn đàn. Hãy bắt đầu bằng cách tìm kiếm dưới đây:","search":"Tìm kiếm nội dung bạn muốn sửa","title":"Nội Dung Chữ","edit":"sửa","revert":"Hoàn nguyên thay đổi","revert_confirm":"Bạn có chắc chắn muốn hoàn nguyên các thay đổi?","go_back":"Quay lại tìm kiếm","recommended":"Bạn nên tùy biến các nội dung sau đây cho phù hợp với nhu cầu:","show_overriden":"Chỉ hiển thị chỗ ghi đè"},"site_settings":{"show_overriden":"Chỉ hiện thị đã ghi đè","title":"Xác lập","reset":"trạng thái đầu","none":"không có gì","no_results":"Không tìm thấy kết quả.","clear_filter":"Xóa","add_url":"thêm URL","add_host":"thêm host","categories":{"all_results":"Tất cả","required":"Bắt buộc","basic":"Cài đặt cơ bản","users":"Thành viên","posting":"Đang đăng bài","email":"Email","files":"Tập tin","trust":"Độ tin tưởng","security":"Bảo mật","onebox":"Onebox","seo":"SEO","spam":"Rác","rate_limits":"Rate Limits","developer":"Nhà phát triển","embedding":"Embedding","legal":"Legal","uncategorized":"Khác","backups":"Sao lưu","login":"Đăng nhập","plugins":"Plugins","user_preferences":"Tùy chỉnh Tài khoản"}},"badges":{"title":"Huy hiệu","new_badge":"Thêm huy hiệu","new":"Mới","name":"Tên","badge":"Huy hiệu","display_name":"Tên Hiển thị","description":"Mô tả","long_description":"Mô Tả Dài","badge_type":"Kiểu huy hiệu","badge_grouping":"Nhóm","badge_groupings":{"modal_title":"Nhóm huy hiệu"},"granted_by":"Cấp bởi","granted_at":"Cấp lúc","reason_help":"(Liên kết đến bài viết hoặc chủ đề)","save":"Lưu","delete":"Xóa","delete_confirm":"Bạn có chắc chắn muốn xóa huy hiệu này?","revoke":"Thu hồi","reason":"Lý do","expand":"Mở rộng \u0026hellip;","revoke_confirm":"Bạn có chắc chắn muốn thu hồi huy hiệu này?","edit_badges":"Sửa huy hiệu","grant_badge":"Cấp huy hiệu","granted_badges":"Cấp huy hiệu","grant":"Cấp","no_user_badges":"%{name} chưa được cấp bất kỳ huy hiệu nào.","no_badges":"Không có huy hiệu có thể được cấp.","none_selected":"Chọn một huy hiệu để bắt đầu","allow_title":"Cho phép huy hiệu được sử dụng như là tên","multiple_grant":"Có thể được cấp nhiều lần","listable":"Hiện huy hiệu trên trang huy hiệu công khai","enabled":"Bật huy hiệu","icon":"Biểu tượng","image":"Hình ảnh","icon_help":"Sử dụng Font Awesome class hoặc URL của ảnh","query":"Truy vấn huy hiệu (SQL)","target_posts":"Truy vấn bài viết mục tiêu","auto_revoke":"Chạy truy vấn hủy bỏ hàng ngày","show_posts":"Hiện bài viết được cấp huy hiệu trên trang huy hiệu","trigger":"Phát động","trigger_type":{"none":"Cập nhật hàng ngày","post_action":"Khi người dùng hoạt động trên bài viết","post_revision":"Khi người dùng sửa hoặc tạo bài viết","trust_level_change":"Khi người dùng thay đổi mức độ tin cậy","user_change":"Khi người dùng được sửa hoặc được tạo","post_processed":"Sau khi bài viết được đăng"},"preview":{"link_text":"Xem trước cấp huy hiệu","plan_text":"Xem trước kế hoạch truy vấn","modal_title":"Xem trước truy vấn huy hiệu","sql_error_header":"Có lỗi xảy ra với truy vấn.","error_help":"Xem các liên kết sau đây để trợ giúp các truy vấn huy hiệu.","bad_count_warning":{"header":"CẢNH BÁO!","text":"Thiếu mẫu cấp độ huy hiệu, điều này xảy ra khi truy vấn huy hiệu trả về IDs tài khoản hoặc IDs bài viết không tồn tại. Điều này có thể gây ra kết quả bất ngờ sau này - hãy kiểm tra lại truy vấn của bạn lần nữa."},"no_grant_count":"Không có huy hiệu nào được gán.","grant_count":{"other":"\u003cb\u003e%{count}\u003c/b\u003e huy hiệu đã được gán."},"sample":"Ví dụ:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for post in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e viết bài trong %{link} lúc \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e lúc \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Thêm emoji mới có sẵn cho tất cả mọi người. (MẸO: kéo \u0026 thả nhiều file cùng lúc)","add":"Thêm emoji mới","name":"Tên","image":"Hình ảnh","delete_confirm":"Bạn có chắc chắn muốn xóa emoji :%{name}:?"},"embedding":{"get_started":"Nếu bạn muốn nhúng Discourse trên một website khác, bắt đầu bằng cách thêm host.","confirm_delete":"Bạn muốn xóa host này?","sample":"Sử dụng mã HTML sau vào website để tạo và nhúng các chủ đề. Thay thế \u003cb\u003eREPLACE_ME\u003c/b\u003e với Canonical URL của trang bạn muốn nhúng.","title":"Nhúng","host":"Cho phép Host","edit":"sửa","category":"Đăng vào Danh mục","add_host":"Thêm Host","settings":"Thiết lập nhúng","feed_settings":"Cấu hình Feed","feed_description":"Cung cấp RSS/ATOM cho website để cải thiện khả năng Discourse import nội dung của bạn.","crawling_settings":"Cấu hình Crawler","crawling_description":"Khi Discourse tạo chủ đề cho các bài viết của bạn, nếu không có RSS/ATOM thì hệ thống sẽ thử phân tích nội dung HTML. Đôi khi có thể gặp khó khăn khi trích xuất nội dung, vì vậy hệ thống cung cấp khả năng chỉ định quy tắc CSS để giúp quá trình trích xuất dễ dàng hơn.","embed_by_username":"Tên thành viên để tạo chủ đề","embed_post_limit":"Số lượng tối đa bài viết được nhúng","embed_username_key_from_feed":"Key to pull discourse username from feed","embed_truncate":"Cắt ngắn các bài viết được nhúng","embed_whitelist_selector":"Bộ chọn các thành phần CSS được hỗ trợ khi nhúng","embed_blacklist_selector":"CSS selector for elements that are removed from embeds","feed_polling_enabled":"Nhập bài viết bằng RSS/ATOM","feed_polling_url":"URL của RSS/ATOM để thu thập","save":"Lưu thiết lập nhúng"},"permalink":{"title":"Liên kết cố định","url":"URL","topic_id":"ID Chủ đề","topic_title":"Chủ đề","post_id":"ID Bài viết","post_title":"Bài viết","category_id":"ID Danh mục","category_title":"Danh mục","external_url":"URL Bên ngoài","delete_confirm":"Bạn có chắc chắn muốn xóa liên kết tĩnh này?","form":{"label":"Mới:","add":"Thêm","filter":"Tìm kiếm (URL hoặc External URL)"}}}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"timeline_date":"MMM YYYY","wrap_ago":"%{date} ago","tiny":{"less_than_x_seconds":{"one":"\u003c 1s"},"x_seconds":{"one":"1s"},"x_minutes":{"one":"1m"},"about_x_hours":{"one":"1h"},"x_days":{"one":"1d"},"about_x_years":{"one":"1y"},"over_x_years":{"one":"\u003e 1y"},"almost_x_years":{"one":"1y"}},"medium":{"x_minutes":{"one":"1 min"},"x_hours":{"one":"1 hour"},"x_days":{"one":"1 day"}},"medium_with_ago":{"x_minutes":{"one":"1 min ago"},"x_hours":{"one":"1 hour ago"},"x_days":{"one":"1 day ago"}},"later":{"x_days":{"one":"1 day later"},"x_months":{"one":"1 month later"},"x_years":{"one":"1 year later"}}},"action_codes":{"public_topic":"made this topic public %{when}","private_topic":"made this topic private %{when}","invited_group":"invited %{who} %{when}","removed_group":"removed %{who} %{when}"},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"ap_south_1":"Asia Pacific (Mumbai)","cn_north_1":"China (Beijing)"}},"links_lowercase":{"one":"link"},"character_count":{"one":"{{count}} character"},"topic_count_latest":{"one":"{{count}} new or updated topic."},"topic_count_unread":{"one":"{{count}} unread topic."},"topic_count_new":{"one":"{{count}} new topic."},"switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","queue":{"has_pending_posts":{"one":"This topic has \u003cb\u003e1\u003c/b\u003e post awaiting approval"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e1\u003c/strong\u003e post pending."}}},"directory":{"topics_entered":"Viewed","topics_entered_long":"Topics Viewed","total_rows":{"one":"1 user"}},"groups":{"index":"Groups","title":{"one":"group"},"notifications":{"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."}}},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"},"topic_stat_sentence":{"one":"%{count} new topic in the past %{unit}."}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"dismiss_notifications":"Dismiss All","email_activity_summary":"Activity Summary","mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","daily":"Send daily updates","individual":"Send an email for every new post","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","watched_topics_link":"Show watched topics","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","invited":{"truncated":{"one":"Showing the first invite."},"reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!"},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited"},"posts_read":{"one":"post read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"},"top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}"}},"replies_lowercase":{"one":"reply"},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} message in your {{group_name}} inbox\u003c/p\u003e"}},"search":{"too_short":"Your search term is too short.","result_count":{"one":"1 result for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"context":{"category":"Search the #{{category}} category"}},"topics":{"bulk":{"selected":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e topic."},"change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"new_topics":{"one":"1 new topic"},"unread_topics":{"one":"1 unread topic"},"total_unread_posts":{"one":"you have 1 unread post in this topic"},"unread_posts":{"one":"you have 1 unread old post in this topic"},"new_posts":{"one":"there is 1 new post in this topic since you last read it"},"likes":{"one":"there is 1 like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e"}},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"filters":{"n_posts":{"one":"1 post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."},"change_owner":{"instructions":{"one":"Please choose the new owner of the post by \u003cb\u003e{{old_user}}\u003c/b\u003e."}},"multi_select":{"description":{"one":"You have selected \u003cb\u003e1\u003c/b\u003e post."}}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view 1 hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes":{"one":"{{count}} Like"},"has_likes_title":{"one":"1 person liked this post"},"has_likes_title_you":{"one":"you and 1 other person liked this post"},"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","controls":{"delete_replies":{"confirm":{"one":"Do you also want to delete the direct reply to this post?"}}},"actions":{"defer_flags":{"one":"Defer flag"},"by_you_and_others":{"off_topic":{"one":"You and 1 other flagged this as off-topic"},"spam":{"one":"You and 1 other flagged this as spam"},"inappropriate":{"one":"You and 1 other flagged this as inappropriate"},"notify_moderators":{"one":"You and 1 other flagged this for moderation"},"notify_user":{"one":"You and 1 other sent a message to this user"},"bookmark":{"one":"You and 1 other bookmarked this post"},"like":{"one":"You and 1 other liked this"},"vote":{"one":"You and 1 other voted for this post"}},"by_others":{"off_topic":{"one":"1 person flagged this as off-topic"},"spam":{"one":"1 person flagged this as spam"},"inappropriate":{"one":"1 person flagged this as inappropriate"},"notify_moderators":{"one":"1 person flagged this for moderation"},"notify_user":{"one":"1 person sent a message to this user"},"bookmark":{"one":"1 person bookmarked this post"},"like":{"one":"1 person liked this"},"vote":{"one":"1 person voted for this post"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links...","clicks":{"one":"1 click"}},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"views_lowercase":{"one":"view"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (1)"}},"unread":{"title_with_count":{"one":"Unread (1)"},"lower_title_with_count":{"one":"1 unread"}},"new":{"lower_title_with_count":{"one":"1 new"},"title_with_count":{"one":"New (1)"}},"category":{"title_with_count":{"one":"{{categoryName}} (1)"}}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","poll_type":{"regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"flags":{"summary":{"action_type_3":{"one":"off-topic"},"action_type_4":{"one":"inappropriate"},"action_type_6":{"one":"custom"},"action_type_7":{"one":"custom"},"action_type_8":{"one":"spam"}}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"email":{"bounced":"Bounced"},"logs":{"staff_actions":{"actions":{"deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"users":{"approved_selected":{"one":"approve user"},"reject_selected":{"one":"reject user"},"reject_successful":{"one":"Successfully rejected 1 user."},"reject_failures":{"one":"Failed to reject 1 user."}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","delete_forbidden":{"one":"Users can't be deleted if they have posts. Delete all posts before trying to delete a user. (Posts older than %{count} day old can't be deleted.)"},"cant_delete_all_posts":{"one":"Can't delete all posts. Some posts are older than %{count} day old. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Can't delete all posts because the user has more than 1 post. (delete_all_posts_max)"},"bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","tags":"Tags","search":"Search"}},"badges":{"preview":{"grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge to be assigned."}}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_classname_whitelist":"Allowed CSS class names"}}}}};
I18n.locale = 'vi';
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
//! locale : vietnamese (vi)
//! author : Bang Nguyen : https://github.com/bangnk

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var vi = moment.defineLocale('vi', {
        months : 'tháng 1_tháng 2_tháng 3_tháng 4_tháng 5_tháng 6_tháng 7_tháng 8_tháng 9_tháng 10_tháng 11_tháng 12'.split('_'),
        monthsShort : 'Th01_Th02_Th03_Th04_Th05_Th06_Th07_Th08_Th09_Th10_Th11_Th12'.split('_'),
        monthsParseExact : true,
        weekdays : 'chủ nhật_thứ hai_thứ ba_thứ tư_thứ năm_thứ sáu_thứ bảy'.split('_'),
        weekdaysShort : 'CN_T2_T3_T4_T5_T6_T7'.split('_'),
        weekdaysMin : 'CN_T2_T3_T4_T5_T6_T7'.split('_'),
        weekdaysParseExact : true,
        meridiemParse: /sa|ch/i,
        isPM : function (input) {
            return /^ch$/i.test(input);
        },
        meridiem : function (hours, minutes, isLower) {
            if (hours < 12) {
                return isLower ? 'sa' : 'SA';
            } else {
                return isLower ? 'ch' : 'CH';
            }
        },
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM [năm] YYYY',
            LLL : 'D MMMM [năm] YYYY HH:mm',
            LLLL : 'dddd, D MMMM [năm] YYYY HH:mm',
            l : 'DD/M/YYYY',
            ll : 'D MMM YYYY',
            lll : 'D MMM YYYY HH:mm',
            llll : 'ddd, D MMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[Hôm nay lúc] LT',
            nextDay: '[Ngày mai lúc] LT',
            nextWeek: 'dddd [tuần tới lúc] LT',
            lastDay: '[Hôm qua lúc] LT',
            lastWeek: 'dddd [tuần rồi lúc] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : '%s tới',
            past : '%s trước',
            s : 'vài giây',
            m : 'một phút',
            mm : '%d phút',
            h : 'một giờ',
            hh : '%d giờ',
            d : 'một ngày',
            dd : '%d ngày',
            M : 'một tháng',
            MM : '%d tháng',
            y : 'một năm',
            yy : '%d năm'
        },
        ordinalParse: /\d{1,2}/,
        ordinal : function (number) {
            return number;
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return vi;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
