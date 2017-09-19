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
r += "Du ";
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
r += "hast <a href='/unread'>ein ungelesenes</a> Thema ";
return r;
},
"other" : function(d){
var r = "";
r += "hast <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ungelesene</a> Themen ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["de"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "und ";
return r;
},
"false" : function(d){
var r = "";
r += "hast ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>ein neues</a> Thema";
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
r += "und ";
return r;
},
"false" : function(d){
var r = "";
r += "hast ";
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
})() + " neue</a> Themen";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["de"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Oder ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "entdecke andere Themen in ";
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
r += "Dieses Thema hat ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 Antwort";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " Antworten";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["de"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "mit einem hohen Verhältnis von Likes zu Beiträgen";
return r;
},
"med" : function(d){
var r = "";
r += "mit einem sehr hohen Verhältnis von Likes zu Beiträgen";
return r;
},
"high" : function(d){
var r = "";
r += "mit einem extrem hohen Verhältnis von Likes zu Beiträgen";
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

MessageFormat.locale.de = function ( n ) {
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
I18n.translations = {"de":{"js":{"number":{"format":{"separator":",","delimiter":"."},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"HH:mm","timeline_date":"MMM YYYY","long_no_year":"D. MMM [um] HH:mm","long_no_year_no_time":"D. MMM","full_no_year_no_time":"D. MMMM","long_with_year":"D. MMM YYYY [um] HH:mm","long_with_year_no_time":"D. MMM YYYY","full_with_year_no_time":"D. MMMM YYYY","long_date_with_year":"D. MMM YYYY [um] HH:mm","long_date_without_year":"D. MMM [um] HH:mm","long_date_with_year_without_time":"D. MMM YYYY","long_date_without_year_with_linebreak":"D. MMM\u003cbr/\u003eHH:mm","long_date_with_year_with_linebreak":"D. MMM YYYY\u003cbr/\u003eHH:mm","wrap_ago":"vor %{date}","tiny":{"half_a_minute":"\u003c 1min","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1min","other":"%{count}min"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_month":"D. MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 Minute","other":"%{count} Minuten"},"x_hours":{"one":"1 Stunde","other":"%{count} Stunden"},"x_days":{"one":"1 Tag","other":"%{count} Tage"},"date_year":"D. MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"vor einer Minute","other":"vor %{count} Minuten"},"x_hours":{"one":"vor einer Stunde","other":"vor %{count} Stunden"},"x_days":{"one":"vor einem Tag","other":"vor %{count} Tagen"}},"later":{"x_days":{"one":"einen Tag später","other":"%{count} Tage später"},"x_months":{"one":"einen Monat später","other":"%{count} Monate später"},"x_years":{"one":"ein Jahr später","other":"%{count} Jahre später"}},"previous_month":"Vormonat","next_month":"Nächster Monat"},"share":{"topic":"Teile einen Link zu diesem Thema","post":"Beitrag #%{postNumber}","close":"Schließen","twitter":"diesen Link auf Twitter teilen","facebook":"diesen Link auf Facebook teilen","google+":"diesen Link auf Google+ teilen","email":"diesen Link per E-Mail senden"},"action_codes":{"public_topic":"hat das Thema %{when} öffentlich gemacht","private_topic":"hat das Thema %{when} privat gemacht","split_topic":"Thema aufgeteilt, %{when}","invited_user":"%{who} eingeladen, %{when}","invited_group":"%{who} eingeladen, %{when}","removed_user":"%{who} entfernt, %{when}","removed_group":"%{who} entfernt, %{when}","autoclosed":{"enabled":"geschlossen, %{when}","disabled":"geöffnet, %{when}"},"closed":{"enabled":"geschlossen, %{when}","disabled":"geöffnet, %{when}"},"archived":{"enabled":"archiviert, %{when}","disabled":"aus dem Archiv geholt, %{when}"},"pinned":{"enabled":"angeheftet, %{when}","disabled":"losgelöst, %{when}"},"pinned_globally":{"enabled":"global angeheftet, %{when}","disabled":"losgelöst, %{when}"},"visible":{"enabled":"sichtbar gemacht, %{when}","disabled":"unsichtbar gemacht, %{when}"}},"topic_admin_menu":"Thema administrieren","emails_are_disabled":"Die ausgehende E-Mail-Kommunikation wurde von einem Administrator global deaktiviert. Es werden keinerlei Benachrichtigungen per E-Mail verschickt.","bootstrap_mode_enabled":"Damit du mit deiner Site einfacher loslegen kannst, befindest du dich im Bootstrapping-Modus. Alle neuen Benutzer erhalten die Vertrauensstufe 1 und bekommen eine tägliche Zusammenfassung per E-Mail. Der Modus wird automatisch deaktiviert, sobald sich mindestens %{min_users} Benutzer angemeldet haben.","bootstrap_mode_disabled":"Der Bootstrapping-Modus wird innerhalb der nächsten 24 Stunden deaktiviert.","s3":{"regions":{"us_east_1":"USA Ost (Nord-Virginia)","us_west_1":"USA West (Nordkalifornien)","us_west_2":"USA West (Oregon)","us_gov_west_1":"AWS GovCloud (USA)","eu_west_1":"EU (Irland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asien-Pazifik (Singapur)","ap_southeast_2":"Asien-Pazifik (Sydney)","ap_south_1":"Asien-Pazifik (Mumbai)","ap_northeast_1":"Asien-Pazifik (Tokio)","ap_northeast_2":"Asien-Pazifik (Seoul)","sa_east_1":"Südamerika (São Paulo)","cn_north_1":"China (Peking)"}},"edit":"Titel und Kategorie dieses Themas ändern","not_implemented":"Entschuldige, diese Funktion wurde noch nicht implementiert!","no_value":"Nein","yes_value":"Ja","generic_error":"Entschuldige, es ist ein Fehler aufgetreten.","generic_error_with_reason":"Ein Fehler ist aufgetreten: %{error}","sign_up":"Registrieren","log_in":"Anmelden","age":"Alter","joined":"Beigetreten","admin_title":"Administration","flags_title":"Meldungen","show_more":"mehr anzeigen","show_help":"Optionen","links":"Links","links_lowercase":{"one":"Link","other":"Links"},"faq":"FAQ","guidelines":"Richtlinien","privacy_policy":"Datenschutzrichtlinie","privacy":"Datenschutz","terms_of_service":"Nutzungsbedingungen","mobile_view":"Mobile Ansicht","desktop_view":"Desktop Ansicht","you":"Du","or":"oder","now":"gerade eben","read_more":"weiterlesen","more":"Mehr","less":"Weniger","never":"nie","every_30_minutes":"alle 30 Minuten","every_hour":"jede Stunde","daily":"täglich","weekly":"wöchentlich","every_two_weeks":"jede zweite Woche","every_three_days":"alle drei Tage","max_of_count":"von max. {{count}}","alternation":"oder","character_count":{"one":"{{count}} Zeichen","other":"{{count}} Zeichen"},"suggested_topics":{"title":"Vorgeschlagene Themen","pm_title":"Vorgeschlagene Nachrichten"},"about":{"simple_title":"Über uns","title":"Über %{title}","stats":"Website-Statistiken","our_admins":"Unsere Administratoren","our_moderators":"Unsere Moderatoren","stat":{"all_time":"Gesamt","last_7_days":"Letzten 7 Tage","last_30_days":"Letzten 30 Tage"},"like_count":"Likes","topic_count":"Themen","post_count":"Beiträge","user_count":"Neue Benutzer","active_user_count":"Aktive Benutzer","contact":"Kontaktiere uns","contact_info":"Im Falle eines kritischen Problems oder einer dringenden Sache, die diese Website betreffen, kontaktiere uns bitte unter %{contact_info}."},"bookmarked":{"title":"Lesezeichen setzen","clear_bookmarks":"Lesezeichen entfernen","help":{"bookmark":"Klicke hier, um ein Lesezeichen auf den ersten Beitrag in diesem Thema zu setzen.","unbookmark":"Klicke hier, um alle Lesezeichen in diesem Thema zu entfernen."}},"bookmarks":{"not_logged_in":"Entschuldige, du musst angemeldet sein, um ein Lesezeichen setzen zu können.","created":"du hast ein Lesezeichen zu diesem Beitrag hinzugefügt","not_bookmarked":"Du hast diesen Beitrag gelesen. Klicke, um ein Lesezeichen zu setzen.","last_read":"Das ist der letzte Beitrag, den du gelesen hast. Klicke, um ein Lesezeichen zu setzen.","remove":"Lesezeichen entfernen","confirm_clear":"Bist du sicher, dass du alle Lesezeichen in diesem Thema entfernen möchtest?"},"topic_count_latest":{"one":"{{count}} neues oder geändertes Thema.","other":"{{count}} neue oder geänderte Themen."},"topic_count_unread":{"one":"{{count}} ungelesenes Thema.","other":"{{count}} ungelesene Themen."},"topic_count_new":{"one":"{{count}} neues Thema.","other":"{{count}} neue Themen."},"click_to_show":"Klicke zum Anzeigen.","preview":"Vorschau","cancel":"Abbrechen","save":"Änderungen speichern","saving":"Speichere…","saved":"Gespeichert!","upload":"Hochladen","uploading":"Wird hochgeladen…","uploading_filename":"{{filename}} wird hochgeladen…","uploaded":"Hochgeladen!","enable":"Aktivieren","disable":"Deaktivieren","undo":"Rückgängig machen","revert":"Verwerfen","failed":"Fehlgeschlagen","switch_to_anon":"Anonymen Modus beginnen","switch_from_anon":"Anonymen Modus beenden","banner":{"close":"Diesen Banner ausblenden.","edit":"Diesen Ankündigungsbanner bearbeiten \u003e\u003e"},"choose_topic":{"none_found":"Keine Themen gefunden.","title":{"search":"Suche nach Thema anhand von Name, URL oder ID:","placeholder":"Gib hier den Titel des Themas ein"}},"queue":{"topic":"Thema:","approve":"Genehmigen","reject":"Ablehnen","delete_user":"Benutzer löschen","title":"Benötigt Genehmigung","none":"Es sind keine Beiträge zur Überprüfung vorhanden.","edit":"Bearbeiten","cancel":"Abbrechen","view_pending":"ausstehende Beiträge anzeigen","has_pending_posts":{"one":"Dieses Thema hat \u003cb\u003eeinen\u003c/b\u003e Beitrag, der genehmigt werden muss","other":"Dieses Thema hat \u003cb\u003e{{count}}\u003c/b\u003e Beiträge, die genehmigt werden müssen"},"confirm":"Änderungen speichern","delete_prompt":"Möchtest du wirklich \u003cb\u003e%{username}\u003c/b\u003e löschen? Damit werden alle Beiträge des Benutzers entfernt und dessen E-Mail- und IP-Adresse geblockt.","approval":{"title":"Beitrag muss genehmigt werden","description":"Wir haben deinen neuen Beitrag erhalten. Dieser muss allerdings zunächst durch einen Moderator freigeschaltet werden. Bitte habe etwas Geduld. ","pending_posts":{"one":"Du hast \u003cstrong\u003e1\u003c/strong\u003e ausstehenden Beitrag.","other":"Du hast \u003cstrong\u003e{{count}}\u003c/strong\u003e ausstehende Beiträge."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e hat \u003ca href='{{topicUrl}}'\u003edas Thema\u003c/a\u003e verfasst","you_posted_topic":"\u003ca href=\"{{userUrl}}\"\u003eDu\u003c/a\u003e hast \u003ca href=\"{{topicUrl}}\"\u003edas Thema\u003c/a\u003e verfasst","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e hat auf \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e geantwortet","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e hast auf \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e geantwortet","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e hat auf \u003ca href='{{topicUrl}}'\u003edas Thema\u003c/a\u003e geantwortet","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e hast auf \u003ca href='{{topicUrl}}'\u003edas Thema\u003c/a\u003e geantwortet","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e hat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e erwähnt","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e hat \u003ca href='{{user2Url}}'\u003edich\u003c/a\u003e erwähnt","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eDu\u003c/a\u003e hast \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e erwähnt","posted_by_user":"Geschrieben von \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Von \u003ca href='{{userUrl}}'\u003edir\u003c/a\u003e geschrieben","sent_by_user":"Von \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e gesendet","sent_by_you":"Von \u003ca href='{{userUrl}}'\u003edir\u003c/a\u003e gesendet"},"directory":{"filter_name":"nach Benutzername filtern","title":"Benutzer","likes_given":"Gegeben","likes_received":"Erhalten","topics_entered":"Betrachtet","topics_entered_long":"Betrachtete Themen","time_read":"Lesezeit","topic_count":"Themen","topic_count_long":"Erstellte Themen","post_count":"Beiträge","post_count_long":"Verfasste Beiträge","no_results":"Es wurden keine Ergebnisse gefunden.","days_visited":"Aufrufe","days_visited_long":"Besuchstage","posts_read":"Gelesen","posts_read_long":"Gelesene Beiträge","total_rows":{"one":"1 Benutzer","other":"%{count} Benutzer"}},"groups":{"empty":{"posts":"Es gibt keinen Beitrag von Mitgliedern dieser Gruppe.","members":"Diese Gruppe hat keine Mitglieder.","mentions":"Diese Gruppe wurde nicht erwähnt.","messages":"Es gibt keine Nachrichten für diese Gruppe.","topics":"Es gibt kein Thema von Mitgliedern dieser Gruppe."},"add":"Hinzufügen","selector_placeholder":"Mitglieder hinzufügen","owner":"Eigentümer","visible":"Gruppe ist für alle Benutzer sichtbar","index":"Gruppen","title":{"one":"Gruppe","other":"Gruppen"},"members":"Mitglieder","topics":"Themen","posts":"Beiträge","mentions":"Erwähnungen","messages":"Nachrichten","alias_levels":{"title":"Wer kann diese Gruppe kontaktieren und per @Gruppenname erwähnen?","nobody":"Niemand","only_admins":"Nur Administratoren","mods_and_admins":"Nur Moderatoren und Administratoren","members_mods_and_admins":"Nur Gruppenmitglieder, Moderatoren und Administratoren","everyone":"Jeder"},"trust_levels":{"title":"Vertrauensstufe, die neuen Mitgliedern automatisch verliehen wird:","none":"keine"},"notifications":{"watching":{"title":"Beobachten","description":"Du wirst über jeden neuen Beitrag in jeder Nachricht benachrichtigt und die Anzahl neuer Antworten wird angezeigt."},"watching_first_post":{"title":"Ersten Beitrag beobachten","description":"Du erhältst nur eine Benachrichtigung für den ersten Beitrag in jedem neuen Thema in dieser Gruppe."},"tracking":{"title":"Verfolgen","description":"Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet, und die Anzahl neuer Antworten wird angezeigt."},"regular":{"title":"Normal","description":"Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet."},"muted":{"title":"Stummgeschaltet","description":"Du erhältst keine Benachrichtigungen über neue Themen in dieser Gruppe."}}},"user_action_groups":{"1":"Abgegebene Likes","2":"Erhaltene Likes","3":"Lesezeichen","4":"Themen","5":"Beiträge","6":"Antworten","7":"Erwähnungen","9":"Zitate","11":"Änderungen","12":"Gesendete Objekte","13":"Posteingang","14":"Ausstehend"},"categories":{"all":"Alle Kategorien","all_subcategories":"alle","no_subcategory":"keine","category":"Kategorie","category_list":"Kategorieliste anzeigen","reorder":{"title":"Kategorien neu sortieren","title_long":"Neustrukturierung der Kategorieliste","fix_order":"Positionen korrigieren","fix_order_tooltip":"Nicht alle Kategorien haben eine eindeutige Positionsnummer, was zu unerwarteten Ergebnissen führen kann.","save":"Reihenfolge speichern","apply_all":"Anwenden","position":"Position"},"posts":"Beiträge","topics":"Themen","latest":"Aktuelle Themen","latest_by":"neuester Beitrag von","toggle_ordering":"Reihenfolge ändern","subcategories":"Unterkategorien","topic_sentence":{"one":"1 Thema","other":"%{count} Themen"},"topic_stat_sentence":{"one":"1 neues Thema seit 1 %{unit}.","other":"%{count} neue Themen seit 1 %{unit}."}},"ip_lookup":{"title":"IP-Adressen-Abfrage","hostname":"Hostname","location":"Standort","location_not_found":"(unbekannt)","organisation":"Organisation","phone":"Telefon","other_accounts":"Andere Konten mit dieser IP-Adresse:","delete_other_accounts":"%{count} löschen","username":"Benutzername","trust_level":"VS","read_time":"Lesezeit","topics_entered":"betrachtete Themen","post_count":"# Beiträge","confirm_delete_other_accounts":"Bist du sicher, dass du diese Konten löschen willst?"},"user_fields":{"none":"(wähle eine Option aus)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Stummschalten","edit":"Einstellungen bearbeiten","download_archive":"Meine Beiträge herunterladen","new_private_message":"Neue Nachricht","private_message":"Nachricht","private_messages":"Nachrichten","activity_stream":"Aktivität","preferences":"Einstellungen","expand_profile":"Erweitern","bookmarks":"Lesezeichen","bio":"Über mich","invited_by":"Eingeladen von","trust_level":"Vertrauensstufe","notifications":"Benachrichtigungen","statistics":"Statistiken","desktop_notifications":{"label":"Desktop-Benachrichtigungen","not_supported":"Dieser Browser unterstützt leider keine Benachrichtigungen.","perm_default":"Benachrichtigungen einschalten","perm_denied_btn":"Zugriff verweigert","perm_denied_expl":"Du hast das Anzeigen von Benachrichtigungen verboten. Aktiviere die Benachrichtigungen über deine Browser-Einstellungen.","disable":"Benachrichtigungen deaktivieren","enable":"Benachrichtigungen aktivieren","each_browser_note":"Hinweis: Du musst diese Einstellung in jedem von dir verwendeten Browser ändern."},"dismiss_notifications":"Alles ausblenden","dismiss_notifications_tooltip":"Alle ungelesenen Benachrichtigungen als gelesen markieren","disable_jump_reply":"Springe nicht zu meinem Beitrag, nachdem ich geantwortet habe","dynamic_favicon":"Zeige die Anzahl der neuen und geänderten Themen im Browser-Symbol an","external_links_in_new_tab":"Öffne alle externen Links in einem neuen Tab","enable_quoting":"Aktiviere Zitatantwort mit dem hervorgehobenen Text","change":"ändern","moderator":"{{user}} ist ein Moderator","admin":"{{user}} ist ein Administrator","moderator_tooltip":"Dieser Benutzer ist ein Moderator","admin_tooltip":"Dieser Benutzer ist ein Administrator","blocked_tooltip":"Dieser Benutzer wird blockiert.","suspended_notice":"Dieser Benutzer ist bis zum {{date}} gesperrt.","suspended_reason":"Grund: ","github_profile":"Github","email_activity_summary":"Aktivitäts-Übersicht","mailing_list_mode":{"label":"Mailinglisten-Modus","enabled":"Mailinglisten-Modus aktivieren","instructions":"Diese Einstellung überschreibt die Aktivitäts-Übersicht.\u003cbr /\u003e\nStummgeschaltete Themen und Kategorien werden in diesen E-Mails nicht eingeschlossen.\n","daily":"Aktualisierungen täglich senden","individual":"Für jeden Beitrag eine E-Mail senden","many_per_day":"Sende mir für jeden neuen Beitrag eine E-Mail (etwa {{dailyEmailEstimate}} pro Tag)","few_per_day":"Sende mir für jeden neuen Beitrag eine E-Mail (etwa 2 pro Tag)"},"tag_settings":"Schlagwörter","watched_tags":"Beobachtet","watched_tags_instructions":"Du wirst automatisch alle neuen Themen imit diesen Schlagwörtern beobachten. Du wirst über alle neuen Beiträge und Themen benachrichtigt und die Anzahl der neuen Antworten wird bei den betroffenen Themen angezeigt.","tracked_tags":"Verfolgt","tracked_tags_instructions":"Du wirst automatisch alle Themen mit diesen Schlagwörtern verfolgen. Die Anzahl der neuen Antworten wird bei den betroffenen Themen angezeigt.","muted_tags":"Stummgeschaltet","muted_tags_instructions":"Du erhältst keine Benachrichtigungen über neue Themen mit diesen Schlagwörtern und die Themen werden auch nicht in der Liste der aktuellen Themen erscheinen.","watched_categories":"Beobachtet","watched_categories_instructions":"Du wirst automatisch alle neuen Themen in diesen Kategorien beobachten. Du wirst über alle neuen Beiträge und Themen benachrichtigt und die Anzahl der neuen Antworten wird bei den betroffenen Themen angezeigt.","tracked_categories":"Verfolgt","tracked_categories_instructions":"Du wirst automatisch alle Themen in diesen Kategorien verfolgen. Die Anzahl der neuen Beiträge wird neben dem Thema erscheinen.","watched_first_post_categories":"Ersten Beitrag beobachten","watched_first_post_categories_instructions":"Du erhältst eine Benachrichtigung für den ersten Beitrag in jedem neuen Thema in diesen Kategorien.","watched_first_post_tags":"Ersten Beitrag beobachten","watched_first_post_tags_instructions":"Du erhältst eine Benachrichtigung für den ersten Beitrag in jedem neuen Thema mit diesen Schlagwörtern.","muted_categories":"Stummgeschaltet","muted_categories_instructions":"Du erhältst keine Benachrichtigungen über neue Themen in dieser Kategorie und die Themen werden auch nicht in der Liste der aktuellen Themen erscheinen.","delete_account":"Lösche mein Benutzerkonto","delete_account_confirm":"Möchtest du wirklich dein Benutzerkonto permanent löschen? Diese Aktion kann nicht rückgängig gemacht werden!","deleted_yourself":"Dein Benutzerkonto wurde erfolgreich gelöscht.","delete_yourself_not_allowed":"Du kannst im Moment dein Benutzerkonto nicht löschen. Kontaktiere einen Administrator, um dein Benutzerkonto löschen zu lassen.","unread_message_count":"Nachrichten","admin_delete":"Löschen","users":"Benutzer","muted_users":"Stummgeschaltet","muted_users_instructions":"Alle Benachrichtigungen von diesem Benutzer unterdrücken.","muted_topics_link":"Zeige stummgeschaltete Themen","watched_topics_link":"Zeige beobachtete Themen","automatically_unpin_topics":"Angeheftete Themen automatisch loslösen, wenn ich deren letzten Beitrag gelesen habe.","api_permissions":"Berechtigungen:","api_read":"Lesen","api_read_write":"Lesen und Schreiben","staff_counters":{"flags_given":"hilfreiche Meldungen","flagged_posts":"gemeldete Beiträge","deleted_posts":"gelöschte Beiträge","suspensions":"Sperren","warnings_received":"Warnungen"},"messages":{"all":"Alle","inbox":"Posteingang","sent":"Gesendet","archive":"Archiv","groups":"Meine Gruppen","bulk_select":"Nachrichten auswählen","move_to_inbox":"In Posteingang verschieben","move_to_archive":"Archivieren","failed_to_move":"Die ausgewählten Nachrichten konnten nicht verschoben werden. Vielleicht gibt es ein Netzwerkproblem.","select_all":"Alle auswählen"},"change_password":{"success":"(E-Mail gesendet)","in_progress":"(E-Mail wird gesendet)","error":"(Fehler)","action":"Sende eine E-Mail zum Zurücksetzen des Passworts","set_password":"Passwort ändern"},"change_about":{"title":"„Über mich“ ändern","error":"Beim Ändern dieses Wertes ist ein Fehler aufgetreten."},"change_username":{"title":"Benutzernamen ändern","confirm":"Wenn du deinen Benutzernamen änderst, werden alle vorherigen Zitate deiner Beiträge und Erwähnungen deines vorherigen @Namens nicht mehr funktonieren. Bist du dir ganz sicher, dass du das tun möchtest?","taken":"Der Benutzername ist bereits vergeben.","error":"Bei der Änderung deines Benutzernamens ist ein Fehler aufgetreten.","invalid":"Der Benutzernamen ist nicht zulässig. Er darf nur Zahlen und Buchstaben enthalten."},"change_email":{"title":"E-Mail-Adresse ändern","taken":"Entschuldige, diese E-Mail-Adresse ist nicht verfügbar.","error":"Beim Ändern der E-Mail-Adresse ist ein Fehler aufgetreten. Möglicherweise wird diese Adresse schon benutzt.","success":"Wir haben eine E-Mail an die angegebene E-Mail-Adresse gesendet. Folge zur Bestätigung der Adresse bitte den darin enthaltenen Anweisungen."},"change_avatar":{"title":"Ändere dein Profilbild","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, basierend auf","gravatar_title":"Ändere deinen Avatar auf der Gravatar-Webseite","refresh_gravatar_title":"Deinen Gravatar aktualisieren","letter_based":"ein vom System zugewiesenes Profilbild","uploaded_avatar":"Eigenes Bild","uploaded_avatar_empty":"Eigenes Bild hinzufügen","upload_title":"Lade dein Bild hoch","upload_picture":"Bild hochladen","image_is_not_a_square":"Achtung: Wir haben dein Bild zugeschnitten, weil Höhe und Breite nicht übereingestimmt haben.","cache_notice":"Du hast dein Profilbild erfolgreich geändert. Aufgrund von Caching im Browser kann es eine Weile dauern, bis dieses angezeigt wird."},"change_profile_background":{"title":"Profilhintergrund","instructions":"Hintergrundbilder werden zentriert und haben eine Standardbreite von 850px."},"change_card_background":{"title":"Benutzerkarten-Hintergrund","instructions":"Hintergrundbilder werden zentriert und haben eine Standardbreite von 590px."},"email":{"title":"E-Mail","instructions":"Wird niemals öffentlich angezeigt","ok":"Wir senden dir zur Bestätigung eine E-Mail","invalid":"Bitte gib eine gültige E-Mail-Adresse ein","authenticated":"Deine E-Mail-Adresse wurde von {{provider}} bestätigt","frequency_immediately":"Wir werden dir sofort eine E-Mail senden, wenn du die betroffenen Inhalte noch nicht gelesen hast.","frequency":{"one":"Wir werden dir nur dann eine E-Mail senden, wenn wir dich nicht innerhalb der letzten Minute gesehen haben.","other":"Wir werden dir nur dann eine E-Mail senden, wenn wir dich nicht innerhalb der letzten {{count}} Minuten gesehen haben."}},"name":{"title":"Name","instructions":"Dein vollständiger Name (optional)","instructions_required":"Dein vollständiger Name","too_short":"Dein Name ist zu kurz","ok":"Dein Name sieht in Ordnung aus"},"username":{"title":"Benutzername","instructions":"Eindeutig, keine Leerzeichen, kurz","short_instructions":"Leute können dich mit @{{username}} erwähnen","available":"Dein Benutzername ist verfügbar","global_match":"E-Mail-Adresse entspricht dem registrierten Benutzernamen","global_mismatch":"Bereits registriert. Wie wäre es mit {{suggestion}}?","not_available":"Nicht verfügbar. Wie wäre es mit {{suggestion}}?","too_short":"Dein Benutzername ist zu kurz","too_long":"Dein Benutzername ist zu lang","checking":"Verfügbarkeit wird geprüft…","enter_email":"Benutzername gefunden; gib die zugehörige E-Mail-Adresse ein","prefilled":"E-Mail-Adresse entspricht diesem registrierten Benutzernamen"},"locale":{"title":"Oberflächensprache","instructions":"Die Sprache der Forumsoberfläche. Diese Änderung tritt nach dem Neuladen der Seite in Kraft.","default":"(Standard)"},"password_confirmation":{"title":"Wiederholung des Passworts"},"last_posted":"Letzter Beitrag","last_emailed":"Letzte E-Mail","last_seen":"Zuletzt gesehen","created":"Mitglied seit","log_out":"Abmelden","location":"Wohnort","card_badge":{"title":"Benutzerkarten-Abzeichen"},"website":"Website","email_settings":"E-Mail","like_notification_frequency":{"title":"Benachrichtigung für erhaltene Likes anzeigen","always":"immer","first_time_and_daily":"erster Like eines Beitrags und täglich","first_time":"nur erster Like eines Beitrags","never":"nie"},"email_previous_replies":{"title":"Füge vorherige Beiträge ans Ende von E-Mails an","unless_emailed":"sofern noch nicht gesendet","always":"immer","never":"nie"},"email_digests":{"title":"Sende mir eine E-Mail-Zusammenfassung mit beliebten Themen und Antworten, wenn ich länger nicht hier war:","every_30_minutes":"alle 30 Minuten","every_hour":"stündlich","daily":"täglich","every_three_days":"alle drei Tage","weekly":"wöchentlich","every_two_weeks":"jede zweite Woche"},"include_tl0_in_digests":"Inhalte neuer Benutzer in E-Mail-Zusammenfassung einschließen","email_in_reply_to":"Einen Auszug aus dem beantworteten Beitrag in E-Mails einfügen.","email_direct":"Sende mir eine E-Mail, wenn mich jemand zitiert, auf meine Beiträge antwortet, meinen @Namen erwähnt oder mich zu einem Thema einlädt.","email_private_messages":"Sende mir eine E-Mail, wenn mir jemand eine Nachricht sendet.","email_always":"Benachrichtige mich per E-Mail auch während ich auf dieser Website aktiv bin","other_settings":"Andere","categories_settings":"Kategorien","new_topic_duration":{"label":"Themen als neu ansehen, wenn","not_viewed":"ich diese noch nicht betrachtet habe","last_here":"seit meinem letzten Besuch erstellt","after_1_day":"innerhalb des letzten Tages erstellt","after_2_days":"in den letzten 2 Tagen erstellt","after_1_week":"in der letzten Woche erstellt","after_2_weeks":"in den letzten 2 Wochen erstellt"},"auto_track_topics":"Betrachteten Themen automatisch folgen","auto_track_options":{"never":"nie","immediately":"sofort","after_30_seconds":"nach 30 Sekunden","after_1_minute":"nach 1 Minute","after_2_minutes":"nach 2 Minuten","after_3_minutes":"nach 3 Minuten","after_4_minutes":"nach 4 Minuten","after_5_minutes":"nach 5 Minuten","after_10_minutes":"nach 10 Minuten"},"invited":{"search":"zum Suchen nach Einladungen hier eingeben…","title":"Einladungen","user":"Eingeladener Benutzer","sent":"Gesendet","none":"Es gibt keine ausstehenden Einladungen.","truncated":{"one":"Zeige die erste Einladung.","other":"Zeige die ersten {{count}} Einladungen."},"redeemed":"Angenommene Einladungen","redeemed_tab":"Angenommen","redeemed_tab_with_count":"Angenommen ({{count}})","redeemed_at":"Angenommen","pending":"Ausstehende Einladungen","pending_tab":"Ausstehend","pending_tab_with_count":"Ausstehend ({{count}})","topics_entered":"Betrachtete Themen","posts_read_count":"Gelesene Beiträge","expired":"Diese Einladung ist abgelaufen.","rescind":"Einladung zurücknehmen","rescinded":"Einladung zurückgenommen","reinvite":"Einladung erneut senden","reinvite_all":"Alle Einladungen erneut senden","reinvited":"Einladung erneut gesendet","reinvited_all":"Alle Einladungen erneut gesendet!","time_read":"Lesezeit","days_visited":"Besuchstage","account_age_days":"Konto-Alter in Tagen","create":"Einladung versenden","generate_link":"Einladungslink kopieren","generated_link_message":"\u003cp\u003eEinladungslink erfolgreich generiert!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eDer Einladungslink ist nur für folgende E-Mail-Adresse gültig: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Du hast noch niemanden hierher eingeladen. Du kannst individuelle Einladungen verschicken oder eine Masseneinladung an eine Gruppe von Leuten verschicken indem du \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eeine Datei für Masseneinladung\u003c/a\u003e hochlädst.","text":"Masseneinladung aus Datei","uploading":"Wird hochgeladen…","success":"Die Datei wurde erfolgreich hochgeladen. Du erhältst eine Nachricht, sobald der Vorgang abgeschlossen ist.","error":"Beim Hochladen der Datei '{{filename}}' ist ein Fehler aufgetreten: {{message}}"}},"password":{"title":"Passwort","too_short":"Dein Passwort ist zu kurz.","common":"Das Passwort wird zu häufig verwendet.","same_as_username":"Dein Passwort entspricht deinem Benutzernamen.","same_as_email":"Dein Passwort entspricht deiner E-Mail-Adresse.","ok":"Dein Passwort sieht in Ordnung aus.","instructions":"Mindestens %{count} Zeichen."},"summary":{"title":"Übersicht","stats":"Statistiken","time_read":"Lesezeit","topic_count":{"one":"Thema erstellt","other":"Themen erstellt"},"post_count":{"one":"Beitrag erstellt","other":"Beiträge erstellt"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e gegeben","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e gegeben"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e erhalten","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e erhalten"},"days_visited":{"one":"Tag vorbeigekommen","other":"Tage vorbeigekommen"},"posts_read":{"one":"Beitrag gelesen","other":"Beiträge gelesen"},"bookmark_count":{"one":"Lesezeichen","other":"Lesezeichen"},"top_replies":"Die besten Beiträge","no_replies":"Noch keine Antworten.","more_replies":"weitere Beiträge","top_topics":"Die besten Themen","no_topics":"Noch keine Themen.","more_topics":"weitere Themen","top_badges":"Die besten Abzeichen","no_badges":"Noch keine Abzeichen.","more_badges":"weitere Abzeichen","top_links":"Die besten Links","no_links":"Noch keine Links.","most_liked_by":"Häufigste „Gefällt mir“-Angaben von","most_liked_users":"Häufigste „Gefällt mir“-Angaben für","most_replied_to_users":"Häufigste Antworten an","no_likes":"Noch keine „Gefällt mir“-Angaben."},"associated_accounts":"Anmeldeinformationen","ip_address":{"title":"Letzte IP-Adresse"},"registration_ip_address":{"title":"IP-Adresse bei Registrierung"},"avatar":{"title":"Profilbild","header_title":"Profil. Nachrichten, Lesezeichen und Einstellungen"},"title":{"title":"Titel"},"filters":{"all":"Alle"},"stream":{"posted_by":"Verfasst von","sent_by":"Gesendet von","private_message":"Nachricht","the_topic":"das Thema"}},"loading":"Wird geladen…","errors":{"prev_page":"während des Ladens","reasons":{"network":"Netzwerkfehler","server":"Server-Fehler","forbidden":"Zugriff verweigert","unknown":"Fehler","not_found":"Seite nicht gefunden"},"desc":{"network":"Bitte überprüfe deine Netzwerkverbindung.","network_fixed":"Sieht aus, als wäre es wieder da.","server":"Fehlercode: {{status}}","forbidden":"Du darfst das nicht ansehen.","not_found":"Hoppla! Die Anwendung hat versucht eine URL zu laden, die nicht existiert.","unknown":"Etwas ist schief gelaufen."},"buttons":{"back":"Zurück","again":"Erneut versuchen","fixed":"Seite laden"}},"close":"Schließen","assets_changed_confirm":"Diese Website wurde gerade aktualisiert. Neu laden für die neuste Version?","logout":"Du wurdest abgemeldet.","refresh":"Aktualisieren","read_only_mode":{"enabled":"Diese Website befindet sich im Nur-Lesen-Modus. Du kannst weiterhin Inhalte lesen, aber das Erstellen von Beiträgen, Vergeben von Likes und Durchführen einiger weiterer Aktionen ist derzeit nicht möglich.","login_disabled":"Die Anmeldung ist deaktiviert während sich die Website im Nur-Lesen-Modus befindet.","logout_disabled":"Die Abmeldung ist deaktiviert während sich die Website im Nur-Lesen-Modus befindet."},"too_few_topics_and_posts_notice":"Lass' \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003edie Diskussionen starten!\u003c/a\u003e Es existieren bisher \u003cstrong\u003e%{currentTopics} von %{requiredTopics}\u003c/strong\u003e benötigten Themen und \u003cstrong\u003e%{currentPosts} von %{requiredPosts}\u003c/strong\u003e benötigten Beiträgen. Neue Besucher benötigen bestehende Konversationen, die sie lesen und auf die sie antworten können.","too_few_topics_notice":"Lass' \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003edie Diskussionen starten!\u003c/a\u003e Es existieren bisher \u003cstrong\u003e%{currentTopics} von %{requiredTopics}\u003c/strong\u003e benötigten Themen. Neue Besucher benötigen bestehende Konversationen, die sie lesen und auf die sie antworten können.","too_few_posts_notice":"Lass' \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003edie Diskussionen starten!\u003c/a\u003e Es existieren bisher \u003cstrong\u003e%{currentPosts} von %{requiredPosts}\u003c/strong\u003e benötigten Beiträgen. Neue Besucher benötigen bestehende Konversationen, die sie lesen und auf die sie antworten können.","logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e hat die eingestellte Grenze für die Site von %{siteSettingRate} erreicht.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e hat die eingestellte Grenze für die Site von %{siteSettingRate} überschritten.","rate":{"one":"ein Fehler/%{duration}","other":"%{count} Fehler/%{duration}"}},"learn_more":"mehr erfahren…","year":"Jahr","year_desc":"Themen, die in den letzten 365 Tagen erstellt wurden","month":"Monat","month_desc":"Themen, die in den letzten 30 Tagen erstellt wurden","week":"Woche","week_desc":"Themen, die in den letzten 7 Tagen erstellt wurden","day":"Tag","first_post":"Erster Beitrag","mute":"Stummschalten","unmute":"Stummschaltung aufheben","last_post":"Letzter Beitrag","last_reply_lowercase":"letzte Antwort","replies_lowercase":{"one":"Antwort","other":"Antworten"},"signup_cta":{"sign_up":"Registrieren","hide_session":"Erinnere mich morgen","hide_forever":"Nein danke","hidden_for_session":"In Ordnung, ich frag dich morgen wieder. Du kannst dir auch jederzeit unter „Anmelden“ ein Benutzerkonto erstellen.","intro":"Hallo! :heart_eyes: Es sieht so aus, als würde dir die Diskussion gefallen. Du hast aber noch kein Benutzerkonto.","value_prop":"Wenn du ein Benutzerkonto anlegst, merken wir uns, was du gelesen hast, damit du immer dort fortsetzen kannst, wo du aufgehört hast. Du kannst auch Benachrichtigungen – hier oder per E-Mail – erhalten, wenn neue Beiträge verfasst werden. Beiträge, die dir gefallen, kannst du mit einem Like versehen und diese Freude mit allen teilen. :heartbeat:"},"summary":{"enabled_description":"Du siehst gerade eine Zusammenfassung des Themas: die interessantesten Beiträge, die von der Community bestimmt wurden.","description":"Es gibt \u003cb\u003e{{replyCount}}\u003c/b\u003e Antworten.","description_time":"Es gibt \u003cb\u003e{{replyCount}}\u003c/b\u003e Antworten mit einer geschätzten Lesezeit von \u003cb\u003e{{readingTime}} Minuten\u003c/b\u003e.","enable":"Zusammenfassung vom Thema erstellen","disable":"Alle Beiträge anzeigen"},"deleted_filter":{"enabled_description":"Dieses Thema enthält gelöschte Beiträge, die derzeit versteckt sind.","disabled_description":"Gelöschte Beiträge werden in diesem Thema angezeigt.","enable":"Gelöschte Beiträge ausblenden","disable":"Gelöschte Beiträge anzeigen"},"private_message_info":{"title":"Nachricht","invite":"Andere einladen…","remove_allowed_user":"Willst du {{name}} wirklich aus dieser Unterhaltung entfernen?","remove_allowed_group":"Willst du {{name}} wirklich aus dieser Unterhaltung entfernen?"},"email":"E-Mail-Adresse","username":"Benutzername","last_seen":"Zuletzt gesehen","created":"Erstellt","created_lowercase":"erstellt","trust_level":"Vertrauensstufe","search_hint":"Benutzername, E-Mail- oder IP-Adresse","create_account":{"title":"Neues Benutzerkonto erstellen","failed":"Etwas ist fehlgeschlagen. Vielleicht ist diese E-Mail-Adresse bereits registriert. Versuche den 'Passwort vergessen'-Link."},"forgot_password":{"title":"Passwort zurücksetzen","action":"Ich habe mein Passwort vergessen","invite":"Gib deinen Benutzernamen oder deine E-Mail-Adresse ein. Wir senden dir eine E-Mail zum Zurücksetzen des Passworts.","reset":"Passwort zurücksetzen","complete_username":"Wenn ein Benutzerkonto dem Benutzernamen \u003cb\u003e%{username}\u003c/b\u003e entspricht, solltest du in Kürze eine E-Mail mit Anweisungen zum Zurücksetzen deines Passwortes erhalten.","complete_email":"Wenn ein Benutzerkonto der E-Mail \u003cb\u003e%{email}\u003c/b\u003e entspricht, solltest du in Kürze eine E-Mail mit Anweisungen zum Zurücksetzen deines Passwortes erhalten.","complete_username_found":"Wir haben ein zum Benutzername \u003cb\u003e%{username}\u003c/b\u003e gehörendes Konto gefunden. Du solltest in Kürze eine E-Mail mit Anweisungen zum Zurücksetzen deines Passwortes erhalten.","complete_email_found":"Wir haben ein zu \u003cb\u003e%{email}\u003c/b\u003e gehörendes Benutzerkonto gefunden. Du solltest in Kürze eine E-Mail mit Anweisungen zum Zurücksetzen deines Passwortes erhalten.","complete_username_not_found":"Es gibt kein Konto mit dem Benutzernamen \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Es gibt kein Benutzerkonto für \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Anmelden","username":"Benutzername","password":"Passwort","email_placeholder":"E-Mail oder Benutzername","caps_lock_warning":"Feststelltaste ist aktiviert","error":"Unbekannter Fehler","rate_limit":"Warte bitte ein wenig, bevor du erneut versuchst dich anzumelden.","blank_username_or_password":"Bitte gib deine E-Mail-Adresse oder deinen Benutzernamen und dein Passwort ein.","reset_password":"Passwort zurücksetzen","logging_in":"Anmeldung läuft…","or":"Oder","authenticating":"Authentifiziere…","awaiting_confirmation":"Dein Konto ist noch nicht aktiviert. Verwende den 'Passwort vergessen'-Link, um eine weitere E-Mail mit Anweisungen zur Aktivierung zu erhalten.","awaiting_approval":"Dein Konto wurde noch nicht von einem Mitarbeiter genehmigt. Du bekommst eine E-Mail, sobald das geschehen ist.","requires_invite":"Entschuldige, der Zugriff auf dieses Forum ist nur mit einer Einladung möglich.","not_activated":"Du kannst dich noch nicht anmelden. Wir haben dir schon eine E-Mail zur Aktivierung an \u003cb\u003e{{sentTo}}\u003c/b\u003e geschickt. Bitte folge den Anweisungen in dieser E-Mail, um dein Benutzerkonto zu aktivieren.","not_allowed_from_ip_address":"Von dieser IP-Adresse darfst du dich nicht anmelden.","admin_not_allowed_from_ip_address":"Von dieser IP-Adresse darfst du dich nicht als Administrator anmelden.","resend_activation_email":"Klicke hier, um eine neue Aktivierungsmail zu schicken.","sent_activation_email_again":"Wir haben dir eine weitere E-Mail zur Aktivierung an \u003cb\u003e{{currentEmail}}\u003c/b\u003e geschickt. Es könnte ein paar Minuten dauern, bis diese ankommt; sieh auch im Spam-Ordner nach.","to_continue":"Melde dich bitte an","preferences":"Du musst angemeldet sein, um deine Benutzereinstellungen bearbeiten zu können.","forgot":"Ich kann mich nicht an meine Zugangsdaten erinnern","google":{"title":"mit Google","message":"Authentifiziere mit Google (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"google_oauth2":{"title":"mit Google","message":"Authentifiziere mit Google (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"twitter":{"title":"mit Twitter","message":"Authentifiziere mit Twitter (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"instagram":{"title":"mit Instagram","message":"Authentifiziere mit Instagram (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"facebook":{"title":"mit Facebook","message":"Authentifiziere mit Facebook (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"yahoo":{"title":"mit Yahoo","message":"Authentifiziere mit Yahoo (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"github":{"title":"mit GitHub","message":"Authentifiziere mit GitHub (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"}},"emoji_set":{"apple_international":"Apple","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Windows 10"},"category_page_style":{"categories_only":"nur Kategorien","categories_and_latest_topics":"Kategorien und aktuelle Themen"},"shortcut_modifier_key":{"shift":"Umschalt","ctrl":"Strg","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"mehr…","options":"Optionen","whisper":"flüstern","unlist":"unsichtbar","add_warning":"Dies ist eine offizielle Warnung.","toggle_whisper":"Flüstermodus umschalten","toggle_unlisted":"Unsichtbar umschalten","posting_not_on_topic":"Auf welches Thema möchtest du antworten?","saving_draft_tip":"wird gespeichert…","saved_draft_tip":"gespeichert","saved_local_draft_tip":"lokal gespeichert","similar_topics":"Dein Thema hat Ähnlichkeit mit…","drafts_offline":"Entwürfe offline","duplicate_link":"Es sieht so aus als wäre dein Link zu \u003cb\u003e{{domain}}\u003c/b\u003e in dem Thema bereits von \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003eeiner Antwort vor {{ago}}\u003c/a\u003e geteilt worden – möchtest du ihn wirklich erneut teilen? ","error":{"title_missing":"Titel ist erforderlich","title_too_short":"Titel muss mindestens {{min}} Zeichen lang sein","title_too_long":"Titel darf maximal {{max}} Zeichen lang sein","post_missing":"Beitrag darf nicht leer sein","post_length":"Beitrag muss mindestens {{min}} Zeichen lang sein","try_like":"Hast du schon die \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e Schaltfläche ausprobiert?","category_missing":"Du musst eine Kategorie auswählen"},"save_edit":"Änderungen speichern","reply_original":"Auf das ursprünglichen Thema antworten","reply_here":"Hier antworten","reply":"Antworten","cancel":"Abbrechen","create_topic":"Thema erstellen","create_pm":"Nachricht","title":"Oder drücke Strg+Eingabetaste","users_placeholder":"Benutzer hinzufügen","title_placeholder":"Um was geht es in dieser Diskussion? Schreib einen kurzen Satz.","edit_reason_placeholder":"Warum bearbeitest du?","show_edit_reason":"(Bearbeitungsgrund hinzufügen)","reply_placeholder":"Schreib hier. Verwende Markdown, BBCode oder HTML zur Formatierung. Füge Bilder ein oder ziehe sie herein.","view_new_post":"Sieh deinen neuen Beitrag an.","saving":"Wird gespeichert","saved":"Gespeichert!","saved_draft":"Ein Beitrag ist in Arbeit. Zum Fortsetzen hier klicken.","uploading":"Wird hochgeladen…","show_preview":"Vorschau anzeigen \u0026raquo;","hide_preview":"\u0026laquo; Vorschau ausblenden","quote_post_title":"Ganzen Beitrag zitieren","bold_label":"F","bold_title":"Fettgedruckt","bold_text":"Fettgedruckter Text","italic_label":"K","italic_title":"Betonung","italic_text":"Betonter Text","link_title":"Hyperlink","link_description":"gib hier eine Link-Beschreibung ein","link_dialog_title":"Hyperlink einfügen","link_optional_text":"Optionaler Titel","link_url_placeholder":"http://example.com","quote_title":"Zitat","quote_text":"Zitat","code_title":"Vorformatierter Text","code_text":"vorformatierten Text mit 4 Leerzeichen einrücken","paste_code_text":"Tippe oder füge den Code hier ein","upload_title":"Upload","upload_description":"gib hier eine Beschreibung des Uploads ein","olist_title":"Nummerierte Liste","ulist_title":"Liste mit Aufzählungszeichen","list_item":"Listenelement","heading_label":"Ü","heading_title":"Überschrift","heading_text":"Überschrift","hr_title":"Horizontale Linie","help":"Hilfe zur Markdown-Formatierung","toggler":"Eingabebereich aus- oder einblenden","modal_ok":"OK","modal_cancel":"Abbrechen","cant_send_pm":"Entschuldige, aber du kannst keine Nachricht an %{username} senden.","yourself_confirm":{"title":"Hast du vergessen Empfänger hinzuzufügen?","body":"Im Augenblick wird diese Nachricht nur an dich selbst gesendet!"},"admin_options_title":"Optionale Mitarbeiter-Einstellungen für dieses Thema","auto_close":{"label":"Zeitpunkt der automatischen Schließung:","error":"Bitte gib einen gültigen Wert ein.","based_on_last_post":"Das Thema erst schließen, wenn der letzte Beitrag mindestens so alt ist.","all":{"examples":"Gib die Anzahl der Stunden (24), eine Uhrzeit (17:30) oder einen Zeitstempel (2013-11-22 14:00) ein."},"limited":{"units":"(# Stunden)","examples":"Gib die Anzahl der Stunden ein (24)."}}},"notifications":{"title":"Benachrichtigung über @Name-Erwähnungen, Antworten auf deine Beiträge und Themen, Nachrichten, usw.","none":"Die Benachrichtigungen können derzeit nicht geladen werden.","empty":"Keine Benachrichtigungen gefunden.","more":"ältere Benachrichtigungen anzeigen","total_flagged":"Anzahl der gemeldeten Beiträge","mentioned":"\u003ci title='erwähnt' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='Gruppe erwähnt' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='zitiert' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='geantwortet' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='geantwortet' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='bearbeitet' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='gefällt' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='gefällt' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='gefällt' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} und 1 anderer\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='gefällt' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} und {{count}} andere\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='Nachricht' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='Nachricht' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='zu Thema eingeladen' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='Einladung angenommen' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e hat deine Einladung angenommen\u003c/p\u003e","moved_post":"\u003ci title='Beitrag verschoben' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e hat {{description}} verschoben\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='Abzeichen verliehen' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eAbzeichen '{{description}}' erhalten\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNeues Thema\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e Eine Nachricht in deinem {{group_name}} Postfach\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} Nachrichten in deinem {{group_name}} Postfach\u003c/p\u003e"},"alt":{"mentioned":"Erwähnt von","quoted":"Zitiert von","replied":"Geantwortet","posted":"Beitrag von","edited":"Beitrag bearbeitet von","liked":"Gefällt dein Beitrag","private_message":"Nachricht von","invited_to_private_message":"Zu Unterhaltung eingeladen von","invited_to_topic":"Zu Thema eingeladen von","invitee_accepted":"Einladung angenommen von","moved_post":"Dein Beitrag wurde verschoben von","linked":"Link zu deinem Beitrag","granted_badge":"Abzeichen erhalten","group_message_summary":"Nachrichten im Gruppenpostfach"},"popup":{"mentioned":"{{username}} hat dich in \"{{topic}}\" - {{site_title}} erwähnt","group_mentioned":"{{username}} hat dich in \"{{topic}}\" - {{site_title}} erwähnt","quoted":"{{username}} hat dich in \"{{topic}}\" - {{site_title}} zitiert","replied":"{{username}} hat dir in \"{{topic}}\" - {{site_title}} geantwortet","posted":"{{username}} hat in \"{{topic}}\" - {{site_title}} einen Beitrag verfasst","private_message":"{{username}} hat dir in \"{{topic}}\" - {{site_title}} eine Nachricht geschickt","linked":"{{username}} hat in \"{{topic}}\" - {{site_title}} einen Beitrag von dir verlinkt"}},"upload_selector":{"title":"Ein Bild hinzufügen","title_with_attachments":"Ein Bild oder eine Datei hinzufügen","from_my_computer":"Von meinem Gerät","from_the_web":"Aus dem Web","remote_tip":"Link zu Bild","remote_tip_with_attachments":"Link zu Bild oder Datei {{authorized_extensions}}","local_tip":"wähle auf deinem Gerät gespeicherte Bilder aus","local_tip_with_attachments":"Wähle Bilder oder Dateien von deinem Gerät aus {{authorized_extensions}}","hint":"(du kannst Dateien auch in den Editor ziehen, um diese hochzuladen)","hint_for_supported_browsers":"du kannst Bilder auch in den Editor ziehen oder diese aus der Zwischenablage einfügen","uploading":"Wird hochgeladen","select_file":"Datei auswählen","image_link":"Der Link deines Bildes verweist auf"},"search":{"sort_by":"Sortieren nach","relevance":"Relevanz","latest_post":"letzter Beitrag","most_viewed":"Anzahl der Aufrufe","most_liked":"Anzahl der Likes","select_all":"Alle auswählen","clear_all":"Auswahl aufheben","too_short":"Der Suchbegriff ist zu kurz.","result_count":{"one":"1 Ergebnis für \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} Ergebnisse für \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"suche nach Themen, Beiträgen, Benutzern oder Kategorien","no_results":"Keine Ergebnisse gefunden.","no_more_results":"Es wurde keine weiteren Ergebnisse gefunden.","search_help":"Hilfe zur Suche","searching":"Suche …","post_format":"#{{post_number}} von {{username}}","context":{"user":"Beiträge von @{{username}} durchsuchen","category":"Kategorie #{{category}} durchsuchen","topic":"Dieses Thema durchsuchen","private_messages":"Nachrichten durchsuchen"}},"hamburger_menu":"zu einer anderen Themenliste oder Kategorie wechseln","new_item":"neu","go_back":"zurückgehen","not_logged_in_user":"Benutzerseite mit einer Zusammenfassung der Benutzeraktivitäten und Einstellungen","current_user":"zu deiner Benutzerseite gehen","topics":{"bulk":{"unlist_topics":"Themen unsichtbar machen","reset_read":"Gelesene zurücksetzen","delete":"Themen löschen","dismiss":"Ignorieren","dismiss_read":"Blende alle ungelesenen Beiträge aus","dismiss_button":"Ignorieren...","dismiss_tooltip":"Nur die neuen Beiträge ignorieren oder Themen nicht mehr verfolgen","also_dismiss_topics":"Diese Themen nicht mehr verfolgen, sodass mir diese nicht mehr als ungelesen angezeigt werden","dismiss_new":"Neue Themen ignorieren","toggle":"zu Massenoperationen auf Themen umschalten","actions":"Massenoperationen","change_category":"Kategorie ändern","close_topics":"Themen schließen","archive_topics":"Themen archivieren","notification_level":"Benachrichtigungsstufe ändern","choose_new_category":"Neue Kategorie für die gewählten Themen:","selected":{"one":"Du hast \u003cb\u003eein\u003c/b\u003e Thema ausgewählt.","other":"Du hast \u003cb\u003e{{count}}\u003c/b\u003e Themen ausgewählt."},"change_tags":"Schlagwörter ändern","choose_new_tags":"Neue Schlagwörter für die gewählten Themen wählen:","changed_tags":"Die Schlagwörter der gewählten Themen wurden geändert."},"none":{"unread":"Du hast alle Themen gelesen.","new":"Es gibt für dich keine neuen Themen.","read":"Du hast noch keine Themen gelesen.","posted":"Du hast noch keine Beiträge verfasst.","latest":"Es gibt keine aktuellen Themen. Das ist schade.","hot":"Es gibt keine beliebten Themen.","bookmarks":"Du hast noch keine Themen, in denen du ein Lesezeichen gesetzt hast.","category":"Es gibt keine Themen in {{category}}.","top":"Es gibt keine Top-Themen.","search":"Es wurden keine Suchergebnisse gefunden.","educate":{"new":"\u003cp\u003eHier werden neue Themen angezeigt.\u003c/p\u003e\u003cp\u003eStandardmäßig werden jene Themen als neu angesehen und mit dem \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eneu\u003c/span\u003e Indikator versehen, die in den letzten 2 Tagen erstellt wurden.\u003c/p\u003e\u003cp\u003eDu kannst das in deinen \u003ca href=\"%{userPrefsUrl}\"\u003eEinstellungen\u003c/a\u003e ändern.\u003c/p\u003e","unread":"\u003cp\u003eHier werden deine ungelesenen Themen angezeigt.\u003c/p\u003e\u003cp\u003eDie Anzahl der ungelesenen Beiträge wird standardmäßig als \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e neben den Themen angezeigt, wenn du:\u003c/p\u003e\u003cul\u003e\u003cli\u003edas Thema erstellt hast\u003c/li\u003e\u003cli\u003eauf das Thema geantwortet hast\u003c/li\u003e\u003cli\u003edas Thema länger als 4 Minuten gelesen hast\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eAußerdem werden jene Themen berücksichtigt, die du in den Benachrichtigungseinstellungen am Ende eines jeden Themas ausdrücklich auf Beobachten oder Verfolgen gesetzt hast.\u003c/p\u003e\u003cp\u003eDu kannst das in deinen \u003ca href=\"%{userPrefsUrl}\"\u003eEinstellungen\u003c/a\u003e ändern.\u003c/p\u003e"}},"bottom":{"latest":"Das waren die aktuellen Themen.","hot":"Das waren alle beliebten Themen.","posted":"Das waren alle Themen.","read":"Das waren alle gelesenen Themen.","new":"Das waren alle neuen Themen.","unread":"Das waren alle ungelesen Themen.","category":"Das waren alle Themen in der Kategorie „{{category}}“.","top":"Das waren alle angesagten Themen.","bookmarks":"Das waren alle Themen mit Lesezeichen.","search":"Es gibt keine weiteren Suchergebnisse."}},"topic":{"unsubscribe":{"stop_notifications":"Du wirst in Zukunft weniger Benachrichtigungen für \u003cstrong\u003e{{title}}\u003c/strong\u003e erhalten","change_notification_state":"Dein aktueller Benachrichtigungsstatus ist"},"filter_to":{"one":"1 Beitrag im Thema","other":"{{count}} Beiträge im Thema"},"create":"Neues Thema","create_long":"Ein neues Thema erstellen","private_message":"Eine Unterhaltung beginnen","archive_message":{"help":"Nachricht ins Archiv verschieben","title":"Archivieren"},"move_to_inbox":{"title":"In Posteingang verschieben","help":"Nachricht in den Posteingang zurück verschieben"},"list":"Themen","new":"neues Thema","unread":"ungelesen","new_topics":{"one":"1 neues Thema","other":"{{count}} neue Themen"},"unread_topics":{"one":"1 ungelesenes Thema","other":"{{count}} ungelesene Themen"},"title":"Thema","invalid_access":{"title":"Thema ist nicht öffentlich","description":"Entschuldige, du hast keinen Zugriff auf dieses Thema!","login_required":"Du musst dich anmelden, damit du dieses Thema sehen kannst."},"server_error":{"title":"Thema konnte nicht geladen werden","description":"Entschuldige, wir konnten das Thema, wahrscheinlich wegen eines Verbindungsfehlers, nicht laden. Bitte versuche es erneut. Wenn das Problem bestehen bleibt, gib uns Bescheid."},"not_found":{"title":"Thema nicht gefunden","description":"Entschuldige, wir konnten dieses Thema nicht finden. Wurde es vielleicht von einem Moderator entfernt?"},"total_unread_posts":{"one":"du hast einen ungelesenen Beitrag in diesem Thema","other":"du hast {{count}} ungelesene Beiträge in diesem Thema"},"unread_posts":{"one":"Du hast einen ungelesenen, alten Beitrag zu diesem Thema","other":"Du hast {{count}} ungelesene, alte Beiträge zu diesem Thema"},"new_posts":{"one":"Es gibt einen neuen Beitrag zu diesem Thema seit du es das letzte Mal gelesen hast","other":"Es gibt {{count}} neue Beiträge zu diesem Thema seit du es das letzte Mal gelesen hast"},"likes":{"one":"Es gibt ein Like in diesem Thema","other":"Es gibt {{count}} Likes in diesem Thema"},"back_to_list":"Zurück zur Themenliste","options":"Themen-Optionen","show_links":"zeige Links innerhalb dieses Themas","toggle_information":"Details zum Thema ein- oder ausblenden","read_more_in_category":"Möchtest du mehr lesen? Entdecke andere Themen in {{catLink}} oder {{latestLink}}.","read_more":"Möchtest du mehr lesen? {{catLink}} oder {{latestLink}}.","browse_all_categories":"Alle Kategorien durchsehen","view_latest_topics":"aktuelle Themen anzeigen","suggest_create_topic":"Möchtest du ein neues Thema erstellen?","jump_reply_up":"zur vorherigen Antwort springen","jump_reply_down":"zur nachfolgenden Antwort springen","deleted":"Das Thema wurde gelöscht","auto_close_notice":"Dieses Thema wird %{timeLeft} automatisch geschlossen.","auto_close_notice_based_on_last_post":"Dieses Thema wird %{duration} nach der letzten Antwort geschlossen.","auto_close_title":"Automatisches Schließen","auto_close_save":"Speichern","auto_close_remove":"Dieses Thema nicht automatisch schließen","timeline":{"back":"Zurück","back_description":"Gehe zurück zum letzten ungelesenen Beitrag","replies_short":"%{current} / %{total}"},"progress":{"title":"Themen-Fortschritt","go_top":"Anfang","go_bottom":"Ende","go":"Los","jump_bottom":"springe zum letzten Beitrag","jump_prompt":"Springe zu Beitrag","jump_prompt_long":"Zu welchem Beitrag möchtest du springen?","jump_bottom_with_number":"springe zu Beitrag %{post_number}","total":"Beiträge insgesamt","current":"aktueller Beitrag"},"notifications":{"title":"Ändere wie häufig du zu diesem Thema benachrichtigt wirst","reasons":{"mailing_list_mode":"Du hast den Mailinglisten-Modus aktiviert, daher wirst du über Antworten zu diesem Thema per E-Mail benachrichtigt","3_10":"Du wirst Benachrichtigungen erhalten, weil du ein Schlagwort an diesem Thema beobachtest.","3_6":"Du wirst Benachrichtigungen erhalten, weil du diese Kategorie beobachtest.","3_5":"Du wirst Benachrichtigungen erhalten, weil dieses Thema automatisch von dir beobachtet wird.","3_2":"Du wirst Benachrichtigungen erhalten, weil du dieses Thema beobachtest.","3_1":"Du wirst Benachrichtigungen erhalten, weil du dieses Thema erstellt hast.","3":"Du wirst Benachrichtigungen erhalten, weil du dieses Thema beobachtest.","2_8":"Du wirst Benachrichtigungen erhalten, da du diese Kategorie verfolgst.","2_4":"Du wirst Benachrichtigungen erhalten, weil du eine Antwort zu diesem Thema verfasst hast.","2_2":"Du wirst Benachrichtigungen erhalten, weil du dieses Thema verfolgst.","2":"Du wirst Benachrichtigungen erhalten, weil du \u003ca href=\"/users/{{username}}/preferences\"\u003edieses Thema gelesen hast\u003c/a\u003e.","1_2":"Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet.","1":"Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet.","0_7":"Du ignorierst alle Benachrichtigungen dieser Kategorie.","0_2":"Du ignorierst alle Benachrichtigungen dieses Themas.","0":"Du ignorierst alle Benachrichtigungen dieses Themas."},"watching_pm":{"title":"Beobachten","description":"Du wirst über jeden neuen Beitrag in dieser Unterhaltung benachrichtigt und die Anzahl der neuen Beiträge wird angezeigt."},"watching":{"title":"Beobachten","description":"Du wirst über jeden neuen Beitrag in diesem Thema benachrichtigt und die Anzahl der neuen Antworten wird angezeigt."},"tracking_pm":{"title":"Verfolgen","description":"Die Anzahl der neuen Antworten wird bei dieser Unterhaltung angezeigt. Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deine Nachricht antwortet."},"tracking":{"title":"Verfolgen","description":"Die Anzahl der neuen Antworten wird bei diesem Thema angezeigt. Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet."},"regular":{"title":"Normal","description":"Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet."},"regular_pm":{"title":"Normal","description":"Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deine Nachricht antwortet."},"muted_pm":{"title":"Stummgeschaltet","description":"Du erhältst keine Benachrichtigungen im Zusammenhang mit dieser Unterhaltung."},"muted":{"title":"Stummgeschaltet","description":"Du erhältst keine Benachrichtigungen über neue Aktivitäten in diesem Thema und es wird auch nicht mehr in der Liste der letzten Beiträge erscheinen."}},"actions":{"recover":"Löschen rückgängig machen","delete":"Thema löschen","open":"Thema öffnen","close":"Thema schließen","multi_select":"Beiträge auswählen...","auto_close":"Automatisch schließen…","pin":"Thema anheften...","unpin":"Thema loslösen...","unarchive":"Thema aus Archiv holen","archive":"Thema archivieren","invisible":"Unsichtbar machen","visible":"Sichtbar machen","reset_read":"„Gelesen“ zurücksetzen","make_public":"Umwandeln in öffentliches Thema","make_private":"Umwandeln in Nachricht"},"feature":{"pin":"Thema anheften","unpin":"Thema loslösen","pin_globally":"Thema global anheften","make_banner":"Ankündigungsbanner","remove_banner":"Ankündigungsbanner entfernen"},"reply":{"title":"Antworten","help":"beginne damit eine Antwort auf dieses Thema zu verfassen"},"clear_pin":{"title":"Loslösen","help":"Dieses Thema von der Themenliste loslösen, sodass es nicht mehr am Anfang der Liste steht."},"share":{"title":"Teilen","help":"teile einen Link zu diesem Thema"},"flag_topic":{"title":"Melden","help":"Dieses Thema den Moderatoren melden oder eine Nachricht senden.","success_message":"Du hast dieses Thema erfolgreich gemeldet."},"feature_topic":{"title":"Thema hervorheben","pin":"Dieses Thema am Anfang der {{categoryLink}} Kategorie anzeigen bis","confirm_pin":"Es gibt bereits {{count}} angeheftete Themen. Zu viele angeheftete Themen könnten neue und unbekannte Benutzer leicht überwältigen. Willst du wirklich noch ein weiteres Thema in dieser Kategorie anheften?","unpin":"Dieses Thema vom Anfang der {{categoryLink}} Kategorie loslösen.","unpin_until":"Dieses Thema vom Anfang der {{categoryLink}} Kategorie loslösen oder bis \u003cstrong\u003e%{until}\u003c/strong\u003e warten.","pin_note":"Benutzer können das Thema für sich selbst loslösen.","pin_validation":"Ein Datum wird benötigt um diesen Beitrag zu fixieren.","not_pinned":"Es sind in {{categoryLink}} keine Themen angeheftet.","already_pinned":{"one":"Momentan in {{categoryLink}} angeheftete Themen: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Momentan in {{categoryLink}} angeheftete Themen: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Dieses Thema am Anfang aller Themenlisten anzeigen bis","confirm_pin_globally":"Es gibt bereits {{count}} global angeheftete Themen. Zu viele angeheftete Themen könnten neue und unbekannte Benutzer leicht überwältigen. Willst du wirklich noch ein weiteres Thema global anheften?","unpin_globally":"Dieses Thema vom Anfang aller Themenlisten loslösen.","unpin_globally_until":"Dieses Thema vom Anfang aller Themenlisten loslösen oder bis \u003cstrong\u003e%{until}\u003c/strong\u003e warten.","global_pin_note":"Benutzer können das Thema für sich selbst loslösen.","not_pinned_globally":"Es sind keine Themen global angeheftet.","already_pinned_globally":{"one":"Momentan global angeheftete Themen: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Momentan global angeheftete Themen: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Macht das Thema zu einem Ankündigungsbanner, welcher am Anfang aller Seiten angezeigt wird.","remove_banner":"Entfernt das Ankündigungsbanner vom Anfang aller Seiten.","banner_note":"Benutzer können das Ankündigungsbanner schließen und so für sich selbst dauerhaft ausblenden. Es kann zu jeder Zeit höchstens ein Thema ein Banner sein.","no_banner_exists":"Es gibt kein Ankündigungsbanner.","banner_exists":"Es \u003cstrong class='badge badge-notification unread'\u003egibt bereits\u003c/strong\u003e ein anderes Ankündigungsbanner."},"inviting":"Einladungen werden gesendet…","automatically_add_to_groups":"Diese Einladung beinhaltet auch Zugang zu den folgenden Gruppen:","invite_private":{"title":"Zu einer Unterhaltung einladen","email_or_username":"E-Mail-Adresse oder Benutzername des Eingeladenen","email_or_username_placeholder":"E-Mail-Adresse oder Benutzername","action":"Einladen","success":"Wir haben den Benutzer gebeten, sich an dieser Unterhaltung zu beteiligen.","success_group":"Wir haben die Gruppe eingeladen, an dieser Nachricht mitzuwirken.","error":"Entschuldige, es gab einen Fehler beim Einladen des Benutzers.","group_name":"Gruppenname"},"controls":"Weitere Aktionen","invite_reply":{"title":"Einladen","username_placeholder":"Benutzername","action":"Einladung versenden","help":"per E-Mail oder Benachrichtigung weitere Personen zu diesem Thema einladen","to_forum":"Wir senden deinem Freund eine kurze E-Mail, die es ihm ermöglicht, dem Forum sofort beizutreten. Es ist keine Anmeldung erforderlich.","sso_enabled":"Gib den Benutzername der Person ein, die du zu diesem Thema einladen willst.","to_topic_blank":"Gib den Benutzername oder die E-Mail-Adresse der Person ein, die du zu diesem Thema einladen willst.","to_topic_email":"Du hast eine E-Mail-Adresse eingegeben. Wir werden eine Einladung versenden, die ein direktes Antworten auf dieses Thema ermöglicht.","to_topic_username":"Du hast einen Benutzernamen eingegeben. Wir werden eine Benachrichtigung versenden und mit einem Link zur Teilnahme an diesem Thema einladen.","to_username":"Gib den Benutzername der Person ein, die du einladen möchtest. Wir werden eine Benachrichtigung versenden und mit einem Link zur Teilnahme an diesem Thema einladen.","email_placeholder":"name@example.com","success_email":"Wir haben an \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e eine Einladung verschickt und werden dich benachrichtigen, sobald die Einladung angenommen wurde. In deinem Benutzerprofil kannst du alle deine Einladungen überwachen.","success_username":"Wir haben den Benutzer gebeten, sich an diesem Thema zu beteiligen.","error":"Es tut uns leid, wir konnten diese Person nicht einladen. Wurde diese Person vielleicht schon eingeladen? (Einladungen sind in ihrer Zahl beschränkt)"},"login_reply":"Anmelden, um zu antworten","filters":{"n_posts":{"one":"1 Beitrag","other":"{{count}} Beiträge"},"cancel":"Filter entfernen"},"split_topic":{"title":"In neues Thema verschieben","action":"in ein neues Thema verschieben","topic_name":"Bezeichnung des neuen Themas","error":"Beim Verschieben der Beiträge ins neue Thema ist ein Fehler aufgetreten.","instructions":{"one":"Du bist dabei, ein neues Thema zu erstellen und den ausgewählten Beitrag dorthin zu verschieben.","other":"Du bist dabei, ein neues Thema zu erstellen und die \u003cb\u003e{{count}}\u003c/b\u003e ausgewählten Beiträge dorthin zu verschieben."}},"merge_topic":{"title":"In ein vorhandenes Thema verschieben","action":"in ein vorhandenes Thema verschieben","error":"Beim Verschieben der Beiträge in das Thema ist ein Fehler aufgetreten.","instructions":{"one":"Bitte wähle das Thema, in welches du den Beitrag verschieben möchtest.","other":"Bitte wähle das Thema, in welches du die \u003cb\u003e{{count}}\u003c/b\u003e Beiträge verschieben möchtest."}},"merge_posts":{"title":"Ausgewählte Beiträge zusammenführen","action":"ausgewählte Beiträge zusammenführen","error":"Es gab einen Fehler beim Zusammenführen der ausgewählten Beiträge."},"change_owner":{"title":"Eigentümer der Beiträge ändern","action":"Eigentümer ändern","error":"Beim Ändern des Eigentümers der Beiträge ist ein Fehler aufgetreten.","label":"Neuer Eigentümer der Beiträge","placeholder":"Benutzername des neuen Eigentümers","instructions":{"one":"Bitte wähle den neuen Eigentümer für den Beitrag von \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Bitte wähle den neuen Eigentümer für {{count}} Beiträge von \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Bitte beachte, dass alle Benachrichtigungen für diesen Beitrag nicht rückwirkend auf den neuen Benutzer übertragen werden.\u003cbr\u003eWarnung: Aktuell werden keine Daten, die mit dem Beitrag zusammenhängen an den neuen Benutzer übertragen. Mit Bedacht verwenden."},"change_timestamp":{"title":"Erstelldatum ändern","action":"Erstelldatum ändern","invalid_timestamp":"Das Erstelldatum kann nicht in der Zukunft liegen.","error":"Beim Ändern des Erstelldatums des Themas ist ein Fehler aufgetreten.","instructions":"Wähle bitte ein neues Erstelldatum für das Thema aus. Alle Beitrage im Thema werden unter Beibehaltung der Zeitdifferenz ebenfalls angepasst."},"multi_select":{"select":"auswählen","selected":"ausgewählt ({{count}})","select_replies":"samt Antworten auswählen","delete":"ausgewählte löschen","cancel":"Auswahlvorgang abbrechen","select_all":"alle auswählen","deselect_all":"keine auswählen","description":{"one":"Du hast \u003cb\u003e1\u003c/b\u003e Beitrag ausgewählt.","other":"Du hast \u003cb\u003e{{count}}\u003c/b\u003e Beiträge ausgewählt."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"Antwort zitieren","edit":"Du bearbeitest {{link}} {{replyAvatar}} {{username}}","edit_reason":"Grund: ","post_number":"Beitrag {{number}}","last_edited_on":"Beitrag zuletzt bearbeitet am","reply_as_new_topic":"Mit verknüpftem Thema antworten","continue_discussion":"Fortsetzung der Diskussion von {{postLink}}:","follow_quote":"springe zum zitierten Beitrag","show_full":"Zeige ganzen Beitrag","show_hidden":"Versteckte Inhalte anzeigen.","deleted_by_author":{"one":"(Beitrag wurde vom Autor zurückgezogen und wird automatisch in %{count} Stunde gelöscht, sofern dieser Beitrag nicht gemeldet wird)","other":"(Beitrag wurde vom Autor zurückgezogen und wird automatisch in %{count} Stunden gelöscht, sofern dieser Beitrag nicht gemeldet wird)"},"expand_collapse":"erweitern/minimieren","gap":{"one":"einen versteckten Beitrag anzeigen","other":"{{count}} versteckte Beiträge anzeigen"},"unread":"Beitrag ist ungelesen","has_replies":{"one":"{{count}} Antwort","other":"{{count}} Antworten"},"has_likes":{"one":"{{count}} Like","other":"{{count}} Likes"},"has_likes_title":{"one":"dieser Beitrag gefällt 1 Person","other":"dieser Beitrag gefällt {{count}} Personen"},"has_likes_title_only_you":"dir gefällt dieser Beitrag","has_likes_title_you":{"one":"dir und einer weiteren Person gefällt dieser Beitrag","other":"dir und {{count}} weiteren Personen gefällt dieser Beitrag"},"errors":{"create":"Entschuldige, es gab einen Fehler beim Anlegen des Beitrags. Bitte versuche es noch einmal.","edit":"Entschuldige, es gab einen Fehler beim Bearbeiten des Beitrags. Bitte versuche es noch einmal.","upload":"Entschuldige, es gab einen Fehler beim Hochladen der Datei. Bitte versuche es noch einmal.","file_too_large":"Entschuldige, diese Datei ist zu groß (maximal erlaubt sind {{max_size_kb}} KB). Wie wär’s, wenn du deine große Datei bei einem Filehosting-Dienst hochlädst und dann den Link teilst?","too_many_uploads":"Entschuldige, du darfst immer nur eine Datei hochladen.","too_many_dragged_and_dropped_files":"Entschuldige, du kannst nur 10 Dateien auf einmal hochladen.","upload_not_authorized":"Entschuldige, die Datei, die du hochladen wolltest, ist nicht erlaubt (erlaubte Endungen: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Entschuldige, neue Benutzer dürfen keine Bilder hochladen.","attachment_upload_not_allowed_for_new_user":"Entschuldige, neue Benutzer dürfen keine Dateien hochladen.","attachment_download_requires_login":"Entschuldige, du musst angemeldet sein, um Dateien herunterladen zu können."},"abandon":{"confirm":"Möchtest du deinen Beitrag wirklich verwerfen?","no_value":"Nein, beibehalten","yes_value":"Ja, verwerfen"},"via_email":"dieser Beitrag ist per E-Mail eingetroffen","via_auto_generated_email":"dieser Beitrag ist als automatisch generierte E-Mail eingegangen","whisper":"Dieser Beitrag ist Privat für Moderatoren.","wiki":{"about":"dieser Beitrag ist ein Wiki"},"archetypes":{"save":"Speicheroptionen"},"few_likes_left":"Danke fürs Teilen der Liebe! Du hast für heute nur noch wenige „Gefällt mir“-Angaben übrig.","controls":{"reply":"verfasse eine Antwort auf diesen Beitrag","like":"dieser Beitrag gefällt mir","has_liked":"dir gefällt dieser Beitrag","undo_like":"gefällt mir nicht mehr","edit":"diesen Beitrag bearbeiten","edit_anonymous":"Entschuldige, du musst angemeldet sein, um diesen Beitrag zu bearbeiten.","flag":"Diesen Beitrag den Moderatoren melden oder eine Nachricht senden.","delete":"diesen Beitrag löschen","undelete":"diesen Beitrag wiederherstellen","share":"Link zu diesem Beitrag teilen","more":"Mehr","delete_replies":{"confirm":{"one":"Willst du auch die direkte Antwort auf diesen Beitrag löschen?","other":"Willst du auch die {{count}} direkten Antworten auf diesen Beitrag löschen?"},"yes_value":"Ja, auch die Antworten löschen","no_value":"Nein, nur diesen Beitrag"},"admin":"Administrative Aktionen","wiki":"Wiki erstellen","unwiki":"Wiki entfernen","convert_to_moderator":"Mitarbeiter-Einfärbung hinzufügen","revert_to_regular":"Mitarbeiter-Einfärbung entfernen","rebake":"HTML erneuern","unhide":"Einblenden","change_owner":"Eigentümer ändern"},"actions":{"flag":"Melden","defer_flags":{"one":"Meldung ignorieren","other":"Meldungen ignorieren"},"undo":{"off_topic":"Meldung widerrufen","spam":"Meldung widerrufen","inappropriate":"Meldung widerrufen","bookmark":"Lesezeichen entfernen","like":"Gefällt mir nicht mehr","vote":"Stimme widerrufen"},"people":{"off_topic":"meldete/n dies als „am Thema vorbei“","spam":"Melde es als Spam","inappropriate":"meldete/n dies als unangemessen","notify_moderators":"informierte/n die Moderatoren","notify_user":"hat eine Nachricht gesendet","bookmark":"hat/haben ein Lesezeichen gesetzt","like":"gefällt dies","vote":"hat/haben dafür gestimmt"},"by_you":{"off_topic":"Du hast das als „am Thema vorbei“ gemeldet","spam":"Du hast das als Spam gemeldet","inappropriate":"Du hast das als Unangemessen gemeldet","notify_moderators":"Du hast dies den Moderatoren gemeldet","notify_user":"Du hast diesem Benutzer eine Nachricht gesendet","bookmark":"Du hast bei diesem Beitrag ein Lesezeichen gesetzt","like":"Dir gefällt dieser Beitrag","vote":"Du hast für diesen Beitrag gestimmt"},"by_you_and_others":{"off_topic":{"one":"Du und eine weitere Person haben das als „am Thema vorbei“ gemeldet","other":"Du und {{count}} weitere Personen haben das als „am Thema vorbei“ gemeldet"},"spam":{"one":"Du und eine weitere Person haben das als Spam gemeldet","other":"Du und {{count}} weitere Personen haben das als Spam gemeldet"},"inappropriate":{"one":"Du und eine weitere Person haben das als Unangemessen gemeldet","other":"Du und {{count}} weitere Personen haben das als Unangemessen gemeldet"},"notify_moderators":{"one":"Du und eine weitere Person haben dies den Moderatoren gemeldet","other":"Du und {{count}} weitere Personen haben dies den Moderatoren gemeldet"},"notify_user":{"one":"Du und eine weitere Person haben diesem Benutzer eine Nachricht gesendet","other":"Du und {{count}} weitere Personen haben diesem Benutzer eine Nachricht gesendet"},"bookmark":{"one":"Du und eine weitere Person haben bei diesem Beitrag ein Lesezeichen gesetzt","other":"Du und {{count}} weitere Personen haben bei diesem Beitrag ein Lesezeichen gesetzt"},"like":{"one":"Dir und einer weiteren Person gefällt dieser Beitrag","other":"Dir und {{count}} weiteren Personen gefällt dieser Beitrag"},"vote":{"one":"Du und eine weitere Person haben für diesen Beitrag gestimmt","other":"Du und {{count}} weitere Personen haben für diesen Beitrag gestimmt"}},"by_others":{"off_topic":{"one":"Eine Person hat das als „am Thema vorbei“ gemeldet","other":"{{count}} Personen haben das als „am Thema vorbei“ gemeldet"},"spam":{"one":"Eine Person hat das als Spam gemeldet","other":"{{count}} Personen haben das als Spam gemeldet"},"inappropriate":{"one":"Eine Person hat das als Unangemessen gemeldet","other":"{{count}} Personen haben das als Unangemessen gemeldet"},"notify_moderators":{"one":"Eine Person hat dies den Moderatoren gemeldet","other":"{{count}} Personen haben dies den Moderatoren gemeldet"},"notify_user":{"one":"Eine Person hat diesem Benutzer eine Nachricht gesendet","other":"{{count}} Personen haben diesem Benutzer eine Nachricht gesendet"},"bookmark":{"one":"Eine Person hat bei diesem Beitrag ein Lesezeichen gesetzt","other":"{{count}} Personen haben bei diesem Beitrag ein Lesezeichen gesetzt"},"like":{"one":"Einer Person gefällt dieser Beitrag","other":"{{count}} Personen gefällt dieser Beitrag"},"vote":{"one":"Eine Person hat für diesen Beitrag gestimmt","other":"{{count}} Personen haben für diesen Beitrag gestimmt"}}},"delete":{"confirm":{"one":"Möchtest du wirklich diesen Beitrag löschen?","other":"Möchtest du wirklich all diese Beiträge löschen?"}},"merge":{"confirm":{"one":"Möchtest du diese Beiträge wirklich zusammenführen?","other":"Möchtest du diese {{count}} Beiträge wirklich zusammenführen?"}},"revisions":{"controls":{"first":"Erste Überarbeitung","previous":"Vorherige Überarbeitung","next":"Nächste Überarbeitung","last":"Letzte Überarbeitung","hide":"Überarbeitung verstecken","show":"Überarbeitung anzeigen","revert":"Diese Überarbeitung wiederherstellen","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Zeige die Änderungen inline an","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Zeige die Änderungen nebeneinander an","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Zeige die Originaltexte zum Vergleich nebeneinander an","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Original"}}}},"category":{"can":"kann\u0026hellip; ","none":"(keine Kategorie)","all":"Alle Kategorien","choose":"Kategorie auswählen\u0026hellip;","edit":"bearbeiten","edit_long":"Bearbeiten","view":"Zeige Themen dieser Kategorie","general":"Allgemeines","settings":"Einstellungen","topic_template":"Themenvorlage","tags":"Schlagwörter","tags_allowed_tags":"Schlagwörter, die nur in dieser Kategorie verwendet werden können:","tags_allowed_tag_groups":"Schlagwortgruppen, die nur in dieser Kategorie verwendet werden können:","tags_placeholder":"(Optional) Liste erlaubter Schlagwörter","tag_groups_placeholder":"(Optional) Liste erlaubter Schlagwort-Gruppen","delete":"Kategorie löschen","create":"Neue Kategorie","create_long":"Eine neue Kategorie erstellen","save":"Kategorie speichern","slug":"Sprechender Name für URL","slug_placeholder":"(Optional) mit Bindestrich getrennte Wörter für URL","creation_error":"Beim Erstellen der Kategorie ist ein Fehler aufgetreten.","save_error":"Beim Speichern der Kategorie ist ein Fehler aufgetreten.","name":"Name der Kategorie","description":"Beschreibung","topic":"Themenkategorie","logo":"Logo für Kategorie","background_image":"Hintergrundbild für Kategorie","badge_colors":"Farben von Abzeichen","background_color":"Hintergrundfarbe","foreground_color":"Vordergrundfarbe","name_placeholder":"Ein oder maximal zwei Wörter","color_placeholder":"Irgendeine Web-Farbe","delete_confirm":"Möchtest du wirklich diese Kategorie löschen?","delete_error":"Beim Löschen der Kategorie ist ein Fehler aufgetreten.","list":"Kategorien auflisten","no_description":"Bitte füge eine Beschreibung für diese Kategorie hinzu.","change_in_category_topic":"Beschreibung bearbeiten","already_used":"Diese Farbe wird bereits für eine andere Kategorie verwendet","security":"Sicherheit","special_warning":"Warnung: Diese Kategorie is eine pre-seeded Kategorie und die Sicherheitseinstellungen können nicht bearbeitet werden. Wenn du wünschst nicht diese Kategorie zu benutzen dann lösche sie anstatt sie zu wiederverwenden","images":"Bilder","auto_close_label":"Themen automatisch schließen nach:","auto_close_units":"Stunden","email_in":"Benutzerdefinierte Adresse für eingehende E-Mails:","email_in_allow_strangers":"Akzeptiere E-Mails von nicht registrierten, anonymen Benutzern","email_in_disabled":"Das Erstellen von neuen Themen per E-Mail ist in den Website-Einstellungen deaktiviert. Um das Erstellen von neuen Themen per E-Mail zu erlauben,","email_in_disabled_click":"aktiviere die Einstellung „email in“.","suppress_from_homepage":"Löse diese Kategorie von der Website.","allow_badges_label":"Erlaube das Verleihen von Abzeichen in dieser Kategorie","edit_permissions":"Berechtigungen bearbeiten","add_permission":"Berechtigung hinzufügen","this_year":"dieses Jahr","position":"Position","default_position":"Standardposition","position_disabled":"Kategorien werden in der Reihenfolge der Aktivität angezeigt. Um die Reihenfolge von Kategorien in Listen zu steuern,","position_disabled_click":"aktiviere die Einstellung „fixed category positions“.","parent":"Übergeordnete Kategorie","notifications":{"watching":{"title":"Beobachten","description":"Du wirst automatisch alle neuen Themen in diesen Kategorien beobachten. Du wirst über alle neuen Beiträge in allen Themen benachrichtigt und die Anzahl der neuen Antworten wird angezeigt."},"watching_first_post":{"title":"Ersten Beitrag beobachten","description":"Du erhältst eine Benachrichtigung fnur ür den ersten Beitrag in jedem neuen Thema in diesen Kategorien."},"tracking":{"title":"Verfolgen","description":"Du wirst automatisch alle neuen Themen in diesen Kategorien verfolgen. Du wirst benachrichtigt, wenn jemand deinen @name erwähnt oder dir antwortet, und die Anzahl der neuen Antworten wird angezeigt."},"regular":{"title":"Normal","description":"Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet."},"muted":{"title":"Stummgeschaltet","description":"Du erhältst nie mehr Benachrichtigungen über neue Themen in dieser Kategorie und die Themen werden auch nicht in der Liste der letzten Themen erscheinen."}}},"flagging":{"title":"Danke für deine Mithilfe!","action":"Beitrag melden","take_action":"Reagieren","notify_action":"Nachricht","official_warning":"Offizielle Warnung","delete_spammer":"Spammer löschen","yes_delete_spammer":"Ja, lösche den Spammer","ip_address_missing":"(nicht verfügbar)","hidden_email_address":"(versteckt)","submit_tooltip":"Private Meldung abschicken","take_action_tooltip":"Den Meldungsschwellenwert sofort erreichen, anstatt auf weitere Meldungen aus der Community zu warten.","cant":"Entschuldige, du kannst diesen Beitrag derzeit nicht melden.","notify_staff":"Mitarbeiter nichtöffentlich benachrichtigen","formatted_name":{"off_topic":"Es ist am Thema vorbei","inappropriate":"Es ist unangemessen","spam":"Es ist Spam"},"custom_placeholder_notify_user":"Sei konkret, konstruktiv und immer freundlich.","custom_placeholder_notify_moderators":"Bitte lass uns wissen, was genau dich beunruhigt. Verweise, wenn möglich, auf relevante Links und Beispiele.","custom_message":{"at_least":{"one":"gib mindestens ein Zeichen ein","other":"gib mindestens {{count}} Zeichen ein"},"more":{"one":"eine weitere…","other":"{{count}} weitere…"}}},"flagging_topic":{"title":"Danke für deine Mithilfe!","action":"Thema melden","notify_action":"Nachricht"},"topic_map":{"title":"Zusammenfassung des Themas","participants_title":"Autoren vieler Beiträge","links_title":"Beliebte Links","links_shown":"mehr Links anzeigen…","clicks":{"one":"1 Klick","other":"%{count} Klicks"}},"post_links":{"about":"weitere Links für diesen Beitrag aufklappen","title":{"one":"ein weiterer","other":"%{count} weitere"}},"topic_statuses":{"warning":{"help":"Dies ist eine offizielle Warnung."},"bookmarked":{"help":"Du hast in diesem Thema ein Lesezeichen gesetzt."},"locked":{"help":"Dieses Thema ist geschlossen. Das Antworten ist nicht mehr möglich."},"archived":{"help":"Dieses Thema ist archiviert; es ist eingefroren und kann nicht mehr geändert werden"},"locked_and_archived":{"help":"Dieses Thema ist geschlossen. Das Antworten oder das Bearbeiten ist nicht mehr möglich."},"unpinned":{"title":"Losgelöst","help":"Dieses Thema ist für dich losgelöst; es wird in der normalen Reihenfolge angezeigt"},"pinned_globally":{"title":"Global angeheftet","help":"Dieses Thema ist global angeheftet; es wird immer am Anfang der Liste der letzten Beiträgen und in seiner Kategorie auftauchen"},"pinned":{"title":"Angeheftet","help":"Dieses Thema ist für dich angeheftet; es wird immer am Anfang seiner Kategorie auftauchen"},"invisible":{"help":"Dieses Thema ist unsichtbar. Es wird in keiner Themenliste angezeigt und kann nur mit einem direkten Link betrachtet werden."}},"posts":"Beiträge","posts_long":"dieses Thema enthält {{number}} Beiträge","original_post":"Original-Beitrag","views":"Aufrufe","views_lowercase":{"one":"Aufruf","other":"Aufrufe"},"replies":"Antworten","views_long":"dieses Thema wurde {{number}} mal betrachtet","activity":"Aktivität","likes":"Likes","likes_lowercase":{"one":"Like","other":"Likes"},"likes_long":"es gibt {{number}} Likes in diesem Thema","users":"Benutzer","users_lowercase":{"one":"Benutzer","other":"Benutzer"},"category_title":"Kategorie","history":"Verlauf","changed_by":"von {{author}}","raw_email":{"title":"Unverarbeitete E-Mail","not_available":"Nicht verfügbar!"},"categories_list":"Liste der Kategorien","filters":{"with_topics":"%{filter}e Themen","with_category":"%{filter}e Themen in %{category}","latest":{"title":"Aktuell","title_with_count":{"one":"Aktuell (1)","other":"Aktuell ({{count}})"},"help":"die zuletzt geänderten Themen"},"hot":{"title":"Beliebt","help":"eine Auswahl der beliebtesten Themen"},"read":{"title":"Gelesen","help":"Themen, die du gelesen hast; werden in der Reihenfolge angezeigt, in der du diese gelesen hast"},"search":{"title":"Suche","help":"alle Themen durchsuchen"},"categories":{"title":"Kategorien","title_in":"Kategorie - {{categoryName}}","help":"alle Themen, gruppiert nach Kategorie"},"unread":{"title":"Ungelesen","title_with_count":{"one":"Ungelesen (1)","other":"Ungelesen ({{count}})"},"help":"Themen mit ungelesenen Beiträgen, die du derzeit beobachtest oder verfolgst","lower_title_with_count":{"one":"1 ungelesenes","other":"{{count}} ungelesene"}},"new":{"lower_title_with_count":{"one":"1 neues","other":"{{count}} neue"},"lower_title":"neu","title":"Neu","title_with_count":{"one":"Neu (1)","other":"Neu ({{count}})"},"help":"Themen, die in den letzten paar Tagen erstellt wurden"},"posted":{"title":"Meine Beiträge","help":"Themen zu denen du beigetragen hast"},"bookmarks":{"title":"Lesezeichen","help":"Themen, in denen du ein Lesezeichen gesetzt hast"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"aktuelle Themen in der Kategorie {{categoryName}}"},"top":{"title":"Angesagt","help":"die aktivsten Themen in diesem Jahr, in diesem Monat, in dieser Woche und heute","all":{"title":"Gesamt"},"yearly":{"title":"Jährlich"},"quarterly":{"title":"Vierteljährlich"},"monthly":{"title":"Monatlich"},"weekly":{"title":"Wöchentlich"},"daily":{"title":"Täglich"},"all_time":"Gesamt","this_year":"Jahr","this_quarter":"Quartal","this_month":"Monat","this_week":"Woche","today":"Heute","other_periods":"zeige angesagte Themen:"}},"browser_update":"\u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eDein Webbrowser ist leider zu alt, um dieses Forum zu besuchen\u003c/a\u003e. Bitte \u003ca href=\"http://browsehappy.com\"\u003einstalliere einen neueren Browser\u003c/a\u003e.","permission_types":{"full":"Erstellen / Antworten / Ansehen","create_post":"Antworten / Ansehen","readonly":"Ansehen"},"lightbox":{"download":"herunterladen"},"search_help":{"title":"Suche"},"keyboard_shortcuts_help":{"title":"Tastenkombinationen","jump_to":{"title":"Springe zu","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Startseite","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Neueste Beiträge","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Neue Beiträge","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Ungelesene Beiträge","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Kategorien","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top-Beiträge","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Lesezeichen","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Nachrichten"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Gehe zu Beitrag #","back":"\u003cb\u003eu\u003c/b\u003e Zurück","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Auswahl bewegen \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Ausgewähltes Thema öffnen","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Nächster/vorheriger Abschnitt"},"application":{"title":"Anwendung","create":"\u003cb\u003ec\u003c/b\u003e Neues Thema erstellen","notifications":"\u003cb\u003en\u003c/b\u003e Benachrichtigungen öffnen","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e „Hamburger“-Menü öffnen","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Benutzermenü öffnen","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Aktualisierte Themen anzeigen","search":"\u003cb\u003e/\u003c/b\u003e Suche","help":"\u003cb\u003e?\u003c/b\u003e Tastaturhilfe öffnen","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Neue/ausgewählte Beiträge ausblenden","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Themen ausblenden","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Abmelden"},"actions":{"title":"Aktionen","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Lesezeichen hinzufügen/entfernen","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Thema hervorheben/nicht mehr hervorheben","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Thema teilen","share_post":"\u003cb\u003es\u003c/b\u003e Beitrag teilen","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Mit verknüpftem Thema antworten","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Auf Thema antworten","reply_post":"\u003cb\u003er\u003c/b\u003e Auf Beitrag antworten","quote_post":"\u003cb\u003eq\u003c/b\u003e Beitrag zitieren","like":"\u003cb\u003el\u003c/b\u003e Beitrag mit „Gefällt mir“ markieren","flag":"\u003cb\u003e!\u003c/b\u003e Beitrag melden","bookmark":"\u003cb\u003eb\u003c/b\u003e Lesezeichen auf Beitrag setzen","edit":"\u003cb\u003ee\u003c/b\u003e Beitrag bearbeiten","delete":"\u003cb\u003ed\u003c/b\u003e Beitrag löschen","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Thema stummschalten","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Thema auf Normal setzen","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Thema verfolgen","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Thema beobachten"}},"badges":{"earned_n_times":{"one":"Abzeichen 1-mal erhalten","other":"Abzeichen %{count}-mal erhalten"},"granted_on":"Verliehen %{date}","others_count":"Andere mit diesem Abzeichen (%{count})","title":"Abzeichen","allow_title":"kann als Titel verwendet werden","multiple_grant":"kann mehrfach verliehen werden","badge_count":{"one":"1 Abzeichen","other":"%{count} Abzeichen"},"more_badges":{"one":"+1 weiteres","other":"+%{count} weitere"},"granted":{"one":"1-mal verliehen","other":"%{count}-mal verliehen"},"select_badge_for_title":"Wähle ein Abzeichen als deinen Titel aus","none":"\u003ckeines\u003e","badge_grouping":{"getting_started":{"name":"Erste Schritte"},"community":{"name":"Community"},"trust_level":{"name":"Vertrauensstufe"},"other":{"name":"Andere"},"posting":{"name":"Schreiben"}}},"google_search":"\u003ch3\u003eMit Google suchen\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Alle Schlagwörter","selector_all_tags":"Alle Schlagwörter","selector_no_tags":"keine Schlagwörter","changed":"Geänderte Schlagwörter:","tags":"Schlagwörter","choose_for_topic":"Optionale Schlagwörter für dieses Thema wählen","delete_tag":"Schlagwört löschen","delete_confirm":"Möchtest du wirklich dieses Schlagwort löschen?","rename_tag":"Schlagwort umbenennen","rename_instructions":"Neuen Namen für das Schlagwort wählen:","sort_by":"Sortieren nach:","sort_by_count":"Anzahl","sort_by_name":"Name","manage_groups":"Schlagwort-Gruppen verwalten","manage_groups_description":"Gruppen definieren, um Schlagwörter zu organisieren","filters":{"without_category":"%{filter} %{tag} Themen","with_category":"%{filter} %{tag} Themen in %{category}","untagged_without_category":"%{filter} Themen ohne Schlagwörter","untagged_with_category":"%{filter} ohne Schlagwörter in %{category}"},"notifications":{"watching":{"title":"Beobachten","description":"Du wirst automatisch alle Themen mit diesem Schlagwort beobachten. Du wirst über alle neuen Beiträge und Themen benachrichtigt werden. Außerdem wird die Anzahl der ungelesenen und neuen Beiträge neben dem Thema erscheinen."},"watching_first_post":{"title":"Ersten Beitrag beobachten","description":"Du erhältst nur eine Benachrichtigung für den ersten Beitrag in jedem neuen Thema mit diesem Schlagwort."},"tracking":{"title":"Verfolgen","description":"Du wirst automatisch allen Themen mit diesem Schlagwort folgen. Die Anzahl der ungelesenen und neuen Beiträge wird neben dem Thema erscheinen."},"regular":{"title":"Allgemein","description":"Du wirst benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet."},"muted":{"title":"Stummgeschaltet","description":"Du wirst nicht über neue Themen mit diesem Schlagwort benachrichtigt und sie werden nicht in deinen ungelesenen Beiträgen auftauchen."}},"groups":{"title":"Schlagwort-Gruppen","about":"Schlagwörter zu Gruppen hinzufügen, um sie einfacher zu verwalten.","new":"Neue Gruppe","tags_label":"Schlagwörter in dieser Gruppe:","parent_tag_label":"Übergeordnetes Schlagwort","parent_tag_placeholder":"Optional","parent_tag_description":"Schlagwörter aus dieser Gruppe können nur verwendet werden, wenn das übergeordnete Schlagwort zugeordnet ist.","one_per_topic_label":"Beschränke diese Gruppe auf ein Schlagwort pro Thema","new_name":"Neue Schlagwort-Gruppe","save":"Speichern","delete":"Löschen","confirm_delete":"Möchtest du wirklich diese Schlagwort-Gruppe löschen?"},"topics":{"none":{"unread":"Du hast keine ungelesenen Themen.","new":"Du hast keine neuen Themen.","read":"Du hast noch keine Themen gelesen.","posted":"Du hast noch keine Beiträge verfasst.","latest":"Es gibt keine aktuellen Themen.","hot":"Es gibt keine beliebten Themen.","bookmarks":"Du hast noch keine Themen, in denen du ein Lesezeichen gesetzt hast.","top":"Es gibt keine Top-Themen.","search":"Es wurden keine Suchergebnisse gefunden."},"bottom":{"latest":"Das waren die aktuellen Themen.","hot":"Das waren alle beliebten Themen.","posted":"Das waren alle deine Themen.","read":"Das waren alle gelesenen Themen.","new":"Das waren alle neuen Themen.","unread":"Das waren alle ungelesen Themen.","top":"Das waren alle Top-Themen.","bookmarks":"Das waren alle Themen mit Lesezeichen.","search":"Es gibt keine weiteren Suchergebnisse."}}},"invite":{"custom_message":"Mache deine Einladung ein bisschen mehr persönlich, indem du etwas schreibst:","custom_message_link":"persönliche Nachricht","custom_message_placeholder":"Gib deine persönliche Nachricht ein","custom_message_template_forum":"Hey, du solltest diesem Forum beitreten!","custom_message_template_topic":"Hey, ich dachte, dir könnte dieses Thema gefallen!"},"poll":{"voters":{"one":"Teilnehmer","other":"Teilnehmer"},"total_votes":{"one":"abgegebene Stimme","other":"abgegebene Stimmen"},"average_rating":"Durchschnittliche Bewertung: \u003cstrong\u003e%{average}\u003c/strong\u003e","public":{"title":"Abgegebene Stimmen werden veröffentlicht."},"multiple":{"help":{"at_least_min_options":{"one":"Du musst mindestens \u003cstrong\u003e1\u003c/strong\u003e Option auswählen.","other":"Du musst mindestens \u003cstrong\u003e%{count}\u003c/strong\u003e Optionen auswählen."},"up_to_max_options":{"one":"Du kannst bis zu \u003cstrong\u003eeine\u003c/strong\u003e Option auswählen.","other":"Du kannst bis zu \u003cstrong\u003e%{count}\u003c/strong\u003e Optionen auswählen."},"x_options":{"one":"Bitte wähle \u003cstrong\u003e1\u003c/strong\u003e Option","other":"Bitte wähle \u003cstrong\u003e%{count}\u003c/strong\u003e Optionen"},"between_min_and_max_options":"Bitte wähle zwischen \u003cstrong\u003e%{min}\u003c/strong\u003e und \u003cstrong\u003e%{max}\u003c/strong\u003e Optionen"}},"cast-votes":{"title":"Gib deine Stimmen ab","label":"Jetzt abstimmen!"},"show-results":{"title":"Das Ergebnis der Umfrage anzeigen","label":"Ergebnisse anzeigen"},"hide-results":{"title":"Zurück zur Umfrage","label":"Ergebnisse ausblenden"},"open":{"title":"Umfrage starten","label":"Starten","confirm":"Möchtest du diese Umfrage wirklich starten?"},"close":{"title":"Umfrage beenden","label":"Beenden","confirm":"Möchtest du diese Umfrage wirklich beenden?"},"error_while_toggling_status":"Entschuldige, es gab einen Fehler beim Wechseln des Status dieser Umfrage.","error_while_casting_votes":"Entschuldige, es gab einen Fehler beim Abgeben deiner Stimme.","error_while_fetching_voters":"Entschuldige, es gab einen Fehler beim Anzeigen der Teilnehmer.","ui_builder":{"title":"Umfrage erstellen","insert":"Umfrage einfügen","help":{"options_count":"Gib mindestens 2 Optionen ein"},"poll_type":{"label":"Art","regular":"Einfachauswahl","multiple":"Mehrfachauswahl","number":"Bewertung"},"poll_config":{"max":"max.","min":"min.","step":"Schrittweite"},"poll_public":{"label":"Anzeigen wer abgestimmt hat"},"poll_options":{"label":"Bitte gib eine Umfrageoption pro Zeile ein"}}},"type_to_filter":"zum Filtern hier eingeben…","admin":{"title":"Discourse-Administrator","moderator":"Moderator","dashboard":{"title":"Übersicht","last_updated":"Übersicht zuletzt aktualisiert:","version":"Version","up_to_date":"Du verwendest die neueste Version!","critical_available":"Ein kritisches Update ist verfügbar.","updates_available":"Updates sind verfügbar.","please_upgrade":"Bitte Upgrade durchführen!","no_check_performed":"Es wurde nicht nach Updates gesucht. Bitte stelle sicher, dass sidekiq läuft.","stale_data":"Es wurde schon länger nicht nach Updates gesucht. Bitte stelle sicher, dass sidekiq läuft.","version_check_pending":"Sieht so aus, als hättest du vor Kurzem aktualisiert. Großartig!","installed_version":"Installiert","latest_version":"Neueste","problems_found":"Es gibt Probleme mit deiner Discourse-Installation:","last_checked":"Zuletzt geprüft","refresh_problems":"Aktualisieren","no_problems":"Es wurden keine Probleme gefunden.","moderators":"Moderatoren:","admins":"Administratoren:","blocked":"Blockiert:","suspended":"Gesperrt:","private_messages_short":"Nachr.","private_messages_title":"Nachrichten","mobile_title":"Mobilgerät","space_free":"{{size}} frei","uploads":"Uploads","backups":"Backups","traffic_short":"Traffic","traffic":"Web Requests der Applikation","page_views":"API Requests","page_views_short":"API Requests","show_traffic_report":"Zeige detaillierten Traffic-Bericht","reports":{"today":"Heute","yesterday":"Gestern","last_7_days":"Letzten 7 Tage","last_30_days":"Letzten 30 Tage","all_time":"Gesamt","7_days_ago":"vor 7 Tagen","30_days_ago":"vor 30 Tagen","all":"Gesamt","view_table":"Tabelle","view_graph":"Netzwerk","refresh_report":"Bericht aktualisieren","start_date":"Startdatum","end_date":"Enddatum","groups":"Alle Gruppen"}},"commits":{"latest_changes":"Letzte Änderungen: bitte häufig updaten!","by":"von"},"flags":{"title":"Meldungen","old":"Alt","active":"Aktiv","agree":"Zustimmen","agree_title":"Meldung bestätigen, weil diese gültig und richtig ist","agree_flag_modal_title":"Zustimmen und…","agree_flag_hide_post":"Zustimmen (Beitrag ausblenden + PN senden)","agree_flag_hide_post_title":"Diesen Beitrag ausblenden und den Benutzer mit einer automatisch gesendeten Nachricht zum Bearbeiten des Beitrags auffordern.","agree_flag_restore_post":"Zustimmen (Beitrag wiederherstellen)","agree_flag_restore_post_title":"Diesen Beitrag wiederherstellen","agree_flag":"Meldung zustimmen","agree_flag_title":"Der Meldung zustimmen und den Beitrag unverändert lassen.","defer_flag":"Ignorieren","defer_flag_title":"Entferne diese Meldung. Derzeit besteht kein Handlungsbedarf.","delete":"Löschen","delete_title":"Lösche den Beitrag, auf den diese Meldung verweist.","delete_post_defer_flag":"Beitrag löschen und Meldung ignorieren","delete_post_defer_flag_title":"Beitrag löschen; das Thema löschen, wenn es sich um den ersten Beitrag handelt","delete_post_agree_flag":"Beitrag löschen und der Meldung zustimmen","delete_post_agree_flag_title":"Beitrag löschen; das Thema löschen, wenn es sich um den ersten Beitrag handelt","delete_flag_modal_title":"Löschen und…","delete_spammer":"Spammer löschen","delete_spammer_title":"Lösche den Benutzer und alle seine Beiträge und Themen.","disagree_flag_unhide_post":"Ablehnen (Beitrag einblenden)","disagree_flag_unhide_post_title":"Verwerfe alle Meldungen über diesen Beitrag und blende den Beitrag wieder ein","disagree_flag":"Ablehnen","disagree_flag_title":"Meldung ablehnen, weil diese ungültig oder falsch ist","clear_topic_flags":"Erledigt","clear_topic_flags_title":"Das Thema wurde untersucht und Probleme wurden beseitigt. Klicke auf „Erledigt“, um die Meldungen zu entfernen.","more":"(weitere Antworten…)","dispositions":{"agreed":"zugestimmt","disagreed":"abgelehnt","deferred":"ignoriert"},"flagged_by":"Gemeldet von","resolved_by":"Geklärt durch","took_action":"Reagiert","system":"System","error":"Etwas ist schief gelaufen","reply_message":"Antworten","no_results":"Es gibt keine Meldungen.","topic_flagged":"Dieses \u003cstrong\u003eThema\u003c/strong\u003e wurde gemeldet.","visit_topic":"Besuche das Thema, um zu reagieren","was_edited":"Beitrag wurde nach der ersten Meldung bearbeitet","previous_flags_count":"Dieses Thema wurde bereits {{count}} mal gemeldet.","summary":{"action_type_3":{"one":"„am Thema vorbei“","other":"„am Thema vorbei“ x{{count}}"},"action_type_4":{"one":"unangemessen","other":"unangemessen x{{count}}"},"action_type_6":{"one":"benutzerdefiniert","other":"benutzerdefiniert x{{count}}"},"action_type_7":{"one":"benutzerdefiniert","other":"benutzerdefiniert x{{count}}"},"action_type_8":{"one":"Spam","other":"Spam x{{count}}"}}},"groups":{"primary":"Hauptgruppe","no_primary":"(keine Hauptgruppe)","title":"Gruppen","edit":"Gruppen bearbeiten","refresh":"Aktualisieren","new":"Neu","selector_placeholder":"Benutzername eingeben","name_placeholder":"Gruppenname, keine Leerzeichen, gleiche Regel wie beim Benutzernamen","about":"Hier kannst du Gruppenzugehörigkeiten und Gruppennamen bearbeiten.","group_members":"Gruppenmitglieder","delete":"Löschen","delete_confirm":"Diese Gruppe löschen?","delete_failed":"Gruppe konnte nicht gelöscht werden. Wenn dies eine automatische Gruppe ist, kann sie nicht gelöscht werden.","delete_member_confirm":"'%{username}' aus der Gruppe '%{group}' entfernen?","delete_owner_confirm":"Eigentümerrechte für '%{username}' entfernen?","name":"Name","add":"Hinzufügen","add_members":"Mitglieder hinzufügen","custom":"Benutzerdefiniert","bulk_complete":"Die Benutzer wurden der Gruppe hinzugefügt.","bulk":"Mehrere der Gruppe hinzufügen","bulk_paste":"Füge eine Liste an Benutzernamen oder E-Mail-Adressen ein (ein Eintrag je Zeile):","bulk_select":"(wähle eine Gruppe aus)","automatic":"Automatisch","automatic_membership_email_domains":"Benutzer, deren E-Mail-Domain mit einem der folgenden Listeneinträge genau übereinstimmt, werden automatisch zu dieser Gruppe hinzugefügt:","automatic_membership_retroactive":"Diese Regel auch auf existierende Benutzer anwenden, um diese zur Gruppe hinzuzufügen.","default_title":"Standardtitel für alle Benutzer in dieser Gruppe","primary_group":"Automatisch als primäre Gruppe festlegen","group_owners":"Eigentümer","add_owners":"Eigentümer hinzufügen","incoming_email":"Benutzerdefinierte Adresse für eingehende E-Mails","incoming_email_placeholder":"E-Mail-Adresse eingeben","flair_preview":"Vorschau"},"api":{"generate_master":"Master API Key erzeugen","none":"Es gibt momentan keine aktiven API-Keys","user":"Benutzer","title":"API","key":"API-Key","generate":"Erzeugen","regenerate":"Erneuern","revoke":"Widerrufen","confirm_regen":"Möchtest du wirklich den API Key mit einem neuen ersetzen?","confirm_revoke":"Möchtest du wirklich den API Key widerrufen?","info_html":"Dein API-Key erlaubt dir das Erstellen und Bearbeiten von Themen via JSON-Aufrufen.","all_users":"Alle Benutzer","note_html":"Halte diesen Schlüssel \u003cstrong\u003egeheim\u003c/strong\u003e. Alle Benutzer, die diesen Schlüssel besitzen, können beliebige Beiträge als jeder Benutzer erstellen."},"plugins":{"title":"Plug-ins","installed":"Installierte Plug-ins","name":"Name","none_installed":"Du hast keine Plug-ins installiert.","version":"Version","enabled":"Aktiviert?","is_enabled":"J","not_enabled":"N","change_settings":"Einstellungen ändern","change_settings_short":"Einstellungen","howto":"Wie installiere ich Plug-ins?"},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Logs"},"none":"Kein Backup verfügbar.","read_only":{"enable":{"title":"Nur-Lesen-Modus aktivieren","label":"Nur-Lesen-Modus aktivieren","confirm":"Möchtest du wirklich den Nur-Lesen-Modus aktivieren?"},"disable":{"title":"Nur-Lesen-Modus deaktivieren","label":"Nur-Lesen-Modus deaktivieren"}},"logs":{"none":"Noch keine Protokolleinträge verfügbar…"},"columns":{"filename":"Dateiname","size":"Größe"},"upload":{"label":"Hochladen","title":"Eine Sicherung zu dieser Instanz hochladen","uploading":"Wird hochgeladen…","success":"'{{filename}}' wurde erfolgreich hochgeladen.","error":"Beim Hochladen der Datei '{{filename}}' ist ein Fehler aufgetreten: {{message}}"},"operations":{"is_running":"Ein Vorgang läuft gerade…","failed":"Der Vorgang '{{operation}}' ist fehlgeschlagen. Bitte überprüfe die Logs.","cancel":{"label":"Abbrechen","title":"Den aktuellen Vorgang abbrechen","confirm":"Möchtest du wirklich den aktuellen Vorgang abbrechen?"},"backup":{"label":"Sichern","title":"Ein Backup erstellen","confirm":"Willst du ein neues Backup starten?","without_uploads":"Ja (ohne Dateien)"},"download":{"label":"Herunterladen","title":"Backup herunterladen"},"destroy":{"title":"Das Backup löschen","confirm":"Möchtest du wirklich das Backup löschen?"},"restore":{"is_disabled":"Wiederherstellung ist in den Website-Einstellungen deaktiviert.","label":"Wiederherstellen","title":"Das Backup wiederherstellen","confirm":"Bist du sicher, dass du dieses Backup wiederherstellen möchtest?"},"rollback":{"label":"Zurücksetzen","title":"Die Datenbank auf den letzten funktionierenden Zustand zurücksetzen","confirm":"Möchtest du wirklich die Datenbank auf den letzten funktionierenden Stand zurücksetzen?"}}},"export_csv":{"user_archive_confirm":"Möchtest du wirklich deine Beiträge herunterladen?","success":"Der Export wurde gestartet. Du erhältst eine Nachricht, sobald der Vorgang abgeschlossen ist.","failed":"Der Export ist fehlgeschlagen. Bitte überprüfe die Logs.","rate_limit_error":"Beiträge können pro Tag nur einmal heruntergeladen werden. Bitte versuch es morgen wieder.","button_text":"Exportieren","button_title":{"user":"Vollständige Benutzerliste im CSV-Format exportieren.","staff_action":"Vollständiges Moderations-Protokoll im CSV-Format exportieren.","screened_email":"Vollständige Liste der gefilterten E-Mail-Adressen im CSV-Format exportieren.","screened_ip":"Vollständige Liste der gefilterten IP-Adressen im CSV-Format exportieren.","screened_url":"Vollständige Liste der gefilterten URLs im CSV-Format exportieren."}},"export_json":{"button_text":"Exportieren"},"invite":{"button_text":"Einladungen versenden","button_title":"Einladungen versenden"},"customize":{"title":"Anpassen","long_title":"Anpassungen","css":"CSS","header":"Kopfbereich","top":"Anfang","footer":"Fußzeile","embedded_css":"Eingebettetes CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML das vor dem \u003c/head\u003e Tag eingefügt wird."},"body_tag":{"text":"\u003c/body\u003e","title":"HTML das vor dem \u003c/body\u003e Tag eingefügt wird."},"override_default":"Das Standard-Stylesheet nicht verwenden","enabled":"Aktiviert?","preview":"Vorschau","undo_preview":"Vorschau entfernen","rescue_preview":"Standard-Style","explain_preview":"Zeige die Website mit benutzerdefiniertem Stylesheet an","explain_undo_preview":"Gehe zurück zum aktuell aktivierten, benutzerdefinierten Stylesheet","explain_rescue_preview":"Zeige die Website mit dem Standard-Stylesheet an","save":"Speichern","new":"Neu","new_style":"Neuer Style","import":"Importieren","import_title":"Datei auswählen oder Text einfügen","delete":"Löschen","delete_confirm":"Diese Anpassung löschen?","about":"Ändere die Stylesheets (CSS) und den HTML-Header auf der Website. Füge eine Anpassung hinzu, um zu starten.","color":"Farbe","opacity":"Transparenz","copy":"Kopieren","email_templates":{"title":"E-Mail-Vorlagen","subject":"Betreff","multiple_subjects":"Diese E-Mail-Vorlage enthält mehrere Betreffzeilen.","body":"Nachrichtentext","none_selected":"Wähle eine E-Mail-Vorlage aus, um diese zu bearbeiten.","revert":"Änderungen verwerfen","revert_confirm":"Möchtest du wirklich deine Änderungen verwerfen?"},"css_html":{"title":"CSS/HTML","long_title":"CSS und HTML Anpassungen"},"colors":{"title":"Farben","long_title":"Farbschemata","about":"Farbschemen erlauben dir die auf der Seite benutzen Farben zu ändern ohne CSS schreiben zu müssen. Füge ein Schema hinzu, um zu beginnen.","new_name":"Neues Farbschema","copy_name_prefix":"Kopie von","delete_confirm":"Dieses Farbschema löschen?","undo":"rückgängig","undo_title":"Die seit dem letzten Speichern an dieser Farbe vorgenommenen Änderungen rückgängig machen.","revert":"verwerfen","revert_title":"Diese Farbe auf das Discourse-Standard-Farbschema zurücksetzen.","primary":{"name":"erste","description":"Die meisten Texte, Bilder und Ränder."},"secondary":{"name":"zweite","description":"Die Haupthintergrundfarbe und Textfarbe einiger Schaltflächen."},"tertiary":{"name":"dritte","description":"Links, einige Schaltflächen, Benachrichtigungen und Akzentfarben."},"quaternary":{"name":"vierte","description":"Navigations-Links"},"header_background":{"name":"Hintergrund Kopfbereich","description":"Hintergrundfarbe des Kopfbereichs der Website."},"header_primary":{"name":"primärer Kopfbereich","description":"Text und Symbole im Kopfbereich der Website."},"highlight":{"name":"hervorheben","description":"Die Hintergrundfarbe von hervorgehobenen Elementen, wie etwa Beiträge und Themen."},"danger":{"name":"Gefahr","description":"Hervorhebungsfarbe für Aktionen wie Löschen von Beiträgen und Themen."},"success":{"name":"Erfolg","description":"Zeigt an, dass eine Aktion erfolgreich war."},"love":{"name":"Liebe","description":"Die Farbe des Like-Buttons."}}},"email":{"title":"E-Mails","settings":"Einstellungen","templates":"Vorlagen","preview_digest":"Vorschau auf Neuigkeiten anzeigen","sending_test":"Versende Test-E-Mail…","error":"\u003cb\u003eFEHLER\u003c/b\u003e - %{server_error}","test_error":"Es gab ein Problem beim Senden der Test-E-Mail. Bitte überprüfe nochmals deine E-Mail-Einstellungen, stelle sicher dass dein Anbieter keine E-Mail-Verbindungen blockiert und probiere es erneut.","sent":"Gesendet","skipped":"Übersprungen","bounced":"Unzustellbar","received":"Empfangen","rejected":"Abgelehnt","sent_at":"Gesendet am","time":"Zeit","user":"Benutzer","email_type":"E-Mail-Typ","to_address":"Empfänger","test_email_address":"E-Mail-Adresse für Test","send_test":"Test-E-Mail senden","sent_test":"Gesendet!","delivery_method":"Versandmethode","preview_digest_desc":"Vorschau der Neuigkeiten, die als E-Mail an inaktive Nutzer gesendet werden.","refresh":"Aktualisieren","format":"Format","html":"HTML","text":"Text","last_seen_user":"Benutzer zuletzt gesehen:","reply_key":"Antwort-Schlüssel","skipped_reason":"Grund des Überspringens","incoming_emails":{"from_address":"Von","to_addresses":"An","cc_addresses":"Cc","subject":"Betreff","error":"Fehler","none":"Keine eingehenden E-Mails gefunden.","modal":{"title":"Details der eingehenden E-Mail","error":"Fehler","headers":"Kopfzeilen","subject":"Betreff","body":"Nachrichtentext","rejection_message":"Zurückweisung-E-Mail"},"filters":{"from_placeholder":"von@example.com","to_placeholder":"an@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Betreff…","error_placeholder":"Fehler"}},"logs":{"none":"Keine Protokolleinträge gefunden.","filters":{"title":"Filter","user_placeholder":"Benutzername","address_placeholder":"name@example.com","type_placeholder":"zusammenfassen, registrieren…","reply_key_placeholder":"Antwort-Schlüssel","skipped_reason_placeholder":"Grund"}}},"logs":{"title":"Logs","action":"Aktion","created_at":"Erstellt","last_match_at":"Letzter Treffer","match_count":"Treffer","ip_address":"IP","topic_id":"Themen-ID","post_id":"Beitrags-ID","category_id":"Kategorie-ID","delete":"Löschen","edit":"Bearbeiten","save":"Speichern","screened_actions":{"block":"blockieren","do_nothing":"nichts tun"},"staff_actions":{"title":"Mitarbeiter-Aktionen","instructions":"Klicke auf die Benutzernamen und Aktionen, um die Liste zu filtern. Klicke auf das Profilbild, um die Benutzerseiten zu sehen.","clear_filters":"Alles anzeigen","staff_user":"Mitarbeiter","target_user":"Betroffener Benutzer","subject":"Objekt","when":"Wann","context":"Kontext","details":"Details","previous_value":"Alt","new_value":"Neu","diff":"Vergleich","show":"Anzeigen","modal_title":"Details","no_previous":"Es gibt keinen vorherigen Wert.","deleted":"Kein neuer Wert. Der Eintrag wurde gelöscht.","actions":{"delete_user":"Benutzer löschen","change_trust_level":"Vertrauensstufe ändern","change_username":"Benutzernamen ändern","change_site_setting":"Einstellungen ändern","change_site_customization":"Anpassungen ändern","delete_site_customization":"Anpassungen löschen","change_site_text":"Text ändern","suspend_user":"Benutzer sperren","unsuspend_user":"Benutzer entsperren","grant_badge":"Abzeichen verleihen","revoke_badge":"Abzeichen entziehen","check_email":"E-Mail abrufen","delete_topic":"Thema löschen","delete_post":"Beitrag löschen","impersonate":"Nutzersicht","anonymize_user":"Benutzer anonymisieren","roll_up":"IP-Adressen zusammenfassen","change_category_settings":"Kategorieeinstellungen ändern","delete_category":"Kategorie löschen","create_category":"Kategorie erstellen","block_user":"Benutzer blockieren","unblock_user":"Blockierung von Benutzer aufheben","grant_admin":"Administration gewähren","revoke_admin":"Administration entziehen","grant_moderation":"Moderation gewähren","revoke_moderation":"Moderation entziehen","backup_operation":"Backup läuft","deleted_tag":"Schlagwort gelöscht","renamed_tag":"Schlagwort umbenannt","revoke_email":"E-Mail widerrufen"}},"screened_emails":{"title":"Gefilterte E-Mails","description":"Wenn jemand ein Konto erstellt, werden die folgenden E-Mail-Adressen überprüft und es wird die Anmeldung blockiert oder eine andere Aktion ausgeführt.","email":"E-Mail-Adresse","actions":{"allow":"Erlauben"}},"screened_urls":{"title":"Gefilterte URLs","description":"Die aufgelisteten URLs wurden in Beiträgen verwendet, die von Spammen erstellt wurden.","url":"URL","domain":"Domain"},"screened_ips":{"title":"Gefilterte IPs","description":"IP-Adressen die beobachtet werden. Benutze „Erlauben“, um IP-Adressen auf die Whitelist zu setzen.","delete_confirm":"Möchtest du wirklich die Regel für %{ip_address} entfernen?","roll_up_confirm":"Möchtest du wirklich die häufig gefilterten IP-Adressen zu Subnetzen zusammenfassen?","rolled_up_some_subnets":"Die geblockten IP-Adressen wurden erfolgreich zu diesen Subnetzen zusammengefasst: %{subnets}","rolled_up_no_subnet":"Es gab nichts zum Zusammenfassen.","actions":{"block":"Blockieren","do_nothing":"Erlauben","allow_admin":"Administrator zulassen"},"form":{"label":"Neu:","ip_address":"IP-Adresse","add":"Hinzufügen","filter":"Suche"},"roll_up":{"text":"Zusammenfassen","title":"Erzeugt neue Einträge zum Blockieren von Subnetzen, wenn mindestens 'min_ban_entries_for_roll_up' Einträge vorhanden sind."}},"logster":{"title":"Fehlerprotokolle"}},"impersonate":{"title":"Als Benutzer ausgeben","help":"Benutze dieses Werkzeug, um zur Fehlersuche in die Rolle eines anderen Benutzers zu schlüpfen. Du musst dich abmelden, wenn du fertig bist.","not_found":"Der Benutzer wurde nicht gefunden.","invalid":"Entschuldige, du darfst nicht in die Rolle dieses Benutzers schlüpfen."},"users":{"title":"Benutzer","create":"Administrator hinzufügen","last_emailed":"Letzte E-Mail","not_found":"Entschuldige, dieser Benutzername ist im System nicht vorhanden.","id_not_found":"Entschuldige, diese Benutzerkennung ist im System nicht vorhanden.","active":"Aktiv","show_emails":"E-Mails anzeigen","nav":{"new":"Neu","active":"Aktiv","pending":"Genehmigung","staff":"Mitarbeiter","suspended":"Gesperrt","blocked":"Blockiert","suspect":"Verdächtig"},"approved":"Genehmigt?","approved_selected":{"one":"Benutzer genehmigen","other":"Benutzer genehmigen ({{count}})"},"reject_selected":{"one":"Benutzer ablehnen","other":"Benutzer ablehnen ({{count}})"},"titles":{"active":"Aktive Benutzer","new":"Neue Benutzer","pending":"Benutzer mit ausstehender Genehmigung","newuser":"Benutzer mit Vertrauensstufe 0 (Neuer Benutzer)","basic":"Benutzer mit Vertrauensstufe 1 (Anwärter)","member":"Benutzer mit Vertrauensstufe 2 (Mitglied)","regular":"Benutzer mit Vertrauensstufe 3 (Stammgast)","leader":"Benutzer mit Vertrauensstufe 4 (Anführer)","staff":"Mitarbeiter","admins":"Administratoren","moderators":"Moderatoren","blocked":"Blockierte Benutzer","suspended":"Gesperrte Benutzer","suspect":"Verdächtige Benutzer"},"reject_successful":{"one":"Erfolgreich 1 Benutzer abgelehnt.","other":"Erfolgreich %{count} Benutzer abgelehnt."},"reject_failures":{"one":"Konnte 1 Benutzer nicht ablehnen.","other":"Konnte %{count} Benutzer nicht ablehnen."},"not_verified":"Nicht überprüft","check_email":{"title":"E-Mail-Adresse des Benutzers anzeigen","text":"Anzeigen"}},"user":{"suspend_failed":"Beim Sperren dieses Benutzers ist etwas schief gegangen {{error}}","unsuspend_failed":"Beim Entsperren dieses Benutzers ist etwas schief gegangen {{error}}","suspend_duration":"Wie lange soll dieser Benutzer gesperrt werden?","suspend_duration_units":"(Tage)","suspend_reason_label":"Warum sperrst du? Dieser Text ist auf der Profilseite des Benutzers \u003cb\u003efür jeden sichtbar\u003c/b\u003e und wird dem Benutzer angezeigt, wenn sich dieser anmelden will. Bitte kurz halten.","suspend_reason":"Grund","suspended_by":"Gesperrt von","delete_all_posts":"Lösche alle Beiträge","suspend":"Sperren","unsuspend":"Entsperren","suspended":"Gesperrt?","moderator":"Moderator?","admin":"Administrator?","blocked":"Geblockt?","staged":"Vorbereitet?","show_admin_profile":"Administration","edit_title":"Titel bearbeiten","save_title":"Titel speichern","refresh_browsers":"Aktualisierung im Browser erzwingen","refresh_browsers_message":"Nachricht wurde an alle Clients gesendet!","show_public_profile":"Zeige öffentliches Profil","impersonate":"Nutzersicht","ip_lookup":"IP-Abfrage","log_out":"Abmelden","logged_out":"Der Benutzer wurde auf allen Geräten abgemeldet","revoke_admin":"Administrationsrechte entziehen","grant_admin":"Administrationsrechte vergeben","revoke_moderation":"Moderationsrechte entziehen","grant_moderation":"Moderationsrechte vergeben","unblock":"Blockierung aufheben","block":"Blockieren","reputation":"Reputation","permissions":"Berechtigungen","activity":"Aktivität","like_count":"Abgegebene / erhaltene Likes","last_100_days":"in den letzten 100 Tagen","private_topics_count":"Private Themen","posts_read_count":"Gelesene Beiträge","post_count":"Erstelle Beiträge","topics_entered":"Betrachtete Themen","flags_given_count":"Gemachte Meldungen","flags_received_count":"Erhaltene Meldungen","warnings_received_count":"Warnungen erhalten","flags_given_received_count":"Erhaltene / gemachte Meldungen","approve":"Genehmigen","approved_by":"genehmigt von","approve_success":"Benutzer wurde genehmigt und eine E-Mail mit Anweisungen zur Aktivierung wurde gesendet.","approve_bulk_success":"Erfolgreich! Alle ausgewählten Benutzer wurden genehmigt und benachrichtigt.","time_read":"Lesezeit","anonymize":"Benutzer anonymisieren","anonymize_confirm":"Willst du dieses Konto wirklich anonymisieren? Dadurch werden der Benutzername und die E-Mail-Adresse unkenntlich gemacht und alle Informationen im Profil entfernt.","anonymize_yes":"Ja, diesen Benutzer anonymisieren","anonymize_failed":"Beim Anonymisieren des Benutzers ist ein Fehler aufgetreten.","delete":"Benutzer löschen","delete_forbidden_because_staff":"Administratoren und Moderatoren können nicht gelöscht werden.","delete_posts_forbidden_because_staff":"Löschen aller Beiträge von Administratoren und Moderatoren ist nicht möglich.","delete_forbidden":{"one":"Benutzer können nicht gelöscht werden, wenn diese Beiträge haben. Lösche zuerst all dessen Beiträge, bevor du versuchst einen Benutzer zu löschen. (Beiträge, die älter als %{count} Tag sind, können nicht gelöscht werden.)","other":"Benutzer können nicht gelöscht werden, wenn diese Beiträge haben. Lösche zuerst all dessen Beiträge, bevor du versuchst einen Benutzer zu löschen. (Beiträge, die älter als %{count} Tage sind, können nicht gelöscht werden.)"},"cant_delete_all_posts":{"one":"Nicht alle Beiträge können gelöscht werden. Einige Beiträge sind älter als %{count} Tag (die „delete_user_max_post_age“ Einstellung).","other":"Nicht alle Beiträge können gelöscht werden. Einige Beiträge sind älter als %{count} Tage (die „delete_user_max_post_age“ Einstellung)."},"cant_delete_all_too_many_posts":{"one":"Nicht alle Beiträge konnten gelöscht werden, da der Benutzer mehr als 1 Beitrag hat (die „delete_all_posts_max“ Einstellung).","other":"Nicht alle Beiträge konnten gelöscht werden, da der Benutzer mehr als %{count} Beiträge hat (die „delete_all_posts_max“ Einstellung)."},"delete_confirm":"Bist du dir SICHER, dass du diesen Benutzer löschen willst? Dies kann nicht rückgängig gemacht werden!","delete_and_block":"Löschen und diese E-Mail-Adresse und IP-Adresse \u003cb\u003eblockieren\u003c/b\u003e","delete_dont_block":"Nur löschen","deleted":"Der Benutzer wurde gelöscht.","delete_failed":"Beim Löschen des Benutzers ist ein Fehler aufgetreten. Stelle sicher, dass dieser Benutzer keine Beiträge mehr hat.","send_activation_email":"Aktivierungsmail senden","activation_email_sent":"Die Aktivierungsmail wurde gesendet.","send_activation_email_failed":"Beim Senden der Aktivierungsmail ist ein Fehler aufgetreten. %{error}","activate":"Benutzer aktivieren","activate_failed":"Beim Aktivieren des Benutzers ist ein Fehler aufgetreten.","deactivate_account":"Benutzer deaktivieren","deactivate_failed":"Beim Deaktivieren des Benutzers ist ein Fehler aufgetreten.","unblock_failed":"Beim Aufheben der Blockierung des Benutzers ist ein Fehler aufgetreten.","block_failed":"Beim Blocken des Benutzers ist ein Fehler aufgetreten.","block_confirm":"Bist du sicher, dass du diesen Benutzer blockieren willst? Der Benutzer wird keine Möglichkeit mehr haben, Themen oder Beiträge zu erstellen.","block_accept":"Ja, diesen Benutzer blockieren.","bounce_score":"Anzahl unzustellbarer E-Mails","reset_bounce_score":{"label":"Zurücksetzen","title":"Anzahl unzustellbarer E-Mails auf 0 zurücksetzen"},"deactivate_explanation":"Ein deaktivierter Benutzer muss seine E-Mail-Adresse erneut bestätigen.","suspended_explanation":"Ein gesperrter Benutzer kann sich nicht anmelden.","block_explanation":"Ein geblockter Benutzer kann keine Themen erstellen oder Beiträge veröffentlichen.","staged_explanation":"Ein vorbereiteter Benutzer kann nur per E-Mail und nur in bestimmten Themen schreiben.","bounce_score_explanation":{"none":"Keine unzustellbaren E-Mails an diese Adresse in letzter Zeit.","some":"Einige unzustellbare E-Mails an diese Adresse in letzter Zeit.","threshold_reached":"Zu viele unzustellbare E-Mails an diese Adresse."},"trust_level_change_failed":"Beim Wechsel der Vertrauensstufe ist ein Fehler aufgetreten.","suspend_modal_title":"Benutzer sperren","trust_level_2_users":"Benutzer mit Vertrauensstufe 2","trust_level_3_requirements":"Anforderungen für Vertrauensstufe 3","trust_level_locked_tip":"Vertrauensstufe ist nicht gesperrt. Das System wird den Benutzer nicht befördern oder zurückstufen. ","trust_level_unlocked_tip":"Vertrauensstufe ist nicht gesperrt. Das System kann den Benutzer befördern oder zurückstufen. ","lock_trust_level":"Vertrauensstufe sperren","unlock_trust_level":"Vertrauensstufe entsperren","tl3_requirements":{"title":"Anforderungen für Vertrauensstufe 3","table_title":{"one":"Innerhalb des letzten Tages:","other":"In den letzten %{count} Tagen:"},"value_heading":"Wert","requirement_heading":"Anforderung","visits":"Aufrufe","days":"Tage","topics_replied_to":"Auf Themen geantwortet","topics_viewed":"Betrachtete Themen","topics_viewed_all_time":"Betrachtete Themen (gesamte Zeit)","posts_read":"Gelesene Beiträge","posts_read_all_time":"Gelesene Beiträge (gesamte Zeit)","flagged_posts":"Gemeldete Beiträge","flagged_by_users":"Von Benutzern gemeldet","likes_given":"Abgegebene Likes","likes_received":"Erhaltene Likes","likes_received_days":"Erhaltene Likes: eindeutige Tage","likes_received_users":"Erhaltene Likes: eindeutige Benutzer","qualifies":"Erfüllt die Anforderungen für Vertrauensstufe 3.","does_not_qualify":"Erfüllt nicht die Anforderungen für Vertrauensstufe 3.","will_be_promoted":"Wird bald befördert werden.","will_be_demoted":"Wird bald zurückgestuft werden.","on_grace_period":"Wird nicht zurückgestuft. Derzeit gilt die Schonfrist der letzten Beförderung.","locked_will_not_be_promoted":"Vertrauensstufe ist gesperrt. Wird nie befördert werden.","locked_will_not_be_demoted":"Vertrauensstufe ist gesperrt. Wird nie zurückgestuft werden."},"sso":{"title":"Single Sign-on","external_id":"Externe ID","external_username":"Benutzername","external_name":"Name","external_email":"E-Mail","external_avatar_url":"URL des Profilbilds"}},"user_fields":{"title":"Benutzerfelder","help":"Füge Felder hinzu, welche deine Benutzer ausfüllen können.","create":"Benutzerfeld erstellen","untitled":"Unbetitelt","name":"Feldname","type":"Feldtyp","description":"Feldbeschreibung","save":"Speichern","edit":"Bearbeiten","delete":"Löschen","cancel":"Abbrechen","delete_confirm":"Bist du dir sicher, dass du dieses Benutzerfeld löschen möchtest?","options":"Optionen","required":{"title":"Bei Registrierung erforderlich?","enabled":"erforderlich","disabled":"nicht erforderlich"},"editable":{"title":"Nach der Registrierung editierbar?","enabled":"editierbar","disabled":"nicht editierbar"},"show_on_profile":{"title":"Im öffentlichen Profil anzeigen?","enabled":"wird im Profil angezeigt","disabled":"wird im Profil nicht angezeigt"},"show_on_user_card":{"title":"Auf Benutzerkarte anzeigen?","enabled":"Wird auf Benutzerkarte angezeigt","disabled":"Wird nicht auf Benutzerkarte angezeigt"},"field_types":{"text":"Textfeld","confirm":"Bestätigung","dropdown":"Dropdown-Liste"}},"site_text":{"description":"Du kannst jeden Text deines Forums anpassen. Benutze dazu die Suche:","search":"Suche nach dem Text, den du bearbeiten möchtest","title":"Textinhalt","edit":"bearbeiten","revert":"Änderungen verwerfen","revert_confirm":"Möchtest du wirklich deine Änderungen verwerfen?","go_back":"Zurück zur Suche","recommended":"Wir empfehlen, dass du den folgenden Text an deine Bedürfnisse anpasst:","show_overriden":"Nur geänderte Texte anzeigen"},"site_settings":{"show_overriden":"Nur geänderte Einstellungen anzeigen","title":"Einstellungen","reset":"zurücksetzen","none":"keine","no_results":"Keine Ergebnisse gefunden.","clear_filter":"Filter zurücksetzen","add_url":"URL hinzufügen","add_host":"Host hinzufügen","categories":{"all_results":"Alle","required":"Erforderlich","basic":"Grundeinstellungen","users":"Benutzer","posting":"Beiträge","email":"E-Mail","files":"Dateien","trust":"Vertrauensstufen","security":"Sicherheit","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Begrenzungen","developer":"Entwickler","embedding":"Einbettung","legal":"Rechtliches","uncategorized":"Sonstiges","backups":"Backups","login":"Anmeldung","plugins":"Plug-ins","user_preferences":"Benutzereinstellungen","tags":"Schlagwörter"}},"badges":{"title":"Abzeichen","new_badge":"Neues Abzeichen","new":"Neu","name":"Name","badge":"Abzeichen","display_name":"Anzeigename","description":"Beschreibung","long_description":"Lange Beschreibung","badge_type":"Abzeichentyp","badge_grouping":"Gruppe","badge_groupings":{"modal_title":"Abzeichen-Gruppierungen"},"granted_by":"Verliehen von","granted_at":"Verliehen am","reason_help":"(ein Link zu einem Beitrag oder Thema)","save":"Speichern","delete":"Löschen","delete_confirm":"Möchtest du wirklich dieses Abzeichen löschen?","revoke":"Entziehen","reason":"Grund","expand":"Erweitern \u0026hellip;","revoke_confirm":"Möchtest du wirklich dieses Abzeichen entziehen?","edit_badges":"Abzeichen bearbeiten","grant_badge":"Abzeichen verleihen","granted_badges":"Verliehene Abzeichen","grant":"Verleihen","no_user_badges":"%{name} wurden keine Abzeichen verliehen.","no_badges":"Es gibt keine Abzeichen die verliehen werden können.","none_selected":"Wähle ein Abzeichen aus, um loszulegen","allow_title":"Abzeichen darf als Titel verwendet werden","multiple_grant":"Kann mehrfach verliehen werden","listable":"Zeige Abzeichen auf der öffentlichen Abzeichenseite an","enabled":"Abzeichen aktivieren","icon":"Symbol","image":"Bild","icon_help":"Benutze eine Font Awesome class oder die URL eines Bildes","query":"Abzeichen-Abfrage (SQL)","target_posts":"Abfrage betrifft Beiträge","auto_revoke":"Führe die Abfrage zum Widerruf täglich aus","show_posts":"Den für die Verleihung des Abzeichens verantwortlichen Beitrag auf der Abzeichenseite anzeigen","trigger":"Auslöser","trigger_type":{"none":"Täglich aktualisieren","post_action":"Wenn ein Benutzer auf einen Beitrag reagiert","post_revision":"Wenn ein Benutzer einen Beitrag bearbeitet oder erstellt","trust_level_change":"Wenn sich die Vertrauensstufe eines Benutzers ändert","user_change":"Wenn ein Benutzer bearbeitet oder angelegt wird","post_processed":"Nach der Verarbeitung eines Beitrags"},"preview":{"link_text":"Vorschau auf verliehene Abzeichen","plan_text":"Vorschau mit Query Plan","modal_title":"Vorschau für Abzeichen-Abfrage","sql_error_header":"Es gab einen Fehler mit der SQL-Abfrage.","error_help":"Unter den nachfolgenden Links findest du Hilfe zu Abzeichen-Abfragen.","bad_count_warning":{"header":"WARNUNG!","text":"Es fehlen Beispieldaten. Das passiert, wenn die Abzeichen-Abfrage IDs von Benutzern oder Beiträgen liefert, die nicht existieren. Das kann in weiterer Folge zu unerwarteten Ergebnissen führen. Bitte überprüfe nochmals deine Abfrage."},"no_grant_count":"Es werden keine Abzeichen verliehen.","grant_count":{"one":"Es wird \u003cb\u003e1\u003c/b\u003e Abzeichen verliehen.","other":"Es werden \u003cb\u003e%{count}\u003c/b\u003e Abzeichen verliehen."},"sample":"Beispiel:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e für Beitrag in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e für Beitrag in %{link} um \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e um \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Neues Emoji hinzufügen, dass für alle verfügbar sein wird. (Tipp: per Drag \u0026 Drop kannst du gleichzeitig mehrere Dateien hinzufügen)","add":"Neues Emoji hinzufügen","name":"Name","image":"Bild","delete_confirm":"Möchtest du wirklich das :%{name}: Emoji löschen?"},"embedding":{"get_started":"Wenn du Discourse in einer anderen Website einbetten möchtest, beginne mit dem hinzufügen des host. ","confirm_delete":"Möchtest du wirklich  diesen Host löschen?","sample":"Benutze den folgenden HTML code für deine Site um Discourse Beiträge zu erstellen und einzubetten. Ersetze \u003cb\u003eREPLACE_ME\u003c/b\u003e mit der URL der Site in die du sie einbetten möchtest.","title":"Einbettung","host":"Erlaubte Hosts","edit":"bearbeiten","category":"In Kategorie Beitrag schreiben","add_host":"Host hinzufügen","settings":"Einbettungseinstellungen","feed_settings":"Feed-Einstellungen","feed_description":"Wenn man RSS/ATOM Feeds für eine Website zur Verfügung stellt, können sich die Möglichkeiten des Imports verbessern. ","crawling_settings":"Crawler-Einstellungen","crawling_description":"Wenn Discourse Themen für deine Beiträge erstellt wird es falls kein RSS/ATOM-Feed verfügbar ist versuchen, den Inhalt aus dem HTML-Code zu extrahieren. Dies ist teilweise schwierig, weshalb hier CSS-Regeln angegeben werden können, die die Extraktion erleichtern.","embed_by_username":"Benutzername für Beitragserstellung","embed_post_limit":"Maximale Anzahl der Beiträge, welche eingebettet werden","embed_username_key_from_feed":"Schlüssel, um Discourse-Benutzernamen aus Feed zu ermitteln.","embed_truncate":"Kürze die eingebetteten Beiträge","embed_whitelist_selector":"CSS Selektor für Elemente, die in Einbettungen erlaubt sind.","embed_blacklist_selector":"CSS Selektor für Elemente, die in Einbettungen entfernt werden.","embed_classname_whitelist":"Erlaubte CSS-Klassen","feed_polling_enabled":"Beiträge über RSS/ATOM importieren","feed_polling_url":"URL des RSS/ATOM Feeds für den Import","save":"Einbettungseinstellungen speichern"},"permalink":{"title":"Permanentlinks","url":"URL","topic_id":"Themen-ID","topic_title":"Thema","post_id":"Beitrags-ID","post_title":"Beitrag","category_id":"Kategorie-ID","category_title":"Kategorie","external_url":"Externe URL","delete_confirm":"Möchtest du wirklich diesen Permanentlink löschen?","form":{"label":"Neu:","add":"Hinzufügen","filter":"Suche (URL oder externe URL)"}}}}},"en":{"js":{"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_approved":"Approved:"},"category_page_style":{"categories_with_featured_topics":"Categories with Featured Topics"},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"topic":{"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value"},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?"},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'de';
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
//! locale : german (de)
//! author : lluchs : https://github.com/lluchs
//! author: Menelion Elensúle: https://github.com/Oire
//! author : Mikolaj Dadela : https://github.com/mik01aj

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    function processRelativeTime(number, withoutSuffix, key, isFuture) {
        var format = {
            'm': ['eine Minute', 'einer Minute'],
            'h': ['eine Stunde', 'einer Stunde'],
            'd': ['ein Tag', 'einem Tag'],
            'dd': [number + ' Tage', number + ' Tagen'],
            'M': ['ein Monat', 'einem Monat'],
            'MM': [number + ' Monate', number + ' Monaten'],
            'y': ['ein Jahr', 'einem Jahr'],
            'yy': [number + ' Jahre', number + ' Jahren']
        };
        return withoutSuffix ? format[key][0] : format[key][1];
    }

    var de = moment.defineLocale('de', {
        months : 'Januar_Februar_März_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember'.split('_'),
        monthsShort : 'Jan._Febr._Mrz._Apr._Mai_Jun._Jul._Aug._Sept._Okt._Nov._Dez.'.split('_'),
        monthsParseExact : true,
        weekdays : 'Sonntag_Montag_Dienstag_Mittwoch_Donnerstag_Freitag_Samstag'.split('_'),
        weekdaysShort : 'So._Mo._Di._Mi._Do._Fr._Sa.'.split('_'),
        weekdaysMin : 'So_Mo_Di_Mi_Do_Fr_Sa'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D. MMMM YYYY',
            LLL : 'D. MMMM YYYY HH:mm',
            LLLL : 'dddd, D. MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[heute um] LT [Uhr]',
            sameElse: 'L',
            nextDay: '[morgen um] LT [Uhr]',
            nextWeek: 'dddd [um] LT [Uhr]',
            lastDay: '[gestern um] LT [Uhr]',
            lastWeek: '[letzten] dddd [um] LT [Uhr]'
        },
        relativeTime : {
            future : 'in %s',
            past : 'vor %s',
            s : 'ein paar Sekunden',
            m : processRelativeTime,
            mm : '%d Minuten',
            h : processRelativeTime,
            hh : '%d Stunden',
            d : processRelativeTime,
            dd : processRelativeTime,
            M : processRelativeTime,
            MM : processRelativeTime,
            y : processRelativeTime,
            yy : processRelativeTime
        },
        ordinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return de;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D. MMM'); };
moment.fn.shortDate = function(){ return this.format('D. MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D. MMMM YYYY [um] HH:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
