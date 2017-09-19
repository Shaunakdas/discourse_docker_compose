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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "Dette emne har ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 svar";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " svar";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "med et højt like pr. indlæg forhold";
return r;
},
"med" : function(d){
var r = "";
r += "med et meget højt like pr. indlæg forhold";
return r;
},
"high" : function(d){
var r = "";
r += "med et ekstremt højt like pr. indlæg forhold";
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

MessageFormat.locale.da = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
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
I18n.translations = {"da":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} siden","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1t","other":"%{count}t"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1å","other":"%{count}å"},"over_x_years":{"one":"\u003e 1å","other":"\u003e %{count}å"},"almost_x_years":{"one":"1å","other":"%{count}å"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} min"},"x_hours":{"one":"1 time","other":"%{count} timer"},"x_days":{"one":"1 dag","other":"%{count} dage"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 min siden","other":"%{count} min siden"},"x_hours":{"one":"1 time siden","other":"%{count} timer siden"},"x_days":{"one":"1 dag siden","other":"%{count} dage siden"}},"later":{"x_days":{"one":"1 dag senere","other":"%{count} dage senere"},"x_months":{"one":"1 måned senere","other":"%{count} måneder senere"},"x_years":{"one":"1 år senere","other":"%{count} år senere"}},"previous_month":"Forrige måned","next_month":"Næste måned"},"share":{"topic":"del et link til dette emne","post":"indlæg #%{postNumber}","close":"luk","twitter":"del dette link på Twitter","facebook":"del dette link på Facebook","google+":"del dette link på Google+","email":"send dette link i en e-mail"},"action_codes":{"public_topic":"offentliggjorde dette emne %{when}","private_topic":"gjorde dette emne privat %{when}","split_topic":"delte dette emne op %{when}","invited_user":"Inviterede %{who} %{when}","invited_group":"inviterede %{who} %{when}","removed_user":"fjernede %{who} %{when}","removed_group":"fjernede %{who} %{when}","autoclosed":{"enabled":"lukket %{when}","disabled":"åbnet %{when}"},"closed":{"enabled":"lukket %{when}","disabled":"åbnet %{when}"},"archived":{"enabled":"arkiveret %{when}","disabled":"dearkiveret %{when}"},"pinned":{"enabled":"fastgjort %{when}","disabled":"frigjort %{when}"},"pinned_globally":{"enabled":"fastgjort globalt %{when}","disabled":"frigjort %{when}"},"visible":{"enabled":"listet %{when}","disabled":"aflistet %{when}"}},"topic_admin_menu":"administrationshandlinger på emne","emails_are_disabled":"Alle udgående emails er blevet deaktiveret globalt af en administrator. Ingen emailnotifikationer af nogen slags vil blive sendt.","bootstrap_mode_disabled":"Bootstrap tilstand vil blive deaktiveret indenfor de næste 24 timer.","edit":"redigér titel og kategori for dette emne","not_implemented":"Beklager, denne feature er ikke blevet implementeret endnu.","no_value":"Nej","yes_value":"Ja","generic_error":"Beklager, der opstod en fejl.","generic_error_with_reason":"Der opstod en fejl: %{error}","sign_up":"Tilmeld dig","log_in":"Log ind","age":"Alder","joined":"Tilmeldt","admin_title":"Admin","flags_title":"Flag","show_more":"vis mere","show_help":"indstillinger","links":"Links","links_lowercase":{"one":"link","other":"links"},"faq":"FAQ","guidelines":"Retningslinier","privacy_policy":"Privatlivspolitik","privacy":"Privatliv","terms_of_service":"Betingelser","mobile_view":"Mobil-visning","desktop_view":"Desktop-visning","you":"Dig","or":"eller","now":"lige nu","read_more":"læs mere","more":"Mere","less":"Mindre","never":"aldrig","every_30_minutes":"hvert 30. minut","every_hour":"hver time","daily":"dagligt","weekly":"ugentligt","every_two_weeks":"hver anden uge","every_three_days":"hver tredje dag","max_of_count":"max af {{count}}","alternation":"eller","character_count":{"one":"{{count}} tegn","other":"{{count}} tegn"},"suggested_topics":{"title":"Foreslåede emner","pm_title":"Foreslåede beskeder"},"about":{"simple_title":"Om","title":"Om %{title}","stats":"Site statistik","our_admins":"Vores Administratorer","our_moderators":"Vores Moderatorer","stat":{"all_time":"Alt","last_7_days":"De sidste 7 Dage","last_30_days":"De sidste 30 dage"},"like_count":"Synes godt om","topic_count":"Emner","post_count":"Indlæg","user_count":"Nye brugere","active_user_count":"Aktive brugere","contact":"Kontakt os","contact_info":"I tilfælde af kritiske situationer eller vigtige spørgsmål angående denne side, kontakt os venligst på %{contact_info}."},"bookmarked":{"title":"Bogmærke","clear_bookmarks":"Fjern bogmærker","help":{"bookmark":"Klik for at sætte et bogmærke i det første indlæg i denne tråd","unbookmark":"Klik for at fjerne alle bogmærker i dette emne"}},"bookmarks":{"not_logged_in":"Beklager, du skal været logget ind for at bogmærke indlæg","created":"Du har bogmærket dette indlæg.","not_bookmarked":"Du har læst dette indlæg; klik for at bogmærke det","last_read":"Dette er det seneste indlæg, du har læst; klik for at bogmærke det","remove":"Fjern bogmærke","confirm_clear":"Er du sikker på du vil slette alle bogmærker fra dette emne?"},"topic_count_latest":{"one":"{{count}} nyt eller opdateret emne.","other":"{{count}} nye eller opdaterede emner."},"topic_count_unread":{"one":"{{count}} ulæst emne.","other":"{{count}} ulæste emner."},"topic_count_new":{"one":"{{count}} nyt indlæg","other":"{{count}} nye indlæg."},"click_to_show":"Klik for at se.","preview":"forhåndsvising","cancel":"annullér","save":"Gem ændringer","saving":"Gemmer…","saved":"Gemt!","upload":"Upload","uploading":"Uploader…","uploading_filename":"Uploader {{filename}}...","uploaded":"Uploadet!","enable":"Aktiver","disable":"Deaktiver","undo":"Fortryd","revert":"Gendan","failed":"Fejlet","switch_to_anon":"Gå i anonym tilstand","switch_from_anon":"Afslut anonym tilstand","banner":{"close":"Afvis denne banner.","edit":"Rediger dette banner \u003e\u003e"},"choose_topic":{"none_found":"Ingen emner fundet.","title":{"search":"Søg efter et emne efter navn, url eller UD:","placeholder":"indtast emnets titel her"}},"queue":{"topic":"Emne:","approve":"Godkend","reject":"Afvis","delete_user":"Slet bruger","title":"Afventer godkendelse","none":"Der er ingen indlæg at vurdere.","edit":"Ret","cancel":"Annuller","view_pending":"vis afventende indlæg","has_pending_posts":{"one":"Det emne har \u003cb\u003e1\u003c/b\u003e indlæg der afventer godkendelse","other":"Dette emne har \u003cb\u003e{{count}}\u003c/b\u003e indlæg der afventer godkendelse"},"confirm":"Gem ændringer","delete_prompt":"Er du sikker på at du vil slette \u003cb\u003e%{username}\u003c/b\u003e? Det fjerner alle indlæg og blokerer email og IP-adresse.","approval":{"title":"Indlæg afventer godkendelse","description":"Vi har modtaget dit indlæg, men det skal først godkendes af en moderator. Hav venligst tålmodighed.","pending_posts":{"one":"Du har \u003cstrong\u003e1\u003c/strong\u003e afventende indlæg.","other":"Du har \u003cstrong\u003e{{count}}\u003c/strong\u003e afventende indlæg."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e oprettede \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e oprettede \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarede på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarede på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarede på \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarede på \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003edig\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eDu\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Oprettet af \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Oprettet af \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e","sent_by_user":"Sendt af \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Sendt af \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e"},"directory":{"filter_name":"filtrer efter brugernavn","title":"Brugere","likes_given":"Givet","likes_received":"Modtaget","topics_entered":"Set","topics_entered_long":"Læste emner","time_read":"Læsetid","topic_count":"Emner","topic_count_long":"Emner oprettet","post_count":"Svar","post_count_long":"Svar sendt","no_results":"Ingen resultater fundet.","days_visited":"Besøg","days_visited_long":"Besøgsdage","posts_read":"Læste","posts_read_long":"Indlæg læst","total_rows":{"one":"1 bruger","other":"%{count} brugere"}},"groups":{"empty":{"posts":"Der er ingen indlæg af medlemmer af denne gruppe.","members":"Der er ingen medlemmer i denne gruppe.","mentions":"Denne gruppe er ikke nævnt.","messages":"Der er ingen besked til denne gruppe.","topics":"Der er intet emne af medlemmer af denne gruppe."},"add":"Tilføj","selector_placeholder":"Tilføj medlemmer","owner":"ejer","visible":"Gruppen er synlige for alle brugere","index":"Grupper","title":{"one":"gruppe","other":"grupper"},"members":"Medlemmer","topics":"Emner","posts":"Indlæg","mentions":"Omtaler","messages":"Beskeder","alias_levels":{"title":"Hvem kan sende beskeder til og @nævne denne gruppe?","nobody":"Ingen","only_admins":"Kun administratore","mods_and_admins":"Kun moderatore og administratore","members_mods_and_admins":"Kun gruppe medlemmer, moderatore og administratore","everyone":"Alle"},"trust_levels":{"title":"Tillidsniveau der automatisk tildeles medlemmer når de oprettes:","none":"Ingen"},"notifications":{"watching":{"title":"Kigger","description":"Du får beskeder om hvert nyt indlæg i hver besked og antallet af nye svar bliver vist."},"watching_first_post":{"description":"Du får kun besked om første indlæg i hvert nyt emne i denne gruppe."},"tracking":{"title":"Følger","description":"Du får besked hvis nogen nævner dit @navn eller svarer dig og antallet af nye svar bliver vist."},"regular":{"title":"Normal","description":"Du får besked hvis nogen nævner dit @navn "},"muted":{"title":"Tavs","description":"Du får aldrig beskeder om nye emner i denne gruppe."}}},"user_action_groups":{"1":"Likes givet","2":"Likes modtaget","3":"Bogmærker","4":"Emner","5":"Svar","6":"Svar","7":"Referencer","9":"Citater","11":"Ændringer","12":"Sendte indlæg","13":"Indbakke","14":"Afventer"},"categories":{"all":"alle kategorier","all_subcategories":"Alle","no_subcategory":"ingen","category":"Kategori","category_list":"Vis liste over kategorier","reorder":{"title":"Ret kategoriernes rækkefølge ","title_long":"Omorganiser listen over kategorier","fix_order":"Lås placeringer","fix_order_tooltip":"Ikke alle kategorier har et unikt positionsnummer, hvilket kan give uventede resultater.","save":"Gem rækkefølge","apply_all":"Anvend","position":"Position"},"posts":"Indlæg","topics":"Emner","latest":"Seneste","latest_by":"seneste af","toggle_ordering":"vis/skjul rækkefølgeskifter","subcategories":"Underkategorier:","topic_stat_sentence":{"one":"%{count} nyt emne i den/det seneste %{unit}.","other":"%{count} nye emner i den/det seneste %{unit}."}},"ip_lookup":{"title":"IP-adresse opslag","hostname":"Værtsnavn","location":"Sted","location_not_found":"(ukendt)","organisation":"Organisation","phone":"Telefon","other_accounts":"Andre konti med denne IP adresse","delete_other_accounts":"Slet %{count}","username":"brugernavn","trust_level":"TL","read_time":"læse tid","topics_entered":"emner besøgt","post_count":"# indlæg","confirm_delete_other_accounts":"Er du sikker på, at du vil slette disse kontoer?"},"user_fields":{"none":"(vælg en indstilling)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Mute","edit":"Redigér indstillinger","download_archive":"Download Mine Posts","new_private_message":"Ny Besked","private_message":"Besked","private_messages":"Beskeder","activity_stream":"Aktivitet","preferences":"Indstillinger","expand_profile":"Udvid","bookmarks":"Bogmærker","bio":"Om mig","invited_by":"Inviteret af","trust_level":"Tillidsniveau","notifications":"Underretninger","statistics":"Statistik","desktop_notifications":{"label":"Desktop-notifikationer","not_supported":"Notifikationer understøttes ikke af denne browser. Beklager.","perm_default":"Slå notifikationer til","perm_denied_btn":"Tilladelse nægtet","perm_denied_expl":"Du nægtede adgang for notifikationer. Tillad notifikationer via indstillingerne i din browser.","disable":"Deaktiver notifikationer","enable":"Aktiver notifikationer","each_browser_note":"Bemærk: Du skal ændre indstillingen i alle dine browsere."},"dismiss_notifications":"Afvis alle","dismiss_notifications_tooltip":"Marker alle ulæste notifikationer som læst","disable_jump_reply":"Ikke hop til mit indlæg efter jeg svarer","dynamic_favicon":"Vis nyt / opdateret emnetal på browserikon","external_links_in_new_tab":"Åbn alle eksterne links i en ny fane","enable_quoting":"Tillad citering af markeret tekst","change":"skift","moderator":"{{user}} er moderator","admin":"{{user}} er admin","moderator_tooltip":"Denne bruger er moderator","admin_tooltip":"Denne bruger er administrator","blocked_tooltip":"Brugeren er blokeret","suspended_notice":"Denne bruger er suspenderet indtil {{date}}.","suspended_reason":"Begrundelse: ","github_profile":"Github","email_activity_summary":"Resumé over aktivitet","mailing_list_mode":{"label":"Mailing list tilstand","enabled":"Aktiverer mailing list tilstand","daily":"Send daglige opdateringer","individual":"Send en email for hvert nyt indlæg","many_per_day":"Send mig en email for hvert nyt indlæg (omkring {{dailyEmailEstimate}} per dag)","few_per_day":"Send mig en email or hvert nyt indlæg (cirka 2 om dagen)"},"tag_settings":"Mærker","watched_tags_instructions":"Du vil automatisk følge alle emner med disse mærker. Du bliver informeret om alle nye indlæg og emner og antallet af nye indlæg bliver vises ved emnet.","tracked_tags_instructions":"Du tracker automatisk alle emner med disse mærker. Antallet af nye indlæg bliver vises ved hvert emne.","watched_categories":"Overvåget","watched_categories_instructions":"Du overvåger automatisk alle emner i disse kategorier. Du får besked om alle nye indlæg og emner, og antallet af nye indlæg vises ved hvert emne.","tracked_categories":"Fulgt","tracked_categories_instructions":"Du tracker automatisk alle emner i disse kategorier. Antallet af nye indlæg vises ved hvert emne.","watched_first_post_tags_instructions":"Du får besked om første indlæg i hvert nyt emne med disse mærker.","muted_categories":"Ignoreret","muted_categories_instructions":"Du får ikke beskeder om nye emner i disse kategorier og de fremstår ikke i seneste.","delete_account":"Slet min konto","delete_account_confirm":"Er du sikker på du vil slette din konto permanent? Dette kan ikke fortrydes!","deleted_yourself":"Din konto er nu slettet.","delete_yourself_not_allowed":"Du kan ikke slette din konto lige nu. Kontakt en administrator for at få din konto slettet.","unread_message_count":"Beskeder","admin_delete":"Slet","users":"Brugere","muted_users":"Ignoreret","muted_users_instructions":"Undertryk alle notifikationer fra disse brugere.","muted_topics_link":"Vis mute emner","staff_counters":{"flags_given":"hjælpsomme markeringer","flagged_posts":"markerede indlæg","deleted_posts":"slettede indlæg","suspensions":"suspenderinger","warnings_received":"advarsler"},"messages":{"all":"Alle","inbox":"Indbakke","sent":"Sendt","archive":"Arkiv","groups":"Mine grupper","bulk_select":"Vælg beskeder","move_to_inbox":"Flyt til Indbakke","move_to_archive":"Arkiv","failed_to_move":"Kunne ikke flytte valgt beskeder (måske problemer med netværket)","select_all":"Vælg alle"},"change_password":{"success":"(e-mail sendt)","in_progress":"(sender e-mail)","error":"(fejl)","action":"Send e-mail til nulstilling af adgangskode","set_password":"Skriv password"},"change_about":{"title":"Skift “Om mig”"},"change_username":{"title":"Skift brugernavn","taken":"Beklager, det brugernavn er optaget.","error":"Der skete en fejl i forbindelse med skift af dit brugernavn.","invalid":"Det brugernavn er ugyldigt. Det må kun bestå af bogstaver og tal."},"change_email":{"title":"Skift e-mail-adresse","taken":"Beklager, den e-mail-adresse er optaget af en anden bruger.","error":"Der opstod en fejl i forbindelse med skift af din e-mail-adresse. Måske er adressen allerede i brug?","success":"Vi har sendt en e-mail til din nye adresse. Klik på linket i mail’en for at aktivere din nye e-mail-adresse."},"change_avatar":{"title":"Skift dit profilbillede","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baseret på","gravatar_title":"Skift din avatar på Gravatar's site","refresh_gravatar_title":"Gendindlæs dit profil billede","letter_based":"System tildelt profilbillede","uploaded_avatar":"Brugerdefineret profil billede","uploaded_avatar_empty":"Tilføj et brugerdefineret profil billede","upload_title":"Upload dit profil billede","upload_picture":"Upload et billede","image_is_not_a_square":"Advarsel: vi har klippet i billedet; bredde og højde var ikke ens.","cache_notice":"Du har ændret dit profilbillede, men der kan godt gå lidt tid inden ændringen træder i kraft."},"change_profile_background":{"title":"Profil baggrundsbillede","instructions":"Profil baggrunde vil blive centrerede og have en standard bredde på 850 pixels"},"change_card_background":{"title":"Brugerkort-Baggrund","instructions":"Baggrunds billeder vil blive centreret og have en standard bredde på 590px."},"email":{"title":"E-mail","instructions":"Aldrig vist offentligt","ok":"Vi vil sende dig en bekræftelses email","invalid":"Indtast venligst en gyldig email adresse","authenticated":"Din email er blevet bekræftet af {{provider}}","frequency_immediately":"Vi sender dig en email med det samme, hvis du ikke har læst den ting vi emailer dig om.","frequency":{"one":"Vi sender dig kun email, hvis vi ikke har set dig i det seneste minut.","other":"Vi sender dig kun email. hvis vi ikke har set dig i de sidste {{count}} minutter."}},"name":{"title":"Navn","instructions":"Dit fulde navn (valgfrit)","instructions_required":"Dit fulde navn","too_short":"Dit navn er for kort","ok":"Dit navn ser fint ud"},"username":{"title":"Brugernavn","instructions":"Unikt, ingen mellemrum, kort","short_instructions":"Folk kan benævne dig som @{{username}}","available":"Dit brugernavn er tilgængeligt","global_match":"E-mail svarer til det registrerede brugernavn","global_mismatch":"Allerede registreret. Prøv {{suggestion}}?","not_available":"Ikke ledigt. Prøv {{suggestion}}?","too_short":"Dit brugernavn er for kort","too_long":"Dit brugernavn er for langt","checking":"Kontrollerer om brugernavnet er ledigt…","enter_email":"Brugernavn fundet; indtast tilsvarende e-mail","prefilled":"E-mail svarer til dette registrerede brugernavn"},"locale":{"title":"sprog","instructions":"Brugerinterface sprog. Det skifter når de reloader siden.","default":"(standard)"},"password_confirmation":{"title":"Gentag adgangskode"},"last_posted":"Sidste indlæg","last_emailed":"Sidste e-mail","last_seen":"Sidst set","created":"Oprettet","log_out":"Log ud","location":"Sted","card_badge":{"title":"Brugerkort-Badge"},"website":"Site","email_settings":"E-mail","like_notification_frequency":{"title":"Giv besked når liked","always":"Altid","first_time_and_daily":"Første gang et indlæg likes og dagligt","first_time":"Første gang et indlæg likes","never":"Aldrig"},"email_previous_replies":{"title":"Inkluder tidligere svar i bunden af emails","unless_emailed":"medmindre tidligere sendt","always":"altid","never":"aldrig"},"email_digests":{"every_30_minutes":"hvert 30. minut","every_hour":"hver time","daily":"dagligt","every_three_days":"hver tredje dag","weekly":"ugenligt","every_two_weeks":"hver anden uge"},"email_in_reply_to":"Inkluder et uddrag af svaret indlæg i emails","email_direct":"Send mig en email når nogen citerer mig, svarer på mit indlæg, nævner mit @brugernavn eller inviterer mig til et emne","email_private_messages":"Send mig en email når nogen sender mig en besked","email_always":"Send mig email-notifikationer, selv når jeg er aktiv på websitet","other_settings":"Andre","categories_settings":"Kategorier","new_topic_duration":{"label":"Betragt emner som nye når","not_viewed":"Jeg har ikke set dem endnu","last_here":"oprettet siden jeg var her sidst","after_1_day":"oprettet indenfor den seneste dag","after_2_days":"oprettet i de seneste 2 dage","after_1_week":"oprettet i seneste uge","after_2_weeks":"oprettet i de seneste 2 uger"},"auto_track_topics":"Følg automatisk emner jeg åbner","auto_track_options":{"never":"aldrig","immediately":"med det samme","after_30_seconds":"efter 30 sekunder","after_1_minute":"efter 1 minut","after_2_minutes":"efter 2 minutter","after_3_minutes":"efter 3 minutter","after_4_minutes":"efter 4 minutter","after_5_minutes":"efter 5 minutter","after_10_minutes":"efter 10 minutter"},"invited":{"search":"tast for at søge invitationer…","title":"Invitationer","user":"Inviteret bruger","sent":"Sendt","none":"Der er ingen afventende invitationer.","truncated":{"one":"Viser den første invitation.","other":"Viser de første {{count}} invitationer."},"redeemed":"Brugte invitationer","redeemed_tab":"Indløst","redeemed_tab_with_count":"Indløst ({{count}})","redeemed_at":"Invitation brugt","pending":"Udestående invitationer","pending_tab":"Afventende","pending_tab_with_count":"Ventende ({{count}})","topics_entered":"Emner åbnet","posts_read_count":"Indlæg læst","expired":"Denne invitation er forældet","rescind":"Fjern","rescinded":"Invitation fjernet","reinvite":"Gensend invitation","reinvited":"Invitation gensendt","time_read":"Læsetid","days_visited":"Besøgsdage","account_age_days":"Kontoens alder i dage","create":"Send en invitation","generate_link":"Kopier invitations-link","generated_link_message":"\u003cp\u003eInvitationslink genereret!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eInvitationslinket er kun gyldigt for denne email-adresse: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Du har ikke inviteret nogen her endnu. Du kan sende individuelle invitationer eller invitere en masse mennesker på én gang ved at \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003euploade en samlet liste over invitationer\u003c/a\u003e.","text":"Masse invitering fra en fil","uploading":"Uploader...","success":"Fil uploaded successfuldt, du vil blive meddelt via en beskede når processen er fuldendt.","error":"Der var en fejl ved upload af filen '{{filename}}': {{message}}"}},"password":{"title":"Adgangskode","too_short":"Din adgangskode er for kort.","common":"Den adgangskode er for udbredt.","same_as_username":"Dit password er det samme som dit brugernavn.","same_as_email":"Dit password er det samme som din email adresse.","ok":"Din adgangskode ser fin ud.","instructions":"Mindst %{count} tegn"},"summary":{"title":"Resume","stats":"Statistik","top_replies":"Top svar","more_replies":"Flere svar","top_topics":"Top emner","more_topics":"Flere emner","top_badges":"Top badges","more_badges":"Flere badges"},"associated_accounts":"Logins","ip_address":{"title":"Sidste IP-adresse"},"registration_ip_address":{"title":"Registrerings IP adresse"},"avatar":{"title":"Profil Billede","header_title":"profil, beskeder, bogmærker og indstillinger."},"title":{"title":"Titel"},"filters":{"all":"Alle"},"stream":{"posted_by":"Skrevet af","sent_by":"Sendt af","private_message":"besked","the_topic":"emnet"}},"loading":"Indlæser…","errors":{"prev_page":"da vi prøvede at indlæse","reasons":{"network":"Netværksfejl","server":"Server fejl","forbidden":"Adgang nægtet","unknown":"Fejl","not_found":"Side ikke fundet"},"desc":{"network":"Tjek din internetforbindelse.","network_fixed":"Det ser ud som om den er tilbage.","server":"Fejlkode: {{status}}","forbidden":"Du har ikke tilladelser til at se det","not_found":"Ups, programmet forsøgte at indlæse en URL der ikke eksisterer.","unknown":"Noget gik galt."},"buttons":{"back":"Gå tilbage","again":"Prøv igen","fixed":"Indlæs side"}},"close":"Luk","assets_changed_confirm":"Dette site er lige blevet opdateret. Vil du opdatere nu til den seneste version?","logout":"Du er blevet logget ud.","refresh":"Opdater","read_only_mode":{"enabled":"Dette website kan kun læses lige nu. Fortsæt endelig med at kigge, men der kan ikke svares, likes eller andet indtil videre.","login_disabled":"Log in er deaktiveret midlertidigt, da forummet er i \"kun læsnings\" tilstand.","logout_disabled":"Log ud er deaktivere mens websitet kun kan læses."},"too_few_topics_and_posts_notice":"Lad os \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003efå startet denne diskussion!\u003c/a\u003e Der er i øjeblikket \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e emner og \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e indlæg. Nye besøgende har brug for samtaler at læse og svare på.","too_few_topics_notice":"Lad os \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003efå startet denne diskussion !\u003c/a\u003e Der er i øjeblikket \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e emner. Nye besøgende har brug for samtaler at læse og svare på.","too_few_posts_notice":"Lad os \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003efå startet denne diskussion !\u003c/a\u003e Der er i øjeblikket \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e indlæg. Nye besøgende har brug for samtaler at læse og svare på.","learn_more":"Læs mere…","year":"år","year_desc":"Indlæg oprettet i de seneste 365 dage","month":"måned","month_desc":"Indlæg oprettet i de seneste 30 dage","week":"uge","week_desc":"Indlæg oprettet i de seneste 7 dage","day":"dag","first_post":"Første indlæg","mute":"Mute","unmute":"Unmute","last_post":"Sidste indlæg","last_reply_lowercase":"seneste svar","replies_lowercase":{"one":"svar","other":"svar"},"signup_cta":{"sign_up":"Tilmeld dig","hide_session":"Mind mig om det i morgen","hide_forever":"nej tak","hidden_for_session":"OK, jeg spørger dig i morgen. Du kan også altid bruge \"Log på\" til at oprette en konto.","intro":"Hejsa! :heart_eyes: Det ser ud til, at du følger godt med i samtalerne, men du har endnu ikke oprettet en konto.","value_prop":"Når du opretter en konto, så kan vi huske hvad du har læst, så du altid kan fortsætte, hvor du er kommet til. Du får også notifikationer - her og på email - når nye interessante indlæg postes. Og du kan like indlæg og dele begejstringen. :heartbeat:"},"summary":{"enabled_description":"Du ser et sammendrag af dette emne: kun de mest interessante indlæg som andre finder interresante.","description":"Der er \u003cb\u003e{{replyCount}}\u003c/b\u003e svar.","description_time":"Der er \u003cb\u003e{{replyCount}}\u003c/b\u003e svar med en estimeret læsetid på \u003cb\u003e{{readingTime}} minutter\u003c/b\u003e.","enable":"Opsummér dette emne","disable":"Vis alle indlæg"},"deleted_filter":{"enabled_description":"Dette emne indeholder slettede indlæg, som er blevet skjult.","disabled_description":"Slettede indlæg bliver vist. ","enable":"Skjul Slettede Indlæg","disable":"Vis Slettede Indlæg"},"private_message_info":{"title":"Besked","invite":"Invitér andre…","remove_allowed_user":"Ønsker du virkelig at fjerne {{name}} fra denne samtale?"},"email":"E-mail","username":"Brugernavn","last_seen":"Sidst set","created":"Oprettet","created_lowercase":"Oprettet","trust_level":"Tillidsniveau","search_hint":"brugernavn, email eller IP adresse","create_account":{"title":"Opret konto","failed":"Noget gik galt. Måske er e-mail-adressen allerede registreret – prøv “Jeg har glemt min adgangskode”-linket"},"forgot_password":{"title":"Nulstil kodeord","action":"Jeg har glemt min adgangskode","invite":"Skriv brugernavn eller e-mail-adresse, så sender vi dig en mail så du kan nulstille din adgangskode.","reset":"Nulstil adgangskode","complete_username":"Hvis en konto matcher brugernavnet \u003cb\u003e%{username}\u003c/b\u003e, vil du om lidt modtage en email med instruktioner om hvordan man nulstiller passwordet.","complete_email":"Hvis en konto matcher \u003cb\u003e%{email}\u003c/b\u003e, vil du om lidt modtage en email med instruktioner om hvordan man nulstiller passwordet.","complete_username_found":"Vi fandt en konto der svarer til brugernavnet \u003cb\u003e%{username}\u003c/b\u003e, du burde i løbet af kort tid modtage en e-mail med instruktioner om hvordan du nulstiller din adgangskode.","complete_email_found":"Vi har fundet en konto der svarer til \u003cb\u003e%{email}\u003c/b\u003e, du burde i løbet af kort tid modtage en e-mail med instruktioner om hvordan du nulstiller din adgangskode.","complete_username_not_found":"Ingen kontoer passer til brugernavnet \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Ingen kontoer svarer til \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Log ind","username":"Bruger","password":"Adgangskode","email_placeholder":"e-mail eller brugernavn","caps_lock_warning":"Caps Lock er sat til","error":"Ukendt fejl","rate_limit":"Vent venligst, før du prøver at logge på igen.","blank_username_or_password":"Skriv din email adresse eller brugernavn og dit password","reset_password":"Nulstil adgangskode","logging_in":"Logger ind...","or":"Eller","authenticating":"Logger ind…","awaiting_confirmation":"Din konto mangler at blive aktiveret. Brug “Jeg har glemt min adgangskode”-linket for at få en ny aktiverings-mail.","awaiting_approval":"Din konto er ikke blevet godkendt af en moderator endnu. Du får en e-mail når den bliver godkendt.","requires_invite":"Beklager, det kræve en invitation at blive medlem af dette forum.","not_activated":"Du kan ikke logge ind endnu. Vi har tidligere sendt en aktiverings-e-mail til dig på \u003cb\u003e{{sentTo}}\u003c/b\u003e. Følg venligst instruktionerne i den e-mail for at aktivere din konto.","not_allowed_from_ip_address":"Du kan ikke logge ind fra den IP adresse.","admin_not_allowed_from_ip_address":"Du kan ikke logge på som administrator fra denne IP adresse.","resend_activation_email":"Klik her for at sende aktiverings-e-mail’en igen.","sent_activation_email_again":"Vi har sendt endnu en aktiverings-e-mail til dig på \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Det kan tage nogen få minutter før den når frem; kontrollér også din spam-mappe.","to_continue":"Log venligst ind","preferences":"Du skal være logget ind for at ændre præferencer.","forgot":"Jeg kan ikke huske min kontos detaljer","google":{"title":"med Google","message":"Logger ind med Google (kontrollér at pop-op-blokering ikke er aktiv)"},"google_oauth2":{"title":"med google","message":"Validering med Google (vær sikker på at pop up blokeringer er slået fra)"},"twitter":{"title":"med Twitter","message":"Logger ind med Twitter (kontrollér at pop-op-blokering ikke er aktiv)"},"instagram":{"title":"med Instagram","message":"Validering med Instagram (vær sikker på at pop-up blokering ikke er slået til)"},"facebook":{"title":"med Facebook","message":"Logger ind med Facebook (kontrollér at pop-op-blokering ikke er aktiv)"},"yahoo":{"title":"med Yahoo","message":"Logger ind med Yahoo (kontrollér at pop-op-blokering ikke er aktiv)"},"github":{"title":"med GitHub","message":"Logger ind med GitHub (kontrollér at pop-op-blokering ikke er aktiv)"}},"shortcut_modifier_key":{"shift":"Skift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"mere...","options":"Indstillinger","whisper":"hvisken","add_warning":"Dette er en officiel advarsel.","toggle_whisper":"Slå hvisken til/fra","posting_not_on_topic":"Hvilket emne vil du svare på?","saving_draft_tip":"gemmer...","saved_draft_tip":"gemt","saved_local_draft_tip":"gemt lokalt","similar_topics":"Dit emne minder om…","drafts_offline":"kladder offline","error":{"title_missing":"Titlen er påkrævet","title_too_short":"Titlen skal være på mindst {{min}} tegn","title_too_long":"Titlen skal være kortere end {{max}} tegn.","post_missing":"Indlægget kan ikke være tomt.","post_length":"Indlægget skal være på mindst {{min}} tegn.","try_like":"Har du prøvet \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e knappen?","category_missing":"Du skal vælge en kategori."},"save_edit":"Gem ændringer","reply_original":"Svar til det oprindelige emne","reply_here":"Svar her","reply":"Svar","cancel":"Annullér","create_topic":"Opret emne","create_pm":"Besked","title":"Eller tryk Ctrl+Enter","users_placeholder":"Tilføj bruger","title_placeholder":"Hvad handler diskussionen om i korte træk?","edit_reason_placeholder":"hvorfor redigerer du?","show_edit_reason":"(tilføj en begrundelse for ændringen)","reply_placeholder":"Skriv her. Brug Markdown, BBCode eller HTML til at formattere. Træk eller indsæt billeder.","view_new_post":"Se dit nye indlæg.","saving":"Gemmer.","saved":"Gemt!","saved_draft":"Kladde i gang. Vælg for at fortsætte med den.","uploading":"Uploader…","show_preview":"forhåndsvisning \u0026raquo;","hide_preview":"\u0026laquo; skjul forhåndsvisning","quote_post_title":"Citér hele indlægget","bold_title":"Fed","bold_text":"fed skrift","italic_title":"Kursiv","italic_text":"kursiv skrift","link_title":"Link","link_description":"skriv linkets beskrivelse her","link_dialog_title":"Indsæt link","link_optional_text":"evt. titel","quote_title":"Citatblok","quote_text":"Citatblok","code_title":"Præformateret tekst","code_text":"indryk præformateret tekst med 4 mellemrum","upload_title":"Billede","upload_description":"skriv billedets beskrivelse her","olist_title":"Nummereret liste","ulist_title":"Punktopstilling","list_item":"Listepunkt","heading_title":"Overskrift","heading_text":"Overskrift","hr_title":"Vandret streg","help":"Hjælp til Markdown-redigering","toggler":"skjul eller vis editor-panelet","modal_ok":"OK","modal_cancel":"Annuller","cant_send_pm":"Beklager, du kan ikke sende en besked til %{username}.","admin_options_title":"Valgfrie staff-indstillinger for dette emne","auto_close":{"label":"Tidspunkt for automatisk lukning af emne:","error":"Indtast venligst en gyldig værdi","based_on_last_post":"Luk ikke før det seneste indlæg i emnet er mindst så gammel.","all":{"examples":"Indtast et antal timer (24), et bestemt tidspunkt (17:30) eller et tidsstempel (2013-11-22 14:00)."},"limited":{"units":"(# timer)","examples":"Indtast antal timer (24)."}}},"notifications":{"title":"notifikationer ved @navns nævnelse, svar på dine indlæg og emner, beskeder, mv.","none":"Ikke i stand til at indlæse notifikationer for tiden.","more":"se ældre notifikationer","total_flagged":"total markerede indlæg","mentioned":"\u003ci title='nævnte' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='citeret' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='svaret' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='redigeret' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='privat besked' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='privat besked' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='inviteret til emne' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepterede din invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='indlæg flyttet' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge givet' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eDu blev tildelt '{{description}}'\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='beskeder i din gruppes indbakke' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} besked i din {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='beskeder i gruppens indbakke' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} beskeder i din {{group_name}} inbox\u003c/p\u003e"},"alt":{"mentioned":"Nævnt af","quoted":"Citeret af","replied":"Svaret","posted":"Indlæg af","edited":"Rediger dit indlæg af","liked":"Likede dit indlæg","private_message":"Privat besked fra","invited_to_private_message":"Inviteret til en privat besked fra","invited_to_topic":"Inviteret til et indlæg fra","invitee_accepted":"Invitation accepteret af","moved_post":"Dit indlæg blev flyttet af","linked":"Link til dit indlæg","granted_badge":"Badge tildelt","group_message_summary":"Besker i gruppens indbakke"},"popup":{"mentioned":"{{username}} nævnte dig i \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} nævnte dig i \"{{topic}}\" - {{site_title}}","quoted":"{{username}} citerede dig i \"{{topic}}\" - {{site_title}}","replied":"{{username}} svarede dig i \"{{topic}}\" - {{site_title}}","posted":"{{username}} skrev i \"{{topic}}\" - {{site_title}}","private_message":"{{username}} sendte dig en privat besked i \"{{topic}}\" - {{site_title}}","linked":"{{username}} linkede til dit indlæg fra \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Indsæt billede","title_with_attachments":"Tilføj et billede eller en fil","from_my_computer":"Fra min computer","from_the_web":"Fra nettet","remote_tip":"link til billede","remote_tip_with_attachments":"link til billede eller fil {{authorized_extensions}}","local_tip":"vælg billeder fra din enhed","local_tip_with_attachments":"vælg billeder eller filer fra din enhed {{authorized_extensions}}","hint":"(du kan også trække og slippe ind i editoren for at uploade dem)","hint_for_supported_browsers":"du kan også bruge træk-og-slip eller indsætte billeder i editoren","uploading":"Uploader billede","select_file":"Vælg fil","image_link":"link som dit billede vil pege på"},"search":{"sort_by":"Sorter efter","relevance":"Relevans","latest_post":"Seneste indlæg","most_viewed":"Mest sete","most_liked":"Mest likede","select_all":"Vælg alle","clear_all":"Ryd alle","result_count":{"one":"1 resultat for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} reultater for \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"søg efter emner, indlæg, brugere eller kategorier","no_results":"Ingen resultater fundet.","no_more_results":"Ikke flere resultater.","search_help":"Hjælp til søgning","searching":"Søger…","post_format":"#{{post_number}} af {{username}}","context":{"user":"Søg i indlæg fra @{{username}}","topic":"Søg i dette emne","private_messages":"Søg i beskeder"}},"hamburger_menu":"gå til en anden emneliste eller kategori","new_item":"ny","go_back":"gå tilbage","not_logged_in_user":"bruger side, med oversigt over aktivitet og indstillinger","current_user":"gå til brugerside","topics":{"bulk":{"unlist_topics":"Fjern emner fra liste","reset_read":"Nulstil \"læst\"","delete":"Slet emner","dismiss":"Afvis","dismiss_read":"Afvis alle ulæste","dismiss_button":"Afvis...","dismiss_tooltip":"Afvis kun nye indlæg eller stop med at følge emner","also_dismiss_topics":"Stop med at følge disse emner så de aldrig mere kommer op som ulæste igen","dismiss_new":"Afvis nye","toggle":"vælg flere emner af gangen","actions":"Handlinger på flere indlæg","change_category":"Skift kategori","close_topics":"Luk indlæg","archive_topics":"Arkiver Emner","notification_level":"Skift niveau for underetninger","choose_new_category":"Vælg den nye kategori for emnerne:","selected":{"one":"Du har valgt \u003cb\u003e1\u003c/b\u003e indlæg.","other":"Du har valgt \u003cb\u003e{{count}}\u003c/b\u003e indlæg."}},"none":{"unread":"Du har ingen ulæste emner.","new":"Du har ingen nye emner.","read":"Du har ikke læst nogen emner endnu.","posted":"Du har ikke skrevet nogen indlæg endnu.","latest":"Der er ikke nogen nye emner. Det er sørgeligt.","hot":"Der er ingen populære emner.","bookmarks":"Du har ingen bogmærkede emner endnu.","category":"Der er ingen emner i kategorien {{category}}.","top":"Der er ingen top emner","search":"Der er ingen søgeresultater."},"bottom":{"latest":"Der er ikke flere populære emner.","hot":"There are no more hot topics.","posted":"Der er ikke flere emner.","read":"Der er ikke flere læste emner.","new":"Der er ikke flere nye emner.","unread":"Der er ikke flere ulæste emner.","category":"Der er ikke flere emner i kategorien {{category}}.","top":"Der er ikke flere top emner","bookmarks":"Der er ikke flere bogmærkede emner.","search":"Der er ikke flere søgeresultater."}},"topic":{"unsubscribe":{"stop_notifications":"Du vil nu modtage færre notifikationer for \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Din nuværende notifikationstilstand er"},"create":"Nyt emne","create_long":"Opret et nyt emne i debatten","private_message":"Start en besked","archive_message":{"help":"Flyt beskeder til dit arkiv","title":"Arkiv"},"move_to_inbox":{"title":"Flyt til Indbakke","help":"Flyt beskeder tilbage til Indbakke"},"list":"Emner","new":"nyt emne","unread":"ulæste","new_topics":{"one":"1 nyt emne","other":"{{count}} nye emner"},"unread_topics":{"one":"1 ulæst emne","other":"{{count}} ulæste emner"},"title":"Emne","invalid_access":{"title":"Emnet er privat","description":"Beklager, du har ikke adgang til dette emne!","login_required":"Do skal logge på for at se dette emne."},"server_error":{"title":"Emnet kunne ikke indlæses","description":"Beklager, vi kunne ikke indlæse det emne, muligvis grundet et problem med netværksforbindelsen. Prøv venligst igen. Hvis problemet fortæstter, så skriv venligst til os."},"not_found":{"title":"Emnet findes ikke","description":"Beklager, vi kunne ikke finde det emne i databasen. Måske er det blevet fjernet af moderator?"},"total_unread_posts":{"one":"der er {{count}} indlæg du ikke har læst i dette emne","other":"der er {{count}} indlæg du ikke har læst i dette emne"},"unread_posts":{"one":"der er 1 indlæg du ikke har læst i dette emne","other":"der er {{count}} indlæg du ikke har læst i dette emne"},"new_posts":{"one":"der er kommet 1 nyt indlæg i dette emne siden du læste det sidst","other":"der er kommet {{count}} nye indlæg i dette emne siden du læste det sidst"},"likes":{"one":"der er ét like i dette emne","other":"der er {{count}} likes i dette emne"},"back_to_list":"Tilbage til emneoversigt","options":"Emneindstillinger","show_links":"vis links i dette emne","toggle_information":"vis detaljer om emnet","read_more_in_category":"Mere læsestof? Se andre emner i {{catLink}} eller {{latestLink}}.","read_more":"Mere læsestof? {{catLink}} eller {{latestLink}}.","browse_all_categories":"Vis alle kategorier","view_latest_topics":"vis seneste emner","suggest_create_topic":"Hvorfor ikke oprette et emne?","jump_reply_up":"hop til tidligere svar","jump_reply_down":"hop til senere svar","deleted":"Emnet er blevet slettet","auto_close_notice":"Dette emne lukker automatisk %{timeLeft}.","auto_close_notice_based_on_last_post":"Dette emne vil lukke %{duration} efter det sidste svar.","auto_close_title":"Indstillinger for automatisk lukning","auto_close_save":"Gem","auto_close_remove":"Luk ikke dette emne automatisk","progress":{"title":"emnestatus","go_top":"top","go_bottom":"bund","go":"start","jump_bottom":"Hop til sidste indlæg","jump_bottom_with_number":"hop til indlæg %{post_number}","total":"antal indlæg","current":"nuværende indlæg"},"notifications":{"reasons":{"3_6":"Du får notifikationer fordi du overvåger denne kategori.","3_5":"Du får notifikationer fordi du overvåger dette emne automatisk.","3_2":"Du får notifikationer fordi du overvåger dette emne.","3_1":"Du får notifikationer fordi du oprettede dette emne.","3":"Du får notifikationer fordi du overvåger dette emne.","2_8":"Du får notifikationer fordi du følger dette kategori.","2_4":"Du får notifikationer fordi du har besvaret dette emne.","2_2":"Du får notifikationer fordi du følger dette emne.","2":"Du får notifikationer fordi du \u003ca href=\"/users/{{username}}/preferences\"\u003ehar læst dette emne\u003c/a\u003e.","1_2":"Du vil modtage en notifikation hvis nogen nævner dit @name eller svarer dig.","1":"Du vil modtage en notifikation hvis nogen nævner dit @name eller svarer dig.","0_7":"Du ignorerer alle notifikationer i denne kategori.","0_2":"Du får ingen notifikationer for dette emne.","0":"Du får ingen notifikationer for dette emne."},"watching_pm":{"title":"Følger","description":"Du vil modtage en notifikation for hvert nyt svar i denne besked, og en optælling af nye svar vil blive vist."},"watching":{"title":"Overvåger","description":"Du vil modtage en notifikation for hvert nyt svar i denne tråd, og en optælling af nye svar vil blive vist."},"tracking_pm":{"title":"Følger","description":"En optælling af nye svar vil blive vist for denne besked. Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"tracking":{"title":"Følger","description":"En optælling af nye svar vil blive vist for denne tråd. Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"regular":{"title":"Normal","description":"Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"regular_pm":{"title":"Normal","description":"Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"muted_pm":{"title":"Lydløs","description":"Du vil aldrig få notifikationer om denne besked."},"muted":{"title":"Stille!","description":"Du vil aldrig få beskeder om noget i indlæggene og de vil ikke vises i seneste."}},"actions":{"recover":"Gendan emne","delete":"Slet emne","open":"Åbn emne","close":"Luk emne","multi_select":"Vælg indlæg...","auto_close":"Luk automatisk...","pin":"Fastgør Emne...","unpin":"Fjern fastgøring af Emne...","unarchive":"Gendan emne fra arkiv","archive":"Arkivér emne","invisible":"Gør ulistet","visible":"Går listet","reset_read":"Glem hvilke emner jeg har læst"},"feature":{"pin":"Fastgør Emne","unpin":"Fjern Fastgøring af Emne","pin_globally":"Fastgør emne globalt","make_banner":"Gør emnet til en banner","remove_banner":"Emnet skal ikke være banner længere"},"reply":{"title":"Svar","help":"begynd at skrive et svar til dette emne"},"clear_pin":{"title":"Fjern tegnestift","help":"Fjern tegnestiften på dette emne så det ikke længere vises i toppen af emnelisten"},"share":{"title":"Del","help":"del et link til dette emne"},"flag_topic":{"title":"Rapportér indlæg","help":"gør moderator opmærksom på dette indlæg","success_message":"Du har nu rapporteret dette emne til administrator."},"feature_topic":{"title":"Fremhæv dette emne","pin":"Fastgør dette emne til toppen af kategorien {{categoryLink}} indtil","confirm_pin":"Du har allerede {{count}} fastgjorte emner. Fastgjorte emner kan være irriterende for nye og anonyme brugere. Er du sikker på du vil fastgøre et nyt emne i denne kategori?","unpin":"Fjern dette emne fra starten af listen i  {{categoryLink}} kategorien.","unpin_until":"Fjern dette emne fra toppen af kategorien {{categoryLink}} eller vent til \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Brugere kan unpinne emnet individuelt.","pin_validation":"Der skal angives en dato for at fastgøre dette emne","not_pinned":"Der er ingen fastgjorte emner i {{categoryLink}}.","already_pinned":{"one":"Emner fastgjort i {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Emner fastgjort i {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Fastgør dette emne til toppen af alle emnelister indtil","confirm_pin_globally":"Du har allerede {{count}} globalt fastgjorte emner. For mange fastgjorte emner kan være irriterende for nye og anonyme brugere. Er du sikker på du vil fastgøre et emne mere globalt?","unpin_globally":"Fjern dette emne fra toppen af alle emne lister.","unpin_globally_until":"Fjern dette emne fra toppen af alle emnelister eller vent til \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Brugere kan unpinne emnet individuelt.","not_pinned_globally":"Der er ingen globalt fastgjorte emner.","already_pinned_globally":{"one":"Globalt fastgjorte emner: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Globalt fastgjorte emner: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Gør dette emne til en banner, der kommer til at stå i toppen på alle sider.","remove_banner":"Fjern banneret, der står på toppen af alle sider.","banner_note":"Brugere kan fjernet banneret ved at lukke det. Kun én banner kan være aktiv ad gangen.","no_banner_exists":"Der er ikke noget banner-emne.","banner_exists":"Der \u003cstrong class='badge badge-notification unread'\u003eer\u003c/strong\u003e aktuelt et banner-emne."},"inviting":"Inviterer…","invite_private":{"title":"Inviter til besked","email_or_username":"Inviteret brugers e-mail eller brugernavn","email_or_username_placeholder":"e-mail-adresse eller brugernavn","action":"Invitér","success":"Vi har inviteret denne bruger til at være med i denne besked.","error":"Beklager, der skete en fejl, da vi forsøgte at invitere brugeren.","group_name":"gruppe navn"},"controls":"Emnestyring","invite_reply":{"title":"Invitér","username_placeholder":"brugernavn","action":"Send invitation","help":"inviter andre til dette emne via email eller notifikationer","to_forum":"Vi sender din ven en kort e-mail, som gør det muligt at tilmelde sig øjeblikkeligt ved at klikke på et link, uden det er nødvendigt at logge ind.","sso_enabled":"Indtast brugernavnet på den person, du gerne vil invitere til dette emne.","to_topic_blank":"Indtast brugernavnet eller en email adresse på den person, du gerne vil invitere til dette emne.","to_topic_email":"Du har indtastet en email adresse. Vi vil sende en e-mail invitation, der giver din ven direkte adgang til at svare på dette emne.","to_topic_username":"Du har indtastet et brugernavn. Vi sender en notifikation med en invitation til denne tråd.","to_username":"Indtast brugernavnet på den person du vil invitere. Vi sender en notifikation med et link til denne tråd.","email_placeholder":"e-mail-adresse","success_email":"Vi har e-mailet en invitation til \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Vi notificerer dig, når invitationen er blevet accepteret. Kig på invitations fanebladet på din bruger side for at se status på dine invitationer.","success_username":"Vi har inviteret brugeren til at deltage i dette emne.","error":"Beklager, vi kunne ikke invitere denne person. Måske er de allerede inviteret? (der er begrænsning på hvor mange gange man kan invitere en person)"},"login_reply":"Log ind for at svare","filters":{"n_posts":{"one":"1 indlæg","other":"{{count}} indlæg"},"cancel":"Fjern filter"},"split_topic":{"title":"Flyt til nyt emne","action":"flyt til nyt emne","topic_name":"Navn på nyt emne","error":"Der opstod en fejl under flytningen af indlæg til det nye emne.","instructions":{"one":"Du er ved at oprette et nyt emne med det valgte indlæg.","other":"Du er ved at oprette et nyt emne med de \u003cb\u003e{{count}}\u003c/b\u003e valgte indlæg."}},"merge_topic":{"title":"Flyt til eksisterende emne","action":"flyt til eksisterende emne","error":"Der opstod en fejl under flytningen af indlæg til emnet.","instructions":{"one":"Vælg venligst det emne som indlægget skal flyttes til.","other":"Vælg venligst det emne som de  \u003cb\u003e{{count}}\u003c/b\u003e indlæg skal flyttes til."}},"change_owner":{"title":"Skift hvem der ejer emnet","action":"skift ejerskab","error":"Der opstod en fejl da ejerskabet skulle skiftes.","label":"Ny ejer af emner","placeholder":"brugernavn på ny ejer","instructions":{"one":"Vælg den nye ejer af indlægget, oprindeligt skrevet af \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Vælg den nye ejer af {{count}} indlæg, oprindeligt skrevet af \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Bemærk at tidligere notifikationer på dette emne vil ikke blive overført til den nye bruger.\n\u003cbr\u003eAdvarsel: På nuværende tidspunkt, vil ingen data der er afhængig af dette indlæg blive overført til den nye bruger. Brug forsigtigt."},"change_timestamp":{"title":"Ret tidsstempel","action":"ret tidsstempel","invalid_timestamp":"Tidsstempel kan ikke være i fremtiden","error":"Der opstod en fejl under rettelsen af tidsstemplet for dette emne.","instructions":"Vælg venligst det nye tidsstempel for dette emne. Indlæg under emnet vil blive opdateret så de har samme tidsforskel."},"multi_select":{"select":"vælg","selected":"valgt ({{count}})","select_replies":"vælg +svar","delete":"slet valgte","cancel":"glem valg","select_all":"marker alle","deselect_all":"marker ingen","description":{"one":"Du har valgt \u003cb\u003e1\u003c/b\u003e indlæg.","other":"Du har valgt \u003cb\u003e{{count}}\u003c/b\u003e indlæg."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"citér svar","edit":"Redigerer {{link}} {{replyAvatar}} {{username}}","edit_reason":"Reason: ","post_number":"indlæg {{number}}","last_edited_on":"indlæg sidst redigeret den","reply_as_new_topic":"Svar som linket emne","continue_discussion":"Fortsætter debatten fra {{postLink}}:","follow_quote":"gå til det citerede indlæg","show_full":"Vis hele emnet","show_hidden":"Vist skjult indhold.","deleted_by_author":{"one":"(indlæg trukket tilbage af forfatteren, slettes automatisk om %{count} time med mindre det bliver flaget)","other":"(indlæg trukket tilbage af forfatteren, slettes automatisk om %{count} timer med mindre det bliver flaget)"},"expand_collapse":"fold ud/ind","gap":{"one":"se 1 udeladt indlæg ","other":"se {{count}} udeladte indlæg "},"unread":"Indlæg er ulæst","has_replies":{"one":"{{count}} svar","other":"{{count}} svar"},"has_likes":{"one":"{{count}} like","other":"{{count}} likes"},"has_likes_title":{"one":"1 likede dette indlæg","other":"{{count}} likede dette indlæg"},"has_likes_title_only_you":"du likede dette indlæg","has_likes_title_you":{"one":"du og 1 anden likede dette indlæg","other":"du og {{count}} andre likede dette indlæg"},"errors":{"create":"Beklager, der opstod en fejl under oprettelsen af dit indlæg. Prøv venligst igen.","edit":"Beklager, der opstrod en fejl under redigeringen af dit indlæg. Prøv venligst igen.","upload":"Beklager, der opstod en fejl ved upload af filen. Prøv venligst igen.","too_many_uploads":"Beklager, men du kan kun uploade én fil ad gangen.","upload_not_authorized":"Beklager, filen, som du forsøger at uploade, er ikke godkendt (godkendte filendelser: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Beklager, nye brugere kan ikke uploade billeder.","attachment_upload_not_allowed_for_new_user":"Beklager, nye brugere kan ikke uploade vedhæftede filer.","attachment_download_requires_login":"Beklager, du skal være logget på for at downloade vedhæftede filer."},"abandon":{"confirm":"Er du sikker på, at du vil droppe dit indlæg?","no_value":"Nej","yes_value":"Ja"},"via_email":"dette indlæg blev oprettet via email","whisper":"dette indlæg er en privat hvisken for moderatorer","wiki":{"about":"dette indlæg er en wiki"},"archetypes":{"save":"Gem indstillinger"},"few_likes_left":"Tak fordi du liker! Du har kun få likes tilbage i dag.","controls":{"reply":"begynd at skrive et svar på dette indlæg","like":"like dette indlæg","has_liked":"Du liker dette indlæg","undo_like":"fortryd like","edit":"redigér dette indlæg","edit_anonymous":"Beklager, du skal være logget ind for at redigere dette indlæg.","flag":"gør moderator opmærksom på dette indlæg","delete":"slet dette indlæg","undelete":"annullér sletning","share":"del et link til dette indlæg","more":"Mere","delete_replies":{"confirm":{"one":"Ønsker du også at slette svaret på dette indlæg?","other":"Ønsker du også at slette de {{count}} svar på dette indlæg?"},"yes_value":"Ja, slet også svarene","no_value":"Nej, kun dette indlæg"},"admin":"indlæg administrator handlinger","wiki":"Opret Wiki","unwiki":"Fjern Wiki","convert_to_moderator":"Tilføj Personale farve","revert_to_regular":"Fjern Personale farve","rebake":"Gendan HTML","unhide":"Vis","change_owner":"Skift ejerskab"},"actions":{"flag":"Flag","defer_flags":{"one":"Udsæt markering","other":"Udsæt markeringer"},"undo":{"off_topic":"Undo flag","spam":"Undo flag","inappropriate":"Undo flag","bookmark":"Undo bookmark","like":"Undo like","vote":"Undo vote"},"people":{"off_topic":"markerede dette som off-topic","spam":"markerede dette som spam","inappropriate":"markerede dette som upassende","notify_moderators":"informerede moderatorer","notify_user":"sendte en besked","bookmark":"bogmærkede dette","like":"likede dette","vote":"stemte for dette"},"by_you":{"off_topic":"Du flagede dette som off-topic","spam":"Du flagede dette som spam","inappropriate":"Du flagede dette som upassende","notify_moderators":"Du flagede dette til gennemsyn","notify_user":"Du har sendt en besked til denne bruger","bookmark":"Du bogmærkede dette indlæg","like":"Du liker dette indlæg","vote":"Du stemte for dette indlæg"},"by_you_and_others":{"off_topic":{"one":"Du og 1 anden flagede dette som off-topic","other":"Du og {{count}} andre flagede dette som off-topic"},"spam":{"one":"Du og 1 anden flagede dette som spam","other":"Du og {{count}} andre flagede dette som spam"},"inappropriate":{"one":"Du og 1 anden flagede dettes om upasende","other":"Du og {{count}} andre flagede dettes om upasende"},"notify_moderators":{"one":"Du og 1 anden flagede dette til moderation","other":"Du og {{count}} andre flagede dette til moderation"},"notify_user":{"one":"Dig og en anden har sendt en besked til denne bruger","other":"Dig og {{count}} andre har sendt en besked til denne bruger"},"bookmark":{"one":"Du og 1 anden bogmærkede dette indlæg","other":"Du og {{count}} andre bogmærkede dette indlæg"},"like":{"one":"Du og 1 anden liker dette","other":"Du og {{count}} andre liker dette"},"vote":{"one":"Du og 1 anden stemte for dette indlæg","other":"Du og {{count}} andre stemte for dette indlæg"}},"by_others":{"off_topic":{"one":"1 person flagede dette som off-topic","other":"{{count}} personer flagede dette som off-topic"},"spam":{"one":"1 person flagede dette som spam","other":"{{count}} personer flagede dette som spam"},"inappropriate":{"one":"1 person flagede dette som upassende","other":"{{count}} personer flagede dette som upassende"},"notify_moderators":{"one":"1 person flagede dette til moderation","other":"{{count}} personer flagede dette til moderation"},"notify_user":{"one":"1 person har sendt en besked til denne bruger","other":"{{count}} har sendt en besked til denne bruger"},"bookmark":{"one":"1 person bogmærkede dette indlæg","other":"{{count}} personer bogmærkede dette indlæg"},"like":{"one":"1 person liker dette","other":"{{count}} personer liker dette"},"vote":{"one":"1 person stemte for dette indlæg","other":"{{count}} personer stemte for dette indlæg"}}},"delete":{"confirm":{"one":"Er du sikker på, at du vil slette indlægget?","other":"Er du sikker på, at du vil slette alle de valgte indlæg?"}},"revisions":{"controls":{"first":"Første udgave","previous":"Forrige udgave","next":"Næste udgave","last":"Sidste udgave","hide":"Skjul udgave","show":"Vis udgave","revert":"Gå tilbage til denne udgave","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Vis det renderede output med tilføjelser og ændringer indlejret","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Vis de renderede output-diffs ved siden af hinanden","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Vis forskellen på den rå kildekode side om side","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Kildekode"}}}},"category":{"can":"kan\u0026hellip; ","none":"(ingen kategori)","all":"Alle kategorier","choose":"Vælg en kategori\u0026hellip;","edit":"redigér","edit_long":"Redigér","view":"Vis emner i kategori","general":"Overordnet","settings":"Indstillinger","topic_template":"Skabelon for emne","delete":"Slet kategori","create":"Ny kategori","create_long":"Opret en ny kategori","save":"Gem kategori","slug":"Kategori simpelt navn","slug_placeholder":"(Valgfri) gennemstregede-ord for URL","creation_error":"Der opstod en fejl under oprettelsen af kategorien.","save_error":"Der opstod en fejl da kategorien skulle gemmes.","name":"Kategorinavn","description":"Beskrivelse","topic":"kategoriemne","logo":"Kategori logo billede","background_image":"Kategori logo baggrundsbillede","badge_colors":"Mærkefarver","background_color":"Baggrundsfarve","foreground_color":"Tekstfarve","name_placeholder":"Bør være kort og kontant.","color_placeholder":"En web-farve","delete_confirm":"Er du sikker på, at du vil slette den kategori?","delete_error":"Der opstod en fejl ved sletning af kategorien.","list":"Kategoriliste","no_description":"Der er ingen beskrivelse for denne kategori.","change_in_category_topic":"besøg kategoriemnet for at redigere beskrivelsen","already_used":"This color has been used by another category","security":"Sikkerhed","special_warning":"Advarsel: Denne kategori er forud-seedet og sikkerhedsindstillingerne kan ikke redigeres. Hvis du ikke ønsker at bruge denne kategori, bør du slette den snarere end at genbruge den til et andet formål.","images":"Billeder","auto_close_label":"Luk automatisk emner efter:","auto_close_units":"timer","email_in":"Brugerindstillet ingående email adresse:","email_in_allow_strangers":"Accepter emails fra ikke oprettede brugere","email_in_disabled":"Nye emner via email er deaktiveret i Site opsætning. For at aktivere oprettelse af nye emner via email,","email_in_disabled_click":"aktiver \"email ind\" indstilligen.","suppress_from_homepage":"Undertryk denne kategori fra hjemmesiden","allow_badges_label":"Tillad af badges bliver tildelt i denne kategori","edit_permissions":"Redigér tilladelser","add_permission":"Tilføj tilladelse","this_year":"dette år","position":"position","default_position":"Standarposition","position_disabled":"Kategorier vil blive vist i rækkefølge efter aktivitet. For at styre rækkefølgen af kategorier i lister, ","position_disabled_click":"skal funktionen \"fikserede kategori positioner\" slås til.","parent":"Overordnet kategori","notifications":{"watching":{"title":"Overvåger","description":"Du overvåger automatisk alle emner i disse kategorier. Du får besked om hvert nyt indlæg i hvert emne og antallet af nye svar bliver vist."},"tracking":{"title":"Følger","description":"Du tracker automatisk alle emner i disse kategorier. Du får besked hvis nogen nævner dit @navn eller svarer dig, og antallet af nye svar bliver vist."},"regular":{"title":"Normal","description":"Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"muted":{"title":"Ignoreret","description":"Du vil aldrig få besked om noget om nye emner i kategorierne og de vises heller ikke i seneste."}}},"flagging":{"title":"Tak fordi du hjælper med at holde vores forum civiliseret!","action":"Flag indlæg","take_action":"Reagér","notify_action":"Besked","delete_spammer":"Slet spammer","yes_delete_spammer":"Ja, slet spammer","ip_address_missing":"(Ikke tilgængelig)","hidden_email_address":"(skjult)","submit_tooltip":"Send privat markeringen","take_action_tooltip":"Nå til markerings niveauer med det samme, i stedet for at vente på flere markeringer fra fælleskabet","cant":"Beklager, du kan i øjeblikket ikke flage dette indlæg.","notify_staff":"Informer staff privat","formatted_name":{"off_topic":"Det holder sig ikke til emnet","inappropriate":"Det er upassende","spam":"Det er spam"},"custom_placeholder_notify_user":"Vær præcis, vær kontruktiv og vær altid venlig.","custom_placeholder_notify_moderators":"Lad os vide præcis hvad du er bekymret over og giv relevante links og eksempler hvor det er muligt."},"flagging_topic":{"title":"Tak fordi du hjælper med at holde vores forum civiliseret!","action":"Rapporter emne","notify_action":"Besked"},"topic_map":{"title":"Emne-resumé","participants_title":"Hyppige forfattere","links_title":"Populære Links","clicks":{"one":"1 klik","other":"%{count} klik"}},"topic_statuses":{"warning":{"help":"Dette er en officiel advarsel."},"bookmarked":{"help":"Du har bogmærket dette emne"},"locked":{"help":"emnet er låst; det modtager ikke flere svar"},"archived":{"help":"emnet er arkiveret; det er frosset og kan ikke ændres"},"locked_and_archived":{"help":"Dette emne er lukket og arkiveret; der kan ikke længere postes nye indlæg, og emner kan ikke ændres."},"unpinned":{"title":"Ikke fastgjort","help":"Dette emne er ikke fastgjort for dig; det vil blive vist i den normale rækkefølge"},"pinned_globally":{"title":"Fastgjort globalt","help":"Dette emne er globalt fastgjort; det vises i toppen af seneste og i dets kategori"},"pinned":{"title":"Fastgjort","help":"Dette emne er fastgjort for dig; det vil blive vist i toppen af dets kategori"},"invisible":{"help":"Dette emne er ulistet; det vil ikke blive vist i listen over emner og kan kun tilgås med et direkte link"}},"posts":"Indlæg","posts_long":"{{number}} indlæg i dette emne","original_post":"Oprindeligt indlæg","views":"Visninger","views_lowercase":{"one":"visning","other":"visninger"},"replies":"Svar","views_long":"dette emne er blevet vist {{number}} gange","activity":"Aktivitet","likes":"Likes","likes_lowercase":{"one":"like","other":"likes"},"likes_long":"der er {{number}} likes i dette emne","users":"Deltagere","users_lowercase":{"one":"bruger","other":"brugere"},"category_title":"Kategori","history":"Historik","changed_by":"af {{author}}","raw_email":{"title":"Email kildekode","not_available":"Ikke tilgængelig!"},"categories_list":"Kategorioversigt","filters":{"with_topics":"%{filter} emner","with_category":"%{filter} %{category} emner","latest":{"title":"Seneste","title_with_count":{"one":"Seneste (1)","other":"Seneste ({{count}})"},"help":"de seneste emner"},"hot":{"title":"Populære","help":"de mest populære emner"},"read":{"title":"Læste","help":"emner du har læst"},"search":{"title":"Søg","help":"søg alle emner"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alle emner grupperet efter kategori"},"unread":{"title":"Ulæst","title_with_count":{"one":"Ulæst (1)","other":"Ulæste ({{count}})"},"help":"emner du følger med i lige nu med ulæste indlæg","lower_title_with_count":{"one":"1 ulæst","other":"{{count}} ulæste"}},"new":{"lower_title_with_count":{"one":"1 ny","other":"{{count}} nye"},"lower_title":"Ny","title":"Nye","title_with_count":{"one":"Nye (1)","other":"Nye ({{count}})"},"help":"Emner oprettet i de seneste par dage"},"posted":{"title":"Mine indlæg","help":"emner du har skrevet indlæg i"},"bookmarks":{"title":"Bogmærker","help":"emner du har bogmærket"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"populære emner i kategorien {{categoryName}}"},"top":{"title":"Top","help":"de mest aktive emner i det sidse år, måned, uge og dag","all":{"title":"Alt"},"yearly":{"title":"Årligt"},"quarterly":{"title":"Kvartalvis"},"monthly":{"title":"Månedligt"},"weekly":{"title":"Ugentligt"},"daily":{"title":"Dagligt"},"all_time":"Alt","this_year":"År","this_quarter":"Kvartal","this_month":"Måned","this_week":"Uge","today":"I dag","other_periods":"se top"}},"browser_update":"Desværre, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003edin browser er for gammel til at kunne virke med dette forum\u003c/a\u003e. \u003ca href=\"http://browsehappy.com\"\u003eOpgradér venligst din browser\u003c/a\u003e.","permission_types":{"full":"Opret / Besvar / Se","create_post":"Besvar / Se","readonly":"Se"},"lightbox":{"download":"download"},"search_help":{"title":"Søg i hjælp"},"keyboard_shortcuts_help":{"title":"Tastaturgenveje","jump_to":{"title":"Hop til","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Hjem","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Seneste","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Ny","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Ulæst","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Kategorier","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bogmærker","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Beskeder"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Gå til indlæg #","back":"\u003cb\u003eu\u003c/b\u003e Tilbage","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Flyt udvalgte \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e eller \u003cb\u003eEnter\u003c/b\u003e Åben det valgte emne","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Næste/Forrige"},"application":{"title":"Applikation","create":"\u003cb\u003ec\u003c/b\u003e Opret nyt emne","notifications":"\u003cb\u003en\u003c/b\u003e Åben notifikationer","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Åben hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Åben bruger menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Vis opdaterede emner","search":"\u003cb\u003e/\u003c/b\u003e Søg","help":"\u003cb\u003e?\u003c/b\u003e Åben tastaturhjælp","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Afvis Nyt/Indlæg","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Afvis emner","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log ud"},"actions":{"title":"Handlinger"}},"tagging":{"selector_no_tags":"ingen mærker","sort_by":"Sortér efter:","sort_by_count":"antal","sort_by_name":"navn","manage_groups":"Håndtér tag grupper","manage_groups_description":"Definér grupper til at håndtere tags","filters":{"without_category":"%{filter} %{tag} emner","with_category":"%{filter} %{tag} emner i %{category}","untagged_without_category":"%{filter} utagged emner","untagged_with_category":"%{filter} utaggede emner i %{category}"},"notifications":{"watching":{"title":"Overvåger","description":"Du vil automatisk overvåge alle emner med dette tag. Du vil blive notificeret om alle nye indlæg og emner. Samtidig vil antallet af ulæste indlæg også vises ved siden af emnet."},"watching_first_post":{"title":"Overvåger første indlæg","description":"Du vil kun blive notificeret om det første indlæg under hvert nyt emne i dette tag."},"tracking":{"title":"Følger","description":"Du vil automatisk følge alle emner i dette tag. Et antal af ulæste og nye indlæg vil vises ved siden af emnet."},"regular":{"description":"Du vil blive notificeret if nogen nævner dit You will be notified if someone mentions your @name or replies to your post."}},"groups":{"title":"Tag grupper","about":"Tilføj tags til grupper for nemmere håndtering.","new":"Ny gruppe","tags_label":"Tags i denne gruppe:","parent_tag_placeholder":"Valgfrit","new_name":"Ny tag gruppe","save":"Gem","delete":"Slet","confirm_delete":"Er du sikker du vil slette denne tag gruppe?"},"topics":{"none":{"unread":"Du har ingen ulæste emner.","new":"Du har ingen nye emner.","read":"Du har ikke læst nogen emner endnu.","posted":"Du har ikke oprettet nogen emner endnu.","latest":"Der er ikke nogen seneste emner.","hot":"Der er ikke nogen populære emner.","bookmarks":"Du har ikke bogmærket nogen emner endnu.","top":"Der er ikke nogen populære emner.","search":"Der er ikke nogen søgeresultater."},"bottom":{"latest":"Der er ikke flere seneste emner.","hot":"Der er ikke flere populære emner.","posted":"Der er ikke flere oprettede emner.","read":"Der er ikke flere læste emner.","new":"Der er ikke flere nye emner.","unread":"Der er ikke flere ulæste emner.","top":"Der er ikke flere populære emner.","bookmarks":"Der er ikke flere bogmærkede emner.","search":"Der er ikke flere søgeresultater."}}},"invite":{"custom_message":"Gør din invitation lidt mere personlig ved at skrive en ","custom_message_link":"personlig besked","custom_message_placeholder":"Skriv en personlig besked","custom_message_template_forum":"Hej, du burde tilmelde dig dette forum!","custom_message_template_topic":"Hej, jeg tænkte du måske ville synes om dette emne!"},"poll":{"voters":{"one":"vælger","other":"vælgere"},"total_votes":{"one":"afgiven stemme","other":"afgivne stemmer"},"average_rating":"Gennemsnitlig rating: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Stemmer er offentlige."},"multiple":{"help":{"at_least_min_options":{"one":"Vælg mindst \u003cstrong\u003e1\u003c/strong\u003e mulighed","other":"Vælg mindst \u003cstrong\u003e%{count}\u003c/strong\u003e muligheder"},"up_to_max_options":{"one":"Vælg op til \u003cstrong\u003e1\u003c/strong\u003e mulighed","other":"Vælg op til \u003cstrong\u003e%{count}\u003c/strong\u003e muligheder"},"x_options":{"one":"Vælg \u003cstrong\u003e1\u003c/strong\u003e mulighed","other":"Vælg \u003cstrong\u003e%{count}\u003c/strong\u003e muligheder"},"between_min_and_max_options":"Vælg imellem \u003cstrong\u003e%{min}\u003c/strong\u003e og \u003cstrong\u003e%{max}\u003c/strong\u003e valgmuligheder"}},"cast-votes":{"title":"Afgiv dine stemmer","label":"Stem nu!"},"show-results":{"title":"Vis afstemningsresultat","label":"Vis resultat"},"hide-results":{"title":"Tilbage til dine stemmer","label":"Skjul resultat"},"open":{"title":"Åbn afstemningen","label":"Åbn","confirm":"Er du sikker på, at du vil åbne denne afstemning?"},"close":{"title":"Luk afstemningen","label":"Luk","confirm":"Er du sikker på, at du vil lukke denne afstemning?"},"error_while_toggling_status":"Undskyld, der var en fejl i skifte status på denne afstemning.","error_while_casting_votes":"Undskyld, der var en fejl i din stemmeafgivning.","error_while_fetching_voters":"Beklager, der opstod en fejl med at vise deltagerne.","ui_builder":{"title":"Opret afstemning","insert":"Indsæt afstemning","help":{"options_count":"Vælg mindst 2 muligheder"},"poll_type":{"label":"Type","regular":"Enkelt valg","multiple":"Flere valg","number":"Nummerbedømmelse"},"poll_config":{"max":"Maks","min":"Min"},"poll_public":{"label":"Vis hvem der stemte"},"poll_options":{"label":"Indtast en afstemning pr. linje"}}},"type_to_filter":"skriv for at filtrere…","admin":{"title":"Discourse Admin","moderator":"Moderator","dashboard":{"title":"Dashboard","last_updated":"Dashboard sidst opdateret:","version":"Installeret version","up_to_date":"Du kører den seneste version af Discourse.","critical_available":"En kritisk opdatering er tilgængelig.","updates_available":"Opdatering er tilgængelige.","please_upgrade":"Opgradér venligst!","no_check_performed":"Der er ikke blevet søgt efter opdateringer. Kontrollér om sidekiq kører.","stale_data":"Der er ikke blevet søgt efter opdateringer på det seneste. Kontrollér om sidekiq kører.","version_check_pending":"Det ser ud til, at du har opgraderet for nyligt. Fantastisk!","installed_version":"Installeret","latest_version":"Seneste version","problems_found":"Der blev fundet problemer med din installation af Discourse:","last_checked":"Sidst kontrolleret","refresh_problems":"Opdatér","no_problems":"Ingen problemer fundet.","moderators":"Moderatorer:","admins":"Admins:","blocked":"Blokeret:","suspended":"Suspenderet:","private_messages_short":"Beskeder","private_messages_title":"Beskeder","mobile_title":"Mobil","space_free":"{{size}} tilbage","uploads":"uploads","backups":"backups","traffic_short":"Trafik","traffic":"Applikation web forespørgsler","page_views":"API Forespørgsler","page_views_short":"API Forespørgsler","show_traffic_report":"Vist detaljeret trafik rapport","reports":{"today":"I dag","yesterday":"I går","last_7_days":"Seneste 7 dage","last_30_days":"Seneste 30 dage","all_time":"Altid","7_days_ago":"7 dage siden","30_days_ago":"30 dage siden","all":"Alle","view_table":"tabel","refresh_report":"Genopfrisk rapporten","start_date":"Start dato","end_date":"Slut dato","groups":"Alle grupper"}},"commits":{"latest_changes":"Seneste ændringer: opdatér ofte!","by":"af"},"flags":{"title":"Flag","old":"Gamle","active":"Aktive","agree":"Enig","agree_title":"Bekræft dette flag er gyldigt og korrekt","agree_flag_modal_title":"Enig og...","agree_flag_hide_post":"Enig (skjul indlæg + send PM)","agree_flag_hide_post_title":"Gem dette indlæg og send automatisk brugeren en besked der opfordrer dem til at redigere det.","agree_flag_restore_post":"Enig (gendan indlæg)","agree_flag_restore_post_title":"Gendan dette indlæg","agree_flag":"sæt markeringen til \"enig\"","agree_flag_title":"Sæt flaget til \"enig\" og behold indlægget uændret","defer_flag":"Udsæt","defer_flag_title":"Fjern dette flag; Det kræver ingen handling på nuværende tidspunkt.","delete":"Slet","delete_title":"Slet det indlæg, som flaget refererer til.","delete_post_defer_flag":"Slet indlægget og udsæt flaget","delete_post_defer_flag_title":"Slet indlægget; hvis det er det første, så slet hele emnet","delete_post_agree_flag":"Slet indlæg og sæt flaget til \"enig\"","delete_post_agree_flag_title":"Slet indlæg; hvis det er det første indlæg, slet emnet","delete_flag_modal_title":"Slet og...","delete_spammer":"Slet spammer","delete_spammer_title":"Fjern brugeren samt alle dens indlæg og emner.","disagree_flag_unhide_post":"Uenig (vis indlæg)","disagree_flag_unhide_post_title":"Fjern alle flag fra dette indlæg og gør det synligt igen","disagree_flag":"Uenig","disagree_flag_title":"Sæt dette flag som invalid eller forkert","clear_topic_flags":"Færdig","clear_topic_flags_title":"Emnet er kontrolleret og fundet ok. Klik på færdig for at fjerne rapporteringer.","more":"(flere svar...)","dispositions":{"agreed":"enig","disagreed":"uenig","deferred":"udsat"},"flagged_by":"Flaget af","resolved_by":"Løst af","took_action":"Reagerede","system":"System","error":"Noget gik galt","reply_message":"Svar","no_results":"Der er ingen flag.","topic_flagged":"Dette \u003cstrong\u003eemne\u003c/strong\u003e er blevet rapporteret til administrator.","visit_topic":"Besøg emnet for at gøre noget ved det","was_edited":"Indlægget blev redigeret efter det første gang blev flagget","previous_flags_count":"Dette indlæg er allerede blevet markeret {{count}} gange.","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"upassende","other":"upassende x{{count}}"},"action_type_6":{"one":"brugerdefineret","other":"brugerdefinerede x{{count}}"},"action_type_7":{"one":"brugerdefineret","other":"brugerdefinerede x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Primær gruppe","no_primary":"(ingen primær gruppe)","title":"Grupper","edit":"Redigér grupper","refresh":"Genindlæs","new":"Nye","selector_placeholder":"indtast brugernavn","name_placeholder":"Gruppenavn, ingen mellemrum, på samme måde som brugernavne","about":"Redigér gruppemedlemsskaber og gruppenavne her","group_members":"Gruppe medlemmer","delete":"Slet","delete_confirm":"Slet denne gruppe?","delete_failed":"Kan ikke slette gruppen. Hvis dette er en automatisk gruppe, kan den ikke ødelægges.","delete_member_confirm":"Fjern '%{username}' fra gruppen '%{group}'?","delete_owner_confirm":"Fjern ejer-privilegier for '%{username}'?","name":"Navn","add":"Tilføj","add_members":"Tilføj medlemmer","custom":"Brugerdefineret","bulk_complete":"Brugerne er tilføjet gruppen.","bulk":"Tilføj mange brugere til gruppe","bulk_paste":"Indsæt en liste brugerne eller emails, én per linje:","bulk_select":"(vælg en gruppe)","automatic":"Automatisk","automatic_membership_email_domains":"Brugere der registrerer med et email domæne der præcist matcher et på denne liste, vil automatisk blive tilføjet til denne gruppe:","automatic_membership_retroactive":"Brug denne email domæne regel til at tilføje brugere der allerede er registrerede brugere","default_title":"Standard titel for alle brugere i denne gruppe","primary_group":"Sæt automatisk som primær gruppe","group_owners":"Ejere","add_owners":"Tilføj ejere","incoming_email":"Brugerdefineret indkommende email","incoming_email_placeholder":"indtast email"},"api":{"generate_master":"Generér API-nøgle","none":"Der er ingen aktive API-nøgler i øjeblikket.","user":"Bruger","title":"API","key":"API-nøgle","generate":"Generér","regenerate":"Regenerér","revoke":"Tilbagekald","confirm_regen":"Er du sikker på, at du ønsker at erstatte API-nøglen med en ny?","confirm_revoke":"Er du sikker på, at du ønsker at tilbagekalde nøglen?","info_html":"Din API-nøgle giver dig mulighed for at oprette og opdatere emner vha. JSON-kald.","all_users":"Alle brugere","note_html":"Hold denne nøgle \u003cstrong\u003ehemmelig\u003c/strong\u003e, alle brugere som har den kan oprette vilkårlige indlæg, som enhver bruger."},"plugins":{"title":"Plugins","installed":"Installerede Plugins","name":"Navn","none_installed":"Du har ikke nogen plugins installeret","version":"Version","enabled":"Aktiveret?","is_enabled":"J","not_enabled":"N","change_settings":"Skift indstillinger","change_settings_short":"Indstillinger","howto":"Hvordan installerer jeg plugins?"},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Logs"},"none":"Ingen backups tilgængelige","logs":{"none":"Ingen logs endnu..."},"columns":{"filename":"Filnavn","size":"Størrelse"},"upload":{"label":"Upload","title":"Upload en backup til denne instans","uploading":"Uploader...","success":"'{{filename}}' er blevet uploaded.","error":"Der skete en fejl da filen '{{filename}}' blev forsøgt uploaded: {{message}}"},"operations":{"is_running":"Der kører allerede en operation...","failed":"{{operation}} gik galt. Kig venligst i logfilerne.","cancel":{"label":"Annuller","title":"Annuller den nuværende handling","confirm":"Er du sikker på du vil annullere den nuværende handling?"},"backup":{"label":"Backup","title":"Start backup","confirm":"Vil du starte en ny backup?","without_uploads":"Ja (inkluder ikke filer)"},"download":{"label":"Download","title":"Download backuppen"},"destroy":{"title":"Sletter backuppen","confirm":"Er du sikker på du vil fjerne denne backup?"},"restore":{"is_disabled":"Gendan er deaktiveret i forum indstillingerne.","label":"Genetabler","title":"Gendan backuppen"},"rollback":{"label":"Rul tilbage","title":"Rul databasen tilbage til et tidspunkt hvor tingene virkede"}}},"export_csv":{"user_archive_confirm":"Er du sikker på du vil downloade dine indlæg?","success":"Eksport er startet, du vil blive notificeret via en besked når denne proces er færdig.","failed":"Eksport fejlede. Tjek venligst loggen.","rate_limit_error":"Indlæg kan downloades én gang om dagen, prøv igen i morgen.","button_text":"Eksporter","button_title":{"user":"Eksporter hele brugerlisten i en CSV-fil","staff_action":"Eksporter hele personle handlingsloggen i CSV format.","screened_email":"Eksporter den fulde screenede email liste som en CSV fil.","screened_ip":"Eksporter den fulde screenede IP liste som en CSV fil.","screened_url":"Eksporter den fulde screenede URL liste som en CSV fil."}},"export_json":{"button_text":"Eksporter"},"invite":{"button_text":"Send Invitationer","button_title":"Send Invitationer"},"customize":{"title":"Tilpasning","long_title":"Tilpasning af site","css":"CSS","header":"Header","top":"Top","footer":"Bund","embedded_css":"Indlejret CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML som indsættes før \u003chead\u003e\u003c/head\u003e-tagget"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML som indsættes før  \u003c/body\u003e-tagget"},"override_default":"Inkludér ikke standard stylesheet","enabled":"Aktiveret?","preview":"forhåndsvisning","undo_preview":"skjul forhåndsvisning","rescue_preview":"standard stil","explain_preview":"Se sitet med dette stylesheet","explain_undo_preview":"Gå tilbage til det aktuelle ændrede stylesheet","explain_rescue_preview":"Se sitet med standard stylesheet","save":"Gem","new":"Ny","new_style":"Ny style","import":"Importer","import_title":"Vælg en fil eller indsæt tekst","delete":"Slet","delete_confirm":"Slet denne tilpasning?","about":"Modificer CSS stylesheets og HTML headere på sitet. Tilføj en tilpasning for at starte.","color":"Farve","opacity":"Gennemsigtighed","copy":"Kopier","email_templates":{"title":"Email-skabeloner","subject":"Emne","multiple_subjects":"Email-skabelonen har flere emner.","body":"Indhold","none_selected":"Vælg en email-skabelon for at begynde at redigere.","revert":"Rul ændringer tilbage","revert_confirm":"Er du sikker på, at du vil rulle ændringerne tilbage?"},"css_html":{"title":"CSS, HTML","long_title":"CSS og HTML tilpasninger"},"colors":{"title":"Farver","long_title":"Farve temaer","about":"Modificer farverne der bliver brugt på sitet uden at skrive CSS. Tilføj et tema for at begynde.","new_name":"Nyt farve tema","copy_name_prefix":"Kopi af","delete_confirm":"Slet dette farvetema?","undo":"fortryd","undo_title":"Fortryd dine ændringer til denne farve, siden sidste gang den blev gemt.","revert":"gendan","revert_title":"Nulstil denne farve til Discourse's standard farve tema.","primary":{"name":"Primær","description":"De fleste tekster, iconer og kanter."},"secondary":{"name":"sekundær","description":"Hoved baggrunds farven og tekst farven på enkelte knapper."},"tertiary":{"name":"tredie","description":"Links, nogle knapper, notifikationer og accent farver."},"quaternary":{"name":"fjerde","description":"Navigations links."},"header_background":{"name":"titel baggrund","description":"Baggrunds farve på sitets titel."},"header_primary":{"name":"titel primær","description":"Tekst og iconer i sitets titel."},"highlight":{"name":"fremhæv","description":"Baggrundsfarven på fremhævede elementer på siden, såsom emner og indlæg."},"danger":{"name":"fare","description":"Fremhævet farve på handlinger såsom sletning af indlæg og emner."},"success":{"name":"succes","description":"Bruges til at indikere at en handling gik godt."},"love":{"name":"kærlighed","description":"Like knappens farve."}}},"email":{"title":"Emails","settings":"Indstillinger","templates":"Skabeloner","preview_digest":"Forhåndsvisning af sammendrag","sending_test":"Sender test email...","error":"\u003cb\u003eERROR\u003c/b\u003e - %{server_error}","test_error":"Der opstod et problem med at sende test emailen. Dobbelt check dine email indstillinger, verificer at din server ikke blokerer email forbindelser og prøv så igen.","sent":"Sendt","skipped":"Droppet","received":"Modtaget","rejected":"Afvist","sent_at":"Sendt","time":"Tidspunkt","user":"Bruger","email_type":"E-mail-type","to_address":"Modtager","test_email_address":"e-mail-adress der skal testes","send_test":"send test-e-mail","sent_test":"sendt!","delivery_method":"Leveringsmetode","preview_digest_desc":"Forhåndsvis indholdet af de opsamlings-emails der sendes til inaktive brugere","refresh":"Opdatér","format":"Format","html":"html","text":"text","last_seen_user":"Sidst sete bruge:","reply_key":"Svarnøgle","skipped_reason":"Begrundelse","incoming_emails":{"from_address":"Fra","to_addresses":"Til","cc_addresses":"Cc","subject":"Emne","error":"Fejl","none":"Ingen indkommende emails fundet","modal":{"error":"Fejl","subject":"Emne"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Emne...","error_placeholder":"Fejl"}},"logs":{"none":"Ingen logs fundet","filters":{"title":"Filter","user_placeholder":"brugernavn","address_placeholder":"navn@eksempel.dk","type_placeholder":"sammenfatning, tilmelding...","reply_key_placeholder":"svar knap","skipped_reason_placeholder":"grund"}}},"logs":{"title":"Logs","action":"Handling","created_at":"Oprettet","last_match_at":"Sidste matchet","match_count":"Matches","ip_address":"IP","topic_id":"Emne ID","post_id":"Indlægs ID","category_id":"Kategori-id","delete":"Slet","edit":"Redigér","save":"Gem","screened_actions":{"block":"blokér","do_nothing":"gør intet"},"staff_actions":{"title":"Handlinger","instructions":"Klik på brugernavne og handlinger for at filtrere listen. Klik på profil billederne for at gå til bruger siderne.","clear_filters":"Vis alt","staff_user":"Bruger","target_user":"Bruger","subject":"Subjekt","when":"Hvorår","context":"Kontekst","details":"Detaljer","previous_value":"Forrige","new_value":"Ny","diff":"Diff","show":"Vis","modal_title":"Detaljer","no_previous":"Der er ingen forrig værdi.","deleted":"Ingen ny værdi. Rækken blev slettet.","actions":{"delete_user":"slet bruger","change_trust_level":"skift tillidsniveau","change_username":"skift brugernavn","change_site_setting":"skift indstillinger for site","change_site_customization":"skift tilpasning af site","delete_site_customization":"slet tilpasning af site","change_site_text":"skift tekst for site","suspend_user":"suspendér user","unsuspend_user":"ophæv suspendering af bruger","grant_badge":"tildel badge","revoke_badge":"fratag badge","check_email":"check email","delete_topic":"slet emne","delete_post":"slet indlæg","impersonate":"Udgiv dig for bruger","anonymize_user":"anonymiser bruger","roll_up":"rul IP-blokke op","change_category_settings":"ret kategori-indstillinger","delete_category":"slet kategori","create_category":"opret kategori","block_user":"bloker bruger","unblock_user":"fjern blokering af bruger","grant_admin":"tildel admin","revoke_admin":"fjern admin","grant_moderation":"tildel moderation","revoke_moderation":"fjern moderation"}},"screened_emails":{"title":"Blokerede e-mails","description":"Følgende e-mail-adresser kontrolleres når nogen prøver at oprette en konto, og oprettelsen vil enten blive blokeret, eller der vil blive foretaget en anden handling.","email":"E-mail-adresse","actions":{"allow":"Tillad"}},"screened_urls":{"title":"Blokerede URLer","description":"URLerne nedenfor er blevet brugt i indlæg af brugere, som er blevet identificeret som spammere.","url":"URL","domain":"Domain"},"screened_ips":{"title":"Blokerede IPer","description":"IP-adresser som bliver overvåget. Brug \"Tillad\" for at whiteliste IP-addresser.","delete_confirm":"Er du sikker på, at du ønsker at fjerne reglen for %{ip_address}?","roll_up_confirm":"Er du sikker på du vil samle alle screenede IP adresser i subnets ?","rolled_up_some_subnets":"Har med succes samlet alle IP forbud til disse subnets: %{subnets}","rolled_up_no_subnet":"Der var intet at samle.","actions":{"block":"Blokér","do_nothing":"Tillad","allow_admin":"Tillad Admin"},"form":{"label":"Ny:","ip_address":"IP-adresse","add":"Tilføj","filter":"Søg"},"roll_up":{"text":"Saml sammen","title":"Laver et nyt subnet forbud hvis der er mindst 'min_ban_entries_for_roll_up' forbud."}},"logster":{"title":"Fejl beskeder"}},"impersonate":{"title":"Skift personlighed","help":"Brug dette værktøj til at udgive dig for en anden bruger til brug for debugging. Du skal logge ud når du er færdig.","not_found":"Den bruger findes ikke.","invalid":"Beklager, du kan ikke udgive dig for den bruger."},"users":{"title":"Brugere","create":"Tilføj admin-bruger","last_emailed":"Sidst mailet","not_found":"Beklager, brugernavnet findes ikke i vores system.","id_not_found":"Desværre, dette bruger id findes ikke på vores system.","active":"Aktiv","show_emails":"Vis Emails","nav":{"new":"Ny","active":"Aktiv","pending":"Afventer","staff":"Personale","suspended":"Suspenderet","blocked":"Blokeret","suspect":"Mistænkt"},"approved":"Godkendt?","approved_selected":{"one":"godkend bruger","other":"godkend brugere ({{count}})"},"reject_selected":{"one":"afvis bruger","other":"afvis brugere ({{count}})"},"titles":{"active":"Aktive brugere","new":"Nye brugere","pending":"Brugere som afvanter godkendelse","newuser":"Brugere på tillidsniveau 0 (Ny bruger)","basic":"Brugere på tillidsniveau 1 (Basisbruger)","member":"Bruger på tillidsniveau 2 (Medlem)","regular":"Bruger på tillidsniveau 3 (Regulær)","leader":"Bruger på tillidsniveau 4 (Leder)","staff":"Personale","admins":"Admin-brugere","moderators":"Moderatorer","blocked":"Blokerede brugere","suspended":"Suspenderede brugere","suspect":"Mistænkte brugere"},"reject_successful":{"one":"Afviste 1 bruger.","other":"Afviste %{count} brugere."},"reject_failures":{"one":"Kunne ikke afvise 1 bruger.","other":"Kunne ikke afvise %{count} brugere."},"not_verified":"Ikke verificeret","check_email":{"title":"Vis denne brugers email adresse","text":"Vis"}},"user":{"suspend_failed":"Noget gik galt ved suspenderingen af denne bruger {{error}}","unsuspend_failed":"Noget gik galt ved ophævningen af denne brugers suspendering {{error}}","suspend_duration":"Hvor lang tid skal brugeren være suspenderet?","suspend_duration_units":"(dage)","suspend_reason_label":"Hvorfor suspenderer du? Denne tekst \u003cb\u003eer synlig for alle\u003c/b\u003e på brugerens profilside, og vises til brugeren når de prøver at logge ind. Fat dig i korthed.","suspend_reason":"Begrundelse","suspended_by":"Suspenderet af","delete_all_posts":"Slet alle indlæg","suspend":"Suspendér","unsuspend":"Ophæv suspendering","suspended":"Suspenderet?","moderator":"Moderator?","admin":"Admin?","blocked":"Blokeret?","show_admin_profile":"Admin","edit_title":"Redigér titel","save_title":"Gem titel","refresh_browsers":"Gennemtving browser refresh","refresh_browsers_message":"Beskeden er sendt til alle tilsluttede browsere!","show_public_profile":"Vis offentlig profil","impersonate":"Impersonate","ip_lookup":"IP opslag","log_out":"Log ud","logged_out":"Bruger er logget ud på alle enheder","revoke_admin":"Fratag admin","grant_admin":"Tildel admin","revoke_moderation":"Fratag moderation","grant_moderation":"Tildel moderation","unblock":"Ophæv blokering","block":"Blokér","reputation":"Omdømme","permissions":"Tilladelser","activity":"Aktivitet","like_count":"Likes Givet / Modtaget","last_100_days":"de sidste 100 dage","private_topics_count":"Private emner","posts_read_count":"Læste indlæg","post_count":"Oprettede indlæg","topics_entered":"Læste emner","flags_given_count":"Afgivne flag","flags_received_count":"Modtagne flag","warnings_received_count":"Advarsler modtaget","flags_given_received_count":"Flag Givet / Modtaget","approve":"Godkend","approved_by":"godkendt af","approve_success":"Bruger godkendt og e-mail med aktiveringsvejledning sendt.","approve_bulk_success":"Succes! Alle valgte brugere er blevet godkendt og underrettet.","time_read":"Læsetid","anonymize":"Anonymiser Bruger","anonymize_confirm":"Er du HELT SIKKER på at du vil anonymisere denne konto? Dette vil ændre brugernavnet og email adressen, samt nulstille profil informationen.","anonymize_yes":"Ja, anonymiser denne konto","anonymize_failed":"Der var problemer med at anonymisere denne konto.","delete":"Slet bruger","delete_forbidden_because_staff":"Admins og moderatorer kan ikke slettes.","delete_posts_forbidden_because_staff":"Kan ikke slette alle indlæg fra administratorer og moderatorer.","delete_forbidden":{"one":"Brugere kan ikke slettes hvis de har oprettet sig for mere end %{count} dag siden, eller hvis de har oprettet indlæg. Slet alle indlæg før du forsøger at slette en bruger.","other":"Brugere kan ikke slettes hvis de har oprettet sig for mere end %{count} dage siden, eller hvis de har oprettet indlæg. Slet alle indlæg før du forsøger at slette en bruger."},"cant_delete_all_posts":{"one":"Kan ikke slette alle indlæg. Der er indlæg der er over %{count} dag gamle. (Juster delete_user_max_post_age indstillingen.)","other":"Kan ikke slette alle indlæg. Der er indlæg der er over %{count} dage gamle. (Juster delete_user_max_post_age indstillingen.)"},"cant_delete_all_too_many_posts":{"one":"Kan ikke slette alle indlæg fordi denne bruger har flere end 1 indlæg. (delete_all_posts_max indstillingen)","other":"Kan ikke slette alle indlæg fordi denne bruger har flere end %{count} indlæg. (delete_all_posts_max indstillingen)"},"delete_confirm":"Er du SIKKER på at du slette denne bruger? Det er permanent! ","delete_and_block":"Slet og \u003cb\u003ebloker\u003c/b\u003e denne email og IP-adresse","delete_dont_block":"Slet kun","deleted":"Brugeren blev slettet.","delete_failed":"Der opstod en fejl ved sletning af brugeren. Kontrollér om alle indlæg er slettet før du prøver at slette brugeren.","send_activation_email":"Send aktiverings-e-mail","activation_email_sent":"Aktiverings-e-mail sendt.","send_activation_email_failed":"Der opstod et problem ved afsendelse af aktiverings-e-mailen. %{error}","activate":"Aktivér konto","activate_failed":"Der opstod et problem ved aktivering af brugeren.","deactivate_account":"Deaktivér konto","deactivate_failed":"Der opstod et problem ved deaktivering af brugeren.","unblock_failed":"Der opstod et problem ved ophævelsen af brugerens blokering.","block_failed":"Der opstod et problem ved blokering af brugeren.","block_confirm":"Er du sikker på, at du vil blokere brugeren? Bruger kan ikke længere oprette emner eller indlæg.","block_accept":"Ja, bloker brugeren","deactivate_explanation":"En deaktiveret bruger skal genvalidere deres e-mail.","suspended_explanation":"En suspenderet bruger kan ikke logge ind.","block_explanation":"En blokeret bruger kan ikke oprette indlæg eller starte emner.","trust_level_change_failed":"Der opstod et problem ved ændringen af brugerens tillidsniveau.","suspend_modal_title":"Suspendér bruger","trust_level_2_users":"Tillids niveau 2 brugere","trust_level_3_requirements":"Fortrolighedsniveau 3 påkrævet","trust_level_locked_tip":"tillidsniveau er låst, systemet kan ikke forfremme eller degradere bruger","trust_level_unlocked_tip":"tillidsniveau er ulåst, systemet kan forfremme eller degradere bruger","lock_trust_level":"Lås tillidsniveau","unlock_trust_level":"Lås tillidsniveau op","tl3_requirements":{"title":"Krav for fortrolighedsniveau 3","value_heading":"værdi","requirement_heading":"Obligatoriske","visits":"Besøg","days":"dage","topics_replied_to":"Emner med svar","topics_viewed":"Emner åbnet","topics_viewed_all_time":"Emner åbnet (siden begyndelsen)","posts_read":"Læste indlæg","posts_read_all_time":"Indlæg læst (siden begyndelsen)","flagged_posts":"Markerede indlæg","flagged_by_users":"Brugere der har markeret indlæg","likes_given":"Likes givet","likes_received":"Likes modtaget","likes_received_days":"Likes modtaget: unikke dage","likes_received_users":"Likes modtaget: unikke brugere","qualifies":"Krav for tillidsniveau 3","does_not_qualify":"Ikke kvalificeret til tillids niveau 3.","will_be_promoted":"Bliver snart forfremmet","will_be_demoted":"Bliver snart degraderet","on_grace_period":"Er i øjeblikket i forfremmelses prøve periode, vil ikke blive degraderet.","locked_will_not_be_promoted":"Tillidsniveau låst. Vil aldrig blive forfremmet.","locked_will_not_be_demoted":"Tillidsniveau låst. Vil aldrig blive degraderet."},"sso":{"title":"Single Sign On","external_id":"Externt ID","external_username":"Brugernavn","external_name":"Navn","external_email":"Email","external_avatar_url":"Profil billed URL"}},"user_fields":{"title":"Bruger felter","help":"Tilføj felter, som dine brugere kan udfylde","create":"Opret brugerfelt","untitled":"Ingen titel","name":"Feltnavn","type":"Felttype","description":"Feltbeskrivelse","save":"Gem","edit":"Ret","delete":"Slet","cancel":"Afbryd","delete_confirm":"Er du sikker på at du vil slette det brugerfelt?","options":"Indstillinger","required":{"title":"Krævet ved registrering?","enabled":"krævet","disabled":"ikke krævet"},"editable":{"title":"Kan rettes efter registrering?","enabled":"redigerbar","disabled":"ikke redigerbar"},"show_on_profile":{"title":"Vis i offentlig profil?","enabled":"vist i profil","disabled":"ikke vist i profil"},"field_types":{"text":"Tekstfelt","confirm":"Bekræft","dropdown":"Rulleboks"}},"site_text":{"description":"Du kan ændre alt tekst på dette forum. Start med at søge herunder:","search":"Søg efter teksten du gerne vil rette","title":"Tekstindhold","edit":"ret","revert":"Rul ændringer tilbage","revert_confirm":"Er du sikker på, at du vil rulle ændringerne tilbage?","go_back":"Tilbage til søgning","recommended":"Vi anbefaler ændringer i følgende tekst:","show_overriden":"Vis kun tilsidesatte"},"site_settings":{"show_overriden":"Vis kun tilsidesatte","title":"Indstillinger","reset":"nulstil","none":"ingen","no_results":"Ingen resultater fundet.","clear_filter":"Ryd","add_url":"tilføj URL","add_host":"tilføj server","categories":{"all_results":"Alle","required":"Obligatoriske","basic":"Grundlæggende","users":"Brugere","posting":"Indlæg","email":"E-mail","files":"Filer","trust":"Tillidsniveauer","security":"Sikkerhed","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Begrænsninger","developer":"Udvikler","embedding":"Indlejring","legal":"Jura","uncategorized":"Andre","backups":"Backups","login":"Brugernavn","plugins":"Plugins","user_preferences":"Brugerpræferencer"}},"badges":{"title":"Badges","new_badge":"Nyt Badge","new":"Nye","name":"Navn","badge":"Badge","display_name":"Vist navn","description":"Beskrivelse","long_description":"Lang beskrivelse","badge_type":"Badge Type","badge_grouping":"Gruppe","badge_groupings":{"modal_title":"Badge grupperinger"},"granted_by":"Givet af","granted_at":"Givet på","reason_help":"(Et link til et indlæg eller et emne)","save":"Gem","delete":"Slet","delete_confirm":"Er du sikker på du vil slette denne badge ?","revoke":"Fratag","reason":"Grund","expand":"Fold ud \u0026hellip;","revoke_confirm":"Er du sikker på du vil fratage brugeren denne badge ?","edit_badges":"Rediger Badges","grant_badge":"Tildel Badge","granted_badges":"Tildelte Badges","grant":"Givet","no_user_badges":"%{name} had ikke feet nogen badges.","no_badges":"Der er ikke nogen badges, der kan tildeles.","none_selected":"Vælg et badge for at komme igang","allow_title":"Tillad at bruge denne badge som titel","multiple_grant":"Kan gives flere gange","listable":"Vi badges på den offentlige badge side","enabled":"Aktiver badge","icon":"Icon","image":"Billede","icon_help":"Bruge enten en \"Font Awesome\" klasse eller URL til et billede","query":"Badge Forespørgesel (SQL)","target_posts":"Forespørg mål indlæg","auto_revoke":"Kør tilbagekaldelses forespørgsel hver dag","show_posts":"Vis det indlæg der gav et badge på badge siden","trigger":"Trigger","trigger_type":{"none":"Opdater dagligt","post_action":"Når en bruger reagerer på et indlæg","post_revision":"Når en bruger redigerer eller opretter et indlæg","trust_level_change":"Når en bruger skifter tillidsniveau","user_change":"Når en bruger er redigeret eller oprettet"},"preview":{"link_text":"Forhåndsvisning af opnåede badges","plan_text":"Forhåndsvisning med forespørgsels plan (SQL)","modal_title":"Badge Forespørgesel forhåndsvisning (SQL)","sql_error_header":"Der var en fejl i forespørgslen","error_help":"Se disse links for hjælp med at skrive badge forespørgsler.","bad_count_warning":{"header":"ADVARSEL!","text":"Der mangler tildelinger. Dette sker når en SQL query returnerer bruger ID'er eller indlægs IS'er der ikke eksisterer. Dette kan give uventede resultater senere - vær venlig at dobbelt checke din SQL query."},"no_grant_count":"Ingen badges til tildeling.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge til tildeling.","other":"\u003cb\u003e%{count}\u003c/b\u003e badges til tildeling."},"sample":"Eksempel:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for indlæg i %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e for indlæg i %{link} klokken \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e klokken \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emotikon","help":"tilføj en ny emotikon der vil være tilgængelig for alle. (PROTIP: drag \u0026 drop flere filer på én gang)","add":"Tilføj nyt emotikon","name":"Navn","image":"Billede","delete_confirm":"Er du sikker på du vil slette emotikonnet: %{name} ?"},"embedding":{"get_started":"Hvis du vil indlejre Discourse på et andet website, skal du starte med at tilføje dets server.","confirm_delete":"Er du sikker på at du vil slette denne server?","sample":"Tilføj denne HTML til dit site for at oprette og indlejre emner fra discourse. Erstat \u003cb\u003eREPLACE_ME\u003c/b\u003e med den kanoniske URL for den side du indlejrer den på,","title":"Indlejring","host":"Tilladte servere","edit":"redigér","category":"Opret i kategorien","add_host":"Tilføj server","settings":"Indlejrings-indstillinger","feed_settings":"Feed-indstillinger","feed_description":"Hvis du angiver et RSS/ATOM-feed for dit site, kan det forbedre Discourses mulighed for at importere dit indhold.","crawling_settings":"Robot-indstillinger","crawling_description":"Når Discourse opretter emner for dine indlæg, og der ikke er noget RSS/ATOM-feed, vil den forsøge at parse dit indhold ud fra din HTML. Det kan nogengange være en udfordring at udtrække dit indhold, så vi giver mulighed for at specificere CSS-regler for at gøre udtræk lettere.","embed_by_username":"Brugernavn for oprettelse af emne","embed_post_limit":"Maksimalt antal indlæg der kan indlejres.","embed_username_key_from_feed":"Nøgle til at udtrække discourse-brugernavn fra feed","embed_truncate":"Beskær de indlejrede indlæg","embed_whitelist_selector":"CSS-selektorer for elementer der er tilladte i indlejringer","embed_blacklist_selector":"CSS-selektorer for elementer der fjernes fra indlejringer","feed_polling_enabled":"Importer indlæg via RSS/ATOM","feed_polling_url":"URL på RSS/ATOM feed der skal kravles","save":"Gem indlejrings-indstillinger"},"permalink":{"title":"Permalinks","url":"URL","topic_id":"Emne ID","topic_title":"Emne","post_id":"Indlæg ID","post_title":"Indlæg","category_id":"Kategori ID","category_title":"Kategori","external_url":"Ekstern URL","delete_confirm":"Er du sikker på at du vil slette dette permalink?","form":{"label":"Ny:","add":"Tilføj","filter":"Søg (URL eller ekstern URL)"}}}}},"en":{"js":{"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","s3":{"regions":{"us_east_1":"US East (N. Virginia)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Ireland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ap_south_1":"Asia Pacific (Mumbai)","ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","sa_east_1":"South America (Sao Paulo)","cn_north_1":"China (Beijing)"}},"groups":{"notifications":{"watching_first_post":{"title":"Watching First Post"}}},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"mailing_list_mode":{"instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n"},"watched_tags":"Watched","tracked_tags":"Tracked","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_topics_link":"Show watched topics","automatically_unpin_topics":"Automatically unpin topics when I reach the bottom.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_about":{"error":"There was an error changing this value."},"change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","invited":{"reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!"},"summary":{"time_read":"read time","topic_count":{"one":"topic created","other":"topics created"},"post_count":{"one":"post created","other":"posts created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited","other":"days visited"},"posts_read":{"one":"post read","other":"posts read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"},"no_replies":"No replies yet.","no_topics":"No topics yet.","no_badges":"No badges yet.","top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","link_url_placeholder":"http://example.com","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e"},"search":{"too_short":"Your search term is too short.","context":{"category":"Search the #{{category}} category"}},"topics":{"bulk":{"change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."},"none":{"educate":{"new":"\u003cp\u003eYour new topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered new and will show a \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e indicator if they were created in the last 2 days.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e","unread":"\u003cp\u003eYour unread topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."}},"post":{"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","notifications":{"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"keyboard_shortcuts_help":{"actions":{"bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","notifications":{"regular":{"title":"Regular"},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"parent_tag_label":"Parent tag:","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group"}},"poll":{"ui_builder":{"poll_config":{"step":"Step"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}},"operations":{"restore":{"confirm":"Are you sure you want to restore this backup?"},"rollback":{"confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"email":{"bounced":"Bounced","incoming_emails":{"modal":{"title":"Incoming Email Details","headers":"Headers","body":"Body","rejection_message":"Rejection Mail"}}},"logs":{"staff_actions":{"actions":{"backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","staged":"Staged?","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"title":"Show on user card?","enabled":"shown on user card","disabled":"not shown on user card"}},"site_settings":{"categories":{"user_api":"User API","tags":"Tags","search":"Search"}},"badges":{"trigger_type":{"post_processed":"After a post is processed"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_classname_whitelist":"Allowed CSS class names"}}}}};
I18n.locale = 'da';
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
//! locale : danish (da)
//! author : Ulrik Nielsen : https://github.com/mrbase

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var da = moment.defineLocale('da', {
        months : 'januar_februar_marts_april_maj_juni_juli_august_september_oktober_november_december'.split('_'),
        monthsShort : 'jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec'.split('_'),
        weekdays : 'søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag'.split('_'),
        weekdaysShort : 'søn_man_tir_ons_tor_fre_lør'.split('_'),
        weekdaysMin : 'sø_ma_ti_on_to_fr_lø'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D. MMMM YYYY',
            LLL : 'D. MMMM YYYY HH:mm',
            LLLL : 'dddd [d.] D. MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay : '[I dag kl.] LT',
            nextDay : '[I morgen kl.] LT',
            nextWeek : 'dddd [kl.] LT',
            lastDay : '[I går kl.] LT',
            lastWeek : '[sidste] dddd [kl] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'om %s',
            past : '%s siden',
            s : 'få sekunder',
            m : 'et minut',
            mm : '%d minutter',
            h : 'en time',
            hh : '%d timer',
            d : 'en dag',
            dd : '%d dage',
            M : 'en måned',
            MM : '%d måneder',
            y : 'et år',
            yy : '%d år'
        },
        ordinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return da;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
