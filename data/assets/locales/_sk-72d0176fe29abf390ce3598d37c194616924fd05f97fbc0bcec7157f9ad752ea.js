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
r += "Máte ";
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
r += "<a href='/unread'>1 neprečítanú</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " neprečítané</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "a";
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
r += " <a href='/new'>1 novú</a> tému";
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
r += "a ";
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
})() + " nových</a> tém";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " na prečítanie, prípadne ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "si pozrite iné témy v  ";
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
r += "Táto téma obsahuje ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 odpoveď";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " odpovedí";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "s vysokým pomerom \"Páči sa\" na príspevok";
return r;
},
"med" : function(d){
var r = "";
r += "s veľmi vysokým pomerom \"Páči sa\" na príspevok";
return r;
},
"high" : function(d){
var r = "";
r += "s extrémne vysokým pomerom \"Páči sa\" na príspevok";
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

MessageFormat.locale.sk = function (n) {
  if (n == 1) {
    return 'one';
  }
  if (n == 2 || n == 3 || n == 4) {
    return 'few';
  }
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
I18n.translations = {"sk":{"js":{"number":{"format":{"separator":",","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"bajt","few":"bajtov","other":"bajtov"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}tis","millions":"{{number}}mil"}},"dates":{"time":"h:mm a","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","few":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","few":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","few":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"1h","few":"%{count}h","other":"%{count}h"},"x_days":{"one":"1d","few":"%{count}d","other":"%{count}d"},"about_x_years":{"one":"1r","few":"%{count}r","other":"%{count}r"},"over_x_years":{"one":"\u003e 1r","few":"\u003e %{count}r","other":"\u003e %{count}r"},"almost_x_years":{"one":"1r","few":"%{count}r","other":"%{count}r"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minúta","few":"%{count} minúty","other":"%{count} minút"},"x_hours":{"one":"1 hodina","few":"%{count} hodiny","other":"%{count} hodín"},"x_days":{"one":"1 deň","few":"%{count} dni","other":"%{count} dní"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"pred 1 minútou","few":"pred %{count} minútami","other":"pred %{count} minútami"},"x_hours":{"one":"pred 1 hodinou","few":"pred %{count} hodinami","other":"pred %{count} hodinami"},"x_days":{"one":"pred 1 dňom","few":"pred %{count} dňami","other":"pred %{count} dňami"}},"later":{"x_days":{"one":"1 deň neskôr","few":"%{count} dni neskôr","other":"%{count} dní neskôr"},"x_months":{"one":"1 mesiac neskôr","few":"%{count} mesiace neskôr","other":"%{count} mesiacov neskôr"},"x_years":{"one":"1 rok neskôr","few":"%{count} roky neskôr","other":"%{count} rokov neskôr"}},"previous_month":"Predchádzajúci mesiac","next_month":"Nasledujúci mesiac"},"share":{"topic":"zdieľaj odkaz na túto tému","post":"príspevok #%{postNumber}","close":"zatvoriť","twitter":"zdieľaj odkaz na Twitteri","facebook":"zdieľaj odkaz na Facebooku","google+":"zdieľaj odkaz na Google+","email":"pošli odkaz emailom"},"action_codes":{"split_topic":"rozdeľ tému %{when}","invited_user":"pozvaný %{who} %{when}","removed_user":"odstránený %{who} %{when}","autoclosed":{"enabled":"uzavreté %{when}","disabled":"otvorené %{when}"},"closed":{"enabled":"uzavreté %{when}","disabled":"otvorené %{when}"},"archived":{"enabled":"archivované %{when}","disabled":"odarchivované %{when}"},"pinned":{"enabled":"pripnuné %{when}","disabled":"odopnuté %{when}"},"pinned_globally":{"enabled":"globálne pripnuté %{when}","disabled":"odopnuté %{when}"},"visible":{"enabled":"zverejnené %{when}","disabled":"stiahnuté %{when}"}},"topic_admin_menu":"akcie administrátora témy","emails_are_disabled":"Odosielanie emailov bolo globálne vypnuté administrátorom. Žiadne emailové notifikácie nebudú odoslané.","s3":{"regions":{"us_east_1":"USA Východ (S. Virginia)","us_west_1":"USA Západ (S. Kalifornia)","us_west_2":"USA Západ (Oregon)","us_gov_west_1":"AWS GovCloud (USA)","eu_west_1":"EU (Írsko)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Ázia Tichomorie (Singapur)","ap_southeast_2":"Ázia Tichomorie (Sydney)","ap_northeast_1":"Ázia Tichomorie (Tokio)","ap_northeast_2":"Asia Pacific (Soul)","sa_east_1":"Južná Amerika (Sao Paulo)"}},"edit":"upraviť názov a kategóriu témy","not_implemented":"Táto funkcia ešte bohužiaľ nie je implementovaná.","no_value":"Nie","yes_value":"Áno","generic_error":"Bohužiaľ nastala chyba.","generic_error_with_reason":"Nastala chyba: %{error}","sign_up":"Registrácia","log_in":"Prihlásenie","age":"Vek","joined":"Registovaný","admin_title":"Administrácia","flags_title":"Nahlásenie","show_more":"zobraz viac","show_help":"možnosti","links":"Odkazy","links_lowercase":{"one":"odkaz","few":"odkazy","other":"odkazy"},"faq":"FAQ","guidelines":"Pokyny","privacy_policy":"Ochrana súkromia","privacy":"Súkromie","terms_of_service":"Podmienky používania","mobile_view":"Mobilná verzia","desktop_view":"Desktop verzia","you":"Vy","or":"alebo","now":"práve teraz","read_more":"čítaj ďalej","more":"Viac","less":"Menej","never":"nikdy","every_30_minutes":"každých 30 mintút","every_hour":"každú hodinu","daily":"denne","weekly":"týždenne","every_two_weeks":"každé dva týždne","every_three_days":"každé tri dni","max_of_count":"najviac {{count}}","alternation":"alebo","character_count":{"one":"1 znak","few":"{{count}} znakov","other":"{{count}} znakov"},"suggested_topics":{"title":"Odporúčané témy","pm_title":"Odporúčané správy"},"about":{"simple_title":"O fóre","title":"O %{title}","stats":"Štatistiky stránky","our_admins":"Naši admini","our_moderators":"Naši moderátori","stat":{"all_time":"Za celú dobu","last_7_days":"Posledných 7 dní","last_30_days":"Posledných 30 dní"},"like_count":"Páči sa mi","topic_count":"Témy","post_count":"Príspevky","user_count":"Noví používatelia","active_user_count":"Aktívni používatelia","contact":"Kontaktujte nás","contact_info":"V prípade kritickej chyby alebo naliehavej záležitosti nás prosím konaktujte na %{contact_info}."},"bookmarked":{"title":"Záložka","clear_bookmarks":"Odstrániť záložku","help":{"bookmark":"Kliknutím vložíte záložku na prvý príspevok tejto témy","unbookmark":"Kliknutím odstánite všetky záložky v tejto téme"}},"bookmarks":{"not_logged_in":"pre pridanie záložky sa musíte prihlásiť","created":"záložka bola pridaná","not_bookmarked":"príspevok je prečítaný, kliknite pre pridanie záložky","last_read":"toto je posledný prečítaný príspevok, kliknite pre pridanie záložky","remove":"Odstrániť záložku","confirm_clear":"Ste si istý že chcete odstrániť všetky záložky z tejto témy?"},"topic_count_latest":{"one":"1 nová alebo upravená téma.","few":"{{count}} nové alebo upravené témy.","other":"{{count}} nových alebo upravených tém."},"topic_count_unread":{"one":"1 neprečítaná téma.","few":"{{count}} neprečítané témy.","other":"{{count}} neprečítaných tém."},"topic_count_new":{"one":"1 nová téma.","few":"{{count}} nové témy.","other":"{{count}} nových tém."},"click_to_show":"Kliknite pre zobrazenie.","preview":"náhľad","cancel":"zrušiť","save":"Uložiť zmeny","saving":"Ukladám zmeny...","saved":"Zmeny uložené.","upload":"Upload","uploading":"Upload prebieha...","uploading_filename":"Nahrávám {{filename}}...","uploaded":"Upload úspešne dokončený.","enable":"Zapnúť","disable":"Vypnúť","undo":"Späť","revert":"Vrátiť zmeny","failed":"Nepodarilo sa","banner":{"close":"Zamietnuť tento banner.","edit":"Upraviť tento banner \u003e\u003e"},"choose_topic":{"none_found":"Nenašli sa žiadne témy.","title":{"search":"Hľadaj tému podľa názvu, url alebo id:","placeholder":"sem napíšte názov témy"}},"queue":{"topic":"Téma:","approve":"Schváliť","reject":"Zamietnuť","delete_user":"Odstrániť používateľa","title":"Vyžaduje schválenie","none":"Žiadne príspevky na kontrolu.","edit":"Upraviť","cancel":"Zrušiť","view_pending":"zobraziť príspevky čakajúce na schválenie","has_pending_posts":{"one":"Téma má \u003cb\u003e{{count}}\u003c/b\u003e príspevkov čakajúci na schválenie","few":"Téma má \u003cb\u003e{{count}}\u003c/b\u003e príspevky čakajúce na schválenie","other":"Téma má \u003cb\u003e{{count}}\u003c/b\u003e príspevkov čakajúcich na schválenie"},"confirm":"Uložiť zmeny","delete_prompt":"Táto akcia zmaže všetky príspevky, zablokuje e-mail a IP adresu užívateľa \u003cb\u003e%{username}\u003c/b\u003e. Ste si istý, že chcete zmazať tohto užívateľa? ","approval":{"title":"Príspevok vyžaduje schválenie","description":"Váš príspevok sme obdžali, ale skôr než bude zverejnený musí byť schválený moderátorom. Prosíme o trpezlivosť.","pending_posts":{"one":"Máte \u003cstrong\u003e1\u003c/strong\u003e neprečítaný príspevok.","few":"Máte \u003cstrong\u003e{{count}}\u003c/strong\u003e neprečítané príspevky.","other":"Máte \u003cstrong\u003e{{count}}\u003c/strong\u003e neprečítaných príspevkov."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e založil \u003ca href='{{topicUrl}}'\u003etému\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eVy\u003c/a\u003e ste založili \u003ca href='{{topicUrl}}'\u003etému\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpovedal na \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eVy\u003c/a\u003e ste odpovedali na \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpovedal na \u003ca href='{{topicUrl}}'\u003etému\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eVy\u003c/a\u003e ste odpovedali na\u003ca href='{{topicUrl}}'\u003etému\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e spomenul \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e spomenul \u003ca href='{{user2Url}}'\u003eVás\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eVy\u003c/a\u003e ste spomenuli \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Príspevok od \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Príspevok od \u003ca href='{{userUrl}}'\u003eVás\u003c/a\u003e","sent_by_user":"Poslané od \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Poslané \u003ca href='{{userUrl}}'\u003eVami\u003c/a\u003e"},"directory":{"filter_name":"filtrovať podľa používateľského mena","title":"Používatelia","likes_given":"Rozdané","likes_received":"Prijaté","time_read":"Čas strávený čítaním","topic_count":"Témy","topic_count_long":"Vytvorených tém","post_count":"Odpovede","post_count_long":"Odpovedí","no_results":"Žiadne výsledky","days_visited":"Návštev","days_visited_long":"Navštívených dní","posts_read":"Prečítané","posts_read_long":"Prečítaných príspevkov","total_rows":{"one":"1 užívateľ","few":"%{count} užívatelia","other":"%{count} užívateľov"}},"groups":{"empty":{"posts":"Neexistuje žiadny príspevok od člena tejto skupiny.","members":"Táto skupina neobsahuje žiadnych členov.","mentions":"Táto skupina nieje nikde spomenutá.","messages":"Neexistujú žiadne správy pre túto skupinu.","topics":"Neexistuje žiadna téma od členov tejto skupiny."},"add":"Pridať","selector_placeholder":"Pridať členov","owner":"vlastník","visible":"Skupina je viditeľná všetkým používateľom","title":{"one":"skupina","few":"skupiny","other":"skupiny"},"members":"Členovia","posts":"Príspevky","alias_levels":{"title":"Kto môže poslať správu a @uváadzať túto skupinu?","nobody":"Nikto","only_admins":"Iba administrátori","mods_and_admins":"Iba moderátori a administrátori","members_mods_and_admins":"Iba členovia skupiny, moderátori a administrátori","everyone":"Každý"},"trust_levels":{"title":"Stupeň dôvery automaticky pridelený členom po ich pridaní:","none":"Žiadny"},"notifications":{"watching":{"title":"Pozerať","description":"Budete upozornený na každý nový príspevok vo všetkých správach a zobrazí sa počet nových odpovedí."},"tracking":{"title":"Sledovať","description":"Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie a zobrazí sa počet nových odpovedí."},"regular":{"title":"Bežný","description":"Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie."},"muted":{"title":"Ignorovaný","description":"Nikdy nebudete upozornení na nič ohľadom nových tém v tejto skupine."}}},"user_action_groups":{"1":"Rozdaných 'páči sa mi'","2":"Obdržaných 'páči sa mi'","3":"Záložky","4":"Témy","5":"Odpovede","6":"Odozvy","7":"Zmienky","9":"Citácie","11":"Úpravy","12":"Odoslané správy","13":"Prijaté správy","14":"Čakajúce správy"},"categories":{"all":"všetky kategórie","all_subcategories":"všetky","no_subcategory":"žiadne","category":"Kategória","category_list":"Zobraziť zoznam kategórií","reorder":{"title":"Usporiadať Kategórie","title_long":"Usporiadať zoznam kategórií","fix_order":"Pevné pozície","fix_order_tooltip":"Nie všetky kategórie majú unikátne číslo pozície, čo môže zpôsobovať neočakávané výsledky.","save":"Ulož poradie","apply_all":"Použi","position":"Pozícia"},"posts":"Príspevky","topics":"Témy","latest":"Najnovšie","latest_by":"najnovšie podľa","toggle_ordering":"zmeniť radenie","subcategories":"Podkategórie","topic_stat_sentence":{"one":"%{count} nová téma za posledných %{unit}.","few":"%{count} nové témy za posledných %{unit}.","other":"%{count} nových tém za posledných %{unit}."}},"ip_lookup":{"title":"Vyhľadávanie podľa IP adresy","hostname":"Hostname","location":"Lokácia","location_not_found":"(neznáma)","organisation":"Organizácia","phone":"Telefón","other_accounts":"Ostatné účty s  touto IP adresou:","delete_other_accounts":"Zmazaných %{count}","username":"používateľské meno","trust_level":"Dôvera","read_time":"čas strávený čítaním","topics_entered":"založených tém","post_count":"# príspevkov","confirm_delete_other_accounts":"Ste si istý že chcete zmazať tieto účty?"},"user_fields":{"none":"(vyberte možnosť)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Ignorovať","edit":"Upraviť nastavenia","download_archive":"Stiahnutie mojich prípevkov","new_private_message":"Nová správa","private_message":"Správa","private_messages":"Správy","activity_stream":"Aktivita","preferences":"Nastavenia","expand_profile":"Rozbaľ","bookmarks":"Záložky","bio":"O mne","invited_by":"Pozvaný od","trust_level":"Stupeň dôvery","notifications":"Upozornenia","statistics":"Štatistiky","desktop_notifications":{"label":"Upozornenia na pracovnej ploche","not_supported":"Tento prehliadač nepodporuje upozornenia. Prepáčte.","perm_default":"Zapnúť upozornenia","perm_denied_btn":"Prístup zamietnutý","perm_denied_expl":"Povolenie pre zobrazenie notifikácií ste zakázali. Notifikácie povolíte v nastaveniach vášho prehliadača.","disable":"Zakázať upozornenia","enable":"Povoliť upozornenia","each_browser_note":"Poznámka: Toto nastavenie musíte zmeniť v každom používanom prehliadači."},"dismiss_notifications_tooltip":"Označiť všetky neprečítané upozornenia ako prečítané","disable_jump_reply":"Neskočiť na môj príspevok po odpovedi","dynamic_favicon":"Zobraziť počet nových/upravených tém na ikone prehliadača","external_links_in_new_tab":"Otvoriť všekty externé odkazy v novej záložke","enable_quoting":"Umožniť odpoveď s citáciou z označeného textu","change":"zmeniť","moderator":"{{user}} je moderátor","admin":"{{user}} je administrátor","moderator_tooltip":"Tento používateľ je moderátor","admin_tooltip":"Tento používateľ je administrátor","blocked_tooltip":"Tento používateľ je zablokovaný","suspended_notice":"Tento  používateľ je suspendovaný do {{date}}","suspended_reason":"Dôvod:","github_profile":"Github","watched_categories":"Sledované","tracked_categories":"Sledované","muted_categories":"Ignorovaný","muted_categories_instructions":"Nebudete informovaní o udalostiach v nových témach týchto kategórií. Tieto témy sa zároveň nebudú zobrazovať v zozname posledných udalostí.","delete_account":"Vymazať môj účet","delete_account_confirm":"Ste si istý, že chcete permanentne vymazať váš účet? Táto akcia je nenávratná.","deleted_yourself":"Váš účet bol úspešne vymazaný.","delete_yourself_not_allowed":"Momentálne nie je možné vymazať váš učet. Kontaktujte administrátora a ten vám ho vymaže.","unread_message_count":"Správy","admin_delete":"Vymazať","users":"Používatelia","muted_users":"Ignorovaný","muted_users_instructions":"Pozastaviť všetky notifikácie od týchto užívateľov.","muted_topics_link":"Zobraziť umlčané témy","staff_counters":{"flags_given":"nápomocné značky","flagged_posts":"označkované príspevky","deleted_posts":"vymazané príspevky","suspensions":"pozastavenia","warnings_received":"upozornenia"},"messages":{"all":"Všetky","inbox":"Prijatá pošta","sent":"Odoslané","archive":"Archív","groups":"Moje skupiny","bulk_select":"Označ správy","move_to_inbox":"Presuň do prijatej pošty","move_to_archive":"Archív","failed_to_move":"Zlyhalo presunutie označených správ (možno je chyba vo vašom pripojení)","select_all":"Označ všetky"},"change_password":{"success":"(email odoslaný)","in_progress":"(email sa odosiela)","error":"(chyba)","action":"Odoslať email na reset hesla","set_password":"Nastaviť heslo"},"change_about":{"title":"Upraviť O mne"},"change_username":{"title":"Zmeniť užívateľské meno","taken":"Sorry, toto užívateľské meno je obsadené.","error":"Pri zmene užívateľského mena prišlo k chybe.","invalid":"Toto užívateľské meno nie je platné. Musí obsahovať iba znaky a čísla."},"change_email":{"title":"Zmeniť email","taken":"Prepáčte, tento email je už obsadený.","error":"Pri zmene emailu nastala chyba. Je možné, že je email už použitý?","success":"Na email sme odoslali správu. Nasledujte prosím inštrukcie pre potvrdenie."},"change_avatar":{"title":"Zmeniť váš profilový obrázok","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, podľa","gravatar_title":"Zmeňte váš avatar na webe Gravatar  ","refresh_gravatar_title":"Obnoviť váš Gravatar","letter_based":"Systém pridelil profilový obrázok","uploaded_avatar":"Vlastný obrázok","uploaded_avatar_empty":"Pridať vlastný obrázok","upload_title":"Nahrať váš obrázok","upload_picture":"Nahrať obrázok","image_is_not_a_square":"Upozornenie: váš obrázok sme orezali; mal rozdielnu šírku a výšku","cache_notice":"Váš profilový obrázok bol úspešne zmenený, ale jeho zobrazenie môže chvíľu trvať kvôli vyrovnávacej pamäti prehliadača."},"change_profile_background":{"title":"Pozadie profilu","instructions":"Pozadie profilu bude vystredené a s predvolenou šírkou 850px."},"change_card_background":{"title":"Pozadie karty používateľa","instructions":"Obrázky pozadia budú vystredené a s predvolenou šírkou 590px."},"email":{"title":"Email","instructions":"Nikdy verejne nezobrazené","ok":"Pošleme vám email pre potvrdenie","invalid":"Zadajte prosím platný email","authenticated":"Váš email bude autentifikovaný pomocou {{provider}}","frequency_immediately":"Odošleme vám email ak ste neprečítali to, čo vám posielame emailom.","frequency":{"one":"Odošleme vám email iba ak sme vás nevideli poslednú minútu","few":"Odošleme vám email iba ak sme vás nevideli posledné {{count}} minúty.","other":"Odošleme vám email iba ak sme vás nevideli posledných {{count}} minút"}},"name":{"title":"Meno","instructions":"Vaše celé meno (nepovinné)","instructions_required":"Vaše celé meno","too_short":"Vaše meno je prikrátke","ok":"Vaše meno je v poriadku"},"username":{"title":"Užívateľské meno","instructions":"Unikátne, bez medzier, krátke","short_instructions":"Ostatní vás môžu označiť ako @{{username}}","available":"Vaše užívateľské meno je voľné","global_match":"Email zodpovedá registrovanému užívateľskému menu","global_mismatch":"Už zaregistrované. Skúste {{suggestion}}?","not_available":"Nie je k dispozícii. Skúste {{suggestion}}?","too_short":"Vaše užívateľské meno je prikrátke","too_long":"Vaše užívateľské meno je pridlhé","checking":"Kontrolujeme dostupnosť užívateľského meno","enter_email":"Užívateľské meno nájdené, zadajte zodpovedajúci email","prefilled":"Email zodpovedá tomuto registrovanému užívateľskému menu"},"locale":{"title":"Jazyk rozhrania","instructions":"Jazyk úžívateľského rozhrania. Zmení sa po obnovení stránky.","default":"(predvolené)"},"password_confirmation":{"title":"Heslo znova"},"last_posted":"Posledný príspevok","last_emailed":"Posledný odemailovaný","last_seen":"Videný","created":"Spojený","log_out":"Odhlásiť sa","location":"Poloha","card_badge":{"title":"Odznak karty užívateľa"},"website":"Webová stránka","email_settings":"Email","like_notification_frequency":{"title":"Oznámiť pri lajknutí","always":"Vždy","never":"Nikdy"},"email_previous_replies":{"always":"vždy","never":"nikdy"},"email_digests":{"every_30_minutes":"každých 30 mintút","every_hour":"každú hodinu","daily":"denne","every_three_days":"každé tri dni","weekly":"týždenne","every_two_weeks":"každé dva týždne"},"email_direct":"Pošlite mi email ak ma niekto cituje, odpovie na môj príspevok, spomenie moje @užívateľské meno alebo ma pozve do témy.","email_private_messages":"Pošlite mi email keď mi niekto pošle správu","email_always":"Pošlite mi emailovú notifikáciu aj keď som aktívny na stránke","other_settings":"Ostatné","categories_settings":"Kategórie","new_topic_duration":{"label":"Považuj témy za nové keď","not_viewed":"Ešte som ich nevidel","last_here":"vytvorené odkedy som tu bol naposledy","after_1_day":"vytvorené za posledný deň","after_2_days":"vytvorené posledné 2 dni","after_1_week":"vytvorené za posledný týždeň","after_2_weeks":"vytvorené za posledné 2 týždne"},"auto_track_topics":"Automaticky sleduj témy, do ktorých vstúpim","auto_track_options":{"never":"nikdy","immediately":"ihneď","after_30_seconds":"po 30 sekundách","after_1_minute":"po 1 minúte","after_2_minutes":"po 2 minútach","after_3_minutes":"po 3 minútach","after_4_minutes":"po 4 minútach","after_5_minutes":"po 5 minútach","after_10_minutes":"po 10 minútach"},"invited":{"search":"začni písať pre hľadanie pozvánok","title":"Pozvánky","user":"Pozvaný užívateľ","sent":"Odoslané","none":"Nemáte žiadne čakajúce pozvánky.","truncated":{"one":"Zobrazuje sa prvá pozvánka.","few":"Zobrazujú sa prvé {{count}} pozvánky.","other":"Zobrazuje sa prvých {{count}} pozvánok."},"redeemed":"Použité pozvánky","redeemed_tab":"Použitá","redeemed_tab_with_count":"Použité ({{count}})","redeemed_at":"Použitá","pending":"Čakajúce pozvánky","pending_tab":"Čakajúca","pending_tab_with_count":"Čakajúce ({{count}})","topics_entered":"Zobrazených tém","posts_read_count":"Prečítaných príspevkov","expired":"Táto pozvánka vypršala.","rescind":"Odstrániť","rescinded":"Pozvánka odstránená","reinvite":"Poslať pozvánku znovu","reinvited":"Poslať pozvánku znovu","time_read":"Doba čítania","days_visited":"Dní na stránke","account_age_days":"Vek účtu v dňoch","create":"Poslať Pozvánku","generate_link":"Kopírovať Odkaz Pozvánky","generated_link_message":"\u003cp\u003eOdkaz pre pozvánku bol úspešne vytvorený!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eOdkaz je platný iba pre túto adresu: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Zatiaľ ste tu nikoho nepozvali. Môžete odosielať pozvánky individuálne alebo pozvať skupinu ľudí naraz pomocou \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003enahratia súboru\u003c/a\u003e.","text":"Hromadná pozvánka zo súboru","uploading":"Prebieha nahrávanie...","success":"Súbor bol úspešne odoslaný. Keď sa nahrávanie dokončí, budete na to upozornený cez správu.","error":"Pri nahrávaní '{{filename}}' sa vyskytla chyba: {{message}}"}},"password":{"title":"Heslo","too_short":"Vaše heslo je príliš krátke.","common":"Toto heslo je príliš časté.","same_as_username":"Vaše heslo je rovnaké ako používateľské meno.","same_as_email":"Vaše heslo je rovnaké ako e-mail.","ok":"Vaše heslo je v poriadku.","instructions":"Minimálne %{count} znakov."},"summary":{"title":"Sumarizácia","stats":"Štatistiky","top_replies":"Najvýznamnejšie odpovede","more_replies":"Viac odpovedí","top_topics":"Najvýznamnejšie témy","more_topics":"Viac tém","top_badges":"Najvýznamnejšie odznaky","more_badges":"Viac odznakov"},"associated_accounts":"Prihlásenia","ip_address":{"title":"Posledná IP adresa"},"registration_ip_address":{"title":"IP adresa pri registrácii"},"avatar":{"title":"Profilový obrázok","header_title":"profil, správy, záložky a nastavenia"},"title":{"title":"Názov"},"filters":{"all":"Všetky"},"stream":{"posted_by":"Autor príspevku","sent_by":"Odoslané používateľom","private_message":"správa","the_topic":"téma"}},"loading":"Prebieha načítavanie...","errors":{"prev_page":"pri pokuse o načítanie","reasons":{"network":"Chyba siete","server":"Chyba na serveri","forbidden":"Prístup zamietnutý","unknown":"Chyba","not_found":"Stránka nenájdená"},"desc":{"network":"Skontrolujte, prosím, svoje pripojenie.","network_fixed":"Zdá sa, že sme späť.","server":"Kód chyby: {{status}}","forbidden":"Nemáte oprávnenie na zobrazenie.","not_found":"Hopla, aplikácia sa pokúsila načítať adresu, ktorá neexistuje.","unknown":"Niečo sa pokazilo."},"buttons":{"back":"Späť","again":"Skúsiť znova","fixed":"Načítať stránku"}},"close":"Zatvoriť","assets_changed_confirm":"Táto stránka bola práve aktualizovaná. Obnoviť na najnovšiu verziu?","logout":"Boli ste odhlásený.","refresh":"Obnoviť","read_only_mode":{"enabled":"Stránky sú v móde iba na čítanie. Prosím pokračujte v prezeraní, ale iné akcie, ako odpovedanie, dávanie páči sa mi alebo niektové ďalšie sú teraz vypnuté.","login_disabled":"Keď je zapnutý mód iba na čítanie, prihlásenie nie je možné.","logout_disabled":"Odhlásenie nie je možné, kým je stránka v móde iba na čítanie."},"too_few_topics_and_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eZačnime diskusiu!\u003c/a\u003e Je tu \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tém a \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e príspevkov. Noví návštevníci potrebujú mať témy, ktoré môžu čítať a na ktoré budú reagovať.","too_few_topics_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eZačnime diskusiu!\u003c/a\u003e Je tu \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e tém. Noví návštevníci potrebujú mať témy, ktoré môžu čítať a na ktoré budú reagovať.","too_few_posts_notice":"\u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003eZačnime diskusiu!\u003c/a\u003e Je tu \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e príspevkov. Noví návštevníci potrebujú mať témy, ktoré môžu čítať a na ktoré budú reagovať.","learn_more":"zistiť viac...","year":"rok","year_desc":"témy vytvorené za posledných 365 dní","month":"mesiac","month_desc":"témy vytvorené za posledných 30 dní","week":"týždeň","week_desc":"témy vytvorené za posledných 7 dní","day":"deň","first_post":"Prvý príspevok","mute":"Ignorovať","unmute":"Prestať ignorovať","last_post":"Posledný príspevok","last_reply_lowercase":"posledná odpoveď","replies_lowercase":{"one":"odpoveď","few":"odpovede","other":"odpovedí"},"signup_cta":{"sign_up":"Registrovať sa","hide_session":"Pripomenúť zajtra","hide_forever":"nie, ďakujem","hidden_for_session":"Fajn, opýtam sa vás to zajtra. Stále môžete na vytvorenie účtu použiť aj možnosť 'Prihlásenie'.","intro":"Zdravím! :heart_eyes: Vyzerá, že sa vám diskusia páči, ale stále nie ste prihlásený na svojom účte.","value_prop":"Keď si vytvoríte účet, zapamätáme si čo ste čítali, takže sa môžete vrátiť presne tam, kde ste prestali. Okrem toho dostanete upozornenie tu, aj na váš e-mail, vždy keď pribudnú nové príspevky. A môžete označiť príspevky ktoré sa vám páčia. :heartbeat:"},"summary":{"enabled_description":"Pozeráte sa na zhrnutie tejto témy: najzaujímavejšie príspevky podľa výberu komunity.","enable":"Zhrnutie tejto témy","disable":"Zobraziť všetky príspevky"},"deleted_filter":{"enabled_description":"Táto téma obsahuje zmazané príspevky, ktoré boli skryté.","disabled_description":"Zmazané príspevky sa v téme zobrazujú.","enable":"Skryť zmazané príspevky","disable":"Zobraziť zmazané príspevky"},"private_message_info":{"title":"Správa","invite":"Pozvať ostatných...","remove_allowed_user":"Skutočne chcete odstrániť {{name}} z tejto správy?"},"email":"Email","username":"Používateľské meno","last_seen":"Videné","created":"Vytvorené","created_lowercase":"vytvorené","trust_level":"Stupeň dôvery","search_hint":"používateľské meno, email alebo IP adresa","create_account":{"title":"Vytvoriť nový účet","failed":"Niečo sa pokazilo, možno je tento e-mail už registrovaný, vyskúšajte odkaz pre zabudnuté heslo"},"forgot_password":{"title":"Obnovenie hesla","action":"Zabudol som svoje heslo","invite":"Napíšte vaše používateľské meno alebo e-mailovú adresu a pošleme vám e-mail pre obnovu hesla.","reset":"Obnoviť heslo","complete_username":"Ak je účet priradený k používateľskému menu \u003cb\u003e%{username}\u003c/b\u003e, čoskoro dostanete e-mail s pokynmi, ako si obnoviť svoje heslo.","complete_email":"Ak je účet priradený k \u003cb\u003e%{email}\u003c/b\u003e, čoskoro dostanete e-mail s pokynmi, ako si obnoviť svoje heslo.","complete_username_found":"Našli sme účet priradený k používateľskému menu \u003cb\u003e%{username}\u003c/b\u003e, čoskoro dostanete e-mail s pokynmi, ako si obnoviť svoje heslo.","complete_email_found":"Našli sme účet priradený k \u003cb\u003e%{email}\u003c/b\u003e, čoskoro dostanete e-mail s pokynmi, ako si obnoviť svoje heslo.","complete_username_not_found":"Žiadny účet nemá priradené používateľské meno \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Žiadny účet nie je s e-mailom  \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Prihlásenie","username":"Používateľ","password":"Heslo","email_placeholder":"e-mail alebo používateľské meno","caps_lock_warning":"Caps Lock je zapnutý","error":"Neznáma chyba","rate_limit":"Pred opätovným prihlásením chvíľku počkajte.","blank_username_or_password":"Zadajte prosím svoj e-mail alebo používateľské meno a heslo.","reset_password":"Obnoviť heslo","logging_in":"Prebieha prihlásenie...","or":"Alebo","authenticating":"Prebieha overovanie...","awaiting_confirmation":"Váš účet čaká na aktiváciu. Ak chcete zaslať aktivačný e-mail znova, použite odkaz pre zabudnuté heslo.","awaiting_approval":"Váš účet zatiaľ nebol schválený členom tímu. Keď bude schválený, dostanete e-mail.","requires_invite":"Prepáčte, ale prístup k tomuto fóru majú iba pozvaní používatelia.","not_activated":"Systém vás nemôže prihlásiť. Na emailovú adresu \u003cb\u003e{{sentTo}}\u003c/b\u003e sme vám poslali aktivačný email. Prosím, postupujte podľa inštrukcií na aktiváciu účtu, ktoré sú uvedené v tomto emaile.","not_allowed_from_ip_address":"Nie je možné prihlásenie z tejto IP adresy.","admin_not_allowed_from_ip_address":"Nie je možné prihlásenie ako admin z tejto IP adresy.","resend_activation_email":"Kliknite sem pre opätovné odoslanie aktivačného emailu.","sent_activation_email_again":"Odoslali sme vám ďalší aktivačný email na \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Môže trvať niekoľko minút kým príde; pre istotu si skontrolujte spamový priečinok.","to_continue":"Prosím, prihláste sa","preferences":"Na zmenu používateľských nastavení musíte byť prihlásený.","forgot":"Nepamätám si detaily môjho účtu","google":{"title":"pomocou Google","message":"Prihlásenie pomocou Google účtu (prosím uistite sa, že vyskakovacie okná sú povolené)"},"google_oauth2":{"title":"pomocou Google","message":"Prihlásenie pomocou Google účtu (prosím uistite sa, že vyskakovacie okná sú povolené)"},"twitter":{"title":"pomocou Twitter účtu","message":"Prihlásenie pomocou Twitter účtu (prosím uistite sa, že vyskakovacie okná sú povolené)"},"instagram":{"title":"so službou Instagram","message":"Prihlásenie pomocou Instagram účtu (prosím uistite sa, že vyskakovacie okná sú povolené)"},"facebook":{"title":"pomocou stránky Facebook","message":"Prihlásenie pomocou Facebook účtu (prosím uistite sa, že vyskakovacie okná sú povolené)"},"yahoo":{"title":"pomocou Yahoo","message":"Prihlásenie pomocou Yahoo účtu (prosím uistite sa, že vyskakovacie okná sú povolené)"},"github":{"title":"pomocou GitHub","message":"Prihlásenie pomocou GitHub účtu (prosím uistite sa, že vyskakovacie okná sú povolené)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"viac ...","options":"Možnosti","whisper":"šepot","add_warning":"Toto je oficiálne varovanie.","toggle_whisper":"Prepnúť šepot","posting_not_on_topic":"Na akú tému chcete odpovedať?","saving_draft_tip":"ukladám...","saved_draft_tip":"uložené","saved_local_draft_tip":"uložené lokálne","similar_topics":"Vaša téma je podobná...","drafts_offline":"offline koncepty","error":{"title_missing":"Názov je povinný","title_too_short":"Názov musí mať minimálne {{min}} znakov","title_too_long":"Názov nesmie byť dlhší než {{max}} znakov","post_missing":"Príspevok nesmie byť prázdny","post_length":"Príspevok musí mať minimálne {{min}} znakov","try_like":"Skúsili ste \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e tlačítko?","category_missing":"Musíte vybrať kategóriu"},"save_edit":"Uložiť úpravy","reply_original":"Odpovedať na pôvodnú tému","reply_here":"Odpovedať tu","reply":"Odpovedať","cancel":"Zrušiť","create_topic":"Vytvoriť tému","create_pm":"Správa","title":"Alebo stlačte Ctrl+Enter","users_placeholder":"Pridať používateľa","title_placeholder":"O čom je této diskusia v jednej stručnej vete?","edit_reason_placeholder":"prečo upravujete?","show_edit_reason":"(pridajte dôvod úpravy)","reply_placeholder":"Píšte sem. Formátujte pomocou Markdown, BBCode alebo HTML. Pretiahnite alebo vložte obrázky.","view_new_post":"Zobraziť nový príspevok.","saving":"Ukladanie","saved":"Uložené!","saved_draft":"Návrh príspevku rozpracovaný. Vyberte na obnovenie.","uploading":"Upload prebieha...","show_preview":"zobraziť náhľad \u0026raquo;","hide_preview":"\u0026raquo; skryť náhľad","quote_post_title":"Citovať celý príspevok","bold_title":"Výrazne","bold_text":"výrazný text","italic_title":"Zdôraznene","italic_text":"zdôraznený text","link_title":"Hyperlink","link_description":"tu zadaj popis odkazu","link_dialog_title":"Vložte hyperlink","link_optional_text":"nepovinný názov","quote_title":"Úvodzovky","quote_text":"Úvodzovky","code_title":"Preformátovaný text","code_text":"Odsaďte preformátovaný text 4 medzerami","upload_title":"Upload","upload_description":"tu zadajte popis uploadu","olist_title":"Číslované odrážky","ulist_title":"Odrážky","list_item":"Položka zoznamu","heading_title":"Nadpis","heading_text":"Nadpis","hr_title":"Horizonálny oddeľovač","help":"Nápoveda úprav pre Markdown","toggler":"skryť alebo zobraziť panel úprav","modal_ok":"OK","modal_cancel":"Zrušiť","cant_send_pm":"Ľutujeme, nemôžete poslať správu pre %{username}.","admin_options_title":"Nepovinné zamestnanecké nastavenia pre túto tému","auto_close":{"label":"Čas na automatické uzavretie témy:","error":"Prosím zadajte platnú hodnotu.","based_on_last_post":"Nezatvárať pokým posledný príspevok v téme nie je takto starý.","all":{"examples":"Zadajte číslo v hodinách (24), absolútny čas (17:30) alebo časovú značku (2013-11-22 14:00)."},"limited":{"units":"(# hodín)","examples":"Zadajte počet hodín (24)."}}},"notifications":{"title":"oznámenia o zmienkach pomocou @name, odpovede na vaše príspevky a témy, správy atď.","none":"Notifikácie sa nepodarilo načítať","more":"zobraziť staršie upozornenia","total_flagged":"označených príspevkov celkom","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e prijal Vaše pozvanie\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e presunul {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eZískal '{{description}}'\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} správa vo vašej {{group_name}} schránke\u003c/p\u003e","few":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} správy vo vašej {{group_name}} schránke\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} správ vo vašej {{group_name}} schránke\u003c/p\u003e"},"alt":{"mentioned":"Spomenutý od","quoted":"Citovaný od","replied":"Odpovedané","posted":"Príspevok od","edited":"Upravte Váš príspevok do","liked":"Váš príspevok sa páčil","private_message":"Súkromná správa od","invited_to_private_message":"Pozvaný na súkromné správy od","invited_to_topic":"Pozvaný k téme od","invitee_accepted":"Pozvánka akceptovaná ","moved_post":"Váš príspevok bol presunutý ","linked":"Odkaz na váš príspevok","granted_badge":"Priznaný odznak","group_message_summary":"Správy v skupinovej schránke"},"popup":{"mentioned":"{{username}} vás spomenul v \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} vás spomenul v \"{{topic}}\" - {{site_title}}","quoted":"{{username}} vás citoval v \"{{topic}}\" - {{site_title}}","replied":"{{username}} vám odpovedal v \"{{topic}}\" - {{site_title}}","posted":"{{username}} prispel v \"{{topic}}\" - {{site_title}}","private_message":"{{username}} vám poslal súkromnú správu v \"{{topic}}\" - {{site_title}}","linked":"{{username}} odkázal na váš príspevok z \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Pridať obrázok","title_with_attachments":"Pridať obrázok alebo súbor","from_my_computer":"Z počítača","from_the_web":"Z webu","remote_tip":"odkaz na obrázok","remote_tip_with_attachments":"odkaz na obrázok alebo súbor {{authorized_extensions}}","local_tip":"zvoľte obrázok z vášho počítača","local_tip_with_attachments":"zvoľte obrázok alebo súbor z vášho počítača {{authorized_extensions}}","hint":"(môžete taktiež potiahnuť a pustiť do editora pre nahratie)","hint_for_supported_browsers":"môžete taktiež potiahnuť a pustiť alebo priložiť obrázky do editora","uploading":"Nahrávanie","select_file":"Zvoľte súbor","image_link":"adresa na ktorú bude odkazovať váš obrázok"},"search":{"sort_by":"Zoradiť podľa","relevance":"Relevancia","latest_post":"Najnovší príspevok","most_viewed":"Najviac prezerané","most_liked":"Najviac sa páčia","select_all":"Označ všetky","clear_all":"Odznač všetky","result_count":{"one":"1 výsledok pre \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","few":"{{count}} výsledky pre \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} výsledkov pre \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"hľadaj témy, príspevky, užívateľov, alebo kategórie","no_results":"Žiadne výsledky","no_more_results":"Nenašlo sa viac výsledkov","search_help":"Pomoc pri vyhľadávaní","searching":"Vyhľadávam.....","post_format":"#{{post_number}} podľa {{username}}","context":{"user":"Vyhľadávanie podľa @{{username}}","topic":"Hľadaj v tejto téme","private_messages":"Hľadaj správy"}},"hamburger_menu":"prejsť na iné témy, alebo kategórie","new_item":"nový","go_back":"späť","not_logged_in_user":"užívateľská stránka so súhrnom aktivít a nastavení","current_user":"prejsť na Vašu uťívateľskú stránku","topics":{"bulk":{"unlist_topics":"Dôverné témy","reset_read":"Obnoviť prečítané","delete":"Zmazať témy","dismiss":"Zahodiť","dismiss_read":"Zahodiť všetký neprečítané","dismiss_button":"Zahadzujem.....","dismiss_tooltip":"Zahoď nové príspevky, alebo prestaň sledovať témy","also_dismiss_topics":"Prestať sledovať tieto témy. Už sa nikdy nebudu ukazovať medzi neprečítanými","dismiss_new":"Zahodiť. Nová","toggle":"prepnuť hromadne vybrané témy","actions":"Hromadné akcie","change_category":"Zmeň kategóriu","close_topics":"Uzavrieť tému","archive_topics":"Archivuj témy","notification_level":"Zmeň úroveň upozorňovania","choose_new_category":"Vyberte pre tému novú kategóriu:","selected":{"one":"Označíli ste \u003cb\u003e1\u003c/b\u003e tému.","few":"Označíli ste \u003cb\u003e{{count}}\u003c/b\u003e tém.y","other":"Označíli ste \u003cb\u003e{{count}}\u003c/b\u003e tém."}},"none":{"unread":"Nemáte neprečítanú tému","new":"Nemáte žiadnu novú tému","read":"Neprečítali ste ešte žiadnu tému.","posted":"Nanapísali ste ešte žiadnu tému.","latest":"Nie sú žiadne nové témy. To je smutné.","hot":"Nie sú žiadne horúce témy.","bookmarks":"Nemáte žiadne témy v záložke","category":"V kategórii {{category}} nie je žiadna téma","top":"Nie sú žiadne populárne témy.","search":"Nenašli sa žiadne výsledky"},"bottom":{"latest":"Nie je už viac najnovšich tém.","hot":"Nie je už viac horúcich tém","posted":"Žiadne ďalšie témy na čítanie.","read":"Žiadne ďalšie prečítané témy.","new":"Žiadne nové témy.","unread":"Žiadne ďalšie neprečítané témy.","category":"Žiadne ďalšie témy v  {{category}}.","top":"Nie je už viac poulárnych tém","bookmarks":"Žiadne ďalšie témy v záložkách.","search":"Nenašlo sa viac výsledkov."}},"topic":{"unsubscribe":{"stop_notifications":"Teraz budete dostávať menej upozornení na \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Váš súčasný stav upozornení je"},"create":"Nová téma","create_long":"Vytvoriť novú tému","private_message":"Vytvoríť správu","archive_message":{"help":"Presunúť správu do archívu","title":"Archivovať"},"move_to_inbox":{"title":"Presunúť do schránky","help":"Presunúť správu späť do schránky"},"list":"Témy","new":"nová téma","unread":"neprečítané","new_topics":{"one":"1 nová téma","few":"{{count}} nové témy","other":"{{count}} nových tém"},"unread_topics":{"one":"1 neprečítaná téma","few":"{{count}} neprečítané témy","other":"{{count}} neprečítaných tém"},"title":"Témy","invalid_access":{"title":"Téma je súkromná","description":"Prepáčte, nemáte prístup k tejto téme!","login_required":"Musíte sa prihlásiť, aby ste videli túto tému."},"server_error":{"title":"Tému sa nepodarilo načítať","description":"Prepáčte, nepodarllo sa nám načítať túto tému, možno je problém s Vaším pripojením. Prosim skúste znova. Ak problém pretrváva, dajte nám vedieť"},"not_found":{"title":"Téma sa nenašla","description":"Prepáčte, hľadaná téma nebola nájdená. Nebola odstránená moderátorom?"},"total_unread_posts":{"one":"máte 1 neprečítaný príspevok k tejto téme","few":"máte {{count}} neprečítanépríspevky k tejto téme","other":"máte {{count}} neprečítaných príspevkov k tejto téme"},"unread_posts":{"one":"máte 1 starší neprečítaný príspevok k tejto téme","few":"máte {{count}} staršie neprečítané príspevky k tejto téme","other":"máte {{count}} starších neprečítaných príspevkov k tejto téme"},"new_posts":{"one":"pribudol 1 nový príspevok odkedy ste čítali túto tému naposledy ","few":"pribudlo  {{count}}  nové príspevky odkedy ste čítali túto tému naposledy ","other":"pribudlo  {{count}}  nových príspevkov odkedy ste čítali túto tému naposledy "},"likes":{"one":"v tejto téme je jedo \"Páči sa\"","few":"v tejto téme je  {{count}} \"Páči sa\"","other":"v tejto téme je  {{count}} \"Páči sa\""},"back_to_list":"Naspäť na zoznam tém","options":"Možnosti tém","show_links":"zobrazovať odkazy v tejto téme","toggle_information":"zmeniť detaily témy","read_more_in_category":"Chcete si prečítať viac? Prezrite si témy v {{catLink}} alebo v {{latestLink}}.","read_more":"Chcete si prečítať viac?  {{catLink}} alebo v {{latestLink}}.","browse_all_categories":"Prezrieť všetky kategórie","view_latest_topics":"zobraziť najnošie témy","suggest_create_topic":"Čo tak vytvoriť novú tému?","jump_reply_up":"prejsť na predchádzajúcu odpoveď","jump_reply_down":"prejsť na nasledujúcu odpoveď","deleted":"Téma bola vymazaná","auto_close_notice":"Táto téma bude automaticky uzavretá o %{timeLeft}.","auto_close_notice_based_on_last_post":"Táto téma bude uzavretá %{duration} po poslednej odpovedi.","auto_close_title":"Nastavenia automatického zatvárania","auto_close_save":"Uložiť","auto_close_remove":"Neuzatvárať túto tému automaticky","progress":{"title":"pozícia v téme","go_top":"na začiatok","go_bottom":"na spodok","go":"Choď","jump_bottom":"choď na posledný príspevok","jump_bottom_with_number":"choď na príspevok číslo %{post_number}","total":"Všetkých príspevkov","current":"tento príspevok"},"notifications":{"reasons":{"3_6":"Budete dostávať upozornenia, pretože sa pozeráte na túto kategóriu.","3_5":"Budete automaticky dostávať upozornenie pretože ste začali pozorovať túto tému.","3_2":"Budete dostávať upozornenia, pretože sa pozeráte na túto tému.","3_1":"Budete dostávať upozornenia, pretože ste vytvorili túto tému.","3":"Budete dostávať upozornenia, pretože sa pozeráte na túto tému.","2_8":"Budete dostávať upozornenia, pretože sledujete túto kategóriu.","2_4":"Budete dostávať upozornenia, pretože ste zaslali odpoveď na túto tému.","2_2":"Budete dostávať upozornenia, pretože sledujete túto tému.","2":"Budete dostávať upozornenia, pretože ste \u003ca href=\"/users/{{username}}/preferences\"\u003ečítali túto tému\u003c/a\u003e.","1_2":"Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie.","1":"Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie.","0_7":"Ignorujete všetky upozornenia v tejto kategórii.","0_2":"Ignorujete všetky upozornenia k tejto téme.","0":"Ignorujete všetky upozornenia k tejto téme."},"watching_pm":{"title":"Pozerať","description":"Budete upozornený na každú novu dopoveť na túto správu, a zobrazí sa počet nových odpovedí"},"watching":{"title":"Pozerať","description":"Budete upozornený na každú novu dopoveť na túto tému, a zobrazí sa počet nových odpovedí"},"tracking_pm":{"title":"Sledovať","description":"Zobrazí počet nových odpovedí na túto správu. Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie."},"tracking":{"title":"Sledovať","description":"Zobrazí počet nových odpovedí na túto tému. Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie."},"regular":{"title":"Bežný","description":"Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie."},"regular_pm":{"title":"Bežný","description":"Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie."},"muted_pm":{"title":"Stíšené","description":"Nikdy nebudete upozornení na nič ohľadom tejto správy"},"muted":{"title":"Stíšené","description":"Nikdy nebudete upozornení na nič ohľadom tejto témy, a nebude sa zobrazovať medzi najnovšími."}},"actions":{"recover":"Obnoviť zmazanú tému","delete":"Zmazať tému","open":"Otvoriť tému","close":"Uzavrieť tému","multi_select":"Označ príspevky....","auto_close":"Automaticky zatvor....","pin":"Pripni tému....","unpin":"Odopni tému....","unarchive":"Zruš archiváciu témy","archive":"Archívuj tému","invisible":"Skyť","visible":"Zobraziť","reset_read":"Zrušiť načítané údaje"},"feature":{"pin":"Pripni tému","unpin":"Odopni tému","pin_globally":"Pripni tému globálne","make_banner":"Banerová téma","remove_banner":"Odstrániť banerovú tému"},"reply":{"title":"Odpovedať","help":"vytvor odpoveď k tejto téme"},"clear_pin":{"title":"Zruš pripnutie","help":"Zruší pripnutie tejto témy takže sa už viac nebude objavovať na vrchu Vášho zoznamu tém"},"share":{"title":"Zdielaj","help":"zdieľaj odkaz na túto tému"},"flag_topic":{"title":"Označ","help":"súkromne označiť túto tému do pozornosti, alebo na ňu poslať súkromne upozornenie","success_message":"Úspešne ste označili tému."},"feature_topic":{"title":"Vyzdvihni túto tému","pin":"Zobrazuj túto tému na vrchu  {{categoryLink}} kategórie do","confirm_pin":"Máte už {{count}} pripnutých tém. Príliš veľa pripnutých tém môže byť na príťaž pre nových a anonymných užívateľov. Ste si istý že chcete pripnúť ďalšiu tému v tejto kategórii?","unpin":"Zruš túto tému z vrcholu kategórie {{categoryLink}} . ","unpin_until":"Zruš túto tému z vrcholu kategórie {{categoryLink}} , alebo počkaj do \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Užívatelia si môžu sami odopnúť tému ","pin_validation":"Dátum je vyžadovaný k pripnutiu tejto témy.","not_pinned":"V {{categoryLink}} nie sú pripnuté žiadne témy.","already_pinned":{"one":"Téma pripnutá k {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","few":"Témy pripnuté ku {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Tém pripnutých k {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Zobrazuj túto tému na vrchu všetkých zoznamov tém do","confirm_pin_globally":"Máte už {{count}} globálne pripnutých tém. Príliš veľa pripnutých tém môže byť na príťaž pre nových a anonymných užívateľov. Ste si istý že chcete pripnúť ďalšiu globálnu tému?","unpin_globally":"Zruš túto tému z vrcholu všetkých zoznamov tém. ","unpin_globally_until":"Zruš túto tému z vrcholu všetkých zoznamov tém, alebo počkaj do \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Užívatelia si môžu sami odopnúť tému.","not_pinned_globally":"Nie sú pripnuté žiadne globálne témy.","already_pinned_globally":{"one":"Globálne pripnutá téma : \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","few":"Globálne pripnuté témy : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Globálne pripnutých tém : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Spraviť z tejto témy baner, ktorý sa zobrazí navrchu každej stránky.","remove_banner":"Odstrániť baner, ktorý sa zobrazuje navrchu každej stránky.","banner_note":"Užívatelia môžu banner kedykoľvek zrušiť. Bannerom môže byť v jednom momente len jedna téma.","no_banner_exists":"Neexistuje žiadna banerová téma.","banner_exists":"Banerová téma \u003cstrong class='badge badge-notification unread'\u003eje\u003c/strong\u003e aktuálne nastavená."},"inviting":"Pozývam...","invite_private":{"title":"Pozvať do konverzácie","email_or_username":"Email, alebo užívateľské meno pozvaného","email_or_username_placeholder":"emailova adresa alebo uťívateľské meno","action":"Pozvi","success":"Pozvali sme tohoto uťívateľa aby sa podieľal na tejto správe","error":"Prepáčte,  pri pozývaní tohto užívateľa nastala chyba.","group_name":"názov skupiny"},"controls":"Ovládacie prvky Témy","invite_reply":{"title":"Pozvi","username_placeholder":"používateľské meno","action":"Pošli pozvánku","help":"pozvite ostatných k tejto téme prostredníctvom emailu, alebo upozornení","to_forum":"Pošleme krátký email dovoľujúci Vášmu priateľovi okamžité pripojenie kliknutím na odkaz bez potreby prihlasovania","sso_enabled":"Zadajte uťívateľské meno osoby, ktorú by ste radi pozvali k tejto téme","to_topic_blank":"Zadajte uťívateľské meno alebo email osoby, ktorú by ste radi pozvali k tejto téme","to_topic_email":"Zadali ste emailovú adresu. Pošleme pozvánku ktorá umožní Vášmu priateľovi okamžitú odpoveď k tejto téme.","to_topic_username":"Zadali ste užívateľské meno. Pošleme mu pozvánku s odkazom na túto tému.","to_username":"Zadajte užívateľské meno osoby, ktorú chcete pozvať. Pošleme mu pozvánku s odkazom na túto tému.","email_placeholder":"name@example.com","success_email":"Poslali sme email s pozvánkou na \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Upozorníme vas keď bude pozvánka použítá. Svoje pozvánky môžte sledovať v tabuľke pozvánok vo svojom užívateľskom profile.","success_username":"Pozvali sme tohoto uťívateľa aby sa podieľal na tejto téme.","error":"Prepáčte, Nepodarilo sa nám pozvať túto osobu. Nebola už náhodou pozvaná ? (Počet opakovaných pozvánok je obmedzený)"},"login_reply":"Príhláste sa ak chcete odpovedať","filters":{"n_posts":{"one":"1 príspevok","few":"{{count}} príspevky","other":"{{count}} príspevkov"},"cancel":"Zruš filter"},"split_topic":{"title":"Presuň na novú tému","action":"presuň na novú tému","topic_name":"Názov novej témy","error":"Nastala chyba pri presune príspevku na novú tému.","instructions":{"one":"Vytvárate novú tému do ktorej bude vložený príspevok, ktorý ste označili. ","few":"Vytvárate novú tému do ktorej bude vložených \u003cb\u003e{{count}}\u003c/b\u003e príspevkov, ktoré ste označili. ","other":"Vytvárate novú tému do ktorej budú vložené \u003cb\u003e{{count}}\u003c/b\u003e príspevky, ktoré ste označili. "}},"merge_topic":{"title":"Presuň do existujúcej témy.","action":"presuň do existujúcej témy","error":"Nastala chyba pri presune príspevku do tejto témy.","instructions":{"one":"Prosím vyberte tému do ktorej chcete presunúť tento príspevok.","few":"Prosím vyberte tému do ktorej chcete presunúť tieto \u003cb\u003e{{count}}\u003c/b\u003e príspevky.","other":"Prosím vyberte tému do ktorej chcete presunúť týchto \u003cb\u003e{{count}}\u003c/b\u003e príspevkov."}},"change_owner":{"title":"Zmeň vlástníka príspevkov","action":"zmeň vlastníka","error":"Nastala chyba pri zmene vlastníka príspevkov.","label":"Príspevky nového vlastníka","placeholder":"užívateľske meno nového vlastnika","instructions":{"one":"Prosím vyberte nového vlastníka  príspevku vytvoreného \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"Prosím vyberte nového vlastníka {{count}}  príspevkov vytvorených \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Prosím vyberte nového vlastníka {{count}}  príspevkov vytvorených \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Poznámka: Žiadne upozornenie o tomto príspevku nebude spätne zaslané novým užívateľom\u003cbr\u003eUpozornenie: Momentálne nie sú prenášané žiadne dáta vťahujúce sa k príspevku na nových užívateľov. Používajte opatrne."},"change_timestamp":{"title":"Nastavte časovú značku","action":"nastavte časovú značku","invalid_timestamp":"Časová značka nemôže byť v budúcnosti. ","error":"Nastala chyba pri zmene časovej značky témy.","instructions":"Prosím vyberte novú časovú značku témy. Príspevky k téme budu aktualizované so zachovaním časoveho rozdielu."},"multi_select":{"select":"označ","selected":"označených ({{count}})","select_replies":"označ +odpovede","delete":"zmaž označené","cancel":"zrušiť výber","select_all":"označ všetko","deselect_all":"odznač všetko","description":{"one":"Označili ste \u003cb\u003e1\u003c/b\u003e príspevok","few":"Označili ste \u003cb\u003e{{count}}\u003c/b\u003e príspevky","other":"Označili ste \u003cb\u003e{{count}}\u003c/b\u003e príspevkov"}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"citovať odpoveď","edit":"Upravujete {{link}} {{replyAvatar}} {{username}}","edit_reason":"Dôvod:","post_number":"príspevok {{number}}","last_edited_on":"príspevok naposledy upravený","reply_as_new_topic":"Odpoveď ako súvisiaca téma","continue_discussion":"Pokračovanie diskusie z {{postLink}}:","follow_quote":"prejsť na citovaný príspevok","show_full":"Zobraziť celý príspevok","show_hidden":"Zobraziť skrytý obsah.","deleted_by_author":{"one":"(príspevky stiahnuté autorom budú automaticky zmazané za jednu hodinu pokiaľ nie sú označené)","few":"(príspevky stiahnuté autorom budú automaticky zmazané za %{count} hodiny pokiaľ nie sú označené)","other":"(príspevky stiahnuté autorom budú automaticky zmazané za %{count} hodín pokiaľ nie sú označené)"},"expand_collapse":"rozbaliť/zbaliť","gap":{"one":"zobraziť skrytú odpoveď","few":"zobraziť {{count}} skryté odpovede","other":"zobraziť {{count}} skrytých odpovedí"},"unread":"Príspevok je neprečítaný.","has_replies":{"one":"{{count}} Odpoveď","few":"{{count}} Odpovede","other":"{{count}} Odpovedí"},"has_likes":{"one":"{{count}} \"Páči sa\"","few":"{{count}} \"Páči sa\"","other":"{{count}} \"Páči sa\""},"has_likes_title":{"one":"Tento príspevok sa páčil jedej osobe","few":"Tento príspevok sa páčil {{count}}  ľuďom","other":"Tento príspevok sa páčil {{count}}  ľuďom"},"has_likes_title_only_you":"tento príspevok sa Vám páči","has_likes_title_you":{"one":"Tento príspevok sa páčil Vám a jednej ďalšej osobe","few":"Tento príspevok sa páčil Vám a ďalším {{count}} ľuďom","other":"Tento príspevok sa páčil Vám a ďalším {{count}} ľuďom"},"errors":{"create":"Ľutujeme, pri vytváraní príspevku nastala chyba. Prosím, skúste znovu.","edit":"Ľutujeme, pri úprave príspevku nastala chyba. Prosím, skúste znovu.","upload":"Ľutujeme, pri nahrávaní súboru nastala chyba. Prosím, skúste znovu.","too_many_uploads":"Ľutujeme, ale naraz je možné nahrať len jeden súbor.","upload_not_authorized":"Ľutujeme, súbor, ktorý sa pokúšate nahrať nemá povolenú príponu  (povolené prípony sú: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Ľutujeme, noví použivatelia nemôžu nahrávať obrázky.","attachment_upload_not_allowed_for_new_user":"Ľutujeme, noví používatelia nemôžu nahrávať prílohy.","attachment_download_requires_login":"Ľutujeme, pre stiahnutie príloh musíte byť prihlásený."},"abandon":{"confirm":"Ste si istý, že chcete zahodiť tento príspevok?","no_value":"Nie, ponechať.","yes_value":"Áno, zahodiť."},"via_email":"tento príspevok prišiel emailom","whisper":"tento príspevok je súkromným šepotom pre moderátorov","wiki":{"about":"tento príspevok je wiki"},"archetypes":{"save":"Uložiť možnosti"},"controls":{"reply":"vytvorte odpoveď na tento príspevok","like":"páči sa mi tento príspevok","has_liked":"tento príspevok sa Vám páči","undo_like":"zruš \"Páči sa\"","edit":"Editovať tento príspevok.","edit_anonymous":"Ľutujeme, ale pre úpravu príspevku je potrebné sa prihlásiť.","flag":"súkromne označiť tento príspevok do pozornosti, alebo naň poslať súkromne upozornenie","delete":"odstrániť tento príspevok","undelete":"vrátiť späť odstránenie príspevku","share":"zdieľať odkaz na tento príspevok","more":"Viac","delete_replies":{"confirm":{"one":"Chcete tiež odstrániť {{count}} priamu reakciu na tento príspevok?","few":"Chcete tiež odstrániť {{count}} priame reakcie na tento príspevok?","other":"Chcete tiež odstrániť {{count}} priamych reakcií na tento príspevok?"},"yes_value":"Áno, odstrániť aj reakcie.","no_value":"Nie, len tento príspevok."},"admin":"akcie administrátora príspevku","wiki":"Spraviť Wiki","unwiki":"Odstrániť Wiki","convert_to_moderator":"Pridať farbu personálu","revert_to_regular":"Odobrať farbu personálu","rebake":"Pregenerovať HTML","unhide":"Odokryť","change_owner":"Zmeniť vlastníctvo"},"actions":{"flag":"Označ","defer_flags":{"one":"Zrušiť označenie","few":"Zrušiť označenia","other":"Zrušiť označenia"},"undo":{"off_topic":"Zruš označenie","spam":"Zruš označenie","inappropriate":"Zruš označenie","bookmark":"Vrátiť záložku späť","like":"Zruš \"Páči sa\"","vote":"Zruš hlasovanie"},"people":{"vote":"hlasovať za toto"},"by_you":{"off_topic":"Označíli ste to ako mimo tému","spam":"Označíli ste to ako spam","inappropriate":"Označíli ste to ako nevhodné","notify_moderators":"Označíli ste to pre moderátora","notify_user":"Poslali ste správu užívateľovi ","bookmark":"Vytvorili ste si záložku na tento príspevok","like":"Páči sa Vám to","vote":"Hlasoval ste za tento príspevok"},"by_you_and_others":{"off_topic":{"one":"Vy a 1 ďalšia osoba to označílo ako mimo tému","few":"Vy a ďalšie {{count}} osoby to označíli ako mimo tému","other":"Vy a ďalších {{count}} osôb to označílo ako mimo tému"},"spam":{"one":"Vy a 1 ďalšia osoba to označíla ako spam","few":"Vy a ďalšie {{count}} osoby to označíli ako spam","other":"Vy a ďalších {{count}} osôb to označílo ako spam"},"inappropriate":{"one":"Vy a jedna ďalšia osoba to označila ako nevhodné","few":"Vy a ďalšie {{count}} osoby to označili ako nevhodné","other":"Vy a ďalších {{count}} osôb to označilo ako nevhodné"},"notify_moderators":{"one":"Vy a jedna ďalšia osoba to označila na moderovanie","few":"Vy a ďalšie {{count}} osoby to označili na moderovanie","other":"Vy a ďalších {{count}} osôb to označilo na moderovanie"},"notify_user":{"one":"Vy a jedna ďalšia osoba poslala správu tomuto užívateľovi","few":"Vy a ďalšie {{count}} osoby poslali správu tomuto užívateľovi","other":"Vy a ďalších {{count}} osôb poslalo správu tomuto užívateľovi"},"bookmark":{"one":"Vy a jedna ďalšia osoba si vytvorilo záložku na tento príspevok","few":"Vy a ďalšie {{count}} osoby si vytvorili záložku na tento príspevok","other":"Vy a ďalších {{count}} osôb si vytvorilo záložku na tento príspevok"},"like":{"one":"Páči sa to Vám a jendej ďalšej osobe","few":"Páči sa to Vám a ďalším {{count}} osobám","other":"Páči sa to Vám a ďalším {{count}} osobám"},"vote":{"one":"Vy a jenda ďalšia osoba hlasovala za tento príspevok","few":"Vy a ďalšie {{count}} osoby hlasovalo za tento príspevok","other":"Vy a ďalších {{count}} osôb hlasovalo za tento príspevok"}},"by_others":{"off_topic":{"one":"1 osoba to označíla ako mimo tému","few":"{{count}} osoby to označíli ako mimo tému","other":"{{count}} osôb to označílo ako mimo tému"},"spam":{"one":"1 osoba to označíla ako spam","few":"{{count}} osoby to označíli ako spam","other":"{{count}} osôb to označílo ako spam"},"inappropriate":{"one":"1 osoba to označila ako nevhodné","few":"{{count}} osoby to označili ako nevhodné","other":"{{count}} osôb to označilo ako nevhodné"},"notify_moderators":{"one":"1 osoba to označila na moderovanie","few":"{{count}} osoby to označili na moderovanie","other":"{{count}} osôb to označilo na moderovanie"},"notify_user":{"one":"1 osoba poslala správu tomuto užívateľovi","few":"{{count}} osoby poslali správu tomuto užívateľovi","other":"{{count}} osôb poslalo správu tomuto užívateľovi"},"bookmark":{"one":"1 osoba si vytvorila záložku na tento príspevok","few":"{{count}} osoby si vytvorili záložku na tento príspevok","other":"{{count}} osôb si vytvorilo záložku na tento príspevok"},"like":{"one":" {{count}} osobe sa to páčilo","few":" {{count}} osobám sa to páčilo","other":" {{count}} osobám sa to páčilo"},"vote":{"one":"1 osoba hlasovala za tento príspevok","few":"{{count}} osoby hlasovali za tento príspevok","other":"{{count}} osôb hlasovalo za tento príspevok"}}},"delete":{"confirm":{"one":"Ste si istý že chcete zmazať tento príspevok?","few":"Ste si istý že chcete zmazať všetky tieto príspevky?","other":"Ste si istý že chcete zmazať všetky tieto príspevky?"}},"revisions":{"controls":{"first":"Prvá revízia","previous":"Predchádzajúca revízia","next":"Ďalšia revízia","last":"Posledná revízia","hide":"Skriť revíziu","show":"Ukáza revíziu","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Zobraz výstup vrátane pridaného a zmazaného v riadku","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Zobraziť rozdiely v generovanom výstupe vedľa seba","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Zobraziť rozdiely v pôvodnom zdroji vedľa seba","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Neupravený"}}}},"category":{"can":"môže \u0026hellip; ","none":"(Bez kategórie)","all":"Všetky kategórie","choose":"Vyber kategóriu\u0026hellip;","edit":"uprav","edit_long":"Upraviť","view":"Prezerať témy v kategórii","general":"Všeobecné","settings":"Nastavenia","topic_template":"Formulár témy","delete":"Odstrániť kategóriu","create":"Nová kategória","create_long":"Vytvoriť novú kategóriu","save":"Uložiť kategóriu","slug":"URL kategórie","slug_placeholder":"(Voliteľné) pomlčkou-prerušované-slová pre url","creation_error":"Nastala chyba počas vytvárania kategórie.","save_error":"Nastala chyba počas ukladania kategórie","name":"Názov kategórie","description":"Popis","topic":"kategória témy","logo":"Logo kategórie","background_image":"Pozadie kategórie","badge_colors":"Farby odznakov","background_color":"Farba pozadia","foreground_color":"Farba popredia","name_placeholder":"Maximálne jedno dve slová","color_placeholder":"Ľubovoľná farba stránky","delete_confirm":"Ste si istý že chcete zmazať túto kategóriu?","delete_error":"Nastala chyba počas mazania kategórie","list":"Zoznam kategórií","no_description":"Prosím, pridajte popis k tejto kategórii.","change_in_category_topic":"Uprav popis","already_used":"Táto farba je už použitá inou kategóriou","security":"Bezpečnosť","special_warning":"Upozornenie: Toto je preddefinovaná kategória a jej bezpečnostné nastavenia sa nedajú upraviť. Pokiaľ si neželáte použiť túto kategóriu, neupravujte ju, ale zmažte.","images":"Obrázky","auto_close_label":"Automaticky uzavrieť tému po:","auto_close_units":"hodinách","email_in":"Vlastná e-mailová adresa pre príchodziu poštu:","email_in_allow_strangers":"Prijímať emaily od anonymných užívateľov bez účtu","email_in_disabled":"Vkladanie nových tém cez email je zablokované v Nastaveniach stránky. Ak chcete povoliť vkladanie nových téme cez email,","email_in_disabled_click":"povoľte nastavenie \"email in\"","suppress_from_homepage":"Pozastaviť kategóriu z domovskej stránky.","allow_badges_label":"Povoliť získavanie odznakov v tejto kategórii","edit_permissions":"Upraviť práva","add_permission":"Pridať práva","this_year":"tento rok","position":"pozícia","default_position":"Predvolená pozícia","position_disabled":"Kategórie budú zobrazené podľa aktivity. Pre možnosť ovládania poradia kategórií v zozname,","position_disabled_click":"povoľte možnosť \"pevné poradie kategórií\"","parent":"Nadradená kategória","notifications":{"watching":{"title":"Pozerať"},"tracking":{"title":"Sledovať"},"regular":{"title":"Bežný","description":"Budete upozornený ak niekto spomenie Vaše @meno alebo Vám odpovie."},"muted":{"title":"Stíšené","description":"Nikdy nebudete informovaní o udalostiach v nových témach týchto kategórií. Tieto témy sa zároveň nebudú zobrazovať v zozname posledných udalostí."}}},"flagging":{"title":"Ďakujeme, že pomáhate udržiavať slušnosť v našej komunite!","action":"Označ príspevok","take_action":"Vykonať akciu","notify_action":"Správa","delete_spammer":"Zmazať spammera","yes_delete_spammer":"Áno, zmazať spammera","ip_address_missing":"(nedostupné)","hidden_email_address":"(skryté)","submit_tooltip":"Odoslať súkromné označenie","take_action_tooltip":"Dosiahnuť okamžite limit označení, namiesto čakania na ďalšie označenia od komunity","cant":"Ľutujeme, ale tento príspevok sa teraz nedá označiť .","formatted_name":{"off_topic":"Je to mimo témy","inappropriate":"Je to nevhodné","spam":"Je to spam"},"custom_placeholder_notify_user":"Buďte konkrétny, buďte konštruktívny a buďte vždy milý.","custom_placeholder_notify_moderators":"Dajte nám vedieť, z čoho konkrétne máte obavy, a priložte príslušné odkazy a príklady, ak je to možné."},"flagging_topic":{"title":"Ďakujeme, že pomáhate udržiavať slušnosť v našej komunite!","action":"Označ príspevok","notify_action":"Správa"},"topic_map":{"title":"Zhrnutie článku","participants_title":"Častí prispievatelia","links_title":"Populárne odkazy","clicks":{"one":"%{count} kilk","few":"%{count} kliky","other":"%{count} klikov"}},"topic_statuses":{"warning":{"help":"Toto je oficiálne varovanie."},"bookmarked":{"help":"Vytvorili ste si záložku na túto tému"},"locked":{"help":"Táto téma je už uzavretá. Nové odpovede už nebudú akceptované"},"archived":{"help":"Táto téma je archivovaná. Už sa nedá meniť. "},"locked_and_archived":{"help":"Táto téma je už uzavretá a archivovaná. Nové odpovede ani zmeny už nebudú akceptované "},"unpinned":{"title":"Odopnuté","help":"Túto tému ste odopli.  Bude zobrazená v bežnom poradí."},"pinned_globally":{"title":"Globálne pripnuté","help":"Tento príspevok je globálne uprednostnený. Zobrazí sa na začiatku v: zozname posledných článkov a vo svojej kategórii."},"pinned":{"title":"Pripnutý","help":"Túto tému ste pripli.  Bude zobrazená na vrchole svojej kategórie"},"invisible":{"help":"Táto téma je skrytá. Nebude zobrazená v zozname tém a prístup k nej bude možný len prostrednictvom priameho odkazu na ňu"}},"posts":"Príspevky","posts_long":"v tejto téme je {{number}} príspevkov","original_post":"Pôvodný príspevok","views":"Zobrazenia","views_lowercase":{"one":"zobrazenie","few":"zobrazenia","other":"zobrazení"},"replies":"Odpovede","views_long":"táto téma bola prezeraná {{number}} krát ","activity":"Aktivita","likes":"Páči sa mi","likes_lowercase":{"one":"\"Páči sa\"","few":"\"Páči sa\"","other":"\"Páči sa\""},"likes_long":"v tejto téme je {{number}} \"Páči sa\"","users":"Používatelia","users_lowercase":{"one":"užívateľ","few":"užívatelia","other":"užívatelia"},"category_title":"Kategória","history":"História","changed_by":"od {{author}}","raw_email":{"title":"Neupravený email","not_available":"Nedostupné!"},"categories_list":"Zoznam kategórií","filters":{"with_topics":"%{filter} témy","with_category":"%{filter} %{category} témy","latest":{"title":"Najnovšie","title_with_count":{"one":"Posledný (1)","few":"Posledné ({{count}})","other":"Posledných ({{count}})"},"help":"témy s nedávnymi príspevkami"},"hot":{"title":"Horúca","help":"výber najhorúcejších tém"},"read":{"title":"Prečítaná","help":"prečítané témy, zoradené podľa času ich prečítania"},"search":{"title":"Hľadať","help":"hľadaj vo všetkych témach"},"categories":{"title":"Kategórie","title_in":"Kategória - {{categoryName}}","help":"všetky témy zoskupené podľa kategórie"},"unread":{"title":"Neprečítané","title_with_count":{"one":"Neprečítaná (1)","few":"Neprečítané ({{count}})","other":"Neprečítaných ({{count}})"},"help":"témy ktorých neprečítané príspevky v súčastnosti pozeráte alebo sledujete ","lower_title_with_count":{"one":"1 neprečítaná","few":"{{count}} neprečítané","other":"{{count}} neprečítaných"}},"new":{"lower_title_with_count":{"one":"1 nová","few":"{{count}} nové","other":"{{count}} nových"},"lower_title":"nový","title":"Nový","title_with_count":{"one":"Nová (1)","few":"Nové ({{count}})","other":"Nových ({{count}})"},"help":"témy vytvorené za posledných pár dní"},"posted":{"title":"Moje príspevky","help":"témy s vašimi príspevkami"},"bookmarks":{"title":"Záložky","help":"témy, ktoré máte v záložkách"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} ({{count}})","few":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"najnovšie témy v kategórii {{categoryName}}"},"top":{"title":"Vrch","help":"najaktívnejšie témy za posledný rok, mesiac, týždeň, alebo deň","all":{"title":"Za celú dobu"},"yearly":{"title":"Ročne"},"quarterly":{"title":"Štvrťročne"},"monthly":{"title":"Mesačne"},"weekly":{"title":"Týždenne"},"daily":{"title":"Denne"},"all_time":"Za celú dobu","this_year":"Rok","this_quarter":"Štvrťrok","this_month":"Mesiac","this_week":"Týždeň","today":"Dnes","other_periods":"pozri hore"}},"browser_update":"Ľutujeme, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eVáš prehliadač je príliš starý na prácu na tejto stránke\u003c/a\u003e. Prosím \u003ca href=\"http://browsehappy.com\"\u003eaktualizujte Váš prehliedač\u003c/a\u003e.","permission_types":{"full":"Vytvor / Odpovedz / Zobraz","create_post":"Odpovedz / Zobraz","readonly":"Zobraz"},"poll":{"voters":{"one":"volič","few":"voliči","other":"voliči"},"total_votes":{"one":"hlas celkom","few":"hlasy celkom","other":"hlasov celkom"},"average_rating":"Priemerné hodnotenie: \u003cstrong\u003e%{average}\u003c/strong\u003e.","cast-votes":{"title":"Hlasovať","label":"Hlasuj teraz!"},"show-results":{"title":"Zobraz výsledky hlasovania","label":"Zobraz výsledky"},"hide-results":{"title":"Návrat na odovzdané hlasy","label":"Skyť výsledky"},"open":{"title":"Zahájiť hlasovanie","label":"Zahájiť","confirm":"Ste si istý, že chcete zahájiť toto hlasovanie?"},"close":{"title":"Zatvoriť hlasovanie","label":"Zatvoriť","confirm":"Ste si istý, že chcete zatvoriť toto hlasovanie?"}},"type_to_filter":"zadajte, čo chcete filtrovať ...","admin":{"title":"Administrátor Discourse","moderator":"Moderátor","dashboard":{"title":"Ovládací panel","last_updated":"Dashboard naposledy aktualizovaný:","version":"Verzia","up_to_date":"Máte nainštalovanú najnovšiu verziu!","critical_available":"Je dostupná kritická aktualizácia.","updates_available":"Aktualizácie sú k dispozícii.","please_upgrade":"Prosím aktualizujte!","no_check_performed":"Neprebehlo zisťovanie aktualizácií. Uistite sa že je spustený sidekiq.","stale_data":"V poslednej dobe neprebehlo zisťovanie aktualizácií. Uistite sa že je spustený sidekiq.","version_check_pending":"Zdá sa že ste nedávno aktualizovali. Fantastické!","installed_version":"Nainštalované","latest_version":"Najnovšie","problems_found":"Boli zistené nejaké problémy s Vašou inštaláciou Discourse.","last_checked":"Naposledy overené","refresh_problems":"Obnoviť","no_problems":"Nenašli sa žiadne problémy.","moderators":"Moderátori:","admins":"Administrátori:","blocked":"Zablokované:","suspended":"Odobraté:","private_messages_short":"Správy","private_messages_title":"Správy","mobile_title":"Mobil","space_free":"{{size}} voľné","uploads":"nahraté","backups":"zálohy","traffic_short":"Vyťaženie","traffic":"Požiadavky webových aplikácií","page_views":"Požiadavky API","page_views_short":"Požiadavky API","show_traffic_report":"Zobraziť detaily vyťaženia","reports":{"today":"Dnes","yesterday":"Včera","last_7_days":"Posledných 7 dní","last_30_days":"Posledných 30 dní","all_time":"Za celú dobu","7_days_ago":"Pred 7 dňami","30_days_ago":"Pred 30 dňami","all":"Všetky","view_table":"tabuľka","refresh_report":"Obnoviť report","start_date":"Od","end_date":"Do","groups":"Všetky skupiny"}},"commits":{"latest_changes":"Najnov3ie zmeny. Prosime aktualizujte čo najčastejšie!","by":"podľa"},"flags":{"title":"Označenia","old":"Staré","active":"Aktívny","agree":"Súhlasiť","agree_title":"Akceptovať toto označenie ako platné a správne","agree_flag_modal_title":"Súhlasiť a ....","agree_flag_hide_post":"Súhlasiť (skryť príspevok a poslať súkromnú správu)","agree_flag_hide_post_title":"Skryť tento príspevok a automaticky poslať súkromnú správu s výzvou na úpravu príspevku.","agree_flag_restore_post":"Súhlasiť (obnoviť príspevok)","agree_flag_restore_post_title":"Obnoviť tento príspevok","agree_flag":"Súhlasiť s označením","agree_flag_title":"Súhlasiť s označením, ale nemeníť príspevok","defer_flag":"Odložiť","defer_flag_title":"Zrušíť označenie. Žiadna akcia nie je nateraz potrebná.","delete":"Odstrániť","delete_title":"Zmazať príspevok na ktorý označenie odkazuje .","delete_post_defer_flag":"Zmazať príspevok a zrušiť označenie","delete_post_defer_flag_title":"Zmazať prípspevok; ak ide o prvý príspevok, zmazať aj tému","delete_post_agree_flag":"Zmazať príspevok a súhlasiť s označením","delete_post_agree_flag_title":"Zmazať prípspevok; ak ide o prvý príspevok, zmazať aj tému","delete_flag_modal_title":"Zmazať a...","delete_spammer":"Zmazať spammera","delete_spammer_title":"Zmazať užívateľa aj všetky príspevky a témy ktoré vytvoril.","disagree_flag_unhide_post":"Nesúhlasiť (odkryť príspevok)","disagree_flag_unhide_post_title":"Zrušíť všetky označenia z príspevku a znova odkryť príspevok","disagree_flag":"Nesúhlasiť","disagree_flag_title":"Zamietnuť toto označenie ako neplatné, alebo nesprávne","clear_topic_flags":"Hotovo","clear_topic_flags_title":"Téma bola preskúmaná a problémy boli vyriešené. Kliknite Hotovo pre zrušenie označení.","more":"(viac odpovedí...)","dispositions":{"agreed":"odsúhlasené","disagreed":"neodsúhlasené","deferred":"odložené"},"flagged_by":"Označené ","resolved_by":"Vyriešené","took_action":"Prijal opatrenia","system":"Systém","error":"Niečo sa pokazilo","reply_message":"Odpovedať","no_results":"Žiadne označenia.","topic_flagged":"Táto \u003cstrong\u003etéma\u003c/strong\u003e bola označená. ","visit_topic":"Navšťívte tému pre prijatie opatrení","was_edited":"Príspevok bol upravený po prvom označení","previous_flags_count":"Tento príspevok bol už označený {{count}} krát.","summary":{"action_type_3":{"one":"mimo tému","few":"mimo tému x{{count}}","other":"mimo tému x{{count}}"},"action_type_4":{"one":"nevhodný","few":"nevhodné x{{count}}","other":"nevhodných x{{count}}"},"action_type_6":{"one":"vlastná","few":"vlastné x{{count}}","other":"vlastných x{{count}}"},"action_type_7":{"one":"vlastný","few":"vlastné x{{count}}","other":"vlastných x{{count}}"},"action_type_8":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"}}},"groups":{"primary":"Hlavná skupina","no_primary":"(bez hlavnej skupiny)","title":"Skupiny","edit":"Upraviť skupiny","refresh":"Obnoviť","new":"Nový","selector_placeholder":"zadať používateľské meno","name_placeholder":"Názov skupiny, bez medzier, rovnaké pravidlá ako pre uťívateľa","about":"Tu upravíte Vaše členstvo v skupinách a mená","group_members":"Členovia skupiny","delete":"Odstrániť","delete_confirm":"Zmazať túto skupinu?","delete_failed":"Nepodarilo sa zmazať skupinu. Pokiaľ je skupina automatická, nemôže byť zrušená.","delete_member_confirm":"Odstrániť '%{username}' zo skupiny '%{group}'?","delete_owner_confirm":"Odobrať vlastnícke práva %{username}'?","name":"Meno","add":"Pridať","add_members":"Pridať členov","custom":"Vlastné","bulk_complete":"Užívatelia boli pridaní do skupiny.","bulk":"Hromadné pridanie do skupiny","bulk_paste":"Vlož zoznam používateľov alebo emailov, jeden na riadok:","bulk_select":"(vyberte skupinu)","automatic":"Automaticky","automatic_membership_email_domains":"Užívatelia, ktorí sa zaregistrovali s emailovou doménou uvedenou v zozname budú automaticky pridaní do tejto skupiny. ","automatic_membership_retroactive":"Použi pravidlo rovnakej emailovej domény pre pridanie registrovaných užívateľov","default_title":"Štandardné označenie pre všetkých používateľov v tejto skupine","primary_group":"Automaticky nastav ako hlavnú skupinu","group_owners":"Vlastníci","add_owners":"Pridať vlastníkov","incoming_email":"Vlastná e-mailová adresa pre príchodziu poštu","incoming_email_placeholder":"zadajte emailovú adresu"},"api":{"generate_master":"Vygenerovať Master API kľúč","none":"V súčasnosti neexistujú žiadne aktívne API kľúče.","user":"Používateľ","title":"API","key":"API kľúč","generate":"Generovať","regenerate":"Obnov","revoke":"Zrušiť","confirm_regen":"Ste si istý, že chcete nahradiť tento API kľúč novým?","confirm_revoke":"Ste si istý, že chcete obnoviť tento kľúč?","info_html":"Váš API kľúč Vám umožní vytváranie a aktualizovanie tém prostredníctvom volaní JSON.","all_users":"Všetci používatelia","note_html":"Držte tento kľúč \u003cstrong\u003ev tajnosti\u003c/strong\u003e, všetci užívatelia ktorí ho vlastnia môžu vytvárať ľubovoľné príspevky pod ľubovoľným užívateľským menom. "},"plugins":{"title":"Pluginy","installed":"Nainštalované pluginy","name":"Meno","none_installed":"Nemáte nainštalované žiadne pluginy.","version":"Verzia","enabled":"Povolené?","is_enabled":"A","not_enabled":"N","change_settings":"Zmeniť nastavenia","change_settings_short":"Nastavenia","howto":"Ako nainštalujem pluginy?"},"backups":{"title":"Zálohy","menu":{"backups":"Zálohy","logs":"Logy"},"none":"Nie je dostupná žiadna záloha.","logs":{"none":"Zatiaľ žiadne logy..."},"columns":{"filename":"Názov súboru","size":"Veľkosť"},"upload":{"label":"Upload","title":"Nahrať zálohu do tejto inštancie","uploading":"Upload prebieha...","success":"'{{filename}}' bol úspešne nahratý.","error":"Počas nahrávania '{{filename}}' nastala chyba: {{message}}"},"operations":{"is_running":"Operácia práve prebieha...","failed":" Zlyhalo vykonanie {{operation}} . Prosím skontrolujte logy. ","cancel":{"label":"Zrušiť","title":"Zrušiť prebiehajúcu operáciu","confirm":"Ste si istý, že chcete zrušiť prebiehajúcu operáciu?"},"backup":{"label":"Záloha","title":"Vytvoriť zálohu","confirm":"Prajete si spustiť novú zálohu?","without_uploads":"Áno (nezahŕňať súbory)"},"download":{"label":"Stiahnuť","title":"Stiahnuť zálohu"},"destroy":{"title":"Odstrániť zálohu","confirm":"Ste si istý, že chcete odstrániť túto zálohu?"},"restore":{"is_disabled":"Obnovenie je vypnuté na Nastaveniach stránky.","label":"Obnoviť","title":"Obnoviť zálohu"},"rollback":{"label":"Vrátiť späť","title":"Vrátiť databázu do predchádzajúceho funkčného stavu"}}},"export_csv":{"user_archive_confirm":"Ste si istý, že si chcete stiahnut svoje príspevky?","success":"Export bol spustený, o jeho skončení budete informovaný správou.","failed":"Export zlyhal. Skontrolujte prosím logy.","rate_limit_error":"Príspevky možu byť stiahnuté len raz za deň. Skúste opäť zajtra.","button_text":"Export","button_title":{"user":"Exportovať celý zoznam používateľov v CSV formáte.","staff_action":"Exportovať celý log akcií redakcie v CSV formáte.","screened_email":"Exportovať celý zobrazený zoznam emailov v CSV formáte.","screened_ip":"Exportovať celý zobrazený zoznam IP adries v CSV formáte.","screened_url":"Exportovať celý zobrazený zoznam URL adries v CSV formáte."}},"export_json":{"button_text":"Export"},"invite":{"button_text":"Poslať pozvánky","button_title":"Poslať pozvánky"},"customize":{"title":"Upraviť","long_title":"Úpravy webu","css":"CSS","header":"Hlavička","top":"Vrch","footer":"Päta","embedded_css":"Vnorené CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML, ktoré bude vložené pred \u003c/body\u003e tag"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML, ktoré bude vložené pred \u003c/body\u003e tag"},"override_default":"Nevkladať štandardné štýly","enabled":"Povolené?","preview":"náhľad","undo_preview":"zmazať náhľad","rescue_preview":"predvolený štýl","explain_preview":"Nastaviť na stránke vlastné štýly","explain_undo_preview":"Vrátiť sa k akruálnym vlastným štýlom","explain_rescue_preview":"Nastavit na stránke štandardné štýly","save":"Uložiť","new":"Nový","new_style":"Nový štýl","import":"Import","import_title":"Vyberte súbor alebo vložte text","delete":"Odstrániť","delete_confirm":"Zmazať túto úpravu?","about":"Upraviť CSS štýly a HTML hlavičky na stránke. Začnite pridaním úpravy.","color":"Farba","opacity":"Nepriesvitnosť","copy":"Kopírovať","email_templates":{"title":"Emailové šablóny","subject":"Predmet","multiple_subjects":"Táto emailova šablóna obsahuje viac predmetov","body":"Telo","none_selected":"Vyberte šablénu emailu pre začatie úpravy.","revert":"Vrátiť zmeny","revert_confirm":"Ste si istý, že chcete vrátiť vykonané zmeny späť?"},"css_html":{"title":"CSS/HTML","long_title":"Úpravy CSS a HTML"},"colors":{"title":"Farby","long_title":"Farebné schémy","about":"Upravte farby použité na stránke bez použitia CSS. Začnite pridaním schémy.","new_name":"Nová farebná schéma","copy_name_prefix":"Kópia","delete_confirm":"Zmazať túto farebnú schému?","undo":"späť","undo_title":"Zrušiť zmeny farby a vrátiť sa k predchádzajucej uloženej verzii. ","revert":"vrátiť zmeny","revert_title":"Nastaviť východziu farebnú schému Discourse. ","primary":{"name":"primárny","description":"Väčšina textov, ikony, a okraje."},"secondary":{"name":"sekundárny","description":"Hlavná farba pozadia a farba textu niektorých ovládacích prvkov."},"tertiary":{"name":"terciárny","description":"Odkazy, nejaké tlačidlá, upozornenia a zvýrazňovacie farby."},"quaternary":{"name":"štvrťročne","description":"Navigačné odkazy."},"header_background":{"name":"pozadie hlavičky","description":"Farba pozadia hlavičky stránky."},"header_primary":{"name":"hlavné záhlavie","description":"Texty a ikony v záhlaví stránky."},"highlight":{"name":"zvýraznenie","description":"Farba pozadia zvýrazneného prvku na stránke, napríklad príspevku alebo témy."},"danger":{"name":"nebezpečenstvo","description":"Zvýrazňovacia farba pre akcie ako napríklad mazanie príspevkov a tém."},"success":{"name":"úspech","description":"Použitá pre úspešne vykonané akcie."},"love":{"name":"obľúbené","description":"Farba tlačidla \"Páči sa\""}}},"email":{"title":"Email","settings":"Nastavenia","templates":"Šablóny","preview_digest":"Súhrn","sending_test":"Odosielam testovací email...","error":"\u003cb\u003eCHYBA\u003c/b\u003e - %{server_error}","test_error":"Pri posielaní testovacieho emailu nastala chyba. Prosím preverte Vaše emailové nastavenia, overte si, že váš hostiteľ neblokuje emailové spojenia a skúste znova.","sent":"Odoslané","skipped":"Preskočené","received":"Obdržané","rejected":"Zamietnuté","sent_at":"Odoslané","time":"Čas","user":"Používateľ","email_type":"Typ emailu","to_address":"Adresát","test_email_address":"testovacia emailová adresa","send_test":"Odoslať testovací email","sent_test":"odoslané!","delivery_method":"Spôsob doručenia","preview_digest_desc":"Náhľad obsahu súhrnných emailov zaslaných neaktívnym užívateľom.","refresh":"Obnoviť","format":"Formát","html":"html","text":"text","last_seen_user":"Posledný videný užívateľ","reply_key":"Tlačidlo odpovedať","skipped_reason":"Preskočiť zdôvodnenie","incoming_emails":{"from_address":"Od","to_addresses":"Komu","cc_addresses":"Kópia","subject":"Predmet","error":"Chyba","none":"Nenájdené žiadne ďalšie emaily.","modal":{"error":"Chyba"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Predmet...","error_placeholder":"Chyba"}},"logs":{"none":"Nenašli sa žiadne logy.","filters":{"title":"Filter","user_placeholder":"používateľské meno","address_placeholder":"meno@príklad.com","type_placeholder":"súhrn, registácia...","reply_key_placeholder":"tlačidlo odpovedať","skipped_reason_placeholder":"dôvod"}}},"logs":{"title":"Logy","action":"Akcia","created_at":"Vytvorené","last_match_at":"Posledný zodpovedajúci","match_count":"Zodpovedá","ip_address":"IP","topic_id":"ID témy","post_id":"ID príspevku","category_id":"ID kategórie","delete":"Odstrániť","edit":"Upraviť","save":"Uložiť","screened_actions":{"block":"blokovať","do_nothing":"nerob nič"},"staff_actions":{"title":"Akcie personálu","instructions":"Vyberte uťívateľské meno a akcie na filtrovanie zoznamu. Kliknite na profilovú fotku pre navigáciu na užívateľské stránky.","clear_filters":"Ukázať všetko","staff_user":"Člen redakcie","target_user":"Cieľový používateľ","subject":"Predmet","when":"Kedy","context":"Kontext","details":"Detaily","previous_value":"Predchádzajúci","new_value":"Nový","diff":"Rozdiel","show":"Zobraziť","modal_title":"Detaily","no_previous":"Neexistuje predchádzajúca hodnota","deleted":"Žiadna nová hodnota. Záznam bol vymazaný.","actions":{"delete_user":"odstrániť používateľa","change_trust_level":"zmeniť stupeň dôvery","change_username":"zmeniť používateľské meno","change_site_setting":"zmeniť nastavenia webu","change_site_customization":"zmeniť úpravy webu","delete_site_customization":"zmazať úpravy webu","change_site_text":"zmeniť text stránky","suspend_user":"zruš práva užívateľovi","unsuspend_user":"obnov práva užívateľovi","grant_badge":"udeliť odznak","revoke_badge":"odobrať odznak","check_email":"skontrolovať email","delete_topic":"odstrániť tému","delete_post":"odstrániť príspevok","impersonate":"privlastniť","anonymize_user":"anonymizovať používateľa","roll_up":"zbaliť IP bloky","change_category_settings":"zmeniť nastavenia kategórie","delete_category":"odstrániť kategóriu","create_category":"vytvoriť kategóriu","block_user":"blokovať používateľa","unblock_user":"odblokovať používateľa","grant_admin":"udeliť admin","revoke_admin":"odobrať admin","grant_moderation":"udeliť moderovanie","revoke_moderation":"odvolať moderovanie"}},"screened_emails":{"title":"Kontrolované emaily","description":"Keď niekto skúsi vytvoriť nový účet, nasledujúce emailove adresy budú preverené a registrácia bude zablokovaná, alebo bude vykonaná nejaka iná akcia. ","email":"Emailové adresy","actions":{"allow":"Povoliť"}},"screened_urls":{"title":"Kontrolované URL adresy","description":"URL adresy v tomto zozname boli použité v príspevkoch užívateľov, ktorí boli identifikovaní ako spameri.","url":"URL","domain":"Doména"},"screened_ips":{"title":"Kontrolované IP adresy","description":"IP adresy pod dohľadom. Použi \"Povoľ\" pre povolenie IP adries.","delete_confirm":"Ste si istý, že chcete zrušiť pravidlo pre %{ip_address}?","roll_up_confirm":"Ste si istý, že chcete zosumarizovať bežne kontrolované IP do podsietí?","rolled_up_some_subnets":"Zakázané IP adresy boli úspešne zosumarizované do podsietí: %{subnets}.","rolled_up_no_subnet":"Nebolo čo zbaliť.","actions":{"block":"Blokovať","do_nothing":"Povoliť","allow_admin":"Povoliť admin"},"form":{"label":"Nový:","ip_address":"IP adresy","add":"Pridať","filter":"Hľadať"},"roll_up":{"text":"Zbaliť","title":"Vytvorí novú podsieť zakázaných záznamov pokiaľ existuje aspoň 'min_ban_entries_for_roll_up' záznamov"}},"logster":{"title":"Chybové Logy"}},"impersonate":{"title":"Privlastniť","help":"Použite tento nástroj na privlastnenie si užívateľského účtu na účely debugovania. Po skončení sa budete musieť odhlásiť.","not_found":"Tento používateľ sa nenašiel.","invalid":"Ľutujeme, nesmiete si privlatniť tohto užívateľa."},"users":{"title":"Používatelia","create":"Pridať admin používateľa","last_emailed":"Posledný odemailovaný","not_found":"Prepáčte, toto užívateľské meno sa nenachádza v našom systéme.","id_not_found":"Prepáčte, toto užívateľské id sa nenachádza v našom systéme.","active":"Aktívny","show_emails":"Ukázať Emaily","nav":{"new":"Nový","active":"Aktívny","pending":"Čakajúca","staff":"Zamestnanci","suspended":"Odobrate práva","blocked":"Zablokovaný","suspect":"Podozrivý"},"approved":"Schválený?","approved_selected":{"one":"schváliť užívateľa","few":"schváliť ({{count}}) užívateľov ","other":"schváliť ({{count}}) užívateľov "},"reject_selected":{"one":"zamietnuť užívateľa","few":"zamietnuť ({{count}}) užívateľov ","other":"zamietnuť ({{count}}) užívateľov "},"titles":{"active":"Aktívni používatelia","new":"Noví používatelia","pending":"Užívatelia čakajúci na kontrolu","newuser":"Užívatelia na Stupni dôvery 0 (Noví užívatelia)","basic":"Užívatelia na Stupni dôvery 1 (Bežný užívateľ)","member":"Užívatelia na Stupni dôvery 2 (Člen)","regular":"Užívatelia na Stupni dôvery  3 (Stály člen)","leader":"Užívatelia na Stupni dôvery 4 (Vodca)","staff":"Zamestnanci","admins":"Admin používatelia","moderators":"Moderátori","blocked":"Zablokovaní užívatelia","suspended":"Užívatelia s odobratými právami","suspect":"Podozriví užívatelia"},"reject_successful":{"one":"Úspešne zamietnutý užívateľ","few":"Úspešne zamietnutí %{count} užívatelia","other":"Úspešne zamietnutých %{count} užívateľov"},"reject_failures":{"one":"Nepodarilo sa zamietnuť 1 užívateľa","few":"Nepodarilo sa zamietnuť %{count} užívateľov","other":"Nepodarilo sa zamietnuť %{count} užívateľov"},"not_verified":"Neoverený","check_email":{"title":"Odhaliť emailovú adresu tohto používateľa","text":"Zobraziť"}},"user":{"suspend_failed":"Niečo sa pokazilo pri odoberaní práv tomuto užívateľovi {{error}}","unsuspend_failed":"Niečo sa pokazilo pri obnovovaní práv tomuto užívateľovi {{error}}","suspend_duration":"Ako dlho budú užívateľovi odobrate práva?","suspend_duration_units":"(dni)","suspend_reason_label":"Prečo mu odoberáte práva? Tento text \u003cb\u003esa zobrazí každému\u003c/b\u003e na stránke profilu užívateľa a bude zobrazený užívateľovi pri pokuse o prihlásenie. Buďte strucný.","suspend_reason":"Dôvod","suspended_by":"Práva odobraté","delete_all_posts":"Zmazať všetky príspevky","suspend":"Odobrať","unsuspend":"Obnoviť","suspended":"Odobrate práva?","moderator":"Moderátor?","admin":"Admin?","blocked":"Blokovaný?","staged":"Dočasný?","show_admin_profile":"Admin","edit_title":"Upraviť názov","save_title":"Uložiť názov","refresh_browsers":"Vynútiť refresh browsera.","refresh_browsers_message":"Správa odoslaná všetkým klientom!","show_public_profile":"Ukázať verejný profil","impersonate":"Privlastniť","ip_lookup":"Vyhľadávanie IP","log_out":"Odhlásiť sa","logged_out":"Užívateľ bol odhlásený na všetkých zariadeniach","revoke_admin":"Odobrať admin","grant_admin":"Udeliť admin","revoke_moderation":"Odobrať moderovanie","grant_moderation":"Udeliť moderovanie","unblock":"Odblokovať","block":"Blokovať","reputation":"Reputácia","permissions":"Práva","activity":"Aktivita","like_count":"\"Páči sa\" Rozdané / Prijaté","last_100_days":"za posledných 100 dní","private_topics_count":"Súkromné témy","posts_read_count":"Prečítané príspevky","post_count":"Vytvorené príspevky","topics_entered":"Zobrazených tém","flags_given_count":"Rozdané označenia","flags_received_count":"Prijaté označenia","warnings_received_count":"Prijaté varovania","flags_given_received_count":"Rozdané a prijaté označenia","approve":"Schváliť","approved_by":"schválený","approve_success":"Uťívateľ schválený a bol zaslaný email s aktivačnými inštrukciami","approve_bulk_success":"Úspech! Všetci vybraní uťívateľia boli schválení a oboznáamení.","time_read":"Doba Čítania","anonymize":"Anonymizovať používateľa","anonymize_confirm":"Ste si istý že chcete zmeniť tento účet na anonymný? Zmeni to užívateľské meno, email a zmažú sa všetky informácie z profilu. ","anonymize_yes":"Áno, zmeň tento účet na anonymný","anonymize_failed":"Nastala chyba pri anonymizovaní účtu.","delete":"Odstrániť používateľa","delete_forbidden_because_staff":"Správcovia a moderátori nemôžu byť vymazaní.","delete_posts_forbidden_because_staff":"Nedá sa zmazať príspevky správcov a moderátorov.","delete_forbidden":{"one":"Užívatelia nemôžu byť vymazaní ak majú príspevky. Najprv zmažte príspevky až potom užívateľa. (Príspevky staršie ako %{count} deň nemožno zmazať)","few":"Užívatelia nemôžu byť vymazaní ak majú príspevky. Najprv zmažte príspevky až potom užívateľa. (Príspevky staršie ako %{count} dni nemožno zmazať)","other":"Užívatelia nemôžu byť vymazaní ak majú príspevky. Najprv zmažte príspevky až potom užívateľa. (Príspevky staršie ako %{count} dní nemožno zmazať)"},"cant_delete_all_posts":{"one":"Nepodarilo sa zmazať všetky príspevky. Niektoré príspevky sú staršie ako %{count} deň. (Nastavenie delete_user_max_post_age )","few":"Nepodarilo sa zmazať všetky príspevky. Niektoré príspevky sú staršie ako %{count} dni. (Nastavenie delete_user_max_post_age )","other":"Nepodarilo sa zmazať všetky príspevky. Niektoré príspevky sú staršie ako %{count} dní. (Nastavenie delete_user_max_post_age )"},"cant_delete_all_too_many_posts":{"one":"Nedá sa zmazať všetky píspevky, pretože užívateľ má viac ako 1 príspevok.  (delete_all_posts_max)","few":"Nedá sa zmazať všetky píspevky, pretože užívateľ má viac ako %{count} príspevky.  (delete_all_posts_max)","other":"Nedá sa zmazať všetky píspevky, pretože užívateľ má viac ako %{count} príspevkov.  (delete_all_posts_max)"},"delete_confirm":"Ste si ISTÝ, že chcete zmazať tohoto užívateľa? Už sa to nedá obnoviť!","delete_and_block":"Zazať a \u003cb\u003ezablokovať\u003c/b\u003e tento email a IP adresu","delete_dont_block":"Iba vymazať","deleted":"Používateľ bol vymazaný.","delete_failed":"Počas vymazávania používateľa nastala chyba. Pred vymazaním používateľa sa uistite, že všetky jeho príspevky sú zmazané.","send_activation_email":"Poslať aktivačný email.","activation_email_sent":"Aktivačný emial bol odoslaný.","send_activation_email_failed":"Počas odosielania ďalšieho aktivačného emailu nastala chyba. %{error}","activate":"Aktivovať účet","activate_failed":"Počas aktivácie používateľa nastala chyba.","deactivate_account":"Deaktivovať účet","deactivate_failed":"Počas deaktivácie používateľa nastala chyba.","unblock_failed":"Nastala chyba pri odblokovaní užívateľa.","block_failed":"Nastala chyba pri zablokovaní užívateľa.","block_confirm":"Ste si istý tým, že chcete zablokovať tohoto používateľa? Nebude môcť vytvárať žiadne nové témy alebo príspevky.","block_accept":"Ano, zablokovať používateľa","deactivate_explanation":"Deaktivovaý užívateľ musí znovu overiť svoj email","suspended_explanation":"Suspendovaní užívatelia sa nemôžu prihlasovať.","block_explanation":"Zablokovaní uťívatelia nemôžu zakladať témy ani pridávať príspevky.","trust_level_change_failed":"Nastala chyba pri zmene úrovne dôveryhodnosti užívateľa.","suspend_modal_title":"Zruš práva užívateľovi","trust_level_2_users":"Užívatelia na 2 Stupni dôvery","trust_level_3_requirements":"Požiadavky pre 3 stupeň","trust_level_locked_tip":"stupeň dôvery je zamknutý, systém užívateľovi stupeň nezvýši ani nezníži  ","trust_level_unlocked_tip":"stupeň dôvery je odomknutý, systém môže užívateľovi stupeň zvýšiť alebo znížiť","lock_trust_level":"Zamknúť stupeň dôvery","unlock_trust_level":"Odomknúť stupeň dôvery","tl3_requirements":{"title":"Požiadavky pre stupeň dôvery 3","value_heading":"Hodnota","requirement_heading":"Požiadavka","visits":"Návštev","days":"dní","topics_replied_to":"Témy na ktoré odpovedal","topics_viewed":"Zobrazených tém","topics_viewed_all_time":"Videné témy (za celú dobu)","posts_read":"Prečítané príspevky","posts_read_all_time":"Prečítaných príspevkov (za celú dobu)","flagged_posts":"Označené príspevky","flagged_by_users":"Užívatelia, ktorí označili","likes_given":"Rozdaných 'páči sa mi'","likes_received":"Obdržaných 'páči sa mi'","likes_received_days":"Obdržaných 'páči sa mi' na jednotlivé dni","likes_received_users":"Obdržaných 'páči sa mi' na jednotlivých užívateľov","qualifies":"Spĺňa požiadavky pre stupeň dôvery 3","does_not_qualify":"Nespĺňa požiadavky pre stupeň dôvery 3","will_be_promoted":"Bude čoskoro povýšený","will_be_demoted":"Čoskoro bude degradovaný","on_grace_period":"V súčastnosti je v povyšovacej skúšobnej dobe, nebude degradovaný.","locked_will_not_be_promoted":"Stupeň dôvery je zamknutý. Nikdy nebude povýšený.","locked_will_not_be_demoted":"Stupeň dôvery je zamknutý. Nikdy nebude degradovaný"},"sso":{"title":"Jednotné prihlásenie","external_id":"Externé ID","external_username":"Používateľské meno","external_name":"Meno","external_email":"Email","external_avatar_url":"URL profilovej fotky"}},"user_fields":{"title":"Užívateľské polia","help":"Pridaj polia, ktoré môžu užívatelia vyplniť","create":"Vytvor užívateľske pole","untitled":"Bez názvu","name":"Názov poľa","type":"Typ poľa","description":"Popis poľa","save":"Uložiť","edit":"Upraviť","delete":"Odstrániť","cancel":"Zrušiť","delete_confirm":"Ste si istý, že chcete zmazať toto užívateľské pole?","options":"Možnosti","required":{"title":"Požadované pri registrácii?","enabled":"povinné","disabled":"nepovinné"},"editable":{"title":"Upravovateľné po registrácii?","enabled":"upravovateľné ","disabled":"neupravovateľné "},"show_on_profile":{"title":"Ukázať na verejnom profile?","enabled":"zobrazené na profile","disabled":"nezobrazené na profile"},"field_types":{"text":"Textové pole","confirm":"Potvrdenie","dropdown":"Zoznam"}},"site_text":{"description":"Môžete prispôsobiť hociktorý text na Vašom fóre. Prosím začnite hľadaním nižšie:","search":"Hľadajte text, ktorý chcete upraviť","title":"Textový obsah","edit":"uprav","revert":"Vrátiť zmeny","revert_confirm":"Ste si istý, že chcete vrátiť vykonané zmeny späť?","go_back":"Návrat na vyhľadávanie","recommended":"Odporúčame prispôsobenie nasledujúceho textu podľa vašich potrieb:","show_overriden":"Ukázať iba zmenené"},"site_settings":{"show_overriden":"Ukázať iba zmenené","title":"Nastavenia","reset":"zrušiť","none":"žiadne","no_results":"Žiadne výsledky","clear_filter":"Vyčistiť","add_url":"pridaj URL","add_host":"pridať hostiteľa","categories":{"all_results":"Všetky","required":"Povinné","basic":"Základné nastavenia","users":"Používatelia","posting":"Prispievam","email":"Email","files":"Súbory","trust":"Stupne dôvery","security":"Bezpečnosť","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limity a obmedzenia","developer":"Vývojár","embedding":"Vkladám","legal":"Právne záležitosti","uncategorized":"Ostatné","backups":"Zálohy","login":"Prihlásenie","plugins":"Pluginy","user_preferences":"Užívateľské Nastavenia"}},"badges":{"title":"Odznaky","new_badge":"Nový odznak","new":"Nový","name":"Meno","badge":"Odznak","display_name":"Zobrazované meno","description":"Popis","badge_type":"Typ odznaku","badge_grouping":"Skupina","badge_groupings":{"modal_title":"Zoskupovanie odznakov"},"granted_by":"Pridelené užívateľom","granted_at":"Pridelené na","reason_help":"(Odkaze na príspevok, alebo tému)","save":"Uložiť","delete":"Odstrániť","delete_confirm":"Ste si istý, že chcete zmazať tento odznak?","revoke":"Zrušiť","reason":"Dôvod","expand":"Rozbaliť \u0026hellip;","revoke_confirm":"Ste si istý, že chcete obnoviť tento odznak?","edit_badges":"Upraviť odznaky","grant_badge":"Prideliť odznaky","granted_badges":"Pridelené odznaky","grant":"Prideliť","no_user_badges":"%{name} nebol pridelený žiaden odznak.","no_badges":"Nie sú žiadne odznaky, ktoré môžu byť pridelené.","none_selected":"Vyberte odznak, aby ste mohli začať","allow_title":"Povoliť použitie odznaku namiesto názvu","multiple_grant":"Môže byť pridelené viacnásobne","listable":"Zobraziť odznak na stránke verejných odznakov","enabled":"Povoliť odznak","icon":"Ikona","image":"Obrázok","icon_help":"Použi buď font z triedy Awesome, alebo URL na obrázok","query":"Požiadavka na Odznak (SQL)","target_posts":"Požiadavka cieli príspevky","auto_revoke":"Spúšťať stornovaciu požiadavku denne","show_posts":"Zobraziť príspevok o pridelení odznaku na stránke odznakov","trigger":"Spúšťač","trigger_type":{"none":"Obnovovať denne","post_action":"Keď užívateľ zareaguje na príspevok","post_revision":"Keď užívateľ vytvorí príspevok","trust_level_change":"Keď užívateľ zmení stupeň dôvery","user_change":"Keď je užívateľ vytvorený, alebo upravený"},"preview":{"link_text":"Prezerať pridelené odznaky","plan_text":"Náhľad na plán požiadaviek","modal_title":"Požiadavka na Odznak Prezeranie","sql_error_header":"Nastala chyba s požiadavkou.","error_help":"Pozrite si nasledujäce odkazy pre pomoc s dopytovacími odznakmi.","bad_count_warning":{"header":"UPOZORNENIE!","text":"Chýbajú ukážky práv. Toto sa stane, ak dotaz na odznak vráti ID používateľa alebo príspevku, ktorý neexistuje. Toto môže zapríčiniť neskoršie neočakávané výsledky - prosíme znovu overte Váš dotaz."},"no_grant_count":"Žiadne odznaky na pridelenie.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e odznak na pridelenie","few":"\u003cb\u003e%{count}\u003c/b\u003e odznaky na pridelenie","other":"\u003cb\u003e%{count}\u003c/b\u003e odznakov na pridelenie"},"sample":"Vzor:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e za príspevok v %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e za príspevok v %{link} v čase \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e v čase \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Pridaj nové emoji, ktoré bude dostupné pre všetkých (TIP: môžete pretiahnuť viac súborov naraz)","add":"Pridaj nové Emoji","name":"Meno","image":"Obrázok","delete_confirm":"Ste si istý, že chcete zmazať: %{name}: emoji?"},"embedding":{"get_started":"Pokiaľ chcete vložiť Discourse na inú stránku, začnite pridaním jej hostiteľa.","confirm_delete":"Ste si istý, že chcete zmazať tohoto hostiteľa?","sample":"Použite nasledovný HTML kód vo Vašej stránke pre vytvorenie vloženej témy Discourse. Nahraďte \u003cb\u003eREPLACE_ME\u003c/b\u003e kanonickou URL adresou stránky, do ktorej to vkladáte.","title":"Vkladám","host":"Povolení hostitelia","edit":"uprav","category":"Prispievať do kategórií","add_host":"Pridať hostiteľa","settings":"Nastavenia vkladania","feed_settings":"Nastavenie zdrojov","feed_description":"Zadaním RSS/ATOM kanálu Vašich stránok zlepší schopnosť Discourse vladať Váš obsah.","crawling_settings":"Nastavenia vyhľadávača","crawling_description":"Ak Discourse vytvorí tému pre Váš príspevok a neexistuje žiadny RSS/ATOM kanál tak sa pokúsime získať Váš obsah z HTML. Získanie obsahu môže byt niekedy výzva  a preto poskytujeme možnosť špecifikovať CSS pravidlá na uľahčenie získania obsahu.","embed_by_username":"Užívateľské meno pre vytváranie tém","embed_post_limit":"Maximálny počet vložených príspevkov","embed_username_key_from_feed":"Kľúč na získanie užívateľského mena discourse zo zdroja","embed_truncate":"Skrátiť vložené príspevky","embed_whitelist_selector":"CSS selector pre elementy ktoré je možné vkladať","embed_blacklist_selector":"CSS selector pre elementy ktoré nie je možné vkladať","feed_polling_enabled":"importovať príspevky cez RSS/ATOM","feed_polling_url":"URL adresa zdroja RSS/ATOM na preskúmanie","save":"Uložiť Nastavenia vkladania"},"permalink":{"title":"Trvalé odkazy","url":"URL","topic_id":"IT témy","topic_title":"Témy","post_id":"ID príspevku","post_title":"Príspevok","category_id":"ID kategórie","category_title":"Kategória","external_url":"Externá URL","delete_confirm":"Ste si istý, že chcete zmazať tento trvalý odkaz?","form":{"label":"Nový:","add":"Pridať","filter":"Hľadať (URL alebo externá URL)"}}}}},"en":{"js":{"dates":{"timeline_date":"MMM YYYY","wrap_ago":"%{date} ago"},"action_codes":{"public_topic":"made this topic public %{when}","private_topic":"made this topic private %{when}","invited_group":"invited %{who} %{when}","removed_group":"removed %{who} %{when}"},"bootstrap_mode_enabled":"To make launching your new site easier, you are in bootstrap mode. All new users will be granted trust level 1 and have daily email digest updates enabled. This will be automatically turned off when total user count exceeds %{min_users} users.","bootstrap_mode_disabled":"Bootstrap mode will be disabled in next 24 hours.","s3":{"regions":{"ap_south_1":"Asia Pacific (Mumbai)","cn_north_1":"China (Beijing)"}},"switch_to_anon":"Enter Anonymous Mode","switch_from_anon":"Exit Anonymous Mode","directory":{"topics_entered":"Viewed","topics_entered_long":"Topics Viewed"},"groups":{"index":"Groups","topics":"Topics","mentions":"Mentions","messages":"Messages","notifications":{"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this group."}}},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"dismiss_notifications":"Dismiss All","email_activity_summary":"Activity Summary","mailing_list_mode":{"label":"Mailing list mode","enabled":"Enable mailing list mode","instructions":"This setting overrides the activity summary.\u003cbr /\u003e\nMuted topics and categories are not included in these emails.\n","daily":"Send daily updates","individual":"Send an email for every new post","many_per_day":"Send me an email for every new post (about {{dailyEmailEstimate}} per day)","few_per_day":"Send me an email for every new post (about 2 per day)"},"tag_settings":"Tags","watched_tags":"Watched","watched_tags_instructions":"You will automatically watch all topics with these tags. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_tags":"Tracked","tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","muted_tags":"Muted","muted_tags_instructions":"You will not be notified of anything about new topics with these tags, and they will not appear in latest.","watched_categories_instructions":"You will automatically watch all topics in these categories. You will be notified of all new posts and topics, and a count of new posts will also appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_categories":"Watching First Post","watched_first_post_categories_instructions":"You will be notified of the first post in each new topic in these categories.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","watched_topics_link":"Show watched topics","automatically_unpin_topics":"Automatically unpin topics when I reach the bottom.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write","change_about":{"error":"There was an error changing this value."},"change_username":{"confirm":"If you change your username, all prior quotes of your posts and @name mentions will be broken. Are you absolutely sure you want to?"},"like_notification_frequency":{"first_time_and_daily":"First time a post is liked and daily","first_time":"First time a post is liked"},"email_previous_replies":{"title":"Include previous replies at the bottom of emails","unless_emailed":"unless previously sent"},"email_digests":{"title":"When I don't visit here, send me an email summary of popular topics and replies"},"include_tl0_in_digests":"Include content from new users in summary emails","email_in_reply_to":"Include an excerpt of replied to post in emails","invited":{"reinvite_all":"Resend all Invites","reinvited_all":"All Invites re-sent!"},"summary":{"time_read":"read time","topic_count":{"one":"topic created","other":"topics created"},"post_count":{"one":"post created","other":"posts created"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e received"},"days_visited":{"one":"day visited","other":"days visited"},"posts_read":{"one":"post read","other":"posts read"},"bookmark_count":{"one":"bookmark","other":"bookmarks"},"no_replies":"No replies yet.","no_topics":"No topics yet.","no_badges":"No badges yet.","top_links":"Top Links","no_links":"No links yet.","most_liked_by":"Most Liked By","most_liked_users":"Most Liked","most_replied_to_users":"Most Replied To","no_likes":"No likes yet."}},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}.","rate":{"one":"1 error/%{duration}","other":"%{count} errors/%{duration}"}},"summary":{"description":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies.","description_time":"There are \u003cb\u003e{{replyCount}}\u003c/b\u003e replies with an estimated read time of \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e."},"private_message_info":{"remove_allowed_group":"Do you really want to remove {{name}} from this message?"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"duplicate_link":"It looks like your link to \u003cb\u003e{{domain}}\u003c/b\u003e was already posted in the topic by \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003ea reply {{ago}}\u003c/a\u003e – are you sure you want to post it again?","bold_label":"B","italic_label":"I","link_url_placeholder":"http://example.com","paste_code_text":"type or paste code here","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"notifications":{"empty":"No notifications found.","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and 1 other\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} and {{count}} others\u003c/span\u003e {{description}}\u003c/p\u003e"},"linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNew Topic\u003c/span\u003e {{description}}\u003c/p\u003e"},"search":{"too_short":"Your search term is too short.","context":{"category":"Search the #{{category}} category"}},"topics":{"bulk":{"change_tags":"Change Tags","choose_new_tags":"Choose new tags for these topics:","changed_tags":"The tags of those topics were changed."},"none":{"educate":{"new":"\u003cp\u003eYour new topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered new and will show a \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e indicator if they were created in the last 2 days.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e","unread":"\u003cp\u003eYour unread topics appear here.\u003c/p\u003e\u003cp\u003eBy default, topics are considered unread and will show unread counts \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e if you:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreated the topic\u003c/li\u003e\u003cli\u003eReplied to the topic\u003c/li\u003e\u003cli\u003eRead the topic for more than 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOr if you have explicitly set the topic to Tracked or Watched via the notification control at the bottom of each topic.\u003c/p\u003e\u003cp\u003eVisit your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e to change this.\u003c/p\u003e"}}},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"timeline":{"back":"Back","back_description":"Go back to your last unread post","replies_short":"%{current} / %{total}"},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"title":"change how often you get notified about this topic","reasons":{"mailing_list_mode":"You have mailing list mode enabled, so you will be notified of replies to this topic via email.","3_10":"You will receive notifications because you are watching a tag on this topic."}},"actions":{"make_public":"Make Public Topic","make_private":"Make Private Message"},"automatically_add_to_groups":"This invite also includes access to these groups:","invite_private":{"success_group":"We've invited that group to participate in this message."},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."}},"post":{"errors":{"file_too_large":"Sorry, that file is too big (maximum size is {{max_size_kb}}kb). Why not upload your large file to a cloud sharing service, then share the link?","too_many_dragged_and_dropped_files":"Sorry, you can only upload 10 files at a time."},"via_auto_generated_email":"this post arrived via an auto generated email","few_likes_left":"Thanks for sharing the love! You only have a few likes left for today.","actions":{"people":{"off_topic":"flagged this as off-topic","spam":"flagged this as spam","inappropriate":"flagged this as inappropriate","notify_moderators":"notified moderators","notify_user":"sent a message","bookmark":"bookmarked this","like":"liked this"}},"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}},"revisions":{"controls":{"revert":"Revert to this revision"}}},"category":{"tags":"Tags","tags_allowed_tags":"Tags that can only be used in this category:","tags_allowed_tag_groups":"Tag groups that can only be used in this category:","tags_placeholder":"(Optional) list of allowed tags","tag_groups_placeholder":"(Optional) list of allowed tag groups","notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in these categories."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"official_warning":"Official Warning","delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","notify_staff":"Notify staff privately","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"post_links":{"about":"expand more links for this post","title":{"one":"1 more","other":"%{count} more"}},"lightbox":{"download":"download"},"search_help":{"title":"Search Help"},"keyboard_shortcuts_help":{"title":"Keyboard Shortcuts","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Latest","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e New","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Unread","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categories","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bookmarks","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profile","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Messages"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Go to post #","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Next/previous section"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburger menu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open user menu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Show updated topics","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard help","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Dismiss New/Posts","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Dismiss Topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Log Out"},"actions":{"title":"Actions","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Toggle bookmark topic","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Pin/Unpin topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Share topic","share_post":"\u003cb\u003es\u003c/b\u003e Share post","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reply as linked topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reply to topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reply to post","quote_post":"\u003cb\u003eq\u003c/b\u003e Quote post","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Mute topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Regular (default) topic","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Track topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Watch topic"}},"badges":{"earned_n_times":{"one":"Earned this badge 1 time","other":"Earned this badge %{count} times"},"granted_on":"Granted %{date}","others_count":"Others with this badge (%{count})","title":"Badges","allow_title":"available title","multiple_grant":"awarded multiple times","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 More","other":"+%{count} More"},"granted":{"one":"1 granted","other":"%{count} granted"},"select_badge_for_title":"Select a badge to use as your title","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Getting Started"},"community":{"name":"Community"},"trust_level":{"name":"Trust Level"},"other":{"name":"Other"},"posting":{"name":"Posting"}}},"google_search":"\u003ch3\u003eSearch with Google\u003c/h3\u003e\n\u003cp\u003e\n  \u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n    \u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n    \u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n    \u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n  \u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"All Tags","selector_all_tags":"all tags","selector_no_tags":"no tags","changed":"tags changed:","tags":"Tags","choose_for_topic":"choose optional tags for this topic","delete_tag":"Delete Tag","delete_confirm":"Are you sure you want to delete that tag?","rename_tag":"Rename Tag","rename_instructions":"Choose a new name for the tag:","sort_by":"Sort by:","sort_by_count":"count","sort_by_name":"name","manage_groups":"Manage Tag Groups","manage_groups_description":"Define groups to organize tags","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"title":"Watching","description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"watching_first_post":{"title":"Watching First Post","description":"You will only be notified of the first post in each new topic in this tag."},"tracking":{"title":"Tracking","description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."},"regular":{"title":"Regular","description":"You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Muted","description":"You will not be notified of anything about new topics in this tag, and they will not appear on your unread tab."}},"groups":{"title":"Tag Groups","about":"Add tags to groups to manage them more easily.","new":"New Group","tags_label":"Tags in this group:","parent_tag_label":"Parent tag:","parent_tag_placeholder":"Optional","parent_tag_description":"Tags from this group can't be used unless the parent tag is present.","one_per_topic_label":"Limit one tag per topic from this group","new_name":"New Tag Group","save":"Save","delete":"Delete","confirm_delete":"Are you sure you want to delete this tag group?"},"topics":{"none":{"unread":"You have no unread topics.","new":"You have no new topics.","read":"You haven't read any topics yet.","posted":"You haven't posted in any topics yet.","latest":"There are no latest topics.","hot":"There are no hot topics.","bookmarks":"You have no bookmarked topics yet.","top":"There are no top topics.","search":"There are no search results."},"bottom":{"latest":"There are no more latest topics.","hot":"There are no more hot topics.","posted":"There are no more posted topics.","read":"There are no more read topics.","new":"There are no more new topics.","unread":"There are no more unread topics.","top":"There are no more top topics.","bookmarks":"There are no more bookmarked topics.","search":"There are no more search results."}}},"invite":{"custom_message":"Make your invite a little bit more personal by writing a","custom_message_link":"custom message","custom_message_placeholder":"Enter your custom message","custom_message_template_forum":"Hey, you should join this forum!","custom_message_template_topic":"Hey, I thought you might enjoy this topic!"},"poll":{"public":{"title":"Votes are public."},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choose \u003cstrong\u003e1\u003c/strong\u003e option","other":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choose between \u003cstrong\u003e%{min}\u003c/strong\u003e and \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"error_while_toggling_status":"Sorry, there was an error toggling the status of this poll.","error_while_casting_votes":"Sorry, there was an error casting your votes.","error_while_fetching_voters":"Sorry, there was an error displaying the voters.","ui_builder":{"title":"Build Poll","insert":"Insert Poll","help":{"options_count":"Enter at least 2 options"},"poll_type":{"label":"Type","regular":"Single Choice","multiple":"Multiple Choice","number":"Number Rating"},"poll_config":{"max":"Max","min":"Min","step":"Step"},"poll_public":{"label":"Show who voted"},"poll_options":{"label":"Enter one poll option per line"}}},"details":{"title":"Hide Details"},"admin":{"dashboard":{"reports":{"view_graph":"graph"}},"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"backups":{"read_only":{"enable":{"title":"Enable read-only mode","label":"Enable read-only","confirm":"Are you sure you want to enable read-only mode?"},"disable":{"title":"Disable read-only mode","label":"Disable read-only"}},"operations":{"restore":{"confirm":"Are you sure you want to restore this backup?"},"rollback":{"confirm":"Are you sure you want to rollback the database to the previous working state?"}}},"email":{"bounced":"Bounced","incoming_emails":{"modal":{"title":"Incoming Email Details","headers":"Headers","subject":"Subject","body":"Body","rejection_message":"Rejection Mail"}}},"logs":{"staff_actions":{"actions":{"backup_operation":"backup operation","deleted_tag":"deleted tag","renamed_tag":"renamed tag","revoke_email":"revoke email"}}},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","bounce_score":"Bounce Score","reset_bounce_score":{"label":"Reset","title":"Reset bounce score back to 0"},"staged_explanation":"A staged user can only post via email in specific topics.","bounce_score_explanation":{"none":"No bounces were received recently from that email.","some":"Some bounces were received recently from that email.","threshold_reached":"Received too many bounces from that email."},"tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"user_fields":{"show_on_user_card":{"title":"Show on user card?","enabled":"shown on user card","disabled":"not shown on user card"}},"site_settings":{"categories":{"user_api":"User API","tags":"Tags","search":"Search"}},"badges":{"long_description":"Long Description","trigger_type":{"post_processed":"After a post is processed"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts","embed_classname_whitelist":"Allowed CSS class names"}}}}};
I18n.locale = 'sk';
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
//! locale : slovak (sk)
//! author : Martin Minka : https://github.com/k2s
//! based on work of petrbela : https://github.com/petrbela

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var months = 'január_február_marec_apríl_máj_jún_júl_august_september_október_november_december'.split('_'),
        monthsShort = 'jan_feb_mar_apr_máj_jún_júl_aug_sep_okt_nov_dec'.split('_');
    function plural(n) {
        return (n > 1) && (n < 5);
    }
    function translate(number, withoutSuffix, key, isFuture) {
        var result = number + ' ';
        switch (key) {
        case 's':  // a few seconds / in a few seconds / a few seconds ago
            return (withoutSuffix || isFuture) ? 'pár sekúnd' : 'pár sekundami';
        case 'm':  // a minute / in a minute / a minute ago
            return withoutSuffix ? 'minúta' : (isFuture ? 'minútu' : 'minútou');
        case 'mm': // 9 minutes / in 9 minutes / 9 minutes ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'minúty' : 'minút');
            } else {
                return result + 'minútami';
            }
            break;
        case 'h':  // an hour / in an hour / an hour ago
            return withoutSuffix ? 'hodina' : (isFuture ? 'hodinu' : 'hodinou');
        case 'hh': // 9 hours / in 9 hours / 9 hours ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'hodiny' : 'hodín');
            } else {
                return result + 'hodinami';
            }
            break;
        case 'd':  // a day / in a day / a day ago
            return (withoutSuffix || isFuture) ? 'deň' : 'dňom';
        case 'dd': // 9 days / in 9 days / 9 days ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'dni' : 'dní');
            } else {
                return result + 'dňami';
            }
            break;
        case 'M':  // a month / in a month / a month ago
            return (withoutSuffix || isFuture) ? 'mesiac' : 'mesiacom';
        case 'MM': // 9 months / in 9 months / 9 months ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'mesiace' : 'mesiacov');
            } else {
                return result + 'mesiacmi';
            }
            break;
        case 'y':  // a year / in a year / a year ago
            return (withoutSuffix || isFuture) ? 'rok' : 'rokom';
        case 'yy': // 9 years / in 9 years / 9 years ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'roky' : 'rokov');
            } else {
                return result + 'rokmi';
            }
            break;
        }
    }

    var sk = moment.defineLocale('sk', {
        months : months,
        monthsShort : monthsShort,
        weekdays : 'nedeľa_pondelok_utorok_streda_štvrtok_piatok_sobota'.split('_'),
        weekdaysShort : 'ne_po_ut_st_št_pi_so'.split('_'),
        weekdaysMin : 'ne_po_ut_st_št_pi_so'.split('_'),
        longDateFormat : {
            LT: 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D. MMMM YYYY',
            LLL : 'D. MMMM YYYY H:mm',
            LLLL : 'dddd D. MMMM YYYY H:mm'
        },
        calendar : {
            sameDay: '[dnes o] LT',
            nextDay: '[zajtra o] LT',
            nextWeek: function () {
                switch (this.day()) {
                case 0:
                    return '[v nedeľu o] LT';
                case 1:
                case 2:
                    return '[v] dddd [o] LT';
                case 3:
                    return '[v stredu o] LT';
                case 4:
                    return '[vo štvrtok o] LT';
                case 5:
                    return '[v piatok o] LT';
                case 6:
                    return '[v sobotu o] LT';
                }
            },
            lastDay: '[včera o] LT',
            lastWeek: function () {
                switch (this.day()) {
                case 0:
                    return '[minulú nedeľu o] LT';
                case 1:
                case 2:
                    return '[minulý] dddd [o] LT';
                case 3:
                    return '[minulú stredu o] LT';
                case 4:
                case 5:
                    return '[minulý] dddd [o] LT';
                case 6:
                    return '[minulú sobotu o] LT';
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'za %s',
            past : 'pred %s',
            s : translate,
            m : translate,
            mm : translate,
            h : translate,
            hh : translate,
            d : translate,
            dd : translate,
            M : translate,
            MM : translate,
            y : translate,
            yy : translate
        },
        ordinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return sk;

}));
moment.fn.shortDateNoYear = function(){ return this.format('MMM D'); };
moment.fn.shortDate = function(){ return this.format('YYYY MMM D'); };
moment.fn.longDate = function(){ return this.format('YYYY MMM D h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['sk'] = function (n) {
  if (n == 1) return "one";
  if (n >= 2 && n <= 4) return "few";
  return "other";
};
