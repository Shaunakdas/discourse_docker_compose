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
r += "Sinulla on ";
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
r += "<a href='/unread'>1 ketju</a>, jossa on viestejä ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ketjua</a>, joissa on viestejä ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "ja ";
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
r += " <a href='/new'>1 uusi</a> ketju";
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
r += "ja ";
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
})() + " uutta ketjua</a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " lukematta. Tai ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "selaile aluetta ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
r += "katsele ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
r += ".";
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
r += "Tässä ketjussa on ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 vastaus";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " vastausta";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += ", joilla on suuri määrä tykkäyksiä suhteessa viestien määrään";
return r;
},
"med" : function(d){
var r = "";
r += ", joilla on erittäin suuri määrä tykkäyksiä suhteessa viestien määrään";
return r;
},
"high" : function(d){
var r = "";
r += ", joilla on äärimmäisen suuri määrä tykkäyksiä suhteessa viestien määrään";
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

MessageFormat.locale.fi = function ( n ) {
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
I18n.translations = {"fi":{"js":{"number":{"format":{"separator":",","delimiter":" "},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Tavu","other":"Tavua"},"gb":"Gt","kb":"Kt","mb":"Mt","tb":"Tt"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"H:mm","timeline_date":"MMM YYYY","long_no_year":"D. MMMM[ta] H:mm","long_no_year_no_time":"D. MMMM[ta]","full_no_year_no_time":"Do MMMM[ta]","long_with_year":"D. MMMM[ta] YYYY H:mm","long_with_year_no_time":"D. MMMM[ta] YYYY","full_with_year_no_time":"Do MMMM[ta] YYYY","long_date_with_year":"D. MMMM[ta] YYYY LT","long_date_without_year":"D. MMMM[ta] LT","long_date_with_year_without_time":"D. MMMM[ta] YYYY","long_date_without_year_with_linebreak":"D. MMMM[ta] \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D. MMMM[ta] YYYY \u003cbr/\u003eLT","wrap_ago":"%{date} sitten","tiny":{"half_a_minute":"\u003c 1 min","less_than_x_seconds":{"one":"\u003c 1 s","other":"\u003c %{count} s"},"x_seconds":{"one":"1 s","other":"%{count} s"},"x_minutes":{"one":"1 min","other":"%{count} min"},"about_x_hours":{"one":"1 t","other":"%{count} t"},"x_days":{"one":"1 pv","other":"%{count} pv"},"about_x_years":{"one":"1 v","other":"%{count} v"},"over_x_years":{"one":"\u003e 1 v","other":"\u003e %{count} v"},"almost_x_years":{"one":"1 v","other":"%{count} v"},"date_month":"D. MMM","date_year":"MMM -YY"},"medium":{"x_minutes":{"one":"1 minuutti","other":"%{count} minuuttia"},"x_hours":{"one":"tunti","other":"%{count} tuntia"},"x_days":{"one":"1 päivä","other":"%{count} päivää"},"date_year":"MMMM YYYY"},"medium_with_ago":{"x_minutes":{"one":"minuutti sitten","other":"%{count} minuuttia sitten"},"x_hours":{"one":"tunti sitten","other":"%{count} tuntia sitten"},"x_days":{"one":"1 päivä sitten","other":"%{count} päivää sitten"}},"later":{"x_days":{"one":"1 päivä myöhemmin","other":"%{count} päivää myöhemmin"},"x_months":{"one":"1 kuukausi myöhemmin","other":"%{count} kuukautta myöhemmin"},"x_years":{"one":"1 vuosi myöhemmin","other":"%{count} vuotta myöhemmin"}},"previous_month":"Edellinen kuukausi","next_month":"Seuraava kuukausi"},"share":{"topic":"jaa linkki tähän ketjuun","post":"%{postNumber}. viesti","close":"sulje","twitter":"jaa tämä linkki Twitterissä","facebook":"jaa tämä linkki Facebookissa","google+":"jaa tämä linkki Google+:ssa","email":"lähetä tämä linkki sähköpostissa"},"action_codes":{"public_topic":"teki ketjusta julkisen %{when}","private_topic":"teki ketjusta yksityisen %{when}","split_topic":"pilkkoi tämän ketjun %{when}","invited_user":"kutsui käyttäjän %{who} %{when}","invited_group":"kutsui käyttäjän %{who} %{when}","removed_user":"poisti käyttäjän %{who} %{when}","removed_group":"poisti käyttäjän %{who} %{when}","autoclosed":{"enabled":"sulki %{when}","disabled":"avasi %{when}"},"closed":{"enabled":"sulki %{when}","disabled":"avasi %{when}"},"archived":{"enabled":"arkistoi %{when}","disabled":"palautti %{when}"},"pinned":{"enabled":"kiinnitti %{when}","disabled":"poisti kiinnityksen %{when}"},"pinned_globally":{"enabled":"kiinnitti koko palstalle %{when}","disabled":"poisti kiinnityksen %{when}"},"visible":{"enabled":"listasi %{when}","disabled":"poisti listauksista %{when}"}},"topic_admin_menu":"ketjun ylläpitotoimet","emails_are_disabled":"Ylläpitäjä on estänyt kaiken lähtevän sähköpostiliikenteen. Mitään sähköposti-ilmoituksia ei lähetetä.","bootstrap_mode_enabled":"Jotta uuden palsta käynnistäminen olisi helpompaa, on sivusto asetettu aloitustilaan. Kaikki uudet käyttäjät siirretään automaattisesti luottamustasolle 1 ja heille lähetetään sähköpostitiivistelmät päivittäin. Tämä tila poistetaan automaattisesti, kun käyttäjien määrä ylittää %{min_users}.","bootstrap_mode_disabled":"Aloitustila poistetaan seuraavan 24 tunnin aikana.","s3":{"regions":{"us_east_1":"itäinen USA (Pohjois-Virginia)","us_west_1":"Läntinen USA (Pohjois-Kalifornia)","us_west_2":"Läntinen USA (Oregon)","us_gov_west_1":"AWS GovCloud (USA)","eu_west_1":"EU (Irlanti)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Aasia ja Tyynimeri (Singapore)","ap_southeast_2":"Aasia ja Tyynimeri (Sydney)","ap_south_1":"Aasia ja Tyynimeri (Mumbai)","ap_northeast_1":"Aasia ja Tyynimeri (Tokio)","ap_northeast_2":"Aasia ja Tyynimeri (Soul)","sa_east_1":"Etelä-Amerikka (Sao Paulo)","cn_north_1":"Kiina (Peking)"}},"edit":"muokkaa ketjun otsikkoa ja aluetta","not_implemented":"Tätä toimintoa ei ole vielä toteutettu, pahoittelut!","no_value":"Ei","yes_value":"Kyllä","generic_error":"On tapahtunut virhe.","generic_error_with_reason":"Tapahtui virhe: %{error}","sign_up":"Luo tili","log_in":"Kirjaudu","age":"Ikä","joined":"Liittynyt","admin_title":"Ylläpito","flags_title":"Liput","show_more":"näytä lisää","show_help":"ohjeet","links":"Linkit","links_lowercase":{"one":"linkki","other":"linkit"},"faq":"UKK","guidelines":"Ohjeet","privacy_policy":"Rekisteriseloste","privacy":"Yksityisyys","terms_of_service":"Käyttöehdot","mobile_view":"Mobiilinäkymä","desktop_view":"Työpöytänäkymä","you":"Sinä","or":"tai","now":"juuri äsken","read_more":"lue lisää","more":"Lisää","less":"Vähemmän","never":"ei koskaan","every_30_minutes":"puolen tunnin välein","every_hour":"tunnin välein","daily":"päivittäin","weekly":"viikottain","every_two_weeks":"kahden viikon välein","every_three_days":"joka kolmas päivä","max_of_count":"korkeintaan {{count}}","alternation":"tai","character_count":{"one":"{{count}} merkki","other":"{{count}} merkkiä"},"suggested_topics":{"title":"Ehdotetut ketjut","pm_title":"Ehdotetut viestit"},"about":{"simple_title":"Tietoja","title":"Tietoja sivustosta %{title}","stats":"Sivuston tilastot","our_admins":"Ylläpitäjät","our_moderators":"Valvojat","stat":{"all_time":"Yhteensä","last_7_days":"7 päivän aikana","last_30_days":"30 päivän aikana"},"like_count":"Tykkäyksiä","topic_count":"Ketjuja","post_count":"Viestejä","user_count":"Uusia käyttäjiä","active_user_count":"Aktiivisia käyttäjiä","contact":"Yhteystiedot","contact_info":"Sivustoon liittyvissä kiireellisissä asioissa, ota yhteyttä osoitteeseen %{contact_info}."},"bookmarked":{"title":"Kirjanmerkki","clear_bookmarks":"Tyhjennä kirjanmerkit","help":{"bookmark":"Klikkaa lisätäksesi ketjun ensimmäisen viestin kirjanmerkkeihin","unbookmark":"Klikkaa poistaaksesi kaikki tämän ketjun kirjanmerkit"}},"bookmarks":{"not_logged_in":"pahoittelut, sinun täytyy kirjautua sisään voidaksesi lisätä viestin kirjanmerkin","created":"olet lisännyt tämän viestin kirjanmerkkeihisi","not_bookmarked":"olet lukenut tämän viestin, klikkaa lisätäksesi sen kirjanmerkkeihisi","last_read":"tämä on viimeisin viesti jonka olet lukenut, klikkaa lisätäksesi sen kirjanmerkkeihisi","remove":"Poista kirjanmerkki","confirm_clear":"Oletko varma, että haluat poistaa kaikki kirjanmerkit tässä ketjussa?"},"topic_count_latest":{"one":"{{count}} uusi tai päivittynyt ketju.","other":"{{count}} uutta tai päivittynyttä ketjua."},"topic_count_unread":{"one":"{{count}} ketju lukematta.","other":"{{count}} ketjua lukematta."},"topic_count_new":{"one":"{{count}} uusi ketju.","other":"{{count}} uutta ketjua."},"click_to_show":"Klikkaa nähdäksesi.","preview":"esikatselu","cancel":"peruuta","save":"Tallenna muutokset","saving":"Tallennetaan...","saved":"Tallennettu!","upload":"Liitä","uploading":"Lähettää...","uploading_filename":"Lähettää {{filename}}...","uploaded":"Lähetetty!","enable":"Ota käyttöön","disable":"Poista käytöstä","undo":"Peru","revert":"Palauta","failed":"Epäonnistui","switch_to_anon":"Siirry anonyymitilaan","switch_from_anon":"Poistu anonyymitilasta","banner":{"close":"Sulje tämä banneri.","edit":"Muokkaa banneria \u003e\u003e"},"choose_topic":{"none_found":"Yhtään ketjua ei löydetty.","title":{"search":"Etsi ketjua nimen, url:n tai id:n perusteella","placeholder":"kirjoita ketjun otsikko tähän"}},"queue":{"topic":"Ketju:","approve":"Hyväksy","reject":"Hylkää","delete_user":"Poista käyttäjä","title":"Odottaa hyväksyntää","none":"Tarkastettavia viestejä ei ole","edit":"Muokkaa","cancel":"Peruuta","view_pending":"Tarkastele odottavia viestejä","has_pending_posts":{"one":"\u003cb\u003e1\u003c/b\u003e viesti ketjussa odottaa hyväksyntää","other":"\u003cb\u003e{{count}}\u003c/b\u003e viestiä ketjussa odottaa hyväksyntää"},"confirm":"Tallenna muutokset","delete_prompt":"Haluatko todella poistaa käyttäjän \u003cb\u003e%{username}\u003c/b\u003e? Kaikki hänen kirjoittamansa viestit poistetaan. Lisäksi hänen sähköposti- ja IP-osoitteillensa laitetaan esto.","approval":{"title":"Viesti odottaa hyväksyntää","description":"Viestisi saapui perille, mutta valvojan on vielä hyväksyttävä se, jotta se näkyy sivustolla. Ole kärsivällinen.","pending_posts":{"one":"Sinulla on \u003cstrong\u003e1\u003c/strong\u003e odottava viesti.","other":"Sinulla on \u003cstrong\u003e{{count}}\u003c/strong\u003e odottavaa viestiä."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e kirjoitti \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e kirjoitit \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e vastasi \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e vastasit \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e vastasi \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e vastasit \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mainitsi käyttäjän \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mainitsi \u003ca href='{{user2Url}}'\u003esinut\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eSinä\u003c/a\u003e mainitsit käyttäjän \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Kirjoittaja \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Kirjoittaja \u003ca href='{{userUrl}}'\u003esinä\u003c/a\u003e","sent_by_user":"Lähettäjä \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Lähettäjä \u003ca href='{{userUrl}}'\u003esinä\u003c/a\u003e"},"directory":{"filter_name":"suodata tunnuksen perusteella","title":"Käyttäjät","likes_given":"Annetut","likes_received":"Saadut","topics_entered":"Katsellut","topics_entered_long":"Katseltuja ketjuja","time_read":"Lukuaika","topic_count":"Ketjut","topic_count_long":"Luotuja ketjuja","post_count":"Vastauksia","post_count_long":"Kirjoitettuja vastauksia","no_results":"Ei tuloksia.","days_visited":"Vierailut","days_visited_long":"Päiviä vierailtu","posts_read":"Luetut","posts_read_long":"Luettuja viestejä","total_rows":{"one":"1 käyttäjä","other":"%{count} käyttäjää"}},"groups":{"empty":{"posts":"Ryhmän jäsenet eivät ole kirjoittaneet viestejä.","members":"Kukaan ei kuulu tähän ryhmään.","mentions":"Ryhmää ei ole mainittu.","messages":"Tällä ryhmällä ei ole yksityistä ketjua.","topics":"Ryhmän jäsenet eivät ole aloittaneet ketjuja."},"add":"Lisää","selector_placeholder":"Lisää jäseniä","owner":"omistaja","visible":"Ryhmä näkyy kaikille käyttäjille","index":"Ryhmät","title":{"one":"ryhmä","other":"ryhmät"},"members":"Jäsenet","topics":"Ketjut","posts":"Viestit","mentions":"Viittaukset","messages":"Viestit","alias_levels":{"title":"Ketkä voivat lähettää viestejä tälle ryhmälle tai @viitata siihen?","nobody":"Ei kukaan","only_admins":"Vain ylläpitäjät","mods_and_admins":"Vain ylläpitäjät ja valvojat","members_mods_and_admins":"Vain ryhmän jäsenet, valvojat ja ylläpitäjät","everyone":"Kaikki"},"trust_levels":{"title":"Luottamustaso, joka annetaan automaattisesti lisättäessä tähän ryhmään:","none":"Ei mitään"},"notifications":{"watching":{"title":"Tarkkaillut","description":"Saat ilmoituksen uusista viesteistä jokaisessa viestiketjussa, ja uusien vastausten lukumäärä näytetään."},"watching_first_post":{"title":"Tarkkaile uusia ketjuja","description":"Saat ilmoituksen vain ketjujen ensimmäisistä viesteistä tässä ryhmässä."},"tracking":{"title":"Seurannassa","description":"Saat ilmoituksen, jos joku mainitsee @nimesi tai vastaa sinulle, ja uusien vastausten lukumäärä näytetään."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen, jos joku mainitsee @nimesi tai vastaa sinulle."},"muted":{"title":"Vaimennetut","description":"Et saa ilmoituksia uusista ketjuista tässä ryhmässä."}}},"user_action_groups":{"1":"Annetut tykkäykset","2":"Saadut tykkäykset","3":"Kirjanmerkit","4":"Ketjut","5":"Vastauksia","6":"Vastaukset","7":"Viittaukset","9":"Lainaukset","11":"Muokkaukset","12":"Lähetetyt","13":"Postilaatikko","14":"Odottaa"},"categories":{"all":"kaikki alueet","all_subcategories":"kaikki","no_subcategory":"vain pääalue","category":"Alue","category_list":"Näytä alueet","reorder":{"title":"Järjestä alueet uudelleen","title_long":"Järjestä alueiden lista uudelleen","fix_order":"Kiinteä järjestys","fix_order_tooltip":"Kaikilla alueilla ei ole uniikkia järjestysnumeroa, joka voi aiheuttaa odottamattomia seurauksia.","save":"Tallenna järjestys","apply_all":"Aseta","position":"Paikka"},"posts":"Viestit","topics":"Ketjut","latest":"Tuoreimmat","latest_by":"tuorein","toggle_ordering":"vaihda järjestystä","subcategories":"Tytäralueet","topic_sentence":{"one":"1 ketju","other":"%{count} ketjua"},"topic_stat_sentence":{"one":"%{count} uusi ketju viimeisen %{unit} aikana.","other":"%{count} uutta ketjua viimeisen %{unit} aikana."}},"ip_lookup":{"title":"IP osoitteen haku","hostname":"Isäntänimi","location":"Sijainti","location_not_found":"(tuntematon)","organisation":"Yritys","phone":"Puhelin","other_accounts":"Muut tilit samasta IP osoitteesta:","delete_other_accounts":"Poista %{count}","username":"käyttäjätunnus","trust_level":"LT","read_time":"lukuaika","topics_entered":"katseltuja ketjuja","post_count":"# viestiä","confirm_delete_other_accounts":"Oletko varma, että haluat poistaa nämä tunnukset?"},"user_fields":{"none":"(valitse vaihtoehto)"},"user":{"said":"{{username}}:","profile":"Profiili","mute":"Vaimenna","edit":"Muokkaa asetuksia","download_archive":"Lataa viestini","new_private_message":"Uusi viesti","private_message":"Viesti","private_messages":"Viestit","activity_stream":"Toiminta","preferences":"Asetukset","expand_profile":"Laajenna","bookmarks":"Kirjanmerkit","bio":"Tietoa minusta","invited_by":"Kutsuja","trust_level":"Luottamustaso","notifications":"Ilmoitukset","statistics":"Tilastot","desktop_notifications":{"label":"Työpöytäilmoitukset","not_supported":"Tämä selain ei tue ilmoituksia, pahoittelut.","perm_default":"Näytä ilmoituksia","perm_denied_btn":"Ei oikeuksia","perm_denied_expl":"Olet kieltänyt ilmoitukset. Salli ilmoitukset selaimesi asetuksista.","disable":"Poista ilmoitukset käytöstä","enable":"Näytä ilmoituksia","each_browser_note":"Huom: Sinun täytyy vaihtaa tämä asetus kaikissa selaimista, joita käytät."},"dismiss_notifications":"Unohda kaikki","dismiss_notifications_tooltip":"Merkitse kaikki lukemattomat ilmoitukset luetuiksi","disable_jump_reply":"Älä siirry uuteen viestiini lähetettyäni sen","dynamic_favicon":"Näytä uusien / päivittyneiden ketjujen määrä selaimen ikonissa","external_links_in_new_tab":"Avaa sivuston ulkopuoliset linkit uudessa välilehdessä","enable_quoting":"Ota käyttöön viestin lainaaminen tekstiä valitsemalla","change":"vaihda","moderator":"{{user}} on valvoja","admin":"{{user}} on ylläpitäjä","moderator_tooltip":"Tämä käyttäjä on valvoja","admin_tooltip":"Tämä käyttäjä on ylläpitäjä","blocked_tooltip":"Tämä käyttäjä on estetty","suspended_notice":"Tämä käyttäjätili on hyllytetty {{date}} asti.","suspended_reason":"Syy:","github_profile":"GitHub","email_activity_summary":"Kooste tapahtumista","mailing_list_mode":{"label":"Postituslistatila","enabled":"Ota käyttöön postituslistatila","instructions":"Asetus syrjäyttää koosteet tapahtumista.\u003cbr /\u003e\nVaimennettujen ketjujen ja alueiden viestejä ei sisällytetä sähköposteihin.\n\n","daily":"Lähetä päivittäin","individual":"Lähetä sähköpostia jokaisesta uudesta viestistä","many_per_day":"Lähetä minulle sähköpostia jokaisesta uudesta viestistä (noin {{dailyEmailEstimate}} päivässä)","few_per_day":"Lähetä minulle sähköpostia jokaisesta uudesta viestistä (noin 2 päivässä)"},"tag_settings":"Tunnisteet","watched_tags":"Tarkkailtavat","watched_tags_instructions":"Ketjut joilla on joku näistä tunnisteista asetetaan automaattisesti tarkkailuun. Saat ilmoituksen kaikista uusista viesteistä ja ketjuista, ja uusien viestien lukumäärä näytetään ketjun otsikon vieressä. ","tracked_tags":"Seurattavat","tracked_tags_instructions":"Ketjut, joilla on joku näistä tunnisteista, asetetaan automaattisesti seurantaan. Uusien viestien lukumäärä näytetään ketjun otsikon vieressä. ","muted_tags":"Vaimennettavat","muted_tags_instructions":"Et saa ilmoituksia ketjuista, joilla on joku näistä tunnisteista, eivätkä ne näy tuoreimmissa.","watched_categories":"Tarkkaillut","watched_categories_instructions":"Näiden alueiden kaikki uudet ketjut asetetaan automaattisesti tarkkailuun. Saat ilmoituksen kaikista uusista viesteistä ja ketjuista, ja uusien viestien lukumäärä näytetään ketjun otsikon vieressä. ","tracked_categories":"Seuratut","tracked_categories_instructions":"Näiden alueiden ketjut asetetaan automaattisesti seurantaan. Uusien viestien lukumäärä näytetään ketjun yhteydessä.","watched_first_post_categories":"Tarkkaillaan uusia ketjuja","watched_first_post_categories_instructions":"Saat ilmoituksen näiden alueiden ketjujen ensimmäisistä viesteistä.","watched_first_post_tags":"Tarkkaillaan uusia ketjuja","watched_first_post_tags_instructions":"Saat ilmoituksen uusista ketjuista, joilla on joku näistä tunnisteista.","muted_categories":"Vaimennetut","muted_categories_instructions":"Et saa imoituksia uusista viesteistä näillä alueilla, eivätkä ne näy tuoreimmissa.","delete_account":"Poista tilini","delete_account_confirm":"Oletko varma, että haluat lopullisesti poistaa käyttäjätilisi? Tätä toimintoa ei voi perua!","deleted_yourself":"Käyttäjätilisi on poistettu.","delete_yourself_not_allowed":"Et voi poistaa käyttäjätiliäsi juuti nyt. Sinun tulee pyytää ylläpitäjää poistamaan tilisi.","unread_message_count":"Viestit","admin_delete":"Poista","users":"Käyttäjät","muted_users":"Vaimennetut","muted_users_instructions":"Älä näytä ilmoituksia näiltä käyttäjiltä","muted_topics_link":"Näytä vaimennetut ketjut","watched_topics_link":"Näytä tarkkaillut ketjut","automatically_unpin_topics":"Poista kiinnitetyn ketjun kiinnitys automaattisesti, kun olen selannut sen loppuun.","staff_counters":{"flags_given":"hyödyllistä liputusta","flagged_posts":"liputettuja viestejä","deleted_posts":"poistettua viestiä","suspensions":"hyllytyksiä","warnings_received":"varoituksia"},"messages":{"all":"Kaikki","inbox":"Saapuneet","sent":"Lähetetyt","archive":"Arkisto","groups":"Omat ryhmäni","bulk_select":"Valitse viestejä","move_to_inbox":"Siirrä saapuneisiin","move_to_archive":"Arkisto","failed_to_move":"Viestien siirto epäonnistui (vika saattaa olla internetyhteydessäsi)","select_all":"Valitse kaikki"},"change_password":{"success":"(sähköposti lähetetty)","in_progress":"(lähettää sähköpostia)","error":"(virhe)","action":"Lähetä sähköposti salasanan uusimista varten","set_password":"Aseta salasana"},"change_about":{"title":"Muokkaa kuvaustasi","error":"Arvon muuttamisessa tapahtui virhe."},"change_username":{"title":"Vaihda käyttäjätunnus","confirm":"Jos vaihdat käyttäjätunnustasi, kaikki aiemmat lainaukset viesteistäsi ja @nimen maininnat menevät rikki. Oletko ehdottoman varma, että haluat tehdä näin?","taken":"Pahoittelut, tuo nimi on jo käytössä.","error":"Käyttäjätunnuksen vaihdossa tapahtui virhe.","invalid":"Käyttäjätunnus ei kelpaa. Siinä saa olla ainoastaan numeroita ja kirjaimia."},"change_email":{"title":"Vaihda sähköposti","taken":"Pahoittelut, tämä sähköpostiosoite ei ole saatavilla.","error":"Sähköpostiosoitteen vaihdossa tapahtui virhe. Ehkäpä sama sähköpostiosoite on jo käytössä?","success":"Annettuun osoitteeseen on lähetetty viesti. Seuraa sen ohjeita sähköpostiosoitteen varmentamiseksi."},"change_avatar":{"title":"Vaihda profiilikuvasi","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, osoitteesta","gravatar_title":"Vaihda profiilikuvasi Gravatar-sivustolla","refresh_gravatar_title":"Päivitä Gravatar","letter_based":"Sivuston luoma profiilikuva","uploaded_avatar":"Oma kuva","uploaded_avatar_empty":"Lisää oma kuva","upload_title":"Lataa oma kuva","upload_picture":"Valitse kuva","image_is_not_a_square":"Varoitus: olemme rajanneet kuvaasti; korkeus ja leveys eivät olleet samoja","cache_notice":"Olet onnistuneesti vaihtanut profiilikuvasi, mutta saattaa kestää jonkin aikaa, kunnes se tulee näkyviin"},"change_profile_background":{"title":"Profiilin taustakuva","instructions":"Profiilin taustakuvan leveys on 850 pikseliä."},"change_card_background":{"title":"Käyttäjäkortin taustakuva","instructions":"Taustakuvan leveys on 590 pikseliä."},"email":{"title":"Sähköposti","instructions":"Ei tule julkiseksi","ok":"Lähetämme sinulle sähköpostin varmistukseksi.","invalid":"Ole hyvä ja anna toimiva sähköpostiosoite","authenticated":"{{provider}} on todentanut sähköpostiosoitteesi","frequency_immediately":"Saat sähköpostia välittömästi, jollet ole jo lukenut asiaa, jota sähköpostiviesti koskee.","frequency":{"one":"Lähetämme sähköpostia vain, jos emme ole nähneet sinua edellisen  minuutin aikana.","other":"Lähetämme sähköpostia vain, jos emme ole nähneet sinua edellisen {{count}} minuutin aikana."}},"name":{"title":"Nimi","instructions":"Koko nimesi (valinnainen)","instructions_required":"Koko nimesi","too_short":"Nimesi on liian lyhyt","ok":"Nimesi vaikuttaa hyvältä"},"username":{"title":"Käyttäjätunnus","instructions":"Uniikki, lyhyt, ei välilyöntejä","short_instructions":"Muut käyttäjät voivat viitata sinuun nimellä @{{username}}","available":"Käyttäjätunnus on vapaana","global_match":"Sähköposti vastaa rekisteröityä käyttäjänimeä","global_mismatch":"Nimi on jo käytössä. Kokeile {{suggestion}}?","not_available":"Ei saatavilla. Kokeile {{suggestion}}?","too_short":"Käyttäjätunnus on liian lyhyt","too_long":"Käyttäjätunnus on liian pitkä","checking":"Tarkistetaan käyttäjätunnusta...","enter_email":"Käyttäjänimi löydetty; kirjoita sitä vastaava sähköpostiosoite.","prefilled":"Sähköposti vastaa tätä käyttäjänimeä"},"locale":{"title":"Käyttöliittymän kieli","instructions":"Käyttöliittymän kieli. Kieli vaihtuu sivun uudelleen lataamisen yhteydessä.","default":"(oletus)"},"password_confirmation":{"title":"Salasana uudelleen"},"last_posted":"Viimeisin viesti","last_emailed":"Viimeksi lähetetty sähköpostitse","last_seen":"Nähty","created":"Liittynyt","log_out":"Kirjaudu ulos","location":"Sijainti","card_badge":{"title":"Käyttäjäkortin tunnus"},"website":"Nettisivu","email_settings":"Sähköposti","like_notification_frequency":{"title":"Ilmoita, kun viestistäni tykätään","always":"Aina","first_time_and_daily":"Ensimmäistä kertaa ja päivittäin","first_time":"Ensimmäistä kertaa","never":"Ei koskaan"},"email_previous_replies":{"title":"Liitä aiemmat vastaukset mukaan sähköpostin alaosaan","unless_emailed":"ellei aiemmin lähetetty","always":"aina","never":"ei koskaan"},"email_digests":{"title":"Jos en käy sivustolla, lähetä minulle kooste suosituista ketjuista ja vastauksista","every_30_minutes":"puolen tunnin välein","every_hour":"tunneittain","daily":"päivittäin","every_three_days":"joka kolmas päivä","weekly":"viikottain","every_two_weeks":"joka toinen viikko"},"include_tl0_in_digests":"Sisällytä uusien käyttäjien viestit sähköpostikoosteisiin","email_in_reply_to":"Liitä sähköpostiin lyhennelmä viestistä, johon vastataan","email_direct":"Lähetä minulle sähköposti, jos joku lainaa viestiäni, vastaa viestiini, viittaa @nimeeni, tai kutsuu minut viestiketjuun","email_private_messages":"Lähetä minulle sähköposti, kun joku lähettää minulle viestin","email_always":"Lähetä sähköposti-ilmoitukset, vaikka olen aktiivinen palstalla.","other_settings":"Muut","categories_settings":"Keskustelualueet","new_topic_duration":{"label":"Tulkitse ketju uudeksi, kun","not_viewed":"en ole avannut sitä vielä","last_here":"se on luotu edellisen käyntini jälkeen","after_1_day":"luotu päivän aikana","after_2_days":"luotu 2 päivän aikana","after_1_week":"luotu viikon aikana","after_2_weeks":"luotu 2 viikon aikana"},"auto_track_topics":"Seuraa automaattisesti ketjuja, jotka avaan","auto_track_options":{"never":"ei koskaan","immediately":"heti","after_30_seconds":"30 sekunnin jälkeen","after_1_minute":"1 minuutin jälkeen","after_2_minutes":"2 minuutin jälkeen","after_3_minutes":"3 minuutin jälkeen","after_4_minutes":"4 minuutin jälkeen","after_5_minutes":"5 minuutin jälkeen","after_10_minutes":"10 minuutin jälkeen"},"invited":{"search":"kirjoita etsiäksesi kutsuja...","title":"Kutsut","user":"Kutsuttu käyttäjä","sent":"Lähetetty","none":"Avoimia kutsuja ei ole.","truncated":{"one":"Näytetään ensimmäinen kutsu.","other":"Näytetään ensimmäiset {{count}} kutsua."},"redeemed":"Hyväksytyt kutsut","redeemed_tab":"Hyväksytyt","redeemed_tab_with_count":"Hyväksytyt ({{count}})","redeemed_at":"Hyväksytty","pending":"Odottavat kutsut","pending_tab":"Odottavat","pending_tab_with_count":"Avoimet ({{count}})","topics_entered":"Avatut ketjut","posts_read_count":"Luetut viestit","expired":"Tämä kutsu on rauennut.","rescind":"Poista","rescinded":"Kutsu poistettu","reinvite":"Lähetä kutsu uudestaan","reinvite_all":"Lähetä kaikki kutsut uudestaan","reinvited":"Kutsu lähetetty uudestaan","reinvited_all":"Kaikki kutsut lähetettiin uudestaan","time_read":"Lukuaika","days_visited":"Päiviä vierailtu","account_age_days":"Tilin ikä päivissä","create":"Lähetä kutsu","generate_link":"Kopioi kutsulinkki","generated_link_message":"\u003cp\u003eKutsulinkin kopiointi onnistui!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eKutsulinkki kelpaa vain tällä sähköpostiosoitteella: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Et ole kutsunut vielä ketään. Voit lähettää yksittäisiä kutsuja tai kutsua useita ihmisiä kerralla \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003elähettämällä massakutsun tiedostosta\u003c/a\u003e.","text":"Lähetä massakutsu tiedostosta","uploading":"Lähettää...","success":"Tiedoston lähettäminen onnistui. Saat viestin, kun prosessi on valmis.","error":"Tiedoston '{{filename}}' lähetyksen aikana tapahtui virhe: {{message}}"}},"password":{"title":"Salasana","too_short":"Salasanasi on liian lyhyt.","common":"Annettu salasana on liian yleinen.","same_as_username":"Salasanasi on sama kuin käyttäjätunnuksesi.","same_as_email":"Salasanasi on sama kuin sähköpostisi.","ok":"Salasana vaikuttaa hyvältä.","instructions":"Vähintään %{count} merkkiä."},"summary":{"title":"Yhteenveto","stats":"Tilastot","time_read":"lukenut palstaa","topic_count":{"one":"avattu ketju","other":"luotua ketjua"},"post_count":{"one":"kirjoitettu viesti","other":"kirjoitettua viestiä"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e annettu","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e annettu"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e saatu","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e saatu"},"days_visited":{"one":"päivänä vieraillut","other":"päivänä vieraillut"},"posts_read":{"one":"luettu viesti","other":"luettua viestiä"},"bookmark_count":{"one":"kirjanmerkki","other":"kirjanmerkkiä"},"top_replies":"Parhaat viestit","no_replies":"Ei vastauksia toistaiseksi.","more_replies":"Lisää viestejä","top_topics":"Parhaat ketjut","no_topics":"Ei avattuja ketjuja toistaiseksi.","more_topics":"Lisää ketjuja","top_badges":"Parhaat arvomerkit","no_badges":"Ei arvomerkkejä toistaiseksi.","more_badges":"Lisää arvomerkkejä","top_links":"Suosituimmat linkit","no_links":"Ei linkkejä toistaiseksi.","most_liked_by":"Eniten tykkäyksiä saatu","most_liked_users":"Eniten tykkäyksiä annettu","most_replied_to_users":"Useiten vastannut","no_likes":"Ei tykkäyksiä toistaiseksi."},"associated_accounts":"Kirjautumiset","ip_address":{"title":"Viimeinen IP-osoite"},"registration_ip_address":{"title":"IP osoite rekisteröityessä"},"avatar":{"title":"Profiilikuva","header_title":"profiili, viestit, kirjanmerkit ja asetukset"},"title":{"title":"Otsikko"},"filters":{"all":"Kaikki"},"stream":{"posted_by":"Viestin kirjoittaja","sent_by":"Lähettänyt","private_message":"viesti","the_topic":"ketju"}},"loading":"Lataa...","errors":{"prev_page":"yrittäessä ladata","reasons":{"network":"Verkkovirhe","server":"Palvelinvirhe","forbidden":"Pääsy estetty","unknown":"Virhe","not_found":"Sivua ei löytynyt"},"desc":{"network":"Tarkasta internetyhteytesi.","network_fixed":"Näyttäisi palanneen takaisin.","server":"Virhekoodi: {{status}}","forbidden":"Sinulla ei ole oikeutta katsoa tätä.","not_found":"Hups, ohjelma yritti ladata osoitteen, jota ei ole olemassa","unknown":"Jotain meni pieleen."},"buttons":{"back":"Mene takaisin","again":"Yritä uudestaan","fixed":"Lataa sivu"}},"close":"Sulje","assets_changed_confirm":"Sivustolla on tehty päivityksiä. Ladataanko uudelleen?","logout":"Sinut kirjattiin ulos.","refresh":"Lataa sivu uudelleen","read_only_mode":{"enabled":"Sivusto on vain luku -tilassa. Voit jatkaa selailua, mutta vastaaminen, tykkääminen ja muita toimintoja on toistaiseksi poissa käytöstä.","login_disabled":"Et voi kirjautua sisään, kun sivusto on vain luku -tilassa.","logout_disabled":"Et voi kirjautua ulos, kun sivusto on vain luku -tilassa."},"too_few_topics_and_posts_notice":"Laitetaanpa \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ekeskustelu alulle!\u003c/a\u003e Tällä hetkellä palstalla on \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e ketjua ja \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e viestiä. Uusia kävijöitä varten tarvitaan keskusteluita, joita voivat lukea ja joihin vastata.","too_few_topics_notice":"Laitetaanpa \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ekeskustelu alulle!\u003c/a\u003e Tällä hetkellä palstalla on \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e ketjua. Uusia kävijöitä varten tarvitaan keskusteluita, joita voivat lukea ja joihin vastata.","too_few_posts_notice":"Laitetaanpa \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ekeskustelu alulle!\u003c/a\u003e Tällä hetkellä palstalla on \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e viestiä. Uusia kävijöitä varten tarvitaan keskusteluita, joita voivat lukea ja joihin vastata.","logs_error_rate_notice":{"rate":{"one":"1 virhe/%{duration}","other":"%{count} virhettä/%{duration}"}},"learn_more":"opi lisää...","year":"vuosi","year_desc":"viimeisen 365 päivän aikana luodut ketjut","month":"kuukausi","month_desc":"viimeisen 30 päivän aikana luodut ketjut","week":"viikko","week_desc":"viimeisen 7 päivän aikana luodut ketjut","day":"päivä","first_post":"Ensimmäinen viesti","mute":"Vaienna","unmute":"Poista vaimennus","last_post":"Viimeisin viesti","last_reply_lowercase":"edellinen vastaus","replies_lowercase":{"one":"vastaus","other":"vastauksia"},"signup_cta":{"sign_up":"Luo tili","hide_session":"Muistuta huomenna","hide_forever":"ei kiitos","hidden_for_session":"OK, kysyn huomenna uudestaan. Voit aina myös käyttää 'Kirjaudu sisään' -linkkiä luodaksesi tilin.","intro":"Hei siellä! :heart_eyes: Vaikuttaa siltä, että olet pitänyt keskusteluista, mutta et ole luonut omaa tiliä.","value_prop":"Kun luot tilin, muistamme mitä olet lukenut, jotta voit aina palata keskusteluissa takaisin oikeaan kohtaan. Saat myös ilmoituksia, täällä tai sähköpostilla, kun uusia viestejä kirjoitetaan. Voit myös tykätä viesteistä. :heartbeat:"},"summary":{"enabled_description":"Tarkastelet tiivistelmää tästä ketjusta, sen mielenkiintoisimpia viestejä käyttäjien toiminnan perusteella.","description":"Vastauksia on \u003cb\u003e{{replyCount}}\u003c/b\u003e kpl.","description_time":"Vastauksia on \u003cb\u003e{{replyCount}}\u003c/b\u003e. Niiden lukemiseen menee arviolta \u003cb\u003e{{readingTime}} minuuttia\u003c/b\u003e.","enable":"Näytä ketjun tiivistelmä","disable":"Näytä kaikki viestit"},"deleted_filter":{"enabled_description":"Tämä ketju sisältää poistettuja viestejä, jotka on piilotettu.","disabled_description":"Näytetään myös poistetut viestit.","enable":"Piilota poistetut viestit","disable":"Näytä poistetut viestit"},"private_message_info":{"title":"Viesti","invite":"Kutsu muita...","remove_allowed_user":"Haluatko varmasti poistaa käyttäjän {{name}} tästä keskustelusta?","remove_allowed_group":"Haluatko varmasti poistaa käyttäjän {{name}} tästä viestiketjusta?"},"email":"Sähköposti","username":"Käyttäjätunnus","last_seen":"Nähty","created":"Luotu","created_lowercase":"luotu","trust_level":"Luottamustaso","search_hint":"käyttäjätunnus, sähköposti tai IP-osoite","create_account":{"title":"Luo uusi tunnus","failed":"Jotain meni pieleen. Ehkäpä tämä sähköpostiosoite on jo rekisteröity, kokeile salasana unohtui -linkkiä."},"forgot_password":{"title":"Salasanan uusiminen","action":"Unohdin salasanani","invite":"Syötä käyttäjätunnuksesi tai sähköpostiosoitteesi, niin lähetämme sinulle salasanan uusimisviestin.","reset":"Uusi salasana","complete_username":"Jos käyttäjätunnusta \u003cb\u003e%{username}\u003c/b\u003e vastaava tili löytyy, saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_email":"Jos sähköpostiosoitetta \u003cb\u003e%{email}\u003c/b\u003e vastaava tili löytyy, saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_username_found":"Käyttäjätunnusta \u003cb\u003e%{username}\u003c/b\u003e vastaava tili löytyi. Saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_email_found":"Sähköpostiosoitetta \u003cb\u003e%{email}\u003c/b\u003e vastaava tili löytyi. Saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_username_not_found":"Käyttäjänimeä \u003cb\u003e%{username}\u003c/b\u003e ei ole rekisteröity","complete_email_not_found":"Sähköpostiosoitetta \u003cb\u003e%{email}\u003c/b\u003e vastaavaa tiliä ei ole"},"login":{"title":"Kirjaudu","username":"Käyttäjä","password":"Salasana","email_placeholder":"sähköposti tai käyttäjätunnus","caps_lock_warning":"Caps Lock on päällä","error":"Tuntematon virhe","rate_limit":"Ole hyvä ja odota hetki ennen kuin yrität kirjautua uudelleen.","blank_username_or_password":"Kirjoita sähköpostiosoite tai käyttäjänimi ja salasana.","reset_password":"Uusi salasana","logging_in":"Kirjaudutaan...","or":"Tai","authenticating":"Autentikoidaan...","awaiting_confirmation":"Käyttäjätilisi odottaa vahvistusta. Käytä salasana unohtui -linkkiä lähettääksesi uuden vahvistusviestin.","awaiting_approval":"Henkilökunta ei ole vielä hyväksynyt käyttäjätiliäsi. Saat sähköpostiviestin, kun tunnuksesi on hyväksytty.","requires_invite":"Pahoittelut, tämä palsta on vain kutsutuille käyttäjille.","not_activated":"Et voi vielä kirjautua sisään. Lähetimme aiemmin vahvistusviestin osoitteeseen \u003cb\u003e{{sentTo}}\u003c/b\u003e. Seuraa viestin ohjeita ottaaksesi tunnuksen käyttöön.","not_allowed_from_ip_address":"Kirjautuminen estetty tästä IP-osoitteesta.","admin_not_allowed_from_ip_address":"Et voi kirjautua ylläpitäjänä tästä IP-osoitteesta.","resend_activation_email":"Klikkaa tästä lähettääksesi vahvistusviestin uudelleen.","sent_activation_email_again":"Lähetimme uuden vahvistusviestin sinulle osoitteeseen \u003cb\u003e{{sentTo}}\u003c/b\u003e. Viestin saapumisessa voi kestää muutama minuutti, muista tarkastaa myös roskapostikansio.","to_continue":"Ole hyvä ja kirjaudu sisään","preferences":"Sinun täytyy olla kirjautuneena sisään muokataksesi tilisi asetuksia","forgot":"En muista käyttäjätilini tietoja","google":{"title":"Googlella","message":"Todennetaan Googlen kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"google_oauth2":{"title":"Googlella","message":"Todennetaan Googlen kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"twitter":{"title":"Twitterillä","message":"Todennetaan Twitterin kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"instagram":{"title":"Instagramilla","message":"Todennetaan Instagramin kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"facebook":{"title":"Facebookilla","message":"Todennetaan Facebookin kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"yahoo":{"title":"Yahoolla","message":"Todennetaan Yahoon kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"github":{"title":"GitHubilla","message":"Todennetaan Githubin kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"}},"emoji_set":{"apple_international":"Apple/Kansainvälinen","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"lisää...","options":"Asetukset","whisper":"kuiskaus","unlist":"listaamaton","add_warning":"Tämä on virallinen varoitus.","toggle_whisper":"Vaihda kuiskaus","toggle_unlisted":"Listauksissa näkyminen","posting_not_on_topic":"Mihin ketjuun haluat vastata?","saving_draft_tip":"tallennetaan...","saved_draft_tip":"tallennettu","saved_local_draft_tip":"tallennettu omalla koneella","similar_topics":"Tämä ketju vaikuttaa samalta kuin..","drafts_offline":"offline luonnokset","duplicate_link":"Näyttää siltä, että \u003cb\u003e@{{username}}\u003c/b\u003e on jo lähettänyt saman linkin kohteeseen \u003cb\u003e{{domain}}\u003c/b\u003e ketjun \u003ca href='{{post_url}}'\u003eaiemmassa viestissä {{ago}}\u003c/a\u003e – oletko varma, että haluat lähettää sen uudestaan?","error":{"title_missing":"Otsikko on pakollinen","title_too_short":"Otsikon täytyy olla vähintään {{min}} merkkiä pitkä","title_too_long":"Otsikko voi olla korkeintaan {{max}} merkkiä pitkä","post_missing":"Viesti ei voi olla tyhjä","post_length":"Viestissä täytyy olla vähintään {{min}} merkkiä","try_like":"Oletko jo kokeillut \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e-nappia?","category_missing":"Sinun täytyy valita viestille alue"},"save_edit":"Tallenna muokkaus","reply_original":"Vastaa alkuperäiseen ketjuun","reply_here":"Vastaa tänne","reply":"Vastaa","cancel":"Peruuta","create_topic":"Luo ketju","create_pm":"Viesti","title":"Tai paina Ctrl+Enter","users_placeholder":"Lisää käyttäjä","title_placeholder":"Kuvaile lyhyesti mistä tässä ketjussa on kyse?","edit_reason_placeholder":"miksi muokkaat viestiä?","show_edit_reason":"(lisää syy muokkaukselle)","reply_placeholder":"Kirjoita tähän. Käytä Markdownia, BBCodea tai HTML:ää muotoiluun. Raahaa tai liitä kuvia.","view_new_post":"Katsele uutta viestiäsi.","saving":"Tallennetaan","saved":"Tallennettu!","saved_draft":"Viestiluonnos kesken. Klikkaa tähän jatkaaksesi.","uploading":"Lähettää...","show_preview":"näytä esikatselu \u0026raquo;","hide_preview":"\u0026laquo; piilota esikatselu","quote_post_title":"Lainaa koko viesti","bold_title":"Lihavoitu","bold_text":"lihavoitu teksti","italic_title":"Kursiivi","italic_text":"kursivoitu teksti","link_title":"Hyperlinkki","link_description":"kirjoita linkin kuvaus tähän","link_dialog_title":"Lisää linkki","link_optional_text":"vaihtoehtoinen kuvaus","link_url_placeholder":"http://example.com","quote_title":"Lainaus","quote_text":"Lainaus","code_title":"Teksti ilman muotoiluja","code_text":"Sisennä teksti neljällä välilyönnillä poistaaksesi automaattisen muotoilun","paste_code_text":"kirjoita tai liitä koodia tähän","upload_title":"Lähetä","upload_description":"kirjoita ladatun tiedoston kuvaus tähän","olist_title":"Numeroitu lista","ulist_title":"Luettelomerkillinen luettelo","list_item":"Listan alkio","heading_title":"Otsikko","heading_text":"Otsikko","hr_title":"Vaakaviiva","help":"Markdown apu","toggler":"näytä tai piilota kirjoitusalue","modal_ok":"OK","modal_cancel":"Peruuta","cant_send_pm":"Et voi lähettää viestiä käyttäjälle  %{username}.","yourself_confirm":{"title":"Unohditko lisätä vastaanottajia?","body":"Olet lähettämässä viestiä vain itsellesi!"},"admin_options_title":"Tämän ketjun vain henkilökunnalle näytettävät asetukset","auto_close":{"label":"Sulje ketju automaattisesti tämän ajan jälkeen:","error":"Ole hyvä ja syötä kelpaava arvo.","based_on_last_post":"Älä sulje ennen kuin viimeisin viesti ketjussa on vähintään näin vanha.","all":{"examples":"Syötä aika tunteina (24), absoluuttisena aikana (17:30) tai aikaleimana (2013-11-22 14:00)."},"limited":{"units":"(# tuntia)","examples":"Syötä aika tunteina (24)."}}},"notifications":{"title":"ilmoitukset @nimeen viittauksista, vastauksista omiin viesteihin ja ketjuihin, viesteistä ym.","none":"Ilmoitusten lataaminen ei onnistunut.","empty":"Ilmoituksia ei löydetty.","more":"vanhat ilmoitukset","total_flagged":"yhteensä liputettuja viestejä","mentioned":"\u003ci title='viittasi' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='lainasi' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='vastasi' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='kirjoitti' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='muokkasi' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='tykkäsi' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='tykkäsi' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='tykkäsi' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} ja 1 muu\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='tykkäsi' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} ja {{count}} muuta\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='yksityisviesti' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='yksityisviesti' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='kutsui ketjuun' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='hyväksyi kutsusi' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e hyväksyi kutsusi\u003c/p\u003e","moved_post":"\u003ci title='siirsi viestin' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e siirsi {{description}}\u003c/p\u003e","linked":"\u003ci title='linkkasi viestiin' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='arvomerkki myönnetty' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eAnsaitsit '{{description}}'\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eUusi ketju\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} viesti ryhmän {{group_name}} saapuneissa\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} viestiä ryhmän {{group_name}} saapuneissa\u003c/p\u003e"},"alt":{"mentioned":"Viittaaja","quoted":"Lainaaja","replied":"Vastasi","posted":"Kirjoittaja","edited":"Viestieäsi muokkasi","liked":"Viestistäsi tykkäsi","private_message":"Yksityisviesti lähettäjältä","invited_to_private_message":"Kutsu yksityisviestiin käyttäjältä","invited_to_topic":"Kutsu ketjuun käyttäjältä","invitee_accepted":"Kutsun hyväksyi","moved_post":"Viestisi siirsi","linked":"Linkki viestiisi","granted_badge":"Arvomerkki myönnetty","group_message_summary":"Viestejä ryhmän saapuneissa viesteissä."},"popup":{"mentioned":"{{username}} mainitsi sinut ketjussa \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} mainitsi sinut ketjussa \"{{topic}}\" - {{site_title}}","quoted":"{{username}} lainasi sinua ketjussa \"{{topic}}\" - {{site_title}}","replied":"{{username}} vastasi sinulle ketjussa \"{{topic}}\" - {{site_title}}","posted":"{{username}} vastasi ketjuun \"{{topic}}\" - {{site_title}}","private_message":"{{username}} lähetti sinulle yksityisviestin ketjussa \"{{topic}}\" - {{site_title}}","linked":"{{username}} linkitti viestiisi ketjusta \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Lisää kuva","title_with_attachments":"Lisää kuva tai tiedosto","from_my_computer":"Tästä laitteesta","from_the_web":"Netistä","remote_tip":"linkki kuvaan","remote_tip_with_attachments":"linkki kuvaan tai tiedostoon {{authorized_extensions}}","local_tip":"valitse kuvia laitteeltasi","local_tip_with_attachments":"valitse kuvia tai tiedostoja laitteeltasi {{authorized_extensions}}","hint":"(voit myös raahata ne editoriin ladataksesi ne sivustolle)","hint_for_supported_browsers":"voit myös raahata tai liittää kuvia editoriin","uploading":"Lähettää","select_file":"Valitse tiedosto","image_link":"linkki, johon kuvasi osoittaa"},"search":{"sort_by":"Järjestä","relevance":"Osuvuus","latest_post":"Uusin viesti","most_viewed":"Katselluin","most_liked":"Tykätyin","select_all":"Valitse kaikki","clear_all":"Tyhjennä kaikki","too_short":"Hakusana on liian lyhyt.","result_count":{"one":"1 tulos haulle \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} tulosta haulle \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"etsi ketjuja, viestejä, käyttäjiä tai alueita","no_results":"Ei tuloksia.","no_more_results":"Enempää tuloksia ei löytynyt.","search_help":"Haun ohje","searching":"Etsitään ...","post_format":"#{{post_number}} käyttäjältä {{username}}","context":{"user":"Etsi @{{username}} viestejä","category":"Etsi alueelta #{{category}}","topic":"Etsi tästä ketjusta","private_messages":"Etsi viesteistä"}},"hamburger_menu":"vaihda ketjulistausta tai siirry toiselle alueelle","new_item":"uusi","go_back":"mene takaisin","not_logged_in_user":"käyttäjäsivu, jossa on tiivistelmä käyttäjän viimeaikaisesta toiminnasta sekä käyttäjäasetukset","current_user":"siirry omalle käyttäjäsivullesi","topics":{"bulk":{"unlist_topics":"Poista ketjuja listauksista","reset_read":"Palauta lukutila","delete":"Poista ketjut","dismiss":"Unohda","dismiss_read":"Unohda lukemattomat","dismiss_button":"Unohda...","dismiss_tooltip":"Unohda uudet viestit tai lopeta ketjujen seuraaminen","also_dismiss_topics":"Älä seuraa näitä ketjuja enää - ne eivät jatkossa näy Lukematta-välilehdellä","dismiss_new":"Unohda uudet","toggle":"Vaihda useamman ketjun valintaa","actions":"Massatoiminnot","change_category":"Vaihda aluetta","close_topics":"Sulje ketjut","archive_topics":"Arkistoi ketjut","notification_level":"Vaihda ilmoitusasetusta","choose_new_category":"Valitse uusi alue ketjuille:","selected":{"one":"Olet valinnut \u003cb\u003eyhden\u003c/b\u003e ketjun.","other":"Olet valinnut \u003cb\u003e{{count}}\u003c/b\u003e ketjua."},"change_tags":"Muuta tunnisteita","choose_new_tags":"Valitse tunnisteet näille ketjuille:","changed_tags":"Ketjujen tunnisteet muutettiin."},"none":{"unread":"Sinulla ei ole ketjuja lukematta.","new":"Sinulla ei ole uusia ketjuja.","read":"Et ole lukenut vielä yhtään yhtään ketjua.","posted":"Et ole kirjoittanut vielä yhteenkään ketjuun.","latest":"Tuoreimpia ketjuja ei ole. Onpa harmi.","hot":"Kuumia ketjuja ei ole.","bookmarks":"Et ole vielä merkinnyt kirjanmerkkejä.","category":"Alueella {{category}} ei ole ketjua.","top":"Huippuketjuja ei ole.","search":"Hakutuloksia ei löytynyt.","educate":{"new":"\u003cp\u003eUuden ketjut näytetään tässä.\u003c/p\u003e\u003cp\u003eKetjut tulkitaan uusiksi ja niiden yhteydessä näytetään \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003euusi\u003c/span\u003e-merkki, kun ne on luotu edellisen kahden päivän aikana.\u003c/p\u003e\u003cp\u003eVoit muuttaa tätä \u003ca href=\"%{userPrefsUrl}\"\u003ekäyttäjäasetuksistasi\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eLukemattomia viestejä sisältävät ketjut näytetään tässä.\u003c/p\u003e\u003cp\u003eKetjun yhteydessä näytetään lukemattomien viestien lukumäärä \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e jos olet:\u003c/p\u003e\u003cul\u003e\u003cli\u003eluonut ketjun\u003c/li\u003e\u003cli\u003evastannut ketjuun\u003c/li\u003e\u003cli\u003elukenut ketjua pidempään, kuin 4 minuuttia\u003c/li\u003e\u003c/ul\u003e\u003cp\u003etai, jos olet erikseen merkannut ketjun seurattavaksi tai tarkkailtavaksi ketjun lopusta löytyvästä painikkeesta.\u003c/p\u003e\u003cp\u003eVoit muuttaa tätä \u003ca href=\"%{userPrefsUrl}\"\u003ekäyttäjäasetuksistasi\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Tuoreimpia ketjuja ei ole enempää.","hot":"Kuumia ketjuja ei ole enempää.","posted":"Ketjuja, joihin olet kirjoittanut ei ole enempää.","read":"Luettuja ketjuja ei ole enempää.","new":"Uusia ketjuja ei ole enempää.","unread":"Ketjuja ei ole enempää lukematta.","category":"Alueen {{category}} ketjuja ei ole enempää.","top":"Huippuketjuja ei ole enempää.","bookmarks":"Merkattuja ketjuja ei ole enempää.","search":"Hakutuloksia ei ole enempää."}},"topic":{"unsubscribe":{"stop_notifications":"Saat tästä lähtien vähemmän ilmoituksia aiheesta \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Nykyinen ilmoitusasetuksesti on"},"create":"Uusi ketju","create_long":"Luo uusi ketju","private_message":"Luo viesti","archive_message":{"help":"Siirrä viesti arkistoosi","title":"Arkistoi"},"move_to_inbox":{"title":"Siirrä saapuneisiin","help":"Siirrä takaisin saapuneisiin."},"list":"Ketjut","new":"uusi ketju","unread":"lukematta","new_topics":{"one":"1 uusi ketju","other":"{{count}} uutta ketjua"},"unread_topics":{"one":"1 ketju lukematta","other":"{{count}} ketjua lukematta"},"title":"Aihe","invalid_access":{"title":"Tämä ketju on yksityinen","description":"Pahoittelut, sinulla ei ole pääsyä tähän ketjuun!","login_required":"Sinun täytyy kirjautua sisään nähdäksesi tämän ketjun."},"server_error":{"title":"Ketjun lataaminen epäonnistui","description":"Pahoittelut, ketjun lataaminen epäonnistui. Kyse saattaa olla yhteysongelmasta. Kokeile sivun lataamista uudestaan ja jos ongelma jatkuu, ota yhteyttä."},"not_found":{"title":"Ketjua ei löytynyt","description":"Pahoittelut, ketjua ei löytynyt. Ehkäpä valvoja on siirtänyt sen muualle?"},"total_unread_posts":{"one":"sinulla on 1 lukematon viesti tässä ketjussa","other":"sinulla on {{count}} lukematonta viestiä tässä ketjussa"},"unread_posts":{"one":"yksi vanha viesti on lukematta tässä ketjussa","other":"{{count}} vanhaa viestiä on lukematta tässä ketjussa"},"new_posts":{"one":"tähän ketjuun on tullut yksi uusi viesti sen jälkeen, kun edellisen kerran luit sen","other":"tähän ketjuun on tullut {{count}} uutta viestiä sen jälkeen, kun edellisen kerran luit sen"},"likes":{"one":"tässä ketjussa on yksi tykkäys","other":"tässä ketjussa on {{count}} tykkäystä"},"back_to_list":"Takaisin ketjulistaan","options":"Ketjun asetukset","show_links":"näytä tämän ketjun linkit","toggle_information":"näytä/kätke ketjun tiedot","read_more_in_category":"Haluatko lukea lisää? Selaile muita alueen {{catLink}} ketjuja tai {{latestLink}}.","read_more":"Haluatko lukea lisää? Selaa aluetta {{catLink}} tai katsele {{latestLink}}.","browse_all_categories":"Selaa keskustelualueita","view_latest_topics":"tuoreimpia ketjuja","suggest_create_topic":"Jospa aloittaisit uuden ketjun?","jump_reply_up":"hyppää aiempaan vastaukseen","jump_reply_down":"hyppää myöhempään vastaukseen","deleted":"Tämä ketju on poistettu","auto_close_notice":"Tämä ketju sulkeutuu automaattisesti %{timeLeft}.","auto_close_notice_based_on_last_post":"Tämä ketju suljetaan %{duration} kuluttua viimeisimmästä viestistä.","auto_close_title":"Automaattisen sulkemisen asetukset","auto_close_save":"Tallenna","auto_close_remove":"Älä sulje tätä ketjua automaattisesti","timeline":{"back":"Takaisin","back_description":"Siirry takaisin viimeisimpään lukemattomaan viestiin","replies_short":"%{current} / %{total}"},"progress":{"title":"ketjun edistyminen","go_top":"alkuun","go_bottom":"loppuun","go":"siirry","jump_bottom":"hyppää viimeisimpään viestiin","jump_prompt":"hyppää viestiin","jump_prompt_long":"Mihin viestiin haluat siirtyä?","jump_bottom_with_number":"hyppää viestiin %{post_number}","total":"yhteensä viestejä","current":"tämänhetkinen viesti"},"notifications":{"title":"muuta sitä, kuinka usein saat muistutuksia tästä ketjusta","reasons":{"mailing_list_mode":"Olet postituslistatilassa, joten saat sähköpostia tähän ketjuun lähetyistä vastauksista.","3_10":"Saat ilmoituksia, koska tarkkailet tähän ketjuun liittyvää tunnistetta.","3_6":"Saat ilmoituksia, koska olet asettanut tämän alueen tarkkailuun.","3_5":"Saat ilmoituksia, koska ketju on asetettu tarkkailuun automaattisesti.","3_2":"Saat ilmoituksia, koska olet asettanut ketjun tarkkailuun.","3_1":"Saat ilmoituksia, koska loit tämän ketjun.","3":"Saat ilmoituksia, koska olet asettanut ketjun tarkkailuun.","2_8":"Saat ilmoituksia, koska olet asettanut tämän alueen seurantaan.","2_4":"Saat ilmoituksia, koska olet kirjoittanut ketjuun.","2_2":"Saat ilmoituksia, koska olet asettanut ketjun seurantaan.","2":"Saat ilmoituksia, koska \u003ca href=\"/users/{{username}}/preferences\"\u003eluit ketjua aiemmin\u003c/a\u003e.","1_2":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle.","1":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle.","0_7":"Et saa mitään ilmoituksia tältä alueelta.","0_2":"Et saa mitään ilmoituksia tästä ketjusta.","0":"Et saa mitään ilmoituksia tästä ketjusta."},"watching_pm":{"title":"Tarkkaile","description":"Saat ilmoituksen kaikista uusista vastauksista tässä viestiketjussa ja uusien vastausten lukumäärä näytetään."},"watching":{"title":"Tarkkaile","description":"Saat ilmoituksen kaikista uusista vastauksista tässä viestiketjussa ja uusien vastausten lukumäärä näytetään."},"tracking_pm":{"title":"Seuraa","description":"Tälle ketjulle näytetään uusien vastausten lukumäärä. Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"tracking":{"title":"Seuraa","description":"Tälle ketjulle näytetään uusien vastausten lukumäärä. Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"regular_pm":{"title":"Tavallinen","description":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"muted_pm":{"title":"Vaimenna","description":"Et saa mitään ilmoituksia tästä keskustelusta."},"muted":{"title":"Vaimenna","description":"Et saa ilmoituksia mistään tässä ketjussa, eikä se näy tuoreimmissa."}},"actions":{"recover":"Peru ketjun poisto","delete":"Poista ketju","open":"Avaa ketju","close":"Sulje ketju","multi_select":"Valitse viestejä...","auto_close":"Sulje automaattisesti...","pin":"Kiinnitä ketju...","unpin":"Poista ketjun kiinnitys...","unarchive":"Poista ketjun arkistointi","archive":"Arkistoi ketju","invisible":"Poista listauksista","visible":"Näytä listauksissa","reset_read":"Poista tieto lukemisista","make_public":"Tee ketjusta julkinen","make_private":"Tee ketjusta yksityinen"},"feature":{"pin":"Kiinnitä ketju","unpin":"Poista ketjun kiinnitys","pin_globally":"Kiinnitä ketju koko palstalle","make_banner":"Tee ketjusta banneri","remove_banner":"Poista banneri"},"reply":{"title":"Vastaa","help":"aloita kirjottamaan uutta vastausta tähän ketjuun"},"clear_pin":{"title":"Poista kiinnitys","help":"Poista kiinnitys, jotta ketju ei enää pysy listauksen ylimpänä"},"share":{"title":"Jaa","help":"jaa linkki tähän ketjuun"},"flag_topic":{"title":"Liputa","help":"liputa tämä ketju tai lähetä siitä yksityinen ilmoitus valvojalle","success_message":"Ketjun liputus onnistui."},"feature_topic":{"title":"Nosta tämä ketju","pin":"Kiinnitä tämä ketju alueen  {{categoryLink}} ylimmäiseksi kunnes","confirm_pin":"Olet kiinnittänyt jo {{count}} ketjua. Liian monta kiinnitettyä ketjua voi olla liian suuri taakka uusille ja kirjautumattomille käyttäjille. Oletko varma, että haluat kiinnittä vielä uuden ketjun tällä alueella?","unpin":"Älä enää pidä tätä ketjua {{categoryLink}}-aluen ylimmäisenä.","unpin_until":"Poista nyt tämän ketjun kiinnitys alueen {{categoryLink}} ylimmäisenä, tai odota kunnes \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Käyttäjät voivat poistaa ketjun kiinnityksen itseltään.","pin_validation":"Päivämäärä vaaditaan kiinnittämään tämä ketju","not_pinned":"Alueella {{categoryLink}} ei ole kiinnitettyjä ketjuja.","already_pinned":{"one":"Kiinnitettyjä ketjuja alueella {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Alueelle {{categoryLink}} kiinnitettyjä ketjuja: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Kiinnitä tämä ketju kaikkien alueiden ylimmäiseksi, kunnes","confirm_pin_globally":"Olet kiinnittänyt jo {{count}} ketjua kaikille alueille. Liian monta kiinnitettyä ketjua voi olla liian suuri taakka uusille ja kirjautumattomille käyttäjille. Oletko varma, että haluat kiinnittä vielä uuden ketjun kaikille alueille?","unpin_globally":"Älä enää pidä tätä ketjua kaikkien alueiden ylimmäisenä.","unpin_globally_until":"Poista nyt tämän ketjun kiinnitys kaikkien alueiden ylimmäisenä, tai odota kunnes \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Käyttäjät voivat poistaa ketjun kiinnityksen itseltään.","not_pinned_globally":"Yhtään ketjua ei ole kiinnitetty koko palstalle.","already_pinned_globally":{"one":"Koko palstalle kiinnitettyjä ketjuja: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Koko palstalle kiinnitettyjä ketjuja: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Tee tästä ketjusta banneri, joka näytetään kaikkien sivujen ylimmäisenä.","remove_banner":"Poista banneri, joka näytetään kaikkien sivujen ylimmäisenä.","banner_note":"Käyttäjät voivat piilottaa bannerin sulkemalla sen. Vain yksi ketju kerrallaan voi olla banneri.","no_banner_exists":"Banneriketjua ei ole määritelty.","banner_exists":"Banneriketju \u003cstrong class='badge badge-notification unread'\u003eon\u003c/strong\u003e määritelty."},"inviting":"Kutsutaan...","automatically_add_to_groups":"Tämä kutsu sisältää myös pääsyn näihin ryhmiin:","invite_private":{"title":"Kutsu keskusteluun","email_or_username":"Kutsuttavan sähköpostiosoite tai käyttäjänimi","email_or_username_placeholder":"sähköpostiosoite tai käyttäjänimi","action":"Kutsu","success":"Käyttäjä on kutsuttu osallistumaan tähän yksityiseen keskusteluun.","success_group":"Ryhmä on kutsuttu osallistumaan tähän yksityiseen keskusteluun.","error":"Pahoittelut, kutsuttaessa tapahtui virhe.","group_name":"ryhmän nimi"},"controls":"Ketjun hallinta","invite_reply":{"title":"Kutsu","username_placeholder":"käyttäjätunnus","action":"Lähetä kutsu","help":"Kutsu muita tähän ketjuun sähköpostin tai palstan ilmoitusten kautta","to_forum":"Lähetämme lyhyen sähköpostin jonka avulla ystäväsi voi liittyä klikkaamalla linkkiä, sisäänkirjautumista ei tarvita.","sso_enabled":"Syötä henkilön käyttäjätunnus, jonka haluaisit kutsua tähän ketjuun.","to_topic_blank":"Syötä henkilön käyttäjätunnus tai sähköpostiosoite, jonka haluaisit kutsua tähän ketjuun.","to_topic_email":"Syötit sähköpostiosoitteen. Lähetämme ystävällesi sähköpostin, jonka avulla hän voi heti vastata tähän ketjuun.","to_topic_username":"Annoit käyttäjänimen. Lähetämme hänelle ilmoituksen, jossa on linkki ja kutsu tähän ketjuun.","to_username":"Kirjoita henkilön käyttäjänimi, jonka haluat kutsua. Lähetämme hänelle ilmoituksen, jossa on linkki ja kutsu tähän ketjuun.","email_placeholder":"nimi@esimerkki.fi","success_email":"Olemme lähettäneet kutsun osoitteeseen \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Ilmoitamme, kun kutsuun on vastattu. Voit seurata käyttäjäsivusi kutsut-välilehdeltä kutsujesi tilannetta.","success_username":"Olemme kutsuneet käyttäjän osallistumaan tähän ketjuun.","error":"Pahoittelut, emme onnistuneet kutsumaan tätä henkilöä. Ehkäpä hänet on jo kutsuttu? (Huomaa, että kutsumistiheyttä rajoitetaan)"},"login_reply":"Kirjaudu sisään vastataksesi","filters":{"n_posts":{"one":"1 viesti","other":"{{count}} viestiä"},"cancel":"Poista suodatin"},"split_topic":{"title":"Siirrä uuteen ketjuun","action":"siirrä uuteen ketjuun","topic_name":"Uuden ketjun otsikko","error":"Viestien siirtämisessä uuteen ketjuun tapahtui virhe.","instructions":{"one":"Olet luomassa uutta ketjua valitsemastasi viestistä.","other":"Olet luomassa uutta ketjua valitsemistasi \u003cb\u003e{{count}}\u003c/b\u003e viestistä."}},"merge_topic":{"title":"Siirrä olemassa olevaan ketjuun","action":"siirrä olemassa olevaan ketjuun","error":"Viestien siirtämisessä ketjuun tapahtui virhe.","instructions":{"one":"Valitse ketju, johon haluat siirtää viestin.","other":"Valitse ketju, johon haluat siirtää\u003cb\u003e{{count}}\u003c/b\u003e viestiä."}},"merge_posts":{"title":"Yhdistä valitut viestit","action":"yhdistä valitut viestit","error":"Valittuja viestejä yhdistettäessä tapahtui virhe."},"change_owner":{"title":"Vaihda viestin omistajaa","action":"muokkaa omistajuutta","error":"Viestin omistajan vaihdossa tapahtui virhe.","label":"Viestin uusi omistaja","placeholder":"uuden omistajan käyttäjätunnus","instructions":{"one":"Valitse uusi omistaja viestille käyttäjältä \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Valitse uusi omistaja {{count}} viestille käyttäjältä \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Huomaa, että viestin ilmoitukset eivät siirry uudelle käyttäjälle automaattisesti. \u003cbr\u003e Varoitus: Tällä hetkellä mikään viestikohtainen data ei siirry uudelle käyttäjälle. Käytä varoen."},"change_timestamp":{"title":"Muuta aikaleimaa","action":"muuta aikaleimaa","invalid_timestamp":"Aikaleima ei voi olla tulevaisuudessa.","error":"Ketjun aikaleiman vaihtamisessa tapahtui virhe","instructions":"Ole hyvä ja valitse ketjulle uusi aikaleima. Ketjun viestit päivitetään samalla aikaerolla."},"multi_select":{"select":"valitse","selected":"valittuna ({{count}})","select_replies":"valitse +vastausta","delete":"poista valitut","cancel":"kumoa valinta","select_all":"valitse kaikki","deselect_all":"poista kaikkien valinta","description":{"one":"Olet valinnut \u003cb\u003eyhden\u003c/b\u003e viestin.","other":"Olet valinnut \u003cb\u003e{{count}}\u003c/b\u003e viestiä."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"lainaa","edit":"Muokataan {{link}} {{replyAvatar}} {{username}}","edit_reason":"Syy:","post_number":"viesti {{number}}","last_edited_on":"viestin viimeisin muokkausaika","reply_as_new_topic":"Vastaa aihetta sivuavassa ketjussa","continue_discussion":"Jatkoa ketjulle {{postLink}}:","follow_quote":"siirry lainattuun viestiin","show_full":"Näytä koko viesti","show_hidden":"Näytä piilotettu sisältö.","deleted_by_author":{"one":"(kirjoittaja on perunut viestin ja se poistetaan automaattisesti tunnin kuluttua, paitsi jos se liputetaan)","other":"(kirjoittaja on perunut viestin ja se poistetaan automaattisesti %{count} tunnin kuluttua, paitsi jos se liputetaan)"},"expand_collapse":"laajenna/pienennä","gap":{"one":"näytä 1 piilotettu vastaus","other":"näytä {{count}} piilotettua vastausta"},"unread":"Viesti on lukematta","has_replies":{"one":"{{count}} vastaus","other":"{{count}} vastausta"},"has_likes":{"one":"{{count}} tykkäys","other":"{{count}} tykkäystä"},"has_likes_title":{"one":"1 käyttäjä tykkäsi tästä viestistä","other":"{{count}} käyttäjää tykkäsi tästä viestistä"},"has_likes_title_only_you":"tykkäsit tästä viestistä","has_likes_title_you":{"one":"Sinä ja yksi toinen tykkäsi tästä viestistä","other":"Sinä ja {{count}} muuta tykkäsi tästä viestistä"},"errors":{"create":"Pahoittelut, viestin luonti ei onnistunut. Ole hyvä ja yritä uudelleen.","edit":"Pahoittelut, viestin muokkaus ei onnistunut. Ole hyvä ja yritä uudelleen.","upload":"Pahoittelut, tiedoston lähetys ei onnistunut. Ole hyvä ja yritä uudelleen.","file_too_large":"Pahoittelut, tiedosto jonka latausta yritit on liian suuri (suurin tiedostokoko on {{max_size_kb}}kb). Mitäpä jos lataisit tiedoston johonkin pilvipalveluun ja jakaisit täällä siihen linkin?","too_many_uploads":"Pahoittelut, voit ladata vain yhden tiedoston kerrallaan.","too_many_dragged_and_dropped_files":"Pahoittelut, voit ladata korkeintaan 10 tiedostoa kerrallaan.","upload_not_authorized":"Pahoittelut, tiedostomuoto ei ole sallittu (sallitut tiedostopäätteet: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Pahoittelut, uudet käyttjät eivät saa ladata kuvia.","attachment_upload_not_allowed_for_new_user":"Pahoittelut, uudet käyttäjät eivät saa ladata liitteitä.","attachment_download_requires_login":"Pahoittelut, sinun täytyy kirjautua sisään voidaksesi ladata liitetiedostoja."},"abandon":{"confirm":"Oletko varma, että haluat hylätä viestisi?","no_value":"Ei, säilytä","yes_value":"Kyllä, hylkää"},"via_email":"tämä viesti lähetettiin sähköpostitse","via_auto_generated_email":"tämä viesti saapui automaattisesti generoituna sähköpostina","whisper":"tämä viesti on yksityinen kuiskaus valvojille","wiki":{"about":"tämä viesti on wiki"},"archetypes":{"save":"Tallennusasetukset"},"few_likes_left":"Kiitos hyvän mielen levittämisestä! Sinulla on enää muutama tykkäys jäljellä tälle päivälle.","controls":{"reply":"aloita vastaamaan tähän viestiin","like":"tykkää viestistä","has_liked":"tykkäsit tästä viestistä","undo_like":"peru tykkäys","edit":"muokkaa viestiä","edit_anonymous":"Pahoittelut, sinun täytyy ensin kirjautua sisään voidaksesi muokata tätä viestiä.","flag":"liputa tämä viesti tai lähetä käyttäjälle yksityisviesti","delete":"poista tämä viesti","undelete":"peru viestin poistaminen","share":"jaa linkki tähän viestiin","more":"Lisää","delete_replies":{"confirm":{"one":"Haluatko poistaa myös yhden suoran vastauksen tähän viestiin.","other":"Haluatko poistaa myös {{count}} suoraa vastausta tähän viestiin?"},"yes_value":"Kyllä, poista myös vastaukset","no_value":"En, poista vain tämä viesti"},"admin":"viestin ylläpitotoimet","wiki":"Tee wiki","unwiki":"Poista wiki","convert_to_moderator":"Lisää henkilökunnan taustaväri","revert_to_regular":"Poista henkilökunnan taustaväri","rebake":"Tee HTML uudelleen","unhide":"Poista piilotus","change_owner":"Vaihda omistajuutta"},"actions":{"flag":"Liputa","defer_flags":{"one":"Lykkää lippua","other":"Lykkää lippuja"},"undo":{"off_topic":"Peru lippu","spam":"Peru lippu","inappropriate":"Peru lippu","bookmark":"Peru kirjanmerkki","like":"Peru tykkäys","vote":"Peru ääni"},"people":{"off_topic":"liputti tämän asiaan kuulumattomaksi","spam":"liputti tämän roskapostiksi","inappropriate":"liputti tämän asiattomaksi","notify_moderators":"ilmoitti valvojille","notify_user":"lähetti viestin","bookmark":"lisäsi tämän kirjanmerkkeihin","like":"tykkäsi tästä","vote":"äänesti tätä"},"by_you":{"off_topic":"Liputit tämän asiaankuulumattomaksi","spam":"Liputit tämän roskapostiksi","inappropriate":"Liputit tämän asiattomaksi","notify_moderators":"Liputit tämän valvojille tiedoksi","notify_user":"Lähetit viestin tälle käyttäjälle","bookmark":"Olet lisännyt viestin kirjainmerkkeihisi","like":"Tykkäsit tästä","vote":"Olet äänestänyt tätä viestiä"},"by_you_and_others":{"off_topic":{"one":"Sinä ja yksi muu käyttäjä liputitte tämän asiaankuulumattomaksi","other":"Sinä ja {{count}} muuta liputtivat tämän asiaankuulumattomaksi"},"spam":{"one":"Sinä ja yksi muu käyttäjä liputitte tämän roskapostiksi","other":"Sinä ja {{count}} muuta liputtivat tämän roskapostiksi"},"inappropriate":{"one":"Sinä ja yksi muu käyttäjä liputitte tämän asiattomaksi","other":"Sinä ja {{count}} muuta liputtivat tämän asiattomaksi"},"notify_moderators":{"one":"Sinä ja yksi muu käyttäjä liputitte tämän valvojille tiedoksi","other":"Sinä ja {{count}} muuta liputtivat tämän valvojille tiedoksi"},"notify_user":{"one":"Sinä ja 1 muuta lähetitte tälle käyttäjälle yksityisviestin","other":"Sinä ja {{count}} muuta lähetitte tälle käyttäjälle viestin"},"bookmark":{"one":"Sinä ja yksi muu käyttäjä lisäsitte tämän kirjanmerkkeihinne","other":"Sinä ja {{count}} muuta lisäsivät tämän kirjanmerkkeihinsä"},"like":{"one":"Sinä ja yksi muu käyttäjä tykkäsitte tästä","other":"Sinä ja {{count}} muuta tykkäsivät tästä"},"vote":{"one":"Sinä ja yksi muu käyttäjä äänestitte tätä viestiä","other":"Sinä ja {{count}} muuta äänestivät tätä viestiä"}},"by_others":{"off_topic":{"one":"Yksi käyttäjä liputti tämän asiaankuulumattomaksi","other":"{{count}} käyttäjää liputtivat tämän asiaankuulumattomaksi"},"spam":{"one":"yksi käyttäjä liputti tämän roskapostiksi","other":"{{count}} käyttäjää liputti tämän roskapostiksi"},"inappropriate":{"one":"yksi käyttäjä liputti tämän epäasialliseksi","other":"{{count}} käyttäjää liputti tämän epäasialliseksi"},"notify_moderators":{"one":"yksi käyttäjä liputti tämän tiedoksi valvojalle","other":"{{count}} käyttäjää liputti tämän tiedoksi valvojalle"},"notify_user":{"one":"1 henkilö lähetti tälle käyttäjälle yksityisviestin","other":"{{count}} henkilöä on lähettänyt tälle käyttäjälle yksityisviestin"},"bookmark":{"one":"yksi käyttäjä lisäsi tämän viestin kirjanmerkkeihinsä","other":"{{count}} käyttäjää lisäsi tämän veistin kirjanmerkkeihinsä"},"like":{"one":"yksi käyttäjä tykkäsi tästä","other":"{{count}} käyttäjää tykkäsi tästä"},"vote":{"one":"yksi käyttäjä äänesti tätä viestiä","other":"{{count}} käyttäjää äänesti tätä viestiä"}}},"delete":{"confirm":{"one":"Oletko varma, että haluat poistaa tämän viestin?","other":"Oletko varma, että haluat poistaa kaikki nämä viestit?"}},"merge":{"confirm":{"one":"Oletko varma, että haluat yhdistää viestit?","other":"Oletko varma, että haluat yhdistää {{count}} viestiä?"}},"revisions":{"controls":{"first":"Ensimmäinen revisio","previous":"Edellinen revisio","next":"Seuraava revisio","last":"Viimeinen revisio","hide":"Piilota revisio","show":"Näytä revisio","revert":"Palaa tähän revisioon","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Näytä lisäykset ja poistot tekstin osana","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Näytä muokkauksen versiot vierekkäin","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Näytä viestien lähdekoodit vierekkäin","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Teksti"}}}},"category":{"can":"voivat\u0026hellip; ","none":"(ei aluetta)","all":"Kaikki alueet","choose":"Valitse alue\u0026hellip;","edit":"muokkaa","edit_long":"Muokkaa","view":"Katsele alueen ketjuja","general":"Yleistä","settings":"Asetukset","topic_template":"Ketjun sapluuna","tags":"Tunnisteet","tags_allowed_tags":"Tällä alueella sallitut tunnisteet:","tags_allowed_tag_groups":"Tällä alueella sallitut tunnisteryhmät:","tags_placeholder":"(Valinnainen) lista sallituista tunnisteista","tag_groups_placeholder":"(Valinnainen) lista sallituista tunnisteryhmistä","delete":"Poista alue","create":"Uusi alue","create_long":"Luo uusi alue","save":"Tallenna","slug":"Alueen lyhenne","slug_placeholder":"(Valinnainen) url-lyhenne","creation_error":"Alueen luonnissa tapahtui virhe.","save_error":"Alueen tallennuksessa tapahtui virhe.","name":"Alueen nimi","description":"Kuvaus","topic":"alueen kuvausketju","logo":"Alueen logo","background_image":"Alueen taustakuva","badge_colors":"Alueen tunnusvärit","background_color":"Taustaväri","foreground_color":"Edustan väri","name_placeholder":"Yksi tai kaksi sanaa enimmillään","color_placeholder":"Web-väri","delete_confirm":"Oletko varma, että haluat poistaa tämän alueen?","delete_error":"Alueen poistossa tapahtui virhe.","list":"Listaa alueet","no_description":"Lisää alueelle kuvaus.","change_in_category_topic":"Muokkaa kuvausta","already_used":"Tämä väri on jo käytössä toisella alueella","security":"Turvallisuus","special_warning":"Varoitus: Tämä alue on esituotettu ja sen turvallisuusasetuksia ei voi muuttaa. Jos et halua käyttää sitä, poista se sen sijaan.","images":"Kuvat","auto_close_label":"Sulje ketjut automaattisesti tämän ajan jälkeen:","auto_close_units":"tuntia","email_in":"Saapuvan postin sähköpostiosoite:","email_in_allow_strangers":"Hyväksy viestejä anonyymeiltä käyttäjiltä joilla ei ole tiliä","email_in_disabled":"Uusien ketjujen luominen sähköpostitse on otettu pois käytöstä sivuston asetuksissa. Salliaksesi uusien ketjujen luomisen sähköpostilla, ","email_in_disabled_click":"ota käyttöön \"email in\" asetus.","suppress_from_homepage":"Vaimenna alue kotisivulta.","allow_badges_label":"Salli arvomerkkien myöntäminen tältä alueelta","edit_permissions":"Muokkaa oikeuksia","add_permission":"Lisää oikeus","this_year":"tänä vuonna","position":"arvo","default_position":"Oletuspaikka","position_disabled":"Alueet näytetään aktiivisuusjärjestyksessä. Muokataksesi järjestystä,","position_disabled_click":"ota käyttöön \"pysyvä aluejärjestys\" asetuksista.","parent":"Ylempi alue","notifications":{"watching":{"title":"Tarkkaile","description":"Tarkkailet kaikkia ketjuja näillä alueilla. Saat ilmoituksen jokaisesta uudesta viestistä missä tahansa ketjussa, ja uusien vastausten määrä näytetään."},"watching_first_post":{"title":"Tarkkaile uusia ketjuja","description":"Saat ilmoituksen näille alueille luoduista ketjuista."},"tracking":{"title":"Seuraa","description":"Seuraat kaikkia ketjuja näillä alueilla. Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle, ja uusien vastausten määrä näytetään."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"muted":{"title":"Vaimennettu","description":"Et saa ilmoituksia uusista ketjuista näillä alueilla, eivätkä ne näy tuoreimmissa."}}},"flagging":{"title":"Kiitos avustasi yhteisön hyväksi!","action":"Liputa viesti","take_action":"Ryhdy toimiin","notify_action":"Viesti","official_warning":"Virallinen varoitus","delete_spammer":"Poista roskapostittaja","yes_delete_spammer":"Kyllä, poista roskapostittaja","ip_address_missing":"-","hidden_email_address":"(piilotettu)","submit_tooltip":"Toimita lippu","take_action_tooltip":"Saavuta liputusraja välittömästi, ennemmin kuin odota muidenkin käyttäjien liputuksia.","cant":"Pahoittelut, et pysty liputtamaan tätä viestiä tällä hetkellä.","notify_staff":"Ilmoita ylläpidolle yksityisesti","formatted_name":{"off_topic":"Se on asiaankuulumaton","inappropriate":"Se on asiaton","spam":"Se on roskapostia"},"custom_placeholder_notify_user":"Esitä asiasi ymmärrettäväsi, ole rakentava ja kohtelias.","custom_placeholder_notify_moderators":"Kerro ymmärrettävästi ja selvästi, mistä olet huolestunut ja lisää viestiin oleelliset esimerkit ja linkit, jos mahdollista."},"flagging_topic":{"title":"Kiitos avustasi yhteisön hyväksi!","action":"Liputa ketju","notify_action":"Viesti"},"topic_map":{"title":"Ketjun tiivistelmä","participants_title":"Useimmin kirjoittaneet","links_title":"Suositut linkit","links_shown":"näytä enemmän linkkejä...","clicks":{"one":"1 klikkaus","other":"%{count} klikkausta"}},"post_links":{"about":"laajenna lisää linkkejä tähän viestiin","title":{"one":"1 lisää","other":"%{count} lisää"}},"topic_statuses":{"warning":{"help":"Tämä on virallinen varoitus."},"bookmarked":{"help":"Olet lisännyt ketjun kirjanmerkkeihisi"},"locked":{"help":"Tämä ketju on suljettu; siihen ei voi enää vastata."},"archived":{"help":"Tämä ketju on arkistoitu; se on jäädytetty eikä sitä voi muuttaa"},"locked_and_archived":{"help":"Tämä ketju on suljettu ja arkistoitu, sihen ei voi enää vastata eikä sitä muuttaa"},"unpinned":{"title":"Kiinnitys poistettu","help":"Ketjun kiinnitys on poistettu sinulta; se näytetään tavallisessa järjestyksessä."},"pinned_globally":{"title":"Kiinnitetty koko palstalle","help":"Tämä ketju on kiinnitetty koko palstalle; se näytetään tuoreimpien ja oman alueensa ylimpänä"},"pinned":{"title":"Kiinnitetty","help":"Tämä ketju on kiinnitetty sinulle; se näytetään alueensa ensimmäisenä"},"invisible":{"help":"Tämä ketju on poistettu listauksista; sitä ei näytetä ketjujen listauksissa ja siihen pääsee vain suoralla linkillä"}},"posts":"Viestejä","posts_long":"tässä ketjussa on {{number}} viestiä","original_post":"Aloitusviesti","views":"Katseluita","views_lowercase":{"one":"katselu","other":"katselut"},"replies":"Vastauksia","views_long":"tätä ketjua on katseltu {{number}} kertaa","activity":"Toiminta","likes":"Tykkäykset","likes_lowercase":{"one":"tykkäys","other":"tykkäykset"},"likes_long":"tässä ketjussa on {{number}} tykkäystä","users":"Käyttäjät","users_lowercase":{"one":"käyttäjä","other":"käyttäjät"},"category_title":"Alue","history":"Historia","changed_by":"käyttäjältä {{author}}","raw_email":{"title":"Alkuperäinen sähköposti","not_available":"Ei käytettävissä!"},"categories_list":"Lista alueista","filters":{"with_topics":"%{filter} ketjut","with_category":"%{filter} %{category} ketjut","latest":{"title":"Tuoreimmat","title_with_count":{"one":"Tuoreimmat (1)","other":"Tuoreimmat ({{count}})"},"help":"ketjut, joissa on viimeaikaisia viestejä"},"hot":{"title":"Kuuma","help":"valikoima kuumimpia ketjuja"},"read":{"title":"Luetut","help":"lukemasi ketjut, lukemisjärjestyksessä"},"search":{"title":"Etsi","help":"etsi kaikista ketjuista"},"categories":{"title":"Keskustelualueet","title_in":"Alue - {{categoryName}}","help":"kaikki ketjut alueen mukaan järjestettynä"},"unread":{"title":"Lukematta","title_with_count":{"one":"Lukematta (1)","other":"Lukematta ({{count}})"},"help":"ketjut, joita seuraat tai tarkkailet tällä hetkellä ja joissa on lukemattomia viestejä","lower_title_with_count":{"one":"1 lukematta","other":"{{count}} lukematta"}},"new":{"lower_title_with_count":{"one":"1 uusi","other":"{{count}} uutta"},"lower_title":"uusi","title":"Uudet","title_with_count":{"one":"Uudet (1)","other":"Uudet ({{count}})"},"help":"viime päivinä luodut ketjut"},"posted":{"title":"Viestini","help":"ketjut, joihin olet kirjoittanut"},"bookmarks":{"title":"Kirjanmerkit","help":"ketjut, jotka olet merkinnyt kirjanmerkillä"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"Tuoreimmat alueella {{categoryName}}"},"top":{"title":"Huiput","help":"Aktiivisimmat ketjut viimeisen vuoden, kuukauden ja päivän ajalta","all":{"title":"Kaikkina aikoina"},"yearly":{"title":"Vuosittain"},"quarterly":{"title":"Vuosineljännettäin"},"monthly":{"title":"Kuukausittain"},"weekly":{"title":"Viikoittain"},"daily":{"title":"Päivittäin"},"all_time":"Kaikkina aikoina","this_year":"Vuosi","this_quarter":"Vuosineljännes","this_month":"Kuukausi","this_week":"Viikko","today":"Tänään","other_periods":"katso huiput"}},"browser_update":"Valitettavasti tätä sivustoa ei voi käyttää \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003enäin vanhalla selaimella\u003c/a\u003e. Ole hyvä ja \u003ca href=\"http://browsehappy.com\"\u003epäivitä selaimesi\u003c/a\u003e.","permission_types":{"full":"Luoda / Vastata / Nähdä","create_post":"Vastata / Nähdä","readonly":"Nähdä"},"lightbox":{"download":"lataa"},"search_help":{"title":"Haun ohjeet"},"keyboard_shortcuts_help":{"title":"Näppäinoikotiet","jump_to":{"title":"Siirry","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Aloitussivulle","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Tuoreimmat","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Uudet","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Lukemattomat","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Alueet","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Huiput","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Kirjanmerkit","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Käyttäjäprofiili","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Viestit"},"navigation":{"title":"Navigointi","jump":"\u003cb\u003e#\u003c/b\u003e Siirry viestiin #","back":"\u003cb\u003eu\u003c/b\u003e Takaisin","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Siirrä valintaa \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e tai \u003cb\u003eEnter\u003c/b\u003e Avaa valittu ketju","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Seuraava/edellinen valinta"},"application":{"title":"Ohjelma","create":"\u003cb\u003ec\u003c/b\u003e Luo uusi ketju","notifications":"\u003cb\u003en\u003c/b\u003e Avaa ilmoitukset","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Avaa hampurilaisvalikko","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Avaa käyttäjävalikko","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Näytä päivttyneet ketjut","search":"\u003cb\u003e/\u003c/b\u003e Haku","help":"\u003cb\u003e?\u003c/b\u003e Näytä näppäimistöoikotiet","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Unohda Uudet/Viestit","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Unohda ketjut","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Kirjaudu ulos"},"actions":{"title":"Toiminnot","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Aseta kirjanmerkkeihin/poista","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Kiinnitä/Poista ketjun kiinnitys","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Jaa ketju","share_post":"\u003cb\u003es\u003c/b\u003e Jaa viesti","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Vastaa aihetta sivuavassa ketjussa","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Vastaa ketjuun","reply_post":"\u003cb\u003er\u003c/b\u003e Vastaa viestiin","quote_post":"\u003cb\u003eq\u003c/b\u003e Lainaa viesti","like":"\u003cb\u003el\u003c/b\u003e Tykkää viestistä","flag":"\u003cb\u003e!\u003c/b\u003e Liputa viesti","bookmark":"\u003cb\u003eb\u003c/b\u003e Lisää viesti kirjanmerkkeihin","edit":"\u003cb\u003ee\u003c/b\u003e Muokkaa viestiä","delete":"\u003cb\u003ed\u003c/b\u003e Poista viesti","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Vaimenna ketju","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Tavallinen (oletus) ketju","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Seuraa ketjua","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Tarkkaile ketjua"}},"badges":{"earned_n_times":{"one":"Ansaitsi tämän arvomerkin yhden kerran","other":"Ansaitsi tämän arvomerkin %{count} kertaa"},"granted_on":"Myönnetty %{date}","others_count":"Muita, joilla on tämä arvomerkki (%{count})","title":"Arvomerkit","allow_title":"sallittu titteli","multiple_grant":"myönnettävissä useaan kertaan","badge_count":{"one":"1 Arvomerkki","other":"%{count} Arvomerkkiä"},"more_badges":{"one":"+1 Lisää","other":"+%{count} Lisää"},"granted":{"one":"1 myönnetty","other":"%{count} myönnettyä"},"select_badge_for_title":"Valitse tittelisi arvomerkeistä","none":"\u003cei mitään\u003e","badge_grouping":{"getting_started":{"name":"Ensiaskeleet"},"community":{"name":"Yhteisö"},"trust_level":{"name":"Luottamustaso"},"other":{"name":"Muut"},"posting":{"name":"Kirjoittaminen"}}},"google_search":"\u003ch3\u003eEtsi Googlella\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Kaikki tunnisteet","selector_all_tags":"kaikki tunnisteet","selector_no_tags":"ei tunnisteita","changed":"muutetut tunnisteet","tags":"Tunnisteet","choose_for_topic":"valitse valinnaiset tunnisteet tälle ketjulle","delete_tag":"Poista tunniste","delete_confirm":"Oletko varma, että haluat poistaa tunnisteen?","rename_tag":"Uudelleennimeä tunniste","rename_instructions":"Valitse uusi nimi tälle tunnisteelle:","sort_by":"Järjestä:","sort_by_count":"lukumäärä","sort_by_name":"nimi","manage_groups":"Hallinnoi tunnisteryhmiä","manage_groups_description":"Määrittele ryhmiä tunnisteiden järjestämiseksi","filters":{"without_category":"%{filter} %{tag} ketjut","with_category":"%{filter} %{tag} ketjut alueella %{category}","untagged_without_category":"%{filter} ketjut joilla ei tunnisteita","untagged_with_category":"%{filter} ketjut joilla ei tunnisteita alueella %{category}"},"notifications":{"watching":{"title":"Tarkkaile","description":"Ketjut, joilla on tämä tunniste, asetetaan automaattisesti tarkkailuun. Saat ilmoituksen kaikista uusista viesteistä ja ketjuista, ja uusien ja lukemattomien viestien lukumäärä näytetään ketjujen yhteydessä. "},"watching_first_post":{"title":"Tarkkaile uusia ketjuja","description":"Saat ilmoituksen luoduista ketjuista, joilla on joku näistä tunnisteista."},"tracking":{"title":"Seuraa","description":"Seuraat kaikkia ketjuja, joilla on tämä tunniste. Lukemattomien ja uusien viestien lukumäärä näytetään ketjun yhteydessä."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa viestiisi."},"muted":{"title":"Vaimennettu","description":"Et saa imoituksia uusista viesteistä tällä tunnisteella, eivätkä ne näy Lukematta-välilehdellä"}},"groups":{"title":"Tunnisteryhmät","about":"Lisää tunnisteita ryhmiin, jotta niitä on helpompi hallita","new":"Uusi ryhmä","tags_label":"Tunnisteet tässä ryhmässä","parent_tag_label":"Ylempi tunniste:","parent_tag_placeholder":"Valinnainen","parent_tag_description":"Tämän ryhmän tunnisteita voi käyttää vain, jos ylempi tunniste on asetettu","one_per_topic_label":"Rajoita tästä ryhmästä yhteen tunnisteeseen per ketju","new_name":"Uusi ryhmä tunnisteita","save":"Tallenna","delete":"Poista","confirm_delete":"Oletko varma, että haluat poistaa tämän tunnisteryhmän?"},"topics":{"none":{"unread":"Sinulla ei ole lukemattomia ketjuja.","new":"Sinulle uusia ketjuja ei ole.","read":"Et ole lukenut vielä yhtään yhtään ketjua.","posted":"Et ole kirjoittanut vielä yhteenkään ketjuun.","latest":"Tuoreimpia ketjuja ei ole.","hot":"Kuumia ketjuja ei ole.","bookmarks":"Et ole vielä merkinnyt kirjanmerkkejä.","top":"Huippuketjuja ei ole.","search":"Hakutuloksia ei löytynyt."},"bottom":{"latest":"Tuoreimpia ketjuja ei ole enempää.","hot":"Kuumia ketjuja ei ole enempää.","posted":"Ketjuja, joihin olet kirjoittanut ei ole enempää.","read":"Luettuja ketjuja ei ole enempää.","new":"Uusia ketjuja ei ole enempää.","unread":"Ketjuja ei ole enempää lukematta.","top":"Huippuketjuja ei ole enempää.","bookmarks":"Merkattuja ketjuja ei ole enempää.","search":"Hakutuloksia ei ole enempää."}}},"invite":{"custom_message":"Tee kutsustasi hieman persoonallisempi kirjoittamalla","custom_message_link":"henkilökohtainen viesti","custom_message_placeholder":"Kirjoita henkilökohtainen viestisi","custom_message_template_forum":"Hei, sinun pitäisi liittyä tälle palstalle!","custom_message_template_topic":"Hei, ajattelin, että voisit tykätä tästä ketjusta!"},"poll":{"voters":{"one":"äänestäjä","other":"äänestäjää"},"total_votes":{"one":"ääni","other":"ääntä"},"average_rating":"Keskiarvo: \u003cstrong\u003e%{average}\u003c/strong\u003e","public":{"title":"Äänet ovat julkisia."},"multiple":{"help":{"at_least_min_options":{"one":"Valitse vähintään \u003cstrong\u003e1\u003c/strong\u003e vaihtoehto","other":"Valotse vähintään \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehtoa"},"up_to_max_options":{"one":"Valitse enintään \u003cstrong\u003e1\u003c/strong\u003e vaihtoehto","other":"Valitse enintään \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehtoa"},"x_options":{"one":"Valitse  \u003cstrong\u003e1\u003c/strong\u003e vaihtoehto","other":"Valitse \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehtoa"},"between_min_and_max_options":"Valitse \u003cstrong\u003e%{min}\u003c/strong\u003e-\u003cstrong\u003e%{max}\u003c/strong\u003e vaihtoehtoa"}},"cast-votes":{"title":"Antakaa äänenne","label":"Äänestä nyt!"},"show-results":{"title":"Näytä äänestystulos","label":"Näytä tulos"},"hide-results":{"title":"Palaa äänestysvalintaasi","label":"Piilota tulos"},"open":{"title":"Avaa äänestys","label":"Avaa","confirm":"Avataanko äänestys?"},"close":{"title":"Sulje äänestys","label":"Sulje","confirm":"Suljetaanko äänestys?"},"error_while_toggling_status":"Pahoittelut, äänestyksen tilaa muutettaessa tapahtui virhe.","error_while_casting_votes":"Pahoittelut, ääntä annettaessa tapahtui virhe.","error_while_fetching_voters":"Pahoittelut, äänestäneiden näyttämisessä tapahtui virhe.","ui_builder":{"title":"Luo äänestys","insert":"Lisää äänestys","help":{"options_count":"Valitse vähintään 2 vaihtoehtoa"},"poll_type":{"label":"Tyyppi","regular":"Valitaan yksi","multiple":"Valitaan useita","number":"Numeroarviointi"},"poll_config":{"max":"Enint.","min":"Väh.","step":"Askelväli"},"poll_public":{"label":"Näytä äänestäneet"},"poll_options":{"label":"Syötä yksi äänestysvaihtoehto riviä kohden"}}},"type_to_filter":"kirjoita suodattaaksesi...","admin":{"title":"Discourse ylläpitäjä","moderator":"Valvoja","dashboard":{"title":"Hallintapaneeli","last_updated":"Hallintapaneeli on päivitetty viimeksi:","version":"Versio","up_to_date":"Sivusto on ajan tasalla!","critical_available":"Kriittinen päivitys on saatavilla.","updates_available":"Päivityksiä on saatavilla.","please_upgrade":"Päivitä!","no_check_performed":"Päivityksiä ei ole tarkistettu. Varmista, että sidekiq on käynnissä.","stale_data":"Pävityksiä ei ole tarkistettu viime aikoina. Varmista, että sidekiq on käynnissä.","version_check_pending":"Näyttäisi, että olet päivittänyt lähiaikoina. Hienoa!","installed_version":"Asennettu","latest_version":"Uusin","problems_found":"Discourse asennuksesta on löytynyt ongelmia:","last_checked":"Viimeksi tarkistettu","refresh_problems":"Päivitä","no_problems":"Ongelmia ei löytynyt.","moderators":"Valvojat:","admins":"Ylläpitäjät:","blocked":"Estetyt:","suspended":"Hyllytetyt:","private_messages_short":"YV:t","private_messages_title":"Viestit","mobile_title":"Mobiili","space_free":"{{size}} vapaata","uploads":"lataukset","backups":"varmuuskopiot","traffic_short":"Liikenne","traffic":"Sovelluksen web-pyynnöt","page_views":"API pyynnöt","page_views_short":"API pyynnöt","show_traffic_report":"Näytä yksityiskohtainen liikenneraportti","reports":{"today":"Tänään","yesterday":"Eilen","last_7_days":"Edellisenä 7 päivänä","last_30_days":"Edellisenä 30 päivänä","all_time":"Kaikilta ajoilta","7_days_ago":"7 päivää sitten","30_days_ago":"30 päivää sitten","all":"Kaikki","view_table":"taulukko","view_graph":"graafi","refresh_report":"Päivitä raportti","start_date":"Alkupäivämäärä","end_date":"Loppupäivämäärä","groups":"Kaikki ryhmät"}},"commits":{"latest_changes":"Viimeisimmät muutokset: päivitä usein!","by":"käyttäjältä"},"flags":{"title":"Liput","old":"Vanhat","active":"Aktiiviset","agree":"Ole samaa mieltä","agree_title":"Vahvista, että lippu on annettu oikeasta syystä","agree_flag_modal_title":"Ole samaa mieltä ja...","agree_flag_hide_post":"Samaa mieltä (piilota viesti ja lähetä YV)","agree_flag_hide_post_title":"Piilota tämä viesti automaattisesti ja lähetä käyttäjälle muokkaamaan hoputtava viesti","agree_flag_restore_post":"Ole samaa mieltä (palauta viesti)","agree_flag_restore_post_title":"Palauta tämä viesti","agree_flag":"Ole samaa mieltä lipun kanssa","agree_flag_title":"Ole samaa mieltä lipun kanssa ja älä muokkaa viestiä","defer_flag":"Lykkää","defer_flag_title":"Poista lippu; se ei vaadi toimenpiteitä tällä hetkellä.","delete":"Poista","delete_title":"Poista viesti, johon lippu viittaa.","delete_post_defer_flag":"Poista viesti ja lykkää lipun käsittelyä","delete_post_defer_flag_title":"Poista viesti; jos se on aloitusviesti, niin poista koko ketju","delete_post_agree_flag":"Poista viesti ja ole sama mieltä lipun kanssa","delete_post_agree_flag_title":"Poista viesti; jos se on aloitusviesti, niin poista koko ketju","delete_flag_modal_title":"Poista ja...","delete_spammer":"Poista roskapostittaja","delete_spammer_title":"Poista käyttäjä ja viestit ja ketjut tältä käyttäjältä.","disagree_flag_unhide_post":"Ole eri mieltä (poista viestin piilotus)","disagree_flag_unhide_post_title":"Poista kaikki liput tästä viestistä ja tee siitä taas näkyvä","disagree_flag":"Ole eri mieltä","disagree_flag_title":"Kiistä lippu, koska se on kelvoton tai väärä","clear_topic_flags":"Valmis","clear_topic_flags_title":"Tämä ketju on tutkittu ja sitä koskeneet ongelmat ratkaistu. Klikkaa Valmis poistaaksesi liput.","more":"(lisää vastauksia...)","dispositions":{"agreed":"samaa mieltä","disagreed":"eri mieltä","deferred":"lykätty"},"flagged_by":"Liputtajat","resolved_by":"Selvittäjä","took_action":"Ryhtyi toimenpiteisiin","system":"Järjestelmä","error":"Jotain meni pieleen","reply_message":"Vastaa","no_results":"Lippuja ei ole.","topic_flagged":"Tämä \u003cstrong\u003eketju\u003c/strong\u003e on liputettu.","visit_topic":"Vieraile ketjussa ryhtyäksesi toimiin","was_edited":"Viestiä muokattiin ensimmäisen lipun jälkeen","previous_flags_count":"Tämä viesti on liputettu {{count}} kertaa.","summary":{"action_type_3":{"one":"asiaankuulumaton","other":"asiaankuulumaton x{{count}}"},"action_type_4":{"one":"asiaton","other":"asiaton x{{count}}"},"action_type_6":{"one":"mukautettu","other":"mukautettu x{{count}}"},"action_type_7":{"one":"mukautettu","other":"mukautettu x{{count}}"},"action_type_8":{"one":"roskaposti","other":"roskapostia x {{count}}"}}},"groups":{"primary":"Ensisijainen ryhmä","no_primary":"(ei ensisijaista ryhmää)","title":"Ryhmät","edit":"Muokkaa ryhmiä","refresh":"Lataa uudelleen","new":"Uusi","selector_placeholder":"syötä käyttäjätunnus","name_placeholder":"Ryhmän nimi, ei välilyöntejä, samat säännöt kuin käyttäjänimillä","about":"Muokkaa ryhmien jäsenyyksiä ja nimiä täällä","group_members":"Ryhmään kuuluvat","delete":"Poista","delete_confirm":"Poista tämä ryhmä?","delete_failed":"Ryhmän poistaminen ei onnistu. Jos tämä on automaattinen ryhmä, sitä ei voi poistaa.","delete_member_confirm":"Poista '%{username}' ryhmästä '%{group}'?","delete_owner_confirm":"Poista omistajan etuudet käyttäjältä '%{username}'?","name":"Nimi","add":"Lisää","add_members":"Lisää jäseniä","custom":"Mukautetut","bulk_complete":"Käyttäjät on lisätty ryhmään.","bulk":"Lisää ryhmään useita","bulk_paste":"Liitä lista käyttäjänimistä tai sähköpostiosoitteista, yksi per rivi:","bulk_select":"(valitse ryhmä)","automatic":"Automaattiset","automatic_membership_email_domains":"Käyttäjät, jotka luovat tunnuksen sähköpostiosoitteella, jonka verkkotunnus on tällä listalla, lisätään tähän ryhmään:","automatic_membership_retroactive":"Lisää jo olemassa olevat käyttäjät käyttäen samaa sääntöä verkkotunnuksista","default_title":"Tämä ryhmän jäsenten oletustitteli","primary_group":"Aseta automaattisesti ensisijaiseksi ryhmäksi","group_owners":"Omistajat","add_owners":"Lisää omistajia","incoming_email":"Saapuvan sähköpostin osoite","incoming_email_placeholder":"aseta sähköpostiosoite"},"api":{"generate_master":"Luo rajapinnan pääavain","none":"Aktiivisia API avaimia ei ole määritelty.","user":"Käyttäjä","title":"Rajapinta","key":"Rajapinnan avain","generate":"Luo","regenerate":"Tee uusi","revoke":"Peruuta","confirm_regen":"Oletko varma, että haluat korvata tämän API avaimen uudella?","confirm_revoke":"Oletko varma, että haluat peruuttaa tämän avaimen?","info_html":"API avaimen avulla voi luoda ja pävittää ketjuja käyttämällä JSON kutsuja.","all_users":"Kaikki käyttäjät","note_html":"Pidä tämä avain \u003cstrong\u003esalaisena\u003c/strong\u003e, sen haltija voi luoda viestejä esiintyen minä hyvänsä käyttäjänä."},"plugins":{"title":"Lisäosat","installed":"Asennetut lisäosat","name":"Nimi","none_installed":"Sinulla ei ole yhtään asennettua lisäosaa.","version":"Versio","enabled":"Otettu käyttöön?","is_enabled":"K","not_enabled":"E","change_settings":"Asetukset","change_settings_short":"Asetukset","howto":"Kuinka asennan lisäosia?"},"backups":{"title":"Varmuuskopiot","menu":{"backups":"Varmuuskopiot","logs":"Lokit"},"none":"Ei saatavilla olevia varmuuskopioita.","read_only":{"enable":{"title":"Käynnistä vain luku -tila.","label":"Käynnistä vain luku -tila.","confirm":"Oletko varma, että haluat käynnistää vain luku-tilan?"},"disable":{"title":"Poista vain luku -tila","label":"Poista vain luku -tila"}},"logs":{"none":"Lokeja ei ole vielä..."},"columns":{"filename":"Tiedostonimi","size":"Koko"},"upload":{"label":"Lähetä","title":"Lataa varmuuskopio tälle koneelle","uploading":"Lähettää...","success":"Tiedosto '{{filename}}' on lähetetty onnistuneesti.","error":"Tiedoston '{{filename}}' lähetyksen aikana tapahtui virhe: {{message}}"},"operations":{"is_running":"Operaatiota suoritetaan parhaillaan...","failed":"{{operation}} epäonnistui. Tarkista loki-tiedostot.","cancel":{"label":"Peruuta","title":"Peruuta toiminto","confirm":"Oletko varma, että haluat peruuttaa meneillään olevan toiminnon?"},"backup":{"label":"Varmuuskopioi","title":"Luo varmuuskopio","confirm":"Haluatko luoda uuden varmuuskopion?","without_uploads":"Kyllä (älä sisällytä tiedostoja)"},"download":{"label":"Lataa","title":"Lataa varmuuskopio"},"destroy":{"title":"Poista varmuuskopio","confirm":"Oletko varma, että haluat tuhota tämän varmuuskopion?"},"restore":{"is_disabled":"Palautus on estetty sivuston asetuksissa.","label":"Palauta","title":"Palauta varmuuskopio","confirm":"Oletko varma, että haluat palauttaa tämän varmuuskopion?"},"rollback":{"label":"Palauta","title":"Palauta tietokanta edelliseen toimivaan tilaan","confirm":"Oletko varma, että haluat palauttaa tietokannan edelliseen toimivaan tilaan?"}}},"export_csv":{"user_archive_confirm":"Oletko varma, että haluat ladata viestisi?","success":"Vienti on käynnissä. Saat ilmoituksen viestillä, kun prosessi on valmis.","failed":"Vienti epäonnistui. Tarkista loki-tiedostot.","rate_limit_error":"Viestit voidaan ladata kerran päivässä, yritä uudestaan huomenna.","button_text":"Vie","button_title":{"user":"Vie lista käyttäjistä CSV-formaatissa.","staff_action":"Vie lista henkilökunnan toimista CSV-formaatissa.","screened_email":"Vie koko lista seulotuista sähköpostiosoitteista CSV-formaatissa.","screened_ip":"Vie koko lista seulotuista IP-osoitteista CSV-formaatissa.","screened_url":"Vie koko lista seulotuista URL-osoitteista CSV-formaatissa."}},"export_json":{"button_text":"Vie"},"invite":{"button_text":"Lähetä kutsut","button_title":"Lähetä kutsut"},"customize":{"title":"Mukauta","long_title":"Sivuston mukautukset","css":"CSS","header":"Header","top":"Alku","footer":"Footer","embedded_css":"Upotuksen CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML, joka lisätään ennen \u003c/head\u003e elementtiä"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML, joka lisätään ennen \u003c/body\u003e elementtiä"},"override_default":"Älä sisällytä oletus-tyylitiedostoa","enabled":"Otettu käyttöön?","preview":"esikatselu","undo_preview":"poista esikatselu","rescue_preview":"oletustyyli","explain_preview":"Esikatsele sivustoa käyttäen tätä tyylitiedostoa","explain_undo_preview":"Siirry takaisin nykyisin käytössä olevaan tyylitiedostoon","explain_rescue_preview":"Esikatsele sivustoa käyttäen oletustyylitiedostoa","save":"Tallenna","new":"Uusi","new_style":"Uusi tyyli","import":"Tuo","import_title":"Valitse tiedosto tai liitä tekstiä","delete":"Poista","delete_confirm":"Poista tämä mukautus?","about":"Muokkaa sivuston CSS tyylitiedostoja ja HTML headeria. Lisää mukautus aloittaaksesi.","color":"Väri","opacity":"Läpinäkyvyys","copy":"Kopioi","email_templates":{"title":"Sähköpostipohjat","subject":"Otsikko","multiple_subjects":"Tällä sähköpostiluonnoksella on useita vastaanottajia.","body":"Leipäteksti","none_selected":"Aloita muokkaaminen valitsemalla sähköpostiluonnos.","revert":"Peru muutokset","revert_confirm":"Haluatko varmasti peruuttaa muutokset?"},"css_html":{"title":"CSS/HTML","long_title":"CSS ja HTML Kustomoinnit"},"colors":{"title":"Värit","long_title":"Värimallit","about":"Muokkaa sivuston värejä kirjoittamatta CSS-koodia. Lisää värimallia aloittaaksesi.","new_name":"Uusi värimalli","copy_name_prefix":"Kopio","delete_confirm":"Poista tämä värimalli?","undo":"peru","undo_title":"Peru muutokset tähän väriin ja palauta edellinen tallennettu tila.","revert":"palauta","revert_title":"Palauta tämä väri Discourse värimallin oletusarvoihin","primary":{"name":"ensisijainen väri","description":"Useimmat tekstit, ikonit ja reunat."},"secondary":{"name":"toissijainen väri","description":"Pääasiallinen taustaväri ja joidenkin painikkeiden tekstin väri."},"tertiary":{"name":"kolmas väri","description":"Linkit, jotkin painikkeet, ilmoitukset ja tehosteväri."},"quaternary":{"name":"neljäs väri","description":"Navigaatiolinkit."},"header_background":{"name":"headerin tausta","description":"Sivuston headerin taustaväri."},"header_primary":{"name":"headerin ensisijainen","description":"Headerin teksti ja ikonit."},"highlight":{"name":"korostus","description":"Korostettujen elementtien, kuten viestien ja ketjujen, taustaväri."},"danger":{"name":"vaara","description":"Korosteväri toiminnoille, kuten viestien ja ketjujen poistaminen."},"success":{"name":"menestys","description":"Käytetään ilmaisemaan, että toiminto onnistui."},"love":{"name":"tykkäys","description":"Tykkäyspainikkeen väri."}}},"email":{"title":"Sähköpostit","settings":"Asetukset","templates":"Viestipohjat","preview_digest":"Esikatsele tiivistelmä","sending_test":"Lähetetään testisähköpostia...","error":"\u003cb\u003eVIRHE\u003c/b\u003e - %{server_error}","test_error":"Testisähköpostin lähettäminen ei onnistunut. Tarkista uudelleen sähköpostiasetukset, varmista, että palveluntarjoajasi ei estä sähköpostiyhteyksiä ja kokeile sitten uudestaan.","sent":"Lähetetty","skipped":"Jätetty väliin","bounced":"Palautetut","received":"Vastaanotetut","rejected":"Hylätyt","sent_at":"Lähetetty","time":"Aika","user":"Käyttäjä","email_type":"Sähköpostin tyyppi","to_address":"Osoitteeseen","test_email_address":"sähköpostiosoite kokelua varten","send_test":"Lähetä testisähköposti","sent_test":"lähetetty!","delivery_method":"Lähetystapa","preview_digest_desc":"Esikatsele inaktiivisille käyttäjille lähetettyjen tiivistelmäsähköpostien sisältöä.","refresh":"Päivitä","format":"Muotoilu","html":"html","text":"teksti","last_seen_user":"Käyttäjän edellinen kirjautuminen:","reply_key":"Vastausavain","skipped_reason":"Syy väliinjättämiselle","incoming_emails":{"from_address":"Lähettäjä","to_addresses":"Vastaanottaja","cc_addresses":"Kopio","subject":"Otsikko","error":"Virhe","none":"Uusia sähköpostiviestejä ei löydetty.","modal":{"title":"Saapuvan sähköpostin tiedot","error":"Virhe","headers":"Headerit","subject":"Otsikko","body":"Leipäteksti","rejection_message":"Hylkäysviesti"},"filters":{"from_placeholder":"from@example.com","to_placeholder":"to@example.com","cc_placeholder":"cc@example.com","subject_placeholder":"Otsikko...","error_placeholder":"Virhe"}},"logs":{"none":"Lokeja ei löytynyt.","filters":{"title":"Suodatin","user_placeholder":"käyttäjätunnus","address_placeholder":"nimi@esimerkki.fi","type_placeholder":"tiivistelmä, kirjautuminen...","reply_key_placeholder":"vastausavain","skipped_reason_placeholder":"syy"}}},"logs":{"title":"Lokit","action":"Toiminto","created_at":"Luotu","last_match_at":"Osunut viimeksi","match_count":"Osumat","ip_address":"IP-osoite","topic_id":"Ketjun ID","post_id":"Viestin ID","category_id":"Alueen ID","delete":"Poista","edit":"Muokkaa","save":"Tallenna","screened_actions":{"block":"estä","do_nothing":"älä tee mitään"},"staff_actions":{"title":"Henkilökunnan toimet","instructions":"Klikkaa käyttäjänimiä tai toimintoja suodattaaksesi listaa. Klikkaa profiilikuvaa siirtyäksesi käyttäjäsivulle.","clear_filters":"Näytä kaikki","staff_user":"Palstan edustaja","target_user":"Kohteena ollut käyttäjä","subject":"Otsikko","when":"Milloin","context":"Konteksti","details":"Yksityiskohdat","previous_value":"Edellinen","new_value":"Uusi","diff":"Ero","show":"Näytä","modal_title":"Yksityiskohdat","no_previous":"Aiempaa arvoa ei ole.","deleted":"Uutta arvoa ei ole. Tietue poistettiin.","actions":{"delete_user":"poista käyttäjä","change_trust_level":"vaihda luottamustasoa","change_username":"vaihda käyttäjätunnus","change_site_setting":"muuta sivuston asetusta","change_site_customization":"vaihda sivuston mukautusta","delete_site_customization":"poista sivuston mukautus","change_site_text":"muutos sivuston teksteissä","suspend_user":"hyllytä käyttäjä","unsuspend_user":"poista hyllytys","grant_badge":"myönnä arvomerkki","revoke_badge":"peru arvomerkki","check_email":"tarkista sähköposti","delete_topic":"poista ketju","delete_post":"poista viesti","impersonate":"esiinny käyttäjänä","anonymize_user":"anonymisoi käyttäjä","roll_up":"Kääri IP estot","change_category_settings":"muuta alueen asetuksia","delete_category":"poista alue","create_category":"luo alue","block_user":"estä käyttäjä","unblock_user":"poista esto","grant_admin":"myönnä ylläpitäjän oikeudet","revoke_admin":"peru ylläpitäjän oikeudet","grant_moderation":"myönnä valvojan oikeudet","revoke_moderation":"peru valvojan oikeudet","backup_operation":"varmuuskopiointi","deleted_tag":"poistettu tunniste","renamed_tag":"uudelleen nimetty tunniste","revoke_email":"peru sähköpostiosoite"}},"screened_emails":{"title":"Seulottavat sähköpostiosoitteet","description":"Uuden käyttäjätunnuksen luonnin yhteydessä annettua sähköpostiosoitetta verrataan alla olevaan listaan ja tarvittaessa tunnuksen luonti joko estetään tai suoritetaan muita toimenpiteitä.","email":"Sähköpostiosoite","actions":{"allow":"Salli"}},"screened_urls":{"title":"Seulottavat URL:t","description":"Tässä listattavat URL:t ovat olleet roskapostittajiksi tunnistettujen käyttäjien käytössä.","url":"URL-osoite","domain":"Verkkotunnus"},"screened_ips":{"title":"Seulottavat IP:t","description":"IP-osoitteet joita tarkkaillaan. Valitse \"Salli\" lisätäksesi osoitteen ohitettavien listalle.","delete_confirm":"Oletko varma, että haluat poistaa tämän säännön osoitteelle %{ip_address}?","roll_up_confirm":"Oletko varma, että haluat yhdistää seulottavat IP-osoitteet aliverkoiksi?","rolled_up_some_subnets":"Porttikieltojen IP osoitteet käärittiin onnistuneesti näiksi aliverkoiksi: %{subnets}.","rolled_up_no_subnet":"Mitään käärittävää ei ollut.","actions":{"block":"Estä","do_nothing":"Salli","allow_admin":"Salli ylläpitäjä"},"form":{"label":"Uusi:","ip_address":"IP-osoite","add":"Lisää","filter":"Etsi"},"roll_up":{"text":"Kääri","title":"Luo uusia aliverkkojen laajuisia porttikieltoja, jos kieltoja on asetettu vähintään 'min_ban_entries_for_roll_up' asetuksen määrä."}},"logster":{"title":"Virhelokit"}},"impersonate":{"title":"Esiinny käyttäjänä","help":"Tällä työkalulla voi esiintyä toisena käyttäjänä virheiden paikantamista varten. Sinun täytyy kirjautua ulos, kun olet valmis.","not_found":"Käyttäjää ei löydy.","invalid":"Pahoittelut, et voi esiintyä tuona käyttäjänä."},"users":{"title":"Käyttäjät","create":"Lisää ylläpitäjä","last_emailed":"Viimeksi lähetetty sähköpostia","not_found":"Pahoittelut, tuota käyttäjänimeä ei löydy järjestelmästä.","id_not_found":"Pahoittelut, tuota käyttäjätunnusta ei löydy järjestelmästä.","active":"Aktiivinen","show_emails":"Näytä sähköpostit","nav":{"new":"Uudet","active":"Aktiiviset","pending":"Odottaa","staff":"Henkilökunta","suspended":"Hyllytetyt","blocked":"Estetyt","suspect":"Epäilty"},"approved":"Hyväksytty?","approved_selected":{"one":"hyväksy käyttäjä","other":"hyväksy käyttäjiä ({{count}})"},"reject_selected":{"one":"torju käyttäjä","other":"torju ({{count}}) käyttäjää"},"titles":{"active":"Viimeksi aktiiviset käyttäjät","new":"Uudet käyttäjät","pending":"Hyväksymistä odottavat käyttäjät","newuser":"Luottamustason 0 käyttäjät (Tulokas)","basic":"Luottamustason 1 käyttäjät (Haastaja)","member":"Luottamustason 2 käyttäjät (Konkari)","regular":"Luottamustason 3 käyttäjät (Mestari)","leader":"Luottamustason 4 käyttäjät (Johtaja)","staff":"Henkilökunta","admins":"Ylläpitäjät","moderators":"Valvojat","blocked":"Estetyt käyttäjät","suspended":"Hyllytetyt käyttäjät","suspect":"Epäillyt käyttäjät"},"reject_successful":{"one":"Yksi käyttäjä torjuttiin.","other":"({{count}}) käyttäjää torjuttiin."},"reject_failures":{"one":"Yhden käyttäjän torjuminen epäonnistui.","other":"({{count}}) käyttäjän torjuminen epäonnistui."},"not_verified":"Todentamaton","check_email":{"title":"Paljasta tämän käyttäjän sähköpostiosoite","text":"Näytä"}},"user":{"suspend_failed":"Jotain meni vikaan tätä käyttäjää hyllyttäessä: {{error}}","unsuspend_failed":"Jotain meni vikaan hyllytystä poistettaessa: {{error}}","suspend_duration":"Kuinka pitkäksi aikaa käyttäjä hyllytetään?","suspend_duration_units":"(päivää)","suspend_reason_label":"Miksi hyllytät käyttäjän? Tämä teksti \u003cb\u003eon näkyvillä julkisesti\u003c/b\u003e käyttäjän profiilisivulla ja näytetään käyttäjälle kun hän kirjautuu sisään. Pidä siis viesti lyhyenä.","suspend_reason":"Syy","suspended_by":"Käyttäjän hyllytti","delete_all_posts":"Poista kaikki viestit","suspend":"Hyllytä","unsuspend":"Poista hyllytys","suspended":"Hyllytetty?","moderator":"Valvoja?","admin":"Ylläpitäjä?","blocked":"Estetty?","staged":"Luotu?","show_admin_profile":"Ylläpito","edit_title":"Muokkaa nimikettä","save_title":"Tallenna nimike","refresh_browsers":"Pakota sivun uudelleen lataus","refresh_browsers_message":"Viesti lähetetty kaikille asiakkaille!","show_public_profile":"Näytä julkinen profiili","impersonate":"Esiinny käyttäjänä","ip_lookup":"IP haku","log_out":"Kirjaa ulos","logged_out":"Käyttäjä on kirjautunut ulos kaikilla laitteilla","revoke_admin":"Peru ylläpitäjän oikeudet","grant_admin":"Myönnä ylläpitäjän oikeudet","revoke_moderation":"Peru valvojan oikeudet","grant_moderation":"Myönnä valvojan oikeudet","unblock":"Poista esto","block":"Estä","reputation":"Maine","permissions":"Oikeudet","activity":"Toiminta","like_count":"Tykkäyksiä annettu / saatu","last_100_days":"edellisen 100 päivän aikana","private_topics_count":"Yksityisviestit","posts_read_count":"Luettuja viestejä","post_count":"Kirjoitettuja viestejä","topics_entered":"Katseltuja ketjuja","flags_given_count":"Annettuja lippuja","flags_received_count":"Saatuja lippuja","warnings_received_count":"Saatuja varoituksia","flags_given_received_count":"Lippuja annettu / saatu","approve":"Hyväksy","approved_by":"hyväksyjä","approve_success":"Käyttäjä on hyväksytty ja hänelle on lähetetty sähköpostilla ohjeet tilin vahvistamiseen.","approve_bulk_success":"Kaikki valitut käyttäjät on hyväksytty ja heille on lähetetty ilmoitus.","time_read":"Lukuaika","anonymize":"Anonymisoi käyttäjä","anonymize_confirm":"Oletko VARMA, että halua anonymisoida tämän käyttäjätilin? Tämä muuttaa käyttäjänimen ja sähköpostiosoitteen, sekä tyhjentää kaikki profiilitiedot.","anonymize_yes":"Kyllä, anonymisoi tämä käyttäjätili","anonymize_failed":"Käyttäjätilin anonymisointi ei onnistunut.","delete":"Poista käyttäjä","delete_forbidden_because_staff":"Ylläpitäjiä ja valvojia ei voi poistaa.","delete_posts_forbidden_because_staff":"Ylläpitäjien ja valvojien kaikkia viestejä ei voi poistaa.","delete_forbidden":{"one":"Käyttäjiä ei voi poistaa jos heillä on kirjoitettuja viestejä. Poista ensin viestit ennen käyttäjätilin poistamista. (Vanhempia viestejä, kuin %{count} päivä ei voi poistaa)","other":"Käyttäjää ei voi poistaa jos hänellä on kirjoitettuja viestejä. Poista viestit ennen käyttäjätilin poistamista. (Yli %{count} päivää vanhoja viestejä ei voi poistaa.)"},"cant_delete_all_posts":{"one":"Kaikkia viestejä ei voi poistaa. Jotkin viestit ovat enemmän kuin %{count} päivän vanhoja. (Asetus delete_user_max_post_age)","other":"Kaikkia viestejä ei voi poistaa. Jotkin viestit ovat enemmän kuin %{count} päivää vanhoja. (Asetus delete_user_max_post_age)"},"cant_delete_all_too_many_posts":{"one":"Kaikkia viestejä ei voi poistaa, koska käyttäjällä on enemmän kuin 1 viesti. (delete_all_posts_max)","other":"Kaikkia viestejä ei voi poistaa, koska käyttäjällä on enemmän kuin %{count} viestiä. (delete_all_posts_max)"},"delete_confirm":"Oletko VARMA, että haluat poistaa tämän käyttäjän? Toiminto on lopullinen!","delete_and_block":"Poista ja \u003cb\u003eestä\u003c/b\u003e tämä sähköposti ja IP-osoite.","delete_dont_block":"Ainoastaan poista","deleted":"Käyttäjä poistettiin.","delete_failed":"Käyttäjän poistanen ei onnistunut. Varmista, että kaikki käyttäjän viestit on poistettu.","send_activation_email":"Lähetä vahvistussähköposti.","activation_email_sent":"Vahvistussähköposti on lähetetty.","send_activation_email_failed":"Uuden vahvistussähköpostin lähettämisessä tapahtui virhe: %{error}","activate":"Vahvista käyttäjätili","activate_failed":"Käyttäjätilin vahvistaminen ei onnistunut.","deactivate_account":"Poista käyttäjätili käytöstä","deactivate_failed":"Käyttäjätilin poistaminen käytöstä ei onnistunut.","unblock_failed":"Käyttäjätilin eston poistaminen ei onnistunut.","block_failed":"Käyttäjätilin estäminen ei onnistunut.","block_confirm":"Oletko varma, että haluat estää tämän käyttäjän? He eivät voi luoda uusia aiheita tai viestejä.","block_accept":"Kyllä, estä tämä käyttäjä","bounce_score":"Palautuspisteet","reset_bounce_score":{"label":"Palauta","title":"Palauta palautuspisteiksi 0"},"deactivate_explanation":"Käytöstä poistetun käyttäjän täytyy uudelleen vahvistaa sähköpostiosoitteensa.","suspended_explanation":"Hyllytetty käyttäjä ei voi kirjautua sisään.","block_explanation":"Estetty käyttäjä ei voi luoda viestejä tai ketjuja.","staged_explanation":"Automaattisesti luotu käyttäjä voi kirjoittaa vain tiettyihin ketjuihin sähköpostin välityksellä.","bounce_score_explanation":{"none":"Tästä sähköpostiosoitteesta ei ole tullut palautuksia viime aikoina","some":"Tästä sähköpostiosoitteesta on tullut joitakin palautuksia viime aikoina","threshold_reached":"Vastaanotettiin liian monta palautusta tästä sähköpostiosoiteesta"},"trust_level_change_failed":"Käyttäjän luottamustason vaihtamisessa tapahtui virhe.","suspend_modal_title":"Hyllytä käyttäjä","trust_level_2_users":"Käyttäjät luottamustasolla 2","trust_level_3_requirements":"Luottamustaso 3 vaatimukset","trust_level_locked_tip":"luottamustaso on lukittu, järjestelmä ei ylennä tai alenna käyttäjää","trust_level_unlocked_tip":"luottamustaso on lukitsematon, järjestelmä voi ylentää tai alentaa käyttäjän","lock_trust_level":"Lukitse luottamustaso","unlock_trust_level":"Avaa luottamustason lukitus","tl3_requirements":{"title":"Vaatimukset luottamustasolle 3.","value_heading":"Arvo","requirement_heading":"Vaatimus","visits":"Vierailua","days":"päivää","topics_replied_to":"Moneenko ketjuun vastannut","topics_viewed":"Avatut ketjut","topics_viewed_all_time":"Avatut ketjut (kaikkina aikoina)","posts_read":"Luetut viestit","posts_read_all_time":"Luetut viestit (kaikkina aikoina)","flagged_posts":"Liputettuja viestejä","flagged_by_users":"Liputtaneet käyttäjät","likes_given":"Annettuja tykkäyksiä","likes_received":"Saatuja tykkäyksiä","likes_received_days":"Saadut tykkäykset: uniikit päivät","likes_received_users":"Saadut tykkäykset: uniikit käyttäjät","qualifies":"Täyttää luottamustaso 3:n vaatimukset.","does_not_qualify":"Ei täytä luottamustaso 3:n vaatimuksia.","will_be_promoted":"Ylennetään piakkoin.","will_be_demoted":"Alennetaan piakkoin.","on_grace_period":"Tällä hetkellä siirtymäajalla, ei alenneta","locked_will_not_be_promoted":"Luottamsutaso lukittu. Ei koskaan ylennetä.","locked_will_not_be_demoted":"Luottamustaso lukittu. Ei koskaan alenneta."},"sso":{"title":"Kertakirjautuminen","external_id":"Ulkopuolinen ID","external_username":"Käyttäjätunnus","external_name":"Nimi","external_email":"Sähköposti","external_avatar_url":"Profiilikuvan URL"}},"user_fields":{"title":"Käyttäjäkentät","help":"Lisää kenttiä jotka käyttäjät voivat täyttää.","create":"Luo käyttäjäkenttä","untitled":"Nimetön","name":"Kentän nimi","type":"Kentän tyyppi","description":"Kentän kuvaus","save":"Tallenna","edit":"Muokkaa","delete":"Poista","cancel":"Peruuta","delete_confirm":"Oletko varma, että haluat poistaa tämän käyttäjäkentän?","options":"Asetukset","required":{"title":"Pakollinen täyttää, kun luodaan uusi tili?","enabled":"pakollinen","disabled":"vapaaehtoinen"},"editable":{"title":"Muokattavissa tilin luomisen jälkeen?","enabled":"muokattavissa","disabled":"ei muokattavissa"},"show_on_profile":{"title":"Näytä julkisessa profiilissa?","enabled":"näytetään profiilissa","disabled":"ei näytetä profiilissa"},"show_on_user_card":{"title":"Näytä käyttäjäkortilla?","enabled":"näytä käyttäjäkortilla","disabled":"ei näytetä käyttäjäkortilla"},"field_types":{"text":"Tekstikenttä","confirm":"Vahvistus","dropdown":"Alasvetovalikko"}},"site_text":{"description":"Omalla palstallasi voit muokata mitä tahansa tekstisisältöä. Käytä alla sijaitsevaa hakutoimintoa:","search":"Hae tekstinpätkää, jota haluaisit muokata","title":"Tekstit","edit":"muokkaa","revert":"Kumoa muutokset","revert_confirm":"Oletko varma, että haluat kumota tekemäsi muutokset?","go_back":"Takaisin hakuun","recommended":"On suositeltavaa muokata seuraavaa tekstiä tarpeidesi mukaan:","show_overriden":"Näytä vain muokatut"},"site_settings":{"show_overriden":"Näytä vain muokatut","title":"Asetukset","reset":"nollaa","none":"ei mitään","no_results":"Ei tuloksia.","clear_filter":"Tyhjennä","add_url":"Lisää URL","add_host":"lisää host","categories":{"all_results":"Kaikki","required":"Pakolliset","basic":"Perusasetukset","users":"Käyttäjät","posting":"Kirjoittaminen","email":"Sähköposti","files":"Tiedostot","trust":"Luottamustasot","security":"Turvallisuus","onebox":"Onebox","seo":"SEO","spam":"Roskaposti","rate_limits":"Rajat","developer":"Kehittäjä","embedding":"Upottaminen","legal":"Säännöt","uncategorized":"Muut","backups":"Varmuuskopiot","login":"Kirjautuminen","plugins":"Lisäosat","user_preferences":"Käyttäjäasetukset","tags":"Tunnisteet"}},"badges":{"title":"Arvomerkit","new_badge":"Uusi arvomerkki","new":"Uusi","name":"Nimi","badge":"Arvomerkki","display_name":"Nimi","description":"Kuvaus","long_description":"Pitkä kuvaus","badge_type":"Arvomerkin tyyppi","badge_grouping":"Ryhmä","badge_groupings":{"modal_title":"Arvomerkkien ryhmitys"},"granted_by":"Myöntäjä","granted_at":"Myönnetty","reason_help":"(Linkki viestiin tai ketjuun)","save":"Tallenna","delete":"Poista","delete_confirm":"Oletko varma, että haluat poistaa tämän arvomerkin?","revoke":"Peruuta","reason":"Syy","expand":"Laajenna \u0026hellip;","revoke_confirm":"Oletko varma, että haluat peruuttaa arvomerkin?","edit_badges":"Muokkaa arvomerkkejä","grant_badge":"Myönnä arvomerkki","granted_badges":"Myönnetyt arvomerkit","grant":"Myönnä","no_user_badges":"%{name} ei ole saanut yhtään arvomerkkiä.","no_badges":"Myönnettäviä arvomerkkejä ei ole.","none_selected":"Valitse arvomerkki aloittaaksesi","allow_title":"Salli arvomerkin käyttäminen tittelinä","multiple_grant":"Voidaan myöntää useita kertoja","listable":"Näytä arvomerkki julkisella arvomerkkisivulla","enabled":"Ota arvomerkki käyttöön","icon":"Ikoni","image":"Kuva","icon_help":"Käytä joko Font Awesome -luokkaa tai kuvan URL-osoitetta","query":"Arvomerkkien haku tietokannasta (SQL)","target_posts":"Tietokantakyselyn kohdeviestit","auto_revoke":"Aja kumoamis-ajo päivittäin","show_posts":"Näytä arvomerkin tuonut viesti arvomerkkisivulla","trigger":"Laukaisija","trigger_type":{"none":"Päivitä päivittäin","post_action":"Kun käyttäjä toimii viestin suhteen","post_revision":"Kun käyttäjä muokkaa viestiä tai luo viestin","trust_level_change":"Kun käyttäjän luottamustaso vaihtuu","user_change":"Kun käyttäjä luodaan tai sitä muokataan","post_processed":"Sen jälkeen, kun viesti on käsitelty"},"preview":{"link_text":"Esikatsele myönnettäviä arvomerkkejä","plan_text":"Esikatsele query plan","modal_title":"Arvomerkin tietokantakyselyn esikatselu","sql_error_header":"Kyselyn käsittelyssä tapahtui virhe.","error_help":"Apua arvomerkkien tietokantakyselyihin saat seuraavista linkeistä-","bad_count_warning":{"header":"VAROITUS!","text":"Myöntöjen näytteitä puuttuu. Tämä tapahtuu, kun arvomerkin kysely palauttaa käyttäjä ID:n tai viestin ID:n jota ei ole olemassa. Tämä voi johtaa odottamattomiin seurauksiin myöhemmin - tarkista kysely uudestaan."},"no_grant_count":"Ei arvomerkkejä myönnettäväksi","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e arvomerkkiä odottaa myöntämistä.","other":"\u003cb\u003e%{count}\u003c/b\u003e arvomerkkiä odottaa myöntämistä."},"sample":"Esimerkki:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e viestille ketjussa %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e viestille ketjussa %{link} \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Lisää uusi emoji joka on kaikkien käytettävissä. (Voit raahata useita tiedostoja kerralla)","add":"Lisää uusi emoji","name":"Nimi","image":"Kuva","delete_confirm":"Oletko varma, että haluat poistaa emojin :%{name}:?"},"embedding":{"get_started":"Jos haluat upottaa Discoursen toiselle sivustolle, aloita lisäämällä isäntä.","confirm_delete":"Oletko varma, että haluat poistaa tämän isännän?","sample":"Käytä alla olevaa HTML-koodia sivustollasi luodaksesi ja upottaaksesi discourse ketjuja. Korvaa \u003cb\u003eREPLACE_ME\u003c/b\u003e upotettavan sivun kanonisella URL-osoitteella.","title":"Upottaminen","host":"Sallitut isännät","edit":"muokkaa","category":"Julkaise alueelle","add_host":"Lisää isäntä","settings":"Upotuksen asetukset","feed_settings":"Syötteen asetukset","feed_description":"Tarjoamalla RSS/ATOM syötteen sivustollesi, voit lisätä Discoursen kykyä tuoda sisältöä.","crawling_settings":"Crawlerin asetukset","crawling_description":"Kun Discourse luo ketjuja kirjoituksistasi, se yrittää jäsentää kirjoitustesi sisältöä HTML:stä, jos RSS/ATOM syötettä ei ole tarjolla,  Joskus kirjoitusten sisällön poimiminen on haastavaa, joten tarjoamme mahdollisuuden määrittää CSS sääntöjä sen helpottamiseksi.","embed_by_username":"Käyttäjänimi ketjun luomiseksi","embed_post_limit":"Upotettavien viestien maksimimäärä","embed_username_key_from_feed":"Avain, jolla erotetaan Discourse-käyttäjänimi syötteestä","embed_truncate":"Typistä upotetut viestit","embed_whitelist_selector":"CSS valitsin elementeille, jotka sallitaan upotetuissa viesteissä","embed_blacklist_selector":"CSS valitstin elementeille, jotka poistetaan upotetuista viesteistä","embed_classname_whitelist":"Sallitut CSS luokat","feed_polling_enabled":"Tuo kirjoitukset RSS/ATOM syötteen avulla","feed_polling_url":"RSS/ATOM syötteen URL","save":"Tallenna upotusasetukset"},"permalink":{"title":"Ikilinkit","url":"URL","topic_id":"Ketjun ID","topic_title":"Ketju","post_id":"Viestin ID","post_title":"Viesti","category_id":"Alueen ID","category_title":"Alue","external_url":"Ulkoinen URL","delete_confirm":"Oletko varma, että haluat poistaa tämän ikilinkin?","form":{"label":"Uusi:","add":"Lisää","filter":"Etsi (URL tai ulkoinen URL)"}}}}},"en":{"js":{"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write"},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}."},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'fi';
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
//! locale : finnish (fi)
//! author : Tarmo Aidantausta : https://github.com/bleadof

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var numbersPast = 'nolla yksi kaksi kolme neljä viisi kuusi seitsemän kahdeksan yhdeksän'.split(' '),
        numbersFuture = [
            'nolla', 'yhden', 'kahden', 'kolmen', 'neljän', 'viiden', 'kuuden',
            numbersPast[7], numbersPast[8], numbersPast[9]
        ];
    function translate(number, withoutSuffix, key, isFuture) {
        var result = '';
        switch (key) {
        case 's':
            return isFuture ? 'muutaman sekunnin' : 'muutama sekunti';
        case 'm':
            return isFuture ? 'minuutin' : 'minuutti';
        case 'mm':
            result = isFuture ? 'minuutin' : 'minuuttia';
            break;
        case 'h':
            return isFuture ? 'tunnin' : 'tunti';
        case 'hh':
            result = isFuture ? 'tunnin' : 'tuntia';
            break;
        case 'd':
            return isFuture ? 'päivän' : 'päivä';
        case 'dd':
            result = isFuture ? 'päivän' : 'päivää';
            break;
        case 'M':
            return isFuture ? 'kuukauden' : 'kuukausi';
        case 'MM':
            result = isFuture ? 'kuukauden' : 'kuukautta';
            break;
        case 'y':
            return isFuture ? 'vuoden' : 'vuosi';
        case 'yy':
            result = isFuture ? 'vuoden' : 'vuotta';
            break;
        }
        result = verbalNumber(number, isFuture) + ' ' + result;
        return result;
    }
    function verbalNumber(number, isFuture) {
        return number < 10 ? (isFuture ? numbersFuture[number] : numbersPast[number]) : number;
    }

    var fi = moment.defineLocale('fi', {
        months : 'tammikuu_helmikuu_maaliskuu_huhtikuu_toukokuu_kesäkuu_heinäkuu_elokuu_syyskuu_lokakuu_marraskuu_joulukuu'.split('_'),
        monthsShort : 'tammi_helmi_maalis_huhti_touko_kesä_heinä_elo_syys_loka_marras_joulu'.split('_'),
        weekdays : 'sunnuntai_maanantai_tiistai_keskiviikko_torstai_perjantai_lauantai'.split('_'),
        weekdaysShort : 'su_ma_ti_ke_to_pe_la'.split('_'),
        weekdaysMin : 'su_ma_ti_ke_to_pe_la'.split('_'),
        longDateFormat : {
            LT : 'HH.mm',
            LTS : 'HH.mm.ss',
            L : 'DD.MM.YYYY',
            LL : 'Do MMMM[ta] YYYY',
            LLL : 'Do MMMM[ta] YYYY, [klo] HH.mm',
            LLLL : 'dddd, Do MMMM[ta] YYYY, [klo] HH.mm',
            l : 'D.M.YYYY',
            ll : 'Do MMM YYYY',
            lll : 'Do MMM YYYY, [klo] HH.mm',
            llll : 'ddd, Do MMM YYYY, [klo] HH.mm'
        },
        calendar : {
            sameDay : '[tänään] [klo] LT',
            nextDay : '[huomenna] [klo] LT',
            nextWeek : 'dddd [klo] LT',
            lastDay : '[eilen] [klo] LT',
            lastWeek : '[viime] dddd[na] [klo] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s päästä',
            past : '%s sitten',
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

    return fi;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D. MMM'); };
moment.fn.shortDate = function(){ return this.format('D. MMMM[ta] YYYY'); };
moment.fn.longDate = function(){ return this.format('D. MMMM[ta] YYYY, H:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
