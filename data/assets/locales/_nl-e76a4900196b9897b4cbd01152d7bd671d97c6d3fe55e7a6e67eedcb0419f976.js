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
r += "Er ";
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
r += "is <a href='/unread'>1 ongelezen</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "zijn <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ongelezen</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/new'>1 nieuw</a> topic";
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
r += "zijn ";
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
})() + " nieuwe</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " over, of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "blader door andere topics in ";
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
r += "Dit topic heeft ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 antwoord";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " antwoorden";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "met een hoge likes per bericht verhouding";
return r;
},
"med" : function(d){
var r = "";
r += "met een erg hoge likes per bericht verhouding";
return r;
},
"high" : function(d){
var r = "";
r += "met een zeer hoge likes per bericht verhouding";
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

MessageFormat.locale.nl = function ( n ) {
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
I18n.translations = {"nl":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} geleden","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}u"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1j","other":"%{count}j"},"over_x_years":{"one":"\u003e 1j","other":"\u003e %{count}j"},"almost_x_years":{"one":"1j","other":"%{count}j"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} mins"},"x_hours":{"one":"1 uur","other":"%{count} uren"},"x_days":{"one":"1 dag","other":"%{count} dagen"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 min geleden","other":"%{count} mins geleden"},"x_hours":{"one":"1 uur geleden","other":"%{count} uren geleden"},"x_days":{"one":"1 day geleden","other":"%{count} dagen geleden"}},"later":{"x_days":{"one":"1 dag later","other":"%{count} dagen later"},"x_months":{"one":"1 maand later","other":"%{count} maanden later"},"x_years":{"one":"1 jaar later","other":"%{count} jaren later"}},"previous_month":"Vorige maand","next_month":"Volgende maand"},"share":{"topic":"deel een link naar deze topic","post":"bericht #%{postNumber}","close":"sluit","twitter":"deel deze link op Twitter","facebook":"deel deze link op Facebook","google+":"deel deze link op Google+","email":"deel deze link via e-mail"},"action_codes":{"public_topic":"Topic openbaar gemaakt op %{when}","private_topic":"Topic als privé gemarkeerd op %{when}","split_topic":"deze topic splitsen %{when}","invited_user":"uitgenodigd %{who} %{when}","invited_group":"uitgenodigd %{who} %{when}","removed_user":"verwijderd %{who} %{when}","removed_group":"verwijderd %{who} %{when}","autoclosed":{"enabled":"gesloten %{when}","disabled":"geopend %{when}"},"closed":{"enabled":"gesloten %{when}","disabled":"geopend %{when}"},"archived":{"enabled":"gearchiveerd %{when}","disabled":"gedearchiveerd %{when}"},"pinned":{"enabled":"vastgepind %{when}","disabled":"niet vastgepind %{when}"},"pinned_globally":{"enabled":"globaal vastgepind %{when}","disabled":"niet vastgepind %{when}"},"visible":{"enabled":"zichtbaar %{when}","disabled":"niet zichtbaar %{when}"}},"topic_admin_menu":"Adminacties voor topic","emails_are_disabled":"Alle uitgaande e-mails zijn uitgeschakeld door een beheerder. Geen enkele vorm van e-mail notificatie wordt verstuurd.","bootstrap_mode_enabled":"Om het lanceren van een website makkelijker te maken, zit je nu in bootstrapmodus. Alle nieuwe gebruikers krijgen trustlevel 1 en zullen dagelijkse e-mailupdates krijgen. Dit wordt automatisch uitgeschakeld wanneer het totale gebruikersaantal hoger dan %{min_users} gebruikers wordt.","bootstrap_mode_disabled":"Bootstrap modus zal uitgeschakeld worden in de komende 24 uur.","s3":{"regions":{"us_east_1":"VS Oost (N. Virginia)","us_west_1":"VS West (N. California)","us_west_2":"VS West (Oregon)","us_gov_west_1":"AWS GovCloud (VS)","eu_west_1":"EU (Ierland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Azië Pacifisch (Singapore)","ap_southeast_2":"Azië Pacifisch (Sydney)","ap_south_1":"Azië Pacifisch (Bombay)","ap_northeast_1":"Azië Pacifisch (Tokio)","ap_northeast_2":"Azië Pacifisch (Seoel)","sa_east_1":"Zuid-Amerika (Sao Paulo)","cn_north_1":"China (Peking)"}},"edit":"bewerk de titel en categorie van deze topic","not_implemented":"Die functie is helaas nog niet beschikbaar. Sorry!","no_value":"Nee","yes_value":"Ja","generic_error":"Sorry, er is iets fout gegaan.","generic_error_with_reason":"Er is iets fout gegaan: %{error}","sign_up":"Aanmelden","log_in":"Inloggen","age":"Leeftijd","joined":"Lid sinds","admin_title":"Beheer","flags_title":"Meldingen","show_more":"meer...","show_help":"opties","links":"Links","links_lowercase":{"one":"link","other":"links"},"faq":"FAQ","guidelines":"Richtlijnen","privacy_policy":"Privacy Policy","privacy":"Privacy","terms_of_service":"Algemene Voorwaarden","mobile_view":"Mobiele versie","desktop_view":"Desktop weergave","you":"Jij","or":"of","now":"zonet","read_more":"lees verder","more":"Meer","less":"Minder","never":"nooit","every_30_minutes":"elke dertig minuten","every_hour":"elk uur","daily":"dagelijks","weekly":"wekelijks","every_two_weeks":"elke twee weken","every_three_days":"elke drie dagen","max_of_count":"maximaal {{count}}","alternation":"of","character_count":{"one":"{{count}} teken","other":"{{count}} tekens"},"suggested_topics":{"title":"Aanbevolen topics","pm_title":"Voorgestelde berichten"},"about":{"simple_title":"Over","title":"Over %{title}","stats":"Site statistieken","our_admins":"Onze beheerders","our_moderators":"Onze moderators","stat":{"all_time":"Sinds het begin","last_7_days":"Afgelopen 7 dagen","last_30_days":"Afgelopen 30 dagen"},"like_count":"Likes","topic_count":"Topics","post_count":"Berichten","user_count":"Nieuwe leden","active_user_count":"Actieve leden","contact":"Neem contact met ons op","contact_info":"In het geval van een kritieke kwestie of dringende vraagstukken in verband met deze site, neem contact op met ons op via %{contact_info}."},"bookmarked":{"title":"Voeg toe aan favorieten","clear_bookmarks":"Verwijder favorieten","help":{"bookmark":"Klik om het eerste bericht van deze topic toe te voegen aan je favorieten","unbookmark":"Klik om alle favorieten in deze topic te verwijderen"}},"bookmarks":{"not_logged_in":"sorry, je moet ingelogd zijn om berichten aan je favorieten toe te kunnen voegen","created":"je hebt dit bericht aan je favorieten toegevoegd","not_bookmarked":"je hebt dit bericht gelezen; klik om het aan je favorieten toe te voegen","last_read":"dit is het laatste bericht dat je gelezen hebt; klik om het aan je favorieten toe te voegen","remove":"Verwijder favoriet","confirm_clear":"Weet je zeker dat je alle favorieten in deze topic wilt verwijderen?"},"topic_count_latest":{"one":"{{count}} nieuwe of aangepaste discussie.","other":"{{count}} nieuwe of bijgewerkte topics."},"topic_count_unread":{"one":"{{count}} ongelezen discussie.","other":"{{count}} ongelezen topics."},"topic_count_new":{"one":"{{count}} nieuwe discussie. ","other":"{{count}} nieuwe topics."},"click_to_show":"Klik om te bekijken.","preview":"voorbeeld","cancel":"annuleer","save":"Bewaar wijzigingen","saving":"Wordt opgeslagen...","saved":"Opgeslagen!","upload":"Upload","uploading":"Uploaden...","uploading_filename":"Uploaden van {{filename}}...","uploaded":"Geupload!","enable":"Inschakelen","disable":"Uitschakelen","undo":"Herstel","revert":"Zet terug","failed":"Mislukt","switch_to_anon":"Start anonieme modus","switch_from_anon":"Verlaat Anonieme Modus","banner":{"close":"Verberg deze banner.","edit":"Wijzig deze banner \u003e\u003e"},"choose_topic":{"none_found":"Geen topics gevonden.","title":{"search":"Zoek naar een topic op naam, url of id:","placeholder":"typ hier de titel van de topic"}},"queue":{"topic":"Topic:","approve":"Accepteer","reject":"Weiger","delete_user":"Verwijder gebruiker","title":"Heeft goedkeuring nodig","none":"Er zijn geen berichten om te beoordelen","edit":"Wijzig","cancel":"Annuleer","view_pending":"bekijk wachtende berichten","has_pending_posts":{"one":"Voor deze topic staat \u003cb\u003e1\u003c/b\u003e bericht klaar om goedgekeurd te worden","other":"Voor deze topic staan \u003cb\u003e{{count}}\u003c/b\u003e berichten klaar om goedgekeurd te worden"},"confirm":"Sla wijzigingen op","delete_prompt":"Weet je zeker dat je \u003cb\u003e%{username}\u003c/b\u003e wilt verwijderen? Dit verwijdert al hun berichten en blokkeert hun IP-adres en e-mailadres.","approval":{"title":"Bericht vereist goedkeuring","description":"We hebben je nieuwe bericht ontvangen, maar deze moet eerst goedgekeurd worden door een moderator voordat deze zichtbaar wordt. Wees a.u.b. geduldig.","pending_posts":{"one":"Je hebt \u003cstrong\u003e1\u003c/strong\u003e bericht in afwachting.","other":"Je hebt \u003cstrong\u003e{{count}}\u003c/strong\u003e berichten in afwachting."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e plaatste \u003ca href='{{topicUrl}}'\u003edeze topic\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eJij\u003c/a\u003e plaatste \u003ca href='{{topicUrl}}'\u003edeze topic\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e reageerde op \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eJij\u003c/a\u003e reageerde op \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e reageerde op \u003ca href='{{topicUrl}}'\u003edeze topic\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eJij\u003c/a\u003e reageerde op \u003ca href='{{topicUrl}}'\u003edeze topic\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e noemde \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e noemde \u003ca href='{{user2Url}}'\u003ejou\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eJij\u003c/a\u003e noemde \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Geplaatst door \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Geplaatst door \u003ca href='{{userUrl}}'\u003ejou\u003c/a\u003e","sent_by_user":"Verzonden door \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Verzonden door \u003ca href='{{userUrl}}'\u003ejou\u003c/a\u003e"},"directory":{"filter_name":"filter op gebruikersnaam","title":"Leden","likes_given":"Gegeven","likes_received":"Ontvangen","topics_entered":"Gezien","topics_entered_long":"Topics bekeken","time_read":"Tijd gelezen","topic_count":"Topics","topic_count_long":"Topics gemaakt","post_count":"Antwoorden","post_count_long":"Reacties geplaatst","no_results":"Geen resultaten gevonden.","days_visited":"Bezoeken","days_visited_long":"Dagen bezocht","posts_read":"Gelezen","posts_read_long":"Berichten gelezen","total_rows":{"one":"1 lid","other":"%{count} leden"}},"groups":{"empty":{"posts":"Er is geen enkel bericht door leden van deze groep.","members":"Er zijn geen leden in deze groep.","mentions":"Deze groep wordt niet benoemd.","messages":"Er zijn geen berichten voor deze groep.","topics":"Er is geen topic gemaakt door de leden van deze groep."},"add":"Voeg toe","selector_placeholder":"Voeg leden toe","owner":"eigenaar","visible":"Groep is zichtbaar voor alle gebruikers","index":"Groepen","title":{"one":"groep","other":"groepen"},"members":"Leden","topics":"Topics","posts":"Berichten","mentions":"Genoemd door","messages":"Berichten","alias_levels":{"title":"Wie kan deze groep een bericht sturen en taggen?","nobody":"Niemand","only_admins":"Alleen admins","mods_and_admins":"Alleen moderatoren and admins","members_mods_and_admins":"Alleen leden van de groep, moderatoren en admins","everyone":"Iedereen"},"trust_levels":{"title":"Trustlevel dat automatisch wordt toegekend aan nieuwe gebruikers:","none":"Geen"},"notifications":{"watching":{"title":"In de gaten houden","description":"Je krijgt een notificatie bij elke nieuwe post of bericht, en het aantal nieuwe reacties wordt weergeven."},"watching_first_post":{"title":"Eerste bericht in de gaten houden","description":"Je krijgt alleen een notificatie van de eerste post in elk nieuw topic in deze groep."},"tracking":{"title":"Volgen","description":"Je krijgt een notificatie wanneer iemand jouw @name noemt of reageert, en het aantal nieuwe reacties wordt weergeven."},"regular":{"title":"Normaal","description":"Je krijgt een notificatie wanneer iemand jouw @name noemt of reageert."},"muted":{"title":"Genegeerd","description":"Je krijgt geen notificatie over nieuwe topics in deze groep."}}},"user_action_groups":{"1":"Likes gegeven","2":"Likes ontvangen","3":"Favorieten","4":"Topics","5":"Reacties","6":"Reacties","7":"Genoemd","9":"Citaten","11":"Wijzigingen","12":"Verzonden items","13":"Inbox","14":"In behandeling"},"categories":{"all":"alle categorieën","all_subcategories":"alle","no_subcategory":"geen","category":"Categorie","category_list":"Toon categorieënlijst","reorder":{"title":"Categorieën herschikken ","title_long":"Reorganiseer de categorielijst","fix_order":"Posities vastzetten","fix_order_tooltip":"Niet alle categorieën hebben een unieke positie, dit resulteert soms in onverwachte resultaten.","save":"Volgorde opslaan","apply_all":"Toepassen","position":"Positie"},"posts":"Berichten","topics":"Topics","latest":"Laatste","latest_by":"Laatste door","toggle_ordering":"schakel sorteermethode","subcategories":"Subcategorieën","topic_stat_sentence":{"one":"%{count} nieuw topic in de afgelopen %{unit}.","other":"%{count} nieuwe topics in de afgelopen %{unit}."}},"ip_lookup":{"title":"IP-adres lookup","hostname":"Hostname","location":"Locatie","location_not_found":"(onbekend)","organisation":"Organisatie","phone":"Telefoon","other_accounts":"Andere accounts met dit IP-adres","delete_other_accounts":"Verwijder %{count}","username":"gebruikersnaam","trust_level":"TL","read_time":"leestijd","topics_entered":"topics ingevoerd","post_count":"# berichten","confirm_delete_other_accounts":"Weet je zeker dat je deze accounts wilt verwijderen?"},"user_fields":{"none":"(selecteer een optie)"},"user":{"said":"{{username}}:","profile":"Profiel","mute":"Negeer","edit":"Wijzig voorkeuren","download_archive":"Download mijn berichten","new_private_message":"Nieuw bericht","private_message":"Bericht","private_messages":"Berichten","activity_stream":"Activiteit","preferences":"Voorkeuren","expand_profile":"Uitklappen","bookmarks":"Favorieten","bio":"Over mij","invited_by":"Uitgenodigd door","trust_level":"Trustlevel","notifications":"Notificaties","statistics":"Statistieken ","desktop_notifications":{"label":"Desktopnotificaties","not_supported":"Notificaties worden niet ondersteund door deze browser. Sorry.","perm_default":"Notificaties aanzetten","perm_denied_btn":"Toestemming geweigerd","perm_denied_expl":"Je staat geen notificaties toe. Sta deze toe in je browserinstellingen.","disable":"Notificaties uitschakelen","enable":"Notificaties inschakelen","each_browser_note":"Let op: Je moet deze optie instellen voor elke browser die je gebruikt."},"dismiss_notifications":"Markeer alles als gelezen","dismiss_notifications_tooltip":"Markeer alle ongelezen berichten als gelezen","disable_jump_reply":"Niet naar je nieuwe bericht gaan na reageren","dynamic_favicon":"Laat aantal nieuwe / bijgewerkte topics zien in favicon","external_links_in_new_tab":"Open alle externe links in een nieuw tabblad","enable_quoting":"Activeer antwoord-met-citaat voor geselecteerde tekst","change":"verander","moderator":"{{user}} is een moderator","admin":"{{user}} is een beheerder","moderator_tooltip":"Deze gebruiker is een moderator","admin_tooltip":"Deze gebruiker is een admin","blocked_tooltip":"Deze gebruiker is geblokeerd","suspended_notice":"Deze gebruiker is geschorst tot {{date}}.","suspended_reason":"Reden: ","github_profile":"Github","email_activity_summary":"Activiteitensamenvatting","mailing_list_mode":{"label":"Mailinglijstmodus","enabled":"Schakel mailinglijstmodus in","instructions":"Deze instelling overschrijft de activiteitensamenvatting.\u003cbr /\u003e\nGenegeerde topics en categorieën zitten niet in deze e-mails.\n","daily":"Verzend dagelijkse updates","individual":"Verstuur een e-mail voor elk nieuw bericht","many_per_day":"Stuur mij een e-mail voor elk nieuw bericht (ongeveer {{dailyEmailEstimate}} per dag)","few_per_day":"Stuur mij een e-mail voor elk nieuw bericht (ongeveer 2 per dag)"},"tag_settings":"Tags","watched_tags":"In de gaten gehouden","watched_tags_instructions":"Je zal automatisch alle nieuwe topics met deze tags in de gaten houden. Je ontvangt notificaties bij nieuwe berichten en topics, naast de topic wordt het aantal nieuwe berichten weergegeven.","tracked_tags":"Gevolgd","tracked_tags_instructions":"Je volgt automatisch alle topics met deze tags. Naast de topic wordt het aantal nieuwe berichten weergegeven.","muted_tags":"Genegeerd","muted_tags_instructions":"Je ontvangt geen notificaties over nieuwe topics met deze tags, ze zullen niet verschijnen in Recent.","watched_categories":"In de gaten gehouden","watched_categories_instructions":"Je zal automatisch alle nieuwe topics in deze categorieën in de gaten houden. Je ontvangt notificaties bij nieuwe berichten en topics, naast de topic wordt het aantal nieuwe berichten weergegeven.","tracked_categories":"Gevolgd","tracked_categories_instructions":"Je volgt automatisch alle topics in deze categorieën. Naast de topic wordt het aantal nieuwe berichten weergegeven.","watched_first_post_categories":"Eerste bericht in de gaten houden.","watched_first_post_categories_instructions":"Je krijgt een notificatie van het eerste bericht in elk nieuw topic in deze categorie.","watched_first_post_tags":"Eerste bericht in de gaten houden","watched_first_post_tags_instructions":"Je krijgt een notificatie van het eerste bericht in elk nieuw topic met deze tags.","muted_categories":"Genegeerd","muted_categories_instructions":"Je zal geen notificaties krijgen over nieuwe topics en berichten in deze categorieën en ze verschijnen niet in Recent.","delete_account":"Verwijder mijn account","delete_account_confirm":"Weet je zeker dat je je account definitief wilt verwijderen? Dit kan niet meer ongedaan gemaakt worden!","deleted_yourself":"Je account is verwijderd.","delete_yourself_not_allowed":"Je kan je account nu niet verwijderen. Neem contact op met een admin om je account te laten verwijderen.","unread_message_count":"Berichten","admin_delete":"Verwijder","users":"Leden","muted_users":"Negeren","muted_users_instructions":"Negeer alle meldingen van deze leden.","muted_topics_link":"Toon genegeerde topics","watched_topics_link":"Toon in de gaten gehouden topics","automatically_unpin_topics":"Topics automatisch lospinnen als ik het laatste bericht bereik.","staff_counters":{"flags_given":"behulpzame markeringen","flagged_posts":"gemarkeerde berichten","deleted_posts":"verwijderde berichten","suspensions":"schorsingen","warnings_received":"waarschuwingen"},"messages":{"all":"Alle","inbox":"Postvak IN","sent":"Verzonden","archive":"Archief","groups":"Mijn groepen","bulk_select":"Selecteer berichten","move_to_inbox":"Verplaats naar Postvak IN","move_to_archive":"Archiveren","failed_to_move":"Het is niet gelukt om de geselecteerde berichten te verplaatsen (mogelijk is je netwerkverbinding verbroken).","select_all":"Alles selecteren"},"change_password":{"success":"(e-mail verzonden)","in_progress":"(e-mail wordt verzonden)","error":"(fout)","action":"Stuur wachtwoord-reset-mail","set_password":"Stel wachtwoord in"},"change_about":{"title":"Wijzig bio","error":"Er ging iets mis bij het wijzigen van deze waarde."},"change_username":{"title":"Wijzig gebruikersnaam","confirm":"Als je je gebruikersnaam wijzigt, zullen alle quotes van je berichten en plekken waar je @naam genoemd is niet meer kloppen. Weet je dit echt zeker?","taken":"Sorry, maar die gebruikersnaam is al in gebruik.","error":"Het wijzigen van je gebruikersnaam is mislukt.","invalid":"Die gebruikersnaam is ongeldig. Gebruik alleen nummers en letters."},"change_email":{"title":"Wijzig e-mail","taken":"Sorry, dat e-mailadres is niet beschikbaar.","error":"Het veranderen van je e-mailadres is mislukt. Misschien is deze al in gebruik?","success":"We hebben een e-mail gestuurd naar dat adres. Volg de bevestigingsinstructies in die mail."},"change_avatar":{"title":"Wijzig je profielafbeelding","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, gebaseerd op","gravatar_title":"Verander je avatar op de Gravatar website","refresh_gravatar_title":"Laad je Gravatar opnieuw","letter_based":"Door systeem toegekende profielafbeelding","uploaded_avatar":"Eigen afbeelding","uploaded_avatar_empty":"Voeg een eigen afbeelding toe","upload_title":"Upload je afbeelding","upload_picture":"Upload afbeelding","image_is_not_a_square":"Let op: we hebben je afbeelding bijgesneden; breedte en hoogte waren niet gelijk.","cache_notice":"Je hebt je profielfoto succesvol gewijzigd, door browsercaching kan het even duren voordat deze overal zichtbaar is."},"change_profile_background":{"title":"Profielachtergrond","instructions":"Profielachtergronden worden gecentreerd en hebben een standaard breedte van 850px."},"change_card_background":{"title":"Achtergrond gebruikersprofiel","instructions":"Achtergrondafbeeldingen worden gecentreerd en hebben een standaard breedte van 590px."},"email":{"title":"E-mail","instructions":"Wordt nooit openbaar gemaakt","ok":"We sturen een e-mail ter bevestiging","invalid":"Vul een geldig e-mailadres in ","authenticated":"Je e-mail is geauthenticeerd door  {{provider}}","frequency_immediately":"We zullen je onmiddellijk e-mailen als je hetgeen waarover we je e-mailen niet gelezen hebt.","frequency":{"one":"We zullen je alleen maar e-mailen als we je in de laatste minuut niet gezien hebben.","other":"We zullen je alleen maar e-mailen als we je de laatste {{count}} minuten niet gezien hebben."}},"name":{"title":"Naam","instructions":"Je volledige naam (optioneel)","instructions_required":"Je volledige naam","too_short":"Je naam is te kort","ok":"Je naam ziet er goed uit"},"username":{"title":"Gebruikersnaam","instructions":"Uniek, geen spaties, kort","short_instructions":"Mensen kunnen naar je verwijzen als @{{username}}.","available":"Je gebruikersnaam is beschikbaar.","global_match":"E-mail hoort bij deze gebruikersnaam","global_mismatch":"Is al geregistreerd. Gebruikersnaam {{suggestion}} proberen?","not_available":"Niet beschikbaar. Gebruikersnaam {{suggestion}} proberen?","too_short":"Je gebruikersnaam is te kort.","too_long":"Je gebruikersnaam is te lang.","checking":"Kijken of gebruikersnaam beschikbaar is...","enter_email":"Gebruikersnaam gevonden. Vul het bijbehorende e-mailadres in.","prefilled":"Je e-mailadres komt overeen met je geregistreerde gebruikersnaam."},"locale":{"title":"Interfacetaal","instructions":"De taal waarin het forum wordt getoond. Deze verandert als je de pagina herlaadt.","default":"(standaard)"},"password_confirmation":{"title":"Nogmaals het wachtwoord"},"last_posted":"Laatste bericht","last_emailed":"Laatst gemaild","last_seen":"Gezien","created":"Lid sinds","log_out":"Uitloggen","location":"Locatie","card_badge":{"title":"Badge van gebruikersprofiel"},"website":"Website","email_settings":"E-mail","like_notification_frequency":{"title":"Stuur mij een bericht wanneer het wordt ge-liked","always":"Altijd","first_time_and_daily":"De eerste keer dat een bericht geliked werd en dagelijks","first_time":"De eerste keer dat een bericht geliked werd","never":"Nooit"},"email_previous_replies":{"title":"Voeg de vorige reacties bij onderaan de e-mails","unless_emailed":"tenzij eerder verzonden","always":"altijd","never":"nooit"},"email_digests":{"title":"Stuur me bij afwezigheid een samenvatting van populaire topics en antwoorden via e-mail ","every_30_minutes":"elke 30 minuten","every_hour":"elk uur","daily":"dagelijks","every_three_days":"elke drie dagen","weekly":"wekelijks","every_two_weeks":"elke twee weken"},"include_tl0_in_digests":"Plaats bijdragen van nieuwe gebruikers in e-mailsamenvatting","email_in_reply_to":"Plaats fragmenten van reacties op berichten in e-mails","email_direct":"Stuur me een e-mail wanneer iemand me citeert, reageert op mijn bericht, mijn @gebruikersnaam noemt of uitnodigt voor een topic","email_private_messages":"Ontvang een e-mail wanneer iemand je een bericht heeft gestuurd.","email_always":"Stuur me e-mail notificaties, zelfs als ik ben actief op de site","other_settings":"Overige","categories_settings":"Categorieën","new_topic_duration":{"label":"Beschouw topics als nieuw wanneer","not_viewed":"Ik heb ze nog niet bekeken","last_here":"aangemaakt sinds de laatste keer dat ik hier was","after_1_day":"gemaakt in de afgelopen dag","after_2_days":"gemaakt in de afgelopen 2 dagen","after_1_week":"gemaakt in de afgelopen week","after_2_weeks":"gemaakt in de afgelopen 2 weken"},"auto_track_topics":"Automatisch topics volgen die ik bezocht heb","auto_track_options":{"never":"nooit","immediately":"direct","after_30_seconds":"na 30 seconden","after_1_minute":"na 1 minuut","after_2_minutes":"na 2 minuten","after_3_minutes":"na 3 minuten","after_4_minutes":"na 4 minuten","after_5_minutes":"na 5 minuten","after_10_minutes":"na 10 minuten"},"invited":{"search":"Typ om uitnodigingen te zoeken...","title":"Uitnodigingen","user":"Uitgenodigd lid","sent":"Verzonden","none":"Er zijn geen uitstaande uitnodigingen om weer te geven.","truncated":{"one":"Tonen van de eerste uitnodiging.","other":"Tonen van de eerste {{count}} uitnodigingen."},"redeemed":"Verzilverde uitnodigingen","redeemed_tab":"Verzilverd","redeemed_tab_with_count":"Verzilverd ({{count}})","redeemed_at":"Verzilverd","pending":"Uitstaande uitnodigingen","pending_tab":"Uitstaand","pending_tab_with_count":"Uitstaand ({{count}})","topics_entered":"Topics bekeken","posts_read_count":"Berichten gelezen","expired":"Deze uitnodiging is verlopen.","rescind":"Verwijder","rescinded":"Uitnodiging verwijderd","reinvite":"Stuur uitnodiging opnieuw","reinvite_all":"Stuur alle uitnodigingen opnieuw","reinvited":"Uitnodiging opnieuw verstuurd","reinvited_all":"Alle uitnodigingen zijn opnieuw verstuurd!","time_read":"Leestijd","days_visited":"Dagen bezocht","account_age_days":"leeftijd van account in dagen","create":"Stuur een uitnodiging","generate_link":"Kopieer uitnodigingslink","generated_link_message":"\u003cp\u003eUitnodigingslink succesvol aangemaakt!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eUitnodigingslink is alleen geldig voor dit e-mailadres: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Je hebt nog niemand uitgenodigd. Je kan individueel uitnodigen of een groep mensen tegelijk door \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eeen groepsuitnodiging-bestand te uploaden\u003c/a\u003e","text":"Groepsuitnodiging via bestand","uploading":"Uploaden...","success":"Het uploaden van het bestand is gelukt, je krijgt een notificatie via een bericht als het proces afgerond is.","error":"Het uploaden van '{{filename}}' is niet gelukt: {{message}}"}},"password":{"title":"Wachtwoord","too_short":"Je wachtwoord is te kort.","common":"Dat wachtwoord wordt al te vaak gebruikt.","same_as_username":"Je wachtwoord is hetzelfde als je gebruikersnaam.","same_as_email":"Je wachtwoord is hetzelfde als je e-mail.","ok":"Je wachtwoord ziet er goed uit.","instructions":"Minimaal %{count} tekens."},"summary":{"title":"Samenvatting ","stats":"Statistieken ","time_read":"leestijd","topic_count":{"one":"Onderwerp gemaakt","other":"topics gemaakt"},"post_count":{"one":"bericht gemaakt","other":"berichten gemaakt"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e gegeven","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e gegeven"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e ontvangen","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e ontvangen"},"days_visited":{"one":"dag bezocht","other":"dagen bezocht"},"posts_read":{"one":"bericht gelezen","other":"berichten gelezen"},"bookmark_count":{"one":"favoriet","other":"favorieten"},"top_replies":"Topreacties","no_replies":"Nog geen antwoorden.","more_replies":"Meer antwoorden","top_topics":"Top topics","no_topics":"Nog geen topics.","more_topics":"Meer topics","top_badges":"Topbadges","no_badges":"Nog geen badges.","more_badges":"Meer badges","top_links":"Toplinks","no_links":"Nog geen links.","most_liked_by":"Meest geliked door","most_liked_users":"Meest geliked","most_replied_to_users":"Meest geantwoord op","no_likes":"Nog geen likes."},"associated_accounts":"Logins","ip_address":{"title":"Laatste IP-adres"},"registration_ip_address":{"title":"Registratie IP-adres"},"avatar":{"title":"Profielfoto","header_title":"profiel, berichten, favorieten en voorkeuren"},"title":{"title":"Titel"},"filters":{"all":"Alle"},"stream":{"posted_by":"Geplaatst door","sent_by":"Verzonden door","private_message":"bericht","the_topic":"de topic"}},"loading":"Laden...","errors":{"prev_page":"tijdens het laden","reasons":{"network":"Netwerkfout","server":"Serverfout","forbidden":"Toegang geweigerd","unknown":"Fout","not_found":"Pagina niet gevonden"},"desc":{"network":"Controleer je verbinding.","network_fixed":"Het lijkt er op dat het terug is","server":"Fout code: {{status}}","forbidden":"Je hebt geen toestemming om dit te bekijken.","not_found":"Oeps, de applicatie heeft geprobeerd een URL te laden die niet bestaat.","unknown":"Er is iets mis gegaan"},"buttons":{"back":"Ga terug","again":"Probeer opnieuw","fixed":"Pagina laden"}},"close":"Sluit","assets_changed_confirm":"De site is bijgewerkt. Wil je een de pagina vernieuwen om de laatste versie te laden?","logout":"Je bent uitgelogd.","refresh":"Ververs","read_only_mode":{"enabled":"Deze site is in alleenlezen-modus. Je kunt rondkijken, maar berichten beantwoorden, likes uitdelen en andere acties uitvoeren is niet mogelijk.","login_disabled":"Zolang de site in read-only modus is, kan er niet ingelogd worden.","logout_disabled":"Uitloggen is niet mogelijk als de site op alleenlezen-modus staat."},"too_few_topics_and_posts_notice":"Laten \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ewe de discussie starten!\u003c/a\u003e Er zijn al \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics en \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e berichten. Nieuwe bezoekers hebben conversaties nodig om te lezen en reageren.","too_few_topics_notice":"Laten \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ewe de discussie starten!\u003c/a\u003e Er zijn al \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e topics. Nieuwe bezoekers hebben conversaties nodig om te lezen en reageren.","too_few_posts_notice":"Laten \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003ewe de discussie starten!\u003c/a\u003e. Er zijn op dit moment \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e berichten. Nieuwe bezoekers hebben conversaties nodig om te lezen en reageren.","logs_error_rate_notice":{"rate":{"one":"1 fout/%{duration}","other":"%{count} fouten/%{duration}"}},"learn_more":"leer meer...","year":"jaar","year_desc":"topics die in de afgelopen 365 dagen gemaakt zijn","month":"maand","month_desc":"topics die in de afgelopen 30 dagen gemaakt zijn","week":"week","week_desc":"topics die in de afgelopen 7 dagen gemaakt zijn","day":"dag","first_post":"Eerste bericht","mute":"Negeer","unmute":"Tonen","last_post":"Laatste bericht","last_reply_lowercase":"laatste reactie","replies_lowercase":{"one":"reactie","other":"reacties"},"signup_cta":{"sign_up":"Aanmelden","hide_session":"Herrinner me morgen","hide_forever":"nee, dank je","hidden_for_session":"Ok, ik vraag het je morgen. Je kunt altijd 'Log in' gebruiken om in te loggen.","intro":"Hey! :heart_eyes: Praat mee in deze discussie, meld je aan met een account","value_prop":"Wanneer je een account aangemaakt hebt, wordt daarin bijgehouden wat je gelezen hebt, zodat je direct door kan lezen vanaf waar je gestopt bent. Je kan op de site en via e-mail notificaties krijgen wanneer nieuwe posts gemaakt zijn, en je kan ook nog posts liken. :heartbeat:"},"summary":{"enabled_description":"Je leest een samenvatting van dit topic: alleen de meeste interessante berichten zoals bepaald door de community. ","description":"Er zijn \u003cb\u003e{{replyCount}}\u003c/b\u003e reacties.","description_time":"Er zijn \u003cb\u003e{{replyCount}}\u003c/b\u003e reacties met een geschatte leestijd van\u003cb\u003e{{readingTime}} minuten\u003c/b\u003e.","enable":"Maak een samenvatting van dit topic","disable":"Alle berichten"},"deleted_filter":{"enabled_description":"Deze topic bevat verwijderde berichten, die niet getoond worden.","disabled_description":"Verwijderde berichten in deze topic worden getoond.","enable":"Verberg verwijderde berichten","disable":"Toon verwijderde berichten"},"private_message_info":{"title":"Bericht","invite":"Nodig anderen uit...","remove_allowed_user":"Weet je zeker dat je {{naam}} wilt verwijderen uit dit bericht?","remove_allowed_group":"Weet je zeker dat je {{name}} uit dit bericht wilt verwijderen?"},"email":"E-mail","username":"Gebruikersnaam","last_seen":"Gezien","created":"Gemaakt","created_lowercase":"gemaakt","trust_level":"Trustlevel","search_hint":"gebruikersnaam, e-mail of IP-adres","create_account":{"title":"Maak een nieuw account","failed":"Er ging iets mis, wellicht is het e-mailadres al geregistreerd. Probeer de 'Wachtwoord vergeten'-link."},"forgot_password":{"title":"Wachtwoord herstellen","action":"Ik ben mijn wachtwoord vergeten","invite":"Vul je gebruikersnaam of e-mailadres in en we sturen je een wachtwoord-herstel-mail.","reset":"Herstel wachtwoord","complete_username":"Als er een account gevonden kan worden met de gebruikersnaam \u003cb\u003e%{username}\u003cb/\u003e, dan zal je spoedig een e-mail ontvangen met daarin instructies om je wachtwoord te resetten.","complete_email":"Als er een account gevonden kan worden met het e-mailadres \u003cb\u003e%{email}\u003cb/\u003e, dan zal je spoedig een e-mail ontvangen met daarin instructies om je wachtwoord te resetten.","complete_username_found":"We hebben een account met de gebruikersnaam \u003cb\u003e%{username}\u003c/b\u003e gevonden. Je zal spoedig een e-mail ontvangen met daarin instructies om je wachtwoord te resetten.","complete_email_found":"We hebben een account gevonden met het e-mailadres \u003cb\u003e%{email}\u003cb/\u003e. Je zal spoedig een e-mail ontvangen met daarin instructies om je wachtwoord te resetten.","complete_username_not_found":"Geen account met de gebruikersnaam \u003cb\u003e%{username}\u003c/b\u003e gevonden","complete_email_not_found":"Geen account met het e-mailadres \u003cb\u003e%{email}\u003c/b\u003e gevonden"},"login":{"title":"Inloggen","username":"Gebruiker","password":"Wachtwoord","email_placeholder":"e-mail of gebruikersnaam","caps_lock_warning":"Caps Lock staat aan","error":"Er is een onbekende fout opgetreden","rate_limit":"Wacht even voor je opnieuw probeert in te loggen.","blank_username_or_password":"Vul je e-mail of gebruikersnaam en je wachtwoord in.","reset_password":"Herstel wachtwoord","logging_in":"Inloggen...","or":"Of","authenticating":"Authenticatie...","awaiting_confirmation":"Je account is nog niet geactiveerd. Gebruik de 'Wachtwoord vergeten'-link om een nieuwe activatiemail te ontvangen.","awaiting_approval":"Je account is nog niet goedgekeurd door iemand van de staf. Je krijgt van ons een e-mail wanneer dat gebeurd is.","requires_invite":"Sorry. toegang tot dit forum is alleen op uitnodiging.","not_activated":"Je kan nog niet inloggen. We hebben je een activatie-mail gestuurd naar \u003cb\u003e{{sentTo}}\u003c/b\u003e. Volg de instructies in die e-mail om je account te activeren.","not_allowed_from_ip_address":"Je kunt niet inloggen vanaf dat IP-adres.","admin_not_allowed_from_ip_address":"Je kan jezelf niet aanmelden vanaf dat IP-adres.","resend_activation_email":"Klik hier om de activatiemail opnieuw te ontvangen.","sent_activation_email_again":"We hebben een nieuwe activatiemail gestuurd naar \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Het kan een aantal minuten duren voor deze aan komt. Check ook je spamfolder.","to_continue":"Log a.u.b. in","preferences":"Je moet ingelogd zijn om je gebruikersinstellingen te wijzigen.","forgot":"Ik kan me de details van mijn gebruikersaccount niet herinneren.","google":{"title":"met Google","message":"Inloggen met een Google-account (zorg ervoor dat je popup blocker uit staat)"},"google_oauth2":{"title":"met Google","message":"Authenticeren met Google (zorg er voor dat pop-up blockers uit staan)"},"twitter":{"title":"met Twitter","message":"Inloggen met een Twitteraccount (zorg ervoor dat je popup blocker uit staat)"},"instagram":{"title":"met Instagram","message":"Inloggen met een Instagram-account (zorg ervoor dat je pop-upblocker uitstaat)."},"facebook":{"title":"met Facebook","message":"Inloggen met een Facebookaccount (zorg ervoor dat je popup blocker uit staat)"},"yahoo":{"title":"met Yahoo","message":"Inloggen met een Yahoo-account (zorg ervoor dat je popup blocker uit staat)"},"github":{"title":"met Github","message":"Inloggen met een Githubaccount (zorg ervoor dat je popup blocker uit staat)"}},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"meer...","options":"Opties","whisper":"Fluister","add_warning":"Dit is een officiële waarschuwing.","toggle_whisper":"Fluistermode in- of uitschakelen","posting_not_on_topic":"In welke topic wil je je antwoord plaatsen?","saving_draft_tip":"opslaan...","saved_draft_tip":"opgeslagen","saved_local_draft_tip":"lokaal opgeslagen","similar_topics":"Jouw topic lijkt op...","drafts_offline":"concepten offline","duplicate_link":"Het ziet er naar uit dat je link naar \u003cb\u003e{{domain}}\u003c/b\u003e al genoemd is in deze topic door \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003eeen bericht {{ago}}\u003c/a\u003e – weet je zeker dat je dit opnieuw wilt posten?","error":{"title_missing":"Titel is verplicht","title_too_short":"Titel moet uit minstens {{min}} tekens bestaan","title_too_long":"Titel kan niet langer dan {{max}} tekens zijn","post_missing":"Bericht kan niet leeg zijn","post_length":"Bericht moet ten minste {{min}} tekens bevatten","try_like":"Heb je de \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e-knop geprobeerd?","category_missing":"Je moet nog een categorie kiezen"},"save_edit":"Bewaar wijzigingen","reply_original":"Reageer op oorspronkelijke topic","reply_here":"Reageer hier","reply":"Reageer","cancel":"Annuleer","create_topic":"Maak topic","create_pm":"Bericht","title":"Of druk op Ctrl-Return","users_placeholder":"Voeg een lid toe","title_placeholder":"Waar gaat de discussie over in één korte zin?","edit_reason_placeholder":"vanwaar de wijziging?","show_edit_reason":"(geef een reden)","reply_placeholder":"Typ hier. Gebruik Markdown, BBCode, of HTML om op te maken. Sleep of plak afbeeldingen.","view_new_post":"Bekijk je nieuwe bericht.","saving":"Opslaan","saved":"Opgeslagen!","saved_draft":"Bezig met conceptbericht. Selecteer om door te gaan.","uploading":"Uploaden...","show_preview":"toon voorbeeld \u0026raquo;","hide_preview":"\u0026laquo; verberg voorbeeld","quote_post_title":"Citeer hele bericht","bold_title":"Vet","bold_text":"Vetgedrukte tekst","italic_title":"Cursief","italic_text":"Cursieve tekst","link_title":"Weblink","link_description":"geef hier een omschrijving","link_dialog_title":"Voeg weblink toe","link_optional_text":"optionele titel","link_url_placeholder":"http://example.com","quote_title":"Citaat","quote_text":"Citaat","code_title":"Opgemaakte tekst","code_text":"zet 4 spaties voor opgemaakte tekst","paste_code_text":"type of plak code hier","upload_title":"Afbeelding","upload_description":"geef een omschrijving voor de afbeelding op","olist_title":"Genummerde lijst","ulist_title":"Lijst met bullets","list_item":"Lijstonderdeel","heading_title":"Kop","heading_text":"Kop","hr_title":"Horizontale lijn","help":"Uitleg over Markdown","toggler":"verberg of toon de editor","modal_ok":"OK","modal_cancel":"Annuleer","cant_send_pm":"Sorry, je kan geen bericht sturen naar %{username}.","yourself_confirm":{"title":"Ben je vergeten om ontvangers toe te voegen?","body":"Het bericht wordt nu alleen naar jezelf verzonden!"},"admin_options_title":"Optionele stafinstellingen voor deze topic","auto_close":{"label":"Tijd waarna topic automatisch wordt gesloten:","error":"Vul een geldige waarde in.","based_on_last_post":"Sluit pas als het laatste bericht in de topic op zijn minst zo oud is.","all":{"examples":"Voor het aantal uur (24), absolute tijd (17:30) of timestamp (2013-11-22 14:00) in."},"limited":{"units":"(# aantal uren)","examples":"Geef aantal uren (24)."}}},"notifications":{"title":"notificaties van @naam vermeldingen, reacties op je berichten en topics, berichten, etc.","none":"Notificaties kunnen niet geladen worden.","empty":"Geen notificaties gevonden.","more":"bekijk oudere notificaties","total_flagged":"aantal gemarkeerde berichten","mentioned":"\u003ci title='mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='geciteerd' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='beantwoord' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='aangepast' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='geliked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} en 1 andere\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} en {{count}} anderen\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='privebericht' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='privebericht' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='invited to topic' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='heeft jouw uitnodiging geaccepteerd' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e heeft jouw uitnodiging geaccepteerd\u003c/p\u003e","moved_post":"\u003ci title='heeft bericht verplaatst' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e verplaatste {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge ontvangen' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003e'{{description}}' ontvangen\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNieuw topic\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} berichten in jouw {{group_name}} inbox\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} berichten in jouw {{group_name}} Postvak IN\u003c/p\u003e"},"alt":{"mentioned":"Genoemd door","quoted":"Gequoot door","replied":"Gereageerd","posted":"Geplaatst door","edited":"Wijzig je bericht door","liked":"Heeft je bericht geliked","private_message":"Privé-bericht van","invited_to_private_message":"Uitgenodigd voor een privé-bericht van","invited_to_topic":"Uitgenodigd voor een topic door","invitee_accepted":"Uitnodiging geaccepteerd door","moved_post":"Je bericht is verplaatst door","linked":"Link naar je bericht","granted_badge":"Badge toegekend","group_message_summary":"Berichten in groeps-Postvak IN"},"popup":{"mentioned":"{{username}} heeft je genoemd in \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} noemde jouw naam in \"{{topic}}\" - {{site_title}}","quoted":"{{username}} heeft je geciteerd in \"{{topic}}\" - {{site_title}}","replied":"{{username}} heeft je beantwoord in \"{{topic}}\" - {{site_title}}","posted":"{{username}} heeft een bericht geplaatst in \"{{topic}}\" - {{site_title}}","private_message":"{{username}} heeft je een privé-bericht gestuurd in \"{{topic}}\" - {{site_title}}","linked":"{{username}} heeft een link gemaakt naar jouw bericht vanuit \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Voeg een afbeelding toe","title_with_attachments":"Voeg een afbeelding of bestand toe","from_my_computer":"Vanaf mijn apparaat","from_the_web":"Vanaf het web","remote_tip":"link naar afbeelding","remote_tip_with_attachments":"link naar afbeelding of bestand {{authorized_extensions}}","local_tip":"selecteer afbeeldingen van uw apparaat","local_tip_with_attachments":"selecteer afbeeldingen of bestanden vanaf je apparaat {{authorized_extensions}}","hint":"(je kan afbeeldingen ook slepen in de editor om deze te uploaden)","hint_for_supported_browsers":"je kunt ook afbeeldingen slepen of plakken in de editor","uploading":"Uploaden","select_file":"Selecteer een bestand","image_link":"de link waar je afbeelding naar verwijst"},"search":{"sort_by":"Sorteren op","relevance":"Relevantie","latest_post":"Laatste bericht","most_viewed":"Meest bekeken","most_liked":"Meest geliked","select_all":"Alles selecteren","clear_all":"Wis Alles","too_short":"Je zoekterm is te kort.","result_count":{"one":"1 resultaat voor \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} resultaat voor \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"zoek naar topics, berichten, gebruikers of categorieën","no_results":"Geen resultaten gevonden.","no_more_results":"Geen resultaten meer gevonden.","search_help":"Zoek in help","searching":"Zoeken...","post_format":"#{{post_number}} door {{username}}","context":{"user":"Zoek berichten van @{{username}}","category":"Doorzoek de #{{category}} categorie","topic":"Zoek in deze topic","private_messages":"Zoek berichten"}},"hamburger_menu":"ga naar een andere topiclijst of categorie","new_item":"nieuw","go_back":"ga terug","not_logged_in_user":"gebruikerspagina met samenvatting van huidige activiteit en voorkeuren","current_user":"ga naar je gebruikerspagina","topics":{"bulk":{"unlist_topics":"Topics van lijst halen","reset_read":"markeer als ongelezen","delete":"Verwijder topics","dismiss":"Afwijzen","dismiss_read":"Alle ongelezen topics verwerpen","dismiss_button":"Afwijzen...","dismiss_tooltip":"Alleen nieuwe berichten afwijzen of stop het volgen van topics","also_dismiss_topics":"Stop het volgen van deze topics, zodat deze nooit meer als ongelezen worden weergegeven. ","dismiss_new":"markeer nieuwe berichten als gelezen","toggle":"Schakel bulkselectie van topics in of uit","actions":"Bulk Acties","change_category":"Wijzig categorie","close_topics":"Sluit topics","archive_topics":"Archiveer topics","notification_level":"Wijzig notificatielevel","choose_new_category":"Kies de nieuwe categorie voor de topics:","selected":{"one":"Je hebt \u003cb\u003e1\u003c/b\u003e topic geselecteerd.","other":"Je hebt \u003cb\u003e{{count}}\u003c/b\u003e topics geselecteerd."},"change_tags":"Verander Tags","choose_new_tags":"Kies nieuwe tags voor deze topics:","changed_tags":"De tags van deze topics zijn gewijzigd."},"none":{"unread":"Je hebt geen ongelezen topics.","new":"Je hebt geen nieuwe topics.","read":"Je hebt nog geen topics gelezen.","posted":"Je hebt nog niet in een topic gereageerd.","latest":"Er zijn geen populaire topics. Dat is jammer.","hot":"Er zijn geen populaire topics.","bookmarks":"Je hebt nog geen topics aan je favorieten toegevoegd.","category":"Er zijn geen topics in {{category}}.","top":"Er zijn geen top topics.","search":"Er zijn geen zoekresultaten gevonden.","educate":{"new":"\u003cp\u003eJe nieuwe topics verschijnen hier. \u003c/p\u003e\u003cp\u003e Standaard worden topics als nieuw weergegeven en als \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003e nieuw\u003c/span\u003e weergegeven als deze binnen de laatste 2 dagen zijn aangemaakt.\u003c/p\u003e\u003cp\u003eBezoek jouw \u003ca href=\"%{userPrefsUrl}\"\u003evoorkeuren\u003c/a\u003e om dit te veranderen.\u003c/p\u003e","unread":"\u003cp\u003eJe ongelezen topics verschijnen hier.\u003c/p\u003e\u003cp\u003eStandaard worden topics als ongelezen beschouwd en zullen als ongelezen worden weergegeven \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e als je:\u003c/p\u003e\u003cul\u003e\u003cli\u003ede topic hebt aangemaakt\u003c/li\u003e\u003cli\u003ereageert op deze topic\u003c/li\u003e\u003cli\u003elanger dan 4 minuten leest\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOf als je de topic expliciet op Volgen of In de gaten houden hebt gezet via de notificatieknoppen onderaan het topic.\u003c/p\u003e\u003cp\u003eBezoek jouw\u003ca href=\"%{userPrefsUrl}\"\u003evoorkeuren\u003c/a\u003e om dit te veranderen\u003c/p\u003e"}},"bottom":{"latest":"Er zijn geen recente topics.","hot":"Er zijn geen populaire topics meer.","posted":"Er zijn niet meer topics geplaatst.","read":"Er zijn geen gelezen topics meer.","new":"Er zijn geen nieuwe topics meer.","unread":"Er zijn geen ongelezen topics meer.","category":"Er zijn geen topics meer in {{category}}.","top":"Er zijn geen top topics meer.","bookmarks":"Er zijn niet meer topics in je favorieten.","search":"Er zijn geen zoekresultaten meer."}},"topic":{"unsubscribe":{"stop_notifications":"Je zal nu minder notificaties ontvangen voor \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Je huidige notificatiestatus is"},"create":"Nieuw topic","create_long":"Maak een nieuw topic","private_message":"Stuur een bericht","archive_message":{"help":"Verplaats bericht naar jouw archief ","title":"Archiveren "},"move_to_inbox":{"title":"Verplaats naar Postvak IN","help":"Verplaats het bericht terug naar Postvak IN"},"list":"Topics","new":"nieuw topic","unread":"ongelezen","new_topics":{"one":"1 nieuwe topic","other":"{{count}} nieuwe topics"},"unread_topics":{"one":"1 ongelezen topic","other":"{{count}} ongelezen topics"},"title":"Topic","invalid_access":{"title":"Topic is privé","description":"Sorry, je hebt geen toegang tot deze topic.","login_required":"Je moet inloggen om deze topic te kunnen bekijken."},"server_error":{"title":"Laden van topic is mislukt","description":"Sorry, we konden deze topic niet laden, waarschijnlijk door een verbindingsprobleem. Probeer het later opnieuw. Als het probleem zich blijft voordoen, laat het ons dan weten."},"not_found":{"title":"Topic niet gevonden","description":"Sorry, we konden het opgevraagde topic niet vinden. Wellicht is het verwijderd door een moderator?"},"total_unread_posts":{"one":"je hebt 1 ongelezen bericht in deze topic","other":"je hebt {{count}} ongelezen berichten in deze topic"},"unread_posts":{"one":"je hebt 1 ongelezen bericht in deze topic","other":"je hebt {{count}} ongelezen berichten in deze topic"},"new_posts":{"one":"er is 1 nieuw bericht in deze topic sinds je deze voor het laatst gelezen hebt","other":"er zijn {{count}} nieuwe berichten in deze topic sinds je deze voor het laatst gelezen hebt"},"likes":{"one":"er is één waardering in deze topic","other":"er zijn {{likes}} likes in deze topic"},"back_to_list":"Terug naar topiclijst","options":"Topic-opties","show_links":"laat links in deze topic zien","toggle_information":"Zet topic details aan of uit","read_more_in_category":"Wil je meer lezen? Kijk dan voor andere topics in {{catLink}} of {{latestLink}}.","read_more":"Wil je meer lezen? {{catLink}} of {{latestLink}}.","browse_all_categories":"Bekijk alle categorieën","view_latest_topics":"bekijk nieuwste topics","suggest_create_topic":"Waarom start je geen topic?","jump_reply_up":"ga naar een eerdere reactie","jump_reply_down":"ga naar een latere reactie","deleted":"Deze topic is verwijderd","auto_close_notice":"Deze topic wordt automatisch over %{timeLeft} gesloten.","auto_close_notice_based_on_last_post":"Deze topic sluit %{duration} na de laatste reactie.","auto_close_title":"Instellingen voor automatisch sluiten","auto_close_save":"Opslaan","auto_close_remove":"Sluit deze topic niet automatisch","timeline":{"back":"Terug","back_description":"Keer terug naar je laatste ongelezen bericht","replies_short":"%{current} / %{total}"},"progress":{"title":"topicvoortgang","go_top":"bovenaan","go_bottom":"onderkant","go":"ga","jump_bottom":"spring naar laatste bericht","jump_prompt":"spring naar bericht","jump_prompt_long":"Naar welk bericht wil je springen?","jump_bottom_with_number":"spring naar bericht %{post_number}","total":"totaal aantal berichten","current":"huidige bericht"},"notifications":{"title":"verander de frequentie van notificaties over deze topic","reasons":{"mailing_list_mode":"De mailinglijstmodus staat ingeschakeld, dus zul je via e-mail notificaties ontvangen bij nieuwe antwoorden in deze topic.","3_6":"Je ontvangt notificaties omdat je deze categorie in de gaten houdt.","3_5":"Je ontvangt notificaties omdat je deze topic automatisch in de gaten houdt.","3_2":"Je ontvangt notificaties omdat je deze topic in de gaten houdt.","3_1":"Je ontvangt notificaties omdat je dit topic hebt gemaakt.","3":"Je ontvangt notificaties omdat je deze topic in de gaten houdt.","2_8":"Je ontvangt notificaties omdat je deze categorie volgt.","2_4":"Je ontvangt notificaties omdat je een reactie in deze topic hebt geplaatst.","2_2":"Je ontvangt notificaties omdat je deze topic volgt.","2":"Je ontvangt notificaties omdat je \u003ca href=\"/users/{{username}}/preferences\"\u003edeze topic hebt gelezen\u003c/a\u003e.","1_2":"Je krijgt een notificatie als iemand je @naam noemt of reageert op een bericht van jou.","1":"Je krijgt een notificatie als iemand je @naam noemt of reageert op een bericht van jou.","0_7":"Je negeert alle notificaties in deze categorie.","0_2":"Je negeert alle notificaties in deze topic.","0":"Je negeert alle notificaties in deze topic."},"watching_pm":{"title":"In de gaten houden","description":"Je krijgt een notificatie voor elke nieuwe reactie op dit bericht, en het aantal nieuwe reacties wordt weergegeven."},"watching":{"title":"In de gaten houden","description":"Je krijgt een notificatie voor elke nieuwe reactie in deze topic, en het aantal nieuwe reacties wordt weergegeven."},"tracking_pm":{"title":"Volgen","description":"Het aantal nieuwe reacties op dit bericht wordt weergegeven. Je krijgt een notificatie als iemand je @name noemt of reageert."},"tracking":{"title":"Volgen","description":"Het aantal nieuwe reacties in deze topic wordt weergegeven. Je krijgt een notificatie als iemand je @name noemt of reageert."},"regular":{"title":"Normaal","description":"Je krijgt een notificatie als iemand je @naam noemt of reageert op een bericht van jou."},"regular_pm":{"title":"Normaal","description":"Je krijgt een notificatie als iemand je @naam noemt of reageert op een bericht van jou."},"muted_pm":{"title":"Negeren","description":"Je zal geen enkele notificatie ontvangen over dit bericht."},"muted":{"title":"Negeren","description":"Je zult nooit op de hoogte worden gebracht over deze topic, en het zal niet verschijnen in Recent."}},"actions":{"recover":"Herstel topic","delete":"Verwijder topic","open":"Open topic","close":"Sluit topic","multi_select":"Selecteer berichten...","auto_close":"Automatisch sluiten...","pin":"Pin topic...","unpin":"Ontpin topic...","unarchive":"De-archiveer topic","archive":"Archiveer topic","invisible":"Maak onzichtbaar","visible":"Maak zichtbaar","reset_read":"Reset leesdata","make_public":"Maak topic openbaar","make_private":"Nieuw privé-bericht"},"feature":{"pin":"Pin topic","unpin":"Ontpin topic","pin_globally":"Pin topic globaal vast","make_banner":"Maak bannertopic","remove_banner":"Verwijder bannertopic"},"reply":{"title":"Reageer","help":"Schrijf een reactie op deze topic"},"clear_pin":{"title":"Verwijder pin","help":"Verwijder de gepinde status van deze topic, zodat het niet langer bovenaan je topiclijst verschijnt."},"share":{"title":"Deel","help":"deel een link naar deze topic"},"flag_topic":{"title":"Markeer","help":"geef een privé-markering aan deze topic of stuur er een privé-bericht over","success_message":"Je hebt deze topic gemarkeerd"},"feature_topic":{"title":"Feature deze topic","pin":"Zet deze topic bovenaan in de {{categoryLink}} categorie tot","confirm_pin":"Je hebt al {{count}} vastgepinde topics. Teveel vastgepinde topics kunnen storend zijn voor nieuwe en anonieme gebruikers. Weet je zeker dat je nog een topic wilt vastpinnen in deze categorie?","unpin":"Zorg ervoor dat deze topic niet langer bovenaan de {{categoryLink}} categorie komt.","unpin_until":"Zet deze topic niet langer bovenaan in de {{categoryLink}} categorie of wacht tot \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Gebruikers kunnen het vastpinnen voor deze topic voor zichzelf ongedaan maken.","pin_validation":"Een datum is vereist om deze topic vast te pinnen.","not_pinned":"Er zijn geen topics vastgepind in {{categoryLink}}.","already_pinned":{"one":"Topics welke vastgepind zijn in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Topics welke vastgepind zijn in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"pin_globally":"Zet deze topic bovenaan in alle topic lijsten tot","confirm_pin_globally":"Je hebt al {{count}} globaal vastgepinde topics. Teveel vastgepinde topics kunnen storend zijn voor nieuwe en anonieme gebruikers. Weet je zeker dat je nog een topic globaal wilt vastpinnen?","unpin_globally":"Zorg ervoor dat deze topic niet langer bovenaan alle topiclijsten komt.","unpin_globally_until":"Zet deze topic niet langer bovenaan in alle topiclijsten of wacht tot \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Gebruikers kunnen deze topic voor zichzelf ontpinnen.","not_pinned_globally":"Er zijn geen globaal vastgepinde topics.","already_pinned_globally":{"one":"Topics welke globaal vastgepind zijn: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Topics welke globaal vastgepind zijn: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"make_banner":"Maak van deze topic een banner die bovenaan alle pagina's verschijnt.","remove_banner":"Verwijder de banner die bovenaan alle pagina's staat.","banner_note":"Gebruikers kunnen de banner negeren door deze te sluiten. Er kan maar één bannertopic zijn.","no_banner_exists":"Er is geen bannertopic.","banner_exists":"Er \u003cstrong class='badge badge-notification unread'\u003eis\u003c/strong\u003e op het ogenblik een bannertopic."},"inviting":"Uitnodigen...","automatically_add_to_groups":"Deze uitnodiging geeft ook toegang tot de volgende groepen:","invite_private":{"title":"Uitnodigen voor Bericht","email_or_username":"E-mail of gebruikersnaam van genodigde","email_or_username_placeholder":"e-mailadres of gebruikersnaam","action":"Uitnodigen","success":"Deze gebruiker is uitgenodigd om in de conversatie deel te nemen.","success_group":"De groep is uitgenodigd om deel te nemen aan de conversatie.","error":"Sorry, er is iets misgegaan bij het uitnodigen van deze persoon.","group_name":"groepsnaam"},"controls":"Topic controlepaneel","invite_reply":{"title":"Uitnodigen","username_placeholder":"gebruikersnaam","action":"Stuur Uitnodiging","help":"nodig anderen uit voor deze topic via e-mail of notificaties","to_forum":"We sturen een kort mailtje waarmee je vriend zich direct kan aanmelden door op een link te klikken, zonder te hoeven inloggen.","sso_enabled":"Voer de gebruikersnaam in van de persoon die je uit wil nodigen voor deze topic.","to_topic_blank":"Voer de gebruikersnaam of het e-mailadres in van de persoon die je uit wil nodigen voor deze topic.","to_topic_email":"Je hebt een e-mailadres ingevuld. We zullen een uitnodiging e-mailen waarmee je vriend direct kan antwoorden op deze topic.","to_topic_username":"Je hebt een gebruikersnaam ingevuld. We zullen een notificatie sturen met een link om deel te nemen aan deze topic.","to_username":"Vul de gebruikersnaam in van de persoon die je wilt uitnodigen. We zullen een notificatie sturen met een link om deel te nemen aan deze topic","email_placeholder":"naam@voorbeeld.nl","success_email":"We hebben een uitnodiging gemaild naar \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. We stellen je op de hoogte als op de uitnodiging is ingegaan. Controleer het uitnodigingen tabblad op je gebruikerspagina om een overzicht te zien van je uitnodigingen.","success_username":"We hebben de gebruiker uitgenodigd om deel te nemen in deze topic.","error":"Sorry, we konden deze persoon niet uitnodigen. Wellicht is deze al een keer uitgenodigd? (Uitnodigingen worden gelimiteerd)"},"login_reply":"Log in om te beantwoorden","filters":{"n_posts":{"one":"één bericht","other":"{{count}} berichten"},"cancel":"Verwijder filter"},"split_topic":{"title":"Verplaats naar nieuwe topic","action":"verplaats naar nieuwe topic","topic_name":"Naam nieuwe topic","error":"Er ging iets mis bij het verplaatsen van berichten naar de nieuwe topic.","instructions":{"one":"Je staat op het punt een nieuwe topic aan te maken en het te vullen met het bericht dat je geselecteerd hebt.","other":"Je staat op het punt een nieuwe topic aan te maken en het te vullen met de \u003cb\u003e{{count}}\u003c/b\u003e geselecteerde berichten."}},"merge_topic":{"title":"Verplaats naar bestaand topic","action":"verplaats naar bestaand topic","error":"Er ging iets mis bij het verplaatsen van berichten naar dat topic.","instructions":{"one":"Selecteer de topic waarnaar je het bericht wil verplaatsen.","other":"Selecteer de topic waarnaar je de \u003cb\u003e{{count}}\u003c/b\u003e berichten wil verplaatsen."}},"merge_posts":{"title":"Voeg geselecteerde berichten samen","action":"voeg geselecteerde berichten samen","error":"Er ging iets mis bij het samenvoegen van de geselecteerde berichten."},"change_owner":{"title":"Wijzig eigenaar van berichten","action":"verander van eigenaar","error":"Er ging iets mis bij het veranderen van eigendom van dat bericht.","label":"Nieuwe eigenaar van berichten","placeholder":"gebruikersnaam van de nieuwe eigenaar","instructions":{"one":"Kies de nieuwe eigenaar van het bericht door \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Kies de nieuwe eigenaar van de {{count}} berichten door \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Let op dat alle meldingen over dit bericht niet met terugwerkende kracht worden overgedragen aan de nieuwe gebruiker. \u003cbr\u003eWaarschuwing: Momenteel worden geen bericht-afhankelijke gegevens overgedragen aan de nieuwe gebruiker. Wees dus voorzichtig met het gebruik hiervan."},"change_timestamp":{"title":"Wijzig Tijdsaanduiding","action":"wijzig tijdsaanduiding","invalid_timestamp":"Tijdsaanduiding kan niet in de toekomst zijn.","error":"Het wijzigen van de tijdsaanduiding van de topic is niet gelukt.","instructions":"Kies een nieuwe tijdsaanduiding voor de topic. Berichten in de topic worden aangepast zodat het onderlinge tijdsverschil gelijk blijft."},"multi_select":{"select":"selecteer","selected":"geselecteerd ({{count}})","select_replies":"selecteer +antwoorden","delete":"verwijder geselecteerde berichten","cancel":"annuleer selectie","select_all":"selecteer alles","deselect_all":"deselecteer alles","description":{"one":"Je hebt \u003cb\u003eéén\u003c/b\u003e bericht geselecteerd.","other":"Je hebt \u003cb\u003e{{count}}\u003c/b\u003e berichten geselecteerd."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"citeer","edit":"Aan het bewerken {{link}} {{replyAvatar}} {{username}}","edit_reason":"Reden: ","post_number":"bericht {{number}}","last_edited_on":"bericht gewijzigd op","reply_as_new_topic":"Reageer als gelinkt topic","continue_discussion":"Voortzetting van de discussie {{postLink}}:","follow_quote":"ga naar het geciteerde bericht","show_full":"Bekijk hele bericht","show_hidden":"Bekijk verborgen inhoud.","deleted_by_author":{"one":"(bericht ingetrokken door de schrijver, wordt automatisch verwijderd over %{count} uur, tenzij gemarkeerd)","other":"(bericht ingetrokken door de schrijver, wordt automatisch verwijderd over %{count} uur, tenzij gemarkeerd)"},"expand_collapse":"in-/uitvouwen","gap":{"one":"bekijk 1 verborgen reactie","other":"bekijk {{count}} verborgen reacties"},"unread":"Bericht is ongelezen","has_replies":{"one":"{{count}} Reactie","other":"{{count}} Reacties"},"has_likes":{"one":"{{count}} Like","other":"{{count}} Likes"},"has_likes_title":{"one":"iemand heeft dit bericht geliked","other":"{{count}} mensen hebben dit bericht geliked"},"has_likes_title_only_you":"je hebt dit bericht geliked","has_likes_title_you":{"one":"jij en 1 andere hebben dit bericht geliked","other":"jij en {{count}} anderen hebben dit bericht geliked"},"errors":{"create":"Sorry, er is iets misgegaan bij het plaatsen van je bericht. Probeer het nog eens.","edit":"Sorry, er is iets misgegaan bij het bewerken van je bericht. Probeer het nog eens.","upload":"Sorry, er is iets misgegaan bij het uploaden van je bestand. Probeer het nog eens.","file_too_large":"Sorry, dit bestand is te groot (maximumgrootte is {{max_size_kb}}kb). Misschien kun je dit bestand uploaden naar een cloudopslagdienst en de link er naar delen?","too_many_uploads":"Sorry, je kan maar één afbeelding tegelijk uploaden.","too_many_dragged_and_dropped_files":"Sorry, je kan maar 10 bestanden tegelijk uploaden.","upload_not_authorized":"Sorry, je mag dat type bestand niet uploaden (toegestane extensies: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Sorry, nieuwe gebruikers mogen nog geen afbeeldingen uploaden.","attachment_upload_not_allowed_for_new_user":"Sorry, nieuwe gebruikers mogen nog geen bestanden uploaden.","attachment_download_requires_login":"Sorry, maar je moet ingelogd zijn om bijlages te downloaden."},"abandon":{"confirm":"Weet je zeker dat je dit bericht wilt afbreken?","no_value":"Nee, behouden","yes_value":"Ja, verwijderen"},"via_email":"dit bericht kwam binnen via e-mail","via_auto_generated_email":"dit bericht kwam binnen via een automatisch gegenereerde e-mail","whisper":"dit bericht is alleen toegankelijk voor moderators","wiki":{"about":"dit is een wikibericht"},"archetypes":{"save":"Bewaar instellingen"},"few_likes_left":"Bedankt voor je support! Je kunt vandaag nog een paar likes uitdelen.","controls":{"reply":"reageer op dit bericht","like":"like dit bericht","has_liked":"je hebt dit bericht geliked","undo_like":"like ongedaan maken","edit":"bewerk dit bericht","edit_anonymous":"Sorry, maar je moet ingelogd zijn om dit bericht aan te kunnen passen.","flag":"meld dit bericht of stuur er een notificatie over (alleen zichtbaar voor moderatoren en admins)","delete":"verwijder dit bericht","undelete":"herstel dit bericht","share":"deel een link naar dit bericht","more":"Meer","delete_replies":{"confirm":{"one":"Wil je ook het directe antwoord op dit bericht verwijderen?","other":"Wil je ook de {{count}} directe antwoorden op dit bericht verwijderen?"},"yes_value":"Ja, verwijder deze antwoorden ook","no_value":"Nee, alleen dit bericht"},"admin":"adminacties voor bericht","wiki":"Maak wiki","unwiki":"Verwijder Wiki","convert_to_moderator":"Voeg stafkleur toe","revert_to_regular":"Verwijder stafkleur","rebake":"Maak HTML opnieuw","unhide":"Toon","change_owner":"Eigenaar wijzigen "},"actions":{"flag":"Markeer","defer_flags":{"one":"Markering negeren","other":"Markeringen negeren"},"undo":{"off_topic":"Verwijder markering","spam":"Verwijder markering","inappropriate":"Hef markering op","bookmark":"Verwijder uit favorieten","like":"Maak like ongedaan","vote":"Stem niet meer"},"people":{"off_topic":"heeft dit als off-topic gemarkeerd","spam":"markeerde dit als spam","inappropriate":"markeerde dit als ongepast","notify_moderators":"lichtte moderators in","notify_user":"stuurde een bericht","bookmark":"voegde dit toe aan favorieten","like":"gaf dit een like","vote":"stemde hiervoor"},"by_you":{"off_topic":"Jij markeerde dit als off-topic","spam":"Jij markeerde dit als spam","inappropriate":"Jij markeerde dit als ongepast","notify_moderators":"Jij markeerde dit voor moderatie","notify_user":"Je hebt een bericht gestuurd naar deze gebruiker","bookmark":"Jij voegde dit bericht toe aan je favorieten","like":"Jij hebt dit geliked","vote":"Jij hebt op dit bericht gestemd"},"by_you_and_others":{"off_topic":{"one":"Jij en iemand anders markeerden dit als off-topic","other":"Jij en {{count}} anderen markeerden dit als off-topic"},"spam":{"one":"Jij en iemand anders markeerden dit als spam","other":"Jij en {{count}} anderen markeerden dit als spam"},"inappropriate":{"one":"Jij en iemand anders markeerden dit als ongepast","other":"Jij en {{count}} anderen markeerden dit als ongepast"},"notify_moderators":{"one":"Jij en iemand anders markeerden dit voor moderatie","other":"Jij en {{count}} anderen markeerden dit voor moderatie"},"notify_user":{"one":"Jij en 1 andere stuurde een bericht naar deze gebruiker","other":"Jij en {{count}} anderen stuurden een bericht naar deze gebruiker"},"bookmark":{"one":"Jij en iemand anders voegden dit bericht toe aan zijn favorieten","other":"Jij en {{count}} anderen voegden dit bericht toe aan hun favorieten"},"like":{"one":"Jij en iemand anders hebben dit geliked","other":"Jij en {{count}} anderen hebben dit geliked"},"vote":{"one":"Jij en iemand anders hebben op dit bericht gestemd","other":"Jij en {{count}} anderen hebben op dit bericht gestemd"}},"by_others":{"off_topic":{"one":"Iemand heeft dit bericht gemarkeerd als off-topic","other":"{{count}} mensen hebben dit bericht gemarkeerd als off-topic"},"spam":{"one":"Iemand heeft dit bericht gemarkeerd als spam","other":"{{count}} Mensen hebben dit bericht gemarkeerd als spam"},"inappropriate":{"one":"Iemand heeft dit bericht gemarkeerd als ongepast ","other":"{{count}} Mensen hebben dit bericht gemarkeerd als ongepast"},"notify_moderators":{"one":"Iemand heeft dit bericht gemarkeerd voor moderatie","other":"{{count}} Mensen hebben dit bericht gemarkeerd voor moderatie"},"notify_user":{"one":"1 persoon stuurde een bericht naar deze gebruiker","other":"{{count}} stuurden een bericht naar deze gebruiker"},"bookmark":{"one":"Iemand heeft dit bericht toegevoegd aan zijn favorieten","other":"{{count}} mensen hebben dit bericht toegevoegd aan hun favorieten"},"like":{"one":"iemand heeft dit geliked","other":"{{count}} mensen hebben dit geliked"},"vote":{"one":"Iemand heeft op dit bericht gestemd","other":"{{count}} Mensen hebben op dit bericht gestemd"}}},"delete":{"confirm":{"one":"Weet je zeker dat je dit bericht wilt verwijderen?","other":"Weet je zeker dat je al deze berichten wilt verwijderen?"}},"merge":{"confirm":{"one":"Weet je zeker dat je die berichten wilt samenvoegen?","other":"Weet je zeker dat je die {{count}} berichten wilt samenvoegen?"}},"revisions":{"controls":{"first":"Eerste revisie","previous":"Vorige revisie","next":"Volgende revisie","last":"Laatste revisie","hide":"Verberg revisie","show":"Toon revisie","revert":"Keer terug naar deze revisie","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Toon het gerenderde bericht met wijzigingen als één geheel","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Toon de wijzigingen in het gerenderde bericht naast elkaar","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Bekijk de bron verschillen naast elkaar","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Bron"}}}},"category":{"can":"kan...","none":"(geen categorie)","all":"Alle categorieën","choose":"Selecteer een categorie\u0026hellip;","edit":"bewerk","edit_long":"Wijzig","view":"Bekijk topics in categorie","general":"Algemeen","settings":"Instellingen","topic_template":"Topic-sjabloon","tags":"Tags","tags_allowed_tags":"Tags die alleen in deze categorie gebruikt kunnen worden:","tags_allowed_tag_groups":"Tag groepen die alleen in deze categorie gebruikt kunnen worden:","tags_placeholder":"(Optioneel) lijst van toegestane tags","tag_groups_placeholder":"(Optioneel) lijst van toegestane tag groepen","delete":"Verwijder categorie","create":"Nieuwe categorie","create_long":"Maak categorie aan","save":"Bewaar categorie","slug":"Standaard naam voor categorie","slug_placeholder":"(Optioneel) woorden-met-koppelteken-verbinden voor URL","creation_error":"Er ging bij het maken van de categorie iets mis.","save_error":"Er ging iets mis bij het opslaan van de categorie.","name":"Naam categorie","description":"Omschrijving","topic":"Categorie topic","logo":"Categorie logo-afbeelding","background_image":"Categorie achtergrondafbeelding","badge_colors":"Badgekleuren","background_color":"Achtergrondkleur","foreground_color":"Voorgrondkleur","name_placeholder":"Maximaal een of twee woorden","color_placeholder":"Kan elke webkleur zijn","delete_confirm":"Weet je zeker dat je deze categorie wilt verwijderen?","delete_error":"Er ging iets mis bij het verwijderen van deze categorie","list":"Lijst van categorieën","no_description":"Voeg een beschrijving toe voor deze categorie","change_in_category_topic":"Wijzig omschrijving","already_used":"Deze kleur is al in gebruik door een andere categorie","security":"Beveiliging","special_warning":"Waarschuwing: Deze catogorie is een vooringestelde categorie en de beveiligingsinstellingen kunnen hierdoor niet bewerkt worden. Als u deze categorie niet wenst te gebruiken, verwijder deze of geef het een nieuw doel.","images":"Afbeeldingen","auto_close_label":"Sluit topics automatisch na:","auto_close_units":"uren","email_in":"Adres voor inkomende e-mail:","email_in_allow_strangers":"Accepteer e-mails van anonieme gebruikers zonder account","email_in_disabled":"Het plaatsen van nieuwe topics via e-mail is uitgeschakeld in de webite-instellingen. Om het plaatsen van nieuwe topic via e-mail mogelijk te maken,","email_in_disabled_click":"schakel \"e-mail in\" instelling in.","suppress_from_homepage":"Negeer deze categorie op de homepage","allow_badges_label":"Laat badges toekennen voor deze categorie","edit_permissions":"Wijzig permissies","add_permission":"Nieuwe permissie","this_year":"dit jaar","position":"positie","default_position":"Standaard positie","position_disabled":"Categorieën worden getoond op volgorde van activiteit. Om de volgorde van categorieën in lijst aan te passen,","position_disabled_click":"schakel \"vaste categorieposities\" in.","parent":"Bovenliggende categorie","notifications":{"watching":{"title":"In de gaten houden","description":"Je zal automatisch alle topics in deze categorieën in de gaten houden. Je ontvangt een notificatie van alle nieuwe berichten in elk topic. Daarnaast zal het aantal nieuwe antwoorden naast de topic verschijnen."},"watching_first_post":{"title":"Eerste bericht in de gaten houden","description":"Je krijgt alleen een notificatie van het eerste bericht in elk nieuwe topic in deze categorieën"},"tracking":{"title":"Volgen","description":"Je zal automatisch alle topics in deze categorieën volgen. Je ontvangt een notificatie als iemand je @naam noemt of op een bericht van je antwoordt, en het aantal nieuwe antwoorden zal naast de topic verschijnen."},"regular":{"title":"Normaal","description":"Je krijgt een notificatie als iemand je @naam noemt of reageert op een van je berichten."},"muted":{"title":"Genegeerd","description":"Je zult niet op de hoogte worden gebracht over nieuwe topics in deze categorie en ze zullen niet verschijnen in Recent."}}},"flagging":{"title":"Bedankt voor het helpen beleefd houden van onze gemeenschap!","action":"Meld bericht","take_action":"Onderneem actie","notify_action":"Bericht","official_warning":"Officiële waarschuwing","delete_spammer":"Verwijder spammer","yes_delete_spammer":"Ja, verwijder spammer","ip_address_missing":"(N.V.T.)","hidden_email_address":"(verborgen)","submit_tooltip":"Verstuur de privé-markering","take_action_tooltip":"Bereik de markeerdrempel direct, in plaats van het wachten op meer markeringen door anderen","cant":"Sorry, je kan dit bericht momenteel niet markeren.","notify_staff":"Stuur beheerders een privé-melding","formatted_name":{"off_topic":"Het is off-topic","inappropriate":"Het is ongepast","spam":"Dit is spam"},"custom_placeholder_notify_user":"Wees specifiek, opbouwend en blijf altijd beleefd.","custom_placeholder_notify_moderators":"Laat ons specifiek weten waar je je zorgen om maakt en stuur relevante links en voorbeelden mee waar mogelijk."},"flagging_topic":{"title":"Bedankt voor het helpen beleefd houden van onze gemeenschap!","action":"Markeer topic","notify_action":"Bericht"},"topic_map":{"title":"Topicsamenvatting","participants_title":"Frequente schrijvers","links_title":"Populaire links","links_shown":"toon meer links...","clicks":{"one":"1 klik","other":"%{count} klikken"}},"post_links":{"about":"klap meer links uit in dit bericht","title":{"one":"nog 1","other":"nog %{count}"}},"topic_statuses":{"warning":{"help":"Dit is een officiële waarschuwing."},"bookmarked":{"help":"Je hebt deze topic aan je favorieten toegevoegd"},"locked":{"help":"Deze topic is gesloten; reageren is niet meer mogelijk"},"archived":{"help":"Deze topic is gearchiveerd en kan niet meer gewijzigd worden"},"locked_and_archived":{"help":"Deze topic is gesloten en gearchiveerd; reageren of wijzigen is niet langer mogelijk."},"unpinned":{"title":"Niet vastgepind","help":"Dit topic is niet langer voor je vastgepind en zal weer in de normale volgorde getoond worden"},"pinned_globally":{"title":"Globaal vastgepind","help":"Deze topic is globaal vastgepind en zal bovenaan de lijsten Top en Recent getoond worden."},"pinned":{"title":"Vastgepind","help":"Dit topic is vastgepind voor je en zal bovenaan de categorie getoond worden"},"invisible":{"help":"Dit topic is niet zichtbaar; het zal niet verschijnen in de topiclijst en kan alleen bekeken worden met een directe link"}},"posts":"Berichten","posts_long":"er zijn {{number}} berichten in deze topic","original_post":"Originele bericht","views":"Bekeken","views_lowercase":{"one":"weergave","other":"weergaves"},"replies":"Reacties","views_long":"deze topic is {{number}} keer bekeken","activity":"Activiteit","likes":"Likes","likes_lowercase":{"one":"like","other":"likes"},"likes_long":"er zijn {{count}} likes in deze topic","users":"Gebruikers","users_lowercase":{"one":"gebruiker","other":"gebruikers"},"category_title":"Categorie","history":"Geschiedenis","changed_by":"door {{author}}","raw_email":{"title":"Broncode van e-mail","not_available":"Niet beschikbaar"},"categories_list":"Categorielijst","filters":{"with_topics":"%{filter} topics","with_category":"%{filter} %{category} topics","latest":{"title":"Laatste","title_with_count":{"one":"Laatste (1)","other":"Laatste ({{count}})"},"help":"topics met recente berichten"},"hot":{"title":"Populair","help":"een selectie van de meest populaire topics"},"read":{"title":"Gelezen","help":"topics die je hebt gelezen, in de volgorde wanneer je ze voor het laatst gelezen hebt"},"search":{"title":"Zoek","help":"zoek in alle topics"},"categories":{"title":"Categorieën","title_in":"Categorie - {{categoryName}}","help":"alle topics gegroepeerd per categorie"},"unread":{"title":"Ongelezen","title_with_count":{"one":"Ongelezen (1)","other":"Ongelezen ({{count}})"},"help":"topics die je volgt of in de gaten houdt met ongelezen berichten","lower_title_with_count":{"one":"1 ongelezen","other":"{{count}} ongelezen"}},"new":{"lower_title_with_count":{"one":"1 nieuw","other":"{{count}} nieuw"},"lower_title":"nieuw","title":"Nieuw","title_with_count":{"one":"Nieuw (1)","other":"Nieuw ({{count}})"},"help":"topics gemaakt in de afgelopen dagen"},"posted":{"title":"Mijn berichten","help":"topics waarin je een bericht hebt geplaatst"},"bookmarks":{"title":"Favorieten","help":"je favoriete topics"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"recente topics in de categorie {{categoryName}}"},"top":{"title":"Top","help":"de meest actieve topics van het afgelopen jaar, maand of dag","all":{"title":"Sinds het begin"},"yearly":{"title":"Jaarlijks"},"quarterly":{"title":"Per kwartaal"},"monthly":{"title":"Maandelijks"},"weekly":{"title":"Wekelijks"},"daily":{"title":"Dagelijks"},"all_time":"Sinds het begin","this_year":"Jaar","this_quarter":"Kwartaal","this_month":"Maand","this_week":"Week","today":"Vandaag","other_periods":"bekijk eerste"}},"browser_update":"Helaas \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eis je browser te oud om te kunnen werken met deze site\u003c/a\u003e. \u003ca href=\"http://browsehappy.com\"\u003eUpgrade a.u.b. je browser\u003c/a\u003e.","permission_types":{"full":"Maak topic / Reageer / Bekijk","create_post":"Reageer / Bekijk","readonly":"Bekijk"},"lightbox":{"download":"download"},"search_help":{"title":"Zoeken in Help"},"keyboard_shortcuts_help":{"title":"Sneltoetsen","jump_to":{"title":"Ga naar","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Hoofdpagina","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Recent","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nieuw","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Ongelezen","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categorieën","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Top","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Favorieten","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profiel","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Berichten"},"navigation":{"title":"Navigatie","jump":"\u003cb\u003e#\u003c/b\u003e Ga naar bericht #","back":"\u003cb\u003eu\u003c/b\u003e Terug","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Verplaats selectie \u0026uarr; \u0026darr;","open":"\u003cb\u003eo\u003c/b\u003e of \u003cb\u003eEnter\u003c/b\u003e Open geselecteerde topic","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Volgende/vorige sectie"},"application":{"title":"Programma","create":"\u003cb\u003ec\u003c/b\u003e Maak nieuwe topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notificaties","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Open hamburgermenu","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Open gebruikersmenu","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Toon geüpdatete topics","search":"\u003cb\u003e/\u003c/b\u003e Zoeken","help":"\u003cb\u003e?\u003c/b\u003e Toon sneltoetsen","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Verwerp Nieuw/Berichten","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Verwerp topics","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Uitloggen"},"actions":{"title":"Acties","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Stel topic wel of niet in als favoriet ","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Vastpinnen/Ontpinnen topic","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Deel topic","share_post":"\u003cb\u003es\u003c/b\u003e Deel bericht","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Reageer als verwezen topic","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Reageer op topic","reply_post":"\u003cb\u003er\u003c/b\u003e Reageer op bericht","quote_post":"\u003cb\u003eq\u003c/b\u003e Citeer bericht","like":"\u003cb\u003el\u003c/b\u003e Like bericht","flag":"\u003cb\u003e!\u003c/b\u003e Markeer bericht","bookmark":"\u003cb\u003eb\u003c/b\u003e Voeg bericht toe aan favorieten","edit":"\u003cb\u003ee\u003c/b\u003e Wijzig bericht","delete":"\u003cb\u003ed\u003c/b\u003e Verwijder bericht","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Negeer topic","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Markeer topic als normaal","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Volg topic","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Houd topic in de gaten"}},"badges":{"earned_n_times":{"one":"Deze badge is 1 keer verdiend","other":"Deze badge is %{count} keer verdiend"},"granted_on":"Toegekend op %{date}","others_count":"Anderen met deze badge (%{count})","title":"Badges","allow_title":"beschikbare titel","multiple_grant":"meerdere malen toegekend","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 Meer","other":"+%{count} Meer"},"granted":{"one":"1 toegekend","other":"%{count} toegekend"},"select_badge_for_title":"Kies een badge om als je titel te gebruiken","none":"\u003cgeen\u003e","badge_grouping":{"getting_started":{"name":"Aan de slag"},"community":{"name":"Gemeenschap"},"trust_level":{"name":"Trustlevel"},"other":{"name":"Anders"},"posting":{"name":"Schrijven"}}},"google_search":"\u003ch3\u003eZoeken met Google\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Alle tags","selector_all_tags":"alle tags","selector_no_tags":"geen tags","changed":"gewijzigde tags:","tags":"Tags","choose_for_topic":"Kies optionele tags voor deze topic","delete_tag":"Verwijder tag","delete_confirm":"Weet je zeker dat je deze tag wilt verwijderen?","rename_tag":"Tag hernoemen","rename_instructions":"Kies een nieuwe naam voor de tag:","sort_by":"Sorteer op:","sort_by_count":"aantal","sort_by_name":"naam","manage_groups":"Beheer tag groepen","manage_groups_description":"Definieer groepen om tags te organiseren","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} ongetagde topics","untagged_with_category":"%{filter} ongetagde topics in %{category}"},"notifications":{"watching":{"title":"In de gaten houden","description":"Je zal automatisch alle nieuwe topics met deze tag in de gaten houden. Je ontvangt een notificatie van alle nieuwe berichten en topics, en het aantal ongelezen en nieuwe berichten zal naast de topic verschijnen."},"watching_first_post":{"title":"Eerste bericht in de gaten houden.","description":"Je krijgt alleen een notificatie van de eerste post in elk nieuwe topic met deze tag."},"tracking":{"title":"Volgen","description":"Je zal automatisch alle nieuwe topics met deze tag volgen. Het aantal ongelezen en nieuwe berichten zal naast de topic verschijnen."},"regular":{"title":"Normaal","description":"Je krijgt een notificatie als iemand je @naam noemt of reageert op je bericht."},"muted":{"title":"Negeren","description":"Je zal geen notificaties krijgen over nieuwe topics en berichten met deze tag en ze verschijnen niet in je ongelezen overzicht."}},"groups":{"title":"Tag groepen","about":"Voeg tags toe aan groepen om ze makkelijker te beheren.","new":"Nieuwe groep","tags_label":"Tags in deze groep:","parent_tag_label":"Bovenliggende tag:","parent_tag_placeholder":"Optioneel","parent_tag_description":"Tags uit deze groep kunnen niet gebruikt worden tenzij de bovenliggende tag actief is.","one_per_topic_label":"Limiteer tot 1 tag per topic uit deze groep","new_name":"Nieuwe tag groep","save":"Opslaan","delete":"Verwijderen","confirm_delete":"Weet je zeker dat je deze tag groep wilt verwijderen?"},"topics":{"none":{"unread":"Je hebt geen ongelezen topics.","new":"Je hebt geen nieuwe topics.","read":"Je hebt nog geen topics gelezen.","posted":"Je hebt nog niet in een topic gereageerd.","latest":"Er zijn geen recente topics.","hot":"Er zijn geen populaire topics.","bookmarks":"Je hebt nog geen favoriete topics.","top":"Er zijn geen top topics.","search":"Je zoekopdracht heeft geen resultaten."},"bottom":{"latest":"Er zijn geen recente topics meer.","hot":"Er zijn geen populaire topics meer.","posted":"Er zijn geen geplaatste topics meer.","read":"Er zijn geen gelezen topics meer.","new":"Er zijn geen nieuwe topics meer.","unread":"Er zijn geen ongelezen topics meer.","top":"Er zijn geen top topics meer.","bookmarks":"Er zijn geen topics meer in je favorieten.","search":"Er zijn geen zoekresultaten meer."}}},"invite":{"custom_message":"Maak je uitnodiging iets persoonlijker door het schrijven van een ","custom_message_link":"eigen bericht","custom_message_placeholder":"Schrijf je eigen bericht","custom_message_template_forum":"Hoi, je zou eens moeten komen kijken op dit forum!","custom_message_template_topic":"Hoi, deze topic lijkt me wel iets voor jou!"},"poll":{"voters":{"one":"stemmer","other":"stemmers"},"total_votes":{"one":"totale stem","other":"totale stemmen"},"average_rating":"Gemiddeld cijfer: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Stemmen zijn openbaar."},"multiple":{"help":{"at_least_min_options":{"one":"Kies tenminste \u003cstrong\u003e1\u003c/strong\u003e optie","other":"Kies tenminste \u003cstrong\u003e%{count}\u003c/strong\u003e opties"},"up_to_max_options":{"one":"Kies maximaal \u003cstrong\u003e1\u003c/string\u003e optie","other":"Kies maximaal \u003cstrong\u003e%{count}\u003c/string\u003e opties"},"x_options":{"one":"Kies \u003cstrong\u003e1\u003c/strong\u003e optie","other":"Kies \u003cstrong\u003e%{count}\u003c/strong\u003e opties"},"between_min_and_max_options":"Kies \u003cstrong\u003e%{min}\u003c/strong\u003e tot \u003cstrong\u003e%{max}\u003c/strong\u003e opties"}},"cast-votes":{"title":"Breng je stemmen uit","label":"Stem nu!"},"show-results":{"title":"Bekijk de resultaten van de poll","label":"Bekijk resultaten"},"hide-results":{"title":"Terug naar je stemmen","label":"Verberg resultaten"},"open":{"title":"Open de poll","label":"Open","confirm":"Weet je zeker dat je deze poll wil openen?"},"close":{"title":"Sluit de poll","label":"Sluit","confirm":"Weet je zeker dat je deze poll wil sluiten?"},"error_while_toggling_status":"Sorry, er is iets misgegaan bij het aanpassen van de status van deze poll.","error_while_casting_votes":"Sorry, er is iets misgegaan bij het uitbrengen van je stemmen.","error_while_fetching_voters":"Sorry, er is iets misgegaan bij het weergeven van de stemmers.","ui_builder":{"title":"Maak Poll","insert":"Poll Invoegen","help":{"options_count":"Geef ten minste 2 opties"},"poll_type":{"label":"Type","regular":"Eén Keuze","multiple":"Multiple Choice","number":"Numerieke Beoordeling"},"poll_config":{"max":"Max","min":"Min","step":"Stap"},"poll_public":{"label":"Laat zien wie gestemd heeft"},"poll_options":{"label":"Geef één polloptie per regel op"}}},"type_to_filter":"typ om te filteren...","admin":{"title":"Discourse Beheer","moderator":"Moderator","dashboard":{"title":"Dashboard","last_updated":"Dashboard laatst bijgewerkt:","version":"Versie","up_to_date":"Je bent up to date!","critical_available":"Er is een belangrijke update beschikbaar","updates_available":"Er zijn updates beschikbaar","please_upgrade":"Werk de software bij alsjeblieft","no_check_performed":"Er is nog niet op updates gecontroleerd. Zorg dat sidekiq draait.","stale_data":"Er is al een tijdje niet op updates gecontroleerd. Zorg dat sidekiq loopt.\"","version_check_pending":"Je hebt de software recentelijk bijgewerkt. Mooi!","installed_version":"Geïnstalleerd","latest_version":"Recent","problems_found":"Er zijn een aantal problemen gevonden met je Discourse-installatie:","last_checked":"Laatste check","refresh_problems":"Laad opnieuw","no_problems":"Er zijn geen problemen gevonden","moderators":"Moderators:","admins":"Admins:","blocked":"Geblokkeerd:","suspended":"Geschorst:","private_messages_short":"PB's","private_messages_title":"Berichten","mobile_title":"Mobiel","space_free":"{{size}} beschikbaar","uploads":"uploads","backups":"backups","traffic_short":"Verkeer","traffic":"Applicatie webverzoeken","page_views":"API-verzoeken","page_views_short":"API-verzoeken","show_traffic_report":"Laat gedetailleerd verkeersrapport zien","reports":{"today":"Vandaag","yesterday":"Gisteren","last_7_days":"Afgelopen 7 dagen","last_30_days":"Afgelopen 30 dagen","all_time":"Sinds het begin","7_days_ago":"7 Dagen geleden","30_days_ago":"30 Dagen geleden","all":"Alle","view_table":"tabel","view_graph":"grafiek","refresh_report":"Ververs rapport","start_date":"Startdatum","end_date":"Einddatum","groups":"Alle groepen"}},"commits":{"latest_changes":"Laatste wijzigingen: update regelmatig!","by":"door"},"flags":{"title":"Meldingen","old":"Oud","active":"Actief","agree":"Akkoord","agree_title":"Bevestig dat deze melding geldig en correct is","agree_flag_modal_title":"Akkoord en ... ","agree_flag_hide_post":"Akkoord (verberg bericht en stuur privébericht)","agree_flag_hide_post_title":"Verberg dit bericht en stuur de gebruiker een bericht met het dringenge verzoek om het aan te passen","agree_flag_restore_post":"Akkoord (herstel bericht)","agree_flag_restore_post_title":"Herstel dit bericht","agree_flag":"Akkoord met melding","agree_flag_title":"Ga akkoord met de melding en laat het bericht ongewijzigd","defer_flag":"Negeer","defer_flag_title":"Verwijder deze melding; er is nu geen actie nodig","delete":"Verwijder","delete_title":"Verwijder het bericht waar deze melding naar verwijst","delete_post_defer_flag":"Verwijder bericht en negeer melding","delete_post_defer_flag_title":"Verwijder bericht en als dit het eerste bericht is; de hele topic","delete_post_agree_flag":"Ga akkoord met de melding en verwijder het bericht","delete_post_agree_flag_title":"Verwijder bericht en als dit het eerste bericht is; de hele topic","delete_flag_modal_title":"Verwijder en ... ","delete_spammer":"Verwijder spammer","delete_spammer_title":"Verwijder de gebruiker en alle door deze gebruiker geplaatste berichten en topics.","disagree_flag_unhide_post":"Niet akkoord (toon bericht)","disagree_flag_unhide_post_title":"Verwijder alle meldingen over dit bericht en maak het bericht weer zichtbaar","disagree_flag":"Niet akkoord","disagree_flag_title":"Deze melding is ongeldig of niet correct","clear_topic_flags":"Gedaan","clear_topic_flags_title":"De topic is onderzocht en problemen zijn opgelost. Klik op Gedaan om de meldingen te verwijderen.","more":"(meer antwoorden...)","dispositions":{"agreed":"akkoord","disagreed":"niet akkoord","deferred":"genegeerd"},"flagged_by":"Gemarkeerd door","resolved_by":"Opgelost door","took_action":"Heeft actie ondernomen","system":"Systeem","error":"Er ging iets mis","reply_message":"Reageer","no_results":"Er zijn geen markeringen","topic_flagged":"Deze \u003cstrong\u003etopic\u003c/strong\u003e is gemarkeerd.","visit_topic":"Ga naar de topic om te zien wat er aan de hand is en om actie te ondernemen","was_edited":"Bericht is gewijzigd na de eerste melding","previous_flags_count":"Er is al {{count}} keer melding gemaakt over dit bericht.","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"ongepast","other":"ongepast x{{count}}"},"action_type_6":{"one":"custom","other":"custom x{{count}}"},"action_type_7":{"one":"custom","other":"custom x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Primaire groep","no_primary":"(geen primaire groep)","title":"Groepen","edit":"Wijzig groepen","refresh":"Herlaad","new":"Nieuw","selector_placeholder":"vul gebruikersnaam in","name_placeholder":"Groepsnaam, geen spaties, zelfde regels als bij een gebruikersnaam","about":"Wijzig hier je deelname aan groepen en je namen","group_members":"Groepsleden","delete":"Verwijder","delete_confirm":"Verwijder deze groepen?","delete_failed":"Kan groep niet verwijderen. Als dit een automatische groep is, kan deze niet verwijderd worden.","delete_member_confirm":"Verwijder '%{username}' uit de '%{group'} groep?","delete_owner_confirm":"Verwijder eigenaarsprivileges van '% {username}'?","name":"Naam","add":"Voeg toe","add_members":"Voeg leden toe","custom":"Aangepast","bulk_complete":"De gebruikers zijn toegevoegd aan de groep.","bulk":"Bulk toevoegen aan groep","bulk_paste":"Plak een lijst van gebruikersnamen of e-mailadressen, één per regel:","bulk_select":"(selecteer een groep)","automatic":"Automatisch","automatic_membership_email_domains":"Gebruikers die zich registeren met een e-mailadres bij een domein dat exact overeenkomt met de domeinen in deze lijst worden automatisch toegevoegd aan deze groep:","automatic_membership_retroactive":"Pas deze e-mail domeinregel toe op reeds geregistreerde gebruikers","default_title":"Standaardtitel voor alle gebruikers in deze groep","primary_group":"Automatisch ingesteld als primaire groep","group_owners":"Eigenaren","add_owners":"Eigenaren toevoegen","incoming_email":"Aangepaste inkomende e-mailadressen ","incoming_email_placeholder":"Voer je e-mailadres in"},"api":{"generate_master":"Genereer Master API Key","none":"Er zijn geen actieve API keys","user":"Gebruiker","title":"API","key":"API Key","generate":"Genereer","regenerate":"Genereer opnieuw","revoke":"Intrekken","confirm_regen":"Weet je zeker dat je die API Key wilt vervangen door een nieuwe?","confirm_revoke":"Weet je zeker dat je die API Key wilt intrekken?","info_html":"Met deze API-key kun je met behulp van JSON-calls topics maken en bewerken.","all_users":"Alle gebruikers","note_html":"Houd deze key \u003cstrong\u003egeheim\u003c/strong\u003e, alle gebruikers die hierover beschikken kunnen berichten plaatsen als elke andere gebruiker."},"plugins":{"title":"Plugins","installed":"Geïnstalleerde plugins","name":"Naam","none_installed":"Je hebt geen plugins geïnstalleerd.","version":"Versie","enabled":"Ingeschakeld?","is_enabled":"J","not_enabled":"N","change_settings":"Wijzig instellingen","change_settings_short":"Instellingen","howto":"Hoe kan ik plugins installeren"},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Logs"},"none":"Geen backup beschikbaar.","read_only":{"enable":{"title":"Schakel alleen-lezen modus in","label":"Schakel alleen-lezen in","confirm":"Weet je zeker dat je de alleen-lezen modus wilt inschakelen?"},"disable":{"title":"Schakel alleen-lezen modus uit","label":"Schakel alleen-lezen uit"}},"logs":{"none":"Nog geen logs..."},"columns":{"filename":"Bestandsnaam","size":"Grootte"},"upload":{"label":"Upload","title":"Upload een backup naar deze instantie","uploading":"Uploaden...","success":"'{{filename}}' is geupload.","error":"Er ging iets fout bij het uploaden van '{{filename}}': {{message}}"},"operations":{"is_running":"Er wordt al een actie uitgevoerd...","failed":"De actie {{operation}} is mislukt. Kijk in de logs.","cancel":{"label":"Annuleer","title":"Annuleer de huidige actie","confirm":"Weet je zeker dat je de huidige actie wilt annuleren?"},"backup":{"label":"Backup","title":"Maak een backup","confirm":"Wil je een nieuwe backup starten? ","without_uploads":"Ja (bestanden niet invoegen)"},"download":{"label":"Download","title":"Download de backup"},"destroy":{"title":"Verwijder de backup","confirm":"Weet je zeker dat je deze backup wilt verwijderen?"},"restore":{"is_disabled":"Herstellen is uitgeschakeld in de instellingen.","label":"Herstel","title":"Herstel van deze backup","confirm":"Weet je zeker dat je deze backup wilt terugzetten? "},"rollback":{"label":"Herstel","title":"Herstel de database naar de laatst werkende versie","confirm":"Weet je zeker dat je de database wilt terugzetten naar de vorige werkende staat?"}}},"export_csv":{"user_archive_confirm":"Weet je zeker dat je al je berichten wilt downloaden?","success":"Exporteren is gestart, je zult een bericht ontvangen als het proces is afgerond.","failed":"Exporteren is mislukt. Controleer de logbestanden.","rate_limit_error":"Berichten kunnen één keer per dag gedownload worden, probeer het morgen nog eens.","button_text":"Exporteren","button_title":{"user":"Exporteer volledige gebruikerslijst in CSV-formaat","staff_action":"Exporteer volledige staf actie logboek in CSV-formaat.","screened_email":"Exporteer volledige gescreende e-maillijst in CSV-formaat.","screened_ip":"Exporteer volledige gescreende IP-lijst in CSV-formaat.","screened_url":"Exporteerd volledige gescreende URL-lijst in CSV-formaat."}},"export_json":{"button_text":"Exporteer"},"invite":{"button_text":"Verstuur uitnodigingen","button_title":"Verstuur uitnodigingen"},"customize":{"title":"Aanpassingen","long_title":"Aanpassingen aan de site","css":"CSS","header":"Header","top":"Top","footer":"Voettekst","embedded_css":"Embedded CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML dat ingevoegd wordt voor de \u003c/head\u003e tag"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML dat ingevoegd wordt voor de \u003c/body\u003e tag"},"override_default":"Sluit de standaard stylesheet uit","enabled":"Ingeschakeld?","preview":"voorbeeld","undo_preview":"verwijder voorbeeld","rescue_preview":"standaard stijl","explain_preview":"Bekijk de site met deze aangepaste stylesheet","explain_undo_preview":"Keer terug naar de aangepaste stylesheet die op dit moment ingesteld is","explain_rescue_preview":"Bekijk de site met de standaard stylesheet","save":"Opslaan","new":"Nieuw","new_style":"Nieuwe stijl","import":"Importeer","import_title":"Selecteer een bestand of plak tekst","delete":"Verwijder","delete_confirm":"Verwijder deze aanpassing?","about":"Pas CSS stylesheets en HTML headers aan op de site. Voeg een aanpassing toe om te beginnen.","color":"Kleur","opacity":"Doorzichtigheid","copy":"Kopieër","email_templates":{"title":"E-mailsjabloon","subject":"Onderwerp","multiple_subjects":"Deze e-mailsjabloon heeft meerdere onderwerpen.","body":"Body","none_selected":"Kies een e-mailsjabloon om te beginnen met bewerken.","revert":"Maak wijzigingen ongedaan","revert_confirm":"Weet je zeker dat je je wijzigingen ongedaan wilt maken?"},"css_html":{"title":"CSS/HTML","long_title":"CSS en HTML aanpassingen"},"colors":{"title":"Kleuren","long_title":"Kleurenschema's","about":"Met kleurenschema's kun je de kleuren in de site aanpassen zonder CSS te hoeven gebruiken. Kies er één of voeg er één toe om te beginnen.","new_name":"Nieuw kleurenschema","copy_name_prefix":"Kopie van","delete_confirm":"Dit kleurenschema verwijderen?","undo":"herstel","undo_title":"Draai je wijzigingen aan deze kleur terug tot de laatste keer dat het opgeslagen is.","revert":"Zet terug","revert_title":"Zet deze kleur terug naar het standaard kleurenschema van Discourse.","primary":{"name":"primaire","description":"Meeste teksten, iconen en randen."},"secondary":{"name":"secundaire","description":"De achtergrond- en tekstkleur van sommige knoppen."},"tertiary":{"name":"tertiaire","description":"Links, knoppen, notificaties en accentkleur."},"quaternary":{"name":"quaternaire","description":"Navigatie."},"header_background":{"name":"headerachtergrond","description":"Achtergrondkleur van de header."},"header_primary":{"name":"eerste header","description":"Tekst en iconen in de header."},"highlight":{"name":"opvallen","description":"De achtergrondkleur van gemarkeerde elementen op de pagina, zoals berichten en topics. "},"danger":{"name":"gevaar","description":"Opvallende kleuren voor acties als verwijderen van berichten en topics"},"success":{"name":"succes","description":"Gebruikt om aan te geven dat een actie gelukt is."},"love":{"name":"liefde","description":"De kleur van de likeknop"}}},"email":{"title":"E-mails","settings":"Instellingen","templates":"Sjablonen ","preview_digest":"Voorbeeld digestmail","sending_test":"Testmail wordt verstuurd...","error":"\u003cb\u003eFOUT\u003c/b\u003e - %{server_error}","test_error":"Er ging iets mis bij het versturen van de testmail. Kijk nog eens naar je mailinstellinen, controleer of je host mailconnecties niet blokkeert. Probeer daarna opnieuw.","sent":"Verzonden","skipped":"Overgeslagen","bounced":"Gebounced","received":"Ontvangen","rejected":"Geweigerd ","sent_at":"Verzonden op","time":"Tijd","user":"Gebruiker","email_type":"E-mailtype","to_address":"Ontvangeradres","test_email_address":"e-mailadres om te testen","send_test":"Verstuur testmail","sent_test":"verzonden!","delivery_method":"Verzendmethode","preview_digest_desc":"Bekijk een voorbeeld van de digest e-mails die gestuurd worden naar inactieve leden.","refresh":"Verniew","format":"Formaat","html":"html","text":"text","last_seen_user":"Laatste online:","reply_key":"Reply key","skipped_reason":"Reden van overslaan","incoming_emails":{"from_address":"From","to_addresses":"To","cc_addresses":"Cc","subject":"Subject","error":"Fout","none":"Geen inkomende e-mails gevonden.","modal":{"title":"Details inkomende e-mail","error":"Fout","headers":"Headers","subject":"Subject","body":"Body","rejection_message":"Afwijzingsmail"},"filters":{"from_placeholder":"van@voorbeeld.nl","to_placeholder":"aan@voorbeeld.nl","cc_placeholder":"cc@voorbeeld.nl","subject_placeholder":"Onderwerp...","error_placeholder":"Fout"}},"logs":{"none":"Geen logs gevonden.","filters":{"title":"Filter","user_placeholder":"gebruikersnaam","address_placeholder":"naam@voorbeeld.nl","type_placeholder":"digest, inschijving","reply_key_placeholder":"antwoordsleutel","skipped_reason_placeholder":"reden"}}},"logs":{"title":"Logs","action":"Actie","created_at":"Gemaakt","last_match_at":"Laatste match","match_count":"Matches","ip_address":"IP","topic_id":"Topic-ID","post_id":"Bericht ID","category_id":"Categorie ID","delete":"Verwijder","edit":"Wijzig","save":"Opslaan","screened_actions":{"block":"blokkeer","do_nothing":"doe niets"},"staff_actions":{"title":"Stafacties","instructions":"Klik op gebruikersnamen en acties om de lijst te filteren. Klik op profielfoto's om naar de gebruikerspagina te gaan.","clear_filters":"Bekijk alles","staff_user":"Staflid","target_user":"Selecteer gebruiker","subject":"Onderwerp","when":"Wanneer","context":"Context","details":"Details","previous_value":"Vorige","new_value":"Nieuw","diff":"Verschil","show":"Bekijk","modal_title":"Details","no_previous":"Er is geen vorige waarde","deleted":"Geen nieuwe waarde. De record was verwijderd.","actions":{"delete_user":"verwijder gebruiker","change_trust_level":"verander trustlevel","change_username":"wijzig gebruikersnaam","change_site_setting":"verander instellingen","change_site_customization":"verander site-aanpassingen","delete_site_customization":"verwijder site-aanpassingen","change_site_text":"verander tekst van site","suspend_user":"schors gebruiker","unsuspend_user":"hef schorsing op","grant_badge":"ken badge toe","revoke_badge":"trek badge in","check_email":"check e-mail","delete_topic":"verwijder topic","delete_post":"verwijder bericht","impersonate":"Log in als gebruiker","anonymize_user":"maak gebruiker anoniem","roll_up":"voeg IP-adressen samen in blokken","change_category_settings":"verander categorie-instellingen","delete_category":"categorie verwijderen","create_category":"nieuwe categorie","block_user":"blokkeer gebruiker","unblock_user":"deblokkeer gebruiker","grant_admin":"geef beheerdersrechten","revoke_admin":"ontneem beheerdersrechten","grant_moderation":"geef modereerrechten","revoke_moderation":"ontneem modereerrechten","backup_operation":"backuphandeling","deleted_tag":"verwijderde tag","renamed_tag":"hernoemde tag","revoke_email":"trek e-mail in"}},"screened_emails":{"title":"Gescreende e-mails","description":"Nieuwe accounts met een van deze e-mailadressen worden geblokkeerd of een andere actie wordt ondernomen.","email":"E-mailadres","actions":{"allow":"Sta toe"}},"screened_urls":{"title":"Gescreende urls","description":"Deze urls zijn gebruikt door gebruikers die als spammer gemarkeerd zijn.","url":"URL","domain":"Domein"},"screened_ips":{"title":"Gescreende ip-adressen","description":"IP-adressen die in de gaten worden gehouden. Kies 'sta toe' om deze op een witte lijst te zetten.","delete_confirm":"Weet je zeker dat je de regel voor %{ip_address} wilt verwijderen?","roll_up_confirm":"Weet je zeker dat je regelmatig gescreende IP-adressen wilt samenvoegen tot subnets?","rolled_up_some_subnets":"Verbannen IP-adressen zijn zojuist samengevoegd tot deze subnets: %{subnets}.","rolled_up_no_subnet":"Er was niets om samen te voegen.","actions":{"block":"Blokkeer","do_nothing":"Sta toe","allow_admin":"Sta Beheerder Toe"},"form":{"label":"Nieuw:","ip_address":"IP-adres","add":"Voeg toe","filter":"Zoek"},"roll_up":{"text":"Groepeer IP-adressen","title":"Creëer nieuwe subnet ban entries als er tenminste 'min_ban_entries_for_roll_up' entries zijn."}},"logster":{"title":"Foutlogs"}},"impersonate":{"title":"Log in als gebruiker","help":"Gebruik dit hulpmiddel om in te loggen als een gebruiker voor debug-doeleinden. Je moet uitloggen als je klaar bent.","not_found":"Die gebruiker is niet gevonden","invalid":"Sorry, maar als deze gebruiker mag je niet inloggen."},"users":{"title":"Leden","create":"Voeg beheerder toe","last_emailed":"Laatste e-mail verstuurd","not_found":"Sorry, deze gebruikersnaam bestaat niet in ons systeem.","id_not_found":"Sorry, deze gebruikersnaam bestaat niet in ons systeem.","active":"Actief","show_emails":"Bekijk e-mails","nav":{"new":"Nieuw","active":"Actief","pending":"Te beoordelen","staff":"Stafleden","suspended":"Geschorst","blocked":"Geblokt","suspect":"Verdacht"},"approved":"Goedgekeurd?","approved_selected":{"one":"accepteer lid","other":"accepteer {{count}} leden"},"reject_selected":{"one":"weiger lid","other":"weiger {{count}} leden"},"titles":{"active":"Actieve leden","new":"Nieuwe leden","pending":"Nog niet geaccepteerde leden","newuser":"Leden op trustlevel 0 (Nieuw lid)","basic":"Leden op trustlevel 1 (Basislid)","member":"Leden op trustlevel 2 (Lid)","regular":"Leden op trustlevel 3 (Vaste bezoeker)","leader":"Leden op trustlevel 4 (Leider)","staff":"Stafleden","admins":"Administrators","moderators":"Moderators","blocked":"Geblokkeerde leden","suspended":"Geschorste leden","suspect":"Verdachte Gebruikers"},"reject_successful":{"one":"1 Gebruiker met succes geweigerd","other":"%{count} Gebruikers met succes geweigerd"},"reject_failures":{"one":"Weigering van 1 gebruiker is niet gelukt","other":"Weigering van %{count} gebruikers is niet gelukt"},"not_verified":"Niet geverifieerd","check_email":{"title":"Laat e-mail adres van gebruiker zien","text":"Bekijk"}},"user":{"suspend_failed":"Er ging iets fout met het blokkeren van deze gebruiker: {{error}}","unsuspend_failed":"Er ging iets fout bij het deblokkeren van deze gebruiker: {{error}}","suspend_duration":"Hoe lang wil je deze gebruiker blokkeren?","suspend_duration_units":"(dagen)","suspend_reason_label":"Waarom schors je deze gebruiker? \u003cb\u003eIedereen zal deze tekst kunnen zien\u003c/b\u003e op de profielpagina van deze gebruiker en zal getoond worden als deze gebruiker probeert in te loggen. Houd het kort en bondig.","suspend_reason":"Reden","suspended_by":"Geschorst door","delete_all_posts":"Verwijder alle berichten","suspend":"Schors","unsuspend":"Herstel schorsing","suspended":"Geschorst?","moderator":"Moderator?","admin":"Beheerder?","blocked":"Geblokkeerd?","staged":"Staged?","show_admin_profile":"Beheerder","edit_title":"Wijzig titel","save_title":"Bewaar titel","refresh_browsers":"Forceer browser refresh","refresh_browsers_message":"Bericht verstuurd aan alle gebruikers!","show_public_profile":"Bekijk openbaar profiel","impersonate":"Log in als gebruiker","ip_lookup":"Zoek IP-adres op","log_out":"Uitloggen","logged_out":"Gebruiker is uitgelogd op alle apparaten","revoke_admin":"Ontneem beheerdersrechten","grant_admin":"Geef Beheerdersrechten","revoke_moderation":"Ontneem modereerrechten","grant_moderation":"Geef modereerrechten","unblock":"Deblokkeer","block":"Blokkeer","reputation":"Reputatie","permissions":"Toestemmingen","activity":"Activiteit","like_count":"Likes gegeven / ontvangen","last_100_days":"in de laatste 100 dagen","private_topics_count":"Privé-topics","posts_read_count":"Berichten gelezen","post_count":"Berichten gemaakt","topics_entered":"Topics bekeken","flags_given_count":"Meldingen gedaan","flags_received_count":"Meldigen ontvangen","warnings_received_count":"Waarschuwingen Ontvangen","flags_given_received_count":"Meldingen gedaan / ontvangen","approve":"Accepteer","approved_by":"Geaccepteerd door","approve_success":"Gebruiker geaccepteerd en e-mail verzonden met instructies voor activering.","approve_bulk_success":"Alle geselecteerde gebruikers zijn geaccepteerd en een e-mail met instructies voor activering is verstuurd.","time_read":"Leestijd","anonymize":"Anonimiseer Gebruiker","anonymize_confirm":"Weet je ZEKER dat je dit account wilt anonimiseren? Dit zal de gebruikersnaam en e-mailadres veranderen en alle profielinformatie resetten.","anonymize_yes":"Ja, anonimiseer dit account","anonymize_failed":"Er was een probleem bij het anonimiseren van het account.","delete":"Verwijder gebruiker","delete_forbidden_because_staff":"Admins en moderatoren kunnen niet verwijderd worden.","delete_posts_forbidden_because_staff":"Kan niet alle berichten van beheerders en moderatoren verwijderen.","delete_forbidden":{"one":"Gebruikers kunnen niet worden verwijderd als ze berichten geplaatst hebben. Verwijder alle berichten voordat je een gebruiker probeert te verwijderen. (Berichten ouder dan %{count} dag kunnen niet verwijderd worden)","other":"Gebruikers kunnen niet worden verwijderd als ze berichten geplaatst hebben. Verwijder alle berichten voordat je een gebruiker probeert te verwijderen. (Berichten ouder dan %{count} dagen kunnen niet verwijderd worden)"},"cant_delete_all_posts":{"one":"Kan niet alle berichten verwijderen. Sommige berichten zijn ouder dan %{count} dag (de delete_user_max_post_age instelling).","other":"Kan niet alle berichten verwijderen. Sommige berichten zijn ouder dan %{count} dagen (de delete_user_max_post_age instelling)."},"cant_delete_all_too_many_posts":{"one":"Kan niet alle berichten verwijderen omdat de gebruiker meer dan 1 bericht heeft (delete_all_posts_max).","other":"Kan niet alle berichten verwijderen omdat de gebruiker meer dan %{count} berichten heeft (delete_all_posts_max)."},"delete_confirm":"Weet je zeker dat je deze gebruiker definitief wilt verwijderen? Deze handeling kan niet ongedaan worden gemaakt! ","delete_and_block":"Verwijder en \u003cb\u003eblokkeer\u003c/b\u003e dit e-mail- en IP-adres","delete_dont_block":"Alleen verwijderen","deleted":"De gebruiker is verwijderd.","delete_failed":"Er ging iets mis bij het verwijderen van deze gebruiker. Zorg er voor dat alle berichten van deze gebruiker eerst verwijderd zijn.","send_activation_email":"Verstuur activatiemail","activation_email_sent":"Een activatiemail is verstuurd.","send_activation_email_failed":"Er ging iets mis bij het versturen van de activatiemail.","activate":"Activeer account","activate_failed":"Er ging iets mis bij het activeren van deze gebruiker.","deactivate_account":"Deactiveer account","deactivate_failed":"Er ging iets mis bij het deactiveren van deze gebruiker.","unblock_failed":"Er ging iets mis bij het deblokkeren van deze gebruiker.","block_failed":"Er ging iets mis bij het blokkeren van deze gebruiker.","block_confirm":"Weet je zeker dat je deze gebruiker wilt blokkeren? Deze gebruiker is dan niet meer in staat om nieuwe topics of berichten te plaatsen.","block_accept":"Ja, blokkeer deze gebruiker","bounce_score":"Bouncescore","reset_bounce_score":{"label":"Reset","title":"Reset bouncescore naar 0"},"deactivate_explanation":"Een gedeactiveerde gebruiker moet zijn e-mailadres opnieuw bevestigen.","suspended_explanation":"Een geschorste gebruiker kan niet meer inloggen.","block_explanation":"Een geblokkeerde gebruiker kan geen topics maken of reageren op topics.","staged_explanation":"Een staged gebruiker kan alleen via e-mail in specifieke topics berichten plaatsen.","bounce_score_explanation":{"none":"Er zijn onlangs geen bounceberichten ontvangen van dit e-mailadres.","some":"Er zijn onlangs enkele bounceberichten ontvangen van dit e-mailadres.","threshold_reached":"Er zijn te veel bounceberichten ontvangen van dit e-mailadres."},"trust_level_change_failed":"Er ging iets mis bij het wijzigen van het trustlevel van deze gebruiker.","suspend_modal_title":"Schors gebruiker","trust_level_2_users":"Trustlevel 2 leden","trust_level_3_requirements":"Trustlevel 3 vereisten","trust_level_locked_tip":"trustlevel is vrijgegeven, het systeem zal geen gebruiker bevorderen of degraderen","trust_level_unlocked_tip":"trustlevel is vrijgegeven, het systeem zal gebruiker bevorderen of degraderen","lock_trust_level":"Zet trustlevel vast","unlock_trust_level":"Geef trustlevel vrij","tl3_requirements":{"title":"Vereisten voor trustlevel 3","value_heading":"Waarde","requirement_heading":"Vereiste","visits":"Bezoeken","days":"dagen","topics_replied_to":"Topics waarin gereageerd is","topics_viewed":"Topics bekeken","topics_viewed_all_time":"Topics bekeken (sinds begin)","posts_read":"Gelezen berichten","posts_read_all_time":"Berichten gelezen (ooit)","flagged_posts":"Gemarkeerde berichten","flagged_by_users":"Gebruikers die gemarkeerd hebben","likes_given":"Likes gegeven","likes_received":"Likes ontvangen","likes_received_days":"Ontvangen likes: unieke dagen","likes_received_users":"Ontvangen likes: unieke gebruikers","qualifies":"Komt in aanmerking voor trustlevel 3","does_not_qualify":"Komt niet in aanmerking voor trustlevel 3","will_be_promoted":"Zal binnenkort gepromoot worden.","will_be_demoted":"Zal binnenkort gedegradeerd worden.","on_grace_period":"Op dit moment in promotiegratieperiode, zal niet worden gedegradeerd.","locked_will_not_be_promoted":"Trustlevel vastgezet. Zal nooit bevorderd worden.","locked_will_not_be_demoted":"Trustlevel vastgezet. Zal nooit gedegradeerd worden."},"sso":{"title":"Single Sign On","external_id":"Externe ID","external_username":"Gebruikersnaam","external_name":"Naam","external_email":"E-mail","external_avatar_url":"URL van profielfoto"}},"user_fields":{"title":"Gebruikersvelden","help":"Voeg velden toe die je gebruikers in kunnen vullen.","create":"Maak gebruikersveld","untitled":"Geen titel","name":"Veldnaam","type":"Veldtype","description":"Veldomschrijving","save":"Opslaan","edit":"Wijzig","delete":"Verwijder","cancel":"Annuleer","delete_confirm":"Weet je zeker dat je dat gebruikersveld wilt verwijderen?","options":"Opties","required":{"title":"Verplicht bij inschrijven?","enabled":"verplicht","disabled":"niet verplicht"},"editable":{"title":"Bewerkbaar na aanmelden?","enabled":"kan gewijzigd worden","disabled":"wijzigen niet mogelijk"},"show_on_profile":{"title":"Laat zien op openbaar profiel?","enabled":"wordt getoond op profiel","disabled":"wordt niet getoond op profiel"},"show_on_user_card":{"title":"Toon op gebruikersprofiel?","enabled":"getoond op gebruikersprofiel","disabled":"niet getoond op gebruikerskaart"},"field_types":{"text":"Tekstveld","confirm":"Bevestiging","dropdown":"Uitklapmenu"}},"site_text":{"description":"Je kunt alle tekst op dit forum aanpassen. Begin met zoeken hieronder:","search":"Zoek naar de tekst die je wil aanpassen","title":"Tekst Inhoud","edit":"bewerk","revert":"Maak wijzigingen ongedaan","revert_confirm":"Weet je zeker dat je je wijzigingen ongedaan wilt maken?","go_back":"Terug naar Zoeken","recommended":"We adviseren je de volgende tekst aan te passen naar je eigen smaak: ","show_overriden":"Bekijk alleen bewerkte instellingen"},"site_settings":{"show_overriden":"Bekijk alleen bewerkte instellingen","title":"Instellingen","reset":"herstel","none":"geen","no_results":"Geen resultaten.","clear_filter":"Wis","add_url":"voeg URL toe","add_host":"host toevoegen","categories":{"all_results":"Alle","required":"Vereist","basic":"Basissetup","users":"Gebruikers","posting":"Schrijven","email":"E-mail","files":"Bestanden","trust":"Trustlevels","security":"Beveiliging","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Rate limits","developer":"Ontwikkelaar","embedding":"Embedden","legal":"Juridisch","uncategorized":"Overige","backups":"Backups","login":"Gebruikersnaam","plugins":"Plugins","user_preferences":"Gebruikersvoorkeuren","tags":"Tags"}},"badges":{"title":"Badges","new_badge":"Nieuwe badge","new":"Nieuw","name":"Naam","badge":"Embleem","display_name":"Lange naam","description":"Omschrijving","long_description":"Lange omschrijving","badge_type":"Badgetype","badge_grouping":"Groep","badge_groupings":{"modal_title":"Badgegroeperingen"},"granted_by":"Toegekend door","granted_at":"Toegekend op","reason_help":"(een link naar een bericht of topic)","save":"Bewaar","delete":"Verwijder","delete_confirm":"Weet je zeker dat je deze badge wilt verwijderen?","revoke":"Intrekken","reason":"Reden","expand":"Uitklappen...","revoke_confirm":"Weet je zeker dat je deze badge in wilt trekken?","edit_badges":"Wijzig badges","grant_badge":"Ken badge toe","granted_badges":"Toegekende badges","grant":"Toekennen","no_user_badges":"%{name} heeft nog geen badges toegekend gekregen.","no_badges":"Er zijn geen badges die toegekend kunnen worden.","none_selected":"Selecteer een badge om aan de slag te gaan","allow_title":"Embleem mag als titel gebruikt worden","multiple_grant":"Kan meerdere malen worden toegekend","listable":"Badge op de openbare badgespagina tonen","enabled":"Badge aanzetten","icon":"Icoon","image":"Afbeelding","icon_help":"Gebruik ofwel een Font Awesome class of een URL naar een afbeelding","query":"Badge query (SQL)","target_posts":"Geassocieerde berichten opvragen","auto_revoke":"Intrekkingsquery dagelijks uitvoeren","show_posts":"Toon bericht waarmee de badge is verdiend op badgepagina","trigger":"Trigger","trigger_type":{"none":"Dagelijks bijwerken","post_action":"Wanneer een gebruiker handelt op een bericht","post_revision":"Wanneer een gebruiker een bericht wijzigt of creëert","trust_level_change":"Wanneer een gebruiker van trustlevel verandert","user_change":"Wanneer een gebruiker is gewijzigd of gecreëerd","post_processed":"Nadat een bericht is verwerkt"},"preview":{"link_text":"Voorbeeld toegekende badges","plan_text":"Voorbeeld met uitvoeringsplan","modal_title":"Preview badge query","sql_error_header":"Er ging iets fout met de query.","error_help":"Bekijk de volgende links voor hulp met badge queries.","bad_count_warning":{"header":"LET OP!","text":"Er ontbreken toekenningsvoorbeelden. Dit gebeurt als de badge query gebruikers- of bericht-ID's retourneert die niet bestaan. Dit kan onverwachte resultaten veroorzaken op een later tijdstip - kijk a.u.b. je query goed na."},"no_grant_count":"Geen badges om toe te wijzen.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e badge toe te wijzen.","other":"\u003cb\u003e%{count}\u003c/b\u003e badges zullen worden toegewezen."},"sample":"Voorbeeld:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e voor bericht in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e voor bericht in %{link} om \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e om \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Voeg nieuwe emoji toe die beschikbaar zullen zijn voor iedereen. (PROTIP: drag \u0026 drop meerdere bestanden tegelijk)","add":"Voeg nieuw emoji toe","name":"Naam","image":"Afbeelding","delete_confirm":"Weet je zeker dat je de :%{name}: emoji wilt verwijderen?"},"embedding":{"get_started":"Als je Discourse wilt embedden in een andere website, begin met het toevoegen van de host van die website.","confirm_delete":"Weet je zeker dat je die host wilt verwijderen?","sample":"Gebruik de volgende HTML-code om discourse topics te maken en te embedden in je website. Vervang \u003cb\u003eREPLACE_ME\u003c/b\u003e met de volledige URL van de pagina waarin je het topic wilt embedden.","title":"Embedden","host":"Toegestane hosts","edit":"wijzig","category":"Bericht naar categorie","add_host":"Voeg host toe","settings":"Embeddinginstellingen","feed_settings":"Feedinstellingen","feed_description":"Een RSS- of ATOM-feed van je site kan de import van content naar Discourse verbeteren.","crawling_settings":"Crawlerinstellingen","crawling_description":"Als Discourse topics maakt voor je berichten, zonder dat er gebruik gemaakt wordt van de RSS/ATOM feed, dan zal Discourse proberen je content vanuit je HTML te parsen. Soms kan het complex zijn om je content af te leiden, daarom voorziet Discourse in de mogelijkheid voor het specificeren van CSS-regels om het afleiden gemakkelijker te maken.","embed_by_username":"Gebruikersnaam voor het maken van topics","embed_post_limit":"Maximaal aantal berichten om te embedden","embed_username_key_from_feed":"Key om de discourse gebruikersnaam uit de feed te halen","embed_truncate":"Embedde berichten inkorten","embed_whitelist_selector":"CSS selector voor elementen die worden toegestaan bij embedding","embed_blacklist_selector":"CSS selector voor elementen die worden verwijderd bij embedding","embed_classname_whitelist":"Toegestane CSS-classnamen","feed_polling_enabled":"Importeer berichten via RSS/ATOM","feed_polling_url":"URL van RSS/ATOM feed voor crawling","save":"Embeddinginstellingen opslaan "},"permalink":{"title":"Permalink","url":"URL","topic_id":"Topic-ID","topic_title":"Topic","post_id":"Bericht ID","post_title":"Bericht","category_id":"Categorie ID","category_title":"Categorie","external_url":"Externe URL","delete_confirm":"Weet je zeker dat je deze permalink wilt verwijderen?","form":{"label":"Nieuw:","add":"Voeg toe","filter":"Zoeken (URL of Externe URL)"}}}}},"en":{"js":{"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write"},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}."},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"notifications":{"reasons":{"3_10":"You will receive notifications because you are watching a tag on this topic."}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'nl';
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
//! locale : dutch (nl)
//! author : Joris Röling : https://github.com/jjupiter

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var monthsShortWithDots = 'jan._feb._mrt._apr._mei_jun._jul._aug._sep._okt._nov._dec.'.split('_'),
        monthsShortWithoutDots = 'jan_feb_mrt_apr_mei_jun_jul_aug_sep_okt_nov_dec'.split('_');

    var nl = moment.defineLocale('nl', {
        months : 'januari_februari_maart_april_mei_juni_juli_augustus_september_oktober_november_december'.split('_'),
        monthsShort : function (m, format) {
            if (/-MMM-/.test(format)) {
                return monthsShortWithoutDots[m.month()];
            } else {
                return monthsShortWithDots[m.month()];
            }
        },
        monthsParseExact : true,
        weekdays : 'zondag_maandag_dinsdag_woensdag_donderdag_vrijdag_zaterdag'.split('_'),
        weekdaysShort : 'zo._ma._di._wo._do._vr._za.'.split('_'),
        weekdaysMin : 'Zo_Ma_Di_Wo_Do_Vr_Za'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD-MM-YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[vandaag om] LT',
            nextDay: '[morgen om] LT',
            nextWeek: 'dddd [om] LT',
            lastDay: '[gisteren om] LT',
            lastWeek: '[afgelopen] dddd [om] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : 'over %s',
            past : '%s geleden',
            s : 'een paar seconden',
            m : 'één minuut',
            mm : '%d minuten',
            h : 'één uur',
            hh : '%d uur',
            d : 'één dag',
            dd : '%d dagen',
            M : 'één maand',
            MM : '%d maanden',
            y : 'één jaar',
            yy : '%d jaar'
        },
        ordinalParse: /\d{1,2}(ste|de)/,
        ordinal : function (number) {
            return number + ((number === 1 || number === 8 || number >= 20) ? 'ste' : 'de');
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return nl;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY H:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
