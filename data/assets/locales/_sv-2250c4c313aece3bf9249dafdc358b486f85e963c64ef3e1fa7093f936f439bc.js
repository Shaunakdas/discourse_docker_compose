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
r += "Det finns ";
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
r += "<a href='/unread'>1 oläst</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " olästa</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "och ";
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
r += " <a href='/new'>1 nytt</a> ämne";
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
r += "och ";
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
})() + " nya</a> ämnen";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " kvar, eller ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "bläddra bland andra ämnen i ";
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
r += "Detta ämne har ";
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
r += (pf_0[ MessageFormat.locale["sv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "med ett högt förhållande mellan gilla och inlägg";
return r;
},
"med" : function(d){
var r = "";
r += "med ett väldigt högt förhållande mellan gilla och inlägg";
return r;
},
"high" : function(d){
var r = "";
r += "med ett extremt högt förhållande mellan gilla och inlägg";
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

MessageFormat.locale.sv = function ( n ) {
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
I18n.translations = {"sv":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","timeline_date":"MMM YYYY","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM, YYYY h:mm a","long_with_year_no_time":"D MMM, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} sedan","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1å","other":"%{count}å"},"over_x_years":{"one":"\u003e 1å","other":"\u003e %{count}å"},"almost_x_years":{"one":"1å","other":"%{count}å"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} min"},"x_hours":{"one":"1 timme","other":"%{count} timmar"},"x_days":{"one":"1 dag","other":"%{count} dagar"},"date_year":"D MMM, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 min sedan","other":"%{count} minuter sedan"},"x_hours":{"one":"1 timme sedan","other":"%{count} timmar sedan"},"x_days":{"one":"1 dag sedan","other":"%{count} dagar sedan"}},"later":{"x_days":{"one":"1 dag senare","other":"%{count} dagar senare"},"x_months":{"one":"1 månad senare","other":"%{count} månader senare"},"x_years":{"one":"1 år senare","other":"%{count} år senare"}},"previous_month":"Föregående månad","next_month":"Nästkommande månad"},"share":{"topic":"dela en länk till detta ämne","post":"inlägg #%{postNumber}","close":"stäng","twitter":"dela denna länk på Twitter","facebook":"dela denna länk på Facebook","google+":"dela denna länk på Google+","email":"skicka denna länk i ett e-postmeddelande"},"action_codes":{"public_topic":"gjorde det här ämnet publikt %{when}","private_topic":"gjorde det här ämnet privat %{when}","split_topic":"splitta det här ämnet %{when}","invited_user":"bjöd in %{who} %{when}","invited_group":"bjöd in %{who} %{when}","removed_user":"tog bort %{who} %{when}","removed_group":"tog bort %{who} %{when}","autoclosed":{"enabled":"stängdes %{when}","disabled":"öppnades %{when}"},"closed":{"enabled":"stängdes %{when}","disabled":"öppnades %{when}"},"archived":{"enabled":"arkiverades %{when}","disabled":"avarkiverades %{when}"},"pinned":{"enabled":"klistrades %{when}","disabled":"avklistrad %{when}"},"pinned_globally":{"enabled":"globalt klistrad %{when}","disabled":"avklistrad %{when}"},"visible":{"enabled":"listades %{when}","disabled":"avlistades %{when}"}},"topic_admin_menu":"administratörsåtgärder för ämne","emails_are_disabled":"All utgående e-post har blivit globalt inaktiverad av en administratör. Inga e-postnotifikationer av något slag kommer att skickas ut.","bootstrap_mode_enabled":"Du är i bootstrap-läge för att göra lanseringen av din nya webbplats enklare. Alla nya användare kommer att beviljas förtroendenivå 1 och få dagliga sammanfattningar skickade via e-post. Det här stängs automatiskt av när det totala antalet användare överstiger %{min_users}.","bootstrap_mode_disabled":"Bootstrap-läge otillgängliggörs i 24 timmar.","s3":{"regions":{"us_east_1":"Östra USA (N. Virginia)","us_west_1":"Västra USA (N. Kalifornien)","us_west_2":"Västra USA (Oregon)","us_gov_west_1":"AWS GovCloud (US)","eu_west_1":"EU (Irland)","eu_central_1":"EU (Frankfurt)","ap_southeast_1":"Asien Stillahavsområdet (Singapore)","ap_southeast_2":"Asien Stillahavsområdet (Sydney)","ap_northeast_1":"Asien Stillahavsområdet (Tokyo)","ap_northeast_2":"Asien Stillahavsområdet (Seoul)","sa_east_1":"Sydamerika (Sao Paulo)"}},"edit":"redigera rubrik och kategori för det här ämnet","not_implemented":"Denna funktion har inte implementerats än, vi beklagar!","no_value":"Nej","yes_value":"Ja","generic_error":"Tyvärr, ett fel har inträffat.","generic_error_with_reason":"Ett fel inträffade: %{error}","sign_up":"Registrera","log_in":"Logga in","age":"Ålder","joined":"Gick med","admin_title":"Admin","flags_title":"Flaggningar","show_more":"visa mer","show_help":"alternativ","links":"Länkar","links_lowercase":{"one":"länk","other":"länkar"},"faq":"FAQ","guidelines":"Riktlinjer","privacy_policy":"Integritetspolicy","privacy":"Integritet","terms_of_service":"Användarvillkor","mobile_view":"Mobilvy","desktop_view":"Desktop-vy","you":"Du","or":"eller","now":"nyss","read_more":"läs mer","more":"Mer","less":"Mindre","never":"aldrig","every_30_minutes":"var 30:e minut","every_hour":"varje timme","daily":"dagligen","weekly":"veckovis","every_two_weeks":"varannan vecka","every_three_days":"var tredje dag","max_of_count":"max av {{count}}","alternation":"eller","character_count":{"one":"{{count}} tecken","other":"{{count}} tecken"},"suggested_topics":{"title":"Föreslagna ämnen","pm_title":"Föreslagna meddelanden"},"about":{"simple_title":"Om","title":"Om %{title}","stats":"Sitestatistik","our_admins":"Våra administratörer","our_moderators":"Våra moderatorer","stat":{"all_time":"Alla dagar","last_7_days":"Senaste 7 dagarna","last_30_days":"Senaste 30 Dagarna"},"like_count":"Gillningar","topic_count":"Ämnen","post_count":"Inlägg","user_count":"Nya Användare","active_user_count":"Aktiva Användare","contact":"Kontakta Oss","contact_info":"Vid brådskande ärenden rörande webbplatsen, kontakta oss på %{contact_info}."},"bookmarked":{"title":"Bokmärke","clear_bookmarks":"Töm bokmärken","help":{"bookmark":"Klicka för att bokmärka första inlägget i ämnet ","unbookmark":"Klicka för att radera alla bokmärken i ämnet"}},"bookmarks":{"not_logged_in":"tyvärr, du måste vara inloggad för att kunna bokmärka inlägg","created":"du har bokmärkt detta inlägg","not_bookmarked":"du har läst detta inlägg, klicka för att bokmärka det","last_read":"detta är det senaste inlägg som du läst, klicka för att bokmärka","remove":"Ta bort bokmärke","confirm_clear":"Är du säker på att du vill radera alla bokmärken från ämnet?"},"topic_count_latest":{"one":"{{count}} nytt eller uppdaterat ämne.","other":"{{count}} nya eller uppdaterade ämnen."},"topic_count_unread":{"one":"{{count}} oläst ämne.","other":"{{count}} olästa ämnen."},"topic_count_new":{"one":"{{count}} nytt ämne.","other":"{{count}} nya ämnen."},"click_to_show":"Klicka för att visa.","preview":"förhandsgranska","cancel":"avbryt","save":"Spara ändringar","saving":"Sparar...","saved":"Sparat!","upload":"Ladda upp","uploading":"Laddar upp...","uploading_filename":"Laddar upp {{filename}}...","uploaded":"Uppladdad!","enable":"Aktivera","disable":"Inaktivera","undo":"Ångra","revert":"Återställ","failed":"Misslyckades","switch_to_anon":"Starta anonymt läge","switch_from_anon":"Avsluta anonymt läge","banner":{"close":"Stäng denna banderoll","edit":"Redigera denna banderoll \u003e\u003e"},"choose_topic":{"none_found":"Inga ämnen hittades.","title":{"search":"Sök efter ett Ämne baserat på namn, url eller id:","placeholder":"skriv ämnets rubrik här"}},"queue":{"topic":"Ämne:","approve":"Godkänn","reject":"Avvisa","delete_user":"Ta bort användare","title":"Behöver godkännande","none":"Det finns inga inlägg att granska.","edit":"Redigera","cancel":"Avbryt","view_pending":"visa väntande inlägg","has_pending_posts":{"one":"Detta ämne har \u003cb\u003e1\u003c/b\u003e ämne som inväntar godkännande","other":"Detta ämne har \u003cb\u003e{{count}}\u003c/b\u003e inlägg som inväntar godkännande"},"confirm":"Spara ändringar","delete_prompt":"Vill du verkligen ta bort \u003cb\u003e%{username}\u003c/b\u003e? Dennes alla poster kommer att tas bort samt e-post och IP-adress kommer blockeras.","approval":{"title":"Inlägget behöver godkännande","description":"Vi har mottagit ditt nya inlägg men det behöver bli godkänt av en moderator innan det kan visas. Ha tålamod.","pending_posts":{"one":"Du har \u003cstrong\u003e1\u003c/strong\u003e väntande inlägg.","other":"Du har \u003cstrong\u003e{{count}}\u003c/strong\u003e väntande inlägg."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e skrev \u003ca href='{{topicUrl}}'\u003eämnet\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e skrev \u003ca href='{{topicUrl}}'\u003eämnet\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarade på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarade på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarade på \u003ca href='{{topicUrl}}'\u003eämnet\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarade på \u003ca href='{{topicUrl}}'\u003eämnet\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nämnde \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nämnde \u003ca href='{{user2Url}}'\u003edig\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eDu\u003c/a\u003e nämnde \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postat av \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Postat av \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e","sent_by_user":"Skickat av \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Skickat av \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e"},"directory":{"filter_name":"Filtrera på användarnamn","title":"Användare","likes_given":"Tilldelade","likes_received":"Mottagna","topics_entered":"Visade","topics_entered_long":"Visade ämnen","time_read":"Lästid","topic_count":"Ämnen","topic_count_long":"Ämnen skapade","post_count":"Svar","post_count_long":"Svar postade","no_results":"Inga resultat hittades.","days_visited":"Besök","days_visited_long":"Dagar Besökta","posts_read":"Läst","posts_read_long":"Lästa inlägg","total_rows":{"one":"1 användare","other":"%{count} användare"}},"groups":{"empty":{"posts":"Det finns inga inlägg från medlemmar in denna grupp.","members":"Det finns ingen medlem i den här gruppen.","mentions":"Det finns ingen omnämnande i den här gruppen.","messages":"Det finns inget meddelande för den här gruppen.","topics":"Det finns inget ämne från medlemmar i den här gruppen."},"add":"Lägg till","selector_placeholder":"Lägg till medlemmar","owner":"ägare","visible":"Gruppen är synlig för alla användare","title":{"one":"grupp","other":"grupper"},"members":"Medlemmar","topics":"Ämnen","posts":"Inlägg","mentions":"Omnämnaden","messages":"Meddelanden","alias_levels":{"title":"Vem kan meddela och @omnämna den här gruppen?","nobody":"Ingen","only_admins":"Bara administratörer","mods_and_admins":"Bara moderatorer och administratörer","members_mods_and_admins":"Bara gruppmedlemmar, moderatorer och administratörer","everyone":"Alla"},"trust_levels":{"title":"Förtroendenivå som automatiskt beviljas användare när de läggs till:","none":"Inga"},"notifications":{"watching":{"title":"Bevakar","description":"Du kommer att notifieras om varje nytt inlägg i det här meddelandet, och en räknare med antalet nya svar kommer att visas."},"watching_first_post":{"title":"Bevakar första inlägget","description":"Du kommer att bli notifierad om första inlägget i varje nytt ämne i den här gruppen."},"tracking":{"title":"Följer","description":"Du kommer att notifieras om någon nämner ditt @namn eller svarar på ditt inlägg, och en räknare med antalet nya svar kommer att visas."},"regular":{"title":"Normal","description":"Du kommer att notifieras om någon nämner ditt @namn eller svarar dig."},"muted":{"title":"Tystad","description":"Du kommer aldrig att bli notifierad om något gällande nya ämnen i den här gruppen."}}},"user_action_groups":{"1":"Gillningar givna","2":"Gillningar mottagna","3":"Bokmärken","4":"Ämnen","5":"Svar","6":"Svar","7":"Omnämnanden","9":"Citat","11":"Redigeringar","12":"Skickade föremål","13":"Inkorg","14":"Väntar"},"categories":{"all":"alla kategorier","all_subcategories":"alla","no_subcategory":"ingen","category":"Kategori","category_list":"Visa kategori-lista","reorder":{"title":"Sortera kategorier","title_long":"Sortera listan av katergorier","fix_order":"Fixera positioner","fix_order_tooltip":"Inte alla kategorier har ett unikt positionsnummer, vilket kan få oväntade resultat.","save":"Spara order","apply_all":"Tillämpa","position":"Position"},"posts":"Inlägg","topics":"Ämnen","latest":"Senaste","latest_by":"senast av","toggle_ordering":"slå av/på sorteringskontroll","subcategories":"Underkategorier","topic_stat_sentence":{"one":"%{count} nytt ämne under den senaste %{unit}.","other":"%{count} nya ämnen under den senaste %{unit}."}},"ip_lookup":{"title":"Kolla upp IP-adress","hostname":"Värdnamn","location":"Plats","location_not_found":"(okänd)","organisation":"Organisation","phone":"Telefon","other_accounts":"Andra konton med samma IP-adress","delete_other_accounts":"Ta bort %{count}","username":"användarnamn","trust_level":"TL","read_time":"lästid","topics_entered":"besökta ämnen","post_count":"# inlägg","confirm_delete_other_accounts":"Är du säker på att du vill ta bort dessa här konton?"},"user_fields":{"none":"(välj ett alternativ)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Tysta","edit":"Redigera inställningar","download_archive":"Ladda ned mina inlägg","new_private_message":"Nytt meddelande","private_message":"Meddelande","private_messages":"Meddelanden","activity_stream":"Aktivitet","preferences":"Inställningar","expand_profile":"Utvidga","bookmarks":"Bokmärken","bio":"Om mig","invited_by":"Inbjuden Av","trust_level":"Förtroendenivå","notifications":"Notifieringar","statistics":"Statistik","desktop_notifications":{"label":"Skrivbordsaviseringar","not_supported":"Aviseringar stöds inte i den här webbläsaren. Tyvärr!","perm_default":"Sätt på aviseringar","perm_denied_btn":"Behörighet saknas","perm_denied_expl":"Du nekade tillåtelse för aviseringar. Tillåt aviseringar via din webbläsares inställningar.","disable":"Inaktivera aviseringar","enable":"Aktivera aviseringar","each_browser_note":"Notera: Du behöver ändra denna inställning i varje webbläsare du använder."},"dismiss_notifications":"Avfärda alla","dismiss_notifications_tooltip":"Markera alla olästa aviseringar som lästa","disable_jump_reply":"Hoppa inte till mitt inlägg efter att jag har svarat","dynamic_favicon":"Visa antal nya / uppdaterade ämnen på webbläsarikon","external_links_in_new_tab":"Öppna alla externa länkar i en ny flik","enable_quoting":"Aktivera citatsvar för markerad text","change":"ändra","moderator":"{{user}} är en moderator","admin":"{{user}} är en admin","moderator_tooltip":"Den här användaren är moderator","admin_tooltip":"Den här användaren är administrator","blocked_tooltip":"Den här användaren är blockerad","suspended_notice":"Den här användaren är avstängd till {{date}}.","suspended_reason":"Anledning:","github_profile":"Github","email_activity_summary":"Aktivitetssammanfattning","mailing_list_mode":{"label":"Utskicksläge","enabled":"Aktivera utskicksläge","instructions":"Den här inställningen åsidosätter aktivitetssummeringen.\u003cbr /\u003e\nTystade ämnen och kategorier är inte inkluderade i de här e-postmeddelandena.\n","daily":"Skicka dagliga uppdateringar","individual":"Skicka ett e-postmeddelande för varje nytt inlägg.","many_per_day":"Skicka ett e-postmeddelande för varje nytt inlägg (ungefär {{dailyEmailEstimate}} per dag)","few_per_day":"Skicka ett e-postmeddelande för varje nytt inlägg (ungefär 2 per dag)"},"tag_settings":"Taggar","watched_tags":"Bevakade","watched_tags_instructions":"Du kommer automatiskt att bevaka alla ämnen med de här taggarna. Du blir notifierad om alla nya inlägg och ämnen, och en räknare över antalet nya inlägg visas bredvid ämnet. ","tracked_tags":"Följda","muted_tags":"Tystad","muted_tags_instructions":"Du kommer inte att få notifieringar om nya ämnen som har de här taggarna, och de kommer inte att visas bland dina olästa ämnen.","watched_categories":"Tittade på","watched_categories_instructions":"Du kommer automatiskt att bevaka alla ämnen i de här kategorierna. Du blir notifierad om alla nya inlägg och ämnen, och en räknare över antalet nya inlägg visas bredvid ämnet. ","tracked_categories":"Bevakade","watched_first_post_categories":"Bevakar första inlägget","watched_first_post_categories_instructions":"Du kommer att bli notifierad om första inlägget i varje nytt ämne i den här kategorin.","muted_categories":"Tystad","muted_categories_instructions":"Du kommer inte att få notifieringar om nya ämnen inom dessa kategorier, och de kommer inte att visas under bland dina olästa ämnen. ","delete_account":"Radera mitt konto","delete_account_confirm":"Är du säker på att du vill ta bort ditt konto permanent? Denna åtgärd kan inte ångras!","deleted_yourself":"Ditt konto har tagits bort.","delete_yourself_not_allowed":"Du kan inte ta bort ditt konto just nu. Kontakta en admin och be om att få ditt konto borttaget.","unread_message_count":"Meddelanden","admin_delete":"Radera","users":"Användare","muted_users":"Tystat","muted_users_instructions":"Undanta alla notiser från dessa användare.","muted_topics_link":"Visa tystade ämnen","watched_topics_link":"Visa bevakade ämnen","automatically_unpin_topics":"Avklistra automatiskt ämnen när jag når botten.","staff_counters":{"flags_given":"hjälpsamma flaggor","flagged_posts":"flaggade inlägg","deleted_posts":"raderade inlägg","suspensions":"avstängningar","warnings_received":"varningar"},"messages":{"all":"Alla","inbox":"Inkorg","sent":"Skickat","archive":"Arkiv","groups":"Mina Grupper","bulk_select":"Välj meddelanden","move_to_inbox":"Flytta till inkorg","move_to_archive":"Arkiv","failed_to_move":"Misslyckades med att flytta de markerade meddelandena (kanske ligger ditt nätverk nere)","select_all":"Markera alla"},"change_password":{"success":"(e-post skickat)","in_progress":"(skickar e-post)","error":"(fel)","action":"Skicka e-post för att återställa lösenord","set_password":"Ange lösenord"},"change_about":{"title":"Ändra Om Mig","error":"Ett fel inträffade vid ändringen av det här värdet."},"change_username":{"title":"Byt användarnamn","confirm":"Om du byter ditt användarnamn kommer alla tidigare citeringar av dina inlägg och @namn-omnämningar att bli trasiga. Är du helt säker på att du vill?","taken":"Tyvärr, det användarnamnet är taget.","error":"Det uppstod ett problem under bytet av ditt användarnamn.","invalid":"Det användarnamnet är ogiltigt. Det får bara innehålla siffror och bokstäver"},"change_email":{"title":"Byt e-post","taken":"Tyvärr den e-postadressen är inte tillgänglig.","error":"Det uppstod ett problem under bytet av din e-post. Är kanske adressen redan upptagen?","success":"Vi har skickat e-post till den adressen. Var god följ bekräftelseinstruktionerna."},"change_avatar":{"title":"Ändra din profilbild","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baserat på","gravatar_title":"Byt din avatar på Gravatars hemsida","refresh_gravatar_title":"Uppdatera din Gravatar","letter_based":"Profilbild tilldelad av systemet","uploaded_avatar":"Anpassad bild","uploaded_avatar_empty":"Lägg till en anpassad bild","upload_title":"Ladda upp din bild","upload_picture":"Ladda upp bild","image_is_not_a_square":"Varning: vi beskar din bild; bredden och höjden var inte samma.","cache_notice":"Du har nu bytt profilbild med det kan ta lite tid innan den visas på grund av webbläsar-cachen."},"change_profile_background":{"title":"Profilbakgrund","instructions":"Bakgrunderna är centrerade och har en förinställd bredd på 850px"},"change_card_background":{"title":"Användarkortets bakgrund","instructions":"Bakgrundsbilder kommer att vara centrerade och ha en standardbredd på 590 px."},"email":{"title":"E-post","instructions":"Visas aldrig publikt","ok":"Vi skickar e-post till dig för bekräftelse","invalid":"Vänligen ange en giltig e-postadress","authenticated":"Din e-postadress har blivit verifierad av {{provider}}","frequency_immediately":"Vi kommer att skicka e-post till dig omedelbart om du inte har läst det som vi skickar e-post till dig om.","frequency":{"one":"Vi skickar bara e-post om du inte synts till den senaste minuten.","other":"Vi skickar bara e-post om du inte synts till de senaste {{count}} minuterna."}},"name":{"title":"Namn","instructions":"Ditt fullständiga namn (valfritt)","instructions_required":"Ditt fullständiga namn","too_short":"Ditt namn är för kort","ok":"Ditt namn ser bra ut"},"username":{"title":"Användarnamn","instructions":"Unikt, inga mellanrum, kort","short_instructions":"Folk kan nämna dig som @{{username}}","available":"Ditt användarnamn är tillgängligt","global_match":"E-postadressen matchar det registrerade användarnamnet","global_mismatch":"Redan registrerat. Prova {{suggestion}}?","not_available":"Inte tillgängligt. Prova {{suggestion}}?","too_short":"Ditt användarnamn är för kort","too_long":"Ditt användarnamn är för långt","checking":"Kollar användarnamnets tillgänglighet...","enter_email":"Annvändarnamn hittat; ange matchande e-postadress","prefilled":"E-postadressen matchar det här registrerade användarnamnet"},"locale":{"title":"Gränssnittsspråk","instructions":"Språket som används av forumsgränssnittet. Det kommer att ändras när du laddar om sidan.","default":"(förvalt värde)"},"password_confirmation":{"title":"Lösenord igen"},"last_posted":"Senaste inlägg","last_emailed":"Senast mailad","last_seen":"Sedd","created":"Gick med","log_out":"Logga ut","location":"Plats","card_badge":{"title":"Användarkortsbricka"},"website":"Webbplats","email_settings":"E-post","like_notification_frequency":{"title":"Notifiera vid gillning","always":"Alltid","first_time_and_daily":"Första gången ett inlägg gillas och dagligen","first_time":"Första gången ett inlägg blir gillat","never":"Aldrig"},"email_previous_replies":{"title":"Inkludera tidigare svar i botten av e-postmeddelanden","unless_emailed":"Såvida inte tidigare skickat","always":"alltid","never":"aldrig"},"email_digests":{"title":"Skicka mig en e-postsammanfattning av populära ämnen och inlägg när jag inte besökt sidan","every_30_minutes":"var 30:e minut","every_hour":"varje timma","daily":"dagligen","every_three_days":"var tredje dag","weekly":"veckovis","every_two_weeks":"varannan vecka"},"include_tl0_in_digests":"Inkludera innehåll från nya användare i sammanfattningsmeddelanden via e-post","email_in_reply_to":"Inkludera ett utdrag av inlägg som svarats på i e-postmeddelanden","email_direct":"Sänd mig e-post när någon citerar mig, besvarar mitt inlägg, nämner mitt @användarnamn eller bjuder in mig till ett ämne.","email_private_messages":"Sänd mig e-post när någon skickar mig ett meddelande","email_always":"Ta emot notifieringar även när jag är aktiv på forumet. ","other_settings":"Övrigt","categories_settings":"Kategorier","new_topic_duration":{"label":"Betrakta ämnen som nya när","not_viewed":"Jag har inte tittat på dem än","last_here":"skapade sedan mitt senaste besök","after_1_day":"skapad den senaste dagen","after_2_days":"skapade de senaste 2 dagarna","after_1_week":"skapad den senaste veckan","after_2_weeks":"skapad de senaste 2 veckorna"},"auto_track_topics":"Följ automatiskt nya ämnen jag går in i","auto_track_options":{"never":"aldrig","immediately":"genast","after_30_seconds":"efter 30 sekunder","after_1_minute":"efter 1 minut","after_2_minutes":"efter 2 minuter","after_3_minutes":"efter 3 minuter","after_4_minutes":"efter 4 minuter","after_5_minutes":"efter 5 minuter","after_10_minutes":"efter 10 minuter"},"invited":{"search":"sök efter inbjudningar...","title":"Inbjudningar","user":"Inbjuden Användare","sent":"Skickat","none":"Det finns inga pågående inbjudningar att visa.","truncated":{"one":"Visar den första inbjudningen.","other":"Visar de första {{count}} inbjudningarna."},"redeemed":"Inlösta inbjudningar","redeemed_tab":"Inlöst","redeemed_tab_with_count":"Inlöst ({{count}})","redeemed_at":"Inlöst","pending":"Avvaktande inbjudningar","pending_tab":"Avvaktar","pending_tab_with_count":"Pågående ({{count}})","topics_entered":"Besökta ämnen","posts_read_count":"Inlägg Lästa","expired":"Denna inbjudan har gått ut.","rescind":"Ta bort","rescinded":"Inbjudan borttagen","reinvite":"Skicka inbjudan igen","reinvite_all":"Skicka alla inbjudningar igen","reinvited":"Inbjudan skickad","reinvited_all":"Alla inbjudningar har skickats igen!","time_read":"Lästid","days_visited":"Dagar besökta","account_age_days":"Kontoålder i dagar","create":"Skicka en inbjudan","generate_link":"Kopiera inbjudningslänken","generated_link_message":"\u003cp\u003eInbjudningslänken genererades utan problem!\u003c/p\u003e\u003cp\u003e\u003cinput class=\"invite-link-input\" style=\"width: 75%;\" type=\"text\" value=\"%{inviteLink}\"\u003e\u003c/p\u003e\u003cp\u003eInbjudningslänken är endast giltig för den här e-postadressen: \u003cb\u003e%{invitedEmail}\u003c/b\u003e\u003c/p\u003e","bulk_invite":{"none":"Du har inte skickat några inbjudningar. Du kan skicka individuella inbjudningar, eller så kan du bjuda in flera på en gång genom att \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eladda upp en bulkfil.\u003c/a\u003e","text":"Massinbjudan från fil","uploading":"Laddar upp...","success":"Filen laddades upp, du blir underrättad via meddelande när processen är klar","error":"Det blev ett fel vid uppladdning av '{{filename}}': {{message}}"}},"password":{"title":"Lösenord","too_short":"Ditt lösenord är för kort.","common":"Det lösenordet är för vanligt.","same_as_username":"Ditt lösenord är detsamma som ditt användarnamn.","same_as_email":"Ditt lösenord är detsamma som din e-postadress.","ok":"Ditt lösenord ser bra ut.","instructions":"Måste vara minst %{count} tecken lång."},"summary":{"title":"Sammanfattning","stats":"Statistik","time_read":"lästid","topic_count":{"one":"ämnet skapades","other":"ämnen skapades"},"post_count":{"one":"inlägg skapat","other":"inlägg skapade"},"likes_given":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e given"},"likes_received":{"one":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e mottagen","other":"\u003ci class='fa fa-heart'\u003e\u003c/i\u003e mottagen"},"days_visited":{"one":"dag besökt","other":"dagar besökta"},"posts_read":{"one":"inlägg läst","other":"inlägg lästa"},"bookmark_count":{"one":"bokmärke","other":"bokmärken"},"top_replies":"Toppinlägg","no_replies":"Inga svar ännu.","more_replies":"Fler svar","top_topics":"Toppämnen","no_topics":"Inga ämnen ännu.","more_topics":"Fler ämnen","top_badges":"Topputmärkelser","no_badges":"Inga utmärkelser ännu.","more_badges":"Fler utmärkelser","top_links":"Topplänkar","no_links":"Inga länkar ännu.","most_liked_by":"Mest gillad av","most_liked_users":"Mest gillad","most_replied_to_users":"Mest svarad till","no_likes":"Inga gillningar ännu."},"associated_accounts":"Inloggningar","ip_address":{"title":"Senaste IP-adress"},"registration_ip_address":{"title":"IP-adress vid registrering"},"avatar":{"title":"Profilbild","header_title":"profil, meddelanden, bokmärken och inställningar"},"title":{"title":"Titel"},"filters":{"all":"Alla"},"stream":{"posted_by":"Skrivet av","sent_by":"Skickat av","private_message":"meddelande","the_topic":"ämnet"}},"loading":"Laddar...","errors":{"prev_page":"medan vi försökte ladda","reasons":{"network":"Nätverksfel","server":"Serverfel","forbidden":"Åtkomst nekad","unknown":"Fel","not_found":"Sidan hittades inte"},"desc":{"network":"Vänligen kontrollera din uppkoppling.","network_fixed":"Ser ut som att den är tillbaka.","server":"Felmeddelande: {{status}}","forbidden":"Du har inte rättigheter att läsa det där.","not_found":"Hoppsan, applikationen ledde till en URL som inte existerar.","unknown":"Något gick fel."},"buttons":{"back":"Gå tillbaka","again":"Försök igen","fixed":"Ladda sida"}},"close":"Stäng","assets_changed_confirm":"Den här webbplatsen uppdaterades precis. Uppdatera för att se den senaste versionen?","logout":"Du loggades ut.","refresh":"Uppdatera","read_only_mode":{"enabled":"Webbplatsen är i skrivskyddat läge. Du kan fortsätta bläddra på sidan, men att skriva inlägg, gilla och andra interaktioner är inaktiverade för tillfället.","login_disabled":"Det går inte att logga in medan siten är i skrivskyddat läge.","logout_disabled":"Det går inte att logga ut medan webbplatsen är i skrivskyddat läge. "},"too_few_topics_and_posts_notice":"Låt oss \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003efå igång den här diskussionen!\u003c/a\u003e Det finns för närvarande \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e ämnen och \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e inlägg. Nya användare behöver några konversationer att läsa och svara på.","too_few_topics_notice":"Låt oss \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003efå igång den här diskussionen!\u003c/a\u003e Det finns för närvarande \u003cstrong\u003e%{currentTopics} / %{requiredTopics}\u003c/strong\u003e ämnen. Nya användare behöver några konversationer att läsa och svara på.","too_few_posts_notice":"Låt oss \u003ca href='http://blog.discourse.org/2014/08/building-a-discourse-community/'\u003efå igång den här diskussionen!\u003c/a\u003e Det finns för närvarande \u003cstrong\u003e%{currentPosts} / %{requiredPosts}\u003c/strong\u003e inlägg. Nya användare behöver några konversationer att läsa och svara på.","logs_error_rate_notice":{"rate":{"one":"1 fel/%{duration}","other":"%{count} fel/%{duration}"}},"learn_more":"lär dig mer...","year":"år","year_desc":"ämnen skapade de senaste 365 dagarna","month":"månad","month_desc":"ämnen skapade de senaste 30 dagarna","week":"vecka","week_desc":"ämnen skapade de senaste 7 dagarna","day":"dag","first_post":"Första inlägget","mute":"Tysta","unmute":"Avtysta","last_post":"Senaste inlägg","last_reply_lowercase":"senaste svar","replies_lowercase":{"one":"svar","other":"svar"},"signup_cta":{"sign_up":"Registrera","hide_session":"Påminn mig imorgon","hide_forever":"nej tack","hidden_for_session":"Ok, jag frågar dig imorgon. Du kan alltid använda 'Logga in' för att skapa ett konto, också. ","intro":"Hejsan! :heart_eyes: Det verkar som att du uppskattar ämnet, men du har inte registrerat dig för ett konto. ","value_prop":"När du skapar ett konto så kommer vi ihåg precis vad du har läst, så att du alltid kan komma tillbaka precis där du lämnade oss. Du kan också få notifieringar, här och via e-post, närhelst nya inlägg skapas. Du kan också gilla inlägg för att sprida kärlek. :heartbeat:"},"summary":{"enabled_description":"Sammanfattning över de inlägg som användarna tycker är mest intressanta.","description":"Det finns \u003cb\u003e{{replyCount}}\u003c/b\u003e svar.","description_time":"Det finns \u003cb\u003e{{replyCount}}\u003c/b\u003e svar med en uppskattad lästid på \u003cb\u003e{{readingTime}} minuter\u003c/b\u003e.","enable":"Sammanfatta detta ämne","disable":"Visa alla inlägg"},"deleted_filter":{"enabled_description":"Det här ämnet innehåller borttagna inlägg som har dolts.","disabled_description":"Raderade inlägg i ämnet visas.","enable":"Dölj raderade inlägg","disable":"Visa raderade inlägg"},"private_message_info":{"title":"Meddelande","invite":"Bjud In Andra...","remove_allowed_user":"Vill du verkligen ta bort {{name}} från det här meddelandet?","remove_allowed_group":"Vill du verkligen ta bort {{name}} från det här meddelandet?"},"email":"E-post","username":"Användarnamn","last_seen":"Sedd","created":"Skapad","created_lowercase":"skapad","trust_level":"Förtroendenivå","search_hint":"användarnamn, e-post eller IP-adress","create_account":{"title":"Registrera nytt konto","failed":"Något gick fel, kanske är denna e-post redan registrerad, försök glömt lösenordslänken"},"forgot_password":{"title":"Beställ nytt lösenord","action":"Jag har glömt mitt lösenord","invite":"Skriv in ditt användarnamn eller e-postadress, så skickar vi dig ett e-postmeddelande om lösenordsåterställning.","reset":"Återställ lösenord","complete_username":"Om ett konto matchar användarnamnet \u003cb\u003e%{username}\u003c/b\u003e bör du inom kort få ett e-postmeddelande med instruktioner för hur du återställer ditt lösenord.","complete_email":"Om ett konto matchar \u003cb\u003e%{email}\u003c/b\u003e bör du inom kort få ett e-postmeddelande med instruktioner för hur du återställer ditt lösenord.","complete_username_found":"Vi hittade ett konto som matchade användarnamnet \u003cb\u003e %{username} \u003c/b\u003e, du kommer snart att få ett e-postmeddelande med instruktioner om hur du ska återställa ditt lösenord.","complete_email_found":"Vi hittade ett konto som matchade \u003cb\u003e %{email} \u003c/b\u003e, du kommer snart att få ett e-postmeddelande med instruktioner om hur du ska återställa ditt lösenord.","complete_username_not_found":"Det finns inget konto som matchar användarnamnet \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Det finns inget konto som matchar \u003cb\u003e%{email}\u003c/b\u003e"},"login":{"title":"Logga in","username":"Användare","password":"Lösenord","email_placeholder":"e-post eller användarnamn","caps_lock_warning":"Caps Lock är aktiverad","error":"Okänt fel","rate_limit":"Var god vänta innan du försöker logga in igen.","blank_username_or_password":"Vänligen ange din e-post eller användarnamn och lösenord.","reset_password":"Återställ lösenord","logging_in":"Loggar in...","or":"Eller","authenticating":"Autentiserar...","awaiting_confirmation":"Ditt konto väntar på aktivering, använd glömt lösenordslänken för att skicka ett nytt aktiveringsbrev.","awaiting_approval":"Ditt konto har inte godkänts av en moderator än. Du kommer att få ett e-postmeddelande när det är godkänt.","requires_invite":"Tyvärr, inbjudan krävs för tillgång till detta forum.","not_activated":"Du kan inte logga in än. Vi har tidigare skickat ett aktiveringsbrev till dig via \u003cb\u003e{{sentTo}}\u003c/b\u003e. Var god följ instruktionerna i det e-postmeddelandet för att aktivera ditt konto.","not_allowed_from_ip_address":"Du kan inte logga in från den IP-adressen","admin_not_allowed_from_ip_address":"Du kan inte logga in som admin från den IP-adressen.","resend_activation_email":"Klicka här för att skicka aktiveringsbrevet igen.","sent_activation_email_again":"Vi har skickat ännu ett aktiveringsmail till dig via \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Det kan ta ett par minuter för det att komma fram; var noga med att kolla din skräppost.","to_continue":"Var vänligen och logga in","preferences":"Du behöver logga in för att ändra dina användarpreferenser.","forgot":"Jag kommer inte ihåg mina kontouppgifter","google":{"title":"med Google","message":"Autentiserar med Google (kolla så att pop up-blockare inte är aktiverade)"},"google_oauth2":{"title":"med Google","message":"Autentiserar med Google (kolla så att pop up-blockare inte är aktiverade)"},"twitter":{"title":"med Twitter","message":"Autentiserar med Twitter (kolla så att pop up-blockare inte är aktiverade)"},"instagram":{"title":"med Instagram","message":"Autentisering med Instagram (se till att popup-blockeringar inte är aktiverade)"},"facebook":{"title":"med Facebook","message":"Autentiserar med Facebook (kolla så att pop up-blockare inte är aktiverade)"},"yahoo":{"title":"med Yahoo","message":"Autentiserar med Yahoo (kolla så att pop up-blockare inte är aktiverade)"},"github":{"title":"med GitHub","message":"Autentiserar med GitHub (kolla så att pop up-blockare inte är aktiverade)"}},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"composer":{"emoji":"Emoji :)","more_emoji":"mer...","options":"Alternativ","whisper":"viska","add_warning":"Det här är en officiell varning.","toggle_whisper":"Växla viskning","posting_not_on_topic":"Vilket ämne vill du svara på?","saving_draft_tip":"sparar…","saved_draft_tip":"sparat","saved_local_draft_tip":"sparat lokalt","similar_topics":"Ditt ämne liknar...","drafts_offline":"utkast offline","duplicate_link":"Det ser ut som att din länk till \u003cb\u003e{{domain}}\u003c/b\u003e redan har delats i ämnet av \u003cb\u003e@{{username}}\u003c/b\u003e i \u003ca href='{{post_url}}'\u003eett svar {{ago}} sedan\u003c/a\u003e – är du säker på att du vill dela den igen?","error":{"title_missing":"Du måste ange en rubrik","title_too_short":"Rubriken måste vara minst {{min}} tecken lång.","title_too_long":"Rubriken får inte vara längre än {{max}} tecken","post_missing":"Inlägg får inte vara tomma","post_length":"Inlägg måste vara minst {{min}} tecken långa.","try_like":"Har du provat \u003ci class=\"fa fa-heart\"\u003e\u003c/i\u003e-knappen?","category_missing":"Du måste välja en kategori"},"save_edit":"Spara ändring","reply_original":"Svara på ursprungsämnet","reply_here":"Svara här","reply":"Svara","cancel":"Avbryt","create_topic":"Skapa ämne","create_pm":"Nytt meddelande","title":"eller tryck Ctrl+Enter","users_placeholder":"Lägg till en användare","title_placeholder":"Vad handlar ämnet om i en kort mening?","edit_reason_placeholder":"varför redigerar du?","show_edit_reason":"(lägg till anledningar för redigering)","reply_placeholder":"Skriv här. Använd Markdown, BBCode eller HTML för formattering. Släpp eller klistra in bilder.","view_new_post":"Visa ditt nya inlägg.","saving":"Sparar","saved":"Sparat!","saved_draft":"Utkast för inlägg. Välj för att fortsätta.","uploading":"Laddar upp...","show_preview":"visa förhandsgranskning \u0026raquo;","hide_preview":"\u0026laquo; dölj förhandsgranskning","quote_post_title":"Citera hela inlägget","bold_title":"Fet","bold_text":"fet text","italic_title":"Kursiv","italic_text":"kursiv text","link_title":"Hyperlänk","link_description":"skriv en länkbeskrivning här","link_dialog_title":"Infoga Hyperlänk","link_optional_text":"valfri rubrik","link_url_placeholder":"http://exempel.se","quote_title":"Citat","quote_text":"Citat","code_title":"Förformatterad text","code_text":"indentera förformatterad text med 4 mellanslag","paste_code_text":"skriv eller klistra in din kod här","upload_title":"Bild","upload_description":"skriv en bildbeskrivning här","olist_title":"Numrerad lista","ulist_title":"Punktlista","list_item":"Listobjekt","heading_title":"Rubrik","heading_text":"Rubrik","hr_title":"Horisontell linje","help":"Markdown redigeringshjälp","toggler":"Dölj eller visa composer-panelen","modal_ok":"OK","modal_cancel":"Avbryt","cant_send_pm":"Tyvärr, du kan inte skicka ett meddelande till %{username}.","admin_options_title":"Valfria personalinställningar för detta ämne","auto_close":{"label":"Stäng automatiskt ämnet efter:","error":"Vänligen ange ett giltigt värde.","based_on_last_post":"Stäng inte förrän det sista inlägget i ämnet är åtminstone så här gammalt.","all":{"examples":"Ange antalet timmar (24), klockslag (17:30) eller tidstämpel (2013-11-22 14:00)."},"limited":{"units":"(# antal timmar)","examples":"Ange antal timmar (24)."}}},"notifications":{"title":"notiser från @namn-omnämnanden, svar på dina inlägg och ämnen, meddelanden, etc","none":"Kan inte ladda notiser just nu.","empty":"Inga notifieringar hittades.","more":"visa äldre notifikationer","total_flagged":"totalt antal flaggade inlägg","mentioned":"\u003ci title='omnämnd' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","group_mentioned":"\u003ci title='group mentioned' class='fa fa-at'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='posted' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_2":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked_many":{"one":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} och en annan\u003c/span\u003e {{description}}\u003c/p\u003e","other":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}, {{username2}} och {{count}} andra\u003c/span\u003e {{description}}\u003c/p\u003e"},"private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_topic":"\u003ci title='inbjuden till ämne' class='fa fa-hand-o-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepterade din inbjudan\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e flyttade {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-link'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eFörtjänade '{{description}}'\u003c/p\u003e","watching_first_post":"\u003ci title='new topic' class='fa fa-dot-circle-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003eNytt ämne\u003c/span\u003e {{description}}\u003c/p\u003e","group_message_summary":{"one":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} meddelande i din {{group_name}}-inkorg\u003c/p\u003e","other":"\u003ci title='messages in group inbox' class='fa fa-group'\u003e\u003c/i\u003e\u003cp\u003e {{count}} meddelanden i din {{group_name}}-inkorg\u003c/p\u003e"},"alt":{"mentioned":"Omnämnd av","quoted":"Citerad av","replied":"Svarade","posted":"Skrivet av","edited":"Redigera ditt inlägg genom","liked":"Gillade ditt inlägg","private_message":"Privat meddelande från","invited_to_private_message":"Inbjudan till ett privat meddelande från ","invited_to_topic":"Inbjudan till ett ämne från","invitee_accepted":"Inbjudan accepterades av","moved_post":"Ditt inlägg blev flyttad av","linked":"Länk till ditt inlägg","granted_badge":"Utmärkelse beviljad","group_message_summary":"Meddelanden i din grupps inkorg"},"popup":{"mentioned":"{{username}} nämnde dig i \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} nämnde dig i \"{{topic}}\" - {{site_title}}","quoted":"{{username}} citerade dig i \"{{topic}}\" - {{site_title}}","replied":"{{username}} svarade dig i \"{{topic}}\" - {{site_title}}","posted":"{{username}} skrev i \"{{topic}}\" - {{site_title}}","private_message":"{{username}} skickade dig ett privat meddelande i \"{{topic}}\" - {{site_title}}","linked":"{{username}} länkade till ett inlägg du gjort från \"{{topic}}\" - {{site_title}}"}},"upload_selector":{"title":"Lägg till en bild","title_with_attachments":"Lägg till en bild eller en fil","from_my_computer":"Från min enhet","from_the_web":"Från webben","remote_tip":"länk till bild","remote_tip_with_attachments":"länk till bild eller fil {{authorized_extensions}}","local_tip":"välj bilder från din enhet","local_tip_with_attachments":"välj bilder eller filer från din enhet {{authorized_extensions}}","hint":"(du kan också dra \u0026 släppa in i redigeraren för att ladda upp dem)","hint_for_supported_browsers":"du kan också släppa eller klistra in bilder i redigeraren","uploading":"Laddar upp bild","select_file":"Välj fil","image_link":"länk dit din bild ska peka"},"search":{"sort_by":"Sortera efter","relevance":"Relevans","latest_post":"Senaste inlägg","most_viewed":"Mest sedda","most_liked":"Mest omtyckt","select_all":"Markera alla","clear_all":"Rensa allt","result_count":{"one":"1 resultat för \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e","other":"{{count}} resultat för \u003cspan class='term'\u003e\"{{term}}\"\u003c/span\u003e"},"title":"sök efter ämnen, inlägg, användare, eller kategorier","no_results":"Inga resultat hittades.","no_more_results":"Inga fler resultat hittades.","search_help":"Sökhjälp","searching":"Söker ...","post_format":"#{{post_number}} av {{username}}","context":{"user":"Sök inlägg av @{{username}}","category":"Sök #{{category}} kategorin","topic":"Sök i det här ämnet","private_messages":"Sök meddelanden"}},"hamburger_menu":"gå till en annan ämneslista eller kategori","new_item":"ny","go_back":"gå tillbaka","not_logged_in_user":"användarsida med sammanställning av aktuell aktivitet och inställningar","current_user":"gå till din användarsida","topics":{"bulk":{"unlist_topics":"Avlista ämnen","reset_read":"Återställ lästa","delete":"Ta bort ämnen","dismiss":"Avfärda","dismiss_read":"Avfärda alla o-lästa","dismiss_button":"Avfärda...","dismiss_tooltip":"Avfärda nya inlägg eller sluta följa ämnen","also_dismiss_topics":"Sluta följa de här ämnena så att de aldrig syns som olästa för mig igen","dismiss_new":"Avfärda Nya","toggle":"växla val av flertalet ämnen","actions":"Massändringar","change_category":"Ändra kategori","close_topics":"Stäng ämnen","archive_topics":"Arkivera ämnen","notification_level":"Ändra notifieringsnivå","choose_new_category":"Välj den nya kategorin för ämnena:","selected":{"one":"Du har markerat \u003cb\u003e1\u003c/b\u003e ämne.","other":"Du har markerat \u003cb\u003e{{count}}\u003c/b\u003e ämnen."},"change_tags":"Ändra taggar","choose_new_tags":"Välj nya taggar för de här ämnena:","changed_tags":"Taggarna för de här ämnena ändrades."},"none":{"unread":"Du har inga olästa ämnen.","new":"Du har inga nya ämnen.","read":"Du har inte läst några ämnen ännu.","posted":"Du har inte postat i några ämnen ännu.","latest":"Det finns inga senaste ämnen, tråkigt nog.","hot":"Det finns inga heta ämnen.","bookmarks":"Du har inga bokmärkta ämnen ännu.","category":"Det finns inga ämnen i {{category}}.","top":"Det finns inga toppämnen.","search":"Inga sökresultat hittades.","educate":{"new":"\u003cp\u003eDina nya ämnen hamnar här.\u003c/p\u003e\u003cp\u003eStandard är att ämnen anses nya och kommer att visa en \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eny\u003c/span\u003e indikator om de skapades de senaste 2 dagarna.\u003c/p\u003e\u003cp\u003eBesök dina \u003ca href=\"%{userPrefsUrl}\"\u003eanvändarinställningar\u003c/a\u003e för att ändra det.\u003c/p\u003e","unread":"\u003cp\u003eDina olästa ämnen hamnar här.\u003c/p\u003e\u003cp\u003eStandard är att inlägg anses olästa och kommer att visa antal olästa inlägg \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e om du:\u003c/p\u003e\u003cul\u003e\u003cli\u003eSkapade ämnet\u003c/li\u003e\u003cli\u003eSvarade på ämnet\u003c/li\u003e\u003cli\u003eLäste ämnet i mer än 4 minuter\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eEller om du explicit har markerat ämnet som Följd eller Bekvakad via notifieringspanelen längst ned i varje ämne.\u003c/p\u003e\u003cp\u003eBesök dina \u003ca href=\"%{userPrefsUrl}\"\u003eanvändarinställningar\u003c/a\u003e för att ändra det.\u003c/p\u003e"}},"bottom":{"latest":"Det finns inga fler senaste ämnen.","hot":"Det finns inga fler heta ämnen.","posted":"Det finns inga fler postade ämnen.","read":"Det finns inga fler lästa ämnen.","new":"Det finns inga fler nya ämnen.","unread":"Det finns inga fler olästa ämnen.","category":"Det finns inga fler ämnen i {{category}}.","top":"Det finns inga fler toppämnen.","bookmarks":"Inga fler bokmärkta ämnen hittades.","search":"Inga fler sökresultat hittades."}},"topic":{"unsubscribe":{"stop_notifications":"Du kommer du att motta färre notifieringar från \u003cstrong\u003e{{title}}\u003c/strong\u003e","change_notification_state":"Ditt aktuella notifieringstillstånd är "},"create":"Nytt ämne","create_long":"Skapa ett nytt ämne","private_message":"Skriv meddelande","archive_message":{"help":"Flytta meddelandet till ditt arkiv","title":"Arkiv"},"move_to_inbox":{"title":"Flytta till inkorgen","help":"Flytta tillbaka meddelandet till inkorgen"},"list":"Ämnen","new":"nytt ämne","unread":"oläst","new_topics":{"one":"1 nytt ämne","other":"{{count}} nya ämnen"},"unread_topics":{"one":"1 oläst ämne","other":"{{count}} olästa ämnen"},"title":"Ämne","invalid_access":{"title":"Ämnet är privat","description":"Tyvärr, du har inte behörighet till det ämnet!","login_required":"Du måste logga in för att se det här ämnet."},"server_error":{"title":"Ämnet misslyckades med att ladda","description":"Tyvärr, vi kunde inte ladda det ämnet, möjligtvis på grund av ett anslutningsproblem. Var god och försök igen. Om problemet kvarstår, hör av dig till oss."},"not_found":{"title":"Ämnet hittades inte","description":"Tyvärr, vi kunde inte hitta det ämnet. Kanske har den tagits bort av en moderator?"},"total_unread_posts":{"one":"du har 1 oläst inlägg i det här ämnet","other":"du har {{count}} olästa inlägg i det här ämnet"},"unread_posts":{"one":"du har 1 oläst gammalt inlägg i det här ämnet","other":"du har {{count}} olästa gamla inlägg i det här ämnet"},"new_posts":{"one":"det finns 1 nytt inlägg i det här ämnet sedan du senast läste den","other":"det finns {{count}} nya inlägg i det här ämnet sedan du senast läste det"},"likes":{"one":"det finns 1 gillning i det här ämnet","other":"det finns {{count}} gillningar i det här ämnet"},"back_to_list":"Tillbaka till ämneslistan","options":"Ämnesinställningar","show_links":"visa länkar som finns i det här ämnet","toggle_information":"slå av/på ämnesdetaljer","read_more_in_category":"Vill du läsa mer? Bläddra bland andra ämnen i {{catLink}} eller {{latestLink}}.","read_more":"Vill du läsa mer? {{catLink}} eller {{latestLink}}.","browse_all_categories":"Bläddra bland alla kategorier","view_latest_topics":"visa senaste ämnen","suggest_create_topic":"Varför inte skapa ett ämne?","jump_reply_up":"hoppa till tidigare svar","jump_reply_down":"hoppa till senare svar","deleted":"Ämnet har raderats","auto_close_notice":"Det här ämnet kommer att stängas automatiskt %{timeLeft}.","auto_close_notice_based_on_last_post":"Ämnet stängs %{duration} efter sista svaret.","auto_close_title":"Inställningar för automatisk stängning","auto_close_save":"Spara","auto_close_remove":"Stäng inte det här ämnet automatiskt","timeline":{"back":"Tillbaka","back_description":"Gå tillbaka till det senaste olästa meddelandet","replies_short":"%{current} / %{total}"},"progress":{"title":"ämnesframsteg","go_top":"toppen","go_bottom":"botten","go":"gå","jump_bottom":"hoppa till sista inlägget","jump_bottom_with_number":"hoppa till inlägg %{post_number}","total":"antal inlägg","current":"nuvarande inlägg"},"notifications":{"title":"ändra hur ofta du får notifieringar om det här ämnet","reasons":{"mailing_list_mode":"Du har utskicksläge aktiverat, så du kommer notifieras om inlägg till det här ämnet via e-post.","3_6":"Du kommer att få notifikationer för att du bevakar denna kategori.","3_5":"Du kommer att ta emot notifikationer för att du automatiskt började följa det här ämnet.","3_2":"Du kommer att ta emot notifikationer för att du bevakar detta ämne.","3_1":"Du kommer ta emot notifikationer för att du skapade detta ämne.","3":"Du kommer att ta emot notifikationer för att du bevakar detta ämne.","2_8":"Du kommer att få notifikationer eftersom du följer denna kategori.","2_4":"Du kommer att ta emot notifikationer för att du postade ett svar till detta ämne.","2_2":"Du kommer att ta emot notifikationer för att du följer detta ämne.","2":"Du kommer att ta emot notifikationer för att du \u003ca href=\"/users/{{username}}/preferences\"\u003eläser detta ämne\u003c/a\u003e.","1_2":"Du kommer få en notifiering om någon nämner ditt @namn eller svarar på ditt inlägg.","1":"Du kommer få en notifiering om någon nämner ditt @namn eller svarar på ditt inlägg.","0_7":"Du ignorerar alla notifikationer i den här kategorin.","0_2":"Du ignorerar alla notifikationer för detta ämne.","0":"Du ignorerar alla notifikationer för detta ämne."},"watching_pm":{"title":"Bevakar","description":"Du kommer att få en notifiering för varje nytt svar i detta meddelande, samt en räknare med antalet nya svar."},"watching":{"title":"Bevakar","description":"Du kommer att notifieras om varje nytt svar i detta ämne, och ett räknare över nya svar visas."},"tracking_pm":{"title":"Följer","description":"En räknare över antal nya svar visas för detta meddelande. Du notifieras om någon nämner ditt @namn eller svarar dig."},"tracking":{"title":"Följer","description":"En räknare över antal nya svar visas för detta ämne. Du notifieras om någon nämner ditt @namn eller svarar dig."},"regular":{"title":"Normal","description":"Du kommer att få en notifiering om någon nämner ditt @namn eller svarar dig."},"regular_pm":{"title":"Normal","description":"Du kommer att notifieras om någon nämner ditt @namn eller svarar dig."},"muted_pm":{"title":"Tystade","description":"Du kommer aldrig bli notifierad om något gällande detta meddelande."},"muted":{"title":"Tystade","description":"Du kommer aldrig att notifieras om någonting som rör det här ämnet, och den kommer inte att visas i din flik med senaste."}},"actions":{"recover":"Återställ ämne","delete":"Radera ämne","open":"Öppna ämne","close":"Stäng ämne","multi_select":"Välj inlägg...","auto_close":"Stäng automatiskt...","pin":"Klistra ämne...","unpin":"Avklistra ämne...","unarchive":"Dearkivera ämne","archive":"Arkivera ämne","invisible":"Markera olistad","visible":"Markera listad","reset_read":"Återställ läsdata","make_public":"Skapa allmänt ämne","make_private":"Skapa privat meddelande"},"feature":{"pin":"Klistra ämne","unpin":"Avklistra ämne","pin_globally":"Klistra ämne globalt","make_banner":"Gör ämne till banderoll","remove_banner":"Ta bort banderollämne"},"reply":{"title":"Svara","help":"börja komponera ett svar till detta ämne"},"clear_pin":{"title":"Ta bort nål","help":"Ta bort den klistrade statusen från detta ämne så den inte längre hamnar i toppen av din ämneslista"},"share":{"title":"Dela","help":"dela en länk till detta ämne"},"flag_topic":{"title":"Flagga","help":"flagga privat detta ämne för uppmärksamhet eller skicka en privat notifiering om den","success_message":"Du flaggade framgångsrikt detta ämne."},"feature_topic":{"title":"Gör till utvalt ämne","pin":"Gär det här ämnet synligt i toppen av {{categoryLink}} kategorin tills ","confirm_pin":"Du har redan {{count}} klistrade ämnen. För många klistrade ämnen kan vara störande för nya och anonyma användare. Är du säker på att du vill klistra ytterligare ett ämne i denna kategori?","unpin":"Ta bort detta ämne från toppen av kategorin {{categoryLink}}.","unpin_until":"Radera det här ämnet från toppen av {{categoryLink}} kategorin eller vänta tills \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Användare kan avklistra ämnet individuellt för sig själva.","pin_validation":"Ett datum krävs för att klistra fast det här ämnet.","not_pinned":"Det finns inga klistrade ämnen i {{categoryLink}}.","already_pinned":{"one":"Nuvarande antal ämnen som är klistrade i {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Nuvarande antal ämnen som är klistrade i {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Gör det här ämnet synligt i toppen av alla ämneslistor tills ","confirm_pin_globally":"Du har redan {{count}} globalt klistrade ämnen. För många klistrade ämnen kan vara störande för nya och anonyma användare. Är du säker på att du vill klistra ytterligare ett ämne globalt?","unpin_globally":"Ta bort detta ämne från toppen av alla ämneslistor.","unpin_globally_until":"Ta bort det här ämnet från toppen av alla ämneslistor eller vänta tills \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Användare kan avklistra ämnet individuellt för sig själva.","not_pinned_globally":"Det finns inga globalt klistrade ämnen.","already_pinned_globally":{"one":"Nuvarande antal ämnen som klistrats globalt: \u003cstrong class='badge badge-notification unread'\u003e1\u003c/strong\u003e","other":"Nuvarande antal ämnen som klistrats globalt: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Gör detta ämne till en banderoll som dyker upp i toppen av alla sidor.","remove_banner":"Ta bort banderollen som dyker upp i toppen av alla sidor.","banner_note":"Användare kan avfärda banderollen genom att stänga den. Endast ett ämne kan agera banderoll åt gången.","no_banner_exists":"Det finns inget banderollämne.","banner_exists":"Det \u003cstrong class='badge badge-notification unread'\u003eär\u003c/strong\u003e för närvarande ett banderollämne."},"inviting":"Bjuder in...","automatically_add_to_groups":"Den här inbjudan inkluderar också åtkomst till de här grupperna:","invite_private":{"title":"Inbjudan till meddelande","email_or_username":"Den inbjudnas e-post eller användarnamn","email_or_username_placeholder":"e-postadress eller användarnamn","action":"Bjud in","success":"Vi har bjudit in användaren att delta i det här meddelandet.","success_group":"Vi har bjudit in gruppen att delta i det här meddelandet.","error":"Tyvärr det uppstod ett fel under inbjudandet av den användaren.","group_name":"gruppnamn"},"controls":"Ämneskontroller","invite_reply":{"title":"Bjud in","username_placeholder":"användarnamn","action":"Skicka inbjudan","help":"bjud in andra till detta ämne via e-post eller notifieringar","to_forum":"Vi skickar ett kort e-postmeddelande som tillåter din vän att omedelbart delta genom att klicka på en länk, ingen inloggning krävs.","sso_enabled":"Ange användarnamnet för personen du vill bjuda in till detta ämne.","to_topic_blank":"Ange användarnamnet eller e-postadressen för personen som du vill bjuda in till detta ämne.","to_topic_email":"Du har angett en e-postadress. Vi skickar en inbjudan som ger din vän möjlighet att svara på detta ämne direkt.","to_topic_username":"Du har angett ett användarnamn. Vi skickar en notifiering med en länk som bjuder in din vän till detta ämne.","to_username":"Ange användarnamnet för personen du vill bjuda in. Vi skickar en notifiering med en länk som bjuder in din vän till detta ämne.","email_placeholder":"namn@exampel.se","success_email":"Vi skickade ut en inbjudan till \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Vi meddelar dig när inbjudan lösts in. Kolla inbjudningsfliken på din användarsida för att hålla koll på dina inbjudningar.","success_username":"Vi har bjudit in användaren att delta i detta ämne.","error":"Tyvärr, vi kunde inte bjuda in den personen. Personen kanske redan har blivit inbjuden? (Invites are rate limited)"},"login_reply":"Logga in för att svara","filters":{"n_posts":{"one":"1 inlägg","other":"{{count}} inlägg"},"cancel":"Ta bort filter"},"split_topic":{"title":"Flytta till nytt ämne","action":"flytta till nytt ämne","topic_name":"Nytt ämnesnamn","error":"Ett fel inträffade då inläggen skulle flyttas till det nya ämnet.","instructions":{"one":"Du är påväg att skapa ett nytt ämne och lägga inlägget du har valt i den.","other":"Du är påväg att skapa en nytt ämne och lägga de \u003cb\u003e{{count}}\u003c/b\u003e inlägg du har valt i den."}},"merge_topic":{"title":"Flytta till befintligt ämne","action":"flytta till befintligt ämne","error":"Ett fel inträffade då inlägg skulle flyttas till det ämnet.","instructions":{"one":"Välj vilket ämne du vill flytta det inlägget till.","other":"Välj vilket ämne du vill flytta de \u003cbr\u003e{{count}}\u003c/b\u003e inläggen till."}},"change_owner":{"title":"Ändra ägare av inlägg","action":"ändra ägare","error":"Ett fel uppstod vid ändringen av ämnets ägarskap.","label":"Ny ägare av inlägg","placeholder":"användarnamn på den nya ägaren","instructions":{"one":"Vänligen välj ny ägare till inlägget av \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Vänligen välj ny ägare till de {{count}} inläggen av \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Notera att inga notifieringar om detta inlägg kommer överföras till den nya användaren retroaktivt.\u003cbr\u003eVarning: Just nu överförs inga inläggskritiska data till den nya användaren. Använd med försiktighet. "},"change_timestamp":{"title":"Ändra tidsstämpeln ","action":"ändra tidsstämpeln","invalid_timestamp":"Tidsstämpeln kan inte sättas till ett framtida datum.","error":"Ett fel uppstod vid ändringen av ämnets tidsstämpel.","instructions":"Var vänlig välj en ny tidsstämpel för ämnet. Inlägg i det här ämnet kommer att uppdateras för att ha samma tidsskillnad."},"multi_select":{"select":"markera","selected":"markerade ({{count}})","select_replies":"välj +svar","delete":"radera markerade","cancel":"avbryt markering","select_all":"markera alla","deselect_all":"avmarkera alla","description":{"one":"Du har markerat \u003cb\u003e1\u003c/b\u003e inlägg.","other":"Du har markerat \u003cb\u003e{{count}}\u003c/b\u003e inlägg."}}},"post":{"reply":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{replyAvatar}} {{usernameLink}}","reply_topic":"\u003ci class='fa fa-mail-forward'\u003e\u003c/i\u003e {{link}}","quote_reply":"citatsvar","edit":"Redigerar {{link}} {{replyAvatar}} {{username}}","edit_reason":"Anledning:","post_number":"inlägg {{number}}","last_edited_on":"inlägg senast ändrat den","reply_as_new_topic":"Svara som länkat ämne","continue_discussion":"Fortsätter diskussionen från {{postLink}}:","follow_quote":"gå till det citerade inlägget","show_full":"Via hela inlägget","show_hidden":"Visa dolt innehåll.","deleted_by_author":{"one":"(inlägg tillbakadraget av skaparen, kommer att raderas automatiskt om 1 timme om det inte flaggas)","other":"(inlägg tillbakadraget av skaparen, kommer att raderas automatiskt om %{count} timmar om det inte flaggas)"},"expand_collapse":"utvidga/förminska","gap":{"one":"visa 1 dolt svar","other":"visa {{count}} dolda svar"},"unread":"Inlägget är oläst","has_replies":{"one":"{{count}} svar","other":"{{count}} svar"},"has_likes":{"one":"{{count}} gillning","other":"{{count}} gillningar"},"has_likes_title":{"one":"1 person gillade detta inlägg","other":"{{count}} personer gillade detta inlägg"},"has_likes_title_only_you":"du gillade det här inlägget","has_likes_title_you":{"one":"du och 1 annan person gillade det här inlägget","other":"du och {{count}} andra personer gillade det här inlägget"},"errors":{"create":"Tyvärr, det uppstod ett fel under skapandet av ditt inlägg. Var god försök igen.","edit":"Tyvärr, det uppstod ett fel under ändringen av ditt inlägg. Var god försök igen.","upload":"Tyvärr, det uppstod ett fel under uppladdandet av den filen. Vad god försök igen.","file_too_large":"Tyvärr, filen är för stor (maximal filstorlek är {{max_size_kb}}kb). Varför inte ladda upp din stora fil till en moln-delningstjänst och sen dela länken?","too_many_uploads":"Tyvärr, du kan bara ladda upp en bild i taget.","too_many_dragged_and_dropped_files":"Tyvärr, du kan bara ladda upp 10 filer åt gången.","upload_not_authorized":"Tyvärr, filen du försökte ladda upp är inte tillåten (tillåtna filtyper: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Tyvärr, nya användare kan inte ladda upp bilder.","attachment_upload_not_allowed_for_new_user":"Tyvärr, nya användare kan inte bifoga filer.","attachment_download_requires_login":"Tyvärr, du måste vara inloggad för att kunna ladda ned bifogade filer."},"abandon":{"confirm":"Är du säker på att du vill avbryta ditt inlägg?","no_value":"nej, behåll","yes_value":"Ja, överge"},"via_email":"det här inlägget har gjorts via e-post","via_auto_generated_email":"det här inlägget anlände via ett autogenererat e-postmeddelande","whisper":"det här inlägget är en privat viskning för moderatorer","wiki":{"about":"det här inlägget är en wiki"},"archetypes":{"save":"Spara inställningar"},"few_likes_left":"Tack för att du sprider kärleken! Du har bara några få gillningar kvar idag.","controls":{"reply":"börja komponera ett svar till detta inlägg","like":"gilla detta inlägg","has_liked":"du har gillat detta inlägg","undo_like":"ångra gillning","edit":"ändra detta inlägg","edit_anonymous":"Tyvärr, du måste vara inloggad för att kunna redigera det här inlägget.","flag":"flagga detta inlägg för uppmärksamhet privat eller skicka en privat påminnelse om det","delete":"radera detta inlägg","undelete":"återställ detta inlägg","share":"dela en länk till detta inlägg","more":"Mer","delete_replies":{"confirm":{"one":"Vill du radera det direkta svaret till det här inlägget också?","other":"Vill du radera de {{count}} direkta svaren på det här inlägget också?"},"yes_value":"Ja, radera även svaren","no_value":"Nej, bara det här inlägget"},"admin":"administratörsåtgärder för inlägg","wiki":"Skapa wiki","unwiki":"Ta bort wiki","convert_to_moderator":"Lägg till personalfärg","revert_to_regular":"Ta bort personalfärg","rebake":"Generera HTML","unhide":"Visa","change_owner":"Ändra ägare"},"actions":{"flag":"Flagga","defer_flags":{"one":"Skjut upp","other":"Skjut upp"},"undo":{"off_topic":"Ångra flaggning","spam":"Ångra flaggning","inappropriate":"Ångra flaggning","bookmark":"Ångra bokmärkning","like":"Ångra gillning","vote":"Ångra röstning"},"people":{"off_topic":"flaggade det här som orelevant.","spam":"flaggade det här som spam","inappropriate":"flaggade det här som olämpligt","notify_moderators":"notifierade moderatorer","notify_user":"skickade ett meddelande","bookmark":"bokmärkte det här","like":"gillade det här","vote":"röstade för det här"},"by_you":{"off_topic":"Du flaggade detta som orelevant","spam":"Du flaggade detta som spam","inappropriate":"Du flaggade detta som olämpligt","notify_moderators":"Du flaggade det för moderation.","notify_user":"Du skickade ett meddelande till denna användare","bookmark":"Du bokmärkte detta inlägg","like":"Du gillade detta","vote":"Du röstade för detta inlägg"},"by_you_and_others":{"off_topic":{"one":"Du och 1 annan flaggade detta som orelevant","other":"Du och {{count}} andra personer flaggade detta som orelevant"},"spam":{"one":"Du och 1 annan flaggade detta som spam","other":"Du och {{count}} andra personer flaggade detta som spam"},"inappropriate":{"one":"Du och 1 annan flaggade detta som olämpligt","other":"Du och {{count}} andra personer flaggade detta som olämpligt"},"notify_moderators":{"one":"Du och 1 annan person har flaggat detta för moderation","other":"Du och {{count}} andra personer har flaggat detta för moderation"},"notify_user":{"one":"Du och 1 person till skickade ett meddelande till denna användare","other":"Du och {{count}} andra personer skickade ett meddelande till denna användare"},"bookmark":{"one":"Du och 1 annan bokmärkte detta inlägg","other":"Du och {{count}} andra personer bokmärkte detta inlägg"},"like":{"one":"Du och 1 annan gillade detta","other":"Du och {{count}} andra personer gillade detta"},"vote":{"one":"Du och 1 annan röstade för detta inlägg","other":"Du och {{count}} andra personer röstade för detta inlägg"}},"by_others":{"off_topic":{"one":"1 person flaggade detta som orelevant","other":"{{count}} personer flaggade detta som orelevant"},"spam":{"one":"1 person flaggade detta som spam","other":"{{count}} personer flaggade detta som spam"},"inappropriate":{"one":"1 person flaggade detta som olämpligt","other":"{{count}} personer flaggade detta som olämpligt"},"notify_moderators":{"one":"1 person flaggade detta för granskning","other":"{{count}} personer flaggade detta för granskning"},"notify_user":{"one":"1 person skickade ett meddelande till denna användare","other":"{{count}} skickade ett meddelande till denna användare"},"bookmark":{"one":"1 person bokmärkte detta inlägg","other":"{{count}} personer bokmärkte detta inlägg"},"like":{"one":"1 person gillade detta","other":"{{count}} personer gillade detta"},"vote":{"one":"1 person röstade för detta inlägg","other":"{{count}} personer röstade för detta inlägg"}}},"delete":{"confirm":{"one":"Är du säker på att du vill radera detta inlägg?","other":"Är du säker på att du vill radera alla dessa inlägg?"}},"revisions":{"controls":{"first":"Första revision","previous":"Föregående revision","next":"Nästa revision","last":"Senaste revisionen","hide":"Göm version","show":"Visa version","revert":"Återgå till den här revisionen","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e \u003ci class='fa fa-arrows-h'\u003e\u003c/i\u003e \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Visa resultat med tillägg och borttagningar inline","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Visa skillnader i renderad utmatning sida vid sida","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Visa skillnader i rådatan sida vid sida","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Rå"}}}},"category":{"can":"can\u0026hellip; ","none":"(ingen kategori)","all":"Alla kategorier","choose":"Välj en kategori\u0026hellip;","edit":"redigera","edit_long":"Redigera","view":"Visa ämnen i kategori","general":"Allmänt","settings":"Inställningar","topic_template":"Ämnesmall","tags":"Taggar","tags_allowed_tags":"Taggar som endast kan användas i den här kategorin:","tags_allowed_tag_groups":"Grupptaggar som endast kan användas i den här kategorin:","tags_placeholder":"(Valfritt) lista av tillåtna taggar","tag_groups_placeholder":"(Valfritt) lista av tillåtna grupptaggar","delete":"Radera kategori","create":"Ny kategori","create_long":"Skapa en ny kategori","save":"Spara kategori","slug":"Kategori-etikett","slug_placeholder":"(Valfritt) streckade ord för url","creation_error":"Det uppstod ett fel när kategorin skulle skapas.","save_error":"Ett fel inträffade då kategorin skulle sparas.","name":"Kategorinamn","description":"Beskrivning","topic":"kategoriämne","logo":"Kategori logotypbild","background_image":"Kategori bakgrundsbild","badge_colors":"Utmärkelsefärg","background_color":"Bakgrundsfärg","foreground_color":"Förgrundsfärg","name_placeholder":"Ett eller två ord max","color_placeholder":"Någon webbfärg","delete_confirm":"Är du säker på att du vill radera den kategorin?","delete_error":"Ett fel inträffade vid borttagning av kategorin.","list":"Lista kategorier","no_description":"Lägg till en beskrivning för den här kategorin.","change_in_category_topic":"Redigera beskrivning","already_used":"Den här färgen används redan av en annan kategori","security":"Säkerhet","special_warning":"Varning: Den här kategorin är en förbestämd kategori och säkerhetsinställningarna kan inte ändras. Om du inte vill använda kategorin, ta bort den istället för att återanvända den.","images":"Bilder","auto_close_label":"Stäng automatiskt ämnet efter:","auto_close_units":"timmar","email_in":"Egenvald inkommande e-postadress:","email_in_allow_strangers":"Acceptera e-post från anonyma användare utan konton","email_in_disabled":"Att skapa nya ämnen via e-post är avaktiverat i webbplatsinställningarna. För att aktivera ämnen skapade via e-post,","email_in_disabled_click":"aktivera \"inkommande e-post\" inställningen.","suppress_from_homepage":"Undanta den här kategorin från hemsidan.","allow_badges_label":"Tillåt utmärkelser i den här kategorin","edit_permissions":"Redigera behörigheter","add_permission":"Lägg till behörighet","this_year":"i år","position":"position","default_position":"Standardposition","position_disabled":"Kategorier kommer att sorteras efter deras aktivitet. För att ställa in sorteringen av kategorier i den här listan,","position_disabled_click":"aktivera \"fasta kategoripositioner\" inställningen.","parent":"Förälderkategori","notifications":{"watching":{"title":"Bevakar"},"watching_first_post":{"title":"Bevakar första inlägget","description":"Du kommer att bli notifierad om första inlägget i varje nytt ämne i de här kategorierna."},"tracking":{"title":"Följer"},"regular":{"title":"Normal","description":"Du notifieras om någon nämner ditt @namn eller svarar på ditt inlägg."},"muted":{"title":"Tystad","description":"Du kommer aldrig att notifieras om något som rör nya ämnen i de här kategorierna och de kommer inte att dyka upp i din olästa tabb."}}},"flagging":{"title":"Tack för att du hjälper till att hålla forumet civiliserat!","action":"Flagga inlägg","take_action":"Åtgärda","notify_action":"Meddelande","official_warning":"Officiell varning","delete_spammer":"Radera spammare","yes_delete_spammer":"Ja, radera spammare","ip_address_missing":"(N/A)","hidden_email_address":"(gömd)","submit_tooltip":"Använd den privata flaggan","take_action_tooltip":"Nå flaggränsen omedelbart, snarare än att vänta på mer flaggor från användarna","cant":"Tyvärr, du kan inte flagga detta inlägg just nu.","notify_staff":"Notifiera personal privat","formatted_name":{"off_topic":"Det är orelevant","inappropriate":"Det är olämpligt","spam":"Det är spam"},"custom_placeholder_notify_user":"Var specifik, var konstruktiv och var alltid trevlig.","custom_placeholder_notify_moderators":"Låt oss veta i detalj vad du är bekymrad över, och skicka med relevanta länkar och exempel om möjligt."},"flagging_topic":{"title":"Tack för att du hjälper oss hålla forumet civiliserat!","action":"Flagga ämne","notify_action":"Meddelande"},"topic_map":{"title":"Sammanfattning av ämne","participants_title":"Flitiga skribenter","links_title":"Populära länkar","clicks":{"one":"1 klick","other":"%{count} klick"}},"post_links":{"about":"utvidga fler länkar för det här inlägget","title":{"one":"1 mer","other":"%{count} mer"}},"topic_statuses":{"warning":{"help":"Det här är en officiell varning."},"bookmarked":{"help":"Du bokmärkte detta ämnet."},"locked":{"help":"Det här ämnet är stängt; det går inte längre att svara på inlägg"},"archived":{"help":"Det här ämnet är arkiverat; det är fryst och kan inte ändras"},"locked_and_archived":{"help":"Det här ämnet är stängt och arkiverat; det går inte längre att svara eller ändra"},"unpinned":{"title":"Avklistrat","help":"Detta ämne är avklistrat för dig; det visas i vanlig ordning"},"pinned_globally":{"title":"Klistrat globalt","help":"Det här ämnet är klistrat globalt; det kommer att visas högst upp i senaste och i dess kategori"},"pinned":{"title":"Klistrat","help":"Detta ämne är klistrat för dig. Det visas i toppen av dess kategori"},"invisible":{"help":"Det här ämnet är olistat; det kommer inte visas i ämneslistorna och kan bara nås via en direktlänk"}},"posts":"Inlägg","posts_long":"det finns {{number}} inlägg i detta ämne","original_post":"Originalinlägg","views":"Visningar","views_lowercase":{"one":"visning","other":"visningar"},"replies":"Svar","views_long":"detta ämne har visats {{number}} gånger","activity":"Aktivitet","likes":"Gillningar","likes_lowercase":{"one":"gillar","other":"gillar"},"likes_long":"det finns {{number}} gillningar i detta ämne","users":"Användare","users_lowercase":{"one":"användare","other":"användare"},"category_title":"Kategori","history":"Historik","changed_by":"av {{author}}","raw_email":{"title":"Rå e-post","not_available":"Ej tillgänglig!"},"categories_list":"Kategorilista","filters":{"with_topics":"%{filter} ämnen","with_category":"%{filter} %{category} ämnen","latest":{"title":"Senaste","title_with_count":{"one":"Senaste (1)","other":"Senaste ({{count}})"},"help":"ämnen med nya inlägg"},"hot":{"title":"Hett","help":"ett urval av de hetaste ämnena"},"read":{"title":"Lästa","help":"ämnen du har läst, i den ordningen du senast läste dem"},"search":{"title":"Sök","help":"sök alla ämnen"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alla ämnen grupperade efter kategori"},"unread":{"title":"Olästa","title_with_count":{"one":"Oläst","other":"Olästa ({{count}})"},"help":"ämnen som du bevakar eller följer med olästa inlägg","lower_title_with_count":{"one":"1 oläst","other":"{{count}} olästa"}},"new":{"lower_title_with_count":{"one":"1 ny","other":"{{count}} nya"},"lower_title":"ny","title":"Nya","title_with_count":{"one":"Ny (1)","other":"Nya  ({{count}})"},"help":"ämnen skapade de senaste dagarna"},"posted":{"title":"Mina Inlägg","help":"ämnen som du har postat i"},"bookmarks":{"title":"Bokmärken","help":"Ämnen du har bokmärkt"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"senaste ämnena i kategorin {{categoryName}}"},"top":{"title":"Topp","help":"de mest aktiva ämnena det senaste året, månaden, veckan och dagen","all":{"title":"All tid"},"yearly":{"title":"Årsvis"},"quarterly":{"title":"En gång i kvartalet"},"monthly":{"title":"Månadsvis"},"weekly":{"title":"Veckovis"},"daily":{"title":"Dagligen"},"all_time":"All tid","this_year":"År","this_quarter":"Kvartal","this_month":"Månad","this_week":"Vecka","today":"Idag","other_periods":"se toppen"}},"browser_update":"Tyvärr, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003edin webbläsare är för gammal för att fungera på den här sidan\u003c/a\u003e. Vänligen\u003ca href=\"http://browsehappy.com\"\u003euppgradera din webbläsare\u003c/a\u003e.","permission_types":{"full":"Skapa / svara / se","create_post":"Svara / se","readonly":"se"},"lightbox":{"download":"ladda ned"},"search_help":{"title":"Sökhjälp"},"keyboard_shortcuts_help":{"title":"Tangentbordsgenvägar","jump_to":{"title":"Hoppa till","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Hem","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Senaste","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nya","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Olästa","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Kategorier","top":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Upp till toppen","bookmarks":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eb\u003c/b\u003e Bokmärken","profile":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ep\u003c/b\u003e Profil","messages":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Meddelanden"},"navigation":{"title":"Navigering","jump":"\u003cb\u003e#\u003c/b\u003e Gå till inlägg #","back":"\u003cb\u003eu\u003c/b\u003e Tillbaka","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Flytta markering \u0026uarr; \u0026darr;","open":"\u003cb\u003eö\u003c/b\u003e eller \u003cb\u003eVälj\u003c/b\u003e Öppna valt ämne","next_prev":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ej\u003c/b\u003e/\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ek\u003c/b\u003e Nästa/föregående avsnitt"},"application":{"title":"Applikation","create":"\u003cb\u003es\u003c/b\u003e Skapa ett nytt ämne","notifications":"\u003cb\u003en\u003c/b\u003e Öppna notifieringar","hamburger_menu":"\u003cb\u003e=\u003c/b\u003e Öppna hamburgarmenyn","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Öppna användarmeny","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Visa uppdaterade ämnen","search":"\u003cb\u003e/\u003c/b\u003e Sök","help":"\u003cb\u003e?\u003c/b\u003e Öppna tangentbordshjälp","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Avfärda nya/inlägg","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Avfärda ämnen","log_out":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e \u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ez\u003c/b\u003e Logga ut"},"actions":{"title":"Åtgärder","bookmark_topic":"\u003cb\u003ef\u003c/b\u003e Växla bokmärkning av ämne","pin_unpin_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003ep\u003c/b\u003e Klistra/avklistra ämne","share_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003es\u003c/b\u003e Dela ämne","share_post":"\u003cb\u003es\u003c/b\u003e Dela inlägg","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Svara med länkat ämne","reply_topic":"\u003cb\u003eshift\u003c/b\u003e+\u003cb\u003er\u003c/b\u003e Svara på ämne","reply_post":"\u003cb\u003er\u003c/b\u003e Svara på inlägg","quote_post":"\u003cb\u003eq\u003c/b\u003e Citera inlägg","like":"\u003cb\u003el\u003c/b\u003e Gilla inlägg","flag":"\u003cb\u003e!\u003c/b\u003e Flagga inlägg","bookmark":"\u003cb\u003eb\u003c/b\u003e Bokmärk inlägg","edit":"\u003cb\u003ee\u003c/b\u003e Redigera inlägg","delete":"\u003cb\u003ed\u003c/b\u003e Radera inlägg","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Tysta ämne","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Vanligt (standard) ämne","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Följ ämne","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Bevaka ämne"}},"badges":{"earned_n_times":{"one":"Förtjänade den här utmärkelsen 1 gång","other":"Förtjänade den här utmärkelsen %{count} gånger"},"granted_on":"Utfärdad %{date}","others_count":"Andra med den här utmärkelsen (%{count})","title":"Utmärkelser","allow_title":"tillgänglig rubrik","multiple_grant":"tilldelad flera gånger","badge_count":{"one":"1 Utmärkelse","other":"%{count} Utmärkelser"},"more_badges":{"one":"+1 Till","other":"+%{count} Till"},"granted":{"one":"1 utfärdad","other":"%{count} utfärdade"},"select_badge_for_title":"Välj en utmärkelse att använda som din titel","none":"\u003cnone\u003e","badge_grouping":{"getting_started":{"name":"Komma igång"},"community":{"name":"Community"},"trust_level":{"name":"Förtroendenivå"},"other":{"name":"Övrigt"},"posting":{"name":"Publicera inlägg"}}},"google_search":"\u003ch3\u003eSök med Google\u003c/h3\u003e\n\u003cp\u003e\n\u003cform action='//google.com/search' id='google-search' onsubmit=\"document.getElementById('google-query').value = 'site:' + window.location.host + ' ' + document.getElementById('user-query').value; return true;\"\u003e\n\u003cinput type=\"text\" id='user-query' value=\"\"\u003e\n\u003cinput type='hidden' id='google-query' name=\"q\"\u003e\n\u003cbutton class=\"btn btn-primary\"\u003eGoogle\u003c/button\u003e\n\u003c/form\u003e\n\u003c/p\u003e\n","tagging":{"all_tags":"Alla taggar","selector_all_tags":"alla taggar","changed":"taggar ändrade:","tags":"Taggar","choose_for_topic":"välj valfria taggar för det här ämnet","delete_tag":"Radera tag","delete_confirm":"Är du säker på att du vill ta bort den taggen?","rename_tag":"Döp om taggen","rename_instructions":"Välj ett nytt namn för taggen:","sort_by":"Sortera efter:","sort_by_count":"summa","sort_by_name":"namn","manage_groups":"Hantera grupptaggar","manage_groups_description":"Definiera grupper för att organisera taggar","filters":{"without_category":"%{filter} %{tag} ämnen","with_category":"%{filter} %{tag} ämnen i %{category}"},"notifications":{"watching":{"title":"Bevakar"},"watching_first_post":{"title":"Bevakar första inlägget","description":"Du kommer endast att bli notifierad om första inlägget i varje nytt ämne i den här taggen."},"tracking":{"title":"Bevakade"},"regular":{"title":"Vanlig","description":"Du kommer att få en notifiering om någon nämner ditt @namn eller svarar på ditt inlägg."},"muted":{"title":"Tystad","description":"Du kommer inte att få notifieringar om nya ämnen inom den här taggen, och de kommer inte att visas under din \"oläst\"-flik."}},"groups":{"title":"Grupptaggar","about":"Lägg till taggar i grupper för att lättare hantera dem.","new":"Ny grupp","tags_label":"Taggar i den här gruppen:","parent_tag_label":"Föräldertagg:","parent_tag_placeholder":"Valfria","parent_tag_description":"Taggar från den här gruppen kan inte användas om inte föräldertaggen är med.","one_per_topic_label":"Sätt gräns till en tagg för varje ämne för den här gruppen","new_name":"Ny grupptagg","save":"Spara","delete":"Radera","confirm_delete":"Är du säker på att du vill ta bort den här grupptaggen?"},"topics":{"none":{"unread":"Du har inga olästa ämnen.","new":"Du har inga nya ämnen.","read":"Du har inte lästa några ämnen ännu.","posted":"Du har inte skrivit i några ämnen ännu.","latest":"Det finns inga senaste ämnen.","hot":"Det finns inga heta ämnen.","bookmarks":"Du har inga bokmärkta ämnen ännu.","top":"Det finns inga toppämnen.","search":"Inga sökresultat hittades."},"bottom":{"latest":"Det finns inga fler senaste ämnen.","hot":"Det finns inga fler heta ämnen.","posted":"Det finns inga fler postade ämnen.","read":"Det finns inga fler lästa ämnen.","new":"Det finns inga fler nya ämnen.","unread":"Det finns inga fler olästa ämnen.","top":"Det finns inga fler toppämnen.","bookmarks":"Det finns inga fler bokmärkta ämnen.","search":"Det finns inga fler sökresultat."}}},"invite":{"custom_message":"Gör din inbjudan lite mer personlig genom att skriva ett ","custom_message_link":"personligt meddelande","custom_message_placeholder":"Skriv ditt personliga meddelande","custom_message_template_forum":"Hej! Du borde gå med i det här forumet!","custom_message_template_topic":"Hej! Jag tror att du kanske skulle uppskatta det här ämnet!"},"poll":{"voters":{"one":"röst","other":"röster"},"total_votes":{"one":"totalt antal röst","other":"totalt antal röster"},"average_rating":"Medelbetyg: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Omröstningar är allmänna."},"multiple":{"help":{"at_least_min_options":{"one":"Välj minst \u003cstrong\u003e1\u003c/strong\u003e alternativ","other":"Välj minst \u003cstrong\u003e%{count}\u003c/strong\u003e alternativ"},"up_to_max_options":{"one":"Välj upp till \u003cstrong\u003e1\u003c/strong\u003e alternativ","other":"Välj upp till \u003cstrong\u003e%{count}\u003c/strong\u003e alternativ"},"x_options":{"one":"Välj \u003cstrong\u003e1\u003c/strong\u003e alternativ","other":"Välj \u003cstrong\u003e%{count}\u003c/strong\u003e alternativ"},"between_min_and_max_options":"Välj mellan \u003cstrong\u003e%{min}\u003c/strong\u003e och \u003cstrong\u003e%{max}\u003c/strong\u003e alternativ"}},"cast-votes":{"title":"Lägg dina röster","label":"Rösta nu!"},"show-results":{"title":"Visa omröstningsresultatet","label":"Visa resultat"},"hide-results":{"title":"Tillbaka till dina röster","label":"Göm resultat"},"open":{"title":"Öppna omröstningen","label":"Öppna","confirm":"Är du säker på att du vill öppna denna omröstning?"},"close":{"title":"Stäng omröstningen","label":"Stäng","confirm":"Är du säker på att du vill stänga denna omröstning?"},"error_while_toggling_status":"Tyvärr, ett fel uppstod vid ändring av status för den här omröstningen.","error_while_casting_votes":"Tyvärr, ett fel uppstod vid röstningen.","error_while_fetching_voters":"Tyvärr, ett fel uppstod vid visningen av röster.","ui_builder":{"title":"Skapa omröstning","insert":"Lägg till omröstning","help":{"options_count":"Ange minst 2 alternativ"},"poll_type":{"label":"Typ","regular":"Ett val","multiple":"Flera val","number":"Sifferbetyg"},"poll_config":{"max":"Max","min":"Min","step":"Steg"},"poll_public":{"label":"Visa vilka som röstat"},"poll_options":{"label":"Ange ett omröstningsalternativ per rad"}}},"type_to_filter":"skriv för att filtrera...","admin":{"title":"Discourse Admin","moderator":"Moderator","dashboard":{"title":"Översiktspanel","last_updated":"Dashboard senast uppdaterad:","version":"Version","up_to_date":"Du är aktuell!","critical_available":"En kritisk uppdatering är tillgänglig.","updates_available":"Uppdateringar är tillgängliga.","please_upgrade":"Var god uppgradera!","no_check_performed":"En sökning efter uppdateringar har ej genomförts. Kontrollera att sidekiq körs.","stale_data":"En sökning efter uppdateringar har inte genomförts på sistone. Kontrollera att sidekiq körs.","version_check_pending":"Det verkar som att du har uppgraderat nyligen. Utmärkt!","installed_version":"Installerad","latest_version":"Senaste","problems_found":"Några problem har hittas med din installation av Discourse:","last_checked":"Senast kollad","refresh_problems":"Uppdatera","no_problems":"Inga problem upptäcktes.","moderators":"Moderatorer:","admins":"Administratörer:","blocked":"Blockerad:","suspended":"Avstängd:","private_messages_short":"Meddelanden","private_messages_title":"Meddelanden","mobile_title":"Mobil","space_free":"{{size}} ledigt","uploads":"uppladdningar","backups":"säkerhetskopior","traffic_short":"Trafik","traffic":"Applikations-webbegäran","page_views":"API-förfrågningar","page_views_short":"API-förfrågningar","show_traffic_report":"Visa detaljerad trafikrapport","reports":{"today":"Idag","yesterday":"Igår","last_7_days":"De senaste 7 dagarna","last_30_days":"De senaste 30 dagarna","all_time":"Alltid","7_days_ago":"7 dagar sedan","30_days_ago":"30 dagar sedan","all":"Alla","view_table":"tabell","view_graph":"graf","refresh_report":"Uppdatera rapport","start_date":"Startdatum","end_date":"Slutdatum","groups":"Alla grupper"}},"commits":{"latest_changes":"Senaste ändringarna: snälla uppdatera ofta!","by":"av"},"flags":{"title":"Flaggningar","old":"Gamla","active":"Aktiva","agree":"Godkänn","agree_title":"Bekräfta att den här flaggan är giltig och korrekt","agree_flag_modal_title":"Bekräfta och...","agree_flag_hide_post":"Godkänn (dölj inlägg + skicka PM)","agree_flag_hide_post_title":"Dölj detta inlägg och sänd användaren ett meddelande automatiskt som uppmanar att redigera det","agree_flag_restore_post":"Godkänn (återställ inlägg)","agree_flag_restore_post_title":"Återställ detta inlägg","agree_flag":"Godkänn flaggning","agree_flag_title":"Godkänn flaggning och behåll inlägget oförändrat","defer_flag":"Skjut upp","defer_flag_title":"Ta bort den här flaggan; den kräver ingen åtgärd för tillfället.","delete":"Ta bort","delete_title":"Ta bort inlägget som den här flaggan refererar till.","delete_post_defer_flag":"Ta bort inlägg och skjut upp flagga","delete_post_defer_flag_title":"Ta bort inlägg; om det är det första inlägget, ta bort ämnet","delete_post_agree_flag":"Ta bort inlägg och godkänn flaggning.","delete_post_agree_flag_title":"Ta bort inlägg; om det är det första inlägget, ta bort ämnet","delete_flag_modal_title":"Ta bort och...","delete_spammer":"Radera spammare","delete_spammer_title":"Radera användaren och alla hans/hennes inlägg och ämnen.","disagree_flag_unhide_post":"Håll inte med (visa inlägg)","disagree_flag_unhide_post_title":"Ta bort alla flaggor från detta inlägg och gör det synligt igen","disagree_flag":"Håll inte med","disagree_flag_title":"Neka den här flaggningen som ogiltig eller inkorrekt","clear_topic_flags":"Klar","clear_topic_flags_title":"Ämnet har undersökts och eventuella problem har lösts. Klicka på klar för att ta bort flaggorna.","more":"(mer svar...)","dispositions":{"agreed":"godkände","disagreed":"godkände ej","deferred":"sköt upp"},"flagged_by":"Flaggad av","resolved_by":"Löst av","took_action":"Agerade","system":"System","error":"Någonting gick snett","reply_message":"Svara","no_results":"Det finns inga flaggor.","topic_flagged":"Detta \u003cstrong\u003eämne\u003c/strong\u003e har blivit flaggad.","visit_topic":"Besök ämnet för att vidta åtgärder","was_edited":"Inlägget redigerades efter den första flaggningen","previous_flags_count":"Det här inlägget har redan flaggats {{count}} gånger.","summary":{"action_type_3":{"one":"orelevant","other":"orelevant x{{count}}"},"action_type_4":{"one":"olämpligt","other":"olämpligt x{{count}}"},"action_type_6":{"one":"custom","other":"custom x{{count}}"},"action_type_7":{"one":"anpassad","other":"anpassad x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Primär grupp","no_primary":"(ingen primär grupp)","title":"Grupper","edit":"Redigera Grupper","refresh":"Uppdatera","new":"Ny","selector_placeholder":"ange användarnamn","name_placeholder":"Gruppnamn, inga mellanslag, samma regler som för användarnamn","about":"Redigera dina gruppmedlemskap och -namn här.","group_members":"Gruppmedlemmar","delete":"Radera","delete_confirm":"Ta bort den här gruppen?","delete_failed":"Oförmögen att ta bort grupp. Om det här är en automatisk grupp så kan den inte raderas.","delete_member_confirm":"Ta bort '%{username}' från '%{group}' gruppen?","delete_owner_confirm":"Ta bort användarprivilegier för '\"{username}'?","name":"Namn","add":"Lägg till","add_members":"Lägg till medlemmar","custom":"Anpassad","bulk_complete":"Användarna har lagts till i gruppen.","bulk":"Masstilläggning till grupp","bulk_paste":"Klistra in en lista av användarnamn eller e-postadresser, en per rad:","bulk_select":"(välj en grupp)","automatic":"Automatisk","automatic_membership_email_domains":"Användare som registrerar sig med en e-post vars domän exakt matchar en domän i den här listan kommer automatiskt att bli tillagd i den här gruppen:","automatic_membership_retroactive":"Använd samma regel för e-postdomän för att lägga till nya användare","default_title":"Standardtitel för alla användare i denna grupp","primary_group":"Automatiskt inställd som primär grupp","group_owners":"Ägare","add_owners":"Lägg till ägare","incoming_email":"Egenvald inkommande e-postadress","incoming_email_placeholder":"Ange e-postadress"},"api":{"generate_master":"Generera API-huvudnyckel","none":"Det finns inga aktiva API-nycklar just nu.","user":"Användare","title":"API","key":"API-nyckel","generate":"Generera","regenerate":"Regenerera","revoke":"Återkalla","confirm_regen":"Är du säker på att du vill ersätta den API-nyckeln med en ny?","confirm_revoke":"Är du säker på att du vill återkalla den nyckeln?","info_html":"Din API-nyckel kommer tillåta dig att skapa och uppdatera ämnen med hjälp av JSON-anrop.","all_users":"Alla användare","note_html":"Håll denna nyckel \u003cstrong\u003ehemlig\u003c/strong\u003e, alla användare som har den kan skapa godtyckliga inlägg som alla användare."},"plugins":{"title":"Tillägg","installed":"Installerade tillägg","name":"Namn","none_installed":"Du har inga tillägg installerade.","version":"Version","enabled":"Aktiverad?","is_enabled":"Y","not_enabled":"N","change_settings":"Ändra inställningar","change_settings_short":"Inställningar","howto":"Hur installerar jag tillägg?"},"backups":{"title":"Säkerhetskopior","menu":{"backups":"Säkerhetskopior","logs":"Loggar"},"none":"Ingen säkerhetskopia är tillgänglig.","read_only":{"enable":{"title":"Aktivera skrivskyddat läge","label":"Aktivera skrivskydd","confirm":"Är du säker på att du vill aktivera skrivskyddat läge?"},"disable":{"title":"Inaktivera skrivskyddat läge","label":"Inaktivera skrivskydd"}},"logs":{"none":"Inga loggar ännu..."},"columns":{"filename":"Filnamn","size":"Storlek"},"upload":{"label":"Ladda upp","title":"Ladda upp en säkerhetskopia till denna instans","uploading":"Laddar upp...","success":"'{{filename}}' har laddats upp.","error":"Ett fel har uppstått vid uppladdning av '{{filename}}': {{message}}"},"operations":{"is_running":"En operation körs just nu...","failed":" {{operation}} misslyckades. Var vänlig och kontrollera loggarna.","cancel":{"label":"Avbryt","title":"Avbryt den pågående operationen","confirm":"Är du säker på att du vill avbryta den pågående operationen?"},"backup":{"label":"Säkerhetskopia","title":"Skapa en säkerhetskopia","confirm":"Vill du skapa en ny säkerhetskopiering?","without_uploads":"Ja (inkludera inte filer)"},"download":{"label":"Ladda ner","title":"Ladda ned säkerhetskopian"},"destroy":{"title":"Ta bort säkerhetskopian","confirm":"Är du säker på att du vill förstöra denna säkerhetskopia?"},"restore":{"is_disabled":"Återställ är inaktiverat i sidans inställningar.","label":"Återställ","title":"Återställ säkerhetskopian","confirm":"Är du säker på att du vill återställa den här säkerhetskopian?"},"rollback":{"label":"Tillbakarullning","title":"Gör en tillbakarullning på databasen till ett tidigare fungerande tillstånd.","confirm":"Är du säker på att du vill göra en tillbakarullning på databasen till det tidigare fungerande tillståndet?"}}},"export_csv":{"user_archive_confirm":"Är du säker på att du vill ladda ner dina inlägg?","success":"Export påbörjad, du får en notis via meddelande när processen är genomförd.","failed":"Exporteringen misslyckades. Kontrollera loggarna.","rate_limit_error":"Inlägg kan bara laddas ner en gång per dag, var vänlig och försök imorgon istället.","button_text":"Exportera","button_title":{"user":"Exportera alla användare i CSV-format","staff_action":"Exportera medarbetarloggen i CSV-format.","screened_email":"Exportera hela den undersökta e-postlistan i CSV-format.","screened_ip":"Exportera hela den undersökta IP-listan i CSV-format.","screened_url":"Exportera hela den undersökta URL-listan i CSV-format."}},"export_json":{"button_text":"Exportera"},"invite":{"button_text":"Skicka inbjudningar","button_title":"Skicka inbjudningar"},"customize":{"title":"Anpassa","long_title":"Sidanpassningar","css":"CSS","header":"Sidhuvud","top":"Toppen","footer":"Sidfot","embedded_css":"Inbäddad CSS","head_tag":{"text":"\u003c/head\u003e","title":"HTML som kommer att sättas in före \u003c/head\u003e taggen"},"body_tag":{"text":"\u003c/body\u003e","title":"HTML som kommer att sättas in före \u003c/body\u003e taggen"},"override_default":"Inkludera inte standard-stilmallen","enabled":"Aktiverad?","preview":"förhandsgranska","undo_preview":"ta bort förhandsgranskning","rescue_preview":"standard stil","explain_preview":"Se sidan med skräddarsydd stilmall","explain_undo_preview":"Gå tillbaka till den nuvarande aktiva stilmallen","explain_rescue_preview":"Se sidan med standard-stilmallen","save":"Spara","new":"Ny","new_style":"Ny stil","import":"Importera","import_title":"Välj en fil eller klistra in text","delete":"Radera","delete_confirm":"Radera denna anpassning?","about":"Modifiera CSS stilmallar och HTML sidhuvuden på sidan. Lägg till en anpassning för att börja.","color":"Färg","opacity":"Opacitet","copy":"Kopiera","email_templates":{"title":"E-postmallar","subject":"Ämne","multiple_subjects":"Den här e-postmallen har flera ämnen.","body":"Huvuddel","none_selected":"Välj en e-postmall för att börja redigera.","revert":"Ångra ändringar","revert_confirm":"Är du säker på att du vill ångra dina ändringar?"},"css_html":{"title":"CSS/HTML","long_title":"CSS- och HTML-anpassningar"},"colors":{"title":"Färger","long_title":"Färgscheman","about":"Modifiera färgerna som används utan att skriva CSS. Lägg till ett schema för att börja.","new_name":"Nytt färgschema","copy_name_prefix":"Kopia av","delete_confirm":"Ta bort det här färgschemat?","undo":"ångra","undo_title":"Återställ ändringarna för den här färgen till den senast sparade versionen.","revert":"återställ","revert_title":"Återställ den här färgen till Discourse standard färgschema.","primary":{"name":"primär","description":"Det mesta av texten, ikoner och ramar."},"secondary":{"name":"sekundär","description":"Den huvudsakliga bakgrundsfärgen, och textfärgen på vissa knappar."},"tertiary":{"name":"tertiär","description":"Länkar, några knappar, notiser, och accentfärger."},"quaternary":{"name":"kvartär","description":"Navigeringslänkar."},"header_background":{"name":"bakgrund för sidhuvud","description":"Bakgrundsfärg för sidans sidhuvud. "},"header_primary":{"name":"sidhuvud primär","description":"Text och ikoner i sidans sidhuvud."},"highlight":{"name":"markera","description":"Bakgrundsfärgen på markerade element på sidan, som inlägg och ämnen."},"danger":{"name":"fara","description":"Markeringsfärg när man tar bort inlägg eller ämnen."},"success":{"name":"lyckades","description":"Används för att indikera att en åtgärd lyckades."},"love":{"name":"älska","description":"Gillaknappens färg."}}},"email":{"title":"E-post","settings":"Inställningar","templates":"Mallar","preview_digest":"Sammandrag","sending_test":"Skickar e-posttest...","error":"\u003cb\u003ePROBLEM\u003c/b\u003e - %{server_error}","test_error":"Det uppstod ett problem med att skicka testmeddelandet. Dubbelkolla dina e-postinställningar, verifiera att din host inte blockerar e-postkopplingar, och försök igen.","sent":"Skickade","skipped":"Överhoppade","bounced":"Studsade","received":"Mottagna","rejected":"Avvisade","sent_at":"Skickat","time":"Tid","user":"Användare","email_type":"E-posttyp","to_address":"Till-adress","test_email_address":"e-postadress att testa","send_test":"Skicka e-posttest","sent_test":"skickat!","delivery_method":"Leveransmetod","preview_digest_desc":"Förhandsgranska innehållet i sammanfattningen som skickas via e-post till inaktiva användare.","refresh":"Uppdatera","format":"Format","html":"html","text":"text","last_seen_user":"Senast sedd användare:","reply_key":"Svarsnyckel","skipped_reason":"Anledning för överhoppning","incoming_emails":{"from_address":"Från","to_addresses":"Till","cc_addresses":"Cc","subject":"Ämne","error":"Fel","none":"Inga inkommande e-postmeddelanden funna.","modal":{"title":"Detaljer om inkommande e-post ","error":"Fel","headers":"Sidhuvuden","subject":"Ämne","body":"Huvuddel","rejection_message":"Avvisad e-post"},"filters":{"from_placeholder":"från@exempel.se","to_placeholder":"till@exempel.se","cc_placeholder":"cc@exempel.se","subject_placeholder":"Ämne...","error_placeholder":"Fel"}},"logs":{"none":"Inga loggar funna.","filters":{"title":"Filter","user_placeholder":"användarnamn","address_placeholder":"namn@exempel.se","type_placeholder":"sammanfattning, registrering...","reply_key_placeholder":"svarsnyckel","skipped_reason_placeholder":"anledning"}}},"logs":{"title":"Loggar","action":"Åtgärd","created_at":"Skapad","last_match_at":"Senast matchad","match_count":"Träffar","ip_address":"IP","topic_id":"Ämnes-ID","post_id":"Inläggs-ID","category_id":"Kategori-ID","delete":"Radera","edit":"Redigera","save":"Spara","screened_actions":{"block":"blockera","do_nothing":"gör ingenting"},"staff_actions":{"title":"Personalåtgärder","instructions":"Klicka på användarnamn och handling för att filtrera listan. Klicka på profilbilder för att gå till användarnas profiler.","clear_filters":"Visa allt","staff_user":"Personalmedlem","target_user":"Målanvändare","subject":"Ämne","when":"När","context":"Sammanhang","details":"Detaljer","previous_value":"Föregående","new_value":"Ny","diff":"Diff","show":"Visa","modal_title":"Detaljer","no_previous":"Det finns inget tidigare värde.","deleted":"Inget nytt värde. Registreringen raderades.","actions":{"delete_user":"radera användare","change_trust_level":"ändra förtroendenivå","change_username":"ändra användarnamn","change_site_setting":"ändra sidinställning","change_site_customization":"ändra webbplatsanpassning","delete_site_customization":"radera webbplatsanpassning","change_site_text":"ändra webbplatsens text","suspend_user":"stäng av användare","unsuspend_user":"häv avstängning av användare","grant_badge":"ge utmärkelse","revoke_badge":"upphäv utmärkelse","check_email":"kolla e-post","delete_topic":"ta bort ämne","delete_post":"ta bort inlägg","impersonate":"imitera","anonymize_user":"anonymisera användare","roll_up":"rulla upp IP-blockeringar","change_category_settings":"ändra kategori-inställningarna","delete_category":"radera kategori","create_category":"skapa kategori","block_user":"blockera användare","unblock_user":"häv blockering av användare","grant_admin":"bevlija administratör","revoke_admin":"återkalla administratör","grant_moderation":"bevilja moderering","revoke_moderation":"återkalla moderering","backup_operation":"säkerhetskopieringsdriften","deleted_tag":"raderad tagg","renamed_tag":"omdöpt tagg","revoke_email":"återkalla e-post"}},"screened_emails":{"title":"Kontrollerad e-post","description":"När någon försöker skapa ett nytt konto, kommer följande e-postadresser att kontrolleras och registreringen blockeras, eller någon annan åtgärd vidtas.","email":"E-postadress","actions":{"allow":"Tillåt"}},"screened_urls":{"title":"Granskade URL:er","description":"URL:erna som är listade här har använts i inlägg av användare som är identifierade som spammare.","url":"URL","domain":"Domän"},"screened_ips":{"title":"Granskade IP-adresser","description":"IP-adresser som är under bevakning. Använd \"tillåt\" för att vitlista IP-adresser.","delete_confirm":"Är du säker på att du vill ta bort regeln för %{ip_address}?","roll_up_confirm":"Är du säker på att du vill rulla upp vanligen undersökta IP-adresser i delnät?","rolled_up_some_subnets":"Framgångsrikt rullat upp bannlysta IP-poster till de här delnäten: %{subnets}.","rolled_up_no_subnet":"Det fanns inget att rulla upp.","actions":{"block":"Blockera","do_nothing":"Tillåt","allow_admin":"Tillåt admin"},"form":{"label":"Nytt:","ip_address":"IP-adress","add":"Lägg till","filter":"Sök"},"roll_up":{"text":"Rulla upp","title":"Skapar nya bannlysta delnätsposter om det finns minst 'min_ban_entries_for_roll_up' poster."}},"logster":{"title":"Felprotokoll"}},"impersonate":{"title":"Imitera","help":"Använd det här verktyget för att imitera ett användarkonto för avlusningssyften. Du kommer behöva logga ut när du är klar.","not_found":"Användaren kan ej hittas.","invalid":"Tyvärr, du kan inte imitera den användaren."},"users":{"title":"Användare","create":"Lägg till administratör","last_emailed":"Senaste som mottog e-post","not_found":"Tyvärr, det användarnamnet existerar inte i vårt system.","id_not_found":"Tyvärr, användar-ID existerar inte i vårt system.","active":"Aktiv","show_emails":"Visa e-post","nav":{"new":"Ny","active":"Aktiv","pending":"Avvaktar","staff":"Medarbetare","suspended":"Avstängd","blocked":"Blockerad","suspect":"Misstänkt"},"approved":"Godkänd?","approved_selected":{"one":"godkänd användare","other":"godkänd användare ({{count}})"},"reject_selected":{"one":"avvisad användare","other":"avvisade användare ({{count}})"},"titles":{"active":"Aktiva användare","new":"Nya användare","pending":"Användare under granskning","newuser":"Användare på Förtroendenivå 0 (Ny användare)","basic":"Användare på Förtroendenivå 1 (Grundnivå)","member":"Användare på förtroendenivå 2 (Medlem)","regular":"Användare på förtroendenivå 3 (Stammis)","leader":"Användare på förtroendenivå 4 (Ledare)","staff":"Medarbetare","admins":"Admin-användare","moderators":"Moderatorer","blocked":"Blockerade användare","suspended":"Avstängda användare","suspect":"Misstänkta användare"},"reject_successful":{"one":"1 användare har avvisats.","other":"%{count} användare har avvisats."},"reject_failures":{"one":"Avvisning av användaren misslyckades.","other":"Avvisning av %{count} användare misslyckades."},"not_verified":"Ej verifierad","check_email":{"title":"Visa den här användarens e-postadress","text":"Visa"}},"user":{"suspend_failed":"Någonting gick fel under avstängningen av denna användare {{error}}","unsuspend_failed":"Någonting gick fel under upplåsningen av denna användare {{error}}","suspend_duration":"Hur länge ska användaren vara avstängd?","suspend_duration_units":"(dagar)","suspend_reason_label":"Varför stänger du av användaren? Denna text \u003cb\u003ekommer att vara synlig för alla\u003c/b\u003e på användarens profilsida, och kommer att visas för användaren när han/hon försöker logga in. Håll den kort.","suspend_reason":"Anledning","suspended_by":"Avstängd av","delete_all_posts":"Radera alla inlägg","suspend":"Stäng av användare","unsuspend":"Lås upp användare","suspended":"Avstängd?","moderator":"Moderator?","admin":"Administratör?","blocked":"Blockerad?","staged":"Arrangerad?","show_admin_profile":"Administratör","edit_title":"Redigera titel","save_title":"Spara titel","refresh_browsers":"Tvinga webbläsaruppdatering","refresh_browsers_message":"Meddelande skickat till alla klienter!","show_public_profile":"Visa publik profil","impersonate":"Imitera","ip_lookup":"Kolla upp IP-adress","log_out":"Logga ut","logged_out":"Användaren loggades ut från alla enheter.","revoke_admin":"Återkalla Administratör","grant_admin":"Bevilja Administratör","revoke_moderation":"Återkalla Moderering","grant_moderation":"Bevilja Moderering","unblock":"Avblockera","block":"Blockera","reputation":"Rykte","permissions":"Rättigheter","activity":"Aktivitet","like_count":"Gillningar utdelade / mottagna","last_100_days":"de senaste 100 dagarna","private_topics_count":"Privata ämnen","posts_read_count":"Inlägg lästa","post_count":"Inlägg skapade","topics_entered":"Besökta ämnen","flags_given_count":"Givna flaggningar","flags_received_count":"Mottagna flaggningar","warnings_received_count":"Mottagna varningar","flags_given_received_count":"Flaggor utdelade / mottagna","approve":"Godkänn","approved_by":"godkänd av","approve_success":"Användaren är godkänd och e-post kommer att skickas med aktiveringsinstruktioner.","approve_bulk_success":"OK! Alla valda användare har godkänts och meddelats.","time_read":"Lästid","anonymize":"Anonymisera användare","anonymize_confirm":"Är du SÄKER på att du vill anonymisera detta konto? Detta kommer ändra användarnamnet och e-postadressen samt rensa all profilinformation.","anonymize_yes":"Ja, anonymisera detta konto","anonymize_failed":"Ett problem uppstod vid anonymiseringen av kontot","delete":"Radera användare","delete_forbidden_because_staff":"Administratörer och moderatorer kan inte tas bort.","delete_posts_forbidden_because_staff":"Kan inte ta bort alla inlägg av administratörer och moderatorer.","delete_forbidden":{"one":"Användare kan inte tas bort om de har inlägg. Radera alla inlägg innan du försöker ta bort en användare. (Inlägg som är äldre än %{count} dag kan ej raderas.)","other":"Användare kan inte tas bort om de har inlägg. Radera alla inlägg innan du försöker ta bort en användare. (Inlägg som är äldre än %{count} dagar kan ej raderas.)"},"cant_delete_all_posts":{"one":"Kan inte radera alla inlägg. Några inlägg är äldre än %{count} dag gammal. (Inställningen delete_user_max_post_age)","other":"Kan inte radera alla inlägg. Några inlägg är äldre än %{count} dagar gamla. (Inställningen delete_user_max_post_age)"},"cant_delete_all_too_many_posts":{"one":"Kan inte radera alla inlägg, då användaren har fler än 1 inlägg. (delete_all_posts_max)","other":"Kan inte radera alla inlägg, då användaren har fler än %{count} inlägg. (delete_all_posts_max)"},"delete_confirm":"Är du SÄKER på att du vill radera den användaren? Detta är permanent!","delete_and_block":"Radera och \u003cb\u003eblockera\u003c/b\u003e denna e-post och IP-adress","delete_dont_block":"Radera enbart","deleted":"Användaren har raderats.","delete_failed":"Ett problem uppstod då användaren skulle raderas. Kontrollera att alla inlägg är borttagna innan du försöker radera användaren.","send_activation_email":"Skicka aktiveringsbrev","activation_email_sent":"Ett aktiveringsbrev har skickats.","send_activation_email_failed":"Ett problem uppstod då ett nytt aktiveringsbrev skulle skickas. %{error}","activate":"Aktivera konto","activate_failed":"Ett problem uppstod då användaren skulle aktiveras.","deactivate_account":"Inaktivera Konto","deactivate_failed":"Det uppstod ett problem vid inaktiveringen av användaren.","unblock_failed":"Ett problem uppstod vid avblockeringen av användaren.","block_failed":"Ett problem uppstod vid blockering av användaren.","block_confirm":"Är du säker på att du vill blockera den här användaren? Användaren kommer inte att kunna skapa några nya ämnen eller inlägg.","block_accept":"Ja, blockera den här användaren","bounce_score":"Antal studs","reset_bounce_score":{"label":"Återställ","title":"Återställ studsantalet till 0"},"deactivate_explanation":"En avaktiverad användare måste bekräfta sin e-postadress igen.","suspended_explanation":"En avstängd användare kan inte logga in.","block_explanation":"En blockerad användare kan inte skriva inlägg eller starta ämnen.","staged_explanation":"En arrangerad användare kan endast skriva inlägg via e-post i specifika ämnen.","bounce_score_explanation":{"none":"Inga studsar har mottagits nyligen från den e-posten.","some":"Några studsar har mottagits nyligen från den e-posten.","threshold_reached":"Mottog för många studsar från den e-posten."},"trust_level_change_failed":"Ett problem uppstod då användarens förtroendenivå skulle ändras.","suspend_modal_title":"Stäng av användare","trust_level_2_users":"Användare med förtroendenivå 2","trust_level_3_requirements":"Krav för förtroendenivå 3","trust_level_locked_tip":"förtroendenivå är låst, systemet kommer ej att befordra eller degradera användare","trust_level_unlocked_tip":"förtroendenivå är olåst, systemet kan komma att befordra eller degradera användare","lock_trust_level":"Lås förtroendenivå","unlock_trust_level":"Lås upp förtroendenivå","tl3_requirements":{"title":"Krav för förtroendenivå 3","value_heading":"Värde","requirement_heading":"Krav","visits":"Besök","days":"dagar","topics_replied_to":"Ämnen svarade på","topics_viewed":"Besökta ämnen","topics_viewed_all_time":"Besökta ämnen (totalt)","posts_read":"Lästa inlägg","posts_read_all_time":"Lästa inlägg (totalt)","flagged_posts":"Flaggade inlägg","flagged_by_users":"Användare som flaggade","likes_given":"Utdelade gillningar","likes_received":"Mottagna gillningar","likes_received_days":"Mottagna gillningar: unika dagar","likes_received_users":"Mottagna gillningar: unika användare","qualifies":"Kvalificerad för förtroendenivå 3.","does_not_qualify":"Ej kvalificerad för förtroendenivå 3.","will_be_promoted":"Kommer snart befordras.","will_be_demoted":"Kommer snart degraderas.","on_grace_period":"För närvarande i nådefrist för befordran, kommer inte degraderas.","locked_will_not_be_promoted":"Förtroendenivå låst. Kommer aldrig bli befordrad.","locked_will_not_be_demoted":"Förtroendenivå låst. Kommer aldrig degraderas."},"sso":{"title":"Single sign on","external_id":"Externt ID","external_username":"Användarnamn","external_name":"Namn","external_email":"E-post","external_avatar_url":"URL till profilbild"}},"user_fields":{"title":"Användarfält","help":"Lägg till fält som dina användare kan fylla i.","create":"Skapa ett användarfält","untitled":"Namnlös","name":"Fältnamn","type":"Fälttyp","description":"Fältbeskrivning","save":"Spara","edit":"Redigera","delete":"Ta bort","cancel":"Avbryt","delete_confirm":"Är du säker på att fu vill ta bort det här användarfältet?","options":"Alternativ","required":{"title":"Krävs vid registrering?","enabled":"krävs","disabled":"krävs ej"},"editable":{"title":"Redigerbar efter registrering?","enabled":"redigerbar","disabled":"ej redigerbar"},"show_on_profile":{"title":"Visa på offentlig profil?","enabled":"visas på profil","disabled":"visas ej på profil"},"show_on_user_card":{"title":"Visa på användarkort?","enabled":"syns på användarkort","disabled":"syns inte på användarkort"},"field_types":{"text":"Textfält","confirm":"Bekräftelse","dropdown":"Rullgardin"}},"site_text":{"description":"Du kan anpassa all text på ditt forum. Börja genom att söka nedanför:","search":"Sök efter texten som du vill redigera","title":"Textinnehåll","edit":"redigera","revert":"Ångra ändringarna","revert_confirm":"Är du säker på att du vill ångra dina ändringar?","go_back":"Tillbaka till sökningen","recommended":"Vi rekommenderar att du anpassar följande texter:","show_overriden":"Visa bara överskrivna"},"site_settings":{"show_overriden":"Visa bara överskrivna","title":"Webbplatsinställningar","reset":"återställ","none":"inget","no_results":"Inga resultat hittades.","clear_filter":"Rensa","add_url":"lägg till URL","add_host":"lägg till värd","categories":{"all_results":"Alla","required":"Krävs","basic":"Grundläggande setup","users":"Användare","posting":"Publicera inlägg","email":"E-post","files":"Filer","trust":"Förtroendenivå","security":"Säkerhet","onebox":"Onebox","seo":"Sökmotoroptimering","spam":"Spam","rate_limits":"Begränsningar","developer":"Utvecklare","embedding":"Inbäddning","legal":"Juridik","uncategorized":"Övrigt","backups":"Säkerhetskopior","login":"Inloggning","plugins":"Tillägg","user_preferences":"Användarinställningar","tags":"Taggar"}},"badges":{"title":"Utmärkelser","new_badge":"Ny utmärkelse","new":"Ny","name":"Namn","badge":"Utmärkelse","display_name":"Visa namn","description":"Beskrivning","long_description":"Lång beskrivning","badge_type":"Utmärkelsetyp","badge_grouping":"Grupp","badge_groupings":{"modal_title":"Utmärkelsegrupper"},"granted_by":"Utfärdad av","granted_at":"Utfärdad vid","reason_help":"(En länk till ett inlägg eller ämne)","save":"Spara","delete":"Ta bort","delete_confirm":"Är du säker på att du vill ta bort den utmärkelsen?","revoke":"Upphäv","reason":"Anledning","expand":"Utvidga \u0026hellip;","revoke_confirm":"Är du säker på att du vill upphäva den utmärkelsen?","edit_badges":"Redigera utmärkelser","grant_badge":"Utfärda utmärkelse","granted_badges":"Utfärdade utmärkelser","grant":"Utfärda","no_user_badges":"%{name} har inte beviljats några utmärkelser.","no_badges":"Det finns inga utmärkelser som kan utfärdas.","none_selected":"Välj en utmärkelse för att komma igång","allow_title":"Tillåt att utmärkelse används som titel","multiple_grant":"Kan utfärdas flera gånger","listable":"Visa utmärkelse på den offentliga utmärkelsesidan","enabled":"Aktivera utmärkelse","icon":"Ikon","image":"Bild","icon_help":"Använd antingen en Font Awesome-klass eller en URL till en bild","query":"Utmärkelsesökning (SQL)","target_posts":"Sök målets inlägg","auto_revoke":"Kör återkallelsesökning dagligen","show_posts":"Visa inlägg som beviljar utmärkelse på utmärkelsesidan","trigger":"Trigger","trigger_type":{"none":"Uppdatera dagligen","post_action":"När en användare interagerar med ett inlägg","post_revision":"När en användare redigerar eller skapar ett inlägg","trust_level_change":"När en användare byter förtroendenivå","user_change":"När en användare redigeras eller skapas","post_processed":"Efter ett inlägg bearbetats"},"preview":{"link_text":"Förhandsvisa utfärdade utmärkelser","plan_text":"Förhandsgranska med sökningsplan","modal_title":"Förhandsgranskning av utmärkelsesökning","sql_error_header":"Det uppstod ett fel med sökningen.","error_help":"Se följande länk för hjälp med utmärkelsesökningar.","bad_count_warning":{"header":"VARNING!","text":"Det saknas urval av beviljningar. Det händer när utmärkelsesökningen returnerar ett användar-ID eller ett inläggs-ID som inte existerar. Det kan få oväntade resultat i ett senare skede, dubblekontrollera gärna din sökning."},"no_grant_count":"Inga utmärkelser att tilldelas.","grant_count":{"one":"\u003cb\u003e1\u003c/b\u003e utmärkelse att tilldelas.","other":"\u003cb\u003e%{count}\u003c/b\u003e utmärkelser att tilldelas. "},"sample":"Exempel:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e för inlägg i %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e för inlägg i %{link} vid kl. \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e vid kl. \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}},"emoji":{"title":"Emoji","help":"Lägg till en ny emoji för andra att använda. (TIPS: dra och släpp flera filer på en och samma gång)","add":"Lägg till ny emoji","name":"Namn","image":"Bild","delete_confirm":"Är du säker på att du vill radera emojin :%{name}:?"},"embedding":{"get_started":"Börja genom att lägga till värden, om du vill bädda in Discourse på en annan hemsida. ","confirm_delete":"Är du säker på att du vill ta bort värden?","sample":"Använd följande HTML-kod på din webbplats för att skapa och bädda in discourse-ämnen. Byt ut \u003cb\u003eREPLACE_ME\u003c/b\u003e med den kanoniska URL-en för sidan som du bäddar in den i. ","title":"Inbäddning","host":"Tillåtna värdar","edit":"ändra","category":"Inlägg till kategori","add_host":"Lägg till värd","settings":"Inbäddningsinställningar","feed_settings":"Flödes-inställningar","feed_description":"Tillhandahållande av RSS/ATOM-flöde på din webbplats kan förbättra Discourse möjlighet att importera ditt innehåll.","crawling_settings":"Inställningar för sökrobotar","crawling_description":"När Discourse skapar ämnen för dina inlägg, om det inte finns något RSS/ATOM-flöde närvarande så kommer det att försöka parsa ditt innehåll från din HTML. Ibland är det utmanande att extrahera ditt innehåll, så vi tillhandahåller möjligheten att specifiera CSS-reglerna för att göra extraheringen enklare.","embed_by_username":"Användarnamn för skapandet av ämne","embed_post_limit":"Högsta tillåtna antal inlägg att bädda in","embed_username_key_from_feed":"Nyckel för att hämta discourse användarnamn från flöde","embed_truncate":"Trunkera de inbäddade inläggen","embed_whitelist_selector":"CSS-väljare för element som tillåts bäddas in","embed_blacklist_selector":"CSS-väljare för element som tas bort från inbäddningar","embed_classname_whitelist":"Tillåtna CSS klassnamn","feed_polling_enabled":"Importera inlägg via RSS/ATOM","feed_polling_url":"URL för RSS/ATOM-flöde att webbsöka","save":"Spara inbäddningsinställningar"},"permalink":{"title":"Permalänkar","url":"URL","topic_id":"Ämnes-ID","topic_title":"Ämne","post_id":"Inläggs-ID","post_title":"Publicera","category_id":"Kategori-ID","category_title":"Kategori","external_url":"Extern URL","delete_confirm":"Är du säker på att du vill ta bort den här permalänken?","form":{"label":"Ny:","add":"Lägg till","filter":"Sök (URL eller Extern URL)"}}}}},"en":{"js":{"s3":{"regions":{"ap_south_1":"Asia Pacific (Mumbai)","cn_north_1":"China (Beijing)"}},"groups":{"index":"Groups"},"categories":{"topic_sentence":{"one":"1 topic","other":"%{count} topics"}},"user":{"desktop_notifications":{"currently_enabled":"","currently_disabled":""},"tracked_tags_instructions":"You will automatically track all topics with these tags. A count of new posts will appear next to the topic.","tracked_categories_instructions":"You will automatically track all topics in these categories. A count of new posts will appear next to the topic.","watched_first_post_tags":"Watching First Post","watched_first_post_tags_instructions":"You will be notified of the first post in each new topic with these tags.","apps":"Apps","revoke_access":"Revoke Access","undo_revoke_access":"Undo Revoke Access","api_permissions":"Permissions:","api_approved":"Approved:","api_read":"read","api_read_write":"read and write"},"logs_error_rate_notice":{"reached":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e reached site setting limit of %{siteSettingRate}.","exceeded":"\u003cb\u003e%{relativeAge}\u003c/b\u003e – \u003ca href='%{url}' target='_blank'\u003e%{rate}\u003c/a\u003e exceeds site setting limit of %{siteSettingRate}."},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"Emoji One","win10":"Win10"},"category_page_style":{"categories_only":"Categories Only","categories_with_featured_topics":"Categories with Featured Topics","categories_and_latest_topics":"Categories and Latest Topics"},"composer":{"unlist":"unlisted","toggle_unlisted":"Toggle Unlisted","group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e1 person\u003c/a\u003e – are you sure?","other":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e{{count}} people\u003c/a\u003e – are you sure?"},"bold_label":"B","italic_label":"I","heading_label":"H","yourself_confirm":{"title":"Did you forget to add recipients?","body":"Right now this message is only being sent to yourself!"},"auto_close":{"all":{"units":""}},"details_title":"Summary","details_text":"This text will be hidden"},"search":{"too_short":"Your search term is too short."},"topic":{"filter_to":{"one":"1 post in topic","other":"{{count}} posts in topic"},"auto_close_immediate":{"one":"The last post in the topic is already 1 hour old, so the topic will be closed immediately.","other":"The last post in the topic is already %{count} hours old, so the topic will be closed immediately."},"progress":{"jump_prompt":"jump to post","jump_prompt_long":"What post would you like to jump to?"},"notifications":{"reasons":{"3_10":"You will receive notifications because you are watching a tag on this topic."}},"merge_posts":{"title":"Merge Selected Posts","action":"merge selected posts","error":"There was an error merging the selected posts."}},"post":{"merge":{"confirm":{"one":"Are you sure you want merge those posts?","other":"Are you sure you want to merge those {{count}} posts?"}}},"category":{"notifications":{"watching":{"description":"You will automatically watch all topics in these categories. You will be notified of every new post in every topic, and a count of new replies will be shown."},"tracking":{"description":"You will automatically track all topics in these categories. You will be notified if someone mentions your @name or replies to you, and a count of new replies will be shown."}}},"flagging":{"delete_confirm_MF":"You are about to delete {POSTS, plural, one {\u003cb\u003e1\u003c/b\u003e post} other {\u003cb\u003e#\u003c/b\u003e posts}} and {TOPICS, plural, one {\u003cb\u003e1\u003c/b\u003e topic} other {\u003cb\u003e#\u003c/b\u003e topics}} from this user, remove their account, block signups from their IP address \u003cb\u003e{ip_address}\u003c/b\u003e, and add their email address \u003cb\u003e{email}\u003c/b\u003e to a permanent block list. Are you sure this user is really a spammer?","custom_message":{"at_least":{"one":"enter at least 1 character","other":"enter at least {{count}} characters"},"more":{"one":"1 to go...","other":"{{count}} to go..."},"left":{"one":"1 remaining","other":"{{count}} remaining"}}},"topic_map":{"links_shown":"show more links..."},"tagging":{"selector_no_tags":"no tags","filters":{"untagged_without_category":"%{filter} untagged topics","untagged_with_category":"%{filter} untagged topics in %{category}"},"notifications":{"watching":{"description":"You will automatically watch all topics in this tag. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic."},"tracking":{"description":"You will automatically track all topics in this tag. A count of unread and new posts will appear next to the topic."}}},"details":{"title":"Hide Details"},"admin":{"groups":{"flair_url":"Avatar Flair URL","flair_url_placeholder":"(Optional) Image URL","flair_bg_color":"Avatar Flair Background Color","flair_bg_color_placeholder":"(Optional) Hex color value","flair_preview":"Preview"},"user":{"delete_all_posts_confirm_MF":"You are about to delete {POSTS, plural, one {1 post} other {# posts}} and {TOPICS, plural, one {1 topic} other {# topics}}. Are you sure?","tl3_requirements":{"table_title":{"one":"In the last day:","other":"In the last %{count} days:"}}},"site_settings":{"categories":{"user_api":"User API","search":"Search"}},"embedding":{"path_whitelist":"Path Whitelist","embed_title_scrubber":"Regular expression used to scrub the title of posts"}}}}};
I18n.locale = 'sv';
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
//! locale : swedish (sv)
//! author : Jens Alm : https://github.com/ulmus

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['moment'], factory) :
   factory(global.moment)
}(this, function (moment) { 'use strict';


    var sv = moment.defineLocale('sv', {
        months : 'januari_februari_mars_april_maj_juni_juli_augusti_september_oktober_november_december'.split('_'),
        monthsShort : 'jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec'.split('_'),
        weekdays : 'söndag_måndag_tisdag_onsdag_torsdag_fredag_lördag'.split('_'),
        weekdaysShort : 'sön_mån_tis_ons_tor_fre_lör'.split('_'),
        weekdaysMin : 'sö_må_ti_on_to_fr_lö'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'YYYY-MM-DD',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY [kl.] HH:mm',
            LLLL : 'dddd D MMMM YYYY [kl.] HH:mm',
            lll : 'D MMM YYYY HH:mm',
            llll : 'ddd D MMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[Idag] LT',
            nextDay: '[Imorgon] LT',
            lastDay: '[Igår] LT',
            nextWeek: '[På] dddd LT',
            lastWeek: '[I] dddd[s] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : 'om %s',
            past : 'för %s sedan',
            s : 'några sekunder',
            m : 'en minut',
            mm : '%d minuter',
            h : 'en timme',
            hh : '%d timmar',
            d : 'en dag',
            dd : '%d dagar',
            M : 'en månad',
            MM : '%d månader',
            y : 'ett år',
            yy : '%d år'
        },
        ordinalParse: /\d{1,2}(e|a)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (~~(number % 100 / 10) === 1) ? 'e' :
                (b === 1) ? 'a' :
                (b === 2) ? 'a' :
                (b === 3) ? 'e' : 'e';
            return number + output;
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return sv;

}));
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
